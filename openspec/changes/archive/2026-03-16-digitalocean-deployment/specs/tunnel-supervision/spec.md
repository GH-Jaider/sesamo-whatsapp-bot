## REMOVED Requirements

### Requirement: Tunnel process restart on crash
**Reason**: ngrok tunneling is no longer needed. The bot runs on a DigitalOcean Droplet with a public IP address, and Caddy handles reverse proxying with automatic HTTPS. Docker's `restart: unless-stopped` policy replaces the bash supervisor loop.
**Migration**: Remove ngrok from the deployment. Use Docker restart policies for process supervision.

### Requirement: Bot process restart on crash
**Reason**: Docker's `restart: unless-stopped` policy handles automatic restart on crash. No need for bash while-true loops or delay logic.
**Migration**: Docker Compose restart policy replaces the bash supervisor loop.

### Requirement: Independent process supervision
**Reason**: Docker Compose manages each service independently. If the bot container crashes, Caddy keeps running and vice versa — this is inherent to Docker Compose's architecture.
**Migration**: Docker Compose service separation replaces the bash background/foreground process model.

### Requirement: Clean shutdown on script exit
**Reason**: Docker handles clean shutdown via SIGTERM signals to containers on `docker compose down`. No bash trap needed.
**Migration**: Docker stop/restart commands replace manual signal handling.

### Requirement: Watchdog cron checks both processes
**Reason**: Docker's restart policies provide automatic recovery. No external cron watchdog is needed.
**Migration**: Remove the cron job entirely. Docker's restart policy handles recovery.

### Requirement: Static tunnel URL via ngrok dev domain
**Reason**: The Droplet has a static public IP. When a domain is configured, the URL is permanent by nature. No tunnel or ngrok static domain needed.
**Migration**: Update the Meta webhook URL to point to `http://DROPLET_IP/webhook` (or `https://domain.com/webhook` when a domain is added).
