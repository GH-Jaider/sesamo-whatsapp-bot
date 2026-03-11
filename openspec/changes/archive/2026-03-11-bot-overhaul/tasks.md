## 1. Database Schema & Seed Data

- [x] 1.1 Replace `products` table with `categories`, `menu_items`, `item_options` tables in `db/index.ts` — create all three tables with correct columns and foreign keys
- [x] 1.2 Add `order_items` table to the schema (id, order_id, menu_item_id, item_name, item_price, quantity, options_json)
- [x] 1.3 Write new `seedDb()` function that populates all 6 categories, ~24 menu items, 4 protein options for almuerzo, and 2 add-on options for desayuno — all data from `sesamo-menu.html`
- [x] 1.4 Delete `data/sesamo.db` so the bot re-seeds on next start

## 2. Input Handling Module

- [x] 2.1 Create `src/input/index.ts` with `normalizeInput(text)` — trim, lowercase, strip accents via NFD decomposition
- [x] 2.2 Add `parseCommand(normalized)` that classifies input as `number`, `keyword`, or `text` — keywords: hola, menu, pedir, cancelar, ayuda, si, no, listo
- [x] 2.3 Add quantity pattern parsing: recognize "x2", "2x", plain "2" as quantity=2

## 3. Message Templates

- [x] 3.1 Create `src/messages/index.ts` with all bot message template functions using warm Sesamo brand voice
- [x] 3.2 Include: welcome message (with tagline), category list intro, item list intro, protein prompt, add-on prompt, quantity prompt, cart summary, order receipt, payment request, cancellation, help, error re-prompts

## 4. WhatsApp Utils — Interactive Messages

- [x] 4.1 Update `sendListMessage` in `whatsapp/utils.ts` to send real Baileys `listMessage` objects instead of text fallback
- [x] 4.2 Add `sendButtonMessage` helper that sends Baileys button messages (up to 3 buttons)
- [x] 4.3 Ensure `handleMessage` input extraction handles `listResponseMessage`, `buttonsResponseMessage`, and plain text

## 5. State Machine & Handler Rewrite

- [x] 5.1 Add new states to the state machine: `CATEGORY_SELECT`, `ITEM_SELECT`, `CHOOSE_PROTEIN`, `CHOOSE_ADDONS`, `CHOOSE_QUANTITY`
- [x] 5.2 Implement global keyword intercepts in `handleMessage` — hola/menu/pedir restart, cancelar clears state, ayuda sends help (before state routing)
- [x] 5.3 Rewrite `handleWelcome` — send branded welcome with interactive list (Hacer pedido / Informacion)
- [x] 5.4 Add `handleCategorySelect` — query categories from DB, send interactive list of available categories
- [x] 5.5 Add `handleItemSelect` — query menu_items by category_id, send interactive list of items with prices
- [x] 5.6 Add `handleChooseProtein` — query item_options where option_group="proteina", send interactive list
- [x] 5.7 Add `handleChooseAddons` — query item_options where option_group="adicional", send button message with add-ons + "Sin adicionales" skip
- [x] 5.8 Add `handleChooseQuantity` — accept number 1-10, move pendingItem to cart items[], transition to CART_CONFIRM
- [x] 5.9 Rewrite `handleCartConfirm` — show cart summary, use button messages for "Agregar mas" / "Finalizar pedido"
- [x] 5.10 Rewrite `handleNotes` — same flow, warm messaging
- [x] 5.11 Rewrite `handlePayment` — save order with `order_items` rows (denormalized names, options_json), forward detailed summary to admin
- [x] 5.12 Implement error recovery in every handler — re-prompt on bad input instead of clearing state

## 6. Admin Commands

- [x] 6.1 Add `!pedidos` command — query pending orders, show formatted list (order ID, last 4 digits of phone, item count, total, time elapsed)
- [x] 6.2 Update admin menu management to use `menu_items` table instead of `products`
- [x] 6.3 Update order approval/rejection notification to include detailed item list with sub-options

## 7. Cleanup & Type Safety

- [x] 7.1 Remove all references to old `Product` interface and `products` table queries
- [x] 7.2 Define TypeScript interfaces: `CartItem`, `CartData`, `MenuItem`, `ItemOption`, `Category`
- [x] 7.3 Verify `tsc --noEmit` passes with zero errors
- [x] 7.4 Verify `pnpm run lint` passes with zero errors
