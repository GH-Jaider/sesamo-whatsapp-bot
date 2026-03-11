## Why

Baileys (unofficial WhatsApp Web reverse-engineering library) has proven unreliable for production: silent message drops due to `msmsg` encryption filtering, LID-based JID routing issues, 479 errors on interactive messages via `relayMessage`, and session decryption errors ("Bad MAC") after any workaround. Each WhatsApp server-side change risks breaking the bot with zero notice. The official WhatsApp Cloud API provides a stable, supported transport with native interactive message support (lists, buttons), media download via URL, and no QR-code session management.

## What Changes

- **BREAKING**: Replace Baileys WebSocket transport with an HTTP webhook server (Express or Hono) that receives WhatsApp Cloud API webhook events, plus a REST client that calls the Meta Graph API to send messages.
- **BREAKING**: Remove QR-code pairing flow — Cloud API uses a permanent system user access token instead of Baileys session files.
- **BREAKING**: Remove `data/auth_info_baileys/` directory and Baileys patch. The `@whiskeysockets/baileys`, `@hapi/boom`, `qrcode-terminal` dependencies are removed.
- Add new dependencies: HTTP framework (Express or Hono), and optionally `axios` or native `fetch` for Graph API calls.
- Add webhook verification endpoint (`GET /webhook`) for Meta's hub challenge handshake.
- Add webhook event handler (`POST /webhook`) that extracts sender phone, message text, interactive replies, and image media from Cloud API payloads.
- Refactor `handlers/index.ts` to accept a transport-agnostic interface instead of `WASocket` + `WAMessage` — handler functions receive `(phone, text, mediaUrl?)` and call send functions that abstract the transport.
- Add new env vars: `WA_PHONE_NUMBER_ID`, `WA_ACCESS_TOKEN`, `WA_VERIFY_TOKEN`, `WA_APP_SECRET`.
- Media (voucher images) downloaded via Graph API URL + access token instead of Baileys' `downloadMediaMessage`.
- Interactive messages (list, buttons) sent as native Cloud API interactive message objects — no more proto hacking or `relayMessage` workarounds.
- Entry point (`src/index.ts`) changes from "init DB then connect to WA" to "init DB then start HTTP server".

## Capabilities

### New Capabilities
- `cloud-api-transport`: HTTP webhook server for receiving messages and REST client for sending messages/media via WhatsApp Cloud API. Covers webhook verification, message parsing, send functions (text, interactive list, interactive buttons, image), media download, and signature validation.

### Modified Capabilities
- `conversation-ux`: Interactive list and button messages change from Baileys proto objects to Cloud API interactive message format. The spec requirement for "Baileys interactive list messages" must be updated to reference Cloud API interactive messages instead.

## Impact

- **Code**: `src/whatsapp/connection.ts` and `src/whatsapp/utils.ts` are replaced entirely. `src/handlers/index.ts` is refactored to remove `WASocket`/`WAMessage` parameters. `src/index.ts` entry point changes. `src/types/index.ts` gains transport-related types.
- **Dependencies**: Remove `@whiskeysockets/baileys`, `@hapi/boom`, `qrcode-terminal`, `@types/qrcode-terminal`, `@types/hapi__boom`. Add HTTP framework + types. Remove `patches/` directory and `pnpm.patchedDependencies` config.
- **Infrastructure**: Requires a publicly accessible URL for webhook (Cloudflare Tunnel or ngrok on Termux). The bot becomes an HTTP server on `PORT` (env var, already exists).
- **Env vars**: New `WA_PHONE_NUMBER_ID`, `WA_ACCESS_TOKEN`, `WA_VERIFY_TOKEN`, `WA_APP_SECRET`. Existing `ADMIN_PHONE`, `NEQUI_NUMBER`, `LOG_LEVEL`, `PORT`, `NODE_ENV` remain.
- **Data**: `data/auth_info_baileys/` is no longer needed. `data/sesamo.db` and `data/downloads/` remain unchanged.
- **Deployment**: `deploy.md` needs updating for the new startup flow (HTTP server instead of QR scan). Cloudflare Tunnel setup instructions added.
