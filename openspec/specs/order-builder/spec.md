## ADDED Requirements

### Requirement: Pending item workflow for sub-options
The system SHALL support a "pending item" in the cart that holds an item being configured. When a customer selects a menu item that has options (e.g., almuerzo with protein choice), the item SHALL be stored as `pendingItem` in cart data until all required options are chosen, then moved to `items[]`.

#### Scenario: Almuerzo requires protein before adding to cart
- **WHEN** a customer selects "Menu de la Casa" (almuerzo)
- **THEN** the system stores it as pendingItem and transitions to CHOOSE_PROTEIN state, presenting the 4 protein options as an interactive list

#### Scenario: Protein chosen completes pending item
- **WHEN** a customer selects "Pechuga de pollo" in CHOOSE_PROTEIN state
- **THEN** the system adds the protein as an option on the pendingItem and transitions to CHOOSE_QUANTITY state

### Requirement: Optional add-ons workflow
The system SHALL support optional add-ons that a customer can accept or skip. Add-ons (option_group "adicional") SHALL be presented after the base item is selected, with a skip option.

#### Scenario: Desayuno offers optional add-ons
- **WHEN** a customer selects "Desayuno Tradicional Sesamo"
- **THEN** the system transitions to CHOOSE_ADDONS state and presents available add-ons (Caldo de Costilla $14,000, Changua $12,000) with a "Sin adicionales" skip button

#### Scenario: Customer adds an add-on
- **WHEN** a customer selects "Caldo de Costilla" in CHOOSE_ADDONS state
- **THEN** the system adds the add-on as a separate cart item with its own price and transitions to CHOOSE_QUANTITY for the base desayuno item

#### Scenario: Customer skips add-ons
- **WHEN** a customer taps "Sin adicionales" in CHOOSE_ADDONS state
- **THEN** the system skips add-ons and transitions to CHOOSE_QUANTITY for the desayuno item

### Requirement: Quantity selection
The system SHALL ask the customer for quantity after an item is fully configured (all required options chosen). The CHOOSE_QUANTITY state SHALL accept a number (1-10) and default to 1 if the customer sends "1" or taps a "Solo 1" button.

#### Scenario: Customer sets quantity to 3
- **WHEN** a customer is in CHOOSE_QUANTITY state and sends "3"
- **THEN** the system sets the pending item's quantity to 3, calculates the line total, moves it to cart items[], and transitions to CART_CONFIRM

#### Scenario: Default quantity of 1
- **WHEN** a customer is in CHOOSE_QUANTITY state and taps "Solo 1" button
- **THEN** the system sets quantity to 1, moves pending item to cart items[], and transitions to CART_CONFIRM

#### Scenario: Quantity exceeds limit
- **WHEN** a customer is in CHOOSE_QUANTITY state and sends "25"
- **THEN** the system re-prompts with "La cantidad maxima por item es 10" and remains in CHOOSE_QUANTITY state

### Requirement: Cart confirmation with add-more or finalize
The system SHALL show the updated cart summary after each item is added and present two options: add another item or finalize the order. This SHALL use button messages.

#### Scenario: Cart summary after adding item
- **WHEN** a customer adds "Trucha a la plancha x2" to a cart that already has "Limonada Natural x1"
- **THEN** the system shows: "1x Limonada Natural — $10.000 / 2x Trucha a la plancha — $80.000 / Subtotal: $90.000" with buttons "Agregar mas" and "Finalizar pedido"

#### Scenario: Customer adds more items
- **WHEN** a customer taps "Agregar mas" in CART_CONFIRM state
- **THEN** the system transitions back to CATEGORY_SELECT state to browse the menu again

#### Scenario: Customer finalizes order
- **WHEN** a customer taps "Finalizar pedido" in CART_CONFIRM state
- **THEN** the system transitions to NOTES state

### Requirement: Items without options skip to quantity
Menu items that have no item_options (truchas, carnes, bebidas, lacteos) SHALL skip sub-option states and go directly from MENU to CHOOSE_QUANTITY.

#### Scenario: Trucha selected goes to quantity
- **WHEN** a customer selects "Trucha a la plancha" from the Truchas category
- **THEN** the system skips CHOOSE_PROTEIN and CHOOSE_ADDONS, goes directly to CHOOSE_QUANTITY

### Requirement: Cart item line total includes options
Each cart item's total price SHALL be calculated as: `(item_price + sum of option prices) * quantity`. Add-on items are separate cart entries with their own price and quantity.

#### Scenario: Almuerzo with included protein
- **WHEN** a customer adds 2x Almuerzo with Pechuga de pollo (protein price = $0)
- **THEN** the line total is (35,000 + 0) * 2 = $70,000

#### Scenario: Desayuno plus paid add-on
- **WHEN** a customer adds 1x Desayuno ($18,000) and 1x Caldo de Costilla add-on ($14,000)
- **THEN** the cart shows two separate items: "1x Desayuno Tradicional Sesamo — $18,000" and "1x Caldo de Costilla — $14,000", subtotal $32,000
