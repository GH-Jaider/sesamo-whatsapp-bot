import { getUserState, updateUserState, clearUserState } from '@/state/index';
import {
  sendText,
  sendList,
  sendButtons,
  sendImage,
  sendTemplate,
  downloadMedia,
} from '@/whatsapp/api';
import { dbAll, dbGet, dbRun } from '@/db/index';
import { normalizeInput, parseCommand, parseQuantity } from '@/input/index';
import * as msg from '@/messages/index';
import type {
  Category,
  MenuItem,
  ItemOption,
  CartData,
  CartItem,
  PendingItem,
  Order,
  DeliveryMode,
} from '@/types/index';
import { existsSync } from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCartData(cartJson: string | null): CartData {
  if (!cartJson) return { items: [] };
  try {
    return JSON.parse(cartJson) as CartData;
  } catch {
    return { items: [] };
  }
}

function calcSubtotal(items: CartItem[]): number {
  return items.reduce((sum, item) => {
    const optPrice = item.options.reduce((s, o) => s + o.price, 0);
    return sum + (item.price + optPrice) * item.quantity;
  }, 0);
}

// ---------------------------------------------------------------------------
// Main entry — transport-agnostic
// ---------------------------------------------------------------------------

export const handleMessage = async (phone: string, userMessage: string, mediaId?: string) => {
  const state = getUserState(phone);
  const parsed = parseCommand(userMessage);

  try {
    // --- Admin commands (stateless intercepts) ---
    const normalizedMsg = normalizeInput(userMessage);

    if (normalizedMsg === '!admin') {
      if (phone === process.env.ADMIN_PHONE) {
        return handleAdminWelcome(phone);
      } else {
        await sendText(phone, msg.noPermission());
        return;
      }
    }

    if (normalizedMsg === '!pedidos') {
      if (phone === process.env.ADMIN_PHONE) {
        return handlePedidos(phone);
      } else {
        await sendText(phone, msg.noPermission());
        return;
      }
    }

    // Admin order approval/rejection: "SI N", "NO N", or button IDs "si_N", "no_N"
    if (phone === process.env.ADMIN_PHONE) {
      const match =
        userMessage.match(/^(S[IÍ]|NO)\s+(\d+)$/i) || userMessage.match(/^(si|no)_(\d+)$/i);
      if (match?.[1] && match[2]) {
        const isApproved = match[1]!.toUpperCase().startsWith('S');
        const orderId = match[2]!;
        return processOrderValidation(phone, orderId, isApproved);
      }

      // Admin replied to the template notification — send the voucher image
      // This triggers when the admin sends ANY message that isn't a recognized command
      // and they don't have an active admin state (ADMIN_MENU, ADMIN_MANAGE_MENU, etc.)
      if (
        !state ||
        (state.current_step !== 'ADMIN_MENU' &&
          state.current_step !== 'ADMIN_MANAGE_MENU' &&
          state.current_step !== 'ADMIN_MANAGE_ITEMS')
      ) {
        const pendingOrder = dbGet<Order>(
          "SELECT * FROM orders WHERE status = 'PENDING' AND voucher_path IS NOT NULL ORDER BY created_at DESC LIMIT 1",
        );

        if (pendingOrder && pendingOrder.voucher_path && existsSync(pendingOrder.voucher_path)) {
          await sendImage(
            phone,
            pendingOrder.voucher_path,
            msg.adminVoucherCaption(pendingOrder.id),
          );
          await sendButtons(phone, `¿Aprobar pedido #${pendingOrder.id}?`, [
            { buttonId: `si_${pendingOrder.id}`, buttonText: 'Aprobar' },
            { buttonId: `no_${pendingOrder.id}`, buttonText: 'Rechazar' },
          ]);
          return;
        }

        // No pending orders with vouchers — don't intercept, let it fall through
        // to global keywords or welcome flow
      }
    }

    // --- Global keyword intercepts (before state routing) ---
    if (parsed.type === 'keyword') {
      if (parsed.value === 'hola' || parsed.value === 'menu' || parsed.value === 'pedir') {
        clearUserState(phone);
        return handleWelcome(phone);
      }
      if (parsed.value === 'cancelar') {
        clearUserState(phone);
        await sendText(phone, msg.cancellationConfirm());
        return;
      }
      if (parsed.value === 'ayuda') {
        await sendText(phone, msg.helpMessage());
        return;
      }
    }

    // --- No state: go to welcome ---
    if (!state) {
      return handleWelcome(phone);
    }

    // --- State machine router ---
    switch (state.current_step) {
      case 'WELCOME':
        return handleWelcomeInput(phone, userMessage);
      case 'CATEGORY_SELECT':
        return handleCategorySelect(phone, userMessage);
      case 'ITEM_SELECT':
        return handleItemSelect(phone, userMessage);
      case 'CHOOSE_PROTEIN':
        return handleChooseProtein(phone, userMessage);
      case 'CHOOSE_ADDONS':
        return handleChooseAddons(phone, userMessage);
      case 'CHOOSE_BEVERAGE':
        return handleChooseBeverage(phone, userMessage);
      case 'CHOOSE_QUANTITY':
        return handleChooseQuantity(phone, userMessage);
      case 'CART_CONFIRM':
        return handleCartConfirm(phone, userMessage);
      case 'CHOOSE_DELIVERY_MODE':
        return handleDeliveryMode(phone, userMessage);
      case 'CHOOSE_ORDER_TIME':
        return handleOrderTime(phone, userMessage);
      case 'NOTES':
        return handleNotes(phone, userMessage);
      case 'WAITING_FOR_VOUCHER':
        return handlePayment(phone, mediaId);
      // Admin states
      case 'ADMIN_MENU':
        return handleAdminMenuSelection(phone, userMessage);
      case 'ADMIN_MANAGE_MENU':
        return handleAdminManageMenuSelection(phone, userMessage);
      case 'ADMIN_MANAGE_ITEMS':
        return handleAdminManageItemSelection(phone, userMessage);
      default:
        return handleWelcome(phone);
    }
  } catch (err) {
    console.error(`[ERROR] handling message for ${phone}:`, err);
    await sendText(phone, msg.genericError());
    clearUserState(phone);
  }
};

// ---------------------------------------------------------------------------
// Customer: Welcome
// ---------------------------------------------------------------------------

async function handleWelcome(phone: string) {
  updateUserState(phone, 'WELCOME');

  await sendList(
    phone,
    msg.welcomeMessage(),
    'Ver opciones',
    [
      {
        title: 'Opciones',
        rows: [
          { title: 'Hacer un pedido', rowId: '1', description: 'Mira nuestro menú y pide' },
          { title: 'Información', rowId: '2', description: 'Horarios, contacto directo y más' },
        ],
      },
    ],
    'Finca Sésamo',
  );
}

async function handleWelcomeInput(phone: string, text: string) {
  const parsed = parseCommand(text);

  if (parsed.type === 'number' && parsed.num === 1) {
    return showCategories(phone);
  }
  if (parsed.type === 'number' && parsed.num === 2) {
    await sendText(phone, msg.infoMessage());
    clearUserState(phone);
    return;
  }

  // Re-prompt
  await sendText(phone, msg.errorReprompt('Elige *1* para pedir o *2* para información.'));
}

// ---------------------------------------------------------------------------
// Customer: Category & Item selection
// ---------------------------------------------------------------------------

async function showCategories(phone: string) {
  const categories = dbAll<Category>('SELECT * FROM categories ORDER BY display_order');

  // Check each category has at least one available item
  const rows = categories
    .filter((cat) => {
      const count = dbGet<{ c: number }>(
        'SELECT count(*) as c FROM menu_items WHERE category_id = ? AND available = 1',
        [cat.id],
      );
      return count && count.c > 0;
    })
    .map((cat) => {
      const row: { title: string; rowId: string; description?: string } = {
        title: cat.name.slice(0, 24),
        rowId: String(cat.id),
      };
      if (cat.description) {
        row.description = cat.description.slice(0, 72);
      }
      return row;
    });

  // Preserve existing cart items when browsing categories (e.g. "Agregar más")
  const existingState = getUserState(phone);
  const existingCart = existingState ? getCartData(existingState.cart_data) : { items: [] };
  // Clear pending item if any, keep committed items
  delete existingCart.pendingItem;
  delete existingCart.selectedCategoryId;
  updateUserState(phone, 'CATEGORY_SELECT', existingCart);

  await sendList(
    phone,
    msg.categoryListIntro(),
    'Ver categorías',
    [{ title: 'Categorías', rows }],
    'Menú Sésamo',
    'Escribe "ayuda" si necesitas ayuda',
  );
}

async function handleCategorySelect(phone: string, text: string) {
  const parsed = parseCommand(text);
  if (parsed.type !== 'number' || !parsed.num) {
    await sendText(phone, msg.errorReprompt('Elige el número de una categoría.'));
    return;
  }

  const category = dbGet<Category>('SELECT * FROM categories WHERE id = ?', [parsed.num]);
  if (!category) {
    await sendText(phone, msg.errorReprompt('Categoría no encontrada. Intenta con otro número.'));
    return;
  }

  return showItemsInCategory(phone, category);
}

async function showItemsInCategory(phone: string, category: Category) {
  const items = dbAll<MenuItem>(
    'SELECT * FROM menu_items WHERE category_id = ? AND available = 1 ORDER BY display_order',
    [category.id],
  );

  if (items.length === 0) {
    await sendText(phone, 'No hay ítems disponibles en esta categoría.');
    return showCategories(phone);
  }

  const rows = items.map((item) => ({
    title: item.name.slice(0, 24),
    rowId: String(item.id),
    description:
      `${msg.formatPrice(item.price)}${item.description ? ' — ' + item.description : ''}`.slice(
        0,
        72,
      ),
  }));

  // Save selected category in cart data
  const state = getUserState(phone)!;
  const cart = getCartData(state.cart_data);
  cart.selectedCategoryId = category.id;
  updateUserState(phone, 'ITEM_SELECT', cart);

  await sendList(phone, msg.itemListIntro(category.name), 'Ver platos', [
    { title: category.name, rows },
  ]);
}

async function handleItemSelect(phone: string, text: string) {
  const parsed = parseCommand(text);
  if (parsed.type !== 'number' || !parsed.num) {
    await sendText(phone, msg.errorReprompt('Elige el número de un plato del menú.'));
    return;
  }

  const item = dbGet<MenuItem>('SELECT * FROM menu_items WHERE id = ? AND available = 1', [
    parsed.num,
  ]);
  if (!item) {
    await sendText(phone, msg.errorReprompt('Plato no encontrado. Elige uno de la lista.'));
    return;
  }

  // Check if item has options
  const options = dbAll<ItemOption>(
    'SELECT * FROM item_options WHERE menu_item_id = ? ORDER BY display_order',
    [item.id],
  );

  const state = getUserState(phone)!;
  const cart = getCartData(state.cart_data);

  // Create pending item
  const pending: PendingItem = {
    menuItemId: item.id,
    name: item.name,
    price: item.price,
    quantity: 1,
    options: [],
    categoryId: item.category_id,
  };
  cart.pendingItem = pending;

  // Route based on option groups
  const hasProtein = options.some((o) => o.option_group === 'proteina');
  const hasBeverage = options.some((o) => o.option_group === 'bebida');
  const hasAddons = options.some((o) => o.option_group === 'adicional');

  if (hasProtein) {
    updateUserState(phone, 'CHOOSE_PROTEIN', cart);
    const proteinOptions = options.filter((o) => o.option_group === 'proteina');
    const rows = proteinOptions.map((o) => ({
      title: o.name.slice(0, 24),
      rowId: String(o.id),
      description: o.price > 0 ? `+${msg.formatPrice(o.price)}` : 'Incluida',
    }));
    await sendList(phone, msg.proteinPrompt(), 'Ver opciones', [{ title: 'Proteínas', rows }]);
  } else if (hasBeverage) {
    updateUserState(phone, 'CHOOSE_BEVERAGE', cart);
    const beverageOptions = options.filter((o) => o.option_group === 'bebida');
    await sendButtons(
      phone,
      msg.beveragePrompt(),
      beverageOptions.map((o) => ({
        buttonId: String(o.id),
        buttonText: o.name.slice(0, 20),
      })),
    );
  } else if (hasAddons) {
    updateUserState(phone, 'CHOOSE_ADDONS', cart);
    await showAddonsPrompt(
      phone,
      options.filter((o) => o.option_group === 'adicional'),
    );
  } else {
    // No options — go straight to quantity
    updateUserState(phone, 'CHOOSE_QUANTITY', cart);
    await sendQuantityPrompt(phone, item.name);
  }
}

// ---------------------------------------------------------------------------
// Customer: Sub-options (protein, add-ons)
// ---------------------------------------------------------------------------

async function handleChooseProtein(phone: string, text: string) {
  const parsed = parseCommand(text);
  if (parsed.type !== 'number' || !parsed.num) {
    await sendText(phone, msg.errorReprompt('Elige el número de una proteína.'));
    return;
  }

  const option = dbGet<ItemOption>(
    "SELECT * FROM item_options WHERE id = ? AND option_group = 'proteina'",
    [parsed.num],
  );
  if (!option) {
    await sendText(phone, msg.errorReprompt('Opción no válida. Elige una proteína de la lista.'));
    return;
  }

  const state = getUserState(phone)!;
  const cart = getCartData(state.cart_data);

  if (cart.pendingItem) {
    cart.pendingItem.options.push({ name: option.name, price: option.price });
  }

  // Check if the pending item also has add-ons
  const addons = dbAll<ItemOption>(
    "SELECT * FROM item_options WHERE menu_item_id = ? AND option_group = 'adicional' ORDER BY display_order",
    [cart.pendingItem?.menuItemId ?? 0],
  );

  if (addons.length > 0) {
    updateUserState(phone, 'CHOOSE_ADDONS', cart);
    await showAddonsPrompt(phone, addons);
  } else {
    updateUserState(phone, 'CHOOSE_QUANTITY', cart);
    await sendQuantityPrompt(phone, cart.pendingItem?.name ?? 'ítem');
  }
}

async function handleChooseBeverage(phone: string, text: string) {
  const parsed = parseCommand(text);
  const normalized = normalizeInput(text);
  const state = getUserState(phone)!;
  const cart = getCartData(state.cart_data);
  const menuItemId = cart.pendingItem?.menuItemId ?? 0;

  // Match by button ID (number) or by name
  let option: ItemOption | undefined;
  if (parsed.type === 'number' && parsed.num) {
    option = dbGet<ItemOption>(
      "SELECT * FROM item_options WHERE id = ? AND option_group = 'bebida'",
      [parsed.num],
    );
  }
  if (!option) {
    // Try matching by name (e.g. user typed "chocolate" or "café")
    const beverages = dbAll<ItemOption>(
      "SELECT * FROM item_options WHERE menu_item_id = ? AND option_group = 'bebida' ORDER BY display_order",
      [menuItemId],
    );
    option = beverages.find((b) => normalizeInput(b.name) === normalized);
  }

  if (!option) {
    await sendText(phone, msg.errorReprompt('Elige *Chocolate* o *Café*.'));
    return;
  }

  if (cart.pendingItem) {
    cart.pendingItem.options.push({ name: option.name, price: option.price });
  }

  // Check if the item also has add-ons
  const addons = dbAll<ItemOption>(
    "SELECT * FROM item_options WHERE menu_item_id = ? AND option_group = 'adicional' ORDER BY display_order",
    [menuItemId],
  );

  if (addons.length > 0) {
    updateUserState(phone, 'CHOOSE_ADDONS', cart);
    await showAddonsPrompt(phone, addons);
  } else {
    updateUserState(phone, 'CHOOSE_QUANTITY', cart);
    await sendQuantityPrompt(phone, cart.pendingItem?.name ?? 'ítem');
  }
}

async function showAddonsPrompt(phone: string, addons: ItemOption[]) {
  // Always use a list — button text (20 char limit) truncates addon names + prices
  const rows = [
    ...addons.map((a) => ({
      title: a.name.slice(0, 24),
      rowId: String(a.id),
      description: `+${msg.formatPrice(a.price)}`,
    })),
    { title: 'Sin adicionales', rowId: 'skip', description: 'Continuar sin adicionales' },
  ];
  await sendList(phone, msg.addonPrompt(), 'Ver opciones', [{ title: 'Adicionales', rows }]);
}

async function handleChooseAddons(phone: string, text: string) {
  const normalized = normalizeInput(text);
  const state = getUserState(phone)!;
  const cart = getCartData(state.cart_data);

  if (normalized === 'skip' || normalized === 'sin adicionales' || normalized === '0') {
    // Skip add-ons, go to quantity
    updateUserState(phone, 'CHOOSE_QUANTITY', cart);
    await sendQuantityPrompt(phone, cart.pendingItem?.name ?? 'ítem');
    return;
  }

  const parsed = parseCommand(text);
  if (parsed.type !== 'number' || !parsed.num) {
    await sendText(
      phone,
      msg.errorReprompt('Elige un adicional de la lista o toca "Sin adicionales".'),
    );
    return;
  }

  const addon = dbGet<ItemOption>(
    "SELECT * FROM item_options WHERE id = ? AND option_group = 'adicional'",
    [parsed.num],
  );
  if (!addon) {
    await sendText(phone, msg.errorReprompt('Adicional no encontrado. Intenta de nuevo.'));
    return;
  }

  // Add the add-on as a separate cart item
  cart.items.push({
    menuItemId: addon.menu_item_id,
    name: addon.name,
    price: addon.price,
    quantity: 1,
    options: [],
  });

  // Go to quantity for the base item
  updateUserState(phone, 'CHOOSE_QUANTITY', cart);
  await sendQuantityPrompt(phone, cart.pendingItem?.name ?? 'ítem');
}

// ---------------------------------------------------------------------------
// Customer: Quantity
// ---------------------------------------------------------------------------

async function sendQuantityPrompt(phone: string, itemName: string) {
  await sendButtons(phone, msg.quantityPrompt(itemName), [
    { buttonId: '1', buttonText: 'Solo 1' },
    { buttonId: '2', buttonText: '2' },
    { buttonId: '3', buttonText: '3' },
  ]);
}

async function handleChooseQuantity(phone: string, text: string) {
  const qty = parseQuantity(text);

  if (qty === undefined) {
    await sendText(phone, msg.quantityInvalid());
    return;
  }

  if (qty < 1 || qty > 10) {
    await sendText(phone, msg.quantityTooHigh());
    return;
  }

  const state = getUserState(phone)!;
  const cart = getCartData(state.cart_data);

  if (cart.pendingItem) {
    const item: CartItem = {
      menuItemId: cart.pendingItem.menuItemId,
      name: cart.pendingItem.name,
      price: cart.pendingItem.price,
      quantity: qty,
      options: cart.pendingItem.options,
    };
    cart.items.push(item);
    delete cart.pendingItem;
  }

  const subtotal = calcSubtotal(cart.items);
  updateUserState(phone, 'CART_CONFIRM', cart);

  await sendButtons(phone, msg.cartSummary(cart.items, subtotal), [
    { buttonId: 'add', buttonText: 'Agregar más' },
    { buttonId: 'done', buttonText: 'Finalizar pedido' },
  ]);
}

// ---------------------------------------------------------------------------
// Customer: Cart confirm
// ---------------------------------------------------------------------------

async function handleCartConfirm(phone: string, text: string) {
  const normalized = normalizeInput(text);
  const parsed = parseCommand(text);

  const isAdd =
    normalized === 'add' ||
    normalized === 'agregar' ||
    normalized === 'agregar mas' ||
    (parsed.type === 'number' && parsed.num === 1);

  const isDone =
    normalized === 'done' ||
    normalized === 'finalizar' ||
    normalized === 'finalizar pedido' ||
    parsed.value === 'listo' ||
    (parsed.type === 'number' && parsed.num === 2);

  if (isAdd) {
    return showCategories(phone);
  }

  if (isDone) {
    const st = getUserState(phone)!;
    const cartData = getCartData(st.cart_data);
    updateUserState(phone, 'CHOOSE_DELIVERY_MODE', cartData);
    await sendButtons(phone, msg.deliveryModePrompt(), [
      { buttonId: 'dine_in', buttonText: 'Comer en Sésamo' },
      { buttonId: 'delivery', buttonText: 'Llevar al glamping' },
    ]);
    return;
  }

  // Re-prompt
  const state = getUserState(phone)!;
  const cart = getCartData(state.cart_data);
  const subtotal = calcSubtotal(cart.items);

  await sendButtons(phone, msg.errorReprompt('') + '\n\n' + msg.cartSummary(cart.items, subtotal), [
    { buttonId: 'add', buttonText: 'Agregar más' },
    { buttonId: 'done', buttonText: 'Finalizar pedido' },
  ]);
}

// ---------------------------------------------------------------------------
// Customer: Delivery Mode
// ---------------------------------------------------------------------------

async function handleDeliveryMode(phone: string, text: string) {
  const normalized = normalizeInput(text);
  const state = getUserState(phone)!;
  const cart = getCartData(state.cart_data);

  const isDineIn =
    normalized === 'dine_in' ||
    normalized === 'comer en sesamo' ||
    normalized === 'comer' ||
    normalized === '1';

  const isDelivery =
    normalized === 'delivery' ||
    normalized === 'llevar al glamping' ||
    normalized === 'llevar' ||
    normalized === 'glamping' ||
    normalized === '2';

  if (isDineIn) {
    cart.deliveryMode = 'dine_in';
  } else if (isDelivery) {
    cart.deliveryMode = 'delivery';
  } else {
    await sendButtons(phone, msg.errorReprompt('Elige una opción.'), [
      { buttonId: 'dine_in', buttonText: 'Comer en Sésamo' },
      { buttonId: 'delivery', buttonText: 'Llevar al glamping' },
    ]);
    return;
  }

  updateUserState(phone, 'CHOOSE_ORDER_TIME', cart);
  await sendButtons(phone, msg.orderTimePrompt(), [
    { buttonId: 'asap', buttonText: 'Lo antes posible' },
  ]);
}

// ---------------------------------------------------------------------------
// Customer: Order Time
// ---------------------------------------------------------------------------

async function handleOrderTime(phone: string, text: string) {
  const normalized = normalizeInput(text);
  const state = getUserState(phone)!;
  const cart = getCartData(state.cart_data);

  if (normalized === 'asap' || normalized === 'lo antes posible' || normalized === 'ya') {
    cart.scheduledTime = '';
  } else {
    // Free text time — store whatever they typed
    cart.scheduledTime = text.trim();
  }

  updateUserState(phone, 'NOTES', cart);
  await sendButtons(phone, msg.notesPrompt(), [
    { buttonId: 'skip_notes', buttonText: 'Sin comentarios' },
  ]);
}

// ---------------------------------------------------------------------------
// Customer: Notes
// ---------------------------------------------------------------------------

async function handleNotes(phone: string, text: string) {
  const normalized = normalizeInput(text);
  const state = getUserState(phone)!;
  const cart = getCartData(state.cart_data);

  const notes =
    normalized === 'listo' ||
    normalized === 'ninguna' ||
    normalized === 'skip_notes' ||
    normalized === 'sin comentarios'
      ? ''
      : text.trim();
  const total = calcSubtotal(cart.items);
  const advance = Math.ceil(total / 2);
  const nequi = process.env.NEQUI_NUMBER || 'No configurado';
  const deliveryMode: DeliveryMode = cart.deliveryMode ?? 'dine_in';
  const scheduledTime = cart.scheduledTime ?? '';

  // Store notes in cart for later
  cart.notes = notes;
  updateUserState(phone, 'WAITING_FOR_VOUCHER', cart);

  await sendText(
    phone,
    msg.orderReceipt(cart.items, notes, total, advance, nequi, deliveryMode, scheduledTime),
  );
}

// ---------------------------------------------------------------------------
// Customer: Payment / Voucher
// ---------------------------------------------------------------------------

async function handlePayment(phone: string, mediaId: string | undefined) {
  if (!mediaId) {
    await sendText(phone, msg.voucherRequired());
    return;
  }

  await sendText(phone, msg.downloadingVoucher());

  const downloadDir = path.join(process.cwd(), 'data/downloads');
  const filePath = await downloadMedia(mediaId, downloadDir);

  if (!filePath) {
    await sendText(phone, msg.downloadError());
    return;
  }

  const state = getUserState(phone)!;
  const cart = getCartData(state.cart_data);
  const notes = cart.notes ?? '';
  const total = calcSubtotal(cart.items);
  const advance = Math.ceil(total / 2);
  const deliveryMode: DeliveryMode = cart.deliveryMode ?? 'dine_in';
  const scheduledTime = cart.scheduledTime ?? '';

  // Save order (include voucher path for later retrieval when admin replies)
  const result = dbRun(
    'INSERT INTO orders (customer_phone, total, status, notes, advance_paid, delivery_mode, scheduled_time, voucher_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [phone, total, 'PENDING', notes, advance, deliveryMode, scheduledTime || null, filePath],
  );
  const orderId = result.lastInsertRowid;

  // Save order items
  for (const item of cart.items) {
    dbRun(
      'INSERT INTO order_items (order_id, menu_item_id, item_name, item_price, quantity, options_json) VALUES (?, ?, ?, ?, ?, ?)',
      [
        orderId,
        item.menuItemId,
        item.name,
        item.price,
        item.quantity,
        item.options.length > 0 ? JSON.stringify(item.options) : null,
      ],
    );
  }

  // Inform customer
  await sendText(phone, msg.voucherReceived(orderId));
  clearUserState(phone);

  // Forward to admin via template (free-form messages don't work outside 24h window)
  const adminPhone = process.env.ADMIN_PHONE;
  console.log(`[handlePayment] forwarding to admin=${adminPhone} orderId=${orderId}`);
  if (adminPhone) {
    const summary = msg.orderSummaryCompact(cart.items, deliveryMode, scheduledTime, notes);
    const templateSent = await sendTemplate(adminPhone, 'pedido_detalle', 'es', [
      String(orderId),
      phone,
      summary,
      msg.formatPrice(total),
      msg.formatPrice(advance),
    ]);

    if (!templateSent) {
      console.warn('[handlePayment] template failed, trying direct text (admin may have window)');
      const adminText = msg.adminNewOrder(
        orderId,
        phone,
        cart.items,
        notes,
        total,
        advance,
        deliveryMode,
        scheduledTime,
      );
      await sendText(adminPhone, adminText);
    }
  } else {
    console.warn('[handlePayment] ADMIN_PHONE not set, skipping admin notification');
  }
}

// ---------------------------------------------------------------------------
// Admin: Welcome & Menu Management
// ---------------------------------------------------------------------------

async function handleAdminWelcome(phone: string) {
  updateUserState(phone, 'ADMIN_MENU');
  await sendList(phone, msg.adminWelcome(), 'Opciones Admin', [
    {
      title: 'Gestión',
      rows: [
        { title: 'Gestionar Menú', rowId: '1', description: 'Activar/desactivar ítems' },
        { title: 'Ver pedidos', rowId: '2', description: 'Pedidos pendientes' },
        { title: 'Salir', rowId: '3' },
      ],
    },
  ]);
}

async function handleAdminMenuSelection(phone: string, text: string) {
  const parsed = parseCommand(text);

  if (parsed.type === 'number' && parsed.num === 1) {
    return showAdminCategoryList(phone);
  }

  if (parsed.type === 'number' && parsed.num === 2) {
    await handlePedidos(phone);
    // Re-show admin menu after viewing orders
    return handleAdminWelcome(phone);
  }

  // Exit
  await sendText(phone, 'Saliendo de modo admin.');
  clearUserState(phone);
}

async function showAdminCategoryList(phone: string) {
  const categories = dbAll<Category>('SELECT * FROM categories ORDER BY display_order');
  const rows = categories.map((cat) => {
    const counts = dbGet<{ total: number; active: number }>(
      'SELECT count(*) as total, sum(available) as active FROM menu_items WHERE category_id = ?',
      [cat.id],
    );
    return {
      title: cat.name.slice(0, 24),
      rowId: `admin_cat_${cat.id}`,
      description: `${counts?.active ?? 0}/${counts?.total ?? 0} activos`,
    };
  });

  updateUserState(phone, 'ADMIN_MANAGE_MENU');
  await sendList(phone, 'Elige una categoría para gestionar sus ítems.', 'Ver categorías', [
    { title: 'Categorías', rows },
  ]);
}

async function showAdminCategoryItems(phone: string, categoryId: number) {
  const category = dbGet<Category>('SELECT * FROM categories WHERE id = ?', [categoryId]);
  if (!category) {
    await sendText(phone, 'Categoría no encontrada.');
    return showAdminCategoryList(phone);
  }

  const items = dbAll<MenuItem>(
    'SELECT * FROM menu_items WHERE category_id = ? ORDER BY display_order',
    [categoryId],
  );

  if (items.length === 0) {
    await sendText(phone, 'No hay ítems en esta categoría.');
    return showAdminCategoryList(phone);
  }

  const rows = items.map((item) => ({
    title: item.name.slice(0, 24),
    rowId: `admin_item_${item.id}`,
    description:
      `${item.available ? '🟢 Activo' : '🔴 Inactivo'} — ${msg.formatPrice(item.price)}`.slice(
        0,
        72,
      ),
  }));

  // Add "back" row
  rows.push({ title: 'Volver', rowId: 'admin_back', description: 'Volver a categorías' });

  updateUserState(phone, 'ADMIN_MANAGE_ITEMS');
  await sendList(phone, `*${category.name}* — toca un ítem para activar/desactivar.`, 'Ver ítems', [
    { title: category.name, rows },
  ]);
}

async function handleAdminManageMenuSelection(phone: string, text: string) {
  const normalized = normalizeInput(text);

  // Category selection: rowId is "admin_cat_N"
  const catMatch = normalized.match(/^admin_cat_(\d+)$/);
  if (catMatch?.[1]) {
    return showAdminCategoryItems(phone, parseInt(catMatch[1], 10));
  }

  await sendText(phone, 'Elige una categoría de la lista.');
}

async function handleAdminManageItemSelection(phone: string, text: string) {
  const normalized = normalizeInput(text);

  if (normalized === 'admin_back') {
    return showAdminCategoryList(phone);
  }

  // Item toggle: rowId is "admin_item_N"
  const itemMatch = normalized.match(/^admin_item_(\d+)$/);
  if (itemMatch?.[1]) {
    const itemId = parseInt(itemMatch[1], 10);
    const item = dbGet<MenuItem>('SELECT * FROM menu_items WHERE id = ?', [itemId]);

    if (item) {
      const newAvailable = item.available ? 0 : 1;
      dbRun('UPDATE menu_items SET available = ? WHERE id = ?', [newAvailable, item.id]);

      await sendText(
        phone,
        `*${item.name}* ha sido ${newAvailable ? 'activado 🟢' : 'desactivado 🔴'}.`,
      );

      // Re-show items in same category
      return showAdminCategoryItems(phone, item.category_id);
    }
  }

  await sendText(phone, 'Elige un ítem de la lista.');
}

// ---------------------------------------------------------------------------
// Admin: Pending orders
// ---------------------------------------------------------------------------

async function handlePedidos(phone: string) {
  const orders = dbAll<Order>(
    "SELECT * FROM orders WHERE status = 'PENDING' ORDER BY created_at ASC",
  );

  if (orders.length === 0) {
    await sendText(phone, msg.adminNoPendingOrders());
    return;
  }

  let text = msg.adminPendingOrdersHeader(orders.length) + '\n';

  for (const order of orders) {
    const phoneLast4 = order.customer_phone.slice(-4);
    const itemCount = dbGet<{ c: number }>(
      'SELECT count(*) as c FROM order_items WHERE order_id = ?',
      [order.id],
    );
    const minutesAgo = Math.floor(
      (Date.now() - new Date(order.created_at + 'Z').getTime()) / 60000,
    );
    text +=
      msg.adminPendingOrderLine(
        order.id,
        phoneLast4,
        itemCount?.c ?? 0,
        order.total,
        Math.max(0, minutesAgo),
      ) + '\n';
  }

  await sendText(phone, text);
}

// ---------------------------------------------------------------------------
// Admin: Order approval/rejection
// ---------------------------------------------------------------------------

async function processOrderValidation(adminPhone: string, orderId: string, isApproved: boolean) {
  const order = dbGet<Order>('SELECT * FROM orders WHERE id = ?', [orderId]);
  if (!order) {
    await sendText(adminPhone, msg.adminOrderNotFound(orderId));
    return;
  }

  if (order.status !== 'PENDING') {
    await sendText(adminPhone, msg.adminOrderAlreadyProcessed(orderId, order.status));
    return;
  }

  const newStatus = isApproved ? 'APPROVED' : 'REJECTED';
  dbRun('UPDATE orders SET status = ? WHERE id = ?', [newStatus, orderId]);

  const customerPhone = order.customer_phone;

  if (isApproved) {
    await sendText(adminPhone, msg.adminOrderApproved(order.id));
    await sendText(customerPhone, msg.orderApproved(order.id));
  } else {
    await sendText(adminPhone, msg.adminOrderRejected(order.id));
    await sendText(customerPhone, msg.orderRejected(order.id));
  }
}
