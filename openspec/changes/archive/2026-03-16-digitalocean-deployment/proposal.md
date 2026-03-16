## Why

The bot is currently deployed on an Android phone running Termux with ngrok tunneling, which has proven unreliable — Android's aggressive battery/process management, WiFi instability, and ngrok free-tier limitations make it unsuitable for a production WhatsApp bot that needs to be reachable 24/7. Moving to a DigitalOcean Droplet with Docker Compose provides a stable, always-on server with direct HTTPS (no tunnel needed) and automated deployments on push.

## What Changes

- **Containerize the bot** with a multi-stage Dockerfile (build TypeScript → run compiled JS) and Docker Compose orchestrating the bot + a Caddy reverse proxy for automatic HTTPS.
- **Add a proper TypeScript build step** — compile to JavaScript for production instead of running `ts-node` at runtime. Add `build` script and `outDir` config.
- **Add GitHub Actions CI/CD** — on push to `main`, SSH into the Droplet, pull latest code, and redeploy with `docker compose up --build -d`.
- **Remove ngrok dependency** — the Droplet has a public IP (and eventually a domain), so no tunnel is needed. Remove ngrok from the start script, codebase references, and deployment docs.
- **Replace deployment documentation** — replace the Termux/Android phone guide (`deploy.md`) with a DigitalOcean Droplet setup guide covering provisioning, Docker installation, firewall rules, environment setup, and the CI/CD pipeline.
- **BREAKING**: The `tunnel-supervision` spec becomes obsolete. Process supervision is handled by Docker's restart policies instead of bash loops and cron watchdogs.

## Capabilities

### New Capabilities
- `container-deployment`: Dockerfile, Docker Compose configuration, Caddy reverse proxy setup, and production build pipeline for running the bot on a DigitalOcean Droplet.
- `ci-cd-pipeline`: GitHub Actions workflow for automated deployment on push to `main` — SSH-based pull-and-rebuild strategy.

### Modified Capabilities
- `tunnel-supervision`: This capability is fully replaced by Docker's restart policies and Caddy's reverse proxy. The spec should be retired/archived since ngrok, bash supervisor loops, cron watchdogs, and Termux:Boot are no longer applicable.

## Impact

- **Code**: `whatsapp-bot/package.json` (add build script, start:prod script), `whatsapp-bot/tsconfig.json` (add outDir), new files in repo root (`Dockerfile`, `docker-compose.yml`, `Caddyfile`, `.dockerignore`, `.github/workflows/deploy.yml`).
- **Infrastructure**: Requires a DigitalOcean Droplet (~$6/mo), Docker + Docker Compose installed, SSH key for GitHub Actions, and eventually a domain name pointed at the Droplet's IP.
- **Dependencies**: No new runtime dependencies. Caddy runs as a separate Docker container. GitHub Actions is free for public repos.
- **Meta webhook**: The webhook URL in the Meta Developer Console must be updated from the ngrok URL to the Droplet's public URL.
- **Removed**: ngrok, Termux, Termux:Boot, cron watchdog, tmux supervisor scripts. The `tunnel-supervision` spec is retired.
