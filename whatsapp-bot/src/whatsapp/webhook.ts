import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import type { WebhookPayload, WebhookMessage, IncomingMessage } from '@/whatsapp/types';
import { handleMessage } from '@/handlers/index';

export const app = new Hono();

// ---------------------------------------------------------------------------
// Message deduplication — prevent processing the same webhook twice
// WhatsApp may re-deliver webhooks if the server was temporarily unreachable.
// We keep a bounded set of recently-seen message IDs.
// ---------------------------------------------------------------------------

const SEEN_MESSAGES = new Set<string>();
const MAX_SEEN = 1000;
/** Max age in ms for a message timestamp to be considered fresh (2 minutes) */
const MAX_MESSAGE_AGE_MS = 2 * 60 * 1000;

function markSeen(messageId: string): boolean {
  if (SEEN_MESSAGES.has(messageId)) return false; // already seen
  SEEN_MESSAGES.add(messageId);
  // Evict oldest entries when set grows too large
  if (SEEN_MESSAGES.size > MAX_SEEN) {
    const first = SEEN_MESSAGES.values().next().value;
    if (first) SEEN_MESSAGES.delete(first);
  }
  return true; // first time seeing this message
}

// ---------------------------------------------------------------------------
// Static pages — menu & privacy policy
// In dev (ts-node from whatsapp-bot/): static files are at ../
// In production (Docker):             static files are at ./static/
// ---------------------------------------------------------------------------

const staticRoot = process.env.STATIC_ROOT || '..';

app.use('/menu', serveStatic({ root: staticRoot, path: 'sesamo-menu.html' }));
app.use('/privacidad', serveStatic({ root: staticRoot, path: 'politica-privacidad.html' }));
app.use('/menu.pdf', serveStatic({ root: staticRoot, path: 'sesamo-menu.pdf' }));
app.use('/privacidad.pdf', serveStatic({ root: staticRoot, path: 'politica-privacidad.pdf' }));

// ---------------------------------------------------------------------------
// GET /webhook — Meta hub challenge verification
// ---------------------------------------------------------------------------

app.get('/webhook', (c) => {
  const mode = c.req.query('hub.mode');
  const token = c.req.query('hub.verify_token');
  const challenge = c.req.query('hub.challenge');

  if (mode === 'subscribe' && token === process.env.WA_VERIFY_TOKEN) {
    console.log('[webhook] Verification successful');
    return c.text(challenge ?? '', 200);
  }

  console.warn('[webhook] Verification failed: invalid token');
  return c.text('Forbidden', 403);
});

// ---------------------------------------------------------------------------
// POST /webhook — Receive messages
// ---------------------------------------------------------------------------

app.post('/webhook', async (c) => {
  // Always respond 200 immediately
  const body = await c.req.json<WebhookPayload>();

  // Process asynchronously (don't block the 200 response)
  processWebhook(body).catch((err) => {
    console.error('[webhook] Error processing:', err);
  });

  return c.text('OK', 200);
});

// ---------------------------------------------------------------------------
// Parse and route incoming messages
// ---------------------------------------------------------------------------

function parseMessage(msg: WebhookMessage): IncomingMessage | null {
  const phone = msg.from;
  let text = '';
  let mediaId: string | undefined;

  switch (msg.type) {
    case 'text':
      text = msg.text?.body ?? '';
      break;

    case 'interactive':
      if (msg.interactive?.type === 'list_reply') {
        text = msg.interactive.list_reply?.id ?? '';
      } else if (msg.interactive?.type === 'button_reply') {
        text = msg.interactive.button_reply?.id ?? '';
      }
      break;

    case 'image':
      mediaId = msg.image?.id;
      text = msg.image?.caption ?? '';
      break;

    case 'button':
      text = msg.button?.payload ?? '';
      break;

    default:
      // Unsupported message type — ignore
      return null;
  }

  const result: IncomingMessage = { phone, text };
  if (mediaId != null) {
    result.mediaId = mediaId;
  }
  return result;
}

async function processWebhook(payload: WebhookPayload): Promise<void> {
  if (payload.object !== 'whatsapp_business_account') return;

  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      const value = change.value;

      // Skip non-message events (statuses, delivery receipts, etc.)
      if (!value.messages || value.messages.length === 0) continue;

      const botPhoneId = process.env.WA_PHONE_NUMBER_ID ?? '';
      // The metadata phone_number_id identifies the bot — skip if mismatch (shouldn't happen)
      if (value.metadata.phone_number_id !== botPhoneId) continue;

      for (const msg of value.messages) {
        // --- Deduplication: skip already-processed messages ---
        if (msg.id && !markSeen(msg.id)) {
          console.log(`[webhook] skipping duplicate message id=${msg.id}`);
          continue;
        }

        // --- Skip stale messages (re-delivered after downtime) ---
        if (msg.timestamp) {
          const msgTime = parseInt(msg.timestamp, 10) * 1000; // WhatsApp sends Unix seconds
          const age = Date.now() - msgTime;
          if (age > MAX_MESSAGE_AGE_MS) {
            console.log(
              `[webhook] skipping stale message id=${msg.id} age=${Math.round(age / 1000)}s`,
            );
            continue;
          }
        }

        const parsed = parseMessage(msg);
        if (!parsed) continue;

        console.log(
          `[webhook] message from=${parsed.phone} type=${msg.type} text=${parsed.text.slice(0, 50)}`,
        );

        try {
          await handleMessage(parsed.phone, parsed.text, parsed.mediaId);
        } catch (err) {
          console.error(`[webhook] Error handling message from ${parsed.phone}:`, err);
        }
      }
    }
  }
}
