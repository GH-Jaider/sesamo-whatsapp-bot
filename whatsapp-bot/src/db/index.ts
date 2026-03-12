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

  // --- Categories ---
  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      display_order INTEGER NOT NULL,
      description TEXT
    )
  `);

  // --- Menu Items ---
  db.run(`
    CREATE TABLE IF NOT EXISTS menu_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL REFERENCES categories(id),
      name TEXT NOT NULL,
      description TEXT,
      price INTEGER NOT NULL,
      available INTEGER DEFAULT 1,
      display_order INTEGER NOT NULL
    )
  `);

  // --- Item Options (sub-options and add-ons) ---
  db.run(`
    CREATE TABLE IF NOT EXISTS item_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      menu_item_id INTEGER NOT NULL REFERENCES menu_items(id),
      option_group TEXT NOT NULL,
      name TEXT NOT NULL,
      price INTEGER NOT NULL DEFAULT 0,
      available INTEGER NOT NULL DEFAULT 1,
      display_order INTEGER NOT NULL
    )
  `);

  // Migrate existing item_options table: add available column if missing
  try {
    db.run(`ALTER TABLE item_options ADD COLUMN available INTEGER NOT NULL DEFAULT 1`);
  } catch {
    // Column already exists
  }

  // --- Orders ---
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_phone TEXT NOT NULL,
      total INTEGER NOT NULL,
      status TEXT NOT NULL,
      notes TEXT,
      advance_paid INTEGER NOT NULL,
      delivery_mode TEXT NOT NULL DEFAULT 'dine_in',
      scheduled_time TEXT,
      voucher_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migrate existing orders table: add columns if missing
  try {
    db.run(`ALTER TABLE orders ADD COLUMN delivery_mode TEXT NOT NULL DEFAULT 'dine_in'`);
  } catch {
    // Column already exists
  }
  try {
    db.run(`ALTER TABLE orders ADD COLUMN scheduled_time TEXT`);
  } catch {
    // Column already exists
  }
  try {
    db.run(`ALTER TABLE orders ADD COLUMN voucher_path TEXT`);
  } catch {
    // Column already exists
  }

  // --- Order Items (denormalized line items) ---
  db.run(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id),
      menu_item_id INTEGER NOT NULL,
      item_name TEXT NOT NULL,
      item_price INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      options_json TEXT
    )
  `);

  // --- User States ---
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
  // Only seed if categories table is empty
  const result = dbGet<{ count: number }>('SELECT count(*) as count FROM categories');
  if (result && result.count > 0) return;

  // --- Categories ---
  const categories = [
    {
      id: 1,
      name: 'Desayunos',
      order: 1,
      desc: 'El Amanecer — para empezar la mañana frente al frío del Neusa',
    },
    {
      id: 2,
      name: 'Almuerzos',
      order: 2,
      desc: 'Almuerzos de la Finca — el clásico almuerzo elevado con técnica de chef',
    },
    {
      id: 3,
      name: 'Truchas',
      order: 3,
      desc: 'Nuestras Truchas — frescas, de los pozos de Sésamo',
    },
    { id: 4, name: 'Carnes y Pollos', order: 4, desc: 'Cortes clásicos con sabor contundente' },
    { id: 5, name: 'Bebidas', order: 5, desc: 'Jarras de limonada — el toque natural perfecto' },
    {
      id: 6,
      name: 'Lácteos de Cabra',
      order: 6,
      desc: 'Directo de nuestro rebaño, elaborados artesanalmente',
    },
  ];

  for (const c of categories) {
    dbRun('INSERT INTO categories (id, name, display_order, description) VALUES (?, ?, ?, ?)', [
      c.id,
      c.name,
      c.order,
      c.desc,
    ]);
  }

  // --- Menu Items ---
  // Desayunos (cat 1)
  dbRun(
    'INSERT INTO menu_items (category_id, name, description, price, available, display_order) VALUES (?, ?, ?, ?, ?, ?)',
    [
      1,
      'Tradicional Sésamo',
      'Arepa, huevos revueltos y bebida caliente (chocolate o café)',
      18000,
      1,
      1,
    ],
  );

  // Almuerzos (cat 2)
  dbRun(
    'INSERT INTO menu_items (category_id, name, description, price, available, display_order) VALUES (?, ?, ?, ?, ?, ?)',
    [
      2,
      'Menú de la Casa',
      'Arroz, ensalada fresca, patacón y yuca frita. Elige tu proteína',
      35000,
      1,
      1,
    ],
  );

  // Truchas (cat 3)
  // Names kept <=24 chars for WhatsApp row titles
  const truchas = [
    { name: 'A la plancha', price: 40000 },
    { name: 'A la plancha gratinada', price: 42000 },
    { name: 'Al ajillo gratinada', price: 44000 },
    { name: 'A la mandarina gratinada', price: 47000 },
    { name: 'Al pimentón gratinada', price: 47000 },
    { name: 'Salsa ciruela gratinada', price: 47000 },
    { name: 'Con champiñones', price: 48000 },
    { name: 'Con camarón y palmitos', price: 50000 },
    { name: 'Marinera Sésamo', price: 52000 },
  ];
  truchas.forEach((t, i) => {
    dbRun(
      'INSERT INTO menu_items (category_id, name, description, price, available, display_order) VALUES (?, ?, ?, ?, ?, ?)',
      [3, t.name, 'Patacón, yuca frita, arroz y ensalada', t.price, 1, i + 1],
    );
  });

  // Carnes y Pollos (cat 4)
  // Names kept <=24 chars for WhatsApp row titles; description carries full detail
  const carnes = [
    { name: 'Pechuga a la plancha', price: 40000, desc: 'Patacón, yuca frita, arroz y ensalada' },
    {
      name: 'Lomo cerdo a la plancha',
      price: 40000,
      desc: 'Patacón, yuca frita, arroz y ensalada',
    },
    {
      name: 'Pechuga salsa ciruela',
      price: 43000,
      desc: 'Gratinada — patacón, yuca frita, arroz y ensalada',
    },
    {
      name: 'Lomo cerdo c/champiñones',
      price: 43000,
      desc: 'Gratinado — patacón, yuca frita, arroz y ensalada',
    },
    {
      name: 'Churrasco a la parrilla',
      price: 45000,
      desc: 'Patacón, yuca frita, arroz y ensalada',
    },
    {
      name: 'Pechuga c/champiñones',
      price: 45000,
      desc: 'Gratinada — patacón, yuca frita, arroz y ensalada',
    },
    { name: 'Churrasco gratinado', price: 47000, desc: 'Patacón, yuca frita, arroz y ensalada' },
    {
      name: 'Churrasco c/champiñones',
      price: 50000,
      desc: 'Gratinado — patacón, yuca frita, arroz y ensalada',
    },
  ];
  carnes.forEach((c, i) => {
    dbRun(
      'INSERT INTO menu_items (category_id, name, description, price, available, display_order) VALUES (?, ?, ?, ?, ?, ?)',
      [4, c.name, c.desc, c.price, 1, i + 1],
    );
  });

  // Bebidas (cat 5)
  const bebidas = [
    { name: 'Limonada Natural', price: 10000 },
    { name: 'Limonada de Yerbabuena', price: 15000 },
    { name: 'Limonada de Menta', price: 15000 },
  ];
  bebidas.forEach((b, i) => {
    dbRun(
      'INSERT INTO menu_items (category_id, name, description, price, available, display_order) VALUES (?, ?, ?, ?, ?, ?)',
      [5, b.name, 'Jarra de limonada', b.price, 1, i + 1],
    );
  });

  // Lácteos de Cabra (cat 6)
  dbRun(
    'INSERT INTO menu_items (category_id, name, description, price, available, display_order) VALUES (?, ?, ?, ?, ?, ?)',
    [6, 'Queso de Cabra', 'Por libra — artesanal de nuestro rebaño', 30000, 1, 1],
  );
  dbRun(
    'INSERT INTO menu_items (category_id, name, description, price, available, display_order) VALUES (?, ?, ?, ?, ?, ?)',
    [6, 'Leche de Cabra', 'Por litro — fresca y natural', 11000, 1, 2],
  );

  // --- Item Options ---
  // Almuerzo protein choices (menu_item_id = 2, the almuerzo)
  const almuerzoId = dbGet<{ id: number }>(
    "SELECT id FROM menu_items WHERE name = 'Menú de la Casa' AND category_id = 2",
  )!.id;

  const proteinas = ['Pechuga de pollo', 'Pierna pernil', 'Lomo de cerdo', 'Carne de res'];
  proteinas.forEach((p, i) => {
    dbRun(
      'INSERT INTO item_options (menu_item_id, option_group, name, price, display_order) VALUES (?, ?, ?, ?, ?)',
      [almuerzoId, 'proteina', p, 0, i + 1],
    );
  });

  // Desayuno options (menu_item_id for the desayuno)
  const desayunoId = dbGet<{ id: number }>(
    "SELECT id FROM menu_items WHERE name = 'Tradicional Sésamo' AND category_id = 1",
  )!.id;

  dbRun(
    'INSERT INTO item_options (menu_item_id, option_group, name, price, display_order) VALUES (?, ?, ?, ?, ?)',
    [desayunoId, 'adicional', 'Caldo de Costilla', 14000, 1],
  );
  dbRun(
    'INSERT INTO item_options (menu_item_id, option_group, name, price, display_order) VALUES (?, ?, ?, ?, ?)',
    [desayunoId, 'adicional', 'Changua', 12000, 2],
  );

  // Desayuno beverage choice (included in price)
  dbRun(
    'INSERT INTO item_options (menu_item_id, option_group, name, price, display_order) VALUES (?, ?, ?, ?, ?)',
    [desayunoId, 'bebida', 'Chocolate', 0, 1],
  );
  dbRun(
    'INSERT INTO item_options (menu_item_id, option_group, name, price, display_order) VALUES (?, ?, ?, ?, ?)',
    [desayunoId, 'bebida', 'Café', 0, 2],
  );
};
