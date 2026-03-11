## 1. Dependencies & Configuration

- [x] 1.1 Remove Baileys-related dependencies: uninstall `@whiskeysockets/baileys`, `@hapi/boom`, `qrcode-terminal`, `@types/hapi__boom`, `@types/qrcode-terminal`. Remove `pnpm.patchedDependencies` and `pnpm.onlyBuiltDependencies` entries from `package.json`. Delete `patches/` directory.
- [x] 1.2 Add new dependencies: install `hono` and `@hono/node-server`.
- [x] 1.3 Update `.env.template` with new Cloud API env vars: `WA_PHONE_NUMBER_ID`, `WA_ACCESS_TOKEN`, `WA_VERIFY_TOKEN`, `WA_APP_SECRET` (optional). Keep existing vars (`ADMIN_PHONE`, `NEQUI_NUMBER`, `LOG_LEVEL`, `PORT`, `NODE_ENV`).
- [x] 1.4 Run `pnpm install` to verify clean dependency resolution with no native compilation errors.

## 2. Cloud API Types

- [x] 2.1 Create `src/whatsapp/types.ts` with TypeScript types for Cloud API webhook payload structure (webhook entry, changes, value, messages, contacts, statuses).
- [x] 2.2 Define `IncomingMessage` type representing the parsed result passed to handlers: `{ phone: string; text: string; mediaId?: string }`.
- [x] 2.3 Define Cloud API outbound message types: text message body, interactive list body, interactive button body, image message body.

## 3. Cloud API Client (Outbound)

- [x] 3.1 Create `src/whatsapp/api.ts` with a `callGraphApi` base function that POSTs to `https://graph.facebook.com/v21.0/{WA_PHONE_NUMBER_ID}/messages` with Bearer token auth.
- [x] 3.2 Implement `sendText(phone: string, text: string)` — sends a plain text message via Graph API.
- [x] 3.3 Implement `sendList(phone, body, buttonText, sections, header?, footer?)` — sends a Cloud API interactive list message. Truncate row titles to 24 chars and descriptions to 72 chars.
- [x] 3.4 Implement `sendButtons(phone, body, buttons, footer?)` — sends a Cloud API interactive reply button message (max 3 buttons). Truncate button titles to 20 chars.
- [x] 3.5 Implement `sendImage(phone, imagePath, caption?)` — reads image from disk and sends via Graph API media upload or base64. Used for forwarding vouchers to admin.
- [x] 3.6 Implement `downloadMedia(mediaId: string, downloadDir: string): Promise<string | null>` — calls `GET /v21.0/{mediaId}` to get URL, downloads binary, saves to `downloadDir/media_<id>_<timestamp>.jpeg`.

## 4. Webhook Server (Inbound)

- [x] 4.1 Create `src/whatsapp/webhook.ts` with a Hono app instance.
- [x] 4.2 Implement `GET /webhook` route for Meta hub challenge verification: validate `hub.verify_token` against `WA_VERIFY_TOKEN`, respond with `hub.challenge` on match, 403 otherwise.
- [x] 4.3 Implement `POST /webhook` route: respond 200 immediately, then parse the Cloud API webhook payload to extract sender phone, message type, text content (from text/interactive/image messages), and media ID.
- [x] 4.4 Filter out non-message events (statuses, delivery receipts) and self-sent messages in the webhook handler.
- [x] 4.5 Call `handleMessage(phone, text, mediaId?)` from the webhook handler after parsing.

## 5. Refactor Handlers to Be Transport-Agnostic

- [x] 5.1 Change `handleMessage` signature from `(sock: WASocket, message: WAMessage)` to `(phone: string, text: string, mediaId?: string)`. Move JID extraction, message text extraction, and fromMe/group filtering to the webhook layer.
- [x] 5.2 Replace all `sendTextMessage(sock, jid, ...)` calls with `sendText(phone, ...)` throughout `handlers/index.ts`.
- [x] 5.3 Replace all `sendListMessage(sock, jid, ...)` calls with `sendList(phone, ...)` throughout `handlers/index.ts`.
- [x] 5.4 Replace all `sendButtonMessage(sock, jid, ...)` calls with `sendButtons(phone, ...)` throughout `handlers/index.ts`.
- [x] 5.5 Refactor `handlePayment` to accept `mediaId` parameter instead of `WAMessage`. Use new `downloadMedia(mediaId, dir)` instead of Baileys' `downloadMediaMessage`. Use `sendImage` for forwarding voucher to admin.
- [x] 5.6 Remove all remaining `WASocket` and `WAMessage` type parameters from every handler function (handleWelcome, handleWelcomeInput, showCategories, handleCategorySelect, etc.). Each function should take `(phone: string, ...)` instead of `(sock: WASocket, jid: string, phone: string, ...)`.
- [x] 5.7 Remove all Baileys imports from `handlers/index.ts` and update imports to use new `@/whatsapp/api` send functions.
- [x] 5.8 Update admin order approval/rejection (`processOrderValidation`) to use `sendText` and `sendImage` with phone numbers instead of JIDs. Remove `@s.whatsapp.net` JID construction.

## 6. Entry Point & Server Startup

- [x] 6.1 Update `src/index.ts`: replace `connectToWhatsApp()` call with Hono server startup using `@hono/node-server`'s `serve()`. Import the webhook app from `@/whatsapp/webhook`.
- [x] 6.2 Add env var validation on startup: check that `WA_PHONE_NUMBER_ID`, `WA_ACCESS_TOKEN`, and `WA_VERIFY_TOKEN` are set, exit with error if not.
- [x] 6.3 Log server listening address and port on successful startup.

## 7. Cleanup & File Removal

- [x] 7.1 Delete `src/whatsapp/connection.ts` (Baileys socket setup).
- [x] 7.2 Delete `src/whatsapp/utils.ts` (Baileys send/download helpers).
- [x] 7.3 Remove re-export of `formatPrice` from deleted utils — update any imports to use `@/messages` directly.
- [x] 7.4 Update `src/types/index.ts` if any Baileys-specific types were referenced (verify no WASocket/WAMessage references remain).

## 8. Configuration & Documentation Updates

- [x] 8.1 Update `deploy.md` with new startup flow: no QR scan needed, just set env vars and start. Add Cloudflare Tunnel setup instructions for webhook URL.
- [x] 8.2 Add `.env` example values to `.env.template` with comments explaining where to find each Cloud API credential in the Meta dashboard.
- [x] 8.3 Update `package.json` scripts if needed (start/dev commands should remain the same since they use `node -r ts-node/register`).

## 9. Verification

- [x] 9.1 Run `pnpm run lint` and fix any lint errors.
- [x] 9.2 Run TypeScript type-check (`npx tsc --noEmit`) and fix any type errors — pay attention to `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` strictness.
- [x] 9.3 Start the server locally, verify `GET /webhook` verification works with a curl command.
- [x] 9.4 Verify no remaining references to Baileys, WASocket, WAMessage, or `@whiskeysockets` anywhere in `src/`.
