import dotenv from 'dotenv';
dotenv.config();

import { serve } from '@hono/node-server';
import { initDb } from '@/db/index';
import { app } from '@/whatsapp/webhook';

// ---------------------------------------------------------------------------
// Env var validation
// ---------------------------------------------------------------------------

const REQUIRED_ENV = ['WA_PHONE_NUMBER_ID', 'WA_ACCESS_TOKEN', 'WA_VERIFY_TOKEN'] as const;

function validateEnv(): void {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    console.error('See .env.template for details.');
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  validateEnv();

  console.log('Initializing database...');
  await initDb();

  const port = parseInt(process.env.PORT || '3000', 10);

  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`Server listening on port ${info.port}`);
  });
}

main().catch((err) => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
