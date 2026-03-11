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
  buttonText: string,
  sections: { title: string; rows: { title: string; rowId: string; description?: string }[] }[],
) => {
  // Try sending native list, but fallback to text if unsupported or failing (Baileys issue with multi-device lists)
  try {
    const listMessage = {
      text,
      title,
      buttonText,
      sections,
      viewOnce: true,
    };
    await sock.sendMessage(jid, listMessage as any); // cast for dynamic types
  } catch (error) {
    console.warn('List message failed, falling back to text format', error);
    let fallbackText = `*${title}*\n${text}\n\n`;
    sections.forEach((sec) => {
      fallbackText += `*${sec.title}*\n`;
      sec.rows.forEach((row) => {
        fallbackText += `- ${row.title} (${row.rowId})\n`;
        if (row.description) fallbackText += `  ${row.description}\n`;
      });
      fallbackText += `\n`;
    });
    fallbackText += `Responde con el numero de la opcion que deseas.`;
    await sock.sendMessage(jid, { text: fallbackText });
  }
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
