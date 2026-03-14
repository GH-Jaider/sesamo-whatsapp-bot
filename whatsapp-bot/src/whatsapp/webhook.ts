import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import type { WebhookPayload, WebhookMessage, IncomingMessage } from '@/whatsapp/types';
import { handleMessage } from '@/handlers/index';

export const app = new Hono();

// ---------------------------------------------------------------------------
// Static pages — menu & privacy policy (served through the public tunnel)
// ---------------------------------------------------------------------------

app.use('/menu', serveStatic({ root: '..', path: 'sesamo-menu.html' }));
app.use('/privacidad', serveStatic({ root: '..', path: 'politica-privacidad.html' }));
app.use('/menu.pdf', serveStatic({ root: '..', path: 'sesamo-menu.pdf' }));
app.use('/privacidad.pdf', serveStatic({ root: '..', path: 'politica-privacidad.pdf' }));

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
