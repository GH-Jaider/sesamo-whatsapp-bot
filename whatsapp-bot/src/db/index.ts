import Database, { Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let db: DatabaseType | null = null;

/**
 * Returns the singleton DB instance.
 * Must be called after initDb().
 */
export function getDb(): DatabaseType {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}

export const initDb = () => {
  if (db) return; // Already initialized

  // Ensure the data directory exists
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  db = new Database(path.join(dataDir, 'sesamo.db'), {
    verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
  });

  db.pragma('journal_mode = WAL'); // Better concurrency

  // Create products table
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      price INTEGER NOT NULL,
      category TEXT NOT NULL,
      available INTEGER DEFAULT 1
    )
  `);

  // Create orders table
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_phone TEXT NOT NULL,
      total INTEGER NOT NULL,
      status TEXT NOT NULL,
      notes TEXT,
      advance_paid INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create user_states table
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_states (
      phone TEXT PRIMARY KEY,
      current_step TEXT NOT NULL,
      cart_data TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  seedDb(db);
};

const seedDb = (db: DatabaseType) => {
  // Check if we already have products
  const count = db.prepare('SELECT count(*) as count FROM products').get() as { count: number };
  if (count.count > 0) return;

  const insert = db.prepare(
    'INSERT INTO products (id, name, description, price, category, available) VALUES (?, ?, ?, ?, ?, ?)',
  );

  const seedProducts = [
    {
      id: '1',
      name: 'Sésamo Classic',
      description: 'Nuestra burger clásica con extra queso',
      price: 20000,
      category: 'Hamburguesas',
      available: 1,
    },
    {
      id: '2',
      name: 'Sésamo Doble',
      description: 'Doble carne, doble sabor',
      price: 25000,
      category: 'Hamburguesas',
      available: 1,
    },
    {
      id: '3',
      name: 'Papas Fritas',
      description: 'Crujientes papas fritas',
      price: 6000,
      category: 'Acompañamientos',
      available: 1,
    },
    {
      id: '4',
      name: 'Limonada',
      description: 'Limonada natural',
      price: 5000,
      category: 'Bebidas',
      available: 1,
    },
  ];

  db.transaction(() => {
    for (const p of seedProducts) {
      insert.run(p.id, p.name, p.description, p.price, p.category, p.available);
    }
  })();
};
