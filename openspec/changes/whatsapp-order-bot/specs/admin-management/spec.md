## ADDED Requirements

### Requirement: Admin authentication
The system SHALL only allow authorized phone numbers (configured as admins) to trigger and interact with admin commands.

#### Scenario: Unauthorized user tries admin command
- **WHEN** a non-admin user sends `!admin`
- **THEN** system ignores the command and treats it as a normal message (fallback to general AI/unrecognized handler).

#### Scenario: Authorized user triggers admin command
- **WHEN** an admin user sends `!admin`
- **THEN** system responds with the admin control menu.

### Requirement: Display product management menu
The system SHALL display an interactive list of all products (both available and unavailable) when the admin requests to manage the menu.

#### Scenario: Admin opens management menu
- **WHEN** admin selects "Gestionar Menú" from the admin control menu
- **THEN** system fetches all products and displays them, indicating their current availability status.

### Requirement: Toggle product availability
The system SHALL update the database to toggle the `available` boolean flag of a selected product and confirm the change to the admin.

#### Scenario: Admin disables a product
- **WHEN** admin selects an currently available product from the management menu
- **THEN** system sets `available = false` in the database and replies "Producto desactivado correctamente".

#### Scenario: Admin enables a product
- **WHEN** admin selects a currently unavailable product from the management menu
- **THEN** system sets `available = true` in the database and replies "Producto activado correctamente".
