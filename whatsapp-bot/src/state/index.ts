import { dbGet, dbRun } from '@/db';
import type { UserState } from '@/types';

export type { UserState };

export const getUserState = (phone: string): UserState | undefined => {
  return dbGet<UserState>('SELECT * FROM user_states WHERE phone = ?', [phone]);
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
    dbRun(
      'UPDATE user_states SET current_step = ?, cart_data = ?, updated_at = CURRENT_TIMESTAMP WHERE phone = ?',
      [step, serializedCart, phone],
    );
  } else {
    dbRun('INSERT INTO user_states (phone, current_step, cart_data) VALUES (?, ?, ?)', [
      phone,
      step,
      serializedCart,
    ]);
  }
};

export const clearUserState = (phone: string) => {
  dbRun('DELETE FROM user_states WHERE phone = ?', [phone]);
};
