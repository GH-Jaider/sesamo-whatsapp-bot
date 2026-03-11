import { WAMessage, WASocket } from '@whiskeysockets/baileys';
import { getUserState, updateUserState, clearUserState } from '@/state';
import { sendTextMessage, sendListMessage, downloadMedia, formatPrice } from '@/whatsapp/utils';
import { getDb } from '@/db';
import fs from 'fs/promises';
import path from 'path';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  available: number;
}

export const handleMessage = async (sock: WASocket, msg: WAMessage) => {
  if (!msg.message || msg.key.fromMe) return;

  const jid = msg.key.remoteJid;
  if (!jid || jid.endsWith('@g.us')) return; // Ignore groups

  const phone = jid.split('@')[0]!;

  let userMessage = '';

  if (msg.message.conversation) {
    userMessage = msg.message.conversation;
  } else if (msg.message.extendedTextMessage?.text) {
    userMessage = msg.message.extendedTextMessage.text;
  } else if (msg.message.buttonsResponseMessage?.selectedButtonId) {
    userMessage = msg.message.buttonsResponseMessage.selectedButtonId ?? '';
  } else if (msg.message.listResponseMessage?.singleSelectReply?.selectedRowId) {
    userMessage = msg.message.listResponseMessage.singleSelectReply.selectedRowId ?? '';
  } else if (msg.message.imageMessage) {
    // Handling image message without caption or extracting caption
    userMessage = msg.message.imageMessage.caption ?? '';
  }

  const state = getUserState(phone);

  try {
    // Admin intercepts
    if (userMessage.trim().toLowerCase() === '!admin') {
      if (phone === process.env.ADMIN_PHONE) {
        return handleAdminWelcome(sock, jid, phone);
      } else {
        await sendTextMessage(sock, jid, 'No tienes permisos de administrador.');
        return;
      }
    }

    // Admin is answering "SÍ N" or "NO N" where N is order ID
    // We can allow admin to validate orders at any time without strict state:
    if (phone === process.env.ADMIN_PHONE) {
      const match = userMessage.match(/^(SÍ|SI|NO)\s+(\d+)$/i);
      if (match && match[1] && match[2]) {
        const isApproved = match[1].toUpperCase().startsWith('S');
        const orderId = match[2];
        return processOrderValidation(sock, jid, orderId, isApproved);
      }
    }

    // Fallback: If no state, go to welcome
    if (!state) {
      return handleWelcome(sock, jid, phone);
    }

    // State machine router
    switch (state.current_step) {
      case 'WELCOME':
        return handleWelcomeInput(sock, jid, phone, userMessage);
      case 'MENU':
        return handleMenuSelection(sock, jid, phone, userMessage);
      case 'CART_CONFIRM':
        return handleCartConfirm(sock, jid, phone, userMessage);
      case 'NOTES':
        return handleNotes(sock, jid, phone, userMessage);
      case 'PAYMENT_REQ':
      case 'WAITING_FOR_VOUCHER':
        return handlePayment(sock, jid, phone, msg);
      // Admin states
      case 'ADMIN_MENU':
        return handleAdminMenuSelection(sock, jid, phone, userMessage);
      case 'ADMIN_MANAGE_MENU':
        return handleAdminManageMenuSelection(sock, jid, phone, userMessage);
      default:
        return handleFallback(sock, jid, phone);
    }
  } catch (err) {
    console.error(`Error handling message for ${phone}:`, err);
    await sendTextMessage(
      sock,
      jid,
      "Hubo un error procesando tu solicitud. Por favor intenta de nuevo enviando 'Hola'.",
    );
    clearUserState(phone);
  }
};

// --- Customer Handlers ---

async function handleWelcome(sock: WASocket, jid: string, phone: string) {
  updateUserState(phone, 'WELCOME');
  await sendListMessage(
    sock,
    jid,
    'Sésamo Restaurante',
    '¡Hola! Bienvenido a Sésamo. ¿Qué deseas hacer?',
    'Ver opciones',
    [
      {
        title: 'Opciones',
        rows: [
          {
            title: 'Hacer un pedido',
            rowId: '1',
            description: 'Mira nuestro menú y pide a domicilio',
          },
          { title: 'Ver información', rowId: '2', description: 'Horarios y ubicación' },
        ],
      },
    ],
  );
}

async function handleWelcomeInput(sock: WASocket, jid: string, phone: string, text: string) {
  if (text.trim() === '1') {
    const products = getDb()
      .prepare('SELECT * FROM products WHERE available = 1')
      .all() as Product[];

    const categories: Record<string, { title: string; rowId: string; description: string }[]> = {};
    products.forEach((p) => {
      if (!categories[p.category]) categories[p.category] = [];
      categories[p.category]!.push({
        title: p.name,
        rowId: p.id,
        description: `${formatPrice(p.price)} - ${p.description}`,
      });
    });

    const sections = Object.keys(categories).map((cat) => ({
      title: cat,
      rows: categories[cat]!,
    }));

    updateUserState(phone, 'MENU', { items: [] });
    await sendListMessage(
      sock,
      jid,
      'Menú Sésamo',
      'Aquí tienes nuestro menú. Selecciona un producto para agregarlo a tu orden.',
      'Ver Menú',
      sections,
    );
  } else if (text.trim() === '2') {
    await sendTextMessage(
      sock,
      jid,
      'Sésamo: Las mejores hamburguesas.\nHorario: 6pm - 10pm.\nUbicación: Calle 123 #45-67.',
    );
    clearUserState(phone);
  } else {
    await handleFallback(sock, jid, phone);
  }
}

async function handleMenuSelection(sock: WASocket, jid: string, phone: string, text: string) {
  const productId = text.trim();
  const product = getDb()
    .prepare('SELECT * FROM products WHERE id = ? AND available = 1')
    .get(productId) as Product | undefined;

  if (!product) {
    await sendTextMessage(sock, jid, 'Producto no encontrado o no disponible. Intenta de nuevo.');
    return;
  }

  const state = getUserState(phone)!;
  const cartData = state.cart_data ? JSON.parse(state.cart_data) : { items: [] };

  cartData.items.push(product);

  const subtotal = cartData.items.reduce((sum: number, p: Product) => sum + p.price, 0);

  updateUserState(phone, 'CART_CONFIRM', cartData);

  await sendListMessage(
    sock,
    jid,
    'Producto Agregado',
    `Has agregado ${product.name} a tu orden. \nSubtotal actual: ${formatPrice(subtotal)}\n¿Qué deseas hacer ahora?`,
    'Opciones',
    [
      {
        title: 'Orden',
        rows: [
          { title: 'Agregar otro producto', rowId: '1' },
          { title: 'Finalizar pedido', rowId: '2' },
        ],
      },
    ],
  );
}

async function handleCartConfirm(sock: WASocket, jid: string, phone: string, text: string) {
  if (text.trim() === '1') {
    const products = getDb()
      .prepare('SELECT * FROM products WHERE available = 1')
      .all() as Product[];
    const categories: Record<string, { title: string; rowId: string; description: string }[]> = {};
    products.forEach((p) => {
      if (!categories[p.category]) categories[p.category] = [];
      categories[p.category]!.push({
        title: p.name,
        rowId: p.id,
        description: `${formatPrice(p.price)} - ${p.description}`,
      });
    });

    const sections = Object.keys(categories).map((cat) => ({
      title: cat,
      rows: categories[cat]!,
    }));

    updateUserState(phone, 'MENU');
    await sendListMessage(
      sock,
      jid,
      'Menú Sésamo',
      'Selecciona otro producto:',
      'Ver Menú',
      sections,
    );
  } else if (text.trim() === '2') {
    updateUserState(phone, 'NOTES');
    await sendTextMessage(
      sock,
      jid,
      '¿Tienes alguna instrucción especial para tu pedido? (Ej. "Sin cebolla", o responde "Ninguna")',
    );
  } else {
    await sendTextMessage(
      sock,
      jid,
      'Opción no válida. Responde 1 para agregar más o 2 para finalizar.',
    );
  }
}

async function handleNotes(sock: WASocket, jid: string, phone: string, text: string) {
  const state = getUserState(phone)!;
  const cartData = state.cart_data ? JSON.parse(state.cart_data) : { items: [] };

  cartData.notes = text.trim();

  const total = cartData.items.reduce((sum: number, p: Product) => sum + p.price, 0);
  const advance = Math.ceil(total / 2);

  updateUserState(phone, 'WAITING_FOR_VOUCHER', cartData);

  const nequi = process.env.NEQUI_NUMBER || 'No configurado';
  let receipt = '*Tu Pedido:*\n';
  cartData.items.forEach((p: Product) => {
    receipt += `- ${p.name}: ${formatPrice(p.price)}\n`;
  });
  receipt += `\n*Notas:* ${cartData.notes}\n`;
  receipt += `*Total:* ${formatPrice(total)}\n`;
  receipt += `*Anticipo Requerido (50%):* ${formatPrice(advance)}\n\n`;
  receipt += `Por favor transfiere el anticipo a nuestra cuenta Nequi: ${nequi} y envía la captura de pantalla por aquí para confirmar tu pedido.`;

  await sendTextMessage(sock, jid, receipt);
}

async function handlePayment(sock: WASocket, jid: string, phone: string, msg: WAMessage) {
  if (!msg.message?.imageMessage) {
    await sendTextMessage(
      sock,
      jid,
      'Por favor envía una *imagen* (captura de pantalla) de tu comprobante Nequi para continuar.',
    );
    return;
  }

  await sendTextMessage(sock, jid, 'Descargando comprobante...');

  const downloadDir = path.join(process.cwd(), 'data/downloads');
  const filePath = await downloadMedia(msg, downloadDir);

  if (!filePath) {
    await sendTextMessage(
      sock,
      jid,
      'Hubo un problema procesando la imagen. Por favor intenta enviarla de nuevo.',
    );
    return;
  }

  // Calculate order details to save in DB and send to Admin
  const state = getUserState(phone)!;
  const cartData = state.cart_data ? JSON.parse(state.cart_data) : { items: [] };
  const total = cartData.items.reduce((sum: number, p: Product) => sum + p.price, 0);
  const advance = Math.ceil(total / 2);

  // Save order to DB
  const result = getDb()
    .prepare(
      `
    INSERT INTO orders (customer_phone, total, status, notes, advance_paid) 
    VALUES (?, ?, ?, ?, ?)
  `,
    )
    .run(phone, total, 'PENDING', cartData.notes, advance);

  const orderId = result.lastInsertRowid;

  // Inform customer
  await sendTextMessage(
    sock,
    jid,
    `Comprobante recibido (Pedido #${orderId}). Estamos esperando confirmación de la chef...`,
  );
  clearUserState(phone);

  // Forward to admin
  const adminPhone = process.env.ADMIN_PHONE;
  if (adminPhone) {
    const adminJid = `${adminPhone}@s.whatsapp.net`;

    let adminMsg = `*Nuevo Pedido #${orderId}*\n\n`;
    adminMsg += `*Teléfono:* ${phone}\n`;
    cartData.items.forEach((p: Product) => {
      adminMsg += `- ${p.name}: ${formatPrice(p.price)}\n`;
    });
    adminMsg += `\n*Notas:* ${cartData.notes}\n`;
    adminMsg += `*Total:* ${formatPrice(total)}\n`;
    adminMsg += `*Anticipo (50%):* ${formatPrice(advance)}\n\n`;
    adminMsg += `Responde con *SÍ ${orderId}* para aprobar o *NO ${orderId}* para rechazar.`;

    const buffer = await fs.readFile(filePath);
    await sock.sendMessage(adminJid, {
      image: buffer,
      caption: adminMsg,
    });
  }
}

// --- Admin Handlers ---

async function handleAdminWelcome(sock: WASocket, jid: string, phone: string) {
  updateUserState(phone, 'ADMIN_MENU');
  await sendListMessage(
    sock,
    jid,
    'Panel de Administración',
    'Bienvenido al panel de control de Sésamo',
    'Opciones Admin',
    [
      {
        title: 'Gestión',
        rows: [
          { title: 'Gestionar Menú', rowId: '1', description: 'Activar/Desactivar productos' },
          { title: 'Salir', rowId: '2' },
        ],
      },
    ],
  );
}

async function handleAdminMenuSelection(sock: WASocket, jid: string, phone: string, text: string) {
  if (text.trim() === '1') {
    const products = getDb().prepare('SELECT * FROM products').all() as Product[];

    const rows = products.map((p) => ({
      title: `${p.available ? '🟢' : '🔴'} ${p.name}`,
      rowId: p.id,
      description: `Estado: ${p.available ? 'Activo' : 'Inactivo'}`,
    }));

    updateUserState(phone, 'ADMIN_MANAGE_MENU');
    await sendListMessage(
      sock,
      jid,
      'Gestión de Menú',
      'Selecciona un producto para CAMBIAR su estado (activar/desactivar).',
      'Ver Productos',
      [{ title: 'Productos', rows }],
    );
  } else {
    await sendTextMessage(sock, jid, 'Saliendo de modo admin.');
    clearUserState(phone);
  }
}

async function handleAdminManageMenuSelection(
  sock: WASocket,
  jid: string,
  phone: string,
  text: string,
) {
  const productId = text.trim();
  const product = getDb().prepare('SELECT * FROM products WHERE id = ?').get(productId) as
    | Product
    | undefined;

  if (product) {
    const newAvailable = product.available ? 0 : 1;
    getDb().prepare('UPDATE products SET available = ? WHERE id = ?').run(newAvailable, productId);

    await sendTextMessage(
      sock,
      jid,
      `Producto *${product.name}* ha sido ${newAvailable ? 'activado 🟢' : 'desactivado 🔴'}.`,
    );

    // Show menu again
    await handleAdminMenuSelection(sock, jid, phone, '1');
  } else {
    await sendTextMessage(sock, jid, 'Producto no encontrado.');
    await handleAdminMenuSelection(sock, jid, phone, '1');
  }
}

async function processOrderValidation(
  sock: WASocket,
  adminJid: string,
  orderId: string,
  isApproved: boolean,
) {
  const order = getDb().prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
  if (!order) {
    await sendTextMessage(sock, adminJid, `No se encontró el pedido #${orderId}.`);
    return;
  }

  if (order.status !== 'PENDING') {
    await sendTextMessage(
      sock,
      adminJid,
      `El pedido #${orderId} ya fue procesado (Estado: ${order.status}).`,
    );
    return;
  }

  const newStatus = isApproved ? 'APPROVED' : 'REJECTED';
  getDb().prepare('UPDATE orders SET status = ? WHERE id = ?').run(newStatus, orderId);

  const customerJid = `${order.customer_phone}@s.whatsapp.net`;

  if (isApproved) {
    await sendTextMessage(sock, adminJid, `✅ Pedido #${orderId} APROBADO.`);
    await sendTextMessage(
      sock,
      customerJid,
      `¡Pago confirmado! Tu pedido (ID: #${orderId}) ya se está preparando. Te avisaremos cuando esté listo.`,
    );
  } else {
    await sendTextMessage(sock, adminJid, `❌ Pedido #${orderId} RECHAZADO.`);
    await sendTextMessage(
      sock,
      customerJid,
      `Lo sentimos, hubo un problema con la validación de tu pago para el pedido #${orderId}. Por favor contáctanos para revisarlo.`,
    );
  }
}

async function handleFallback(sock: WASocket, jid: string, phone: string) {
  await sendTextMessage(sock, jid, 'No entendí esa opción. Envía "Hola" para reiniciar.');
  clearUserState(phone);
}
