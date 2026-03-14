## Context

The Sesamo WhatsApp bot runs on an Android phone via Termux. It needs a public HTTPS URL for Meta's webhook to deliver messages. Currently, the bot uses a trycloudflare quick tunnel which:

- Assigns a random URL on every restart (Meta's webhook goes stale)
- Has no persistent identity or credentials (can't gracefully reconnect)
- Enters a failing retry loop when WiFi drops (~daily occurrence)

The deployment uses a `start-bot.sh` script that runs `cloudflared` once in the background and only supervises the bot process in a restart loop. If the tunnel process dies, the bot keeps running but is unreachable.

Named Cloudflare tunnels would fix the URL issue but require a domain with Cloudflare-managed nameservers (paid). ngrok's free tier provides a permanent static dev domain with no domain purchase.

## Goals / Non-Goals

**Goals:**

- Replace trycloudflare with ngrok using a static dev domain (set once, permanent)
- Supervise both the tunnel and bot processes independently so either can crash and recover
- Update deployment docs to reflect the new setup
- Ensure the system recovers automatically from daily WiFi drops

**Non-Goals:**

- Application code changes (the bot still listens on localhost:3000, nothing changes in webhook.ts/api.ts/handlers)
- Health-check endpoints or monitoring dashboards
- ngrok paid features (IP restrictions, custom domains, observability)
- Automating the Meta webhook URL update (one-time manual step in the Meta developer dashboard)

## Decisions

### Decision 1: Use ngrok with a free static dev domain

**Choice**: ngrok free tier with a claimed dev domain (e.g., `sesamo-bot.ngrok-free.app`)

**Alternatives considered**:
- **trycloudflare quick tunnel** (current): Random URL per restart, no reconnection identity. Broken.
- **Cloudflare named tunnel**: Requires a domain with Cloudflare-managed nameservers. Not free.
- **localtunnel, bore, etc.**: Less mature, no static URL guarantees on free tiers.

**Rationale**: ngrok free tier provides exactly one static domain per account, has a well-maintained ARM64 binary, built-in reconnection with exponential backoff, and simple one-line invocation. The static domain means Meta's webhook URL is configured once and never changes.

### Decision 2: Dual restart-loop supervision in start-bot.sh

**Choice**: Run the tunnel in a `while true` restart loop in the background, and the bot in a `while true` restart loop in the foreground. Both loops trap EXIT to clean up.

**Alternatives considered**:
- **Single process (current)**: Tunnel runs once in background with no restart. If it dies, bot is unreachable.
- **systemd/supervisord**: Not available in Termux without root.
- **Separate tmux panes**: More complex, harder to coordinate cleanup, no benefit over a single script.

**Rationale**: Termux has limited process management. A bash script with two restart loops is the simplest approach that gives independent recovery for both processes. The tunnel loop handles ngrok crashes (Android OOM kills, tunnel failures), while the bot loop handles application crashes. The structure mirrors what's already working for the bot -- we just extend the same pattern to the tunnel.

### Decision 3: ngrok config via CLI flags, not config file

**Choice**: Run ngrok with inline flags: `ngrok http 3000 --url=<domain>`

**Alternatives considered**:
- **ngrok.yml config file**: More powerful (traffic policies, multiple tunnels), but unnecessary for a single HTTP tunnel.

**Rationale**: One tunnel, one service, one line. A config file adds a maintenance surface for zero benefit. If needs grow later, migrating to a config file is trivial.

### Decision 4: Update watchdog cron to check both processes

**Choice**: Extend the existing cron watchdog to check for both `pnpm start` and `ngrok` processes.

**Rationale**: The cron is a safety net for when the entire tmux session dies (phone reboot without Termux:Boot firing, tmux crash). It should verify both the bot and the tunnel are alive.

## Risks / Trade-offs

- **[ngrok free tier rate limits]** → ngrok free tier has request limits. The bot handles a small restaurant near Neusa with low traffic. Well within limits. If limits become an issue, the $8/month basic plan removes them.

- **[ngrok interstitial page]** → Free tier shows a browser warning page on HTTP requests. This does NOT affect API webhook calls (Meta sends JSON POST requests, not browser requests). However, the static menu and privacy policy pages served at `/menu` and `/privacy` through the tunnel will show the interstitial to browser visitors. Mitigation: These pages are rarely visited directly; acceptable trade-off.

- **[ngrok account dependency]** → The static domain is tied to an ngrok account. If the account is deleted or suspended, the URL changes. Mitigation: Use a dedicated email for the ngrok account. Keep the authtoken stored safely on the phone.

- **[Tunnel process restart race]** → When the tunnel restarts, there's a brief window (a few seconds) where the bot is running but unreachable. Mitigation: Meta retries webhook deliveries for up to 7 days. A few seconds of downtime won't lose messages.

## Migration Plan

1. Create an ngrok account and claim a free static dev domain
2. Download and install ngrok ARM64 binary on the phone
3. Configure authtoken on the phone
4. Test ngrok tunnel manually: `ngrok http 3000 --url=<domain>` and verify bot is reachable
5. Update Meta webhook URL in the developer dashboard to the ngrok domain
6. Replace `start-bot.sh` with the dual-loop version
7. Update the cron watchdog to check for ngrok
8. Remove cloudflared binary from the phone
9. Update `deploy.md` and `meta-setup.md`

**Rollback**: If ngrok doesn't work on the phone, revert to trycloudflare quick tunnel (accept the URL instability) and revisit. Old deploy.md is in git history.

## Open Questions

- **ngrok ARM64 on this specific Android device**: Need to verify the binary runs correctly in Termux. Should work (ngrok officially supports linux-arm64), but worth testing before committing to the migration.
