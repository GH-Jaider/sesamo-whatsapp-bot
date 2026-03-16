## ADDED Requirements

### Requirement: Multi-stage Docker image builds compiled JavaScript
The Dockerfile SHALL use a multi-stage build: stage 1 installs dependencies and compiles TypeScript to JavaScript using `tsc` + `tsc-alias`; stage 2 copies only the compiled output, production dependencies, and static assets into a slim `node:20-slim` image.

#### Scenario: Docker image builds successfully
- **WHEN** `docker build` is run from the repository root
- **THEN** the resulting image contains compiled JavaScript in `/app/dist/`, production `node_modules/`, static files in `/app/static/`, and the `data/` directory, with a total image size under 200MB

#### Scenario: Image runs without ts-node or TypeScript
- **WHEN** the production container starts
- **THEN** the entrypoint executes `node dist/index.js` (not ts-node) and the TypeScript compiler is NOT present in the image

### Requirement: Docker Compose orchestrates bot and reverse proxy
Docker Compose SHALL define two services: `bot` (the application) and `caddy` (reverse proxy). The bot service SHALL expose port 3000 internally. The caddy service SHALL expose ports 80 and 443 publicly and proxy requests to the bot.

#### Scenario: Services start together
- **WHEN** `docker compose up -d` is run
- **THEN** both the bot and caddy containers start, and caddy proxies HTTP requests on port 80 to the bot on port 3000

#### Scenario: Bot restarts on crash
- **WHEN** the bot process exits unexpectedly
- **THEN** Docker restarts the container automatically (restart policy: `unless-stopped`)

### Requirement: Caddy provides automatic HTTPS when domain is configured
The Caddyfile SHALL be configured so that when the address is changed from `http://:80` to a domain name, Caddy automatically obtains and renews a Let's Encrypt TLS certificate.

#### Scenario: HTTP-only mode with IP address
- **WHEN** the Caddyfile address is `http://:80` (no domain)
- **THEN** Caddy serves HTTP traffic on port 80 without attempting TLS certificate issuance

#### Scenario: HTTPS mode with domain name
- **WHEN** the Caddyfile address is changed to `bot.example.com`
- **THEN** Caddy automatically obtains a Let's Encrypt certificate, redirects HTTP to HTTPS, and serves traffic on port 443

### Requirement: SQLite database persists across container rebuilds
A Docker named volume SHALL be mounted at `/app/data` so that the SQLite database file survives container rebuilds and redeployments.

#### Scenario: Database survives redeployment
- **WHEN** `docker compose up --build -d` is run to deploy a new version
- **THEN** the existing `sesamo.db` file in the `bot_data` volume is preserved and the bot loads the existing database on startup

#### Scenario: Fresh deployment seeds the database
- **WHEN** the bot starts and no `sesamo.db` file exists in the volume
- **THEN** the bot creates a new database and seeds it with the default menu, categories, and options

### Requirement: Static files served from container
The Docker image SHALL include the static HTML and PDF files (menu, privacy policy) at `/app/static/`. The Hono app SHALL serve these files from the `static/` path relative to the working directory.

#### Scenario: Menu page is accessible
- **WHEN** a GET request is made to `/menu`
- **THEN** the server responds with the `sesamo-menu.html` file

#### Scenario: Privacy policy PDF is accessible
- **WHEN** a GET request is made to `/privacidad.pdf`
- **THEN** the server responds with the `politica-privacidad.pdf` file

### Requirement: TypeScript project compiles to JavaScript with resolved path aliases
The `package.json` SHALL include a `build` script that runs `tsc` followed by `tsc-alias` to compile TypeScript and resolve `@/*` path aliases to relative imports. The `tsconfig.json` SHALL set `rootDir` to `./src` and `outDir` to `./dist`.

#### Scenario: Build produces runnable output
- **WHEN** `pnpm build` is run in the `whatsapp-bot/` directory
- **THEN** compiled JavaScript files are produced in `dist/` with all `@/*` imports rewritten to relative paths, and `node dist/index.js` starts the server successfully
