import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import type {
  GraphApiTextMessage,
  GraphApiInteractiveListMessage,
  GraphApiInteractiveButtonMessage,
  GraphApiListSection,
  GraphApiListRow,
} from '@/whatsapp/types';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const GRAPH_API_VERSION = 'v21.0';

function getPhoneNumberId(): string {
  const id = process.env.WA_PHONE_NUMBER_ID;
  if (!id) throw new Error('WA_PHONE_NUMBER_ID is not set');
  return id;
}

function getAccessToken(): string {
  const token = process.env.WA_ACCESS_TOKEN;
  if (!token) throw new Error('WA_ACCESS_TOKEN is not set');
  return token;
}

function messagesUrl(): string {
  return `https://graph.facebook.com/${GRAPH_API_VERSION}/${getPhoneNumberId()}/messages`;
}

// ---------------------------------------------------------------------------
// Base API call
// ---------------------------------------------------------------------------

async function callGraphApi(body: Record<string, unknown> | object): Promise<void> {
  const payload = body as Record<string, unknown>;
  const to = payload.to ?? '?';
  const type = payload.type ?? '?';

  const res = await fetch(messagesUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getAccessToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(
      `[Graph API] SEND FAILED to=${to} type=${type} ${res.status} ${res.statusText}: ${text}`,
    );
  } else {
    console.log(`[Graph API] sent to=${to} type=${type} status=${res.status}`);
  }
}

// ---------------------------------------------------------------------------
// Send functions
// ---------------------------------------------------------------------------

export async function sendTemplate(
  phone: string,
  templateName: string,
  languageCode: string,
  parameters: string[],
): Promise<boolean> {
  console.log(
    `[sendTemplate] to=${phone} template=${templateName} params=${JSON.stringify(parameters)}`,
  );
  const body = {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components:
        parameters.length > 0
          ? [
              {
                type: 'body',
                parameters: parameters.map((p) => ({ type: 'text', text: p })),
              },
            ]
          : [],
    },
  };

  const res = await fetch(messagesUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getAccessToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[sendTemplate] FAILED: ${res.status} ${text}`);
    return false;
  }
  console.log(`[sendTemplate] sent to=${phone} status=${res.status}`);
  return true;
}

export async function sendText(phone: string, text: string): Promise<void> {
  console.log(`[sendText] to=${phone} text=${text.slice(0, 50)}...`);
  const body: GraphApiTextMessage = {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'text',
    text: { body: text },
  };
  await callGraphApi(body);
}

export async function sendList(
  phone: string,
  body: string,
  buttonText: string,
  sections: { title: string; rows: { title: string; rowId: string; description?: string }[] }[],
  header?: string,
  footer?: string,
): Promise<void> {
  const apiSections: GraphApiListSection[] = sections.map((sec) => ({
    title: sec.title,
    rows: sec.rows.map((row) => {
      const base: GraphApiListRow = { id: row.rowId, title: row.title.slice(0, 24) };
      if (row.description != null) {
        base.description = row.description.slice(0, 72);
      }
      return base;
    }),
  }));

  const msg: GraphApiInteractiveListMessage = {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: body },
      action: {
        button: buttonText.slice(0, 20),
        sections: apiSections,
      },
    },
  };

  if (header) {
    msg.interactive.header = { type: 'text', text: header };
  }
  if (footer) {
    msg.interactive.footer = { text: footer };
  }

  await callGraphApi(msg);
}

export async function sendButtons(
  phone: string,
  body: string,
  buttons: { buttonId: string; buttonText: string }[],
  footer?: string,
): Promise<void> {
  const msg: GraphApiInteractiveButtonMessage = {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: body },
      action: {
        buttons: buttons.slice(0, 3).map((b) => ({
          type: 'reply' as const,
          reply: {
            id: b.buttonId,
            title: b.buttonText.slice(0, 20),
          },
        })),
      },
    },
  };

  if (footer) {
    msg.interactive.footer = { text: footer };
  }

  await callGraphApi(msg);
}

export async function sendImage(phone: string, imagePath: string, caption?: string): Promise<void> {
  console.log(`[sendImage] to=${phone} file=${imagePath}`);

  // Upload media first, then send the media ID
  const uploadUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${getPhoneNumberId()}/media`;

  const imageBuffer = await fs.readFile(imagePath);
  const formData = new FormData();
  formData.append('messaging_product', 'whatsapp');
  formData.append('type', 'image/jpeg');
  formData.append(
    'file',
    new Blob([imageBuffer], { type: 'image/jpeg' }),
    path.basename(imagePath),
  );

  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getAccessToken()}`,
    },
    body: formData,
  });

  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    console.error(`[sendImage] media upload failed: ${uploadRes.status} ${text}`);
    // Fallback: send caption as text if image upload fails
    if (caption) {
      console.log('[sendImage] falling back to text-only message');
      await sendText(phone, caption);
    }
    return;
  }

  const uploadData = (await uploadRes.json()) as { id?: string };
  const mediaId = uploadData.id;
  if (!mediaId) {
    console.error('[sendImage] media upload returned no id');
    if (caption) {
      await sendText(phone, caption);
    }
    return;
  }

  console.log(`[sendImage] media uploaded, id=${mediaId}`);

  const msg: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'image',
    image: { id: mediaId, ...(caption ? { caption } : {}) },
  };

  await callGraphApi(msg);
}

// ---------------------------------------------------------------------------
// Download media
// ---------------------------------------------------------------------------

export async function downloadMedia(mediaId: string, downloadDir: string): Promise<string | null> {
  try {
    // Step 1: Get media URL
    const metaUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${mediaId}`;
    const metaRes = await fetch(metaUrl, {
      headers: { Authorization: `Bearer ${getAccessToken()}` },
    });

    if (!metaRes.ok) {
      console.error(`[downloadMedia] meta fetch failed: ${metaRes.status}`);
      return null;
    }

    const metaData = (await metaRes.json()) as { url?: string };
    const downloadUrl = metaData.url;
    if (!downloadUrl) {
      console.error('[downloadMedia] no url in meta response');
      return null;
    }

    // Step 2: Download the binary
    const fileRes = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${getAccessToken()}` },
    });

    if (!fileRes.ok) {
      console.error(`[downloadMedia] download failed: ${fileRes.status}`);
      return null;
    }

    const buffer = Buffer.from(await fileRes.arrayBuffer());

    if (!existsSync(downloadDir)) {
      mkdirSync(downloadDir, { recursive: true });
    }

    const fileName = `media_${mediaId}_${Date.now()}.jpeg`;
    const filePath = path.join(downloadDir, fileName);
    await fs.writeFile(filePath, buffer);

    return filePath;
  } catch (err) {
    console.error('[downloadMedia] error:', err);
    return null;
  }
}
