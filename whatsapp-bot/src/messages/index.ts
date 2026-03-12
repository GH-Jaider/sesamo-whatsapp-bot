import type { CartItem, DeliveryMode } from '@/types';

/** Format price in Colombian pesos: 20000 -> "$20.000" */
export function formatPrice(price: number): string {
  return '$' + price.toLocaleString('es-CO');
}

// ---------------------------------------------------------------------------
// Welcome & Navigation
// ---------------------------------------------------------------------------

export function welcomeMessage(): string {
  return (
    `*Bienvenido a Granja Sésamo* 🐐\n` +
    `_"No es restaurante. Es que mamá cocina rico."_\n\n` +
    `Nuestra especialidad es la trucha fresca, directo de nuestros pozos.\n` +
    `Estamos cerca del Embalse del Neusa — naturaleza, hogar y sazón de mamá.\n\n` +
    `¿Qué te gustaría hacer?`
  );
}

export function infoMessage(): string {
  return (
    `*Granja Sésamo* 🐐\n` +
    `_Restaurante & Experiencia_\n\n` +
    `Comida preparada por chef Delfi\n` +
    `Haz tu pedido con anticipación\n` +
    `Escríbenos por aquí para reservar o pedir\n\n` +
    `📞 Si necesitas más información puedes llamarnos al 3143371953\n\n` +
    `Especialidad: trucha fresca de nuestros propios pozos.\n` +
    `También tenemos carnes, pollos, desayunos y lácteos de cabra artesanales.\n\n` +
    `Escribe *menu* para hacer un pedido.`
  );
}

export function categoryListIntro(): string {
  return `¡Perfecto! Elige una categoría para ver el menú:`;
}

export function itemListIntro(categoryName: string): string {
  return `*${categoryName}*\nElige un plato:`;
}

// ---------------------------------------------------------------------------
// Sub-options
// ---------------------------------------------------------------------------

export function proteinPrompt(): string {
  return `El almuerzo incluye tu elección de proteína.\n¿Cuál prefieres?`;
}

export function addonPrompt(): string {
  return `¿Te gustaría agregar algo a tu desayuno?`;
}

export function beveragePrompt(): string {
  return `Tu desayuno incluye una bebida caliente.\n¿Qué prefieres?`;
}

// ---------------------------------------------------------------------------
// Quantity
// ---------------------------------------------------------------------------

export function quantityPrompt(itemName: string): string {
  return (
    `*${itemName}* agregado.\n` + `¿Cuántos quieres? Escribe un número (1-10) o toca el botón.`
  );
}

export function quantityTooHigh(): string {
  return `La cantidad máxima por ítem es 10. Escribe un número del 1 al 10.`;
}

export function quantityInvalid(): string {
  return `No entendí la cantidad. Escribe un número del 1 al 10.`;
}

// ---------------------------------------------------------------------------
// Cart
// ---------------------------------------------------------------------------

export function cartSummary(items: CartItem[], subtotal: number): string {
  let text = `*Tu pedido actual:*\n`;
  for (const item of items) {
    const optionsStr =
      item.options.length > 0 ? ` (${item.options.map((o) => o.name).join(', ')})` : '';
    const lineTotal = (item.price + item.options.reduce((s, o) => s + o.price, 0)) * item.quantity;
    text += `• ${item.quantity}x ${item.name}${optionsStr} — ${formatPrice(lineTotal)}\n`;
  }
  text += `\n*Subtotal:* ${formatPrice(subtotal)}\n`;
  text += `\n¿Qué deseas hacer?`;
  return text;
}

export function itemAddedToCart(itemName: string, quantity: number): string {
  return `${quantity}x *${itemName}* agregado al pedido.`;
}

// ---------------------------------------------------------------------------
// Delivery Mode & Scheduling
// ---------------------------------------------------------------------------

export function deliveryModePrompt(): string {
  return `¿Cómo quieres recibir tu pedido?`;
}

export function orderTimePrompt(): string {
  return (
    `¿Para qué hora necesitas el pedido?\n\n` +
    `Escribe la hora (ej. "1:30 pm", "a las 2", "en una hora") o toca el botón si lo quieres lo antes posible.`
  );
}

export function deliveryModeLabel(mode: DeliveryMode): string {
  return mode === 'dine_in' ? 'Comer en Sésamo' : 'Llevar al glamping';
}

/** Compact order summary for template parameter (fits in ~500 chars) */
export function orderSummaryCompact(
  items: CartItem[],
  deliveryMode: DeliveryMode,
  scheduledTime: string,
  notes: string,
): string {
  const lines = items.map((item) => {
    const optionsStr =
      item.options.length > 0 ? ` (${item.options.map((o) => o.name).join(', ')})` : '';
    const lineTotal = (item.price + item.options.reduce((s, o) => s + o.price, 0)) * item.quantity;
    return `${item.quantity}x ${item.name}${optionsStr} ${formatPrice(lineTotal)}`;
  });
  const parts = [
    ...lines,
    `Modalidad: ${deliveryModeLabel(deliveryMode)}`,
    `Hora: ${scheduledTime || 'Lo antes posible'}`,
  ];
  if (notes) {
    parts.push(`Notas: ${notes}`);
  }
  return parts.join(' | ');
}

// ---------------------------------------------------------------------------
// Notes & Payment
// ---------------------------------------------------------------------------

export function notesPrompt(): string {
  return `¿Tienes alguna instrucción especial?\n\nEj: "Sin cebolla", "Extra picante"\n\nSi no tienes, toca el botón. Si tienes, escríbelas.`;
}

export function orderReceipt(
  items: CartItem[],
  notes: string,
  total: number,
  advance: number,
  nequiNumber: string,
  deliveryMode: DeliveryMode,
  scheduledTime: string,
): string {
  let text = `*Resumen de tu pedido:*\n\n`;
  for (const item of items) {
    const optionsStr =
      item.options.length > 0 ? ` (${item.options.map((o) => o.name).join(', ')})` : '';
    const lineTotal = (item.price + item.options.reduce((s, o) => s + o.price, 0)) * item.quantity;
    text += `• ${item.quantity}x ${item.name}${optionsStr} — ${formatPrice(lineTotal)}\n`;
  }
  text += `\n*Modalidad:* ${deliveryModeLabel(deliveryMode)}\n`;
  text += `*Hora:* ${scheduledTime || 'Lo antes posible'}\n`;
  text += `*Notas:* ${notes || 'Ninguna'}\n`;
  text += `*Total:* ${formatPrice(total)}\n`;
  text += `*Anticipo (50%):* ${formatPrice(advance)}\n\n`;
  text += `Transfiere el anticipo por Nequi al *${nequiNumber}* y envía la captura de pantalla por aquí para confirmar tu pedido.`;
  return text;
}

export function voucherReceived(orderId: number): string {
  return `Comprobante recibido (Orden #${orderId}). Estamos esperando confirmación de la chef... 👩‍🍳`;
}

export function voucherRequired(): string {
  return `Por favor envía una *imagen* (captura de pantalla) de tu comprobante Nequi para continuar.`;
}

export function downloadingVoucher(): string {
  return `Descargando comprobante...`;
}

export function downloadError(): string {
  return `Hubo un problema procesando la imagen. Por favor intenta enviarla de nuevo.`;
}

// ---------------------------------------------------------------------------
// Order status (customer-facing)
// ---------------------------------------------------------------------------

export function orderApproved(orderId: number): string {
  return (
    `¡Pago confirmado! Tu orden #${orderId} ya se está preparando. 🔥\n` +
    `Te avisaremos cuando esté listo. ¡Gracias por elegir Sésamo!`
  );
}

export function orderRejected(orderId: number): string {
  return (
    `Lo sentimos, hubo un problema con la validación de tu pago para el pedido #${orderId}.\n` +
    `Por favor contáctanos para revisarlo. 3143371953`
  );
}

// ---------------------------------------------------------------------------
// Cancellation & Help
// ---------------------------------------------------------------------------

export function cancellationConfirm(): string {
  return `Pedido cancelado. Cuando quieras, escribe *hola* para empezar de nuevo. 👋`;
}

export function helpMessage(): string {
  return (
    `*Ayuda — Granja Sésamo* 🐐\n\n` +
    `Comandos disponibles:\n` +
    `• *hola* o *menu* — Ver el menú y hacer un pedido\n` +
    `• *cancelar* — Cancelar tu pedido actual\n` +
    `• *ayuda* — Ver este mensaje\n\n` +
    `Para pedir, solo elige las opciones que te vamos mostrando. ¡Es fácil!\n\n` +
    `Si necesitas asistencia, contáctanos al 3143371953.`
  );
}

// ---------------------------------------------------------------------------
// Error / Re-prompt
// ---------------------------------------------------------------------------

export function errorReprompt(hint: string): string {
  return `No entendí esa opción. ${hint}`;
}

export function genericError(): string {
  return `Hubo un error procesando tu solicitud. Escribe *hola* para empezar de nuevo.`;
}

// ---------------------------------------------------------------------------
// Admin messages
// ---------------------------------------------------------------------------

export function adminWelcome(): string {
  return `*Panel de Administración — Sésamo*\n\n¿Qué deseas hacer?`;
}

export function adminNewOrder(
  orderId: number,
  phone: string,
  items: CartItem[],
  notes: string,
  total: number,
  advance: number,
  deliveryMode: DeliveryMode,
  scheduledTime: string,
): string {
  let text = `*Nuevo Pedido #${orderId}*\n\n`;
  text += `*Teléfono:* ${phone}\n`;
  text += `*Modalidad:* ${deliveryModeLabel(deliveryMode)}\n`;
  text += `*Hora:* ${scheduledTime || 'Lo antes posible'}\n\n`;
  for (const item of items) {
    const optionsStr =
      item.options.length > 0 ? ` (${item.options.map((o) => o.name).join(', ')})` : '';
    const lineTotal = (item.price + item.options.reduce((s, o) => s + o.price, 0)) * item.quantity;
    text += `• ${item.quantity}x ${item.name}${optionsStr} — ${formatPrice(lineTotal)}\n`;
  }
  text += `\n*Notas:* ${notes || 'Ninguna'}\n`;
  text += `*Total:* ${formatPrice(total)}\n`;
  text += `*Anticipo (50%):* ${formatPrice(advance)}\n\n`;
  text += `Responde cualquier mensaje para ver el comprobante de pago.`;
  return text;
}

export function adminNoPendingOrders(): string {
  return `No hay pedidos pendientes. ✨`;
}

export function adminPendingOrdersHeader(count: number): string {
  return `*Pedidos pendientes (${count}):*\n`;
}

export function adminPendingOrderLine(
  orderId: number,
  phoneLast4: string,
  itemCount: number,
  total: number,
  minutesAgo: number,
): string {
  const timeStr =
    minutesAgo < 60 ? `${minutesAgo}min` : `${Math.floor(minutesAgo / 60)}h ${minutesAgo % 60}min`;
  return `#${orderId} — ...${phoneLast4} — ${itemCount} ítems — ${formatPrice(total)} — hace ${timeStr}`;
}

export function adminOrderApproved(orderId: number): string {
  return `Pedido #${orderId} APROBADO. ✅`;
}

export function adminVoucherCaption(orderId: number): string {
  return `Comprobante de pago — Pedido #${orderId}`;
}

export function adminOrderRejected(orderId: number): string {
  return `Pedido #${orderId} RECHAZADO. ❌`;
}

export function adminOrderNotFound(orderId: string): string {
  return `No se encontró el pedido #${orderId}.`;
}

export function adminOrderAlreadyProcessed(orderId: string, status: string): string {
  return `El pedido #${orderId} ya fue procesado (Estado: ${status}).`;
}

export function noPermission(): string {
  return `No tienes permisos de administrador.`;
}
