## Context

The Sésamo WhatsApp bot is a single Node.js/TypeScript process that serves a WhatsApp Cloud API webhook, an SQLite database (sql.js, in-memory with file persistence at `data/sesamo.db`), and static HTML pages (menu, privacy policy). It is currently deployed on an Android phone running Termux with ngrok tunneling, which has proven unreliable.

The app uses `ts-node` to run TypeScript directly in production, path aliases (`@/*` → `src/*`) via `tsconfig-paths`, and serves static files from the parent directory (`root: '..'` relative to `whatsapp-bot/`). The database resolves via `process.cwd()` + `data/`.

The target is a DigitalOcean Droplet ($6/mo, 1 vCPU, 1GB RAM, Ubuntu 24.04) with Docker Compose, a Caddy reverse proxy for automatic HTTPS, and GitHub Actions CI/CD for auto-deploy on push.

## Goals / Non-Goals

**Goals:**
- Containerize the bot in a Docker image that compiles TypeScript to JavaScript (no ts-node in production)
- Use Docker Compose to run the bot + Caddy reverse proxy as a single deployment unit
- Automatic HTTPS via Caddy + Let's Encrypt when a domain is configured
- GitHub Actions CI/CD: push to `main` triggers automatic deployment
- Persist SQLite data across container rebuilds via Docker volumes
- Serve static HTML/PDF files (menu, privacy policy) from inside the container
- Provide a detailed step-by-step deployment guide

**Non-Goals:**
- Database migration to PostgreSQL — SQLite is sufficient
- Database backup strategy — data persistence is not critical
- Custom domain setup — will use Droplet IP initially, domain can be added later
- Monitoring/alerting — out of scope for now
- Multi-environment (staging/prod) — single production environment
- Container registry — build on-server, no GHCR/DockerHub push

## Decisions

### D1: Multi-stage Dockerfile with compiled TypeScript

**Decision**: Use a multi-stage Docker build: stage 1 compiles TypeScript to JavaScript, stage 2 runs the compiled output with `node`.

**Rationale**: Running `ts-node` in production wastes ~100MB of RAM on the TypeScript compiler and adds 3-5 seconds to startup. Compiling at build time produces a slim image (~150MB vs ~400MB) and faster cold starts.

**Alternative considered**: Keep ts-node in production. Rejected because the Droplet has only 1GB RAM and ts-node adds unnecessary overhead.

### D2: Path alias resolution in compiled output

**Decision**: Use `tsc-alias` (post-build) to rewrite `@/*` path aliases to relative paths in the compiled JavaScript output.

**Rationale**: TypeScript's `tsc` does not rewrite path aliases in emitted JavaScript. The `@/*` → `src/*` aliases that work via `tsconfig-paths` at runtime with ts-node will break in compiled output. `tsc-alias` is a simple post-build step that rewrites these to relative paths. Alternative: `module-alias` (runtime patching) — rejected because build-time resolution is cleaner and has no runtime cost.

### D3: Caddy as reverse proxy (not nginx/Traefik)

**Decision**: Use Caddy 2 as the reverse proxy.

**Rationale**: Caddy provides automatic HTTPS via Let's Encrypt with zero configuration — just point a domain at the server and Caddy handles certificate issuance, renewal, and OCSP stapling. The entire config is 3 lines. Nginx requires manual certbot setup and renewal cron jobs. Traefik is overkill for a single service.

**Alternative considered**: Nginx + certbot — more common, but requires manual cert management. Not worth the complexity for one service.

### D4: SSH-based deployment (not container registry)

**Decision**: GitHub Actions SSHs into the Droplet, runs `git pull` + `docker compose up --build -d`.

**Rationale**: For a single-server deployment, building the image on-server is simpler than pushing to a registry (GHCR/DockerHub) and pulling. Build time on a 1 vCPU droplet is ~30 seconds for this small app. No registry credentials to manage, no image storage costs.

**Alternative considered**: Build in CI, push to GHCR, pull on server. Better for multi-server deployments but unnecessary overhead for a single Droplet.

### D5: Docker working directory structure

**Decision**: Set the Docker WORKDIR to `/app` (the `whatsapp-bot/` contents). Copy static files (HTML, PDF, logo) into `/app/static/` in the container. Adjust the Hono serveStatic paths to reference `./static/` instead of `..`.

**Rationale**: The current setup serves static files from the parent directory (`root: '..'`) which only works because the process runs from `whatsapp-bot/`. In Docker, it's cleaner to copy static files into a known location inside the app directory. This also avoids exposing the entire repo root inside the container.

### D6: SQLite persistence via Docker named volume

**Decision**: Mount a Docker named volume at `/app/data` to persist the SQLite database file.

**Rationale**: Named volumes survive `docker compose down` and `docker compose up --build`. The database is re-seeded on first run if no file exists, so losing the volume just means resetting to the default menu. Bind mounts are an alternative but named volumes are more portable and don't depend on host directory permissions.

### D7: HTTP-only initially, easy HTTPS upgrade path

**Decision**: Start with HTTP on the Droplet IP. The Caddyfile will be pre-configured so adding a domain later is a one-line change.

**Rationale**: Automatic HTTPS requires a domain name (Let's Encrypt doesn't issue certificates for bare IPs). The Meta webhook works over HTTP during development. When a domain is ready, changing `http://:80` to `yourdomain.com` in the Caddyfile auto-enables HTTPS.

## Risks / Trade-offs

- **[Single point of failure]** → The Droplet is a single server. If it goes down, the bot goes down. Mitigation: Docker restart policies (`restart: unless-stopped`) handle process crashes. DigitalOcean has 99.99% uptime SLA. For a family restaurant bot, this is acceptable.

- **[Build on server uses Droplet resources]** → Building the Docker image consumes CPU/RAM on the same server running the bot. Mitigation: Build takes ~30s and the bot continues running in the old container until the new one is ready. Docker Compose handles zero-downtime restarts for single containers.

- **[SQLite data loss on volume deletion]** → If the Docker volume is accidentally removed, all order history and menu customizations are lost. Mitigation: The database is seeded with defaults on first run, so the bot recovers automatically. The user has stated data persistence is not critical.

- **[Meta webhook URL change required]** → Moving from ngrok to the Droplet IP means the Meta webhook URL must be updated manually. Mitigation: This is a one-time manual step documented in the deployment guide.
