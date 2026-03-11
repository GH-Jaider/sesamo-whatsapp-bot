## Context

The Finca Sesamo WhatsApp order-taking bot currently uses Baileys (unofficial WhatsApp Web reverse-engineering library) as its transport layer. Baileys connects via WebSocket to WhatsApp's Web infrastructure, manages a QR-code-linked session stored in `data/auth_info_baileys/`, and provides `WASocket` methods for sending/receiving messages.

This has proven unreliable in production: silent message drops (`msmsg` encryption filtering), LID JID routing confusion, 479 errors on interactive messages via `relayMessage`, and session corruption ("Bad MAC") from workarounds. Each WhatsApp server-side change can silently break the bot.

The bot runs on an old Android phone via Termux. Key constraints:
- No native module compilation (no NDK) — already using `sql.js` instead of `better-sqlite3`
- `ts-node` binary gets permission denied — using `node -r ts-node/register` instead
- Needs a publicly accessible URL for Cloud API webhooks
- The entire codebase is ~1,500 lines of TypeScript across 8 source files

The user already has a Meta Business Account with WhatsApp Cloud API access configured.

## Goals / Non-Goals

**Goals:**
- Replace Baileys with WhatsApp Cloud API as the message transport
- Maintain 100% of existing business logic (state machine, cart, orders, admin commands)
- Use Cloud API native interactive messages (lists, buttons) — eliminating all proto hacking
- Keep the codebase simple and small (no heavyweight frameworks)
- Minimize changes to files that don't touch the transport layer
- Make handlers transport-agnostic so they could theoretically work with any messaging backend

**Non-Goals:**
- Multi-channel support (Telegram, SMS, etc.) — not architecting for it, just decoupling enough to not import Baileys types in handlers
- Webhook signature validation in v1 — will add `WA_APP_SECRET` env var but may defer HMAC validation to a fast-follow
- Message queue or retry logic — Cloud API handles delivery; we trust 200 OK from the Graph API
- Read receipts or typing indicators — not needed for a restaurant order bot
- Migrating to a different database or ORM — `sql.js` stays as-is
- Changing the state machine, cart logic, or message templates

## Decisions

### Decision 1: Hono over Express for HTTP framework

**Choice**: Hono

**Rationale**: Hono is ~14KB, has zero native dependencies (critical for Termux), ships with TypeScript types, and supports the same routing patterns as Express. Express pulls in many sub-dependencies and is heavier than needed for 2 routes. Hono also works well with `node -r ts-node/register` since it's pure JS/TS.

**Alternatives considered**:
- **Express**: More ecosystem familiarity but heavier dependency tree, no built-in TS types
- **Fastify**: Good performance but heavier than needed for 2 endpoints
- **Raw `node:http`**: No dependencies but manual routing/body parsing is error-prone

### Decision 2: Native `fetch` over axios for Graph API calls

**Choice**: Node.js built-in `fetch` (available since Node 18)

**Rationale**: Zero additional dependencies. The Graph API calls are simple JSON POST/GET requests. No need for interceptors, retry logic, or request/response transforms that axios provides.

**Alternatives considered**:
- **axios**: Popular but adds a dependency for no real benefit here
- **undici**: Already bundled with Node but `fetch` is its public API anyway

### Decision 3: Transport abstraction via interface, not dependency injection

**Choice**: Define a `MessageSender` interface with methods like `sendText`, `sendList`, `sendButtons`, `sendImage`. The Cloud API module exports an implementation. Handlers import and call it directly.

**Rationale**: Full DI (constructor injection, factories) is overengineered for 8 source files. A simple interface that the Cloud API module satisfies is enough to remove Baileys types from handlers. The handler signature changes from `(sock: WASocket, jid: string, ...)` to `(phone: string, ...)` with send functions imported from the transport module.

**Alternatives considered**:
- **Pass `sock` equivalent through all handlers**: What we have now — couples handlers to transport
- **Event emitter pattern**: Handlers emit events, transport listens — indirection without benefit at this scale
- **Full DI container**: Way too heavy for this project

### Decision 4: Webhook incoming message structure

**Choice**: Parse the Cloud API webhook payload in the webhook handler, extract `(phone, text, interactiveReplyId, imageMediaId)`, and pass these primitives to the existing handler function.

**Rationale**: The handler currently receives `(sock, WAMessage)` and extracts text from various message sub-types (conversation, extendedTextMessage, buttonsResponseMessage, listResponseMessage, imageMessage). The Cloud API payload has a different shape but carries the same information. Parsing it at the webhook boundary keeps handlers clean.

The Cloud API message types map to:
- `message.text.body` → plain text
- `message.interactive.list_reply.id` → list selection (rowId)
- `message.interactive.button_reply.id` → button selection (buttonId)
- `message.image.id` → image media (need separate download call)

### Decision 5: Media download via Graph API URL

**Choice**: When an image message arrives, call `GET https://graph.facebook.com/v21.0/{media_id}` to get the download URL, then fetch the binary content and save it. This replaces Baileys' `downloadMediaMessage`.

**Rationale**: Cloud API requires a two-step process (get URL, then download). The URL is temporary (valid for a few minutes) so download must happen immediately, same as current behavior.

### Decision 6: File structure — replace `whatsapp/` directory contents

**Choice**:
- Delete `src/whatsapp/connection.ts` and `src/whatsapp/utils.ts`
- Create `src/whatsapp/webhook.ts` — Hono app with GET/POST `/webhook` routes
- Create `src/whatsapp/api.ts` — Graph API client (sendText, sendList, sendButtons, sendImage, downloadMedia)
- Create `src/whatsapp/types.ts` — Cloud API webhook payload types and MessageSender interface
- Update `src/index.ts` to start Hono server instead of calling `connectToWhatsApp()`

**Rationale**: Keeps the same `src/whatsapp/` directory convention. Two new files match the two concerns (inbound webhook vs outbound API). Types get their own file because Cloud API payloads are verbose.

## Risks / Trade-offs

- **[Public URL requirement]** → The bot needs a publicly accessible HTTPS URL for Meta's webhook. Mitigation: Use Cloudflare Tunnel (`cloudflared`) which runs in Termux, is a single static binary, and provides a stable subdomain with `cloudflared tunnel`. Alternative: ngrok, but it reassigns URLs on free tier.

- **[Access token expiry]** → System user tokens from Meta Business Manager are long-lived (60 days) but not permanent. Mitigation: Document token refresh process in deploy.md. A "permanent" system user token can be generated via Business Manager settings — this is the recommended approach.

- **[Webhook delivery failures]** → If the bot's HTTP server is down, Meta retries for up to 7 days but may eventually drop messages. Mitigation: Termux service manager + process monitor (already in deploy.md). The bot should start fast (< 2 seconds).

- **[Interactive message limits]** → Cloud API lists support max 10 rows per section and 10 sections. Our largest category (Truchas) has 9 items, so we're within limits. Buttons max 3, which matches our current usage.

- **[Rate limits]** → Cloud API free tier: 1000 service conversations/month, 250 API calls/hour. A finca restaurant near Neusa won't hit these.

- **[Handler refactor scope]** → `handlers/index.ts` is 846 lines with `WASocket` threaded through every function. The refactor touches every function signature but NOT the business logic inside. Risk of typos/missed spots. Mitigation: TypeScript compiler will catch any remaining `WASocket` references after removing the import.

## Migration Plan

1. **Add new dependencies**: `hono`, `@hono/node-server`. Remove: `@whiskeysockets/baileys`, `@hapi/boom`, `qrcode-terminal` and their `@types`.
2. **Create transport layer**: `webhook.ts`, `api.ts`, `types.ts` in `src/whatsapp/`.
3. **Refactor handlers**: Remove `WASocket`/`WAMessage` params, use new send functions.
4. **Update entry point**: `src/index.ts` starts Hono server.
5. **Update `.env.template`** with new vars, update `deploy.md`.
6. **Delete old files**: `connection.ts`, `utils.ts`, `patches/` dir, remove `patchedDependencies` from `package.json`.
7. **Test locally**: Configure webhook URL via Cloudflare Tunnel, verify send/receive cycle.
8. **Rollback**: Old Baileys code is in git history. If Cloud API fails, revert commit and restore `auth_info_baileys/`.

## Open Questions

- **Hono vs Express**: Decision above favors Hono for zero native deps and small size. Confirm this is acceptable for the Termux environment (it should be, since it's pure JS).
- **Cloudflare Tunnel setup**: Need to verify `cloudflared` ARM binary works on this specific Android device. Alternative is ngrok.
