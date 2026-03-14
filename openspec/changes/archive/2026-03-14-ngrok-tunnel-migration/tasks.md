## 1. Update start-bot.sh with dual-process supervision

- [x] 1.1 Rewrite the `start-bot.sh` template in `deploy.md` to run the ngrok tunnel in a background `while true` restart loop (replacing the single `cloudflared tunnel run sesamo-bot &` invocation)
- [x] 1.2 Add EXIT trap that kills the background tunnel loop and its child ngrok process on script termination
- [x] 1.3 Keep the existing bot restart loop (foreground) with the fatal-exit 30s delay logic

## 2. Replace Cloudflare Tunnel section in deploy.md with ngrok

- [x] 2.1 Replace the "Set up Cloudflare Tunnel" section (Options A/B, cloudflared install, tunnel create, config.yml) with ngrok setup: download ARM64 binary, configure authtoken, claim static dev domain
- [x] 2.2 Update the "Verify the tunnel works" subsection to use `ngrok http 3000 --url=<domain>`
- [x] 2.3 Update the boot script (`~/.termux/boot/start-bot.sh`) -- no structural changes needed, it already calls `~/start-bot.sh`

## 3. Update watchdog cron

- [x] 3.1 Update the cron watchdog line in `deploy.md` to check for both `pnpm start` AND `ngrok` processes (restart if either is missing)

## 4. Update meta-setup.md

- [x] 4.1 Replace the trycloudflare quick tunnel instructions with ngrok setup for testing (download, authtoken, run)
- [x] 4.2 Update the webhook callback URL example to use the permanent ngrok static domain instead of `random-words-here.trycloudflare.com`

## 5. Clean up cloudflared references

- [x] 5.1 Remove the comment in `webhook.ts` referencing Cloudflare tunnel (line 9: `// Static pages — menu & privacy policy (served via Cloudflare tunnel)`) -- update to be tunnel-agnostic
- [x] 5.2 Update the risk assessment in the archived design doc reference if any non-archived docs point to it (verify no stale cross-references)
