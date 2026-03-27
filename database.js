const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const db = new sqlite3.Database(path.join(__dirname, "inventory.db"));
const dbAsync = {
  run: (sql, params = []) =>
    new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this);
      });
    }),
  get: (sql, params = []) =>
    new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    }),
  all: (sql, params = []) =>
    new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    }),
  // Expõe o objeto original para casos específicos (ex: serialize)
  raw: db,
};

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS brands (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE
    )`);

  db.run(`CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE
    )`);

  db.run(`CREATE TABLE IF NOT EXISTS brand_categories (
        brand_id INTEGER,
        category_id INTEGER,
        PRIMARY KEY (brand_id, category_id),
        FOREIGN KEY(brand_id) REFERENCES brands(id),
        FOREIGN KEY(category_id) REFERENCES categories(id)
    )`);

  db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        barcode TEXT UNIQUE,
        code TEXT,
        name TEXT,
        brand_id INTEGER,
        category_id INTEGER,
        price REAL,
        stock INTEGER,
        FOREIGN KEY(brand_id) REFERENCES brands(id),
        FOREIGN KEY(category_id) REFERENCES categories(id)
    )`);

  // Customers
  db.run(`CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        phone TEXT,
        balance REAL DEFAULT 0
    )`);

  // Sales (New: discount column)
  db.run(`CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER,
        total REAL,
        discount REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(customer_id) REFERENCES customers(id)
    )`);

  // Sale Items
  db.run(`CREATE TABLE IF NOT EXISTS sale_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER,
        product_id INTEGER,
        quantity INTEGER,
        price REAL,
        FOREIGN KEY(sale_id) REFERENCES sales(id),
        FOREIGN KEY(product_id) REFERENCES products(id)
    )`);

  db.run(`CREATE TABLE IF NOT EXISTS customer_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER,
        amount REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(customer_id) REFERENCES customers(id)
    )`);

  const initialBrands = [
    "Natura",
    "Eudora",
    "O Boticário",
    "Mary Kay",
    "Avon",
    "De Millus",
    "Cacau Show",
  ];

  const initialCategories = [
    "Creme",
    "Refil",
    "Perfume",
    "Sabonete Barra",
    "Shampoo",
    "Condicionador",
    "Sabonete Líq.",
    "Desodorante Roll-on",
    "Desodorante Spray",
    "Trufa",
    "Barra de Chocolate",
    "Barrinha de Chocolate",
    "Tablete de Chocolate",
    "Ovo de Páscoa",
    "Panettone",
  ];

  // Prepara a query uma vez para ser mais performático
  const stmtBrand = db.prepare(
    "INSERT OR IGNORE INTO brands (name) VALUES (?)",
  );
  initialBrands.forEach((brand) => {
    stmtBrand.run(brand);
  });
  stmtBrand.finalize();

  const stmtCat = db.prepare(
    "INSERT OR IGNORE INTO categories (name) VALUES (?)",
  );
  initialCategories.forEach((category) => {
    stmtCat.run(category);
  });
  stmtCat.finalize();

  // Migrations safe check
  db.run("ALTER TABLE sales ADD COLUMN discount REAL DEFAULT 0", (err) => {
    // Ignore error if column exists
  });
  db.run(`CREATE TABLE IF NOT EXISTS cycles (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        brand_id   INTEGER NOT NULL,
        name       TEXT    NOT NULL,
        start_date TEXT    NOT NULL,
        end_date   TEXT    NOT NULL,
        UNIQUE(brand_id, name),
        FOREIGN KEY(brand_id) REFERENCES brands(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS product_cycle_prices (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id  INTEGER NOT NULL,
    cycle_id    INTEGER NOT NULL,
    promo_price REAL    NOT NULL,
    UNIQUE(product_id, cycle_id),        -- INSERT OR REPLACE é idempotente
    FOREIGN KEY(product_id) REFERENCES products(id),
    FOREIGN KEY(cycle_id)   REFERENCES cycles(id)
  )`)
  db.run(`CREATE TABLE IF NOT EXISTS product_identifiers (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    type       TEXT    NOT NULL CHECK(type IN ('barcode', 'code')),
    value      TEXT    NOT NULL,
    UNIQUE(type, value),
    FOREIGN KEY(product_id) REFERENCES products(id)
  )`);

  db.run(
    "CREATE INDEX IF NOT EXISTS idx_product_identifiers_lookup ON product_identifiers(type, value)",
  );
  db.run(`INSERT OR IGNORE INTO product_identifiers (product_id, type, value) 
        SELECT id, 'barcode', barcode FROM products WHERE barcode IS NOT NULL`);
  db.run(`INSERT OR IGNORE INTO product_identifiers (product_id, type, value)
        SELECT id, 'code', code FROM products WHERE code IS NOT NULL AND code != ''`);

  // Populate Brand-Category Relationships (Idempotent approach)
  // Map Brands to Categories
  const brandCategoryMap = {
    "Cacau Show": [
      "Trufa",
      "Barra de Chocolate",
      "Barrinha de Chocolate",
      "Tablete de Chocolate",
      "Ovo de Páscoa",
      "Panettone",
    ],
    Natura: [
      "Creme",
      "Refil",
      "Perfume",
      "Sabonete Barra",
      "Shampoo",
      "Condicionador",
      "Sabonete Líq.",
      "Desodorante Roll-on",
      "Desodorante Spray",
    ],
    Eudora: [
      "Creme",
      "Refil",
      "Perfume",
      "Sabonete Barra",
      "Shampoo",
      "Condicionador",
      "Sabonete Líq.",
      "Desodorante Roll-on",
      "Desodorante Spray",
    ],
    "O Boticário": [
      "Creme",
      "Refil",
      "Perfume",
      "Sabonete Barra",
      "Shampoo",
      "Condicionador",
      "Sabonete Líq.",
      "Desodorante Roll-on",
      "Desodorante Spray",
    ],
    "Mary Kay": [
      "Creme",
      "Refil",
      "Perfume",
      "Sabonete Barra",
      "Shampoo",
      "Condicionador",
      "Sabonete Líq.",
      "Desodorante Roll-on",
      "Desodorante Spray",
    ],
    Avon: [
      "Creme",
      "Refil",
      "Perfume",
      "Sabonete Barra",
      "Shampoo",
      "Condicionador",
      "Sabonete Líq.",
      "Desodorante Roll-on",
      "Desodorante Spray",
    ],
  };

  const stmtLink = db.prepare(`
        INSERT OR IGNORE INTO brand_categories (brand_id, category_id)
        SELECT b.id, c.id FROM brands b, categories c
        WHERE b.name = ? AND c.name = ?
    `);

  Object.entries(brandCategoryMap).forEach(([brand, categories]) => {
    categories.forEach((cat) => {
      stmtLink.run(brand, cat);
    });
  });
  stmtLink.finalize();

  console.log("Banco de dados verificado/recriado com sucesso.");
});

module.exports = dbAsync;