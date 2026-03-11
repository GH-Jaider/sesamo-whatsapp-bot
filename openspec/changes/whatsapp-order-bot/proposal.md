## Why

El restaurante Sésamo necesita una forma eficiente de gestionar pedidos y reservas para turistas y clientes de la zona, sin sobrecargar operativamente a la chef (la mamá del dueño). Un bot de WhatsApp automatizará la recepción de pedidos, validará transferencias Nequi para pagos anticipados (50%) requeridos para confirmar el pedido, y permitirá administrar el menú de forma sencilla y natural, todo desde una interfaz que la familia ya usa a diario.

## What Changes

- Creación de un bot de WhatsApp interactivo (botones y listas) para los clientes del restaurante.
- Flujo automatizado para mostrar el menú (filtrado por disponibilidad), recolectar el pedido y consultar por notas adicionales para la chef.
- Proceso de pago anticipado (50% del total) a través de Nequi, donde el cliente envía la captura del comprobante al bot.
- Sistema de validación manual: el bot reenvía el comprobante al WhatsApp personal de la administradora para su aprobación (SÍ o NO).
- Modo Administrador integrado: un menú especial accesible por comando (ej. `!admin`) para administradores autorizados que permite encender o apagar la disponibilidad de platos del menú sin necesidad de salir de WhatsApp.
- Implementación técnica basada en Node.js usando la librería `@whiskeysockets/baileys` para bajo consumo de recursos (correrá en una PC local inicialmente).
- Uso de SQLite para almacenamiento de la base de datos (menú y estado de los pedidos), manteniéndolo ligero y 100% open source.

## Capabilities

### New Capabilities
- `order-flow`: Interacción con clientes para mostrar menú, notas, total a pagar y recepción de voucher.
- `admin-management`: Modo administrador protegido para modificar disponibilidad del inventario desde WhatsApp de forma interactiva.
- `payment-validation`: Mecanismo de reenvío de imágenes de voucher al admin, captura de respuesta de aprobación y notificación de cierre al cliente.

### Modified Capabilities
Ninguna.

## Impact

- Creación de un nuevo proyecto Node.js/TypeScript.
- Introducción de una base de datos local SQLite (`sesamo.db`) para manejar productos y pedidos.
- Dependencia de la conexión a WhatsApp mediante sockets (`@whiskeysockets/baileys`).
- Requerirá que un proceso de Node.js se mantenga en ejecución constante (24/7) en un equipo local o mini-PC.