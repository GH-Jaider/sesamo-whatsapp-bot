import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';

let db: SqlJsDatabase | null = null;
let dbPath: string;

/**
 * Wrapper: run a query that modifies data (INSERT, UPDATE, DELETE).
 * Automatically saves to disk after each write.
 * Returns { lastInsertRowid }.
 */
export function dbRun(sql: string, params: any[] = []): { lastInsertRowid: number } {
  const d = getDb();
  d.run(sql, params);
  const result = d.exec('SELECT last_insert_rowid() as id');
  const lastId = (result[0]?.values[0]?.[0] as number) ?? 0;
  saveDb();
  return { lastInsertRowid: lastId };
}

/**
 * Wrapper: get a single row. Returns the row as an object, or undefined.
 */
export function dbGet<T = Record<string, any>>(sql: string, params: any[] = []): T | undefined {
  const d = getDb();
  const stmt = d.prepare(sql);
  stmt.bind(params);

  if (stmt.step()) {
    const columns = stmt.getColumnNames();
    const values = stmt.get();
    const row: Record<string, any> = {};
    columns.forEach((col, i) => {
      row[col] = values[i];
    });
    stmt.free();
    return row as T;
  }

  stmt.free();
  return undefined;
}

/**
 * Wrapper: get all rows. Returns an array of objects.
 */
export function dbAll<T = Record<string, any>>(sql: string, params: any[] = []): T[] {
  const d = getDb();
  const stmt = d.prepare(sql);
  stmt.bind(params);

  const rows: T[] = [];
  const columns = stmt.getColumnNames();

  while (stmt.step()) {
    const values = stmt.get();
    const row: Record<string, any> = {};
    columns.forEach((col, i) => {
      row[col] = values[i];
    });
    rows.push(row as T);
  }

  stmt.free();
  return rows;
}

/**
 * Returns the singleton DB instance (raw sql.js Database).
 * Must be called after initDb().
 */
export function getDb(): SqlJsDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}

/** Save the in-memory database to disk. */
function saveDb() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

export const initDb = async () => {
  if (db) return;

  // Ensure the data directory exists
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  dbPath = path.join(dataDir, 'sesamo.db');

  const SQL = await initSqlJs();

  // Load existing database file if it exists
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      price INTEGER NOT NULL,
      category TEXT NOT NULL,
      available INTEGER DEFAULT 1
    )
  `);

  db.run(`
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

  db.run(`
    CREATE TABLE IF NOT EXISTS user_states (
      phone TEXT PRIMARY KEY,
      current_step TEXT NOT NULL,
      cart_data TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  seedDb();
  saveDb();
};

const seedDb = () => {
  const result = dbGet<{ count: number }>('SELECT count(*) as count FROM products');
  if (result && result.count > 0) return;

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

  for (const p of seedProducts) {
    dbRun(
      'INSERT INTO products (id, name, description, price, category, available) VALUES (?, ?, ?, ?, ?, ?)',
      [p.id, p.name, p.description, p.price, p.category, p.available],
    );
  }
};
