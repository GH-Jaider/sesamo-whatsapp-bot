## 1. Setup & Environment

- [ ] 1.1 Initialize Node.js project and `package.json`
- [ ] 1.2 Install necessary dependencies (`@whiskeysockets/baileys`, `sqlite3` or `better-sqlite3`, `dotenv`, etc.)
- [ ] 1.3 Setup TypeScript environment and tsconfig (if using TS)
- [ ] 1.4 Create `.env` template file to store configuration like ADMIN_PHONE and NEQUI_NUMBER

## 2. Database Implementation

- [ ] 2.1 Set up SQLite database connection instance
- [ ] 2.2 Create schema/migration for `products` table (id, name, description, price, category, available)
- [ ] 2.3 Create schema/migration for `orders` table (id, customer_phone, total, status, notes, advance_paid)
- [ ] 2.4 Create schema/migration for `user_states` table (phone, current_step, cart_data)
- [ ] 2.5 Seed database with the Sésamo menu items

## 3. WhatsApp Connection

- [ ] 3.1 Implement basic Baileys connection script to generate QR code and authenticate
- [ ] 3.2 Implement event listener for incoming messages
- [ ] 3.3 Create utility functions to send text messages, lists, and buttons
- [ ] 3.4 Create utility function to download media from messages

## 4. Core Logic & State Machine

- [ ] 4.1 Implement a State Machine module that reads/writes `user_states` from SQLite
- [ ] 4.2 Route incoming messages to specific handlers based on the user's current state
- [ ] 4.3 Implement a fallback mechanism if user sends unrecognized input

## 5. Customer Order Flow

- [ ] 5.1 Implement the WELCOME handler: Show welcome message and initial menu (Order / Info)
- [ ] 5.2 Implement the MENU handler: Fetch available products and show interactive list
- [ ] 5.3 Implement the ADD_TO_CART handler: Save item, calculate partial total, ask if they want more
- [ ] 5.4 Implement the NOTES handler: Ask for and save special instructions
- [ ] 5.5 Implement the PAYMENT_REQ handler: Show total, calculate 50% advance, and request Nequi voucher

## 6. Admin Flow & Payment Validation

- [ ] 6.1 Implement `!admin` trigger specifically restricted to ADMIN_PHONE
- [ ] 6.2 Implement Admin Menu handler to view all products and their availability
- [ ] 6.3 Implement handler to toggle `available` boolean on products based on admin selection
- [ ] 6.4 Implement logic to forward voucher image from user to ADMIN_PHONE with order details
- [ ] 6.5 Implement logic to handle admin's "SÍ"/"NO" response to vouchers
- [ ] 6.6 Update order status in DB and notify the user about the final payment validation result
