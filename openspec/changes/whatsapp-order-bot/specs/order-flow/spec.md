## ADDED Requirements

### Requirement: Welcome menu
The system SHALL display a welcome message and a main menu when a user initiates a conversation or sends a generic greeting.

#### Scenario: User sends a greeting
- **WHEN** user sends "Hola" or starts the chat
- **THEN** system responds with a welcome message and interactive options for "Hacer un pedido" or "Ver información".

### Requirement: Display available menu
The system SHALL present the list of available products fetched from the database, grouped by categories, when the user chooses to make an order.

#### Scenario: User requests to make an order
- **WHEN** user selects "Hacer un pedido"
- **THEN** system queries the database for products where `available = true` and sends them as an interactive list to the user.

### Requirement: Collect order items
The system SHALL allow the user to select one or multiple items from the menu list and ask for confirmation.

#### Scenario: User selects items
- **WHEN** user selects items from the interactive list and submits
- **THEN** system calculates the subtotal, lists the chosen items, and asks the user if they want to add anything else or proceed to checkout.

### Requirement: Collect special notes
The system SHALL prompt the user for special instructions or dietary restrictions before finalizing the cart.

#### Scenario: User provides special notes
- **WHEN** user confirms their cart items
- **THEN** system asks for special instructions (e.g., "Sin cebolla" or "Ninguna").

#### Scenario: User skips special notes
- **WHEN** user responds with "Ninguna" or skips
- **THEN** system proceeds directly to the payment calculation step.

### Requirement: Request payment voucher
The system SHALL calculate the required advance payment (50% of the total) and ask the user to send a Nequi transfer voucher image.

#### Scenario: Presenting the total and payment instructions
- **WHEN** the cart and notes are finalized
- **THEN** system displays the total cost, calculates the 50% advance, provides the Nequi number, and instructs the user to send the payment screenshot.
