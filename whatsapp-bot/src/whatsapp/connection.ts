import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  proto,
  useMultiFileAuthState,
  WASocket,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import path from 'path';
import qrcode from 'qrcode-terminal';
import { handleMessage } from '@/handlers';

let sock: WASocket | null = null;

// In-memory message store for retry purposes.
// Baileys calls getMessage when it needs to resend a message (e.g. after a network hiccup).
const messageStore = new Map<string, proto.IMessage>();
const MAX_STORE_SIZE = 1000;

function storeMessage(id: string, message: proto.IMessage) {
  // Evict oldest entries if the store gets too large
  if (messageStore.size >= MAX_STORE_SIZE) {
    const firstKey = messageStore.keys().next().value as string;
    messageStore.delete(firstKey);
  }
  messageStore.set(id, message);
}

export async function connectToWhatsApp(): Promise<WASocket> {
  // Fetch the latest WA Web version so the server doesn't reject us (405)
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`Using WA v${version.join('.')}, isLatest: ${isLatest}`);

  const authDir = path.join(process.cwd(), 'data/auth_info_baileys');
  const { state, saveCreds } = await useMultiFileAuthState(authDir);

  // Clean up old socket listeners if reconnecting
  if (sock) {
    sock.ev.removeAllListeners('connection.update');
    sock.ev.removeAllListeners('creds.update');
    sock.ev.removeAllListeners('messages.upsert');
  }

  sock = makeWASocket({
    version,
    auth: state,
    browser: Browsers.ubuntu('Chrome'),
    logger: pino({ level: process.env.LOG_LEVEL || 'error' }),
    getMessage: async (key) => {
      const id = key.id;
      if (id && messageStore.has(id)) {
        return messageStore.get(id)!;
      }
      return undefined;
    },
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('Scan the QR code below to link your WhatsApp:');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const isRecoverable =
        statusCode !== DisconnectReason.loggedOut && statusCode !== 403 && statusCode !== 405;

      console.log(`Connection closed (status: ${statusCode}), reconnecting: ${isRecoverable}`);

      if (isRecoverable) {
        // Reconnect with a delay to avoid hammering the server
        setTimeout(() => connectToWhatsApp(), 5000);
      } else {
        console.error(
          'Fatal connection error. Delete data/auth_info_baileys/ and restart to re-link.',
        );
        process.exit(1);
      }
    } else if (connection === 'open') {
      console.log('Connected to WhatsApp!');
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async (m) => {
    if (m.type !== 'notify') return;

    for (const msg of m.messages) {
      // Store outgoing messages for retry purposes
      if (msg.key.id && msg.message) {
        storeMessage(msg.key.id, msg.message);
      }
      await handleMessage(sock!, msg);
    }
  });

  return sock;
}
