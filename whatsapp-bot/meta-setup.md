# Setup de WhatsApp Cloud API con Meta

Guia paso a paso para conectar el bot de Sesamo con la WhatsApp Cloud API.

---

## 1. Crear una cuenta de Meta Business

Si ya tienes una, salta al paso 2.

1. Ve a https://business.facebook.com
2. Click en **Crear cuenta**
3. Ingresa el nombre del negocio: **Finca Sesamo** (o el que quieras)
4. Completa la verificacion con tu email y telefono

---

## 2. Crear una app en Meta Developers

1. Ve a https://developers.facebook.com
2. Click en **My Apps** (arriba a la derecha)
3. Click en **Create App**
4. Selecciona tipo: **Business**
5. Nombre de la app: `sesamo-bot` (o el que quieras)
6. Selecciona tu Business Account de Meta
7. Click en **Create App**

---

## 3. Agregar el producto WhatsApp a la app

1. En el dashboard de tu app, busca **WhatsApp** en la lista de productos
2. Click en **Set Up**
3. Esto te lleva a **WhatsApp > Getting Started**

---

## 4. Obtener el Phone Number ID

1. Ve a **WhatsApp > API Setup** en el menu lateral
2. Ahi vas a ver una seccion **From** con un numero de telefono de prueba que Meta te asigna
3. El **Phone Number ID** aparece debajo del numero — es un string numerico largo (ej: `109876543210987`)
4. Copia este valor — va en `WA_PHONE_NUMBER_ID` en tu `.env`

> **Nota:** Este es el numero de prueba de Meta. Para usar tu propio numero de
> WhatsApp Business, debes agregarlo en **WhatsApp > API Setup > Add phone
> number** y verificarlo con un codigo SMS/llamada. Pero para probar, el numero
> de prueba funciona bien.

---

## 5. Obtener un Access Token permanente

El token temporal que Meta te da en API Setup expira en 24 horas. Para produccion necesitas uno permanente:

### 5a. Crear un System User

1. Ve a https://business.facebook.com/settings/system-users
2. Click en **Add** para crear un System User
3. Nombre: `sesamo-bot`
4. Rol: **Admin**
5. Click en **Create System User**

### 5b. Asignar permisos al System User

1. Click en el System User que creaste
2. Click en **Add Assets**
3. Selecciona **Apps** en el panel izquierdo
4. Encuentra tu app `sesamo-bot` y activala
5. Activa **Full Control** (control total)
6. Click en **Save Changes**

### 5c. Generar el token permanente

1. Click en **Generate New Token**
2. Selecciona tu app `sesamo-bot`
3. En la lista de permisos, activa estos:
   - `whatsapp_business_management`
   - `whatsapp_business_messaging`
4. Click en **Generate Token**
5. **Copia el token inmediatamente** — no se vuelve a mostrar
6. Este valor va en `WA_ACCESS_TOKEN` en tu `.env`

---

## 6. Configurar el .env

```bash
cd whatsapp-bot
cp .env.template .env
nano .env
```

Llena estos valores:

```env
# Los que acabas de obtener de Meta:
WA_PHONE_NUMBER_ID="109876543210987"    # <-- tu Phone Number ID real
WA_ACCESS_TOKEN="EAAxxxxxxx..."          # <-- tu token permanente
WA_VERIFY_TOKEN="sesamo-2026-secreto"    # <-- inventate cualquier string

# Config del bot:
ADMIN_PHONE="573143371953"               # <-- tu numero (codigo pais + numero, sin +)
NEQUI_NUMBER="573143371953"              # <-- numero Nequi para pagos
```

> `WA_VERIFY_TOKEN` es un string que tu inventas. Puede ser cualquier cosa.
> Lo importante es que sea el mismo valor que pongas en Meta cuando configures
> el webhook (paso 8).

---

## 7. Exponer el bot con Cloudflare Tunnel

Meta necesita una URL publica HTTPS para enviar mensajes al bot via webhook.
Cloudflare Tunnel crea un tunel seguro desde internet hasta tu servidor local.

### Opcion A: Quick tunnel (para probar rapido)

```bash
# Primero arranca el bot:
pnpm start

# En otra terminal, crea un tunel temporal:
cloudflared tunnel --url http://localhost:3000
```

Esto imprime algo como:
```
https://random-words-here.trycloudflare.com
```

Copia esa URL. Es temporal — cambia cada vez que lo corres.

### Opcion B: Tunnel permanente (para produccion)

Ver la seccion de Cloudflare Tunnel en `deploy.md` para configurar un tunel
con dominio fijo.

---

## 8. Configurar el Webhook en Meta

Este es el paso que conecta Meta con tu bot.

1. Ve a **WhatsApp > Configuration** en el dashboard de tu app en Meta
   (https://developers.facebook.com > tu app > WhatsApp > Configuration)

2. En la seccion **Webhook**, click en **Edit**

3. Llena los campos:
   - **Callback URL**: `https://<tu-url-de-cloudflare>/webhook`
     - Ejemplo: `https://random-words-here.trycloudflare.com/webhook`
   - **Verify Token**: el mismo string que pusiste en `WA_VERIFY_TOKEN` en tu `.env`
     - Ejemplo: `sesamo-2026-secreto`

4. Click en **Verify and Save**
   - Si tu bot esta corriendo y el tunnel esta activo, Meta va a hacer un
     `GET /webhook` con tu verify token
   - Si todo esta bien, va a decir **Verified** con un check verde
   - Si falla: revisa que el bot este corriendo, que el tunnel este activo,
     y que el verify token sea identico

5. Despues de verificar, busca la seccion **Webhook Fields** abajo
6. Suscribete al campo **messages** — click en **Subscribe**
   - Este es el unico campo que necesitamos. Es el que envia los mensajes
     de WhatsApp al bot.

---

## 9. Agregar numeros de prueba (sandbox)

Con el numero de prueba de Meta, solo puedes enviar mensajes a numeros
que esten registrados como "testers":

1. Ve a **WhatsApp > API Setup**
2. En la seccion **To**, click en **Manage phone number list**
3. Agrega tu numero de telefono personal (con codigo de pais)
4. Te llega un codigo de verificacion por WhatsApp — ingresalo

Ahora puedes enviarle mensajes al numero de prueba de Meta desde tu telefono.

---

## 10. Crear template para notificaciones al admin (OBLIGATORIO)

La Cloud API de WhatsApp solo permite enviar mensajes a alguien que te
escribio en las ultimas 24 horas. Para notificar al admin de nuevos pedidos
sin que el admin tenga que estar escribiendo al bot todo el tiempo, necesitas
un **message template** aprobado por Meta.

1. Ve a **WhatsApp > Message Templates** en el dashboard de tu app
2. Click en **Create Template**
3. Configuracion:
   - **Category**: `Utility`
   - **Name**: `nuevo_pedido`
   - **Language**: `Spanish (es)`
4. En el **Body**, escribe:
   ```
   Nuevo pedido #{{1}} recibido. Revisa los detalles a continuacion.
   ```
   (El `{{1}}` es una variable — ahi va el numero de pedido)
5. Click en **Submit**
6. Espera la aprobacion — los templates de tipo Utility suelen aprobarse
   en segundos o minutos

> **Sin este template, el admin no recibe notificaciones de pedidos nuevos.**
> El bot envia el template primero (que abre la ventana de conversacion) y
> luego envia la imagen del comprobante + los detalles del pedido.

---

## 11. Probar que todo funciona

1. Asegurate de que el bot este corriendo:
   ```bash
   cd whatsapp-bot
   pnpm start
   # Debe decir: "Server listening on port 3000"
   ```

2. Asegurate de que el tunnel este activo (si usas quick tunnel):
   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```

3. Desde tu telefono, abre WhatsApp y envia **"hola"** al numero de prueba de Meta
   (o al numero de WhatsApp Business si ya lo configuraste)

4. El bot debe responder con el mensaje de bienvenida de Sesamo

5. Si no responde, revisa:
   - Que la terminal del bot muestre `[webhook] message from=...`
     (si no sale nada, el webhook no esta llegando — revisa tunnel y config de Meta)
   - Que no haya errores de `[Graph API]` en la terminal
     (si los hay, revisa el access token)

---

## 12. Pasar a produccion (numero propio)

Cuando todo funcione con el numero de prueba:

1. Ve a **WhatsApp > API Setup**
2. Click en **Add phone number**
3. Ingresa tu numero de WhatsApp Business
4. Verificalo con SMS o llamada
5. Actualiza `WA_PHONE_NUMBER_ID` en `.env` con el nuevo Phone Number ID
6. Reinicia el bot

> **Importante:** El numero que uses para el bot no puede estar registrado
> en WhatsApp normal al mismo tiempo. Si ya lo usas en WhatsApp personal,
> vas a tener que migrarlo a WhatsApp Business o usar otro numero.

---

## Resumen de credenciales

| Variable | Donde se obtiene | Ejemplo |
|----------|-----------------|---------|
| `WA_PHONE_NUMBER_ID` | Meta Dashboard > WhatsApp > API Setup | `109876543210987` |
| `WA_ACCESS_TOKEN` | Business Settings > System Users > Generate Token | `EAAxxxxxxx...` |
| `WA_VERIFY_TOKEN` | Lo inventas tu | `sesamo-2026-secreto` |
| `WA_APP_SECRET` | Meta Dashboard > App Settings > Basic (opcional) | `abc123def456` |
| `ADMIN_PHONE` | Tu numero de admin | `573143371953` |
| `NEQUI_NUMBER` | Numero Nequi para pagos | `573143371953` |
