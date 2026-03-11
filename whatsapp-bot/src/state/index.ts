import { getDb } from '@/db';

export interface UserState {
  phone: string;
  current_step: string;
  cart_data: string | null; // JSON string
}

export const getUserState = (phone: string): UserState | undefined => {
  return getDb().prepare('SELECT * FROM user_states WHERE phone = ?').get(phone) as
    | UserState
    | undefined;
};

export const updateUserState = (phone: string, step: string, cartData?: any) => {
  const existing = getUserState(phone);

  // If cartData is provided explicitly, stringify it.
  // Otherwise keep what is there (if updating step only).
  let serializedCart: string | null = null;
  if (cartData !== undefined) {
    serializedCart = cartData ? JSON.stringify(cartData) : null;
  } else {
    serializedCart = existing?.cart_data || null;
  }

  if (existing) {
    getDb()
      .prepare(
        'UPDATE user_states SET current_step = ?, cart_data = ?, updated_at = CURRENT_TIMESTAMP WHERE phone = ?',
      )
      .run(step, serializedCart, phone);
  } else {
    getDb()
      .prepare('INSERT INTO user_states (phone, current_step, cart_data) VALUES (?, ?, ?)')
      .run(phone, step, serializedCart);
  }
};

export const clearUserState = (phone: string) => {
  getDb().prepare('DELETE FROM user_states WHERE phone = ?').run(phone);
};
