## Why

The bot uses a trycloudflare quick tunnel which assigns a random URL on every restart and has no persistent identity. When the WiFi drops (happens ~daily), the tunnel's control stream dies and enters a failing retry loop. Even if it reconnects, Meta's webhook callback URL is stale because trycloudflare URLs are ephemeral. A Cloudflare named tunnel would fix the URL problem but requires a domain with Cloudflare-managed nameservers (not free). ngrok's free tier provides a static dev domain with no domain purchase, solving both the URL stability and reconnection problems.

## What Changes

- Replace `cloudflared` with `ngrok` as the tunnel provider in the deployment setup
- Update `start-bot.sh` to supervise both the bot process and the tunnel process independently (currently only the bot gets restarted if it crashes; the tunnel runs once in the background with no supervision)
- Update `deploy.md` with ngrok installation, authtoken setup, and static domain configuration for Termux on Android
- Update `meta-setup.md` with the permanent ngrok webhook URL (set once, never changes)
- Remove cloudflared references from deployment documentation

## Capabilities

### New Capabilities

- `tunnel-supervision`: Independent restart loops for both the tunnel and bot processes, so a tunnel crash doesn't leave the bot unreachable and vice versa

### Modified Capabilities

_(none -- this change is entirely infrastructure/deployment; no application code or spec-level behavior changes)_

## Impact

- **Deployment scripts**: `start-bot.sh` and boot script need restructuring for dual-process supervision
- **Documentation**: `deploy.md` (major rewrite of tunnel sections), `meta-setup.md` (webhook URL instructions)
- **Dependencies**: Remove `cloudflared` binary from the phone, install `ngrok` ARM64 binary
- **Meta webhook config**: One-time URL update in the Meta developer dashboard to the permanent ngrok domain
- **No application code changes**: `webhook.ts`, `api.ts`, `index.ts`, and all handler code remain untouched -- the bot still listens on localhost:3000
