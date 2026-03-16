## 1. TypeScript Build Pipeline

- [x] 1.1 Add `tsc-alias` as a dev dependency in `whatsapp-bot/package.json`
- [x] 1.2 Update `tsconfig.json`: uncomment/set `rootDir: "./src"` and `outDir: "./dist"`
- [x] 1.3 Add `build` script to `package.json`: `tsc && tsc-alias`
- [x] 1.4 Add `start:prod` script to `package.json`: `node dist/index.js`
- [x] 1.5 Add `dist/` to `.gitignore`
- [x] 1.6 Verify `pnpm build && pnpm start:prod` runs successfully

## 2. Static File Path Adjustment

- [x] 2.1 Update `webhook.ts` serveStatic paths from `root: '..'` to `root: './static'` (or read from env-based path) so static files work both in dev (ts-node) and production (compiled JS in Docker)
- [x] 2.2 Verify `/menu`, `/privacidad`, `/menu.pdf`, `/privacidad.pdf` routes still work in dev mode

## 3. Docker Configuration

- [x] 3.1 Create `.dockerignore` in repo root (exclude node_modules, .env, .git, data/*.db, openspec, etc.)
- [x] 3.2 Create multi-stage `Dockerfile` in repo root: build stage compiles TS, prod stage runs compiled JS with node:20-slim
- [x] 3.3 Create `Caddyfile` in repo root: reverse proxy from port 80 to bot:3000, pre-configured for easy HTTPS upgrade
- [x] 3.4 Create `docker-compose.yml` in repo root: bot service + caddy service + bot_data volume + caddy_data/caddy_config volumes
- [x] 3.5 Verify `docker compose build` succeeds locally
- [x] 3.6 Verify `docker compose up -d` starts both services and the webhook is reachable at http://localhost/webhook

## 4. GitHub Actions CI/CD

- [x] 4.1 Create `.github/workflows/deploy.yml`: trigger on push to main, SSH into Droplet, git pull, docker compose up --build -d
- [x] 4.2 Document required GitHub secrets in the deploy guide: `DROPLET_IP`, `DROPLET_USER`, `SSH_PRIVATE_KEY`

## 5. Deployment Guide

- [x] 5.1 Replace `whatsapp-bot/deploy.md` with a comprehensive DigitalOcean deployment guide covering: Droplet creation, SSH setup, Docker installation, firewall (UFW), repo cloning, .env configuration, first deploy, domain + HTTPS upgrade, GitHub Actions secrets, Meta webhook URL update, and common troubleshooting

## 6. Cleanup

- [x] 6.1 Remove/archive ngrok references from codebase (deploy.md already replaced, check for any code references)
- [ ] 6.2 Verify the complete deployment flow: push → GitHub Actions → Droplet rebuild → bot accessible
