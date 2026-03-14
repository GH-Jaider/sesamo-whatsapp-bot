# Deploying Sésamo WhatsApp Bot on an Android Phone

Guide to run the bot 24/7 on an old Android phone using Termux.

The bot uses the **WhatsApp Cloud API** (official Meta API), so there's no QR
scanning or Baileys sessions. You just need API credentials from Meta and a
publicly reachable webhook URL.

The same server also hosts the restaurant's menu and privacy policy pages.

Based on: https://dev.to/quave/hosting-web-app-on-your-old-android-phone-54bg

---

## 1. Install Termux

Install **Termux** from F-Droid (recommended) or Play Store.

> **Important:** The F-Droid version is more up-to-date and has fewer
> restrictions. The Play Store version is deprecated and may not work.
>
> Download: https://f-droid.org/en/packages/com.termux/

Also install **Termux:Boot** from F-Droid — this is needed to auto-start the
bot after a phone reboot:

> https://f-droid.org/en/packages/com.termux.boot/

---

## 2. Initial Setup in Termux

Open Termux and run:

```bash
pkg update && pkg upgrade -y
pkg install openssh nodejs-lts git pnpm cronie termux-services -y
```

### Set up SSH (optional but recommended)

So you can work from your computer instead of the phone keyboard:

```bash
sshd
whoami     # remember this username
ifconfig   # note the IP address (wlan0 -> inet)
passwd     # set a password
```

From your computer:

```bash
ssh <username>@<phone_ip> -p 8022
```

Termux SSH runs on port **8022** by default, not 22.

---

## 3. Clone and Install the Bot

```bash
cd ~
git clone <your-repo-url> sesamo
cd sesamo/whatsapp-bot
pnpm install
```

### Configure environment variables

```bash
cp .env.template .env
nano .env
```

Fill in the following:

- **`WA_PHONE_NUMBER_ID`** — from Meta Dashboard > WhatsApp > API Setup
- **`WA_ACCESS_TOKEN`** — permanent token from Meta Business Settings > System Users
- **`WA_VERIFY_TOKEN`** — any string you choose (must match your Meta webhook config)
- **`WA_APP_SECRET`** — from Meta Dashboard > App Settings > Basic (optional)
- **`ADMIN_PHONE`** — admin phone number (country code + number, no +)
- **`NEQUI_NUMBER`** — Nequi number shown to customers for payment

### Set up ngrok (persistent URL)

The WhatsApp Cloud API sends messages to your bot via a webhook. The bot runs
an HTTP server (default port 3000) that needs a publicly reachable HTTPS URL.

**ngrok** gives you a permanent HTTPS dev domain on the free tier, so Meta's
webhook URL stays the same across restarts, reboots, and WiFi drops.

1. Create a free ngrok account at https://dashboard.ngrok.com/signup

2. In the ngrok dashboard, claim a free static dev domain.

   It will look like:

   ```
   https://sesamo-bot.ngrok-free.app
   ```

3. Install ngrok on the phone:

   ```bash
   pkg install wget tar
   wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-arm64.tgz
   tar xvzf ngrok-v3-stable-linux-arm64.tgz
   mv ngrok $PREFIX/bin/ngrok
   chmod +x $PREFIX/bin/ngrok
   ```

4. Add your authtoken from the ngrok dashboard:

   ```bash
   ngrok config add-authtoken <YOUR_NGROK_AUTHTOKEN>
   ```

5. Start the tunnel manually once to verify the domain works:

   ```bash
   ngrok http 3000 --url=sesamo-bot.ngrok-free.app
   ```

   Replace `sesamo-bot.ngrok-free.app` with the dev domain you claimed.

#### Verify the tunnel works

```bash
# Start the tunnel
ngrok http 3000 --url=sesamo-bot.ngrok-free.app

# In another terminal/tmux pane, start the bot
pnpm start

# Test from your computer
curl https://sesamo-bot.ngrok-free.app/webhook
```

### Configure the Meta webhook

1. Go to **Meta Dashboard > WhatsApp > Configuration**
2. Set the **Callback URL** to your tunnel URL + `/webhook`
   (e.g., `https://sesamo-bot.ngrok-free.app/webhook`)
3. Set the **Verify Token** to the same value as `WA_VERIFY_TOKEN` in your `.env`
4. Subscribe to the **messages** webhook field

### Public pages served by the bot

The bot also serves static pages at these URLs:

| URL | Content |
|---|---|
| `/menu` | Restaurant menu (HTML) |
| `/menu.pdf` | Menu PDF |
| `/privacidad` | Privacy policy (HTML) — use this as the **Privacy Policy URL** in Meta app settings |
| `/privacidad.pdf` | Privacy policy PDF |

For example: `https://sesamo-bot.ngrok-free.app/privacidad`

Set this URL in **Meta Developers > App Settings > Basic > Privacy Policy URL**.

### First run — verify everything works

```bash
pnpm start
```

You should see `Server listening on port 3000`. The webhook is ready to receive
messages — send a message to your WhatsApp Business number from any phone to
test.

---

## 4. Keep the Bot Alive (CRITICAL)

Android aggressively kills background processes to save battery. Without these
steps, Termux will be killed within minutes of locking the screen. **Do ALL of
these steps — each one matters.**

> Reference: https://dontkillmyapp.com/

### 4a. Acquire a Wake Lock

This is the single most important step. In Termux, run:

```bash
termux-wake-lock
```

This acquires a partial wake lock that prevents Android from putting Termux to
sleep. You'll see a persistent notification from Termux saying "Acquiring
wakelock". **Do not dismiss it.**

To release it later (you normally don't want to):

```bash
termux-wake-unlock
```

### 4b. Disable Battery Optimization for Termux

Go to **Android Settings > Apps > Termux > Battery** and set it to
**Unrestricted**. Do the same for **Termux:Boot**.

#### Stock Android / Pixel

Settings > Battery > Battery Optimization > Termux > **Don't optimize**

#### Samsung (OneUI)

1. Settings > Apps > Termux > Battery > **Unrestricted**
2. Settings > Device Care > Battery > Background usage limits — add Termux
   and Termux:Boot to **"Never sleeping apps"**
3. Settings > Device Care > Battery > More battery settings:
   - Turn **OFF** "Adaptive battery"
   - Turn **OFF** "Put unused apps to sleep"

#### Xiaomi / Redmi / POCO (MIUI)

1. Settings > Apps > Manage apps > Termux > Battery saver > **No restrictions**
2. Settings > Apps > Manage apps > Termux > **Autostart: ON**
3. Security app > Battery > App battery saver > Termux > **No restrictions**

#### Huawei (EMUI)

1. Settings > Apps > Apps > Termux > Battery > **Enable: Allow background**
2. Settings > Battery > App launch > Termux > **Manage manually** > enable all 3 toggles

#### Motorola / Lenovo

Settings > Battery > Adaptive Battery > **OFF** (or exclude Termux)

### 4c. Lock Termux in Recents

Open the Android recent apps view, find Termux, and **lock it** (tap the lock
icon or long press > Lock). This prevents Android from killing it when clearing
recent apps.

### 4d. Disable Doze for Termux (via ADB, recommended)

If you have ADB access from a computer:

```bash
adb shell dumpsys deviceidle whitelist +com.termux
adb shell dumpsys deviceidle whitelist +com.termux.boot
```

This exempts Termux from Android's Doze mode entirely.

### 4e. Disable phantom process killing (Android 12+)

Android 12+ limits background processes to 32. If you hit this limit, Android
kills Termux silently. Disable it via ADB:

```bash
adb shell "settings put global settings_enable_monitor_phantom_procs false"
# Or on some devices:
adb shell "/system/bin/device_config set_sync_disabled_for_tests persistent"
adb shell "/system/bin/device_config put activity_manager max_phantom_processes 2147483647"
```

### 4f. Notifications channel

Make sure Termux notifications are set to **high priority** in Android settings.
If Android hides the wakelock notification, it may kill the process.

---

## 5. Run with Process Manager

Use `tmux` to keep the process running after closing the terminal, plus
independent restart loops for the bot and the tunnel:

```bash
pkg install tmux
```

Create a start script at `~/start-bot.sh`:

```bash
#!/data/data/com.termux/files/usr/bin/bash

# Acquire wake lock
termux-wake-lock

cd ~/sesamo/whatsapp-bot

NGROK_DOMAIN="sesamo-bot.ngrok-free.app"

tunnel_loop() {
    while true; do
        echo "[$(date)] Starting ngrok tunnel..."
        ngrok http 3000 --url="$NGROK_DOMAIN"
        EXIT_CODE=$?
        echo "[$(date)] ngrok exited ($EXIT_CODE). Restarting in 5s..."
        sleep 5
    done
}

# Start ngrok tunnel supervisor in the background
tunnel_loop &
TUNNEL_LOOP_PID=$!

cleanup() {
    kill $TUNNEL_LOOP_PID 2>/dev/null
    pkill -P $TUNNEL_LOOP_PID 2>/dev/null
    wait $TUNNEL_LOOP_PID 2>/dev/null
}

trap cleanup EXIT

while true; do
    echo "[$(date)] Starting Sésamo bot..."
    pnpm start
    EXIT_CODE=$?

    if [ $EXIT_CODE -eq 1 ]; then
        echo "[$(date)] Fatal error (exit 1). Waiting 30s before restart..."
        sleep 30
    else
        echo "[$(date)] Bot exited ($EXIT_CODE). Restarting in 5s..."
        sleep 5
    fi
done
```

Make it executable:

```bash
chmod +x ~/start-bot.sh
```

Run it inside tmux:

```bash
tmux new -s bot
~/start-bot.sh
```

Detach from tmux with `Ctrl+B` then `D`. The bot keeps running.

To reattach later:

```bash
tmux attach -t bot
```

---

## 6. Auto-Start on Boot

Termux:Boot runs scripts from `~/.termux/boot/` when the phone starts.

```bash
mkdir -p ~/.termux/boot
```

Create `~/.termux/boot/start-bot.sh`:

```bash
#!/data/data/com.termux/files/usr/bin/bash

termux-wake-lock

# Wait for network
sleep 10

# Start the bot + tunnel supervisor script in a tmux session
tmux new-session -d -s bot "bash ~/start-bot.sh"
```

Make it executable:

```bash
chmod +x ~/.termux/boot/start-bot.sh
```

**Important:** Open the Termux:Boot app at least once after installing so
Android registers it as a boot receiver.

---

## 7. Watchdog (extra safety)

Use `cronie` (cron) to check every 5 minutes if both the bot and ngrok are
still running:

```bash
sv-enable crond
crontab -e
```

Add this line:

```
*/5 * * * * pgrep -f "pnpm start" > /dev/null && pgrep -f "ngrok http 3000" > /dev/null || { tmux has-session -t bot 2>/dev/null && tmux kill-session -t bot; tmux new-session -d -s bot "bash ~/start-bot.sh"; }
```

This checks that both processes exist. If either one is missing, it restarts
the whole tmux session so both come back cleanly.

---

## 8. Physical Setup Tips

- **Keep the phone plugged in** at all times. Use a good charger (not a fast
  charger — slow charging generates less heat and is better for battery
  longevity).
- **Turn off the screen.** The wake lock keeps Termux alive even with the
  screen off. Set screen timeout to the minimum (15 seconds).
- **Connect via WiFi**, not mobile data. WiFi is more stable and uses less
  battery.
- **Disable unnecessary features:** Bluetooth, NFC, location, sync. The phone
  is a server now, not a phone.
- **Keep it cool.** Remove the case. Don't put it in direct sunlight. If
  possible, place it in a ventilated spot.
- **Set a static IP** on your router for the phone's MAC address, so SSH always
  works at the same address.

---

## 9. Monitoring from Your Computer

SSH in and check:

```bash
# Reattach to the bot session
tmux attach -t bot

# Check if bot is running
pgrep -f "pnpm start"

# Check logs (the bot logs to stdout inside tmux)
# Just attach to tmux to see them

# Check uptime
uptime

# Check disk space
df -h

# Check memory
free -m
```

---

## Summary Checklist

- [ ] Termux + Termux:Boot installed from F-Droid
- [ ] Node.js, pnpm, git, tmux, cronie installed in Termux
- [ ] Bot cloned, dependencies installed, `.env` configured with Cloud API credentials
- [ ] ngrok set up with a static dev domain pointing to `localhost:3000`
- [ ] Meta webhook configured (callback URL + verify token + messages subscription)
- [ ] `termux-wake-lock` acquired
- [ ] Termux excluded from battery optimization
- [ ] Termux locked in recents
- [ ] `~/start-bot.sh` created with restart loop + tunnel
- [ ] Bot running inside tmux session
- [ ] `~/.termux/boot/start-bot.sh` for auto-start on reboot
- [ ] Cron watchdog running every 5 minutes
- [ ] Phone plugged in, screen off, WiFi connected
