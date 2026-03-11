## Context

Sésamo requiere un sistema automatizado para la toma de pedidos vía WhatsApp. Al ser un entorno donde la administradora (la chef) ya tiene una carga de trabajo alta, la interacción con el sistema debe ser tan natural como chatear. Técnicamente, el sistema correrá en un entorno local (una PC o eventualmente una Raspberry Pi) con recursos limitados. Esto descarta herramientas que dependan de navegadores sin interfaz (headless browsers) muy pesados.

## Goals / Non-Goals

**Goals:**
- Implementar un bot de WhatsApp interactivo (con botones y listas desplegables).
- Mantener el consumo de memoria RAM y CPU bajo.
- Habilitar una interfaz de administración tipo "chat" para la dueña del negocio, que valide pedidos y gestione el menú sin salir de la app.
- Registrar persistencia local de los productos y estados de los pedidos usando SQLite.

**Non-Goals:**
- No se construirá un panel de administración web externo (dashboard). Todo el control será vía WhatsApp.
- No habrá integraciones directas con pasarelas de pago o APIs bancarias (el proceso de Nequi es mediante revisión manual de capturas de pantalla).
- No se utilizarán servicios en la nube de pago para bases de datos; todo se mantendrá local y open source.

## Decisions

1. **Librería de WhatsApp:** Se usará `@whiskeysockets/baileys` en lugar de `whatsapp-web.js`.
   - *Razón:* `baileys` se conecta directamente a través de WebSockets imitando la app web, sin necesidad de levantar una instancia completa de Chromium/Puppeteer. Esto reduce radicalmente el consumo de recursos, habilitando la opción de correrlo 24/7 en hardware pequeño como una Mini-PC o una Raspberry Pi.
2. **Base de Datos:** Se utilizará `SQLite`.
   - *Razón:* Mejor manejo de concurrencia que un archivo JSON plano (si varios clientes chatean al tiempo). Permite consultas SQL limpias y la estructura necesaria para tablas de `products`, `orders` y `user_states`.
3. **Manejo de Estado (State Machine):** Se implementará un manejador de estado en base de datos.
   - *Razón:* Como los usuarios avanzan por un flujo (Inicio -> Menú -> Notas -> Pago -> Espera Aprobación), el bot necesita recordar en qué paso está cada número. Guardar esto en SQLite previene que un reinicio del servidor borre el progreso de los clientes a mitad de un pedido.
4. **Mensajes Interactivos (Listas y Botones):** Se priorizará la UI nativa de WhatsApp.
   - *Razón:* Mejora significativamente la experiencia del usuario (UX). Se implementará un "fallback" a texto plano (ej: "Envía 1 para...") como mecanismo de seguridad en caso de que Meta/Facebook realice cambios en el protocolo que temporalmente rompan las UI interactivas en librerías de terceros.

## Risks / Trade-offs

- **[Riesgo] Protocolo de WhatsApp cambiante:** Meta constantemente actualiza la web API, lo que puede "romper" librerías no oficiales como `baileys` por un par de días hasta que la comunidad lanza un parche.
  - *Mitigación:* Usar siempre versiones fijas en el `package.json` y actualizar controladamente. Diseñar la lógica de mensajes con un fallback automático a menús de texto si falla el envío de botones interactivos.
- **[Riesgo] Baneo del número:** Meta puede detectar comportamiento anómalo (envío masivo de mensajes) y suspender el número.
  - *Mitigación:* El bot solo debe responder a interacciones iniciadas por el usuario (mensajes entrantes) y mantener un ritmo de respuesta humano (quizás con delays simulados de 1-2 segundos si es necesario). Se usará un número de teléfono exclusivo para el bot, aislando el número personal.
- **[Riesgo] Pérdida de estado de los clientes en reinicios:** Si el bot se cae mientras alguien hace un pedido.
  - *Mitigación:* El estado de cada chat se persistirá en la tabla SQLite, de modo que al arrancar, el bot sepa si un cliente estaba pendiente de subir una captura de pantalla y pueda retomarlo.