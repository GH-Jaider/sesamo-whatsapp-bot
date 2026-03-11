/** Database row types */

export interface Category {
  id: number;
  name: string;
  display_order: number;
  description: string | null;
}

export interface MenuItem {
  id: number;
  category_id: number;
  name: string;
  description: string | null;
  price: number;
  available: number;
  display_order: number;
}

export interface ItemOption {
  id: number;
  menu_item_id: number;
  option_group: string;
  name: string;
  price: number;
  display_order: number;
}

export interface Order {
  id: number;
  customer_phone: string;
  total: number;
  status: string;
  notes: string | null;
  advance_paid: number;
  created_at: string;
}

export interface OrderItem {
  id: number;
  order_id: number;
  menu_item_id: number;
  item_name: string;
  item_price: number;
  quantity: number;
  options_json: string | null;
}

/** Cart types (serialized to JSON in user_states.cart_data) */

export interface CartItemOption {
  name: string;
  price: number;
}

export interface CartItem {
  menuItemId: number;
  name: string;
  price: number;
  quantity: number;
  options: CartItemOption[];
}

export interface PendingItem {
  menuItemId: number;
  name: string;
  price: number;
  quantity: number;
  options: CartItemOption[];
  /** Category ID to know which sub-option flow to run */
  categoryId: number;
}

export interface CartData {
  items: CartItem[];
  pendingItem?: PendingItem;
  /** Tracks which category the user was browsing (for "add more" flow) */
  selectedCategoryId?: number;
}

/** User state from DB */
export interface UserState {
  phone: string;
  current_step: string;
  cart_data: string | null;
}

/** Parsed command from user input */
export type CommandType = 'number' | 'keyword' | 'text';

export interface ParsedCommand {
  type: CommandType;
  value: string;
  /** For number type, the parsed integer */
  num?: number;
  /** For quantity patterns like "x2" or "2x" */
  quantity?: number;
}
