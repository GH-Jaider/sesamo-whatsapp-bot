import { WASocket, downloadMediaMessage, WAMessage } from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';

export const sendTextMessage = async (sock: WASocket, jid: string, text: string) => {
  await sock.sendMessage(jid, { text });
};

export const sendListMessage = async (
  sock: WASocket,
  jid: string,
  title: string,
  text: string,
  _buttonText: string,
  sections: { title: string; rows: { title: string; rowId: string; description?: string }[] }[],
) => {
  // Native list messages don't work on regular WhatsApp accounts (only Business API).
  // Always use text-based format with numbered options.
  let fallbackText = `*${title}*\n${text}\n\n`;
  sections.forEach((sec) => {
    fallbackText += `*${sec.title}*\n`;
    sec.rows.forEach((row) => {
      fallbackText += `*${row.rowId}.* ${row.title}`;
      if (row.description) fallbackText += ` - ${row.description}`;
      fallbackText += `\n`;
    });
    fallbackText += `\n`;
  });
  fallbackText += `Responde con el *número* de la opción que deseas.`;
  await sock.sendMessage(jid, { text: fallbackText });
};

/** Format price in Colombian pesos: 20000 -> "$20.000" */
export const formatPrice = (price: number): string => {
  return '$' + price.toLocaleString('es-CO');
};

export const downloadMedia = async (
  msg: WAMessage,
  downloadDir: string,
): Promise<string | null> => {
  try {
    const buffer = await downloadMediaMessage(
      msg,
      'buffer',
      {},
      {
        logger: pino({ level: 'error' }) as any,
        reuploadRequest: async () => {
          throw new Error('Media re-upload not supported');
        },
      },
    );

    if (!existsSync(downloadDir)) {
      mkdirSync(downloadDir, { recursive: true });
    }

    const fileName = `media_${msg.key.id}_${Date.now()}.jpeg`;
    const filePath = path.join(downloadDir, fileName);
    await fs.writeFile(filePath, buffer as Buffer);

    return filePath;
  } catch (err) {
    console.error('Failed to download media', err);
    return null;
  }
};
