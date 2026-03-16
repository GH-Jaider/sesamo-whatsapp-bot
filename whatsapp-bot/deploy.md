# Deploying Sésamo WhatsApp Bot on DigitalOcean

Complete step-by-step guide to deploy the bot on a DigitalOcean Droplet with
Docker Compose, Caddy reverse proxy, and automated GitHub Actions deployments.

**Cost**: ~$6/month (1 vCPU, 1GB RAM Droplet)

---

## Table of Contents

1. [Create the Droplet](#1-create-the-droplet)
2. [Initial server setup](#2-initial-server-setup)
3. [Install Docker](#3-install-docker)
4. [Configure firewall](#4-configure-firewall)
5. [Server hardening](#5-server-hardening)
6. [Clone the repo and configure](#6-clone-the-repo-and-configure)
7. [First deployment](#7-first-deployment)
8. [Set up GitHub Actions CI/CD](#8-set-up-github-actions-cicd)
9. [Update Meta webhook URL](#9-update-meta-webhook-url)
10. [Add a domain and HTTPS (optional)](#10-add-a-domain-and-https-optional)
11. [Common operations](#11-common-operations)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Create the Droplet

1. Log in to [DigitalOcean](https://cloud.digitalocean.com/)
2. Click **Create** → **Droplets**
3. Choose these settings:

   | Setting       | Value                                      |
   |---------------|--------------------------------------------|
   | Region        | **NYC1** or **SFO3** (closest to Colombia) |
   | Image         | **Ubuntu 24.04 LTS**                       |
   | Size          | **Basic → Regular → $6/mo** (1 vCPU, 1GB RAM, 25GB SSD) |
   | Auth method   | **SSH key** (recommended) or password      |
   | Hostname      | `sesamo-bot`                               |

4. If using SSH key auth:
   - On your **local machine**, generate a key if you don't have one:
     ```bash
     ssh-keygen -t ed25519 -C "sesamo-droplet"
     ```
   - Copy the public key:
     ```bash
     cat ~/.ssh/id_ed25519.pub
     ```
   - Paste it in the DigitalOcean "SSH Keys" section during Droplet creation

5. Click **Create Droplet** and note the **IP address** (e.g., `164.90.XXX.XXX`)

---

## 2. Initial server setup

SSH into your new Droplet:

```bash
ssh root@YOUR_DROPLET_IP
```

### Create a deploy user (don't run everything as root)

```bash
# Create user
adduser --disabled-password --gecos "" deploy

# Give sudo access
usermod -aG sudo deploy

# Allow sudo without password (for automated deploys)
echo "deploy ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/deploy

# Copy SSH keys so you can log in as deploy
mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
```

### Test login as deploy user

Open a **new terminal** (keep root session open as backup):

```bash
ssh deploy@YOUR_DROPLET_IP
```

If this works, you're good. From now on, always use the `deploy` user.

---

## 3. Install Docker

Run these commands as the `deploy` user:

```bash
# Install Docker using the official convenience script
curl -fsSL https://get.docker.com | sudo sh

# Add deploy user to docker group (no sudo needed for docker commands)
sudo usermod -aG docker deploy

# Apply group change (or log out and back in)
newgrp docker

# Verify Docker works
docker run hello-world

# Verify Docker Compose is available (included with Docker Engine)
docker compose version
```

---

## 4. Configure firewall

```bash
# Allow SSH (so you don't lock yourself out!)
sudo ufw allow OpenSSH

# Allow HTTP and HTTPS for the bot
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable the firewall
sudo ufw enable

# Verify rules
sudo ufw status
```

Expected output:
```
Status: active

To                         Action      From
--                         ------      ----
OpenSSH                    ALLOW       Anywhere
80/tcp                     ALLOW       Anywhere
443/tcp                    ALLOW       Anywhere
```

---

## 5. Server hardening

These steps protect the Droplet from common attacks. Run everything as the
`deploy` user (with sudo) unless noted otherwise.

### Disable root SSH login

Now that you have the `deploy` user working, disable root login entirely:

```bash
sudo sed -i 's/^PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sudo sed -i 's/^#PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
```

Also disable password authentication (SSH key only):

```bash
sudo sed -i 's/^#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo sed -i 's/^PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
```

Restart SSH to apply:

```bash
sudo systemctl restart sshd
```

> **Before closing your current session**, open a **new terminal** and verify
> you can still log in as `deploy`:
> ```bash
> ssh deploy@YOUR_DROPLET_IP
> ```
> If this fails, go back to the original session and undo the changes.

### Install fail2ban (brute-force protection)

fail2ban automatically bans IPs that show malicious signs (e.g., too many
failed SSH login attempts):

```bash
sudo apt update && sudo apt install -y fail2ban
```

Create a local config (so updates don't overwrite your settings):

```bash
sudo tee /etc/fail2ban/jail.local > /dev/null << 'EOF'
[DEFAULT]
# Ban for 1 hour after 5 failures within 10 minutes
bantime  = 3600
findtime = 600
maxretry = 5
# Use UFW for banning
banaction = ufw

[sshd]
enabled = true
port    = ssh
filter  = sshd
logpath = /var/log/auth.log
maxretry = 3
EOF
```

Start and enable:

```bash
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Verify it's running and monitoring SSH
sudo fail2ban-client status sshd
```

### Enable automatic security updates

This ensures critical security patches are applied automatically without
manual intervention:

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

Select **Yes** when prompted. Then verify it's configured:

```bash
# Check that security updates are enabled
cat /etc/apt/apt.conf.d/20auto-upgrades
```

Expected output:
```
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
```

Optionally enable auto-reboot for kernel updates (reboots at 4 AM if needed):

```bash
sudo tee -a /etc/apt/apt.conf.d/50unattended-upgrades > /dev/null << 'EOF'
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:00";
EOF
```

### Set up swap space (for the 1GB RAM Droplet)

With only 1GB RAM, a swap file prevents out-of-memory kills during Docker
builds:

```bash
# Create a 1GB swap file
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make it permanent across reboots
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Set swappiness low (only swap when truly needed)
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# Verify
free -h
```

### Harden shared memory

Prevent certain exploits that abuse shared memory:

```bash
echo 'tmpfs /run/shm tmpfs defaults,noexec,nosuid 0 0' | sudo tee -a /etc/fstab
```

### Summary of what's now protected

| Threat                    | Protection                                |
|---------------------------|-------------------------------------------|
| SSH brute-force attacks   | fail2ban (bans after 3 failed attempts)   |
| Root login via SSH        | Disabled — only `deploy` user with SSH key |
| Password guessing         | Password auth disabled — SSH keys only    |
| Unpatched vulnerabilities | Automatic security updates                |
| Out-of-memory crashes     | 1GB swap file                             |
| Shared memory exploits    | noexec/nosuid on /run/shm                 |
| Unauthorized ports        | UFW firewall (only 22, 80, 443)           |

---

## 6. Clone the repo and configure

```bash
# Clone the repository
cd ~
git clone https://github.com/GH-Jaider/sesamo-whatsapp-bot.git sesamo-restaurante
cd sesamo-restaurante
```

### Create the .env file

```bash
cp whatsapp-bot/.env.template whatsapp-bot/.env
nano whatsapp-bot/.env
```

Fill in your values:

```env
# --- WhatsApp Cloud API ---
WA_PHONE_NUMBER_ID="YOUR_PHONE_NUMBER_ID"
WA_ACCESS_TOKEN="YOUR_ACCESS_TOKEN"
WA_VERIFY_TOKEN="YOUR_VERIFY_TOKEN"
WA_APP_SECRET=""

# --- Bot Config ---
ADMIN_PHONE="573001234567"
NEQUI_NUMBER="3001234567"

# --- Server ---
PORT="3000"
NODE_ENV="production"
LOG_LEVEL="info"
```

> **Where to find these values**: See `meta-setup.md` for step-by-step
> instructions on getting your WhatsApp Cloud API credentials from the Meta
> Developer Console.

---

## 7. First deployment

```bash
cd ~/sesamo-restaurante

# Build and start the containers
docker compose up --build -d
```

This will:
1. Build the bot image (compile TypeScript, install production deps)
2. Start the Caddy reverse proxy on ports 80/443
3. Start the bot on port 3000 (internal, proxied through Caddy)

### Verify it's running

```bash
# Check container status
docker compose ps

# Check bot logs
docker compose logs bot

# Check caddy logs
docker compose logs caddy

# Test the webhook endpoint
curl http://localhost/webhook?hub.mode=subscribe\&hub.verify_token=YOUR_VERIFY_TOKEN\&hub.challenge=test123
# Should respond: test123
```

You can also test from your local machine:

```bash
curl http://YOUR_DROPLET_IP/webhook?hub.mode=subscribe\&hub.verify_token=YOUR_VERIFY_TOKEN\&hub.challenge=test123
```

### Verify static pages

```bash
curl -s -o /dev/null -w "%{http_code}" http://YOUR_DROPLET_IP/menu
# Should respond: 200

curl -s -o /dev/null -w "%{http_code}" http://YOUR_DROPLET_IP/privacidad
# Should respond: 200
```

---

## 8. Set up GitHub Actions CI/CD

This enables automatic deployment whenever you push to `main`.

### Generate a deploy SSH key

On your **local machine**:

```bash
# Generate a key pair specifically for GitHub Actions
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/sesamo_deploy_key -N ""
```

### Add the public key to the Droplet

```bash
# Copy the public key
cat ~/.ssh/sesamo_deploy_key.pub

# SSH into the Droplet
ssh deploy@YOUR_DROPLET_IP

# Add the key to authorized_keys
echo "PASTE_THE_PUBLIC_KEY_HERE" >> ~/.ssh/authorized_keys
```

### Add secrets to GitHub

1. Go to your repo on GitHub → **Settings** → **Environments** → `deploy`
2. Add these **Environment secrets**:

   | Secret Name       | Value                                           |
   |-------------------|-------------------------------------------------|
   | `DROPLET_IP`      | Your Droplet's IP address (e.g., `164.90.XXX.XXX`) |
   | `DROPLET_USER`    | `deploy`                                        |
   | `SSH_PRIVATE_KEY`  | Contents of `~/.ssh/sesamo_deploy_key` (the **private** key, NOT .pub) |

   To copy the private key:
   ```bash
   cat ~/.ssh/sesamo_deploy_key
   ```
   Copy the **entire** output including `-----BEGIN OPENSSH PRIVATE KEY-----` and `-----END OPENSSH PRIVATE KEY-----`.

   If the GitHub Action fails with `error: missing server host`, it means
   `DROPLET_IP` is missing, empty, misspelled, or was saved outside the
   `deploy` environment used by the workflow. Verify the secret names match
   exactly: `DROPLET_IP`, `DROPLET_USER`, `SSH_PRIVATE_KEY`.

### Test the CI/CD

Push any change to `main`:

```bash
git add .
git commit -m "test: trigger deploy"
git push origin main
```

Go to your repo → **Actions** tab to see the deployment running.

---

## 9. Update Meta webhook URL

1. Go to [Meta Developer Console](https://developers.facebook.com/)
2. Select your app → **WhatsApp** → **Configuration**
3. Under **Webhook**, click **Edit**
4. Set the **Callback URL** to:
   ```
   http://YOUR_DROPLET_IP/webhook
   ```
   (or `https://yourdomain.com/webhook` if you've set up a domain)
5. Set the **Verify token** to the same value as `WA_VERIFY_TOKEN` in your `.env`
6. Click **Verify and Save**
7. Make sure you're subscribed to the `messages` webhook field

---

## 10. Add a domain and HTTPS (optional)

When you have a domain name:

### Point DNS to your Droplet

1. In your domain registrar (Namecheap, Cloudflare, etc.), add an **A record**:

   | Type | Name    | Value             |
   |------|---------|-------------------|
   | A    | `bot`   | `YOUR_DROPLET_IP` |

   This creates `bot.yourdomain.com`. You can also use `@` for the root domain.

2. Wait for DNS propagation (usually 5-15 minutes, up to 48 hours)

3. Verify DNS:
   ```bash
   dig bot.yourdomain.com +short
   # Should show your Droplet's IP
   ```

### Enable HTTPS in Caddy

Edit the `Caddyfile` on the server:

```bash
ssh deploy@YOUR_DROPLET_IP
cd ~/sesamo-restaurante
nano Caddyfile
```

Change from:
```
http://:80 {
    reverse_proxy bot:3000
}
```

To:
```
bot.yourdomain.com {
    reverse_proxy bot:3000
}
```

That's it. Restart Caddy:

```bash
docker compose restart caddy
```

Caddy will automatically:
- Obtain a Let's Encrypt TLS certificate
- Redirect HTTP → HTTPS
- Renew the certificate before it expires

### Update Meta webhook

Update the webhook URL in the Meta Developer Console to:
```
https://bot.yourdomain.com/webhook
```

---

## 11. Common operations

### View logs

```bash
# All services
docker compose logs -f

# Bot only
docker compose logs -f bot

# Last 100 lines
docker compose logs --tail 100 bot
```

### Restart the bot

```bash
docker compose restart bot
```

### Rebuild and redeploy manually

```bash
cd ~/sesamo-restaurante
git pull origin main
docker compose up --build -d
```

### Stop everything

```bash
docker compose down
```

### Check disk usage

```bash
docker system df
```

### Clean up old Docker images

```bash
docker image prune -f
```

### Access the SQLite database

```bash
# Find the volume mount
docker volume inspect sesamo-restaurante_bot_data

# The database file is inside the volume. To inspect it:
docker compose exec bot ls -la data/
```

### SSH into the bot container

```bash
docker compose exec bot sh
```

---

## 12. Troubleshooting

### Bot container keeps restarting

```bash
# Check logs for the error
docker compose logs bot --tail 50

# Common causes:
# - Missing/invalid .env file → check whatsapp-bot/.env exists with correct values
# - Database corruption → delete the volume: docker compose down -v && docker compose up -d
```

### "Connection refused" when testing webhook

```bash
# Check if containers are running
docker compose ps

# Check if Caddy is proxying correctly
docker compose logs caddy

# Test directly against the bot (bypassing Caddy)
docker compose exec bot wget -qO- http://localhost:3000/webhook?hub.mode=subscribe\&hub.verify_token=YOUR_TOKEN\&hub.challenge=test
```

### Meta webhook verification fails

1. Make sure the Droplet firewall allows port 80 (and 443 if using HTTPS)
2. Make sure the `WA_VERIFY_TOKEN` in `.env` matches what you entered in Meta
3. Test the endpoint manually:
   ```bash
   curl "http://YOUR_DROPLET_IP/webhook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test123"
   ```
   Should respond with `test123`

### HTTPS not working after adding domain

```bash
# Check Caddy logs for certificate errors
docker compose logs caddy

# Common causes:
# - DNS not propagated yet (wait and retry)
# - Firewall blocking port 443
# - Domain not pointing to the Droplet IP
```

### GitHub Actions fails with `missing server host`

This error comes from `appleboy/ssh-action` when the `host` input is empty.

Check these items in GitHub:

1. Repository → **Settings** → **Environments** → `deploy`
2. Confirm these environment secrets exist exactly with these names:
   - `DROPLET_IP`
   - `DROPLET_USER`
   - `SSH_PRIVATE_KEY`
3. Confirm `DROPLET_IP` contains only the server IP, for example `164.90.10.20`
4. If this is a private fork or another repo, make sure the secrets were added in that repo too, inside the same `deploy` environment
5. Re-run the workflow after saving the secrets

### Out of disk space

```bash
# Check disk usage
df -h

# Clean Docker
docker system prune -a

# Check the SQLite database size
docker compose exec bot ls -lh data/sesamo.db
```

### Need to update environment variables

```bash
cd ~/sesamo-restaurante
nano whatsapp-bot/.env

# Restart the bot to pick up changes
docker compose restart bot
```
