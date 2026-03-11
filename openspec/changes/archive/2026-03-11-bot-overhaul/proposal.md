## Why

The WhatsApp bot for Finca Sésamo is functional but has critical usability issues that make it feel like a prototype rather than a production tool: the database contains placeholder hamburger products instead of the real menu (truchas, almuerzos, desayunos, bebidas, lácteos de cabra), input handling is strictly case-sensitive so customers typing "hola" or "HOLA" get error responses, error flows dump users into dead ends instead of guiding them back, and the conversation feels robotic rather than warm and inviting like the Sésamo brand. The menu also has a complex structure (categories with sub-options like protein choices for almuerzos, and breakfast add-ons) that the current flat product model cannot represent.

## What Changes

- **Replace entire product database** with the real Finca Sésamo menu from `sesamo-menu.html`: Desayunos (with add-ons), Almuerzos (with protein choice), Truchas (9 preparations), Carnes y Pollos (8 items), Bebidas (3 limonadas), and Lácteos de Cabra (queso + leche).
- **New DB schema for menu complexity**: Support categories, sub-options (protein choices for almuerzo), add-ons (caldo/changua for breakfast), and items that are standalone (truchas, carnes).
- **Case-insensitive input handling** across all user interactions — normalize input before matching against commands, numbers, and keywords.
- **Flexible keyword recognition**: Accept "hola", "menu", "pedir", "ayuda", "cancelar" etc. at any point, not just strict numeric responses.
- **Graceful error recovery**: Instead of clearing state and telling the user to start over, repeat the current step's prompt with a hint. Only reset on explicit "cancelar".
- **Professional conversation tone**: Warm, on-brand messages that reflect Sésamo's personality ("No es restaurante. Es que mamá cocina rico."). Include the restaurant's tagline in the welcome.
- **Order summary with item details**: Show sub-options chosen (e.g., "Almuerzo - Pechuga de pollo") not just the base product name.
- **Admin: view pending orders** — add `!pedidos` command to list all pending orders.
- **Quantity support**: Allow adding multiple of the same item (e.g., "2 limonadas") instead of adding one at a time.

## Capabilities

### New Capabilities
- `real-menu-schema`: New database schema and seed data representing Finca Sésamo's actual menu with categories, sub-options (protein choice), and add-ons
- `input-handling`: Case-insensitive, keyword-aware, flexible input parsing with natural language shortcuts (hola, menu, cancelar, ayuda)
- `conversation-ux`: Professional conversation flows with graceful error recovery, on-brand messaging, and clear prompts that always show available options
- `order-builder`: Cart/order building that supports sub-options (protein choice), add-ons, quantities, and detailed order summaries
- `admin-orders`: Admin command to view and manage pending orders list

### Modified Capabilities

(none — no existing specs)

## Impact

- **Database**: Complete schema change — `products` table replaced with `menu_items`, `item_options`, `order_items` tables. Existing `sesamo.db` will need to be deleted and re-seeded.
- **Handlers**: All handler functions rewritten to support new menu structure, flexible input, and error recovery.
- **State machine**: New steps for sub-option selection (e.g., CHOOSE_PROTEIN after selecting almuerzo).
- **Seed data**: ~30 real menu items instead of 4 placeholder hamburgers.
- **No dependency changes**: Still using sql.js, Baileys v6, same stack.
