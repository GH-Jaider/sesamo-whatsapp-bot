## ADDED Requirements

### Requirement: Tunnel process restart on crash
The start script SHALL run the ngrok tunnel process inside a `while true` loop so that if ngrok exits for any reason (process killed, connection failure, OOM), it is restarted automatically after a brief delay.

#### Scenario: ngrok process crashes
- **WHEN** the ngrok process exits unexpectedly
- **THEN** the supervisor loop waits 5 seconds and starts a new ngrok process with the same static domain URL

#### Scenario: ngrok recovers after internet restoration
- **WHEN** WiFi drops and then reconnects, and ngrok has exited during the outage
- **THEN** the supervisor loop restarts ngrok, which reconnects using the same static domain, and Meta webhook deliveries resume without any URL change

### Requirement: Bot process restart on crash
The start script SHALL run the bot process (`pnpm start`) inside a `while true` loop so that if the bot exits, it is restarted automatically. A fatal exit (exit code 1) SHALL trigger a longer delay (30 seconds) before restart; other exit codes SHALL trigger a shorter delay (5 seconds).

#### Scenario: Bot exits with fatal error
- **WHEN** `pnpm start` exits with code 1
- **THEN** the supervisor logs the fatal exit and waits 30 seconds before restarting

#### Scenario: Bot exits with non-fatal code
- **WHEN** `pnpm start` exits with any code other than 1
- **THEN** the supervisor waits 5 seconds before restarting

### Requirement: Independent process supervision
The tunnel and bot processes SHALL be supervised independently. A crash in one process SHALL NOT affect the other. The start script SHALL run the tunnel supervisor loop in the background and the bot supervisor loop in the foreground.

#### Scenario: Tunnel crashes while bot is healthy
- **WHEN** the ngrok process dies but `pnpm start` is still running
- **THEN** the tunnel supervisor restarts ngrok while the bot continues serving requests on localhost:3000

#### Scenario: Bot crashes while tunnel is healthy
- **WHEN** `pnpm start` exits but ngrok is still running
- **THEN** the bot supervisor restarts the bot while ngrok keeps the tunnel open

### Requirement: Clean shutdown on script exit
The start script SHALL trap the EXIT signal and kill the background tunnel supervisor loop and its child ngrok process when the script exits (e.g., when the user stops the script with Ctrl+C or the tmux session is destroyed).

#### Scenario: User stops the start script
- **WHEN** the user sends SIGINT (Ctrl+C) to the start script
- **THEN** the script kills the background tunnel loop and the running ngrok process, then exits cleanly

### Requirement: Watchdog cron checks both processes
The cron watchdog SHALL verify that both the bot process and the ngrok tunnel process are running. If either is missing, it SHALL restart the entire start script in a new tmux session.

#### Scenario: Bot process is running but tunnel is not
- **WHEN** the cron job runs and detects `pnpm start` is alive but no `ngrok` process exists
- **THEN** the cron job restarts the full start script in a tmux session (which starts both processes)

#### Scenario: Neither process is running
- **WHEN** the cron job runs and neither `pnpm start` nor `ngrok` is found
- **THEN** the cron job starts a new tmux session running the start script

### Requirement: Static tunnel URL via ngrok dev domain
The tunnel SHALL use an ngrok static dev domain so that the public URL remains the same across restarts, reboots, and internet reconnections. The URL SHALL be passed to ngrok via the `--url` flag.

#### Scenario: Tunnel restart preserves URL
- **WHEN** the ngrok process is restarted (by the supervisor loop or manually)
- **THEN** it connects using the same static dev domain URL, and Meta's configured webhook URL remains valid

#### Scenario: Phone reboot preserves URL
- **WHEN** the phone reboots, Termux:Boot starts the script, and ngrok starts
- **THEN** the tunnel uses the same static dev domain as before the reboot
