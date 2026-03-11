## ADDED Requirements

### Requirement: Welcome message with brand identity
The system SHALL send a welcome message that includes Sesamo's tagline ("No es restaurante. Es que mama cocina rico."), mentions trucha as the specialty, and presents the main options via an interactive list message. The tone SHALL be warm, informal Colombian Spanish.

#### Scenario: First-time customer greeting
- **WHEN** a new customer sends any message and has no existing state
- **THEN** the system sends a welcome message with the Sesamo tagline, a brief description of the restaurant, and an interactive list with options: "Hacer un pedido" and "Informacion"

#### Scenario: Returning customer greeting
- **WHEN** a customer with no active state sends "hola"
- **THEN** the system sends the same welcome message as a first-time customer

### Requirement: Two-step menu browsing by category
The system SHALL present the menu in two steps: first show categories as an interactive list, then show items within the selected category as a second interactive list. This prevents overwhelming the user with 24+ items in a single message.

#### Scenario: Customer views category list
- **WHEN** a customer chooses "Hacer un pedido"
- **THEN** the system sends an interactive list with 6 categories: Desayunos, Almuerzos, Truchas, Carnes y Pollos, Bebidas, Lacteos de Cabra — each with a brief description

#### Scenario: Customer selects a category
- **WHEN** a customer selects "Truchas" from the category list
- **THEN** the system sends an interactive list with all available trucha items showing name and price

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

### Requirement: Graceful error recovery with re-prompt
The system SHALL NOT clear user state on unrecognized input. Instead, it SHALL re-send the current prompt with a brief hint about valid options. State SHALL only be cleared on explicit "cancelar" keyword or order completion.

#### Scenario: Invalid input during menu browsing
- **WHEN** a customer sends "asdf" while in the MENU state
- **THEN** the system sends a message like "No entendi esa opcion" followed by re-displaying the current category list or menu

#### Scenario: Invalid input during protein selection
- **WHEN** a customer sends "pizza" while in CHOOSE_PROTEIN state
- **THEN** the system re-sends the protein options list with a hint message

### Requirement: Order summary before payment
The system SHALL display a detailed order summary before requesting payment. The summary SHALL include each item with its sub-options, quantity, line total, the overall total, the 50% advance amount, and the Nequi number.

#### Scenario: Summary with sub-options
- **WHEN** a customer finalizes an order with 2x Almuerzo (Pechuga de pollo) and 1x Limonada Natural
- **THEN** the summary shows:
  - "2x Menu de la Casa (Pechuga de pollo) — $70.000"
  - "1x Limonada Natural — $10.000"
  - "Total: $80.000"
  - "Anticipo (50%): $40.000"

### Requirement: Cancellation confirmation
The system SHALL confirm cancellation when a user sends "cancelar", clear their state, and offer to restart.

#### Scenario: User cancels mid-order
- **WHEN** a user sends "cancelar" while they have items in cart
- **THEN** the system clears their state and sends "Pedido cancelado. Cuando quieras, escribe *hola* para empezar de nuevo."

### Requirement: Help message
The system SHALL respond to "ayuda" with a help message listing available commands and a brief explanation of the ordering process, without changing the user's current state.

#### Scenario: Help during active order
- **WHEN** a user sends "ayuda" while in CART_CONFIRM state
- **THEN** the system sends help text and the user remains in CART_CONFIRM state with their cart intact
