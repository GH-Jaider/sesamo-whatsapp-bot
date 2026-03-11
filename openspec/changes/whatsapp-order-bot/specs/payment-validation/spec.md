## ADDED Requirements

### Requirement: Handle voucher image receipt
The system SHALL detect when a user sends an image while in the "WAITING_FOR_VOUCHER" state and forward it to the configured admin number.

#### Scenario: User sends the voucher
- **WHEN** user is in "WAITING_FOR_VOUCHER" state and sends an image message
- **THEN** system downloads the image, forwards it to the admin with order details (Order ID, Items, Total, Advance), and tells the user "Comprobante recibido, esperando confirmación de la chef."

### Requirement: Process admin approval or rejection
The system SHALL provide the admin with an option (buttons or simple text match) to approve ("SÍ") or reject ("NO") the received voucher for a specific order.

#### Scenario: Admin approves the voucher
- **WHEN** admin responds with "SÍ" to a forwarded voucher
- **THEN** system updates the order state to `APPROVED`, notifies the customer "¡Pago confirmado! Tu pedido ya se está preparando", and notifies the admin "Pedido #X aprobado."

#### Scenario: Admin rejects the voucher
- **WHEN** admin responds with "NO" to a forwarded voucher
- **THEN** system updates the order state to `REJECTED`, notifies the customer "Lo sentimos, hubo un problema con la validación de tu pago. Por favor contáctanos", and notifies the admin "Pedido #X rechazado."
