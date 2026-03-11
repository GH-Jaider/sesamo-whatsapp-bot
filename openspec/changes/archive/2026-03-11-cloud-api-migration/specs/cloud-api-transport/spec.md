## ADDED Requirements

### Requirement: Webhook verification endpoint
The system SHALL expose a `GET /webhook` endpoint that responds to Meta's hub challenge verification. When the request contains `hub.mode=subscribe` and `hub.verify_token` matches the configured `WA_VERIFY_TOKEN` environment variable, the endpoint SHALL respond with HTTP 200 and the `hub.challenge` value as plain text. For invalid tokens, it SHALL respond with HTTP 403.

#### Scenario: Valid webhook verification
- **WHEN** Meta sends `GET /webhook?hub.mode=subscribe&hub.verify_token=<valid>&hub.challenge=abc123`
- **THEN** the server responds with HTTP 200 and body `abc123`

#### Scenario: Invalid webhook verification token
- **WHEN** Meta sends `GET /webhook?hub.mode=subscribe&hub.verify_token=wrong_token&hub.challenge=abc123`
- **THEN** the server responds with HTTP 403

### Requirement: Webhook message receiving endpoint
The system SHALL expose a `POST /webhook` endpoint that receives WhatsApp Cloud API webhook events. The endpoint SHALL always respond with HTTP 200 immediately to acknowledge receipt, then process the message asynchronously. The endpoint SHALL extract the sender's phone number, message content, and message type from the webhook payload.

#### Scenario: Receive plain text message
- **WHEN** Cloud API sends a webhook with a text message `{"type": "text", "text": {"body": "hola"}}` from phone `573001234567`
- **THEN** the system extracts phone `573001234567` and text `hola`, and routes to the message handler

#### Scenario: Receive interactive list reply
- **WHEN** Cloud API sends a webhook with an interactive message `{"type": "interactive", "interactive": {"type": "list_reply", "list_reply": {"id": "5"}}}` from phone `573001234567`
- **THEN** the system extracts phone `573001234567` and the selected row ID `5`, and routes to the message handler with `5` as the user's text input

#### Scenario: Receive interactive button reply
- **WHEN** Cloud API sends a webhook with an interactive message `{"type": "interactive", "interactive": {"type": "button_reply", "button_reply": {"id": "add"}}}` from phone `573001234567`
- **THEN** the system extracts phone `573001234567` and the button ID `add`, and routes to the message handler with `add` as the user's text input

#### Scenario: Receive image message
- **WHEN** Cloud API sends a webhook with an image message `{"type": "image", "image": {"id": "media_id_123", "caption": ""}}` from phone `573001234567`
- **THEN** the system extracts the media ID `media_id_123` and any caption, and routes to the message handler with the media ID available for download

#### Scenario: Ignore non-message webhook events
- **WHEN** Cloud API sends a webhook with a `statuses` update (delivery receipt, read receipt)
- **THEN** the system responds with HTTP 200 and does not process the event

#### Scenario: Ignore messages sent by the bot itself
- **WHEN** a webhook arrives but the message metadata indicates it was sent by the bot's own phone number
- **THEN** the system does not process the message

### Requirement: Send text messages via Graph API
The system SHALL send text messages by making a `POST` request to `https://graph.facebook.com/v21.0/{WA_PHONE_NUMBER_ID}/messages` with the recipient phone number and message body. The `Authorization` header SHALL use the `WA_ACCESS_TOKEN` as a Bearer token.

#### Scenario: Send a plain text reply
- **WHEN** the handler calls `sendText("573001234567", "Bienvenido a Finca Sesamo!")`
- **THEN** the system sends a POST to the Graph API with `{"messaging_product": "whatsapp", "to": "573001234567", "type": "text", "text": {"body": "Bienvenido a Finca Sesamo!"}}`

### Requirement: Send interactive list messages via Graph API
The system SHALL send interactive list messages using the Cloud API interactive message format. Each list SHALL support a body text, a button label, and sections with rows. Each row SHALL have an `id`, `title` (max 24 chars), and optional `description` (max 72 chars).

#### Scenario: Send category list to customer
- **WHEN** the handler calls `sendList` with body "Elige una categoria", button "Ver categorias", and a section with 6 category rows
- **THEN** the system sends a POST to the Graph API with `{"messaging_product": "whatsapp", "to": "<phone>", "type": "interactive", "interactive": {"type": "list", "body": {"text": "..."}, "action": {"button": "Ver categorias", "sections": [...]}}}`

#### Scenario: List row constraints
- **WHEN** a list message is constructed with a row title longer than 24 characters
- **THEN** the title SHALL be truncated to 24 characters before sending

### Requirement: Send interactive button messages via Graph API
The system SHALL send interactive reply button messages using the Cloud API format. Each message SHALL support a body text and up to 3 buttons, each with an `id` and `title`.

#### Scenario: Send cart action buttons
- **WHEN** the handler calls `sendButtons` with body showing cart summary and buttons `[{id: "add", title: "Agregar mas"}, {id: "done", title: "Finalizar pedido"}]`
- **THEN** the system sends a POST to the Graph API with `{"messaging_product": "whatsapp", "type": "interactive", "interactive": {"type": "button", "body": {"text": "..."}, "action": {"buttons": [{"type": "reply", "reply": {"id": "add", "title": "Agregar mas"}}, ...]}}}`

#### Scenario: Button title length limit
- **WHEN** a button message is constructed with a button title longer than 20 characters
- **THEN** the title SHALL be truncated to 20 characters before sending

### Requirement: Send image messages via Graph API
The system SHALL send image messages (for forwarding vouchers to admin) by uploading the image or sending via URL through the Graph API.

#### Scenario: Forward voucher image to admin
- **WHEN** the handler needs to send a voucher image with caption to the admin phone
- **THEN** the system sends a POST to the Graph API with the image and caption in the message payload

### Requirement: Download media from Cloud API
The system SHALL download media (voucher images) by first calling `GET https://graph.facebook.com/v21.0/{media_id}` with the access token to retrieve the download URL, then fetching the binary content from that URL and saving it to `data/downloads/`.

#### Scenario: Download voucher image
- **WHEN** a customer sends an image message with media ID `media_123`
- **THEN** the system calls the Graph API to get the media URL, downloads the binary content, saves it as `data/downloads/media_<id>_<timestamp>.jpeg`, and returns the file path

#### Scenario: Media download failure
- **WHEN** the Graph API returns an error when fetching media URL or the download fails
- **THEN** the system returns `null` and the handler sends an error message to the customer

### Requirement: Transport-agnostic handler interface
The system SHALL NOT import or reference any WhatsApp-specific types (WASocket, WAMessage, Baileys proto) in the handler module. Handlers SHALL receive plain primitives: phone number (string), user text input (string), and optionally a media ID (string). Send functions SHALL be imported from the transport module.

#### Scenario: Handler function signature
- **WHEN** the webhook receives a text message from phone `573001234567` with text `hola`
- **THEN** the main handler is called as `handleMessage("573001234567", "hola")` — no WASocket or WAMessage parameters

#### Scenario: Handler with image
- **WHEN** the webhook receives an image message from phone `573001234567` with media ID `media_123` and caption `"comprobante"`
- **THEN** the main handler is called as `handleMessage("573001234567", "comprobante", { mediaId: "media_123" })` or equivalent

### Requirement: HTTP server startup
The system SHALL start an HTTP server on the port specified by the `PORT` environment variable (defaulting to 3000). The server SHALL log its listening address on startup.

#### Scenario: Server starts successfully
- **WHEN** the application starts with `PORT=3000`
- **THEN** the Hono HTTP server listens on port 3000 and logs "Server listening on port 3000"

#### Scenario: Server starts with custom port
- **WHEN** the application starts with `PORT=8080`
- **THEN** the server listens on port 8080

### Requirement: Environment variable configuration
The system SHALL require the following environment variables for Cloud API operation: `WA_PHONE_NUMBER_ID` (the phone number ID from Meta dashboard), `WA_ACCESS_TOKEN` (system user permanent token), and `WA_VERIFY_TOKEN` (arbitrary string for webhook verification). `WA_APP_SECRET` SHALL be optional, reserved for future webhook signature validation.

#### Scenario: Missing required env var
- **WHEN** the application starts without `WA_PHONE_NUMBER_ID` set
- **THEN** the application logs an error and exits

#### Scenario: All env vars configured
- **WHEN** the application starts with all required Cloud API env vars set
- **THEN** the application initializes the database and starts the HTTP server
