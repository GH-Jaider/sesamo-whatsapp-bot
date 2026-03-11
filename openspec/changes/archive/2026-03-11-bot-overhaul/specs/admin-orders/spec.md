## ADDED Requirements

### Requirement: List pending orders command
The system SHALL support an `!pedidos` admin command that lists all orders with status "PENDING". The command SHALL be stateless — it responds immediately without changing the admin's current state.

#### Scenario: Admin views pending orders
- **WHEN** the admin sends "!pedidos" and there are 3 pending orders
- **THEN** the system responds with a formatted list showing each order's ID, customer phone (last 4 digits for privacy), item count, total amount, and time elapsed since creation

#### Scenario: No pending orders
- **WHEN** the admin sends "!pedidos" and there are no pending orders
- **THEN** the system responds with "No hay pedidos pendientes."

#### Scenario: Non-admin tries !pedidos
- **WHEN** a non-admin user sends "!pedidos"
- **THEN** the system responds with "No tienes permisos de administrador."

### Requirement: Order detail in admin notifications
When a new order is submitted, the admin notification SHALL include detailed item information: item names with chosen sub-options, quantities, line totals, overall total, and advance amount. This replaces the current flat product list.

#### Scenario: Admin receives order with sub-options
- **WHEN** a customer submits an order with 2x Almuerzo (Pechuga de pollo) and 1x Caldo de Costilla
- **THEN** the admin receives a message showing:
  - "2x Menu de la Casa (Pechuga de pollo) — $70.000"
  - "1x Caldo de Costilla — $14.000"
  - "Total: $84.000"
  - "Anticipo (50%): $42.000"
  - Along with the payment voucher image

### Requirement: Admin menu management with new schema
The admin `!admin` menu management SHALL work with the new `menu_items` table instead of the old `products` table. The admin SHALL be able to toggle item availability.

#### Scenario: Admin toggles item availability
- **WHEN** the admin selects a menu item in the management interface
- **THEN** the system toggles the item's `available` field in `menu_items` and confirms the change
