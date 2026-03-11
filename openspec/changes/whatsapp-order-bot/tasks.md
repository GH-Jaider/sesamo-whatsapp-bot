## 1. Setup & Environment

- [x] 1.1 Initialize Node.js project and `package.json`
- [x] 1.2 Install necessary dependencies (`@whiskeysockets/baileys`, `sqlite3` or `better-sqlite3`, `dotenv`, etc.)
- [x] 1.3 Setup TypeScript environment and tsconfig (if using TS)
- [x] 1.4 Create `.env` template file to store configuration like ADMIN_PHONE and NEQUI_NUMBER

## 2. Database Implementation

- [x] 2.1 Set up SQLite database connection instance
- [x] 2.2 Create schema/migration for `products` table (id, name, description, price, category, available)
- [x] 2.3 Create schema/migration for `orders` table (id, customer_phone, total, status, notes, advance_paid)
- [x] 2.4 Create schema/migration for `user_states` table (phone, current_step, cart_data)
- [x] 2.5 Seed database with the Sésamo menu items

## 3. WhatsApp Connection

- [x] 3.1 Implement basic Baileys connection script to generate QR code and authenticate
- [x] 3.2 Implement event listener for incoming messages
- [x] 3.3 Create utility functions to send text messages, lists, and buttons
- [x] 3.4 Create utility function to download media from messages

## 4. Core Logic & State Machine

- [x] 4.1 Implement a State Machine module that reads/writes `user_states` from SQLite
- [x] 4.2 Route incoming messages to specific handlers based on the user's current state
- [x] 4.3 Implement a fallback mechanism if user sends unrecognized input

## 5. Customer Order Flow

- [x] 5.1 Implement the WELCOME handler: Show welcome message and initial menu (Order / Info)
- [x] 5.2 Implement the MENU handler: Fetch available products and show interactive list
- [x] 5.3 Implement the ADD_TO_CART handler: Save item, calculate partial total, ask if they want more
- [x] 5.4 Implement the NOTES handler: Ask for and save special instructions
- [x] 5.5 Implement the PAYMENT_REQ handler: Show total, calculate 50% advance, and request Nequi voucher

## 6. Admin Flow & Payment Validation

- [x] 6.1 Implement `!admin` trigger specifically restricted to ADMIN_PHONE
- [x] 6.2 Implement Admin Menu handler to view all products and their availability
- [x] 6.3 Implement handler to toggle `available` boolean on products based on admin selection
- [x] 6.4 Implement logic to forward voucher image from user to ADMIN_PHONE with order details
- [x] 6.5 Implement logic to handle admin's "SÍ"/"NO" response to vouchers
- [x] 6.6 Update order status in DB and notify the user about the final payment validation result
