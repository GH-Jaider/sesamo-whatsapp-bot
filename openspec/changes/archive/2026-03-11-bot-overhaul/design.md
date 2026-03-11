## Context

The WhatsApp bot for Finca Sesamo is a working prototype running on an old Android phone via Termux. It uses Baileys v6.7.21, sql.js (pure WASM SQLite), and TypeScript. The bot currently has a flat `products` table seeded with 4 placeholder hamburger items, a rigid state machine that requires exact case-sensitive numeric input, and error handling that dumps users to a dead end. The real menu (from `sesamo-menu.html`) has ~30 items across 6 categories with structural complexity: almuerzos require a protein sub-choice, desayunos have optional add-ons, and dairy products are sold by unit (libra/litro).

**Constraints:**
- Runs on Termux/Android — no native modules, must use sql.js
- Uses **WhatsApp Business App** (free, from Play Store) — supports interactive list messages and button messages natively via Baileys
- Single-file handler architecture (all handlers in `handlers/index.ts`)
- Admin phone configured via env var, all admin commands prefixed with `!`

## Goals / Non-Goals

**Goals:**
- Replace the placeholder database schema and seed data with the real Finca Sesamo menu
- Support menu items with sub-options (protein choice for almuerzo) and add-ons (caldo/changua for desayuno)
- Make all input handling case-insensitive and keyword-aware
- Implement graceful error recovery that re-prompts instead of resetting
- Add quantity support when adding items to cart
- Add `!pedidos` admin command to list pending orders
- Use warm, on-brand messaging that reflects Sesamo's personality

**Non-Goals:**
- Multi-language support — Spanish only
- Online payments integration — Nequi manual transfer stays as-is
- Analytics or reporting dashboard
- Multi-admin support — single admin phone
- Automated order status notifications (e.g., "your order is ready")
- Menu images or rich media in bot responses

## Decisions

### 1. Database schema: Replace `products` with `categories` + `menu_items` + `item_options`

**Choice:** Three-table normalized schema.

- `categories` — id, name, display_order, description
- `menu_items` — id, category_id, name, description, price, available, display_order
- `item_options` — id, menu_item_id, option_group (e.g., "proteina", "adicional"), name, price (0 for included choices, >0 for priced add-ons), display_order

**Why over flat table with JSON:** Queryable, admin can toggle availability per item, options are first-class entities that can be individually managed. The current `dbGet`/`dbAll`/`dbRun` wrapper works without changes.

**Why over separate `option_groups` table:** Overkill — there are only two option groups in the entire menu (protein for almuerzo, add-ons for desayuno). Storing the group name as a string on `item_options` is sufficient.

**Migration:** Delete `sesamo.db` and let the bot re-seed. No migration needed since the bot has no real order history worth preserving.

### 2. Order items: New `order_items` table

**Choice:** Add `order_items` table alongside existing `orders` table.

- `order_items` — id, order_id, menu_item_id, item_name, item_price, quantity, options_json (serialized chosen options with names and prices)

**Why `item_name` and `item_price` denormalized:** Captures the price/name at time of order even if menu changes later. `options_json` stores chosen sub-options as `[{name, price}]` for display in receipts and admin notifications.

**Why not a separate `order_item_options` table:** The options are only ever read as a blob for display purposes. JSON is simpler and sufficient.

### 3. Cart stored in `user_states.cart_data` as JSON (keep existing pattern)

**Choice:** Keep the current approach of serializing cart to JSON in the `cart_data` column.

New cart shape:
```json
{
  "items": [
    {
      "menuItemId": 5,
      "name": "Almuerzo - Menú de la Casa",
      "price": 35000,
      "quantity": 2,
      "options": [{"name": "Pechuga de pollo", "price": 0}]
    }
  ],
  "pendingItem": {
    "menuItemId": 5,
    "name": "Almuerzo - Menú de la Casa",
    "price": 35000,
    "quantity": 1,
    "options": []
  }
}
```

`pendingItem` holds an item being configured (waiting for sub-option selection). Once configured, it moves to `items[]`.

**Why not a `cart_items` table:** Cart is ephemeral, tied to a conversation session. JSON in `cart_data` avoids extra tables and joins for transient data that's only read/written by one user at a time.

### 4. Interactive messages: Real list messages and buttons via WhatsApp Business App

**Choice:** Use Baileys' native interactive message support — `listMessage` for menus (up to 10 rows per section, multiple sections) and `buttonMessage` for simple choices (up to 3 buttons). The bot now targets WhatsApp Business App which supports these natively.

- **List messages** for: category selection, item selection within a category, protein choice, add-on selection
- **Button messages** for: "Agregar mas / Finalizar pedido", "Si / No" confirmations, "Omitir" for optional add-ons
- **Plain text** for: notes input, payment voucher prompt, admin commands, help responses

`sendListMessage` in `utils.ts` SHALL send actual Baileys `listMessage` objects instead of text fallbacks. A new `sendButtonMessage` helper SHALL be added.

**Input dual-handling:** The handler must accept input from both interactive responses (`listResponseMessage.singleSelectReply.selectedRowId`, `buttonsResponseMessage.selectedButtonId`) AND plain typed text. This means the input extraction in `handleMessage` already covers both cases — interactive responses map to the same `rowId`/`buttonId` strings that text-based numbered input would produce.

**Why revert from text-only:** The original text fallback was needed because regular WhatsApp accounts silently strip interactive messages. With WhatsApp Business App, interactive messages work and provide a much better UX — tappable buttons, scrollable lists, no typing needed.

**Limits to be aware of:**
- List messages: max 10 rows per section, max 10 sections, row title max 24 chars, description max 72 chars
- Button messages: max 3 buttons, button text max 20 chars
- Footer text: max 60 chars

### 5. Input handling: Normalize-first architecture

**Choice:** Create an `input.ts` module that normalizes and classifies all incoming text before the state machine routes it.

- `normalizeInput(text)`: trim, lowercase, strip accents (NFD decompose + strip combining marks)
- `parseCommand(normalized)`: returns `{type, value}` where type is one of: `number`, `keyword`, `text`
  - Keywords: `hola`, `menu`, `pedir`, `cancelar`, `ayuda`, `si`, `no`, `listo`
  - Numbers: `1`, `2`, `3`... (also match "x2", "2x" for quantity patterns)
- Global keyword intercepts happen before state routing: `hola`/`menu`/`pedir` → restart, `cancelar` → cancel order, `ayuda` → help text

**Why not regex-per-handler:** Centralizes all input parsing so every handler gets clean, pre-processed input. Prevents case-sensitivity bugs from creeping back in.

### 6. State machine: Add sub-option states, keep flat switch

**Choice:** Extend the existing flat switch/case with new states rather than introducing a hierarchical state machine.

New states:
- `CHOOSE_PROTEIN` — after selecting almuerzo, pick protein
- `CHOOSE_ADDONS` — after selecting desayuno, offer add-ons (optional, can skip)
- `CHOOSE_QUANTITY` — after item is fully configured, ask quantity

The flow becomes: `WELCOME → MENU → [CHOOSE_PROTEIN|CHOOSE_ADDONS] → CHOOSE_QUANTITY → CART_CONFIRM → NOTES → WAITING_FOR_VOUCHER`

Items without sub-options (truchas, carnes, bebidas, lacteos) skip directly from MENU to CHOOSE_QUANTITY.

**Why not a state machine library:** Only ~10 states total. A flat switch is readable and debuggable. Adding a dependency for this is unnecessary complexity on a Termux deployment.

### 7. Error recovery: Re-prompt with hint, never clear state on bad input

**Choice:** Every handler's "else" branch sends a helpful message that repeats the valid options, without calling `clearUserState()`. Only explicit "cancelar" keyword or completing an order clears state.

**Why:** The current behavior of clearing state on any unrecognized input forces users to restart their entire order. This is the #1 UX complaint. Re-prompting is standard for chatbot design.

### 8. Message tone: Warm template strings, no i18n system

**Choice:** Create a `messages.ts` module with all bot messages as template functions. Messages use Sesamo's brand voice: warm, informal Colombian Spanish, references to the finca setting.

Example: Welcome message includes the tagline "No es restaurante. Es que mama cocina rico." and mentions trucha as the specialty.

**Why not a full i18n system:** Single-language bot. Template functions are simple, type-safe, and easy to find/edit.

### 9. Admin `!pedidos` command: Stateless query, not a state transition

**Choice:** `!pedidos` queries pending orders and responds immediately without changing admin state. This means admin can use `!pedidos` at any point without disrupting their current flow.

Format: Lists pending orders with ID, customer phone (last 4 digits), item count, total, and time since creation.

**Why stateless:** Admin commands like `SI N`/`NO N` already work statelessly (matched by regex before state routing). `!pedidos` follows the same pattern for consistency.

## Risks / Trade-offs

- **[DB reset required]** Deleting `sesamo.db` loses any existing orders. -> Mitigation: Bot is pre-launch, no real order history exists. Document the reset step in deploy notes.
- **[Cart JSON complexity grows]** Cart now has nested options and pending items, making JSON parsing more fragile. -> Mitigation: Define a TypeScript interface for cart shape, validate on parse with fallback to empty cart.
- **[Message length limits]** WhatsApp has a ~65K character limit but long messages are hard to read on mobile. The full menu with 30+ items in one message may be unwieldy. -> Mitigation: Show menu by category — user first picks a category, then sees items in that category. Two-step menu browsing.
- **[Accent stripping edge cases]** Spanish has meaningful accents (e.g., "si" vs "si") but for bot input purposes, treating them as equivalent is correct — users rarely type accents on mobile keyboards.
- **[No automated tests]** The codebase has no test infrastructure. Changes are validated manually via WhatsApp. -> Mitigation: Keep changes focused and testable via manual QA. Adding tests is out of scope for this change.
- **[Interactive message limits]** List messages cap at 10 rows per section and 24-char titles. Some menu item names (e.g., "Lomo de cerdo con champiñones gratinado") exceed 24 chars. -> Mitigation: Abbreviate long names in list row titles, use description field for full name if needed. The Truchas category (9 items) and Carnes (8 items) each fit in a single section.
