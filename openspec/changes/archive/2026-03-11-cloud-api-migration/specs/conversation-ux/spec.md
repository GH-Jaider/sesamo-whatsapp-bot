## MODIFIED Requirements

### Requirement: Interactive list messages for selections
The system SHALL use WhatsApp Cloud API interactive list messages for all menu browsing and option selection. Each list row SHALL have a `title` (max 24 chars), optional `description` (max 72 chars), and an `id` that maps to the item's database ID. Lists SHALL be sent via the Graph API interactive message format with `type: "list"`.

#### Scenario: List message with category items
- **WHEN** the system presents items in the "Truchas" category
- **THEN** the list message contains rows with trucha names as titles, prices in the description, and menu_item IDs as row IDs, sent as a Cloud API interactive list message

### Requirement: Button messages for binary/ternary choices
The system SHALL use WhatsApp Cloud API interactive reply button messages for prompts with 2-3 choices: cart actions (add more / finalize), optional add-on prompt (add / skip), and confirmations. Buttons SHALL be sent via the Graph API interactive message format with `type: "button"`.

#### Scenario: Cart action buttons after adding item
- **WHEN** a customer adds an item to their cart
- **THEN** the system sends a Cloud API interactive button message with "Agregar mas" and "Finalizar pedido" reply buttons

#### Scenario: Add-on prompt with skip option
- **WHEN** a customer selects a desayuno item
- **THEN** the system sends a Cloud API interactive button message listing available add-ons with a "Sin adicionales" skip button
