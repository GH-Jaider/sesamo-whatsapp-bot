## ADDED Requirements

### Requirement: Categories table
The system SHALL store menu categories in a `categories` table with columns: `id` (INTEGER PRIMARY KEY), `name` (TEXT NOT NULL), `display_order` (INTEGER NOT NULL), `description` (TEXT).

#### Scenario: Categories seeded on first run
- **WHEN** the bot starts and the database has no categories
- **THEN** the system seeds 6 categories in order: Desayunos, Almuerzos, Truchas, Carnes y Pollos, Bebidas, Lacteos de Cabra

### Requirement: Menu items table
The system SHALL store menu items in a `menu_items` table with columns: `id` (INTEGER PRIMARY KEY AUTOINCREMENT), `category_id` (INTEGER NOT NULL REFERENCES categories), `name` (TEXT NOT NULL), `description` (TEXT), `price` (INTEGER NOT NULL, in Colombian pesos), `available` (INTEGER DEFAULT 1), `display_order` (INTEGER NOT NULL).

#### Scenario: All real menu items seeded
- **WHEN** the bot starts and the database has no menu items
- **THEN** the system seeds all items from the Sesamo menu: 1 desayuno ($18,000), 1 almuerzo ($35,000), 9 truchas ($40,000-$52,000), 8 carnes y pollos ($40,000-$50,000), 3 bebidas ($10,000-$15,000), 2 lacteos ($11,000-$30,000)

#### Scenario: Menu item has availability flag
- **WHEN** an admin toggles a menu item's availability
- **THEN** that item SHALL not appear in the customer-facing menu

### Requirement: Item options table
The system SHALL store item options in an `item_options` table with columns: `id` (INTEGER PRIMARY KEY AUTOINCREMENT), `menu_item_id` (INTEGER NOT NULL REFERENCES menu_items), `option_group` (TEXT NOT NULL), `name` (TEXT NOT NULL), `price` (INTEGER NOT NULL DEFAULT 0), `display_order` (INTEGER NOT NULL).

#### Scenario: Almuerzo protein options seeded
- **WHEN** the bot starts and the database has no item options
- **THEN** the system seeds 4 protein options for the almuerzo item with option_group "proteina": Pechuga de pollo, Pierna pernil, Lomo de cerdo, Carne de res — all with price 0 (included in almuerzo price)

#### Scenario: Desayuno add-on options seeded
- **WHEN** the bot starts and the database has no item options
- **THEN** the system seeds 2 add-on options for the desayuno item with option_group "adicional": Caldo de Costilla ($14,000), Changua ($12,000)

### Requirement: Order items table
The system SHALL store order line items in an `order_items` table with columns: `id` (INTEGER PRIMARY KEY AUTOINCREMENT), `order_id` (INTEGER NOT NULL REFERENCES orders), `menu_item_id` (INTEGER NOT NULL), `item_name` (TEXT NOT NULL), `item_price` (INTEGER NOT NULL), `quantity` (INTEGER NOT NULL DEFAULT 1), `options_json` (TEXT) — where `options_json` stores chosen options as a JSON array of `{name, price}`.

#### Scenario: Order items persisted with denormalized data
- **WHEN** a customer completes an order with 2x Almuerzo (Pechuga) and 1x Limonada Natural
- **THEN** the system creates 2 rows in `order_items`: one with item_name "Menu de la Casa", quantity 2, options_json containing Pechuga de pollo; one with item_name "Limonada Natural", quantity 1, options_json as empty array

### Requirement: Old products table removed
The system SHALL NOT have a `products` table. The old `products` table and its seed data (placeholder hamburgers) SHALL be completely removed from the codebase.

#### Scenario: Clean schema with no legacy tables
- **WHEN** the database is initialized fresh
- **THEN** only these tables exist: `categories`, `menu_items`, `item_options`, `orders`, `order_items`, `user_states`
