import dotenv from 'dotenv';
dotenv.config();

import { initDb } from '@/db';
import { connectToWhatsApp } from '@/whatsapp/connection';

async function main() {
  console.log('Initializing Database...');
  initDb();

  console.log('Connecting to WhatsApp...');
  await connectToWhatsApp();
}

main().catch((err) => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
