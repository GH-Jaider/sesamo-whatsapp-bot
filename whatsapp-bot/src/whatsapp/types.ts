// ---------------------------------------------------------------------------
// WhatsApp Cloud API Types
// ---------------------------------------------------------------------------

// --- Webhook Payload (Inbound) ---

export interface WebhookPayload {
  object: string;
  entry: WebhookEntry[];
}

export interface WebhookEntry {
  id: string;
  changes: WebhookChange[];
}

export interface WebhookChange {
  value: WebhookValue;
  field: string;
}

export interface WebhookValue {
  messaging_product: string;
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: WebhookContact[];
  messages?: WebhookMessage[];
  statuses?: WebhookStatus[];
}

export interface WebhookContact {
  profile: { name: string };
  wa_id: string;
}

export interface WebhookMessage {
  from: string;
  id: string;
  timestamp: string;
  type:
    | 'text'
    | 'interactive'
    | 'image'
    | 'button'
    | 'reaction'
    | 'sticker'
    | 'audio'
    | 'video'
    | 'document'
    | 'location'
    | 'contacts'
    | 'order'
    | 'unknown';
  text?: { body: string };
  interactive?: {
    type: 'list_reply' | 'button_reply';
    list_reply?: { id: string; title: string; description?: string };
    button_reply?: { id: string; title: string };
  };
  image?: { id: string; mime_type: string; sha256: string; caption?: string };
  button?: { text: string; payload: string };
}

export interface WebhookStatus {
  id: string;
  status: string;
  timestamp: string;
  recipient_id: string;
}

// --- Parsed Incoming Message ---

export interface IncomingMessage {
  phone: string;
  text: string;
  mediaId?: string;
}

// --- Outbound Message Types (Graph API) ---

export interface GraphApiTextMessage {
  messaging_product: 'whatsapp';
  to: string;
  type: 'text';
  text: { body: string };
}

export interface GraphApiInteractiveListMessage {
  messaging_product: 'whatsapp';
  to: string;
  type: 'interactive';
  interactive: {
    type: 'list';
    header?: { type: 'text'; text: string };
    body: { text: string };
    footer?: { text: string };
    action: {
      button: string;
      sections: GraphApiListSection[];
    };
  };
}

export interface GraphApiListSection {
  title: string;
  rows: GraphApiListRow[];
}

export interface GraphApiListRow {
  id: string;
  title: string;
  description?: string;
}

export interface GraphApiInteractiveButtonMessage {
  messaging_product: 'whatsapp';
  to: string;
  type: 'interactive';
  interactive: {
    type: 'button';
    body: { text: string };
    footer?: { text: string };
    action: {
      buttons: GraphApiReplyButton[];
    };
  };
}

export interface GraphApiReplyButton {
  type: 'reply';
  reply: { id: string; title: string };
}

export interface GraphApiImageMessage {
  messaging_product: 'whatsapp';
  to: string;
  type: 'image';
  image: { id: string; caption?: string };
}
