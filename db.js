const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'fluidsolutions.db'));
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_name TEXT NOT NULL DEFAULT 'Mi Empresa',
  company_rut TEXT DEFAULT '',
  company_address TEXT DEFAULT '',
  company_phone TEXT DEFAULT '',
  company_email TEXT DEFAULT '',
  company_web TEXT DEFAULT '',
  logo_path TEXT DEFAULT '',
  quote_prefix TEXT DEFAULT 'COT',
  next_quote_seq TEXT DEFAULT '1',
  legal_notice TEXT DEFAULT '',
  show_brand_logos TEXT DEFAULT '1',
  bank_name TEXT DEFAULT '',
  bank_account_type TEXT DEFAULT '',
  bank_account_number TEXT DEFAULT '',
  bank_rut TEXT DEFAULT '',
  bank_holder TEXT DEFAULT '',
  bank_email TEXT DEFAULT '',
  terms_delivery TEXT DEFAULT '',
  terms_payment TEXT DEFAULT '',
  terms_startup TEXT DEFAULT '',
  terms_scope TEXT DEFAULT '',
  terms_warranty TEXT DEFAULT '',
  terms_docs TEXT DEFAULT '',
  terms_link TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE,
  name TEXT NOT NULL,
  category TEXT,
  price REAL NOT NULL DEFAULT 0,
  description TEXT,
  image_path TEXT,
  datasheet_path TEXT DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS product_specs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  section TEXT NOT NULL,
  label TEXT NOT NULL,
  value TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  rut TEXT,
  contact TEXT,
  email TEXT,
  phone TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS quotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT NOT NULL,
  client_id INTEGER REFERENCES clients(id),
  client_name TEXT,
  client_rut TEXT,
  client_contact TEXT,
  client_email TEXT,
  quote_date TEXT NOT NULL,
  validity TEXT DEFAULT '15 días',
  payment_terms TEXT,
  delivery_terms TEXT,
  notes TEXT,
  iva_rate REAL NOT NULL DEFAULT 0.19,
  status TEXT NOT NULL DEFAULT 'borrador',
  include_bank_info INTEGER NOT NULL DEFAULT 0,
  company_id INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
-- El número de cotización solo debe ser único DENTRO de cada empresa, no entre empresas
-- distintas (dos empresas usando el mismo prefijo, ej. ambas "COT-2026-0001", es normal).
CREATE UNIQUE INDEX IF NOT EXISTS idx_quotes_number_company ON quotes(number, company_id);

CREATE TABLE IF NOT EXISTS quote_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id),
  code TEXT,
  description TEXT NOT NULL,
  detail TEXT,
  image_path TEXT,
  qty REAL NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  discount_pct REAL NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS brand_logos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  image_path TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
`);

// ---------- Migraciones idempotentes ----------
try { db.exec('ALTER TABLE quotes ADD COLUMN include_bank_info INTEGER NOT NULL DEFAULT 0'); } catch (e) { /* ya existe */ }

// Multi-empresa: cada tabla de datos queda etiquetada con su empresa dueña.
// DEFAULT 1 asegura que, si la tabla ya tenía filas (instalación previa de 1 sola empresa),
// esas filas queden automáticamente asignadas a la Empresa 1 (la que se crea más abajo
// a partir de la configuración global antigua, sin perder nada de lo ya cargado).
for (const stmt of [
  'ALTER TABLE products ADD COLUMN company_id INTEGER NOT NULL DEFAULT 1',
  'ALTER TABLE quotes ADD COLUMN company_id INTEGER NOT NULL DEFAULT 1',
  'ALTER TABLE clients ADD COLUMN company_id INTEGER NOT NULL DEFAULT 1',
  'ALTER TABLE brand_logos ADD COLUMN company_id INTEGER NOT NULL DEFAULT 1',
]) {
  try { db.exec(stmt); } catch (e) { /* ya existe */ }
}

// Módulo "documento completo": datasheet PDF por producto + Términos y Condiciones por empresa.
for (const stmt of [
  "ALTER TABLE products ADD COLUMN datasheet_path TEXT DEFAULT ''",
  "ALTER TABLE companies ADD COLUMN terms_delivery TEXT DEFAULT ''",
  "ALTER TABLE companies ADD COLUMN terms_payment TEXT DEFAULT ''",
  "ALTER TABLE companies ADD COLUMN terms_startup TEXT DEFAULT ''",
  "ALTER TABLE companies ADD COLUMN terms_scope TEXT DEFAULT ''",
  "ALTER TABLE companies ADD COLUMN terms_warranty TEXT DEFAULT ''",
  "ALTER TABLE companies ADD COLUMN terms_docs TEXT DEFAULT ''",
  "ALTER TABLE companies ADD COLUMN terms_link TEXT DEFAULT ''",
]) {
  try { db.exec(stmt); } catch (e) { /* ya existe */ }
}

// Carta de presentación (opcional, por empresa): algunas empresas del usuario la usan
// (ej. Importparts SPA, con un párrafo fijo sobre acuerdos/garantías) y otras no (Fluid
// Solutions no la tenía). Vacío = no se genera esa página en el Documento Completo.
for (const stmt of [
  "ALTER TABLE companies ADD COLUMN letter_intro TEXT DEFAULT ''",
  "ALTER TABLE companies ADD COLUMN letter_signer_name TEXT DEFAULT ''",
  "ALTER TABLE companies ADD COLUMN letter_signer_role TEXT DEFAULT ''",
]) {
  try { db.exec(stmt); } catch (e) { /* ya existe */ }
}

// Datos de contacto ampliados (letterhead de la cotización): 2° teléfono, 2° correo,
// direcciones adicionales e Instagram. Todo opcional; se muestra solo lo que esté cargado.
for (const stmt of [
  "ALTER TABLE companies ADD COLUMN company_phone2 TEXT DEFAULT ''",
  "ALTER TABLE companies ADD COLUMN company_email2 TEXT DEFAULT ''",
  "ALTER TABLE companies ADD COLUMN company_address2 TEXT DEFAULT ''",
  "ALTER TABLE companies ADD COLUMN company_address3 TEXT DEFAULT ''",
  "ALTER TABLE companies ADD COLUMN company_instagram TEXT DEFAULT ''",
]) {
  try { db.exec(stmt); } catch (e) { /* ya existe */ }
}

// Interruptor por empresa para habilitar el "Documento completo" (función opcional/premium).
// Por defecto apagado ('0'): se activa desde Configuración cuando el cliente lo contrata.
for (const stmt of [
  "ALTER TABLE companies ADD COLUMN enable_full_document TEXT DEFAULT '0'",
]) {
  try { db.exec(stmt); } catch (e) { /* ya existe */ }
}

// Términos y Condiciones por cotización: NULL = usa el valor por defecto de la empresa,
// texto = anula el de la empresa solo para este documento (ej. una licitación pide una
// redacción distinta de garantía, sin tener que tocar la configuración general).
for (const stmt of [
  'ALTER TABLE quotes ADD COLUMN terms_delivery TEXT',
  'ALTER TABLE quotes ADD COLUMN terms_payment TEXT',
  'ALTER TABLE quotes ADD COLUMN terms_startup TEXT',
  'ALTER TABLE quotes ADD COLUMN terms_scope TEXT',
  'ALTER TABLE quotes ADD COLUMN terms_warranty TEXT',
  'ALTER TABLE quotes ADD COLUMN terms_docs TEXT',
  'ALTER TABLE quotes ADD COLUMN terms_link TEXT',
]) {
  try { db.exec(stmt); } catch (e) { /* ya existe */ }
}

// Migración: instalaciones creadas antes del modo multi-empresa quedaron con "number"
// único en TODA la tabla (arrastrado de cuando solo existía 1 empresa). Hay que reconstruir
// la tabla para que la unicidad sea (number, company_id) — si no, dos empresas con el mismo
// prefijo de cotización (ej. ambas "COT") pueden chocar y una de las dos cotizaciones falla.
const badIndex = db.prepare(`
  SELECT il.name FROM pragma_index_list('quotes') il
  WHERE il."unique" = 1
    AND (SELECT COUNT(*) FROM pragma_index_info(il.name)) = 1
    AND (SELECT name FROM pragma_index_info(il.name)) = 'number'
`).get();
if (badIndex) {
  db.exec('BEGIN');
  try {
    db.exec(`
      CREATE TABLE quotes_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        number TEXT NOT NULL,
        client_id INTEGER REFERENCES clients(id),
        client_name TEXT,
        client_rut TEXT,
        client_contact TEXT,
        client_email TEXT,
        quote_date TEXT NOT NULL,
        validity TEXT DEFAULT '15 días',
        payment_terms TEXT,
        delivery_terms TEXT,
        notes TEXT,
        iva_rate REAL NOT NULL DEFAULT 0.19,
        status TEXT NOT NULL DEFAULT 'borrador',
        include_bank_info INTEGER NOT NULL DEFAULT 0,
        company_id INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      );
    `);
    db.exec(`
      INSERT INTO quotes_new (id, number, client_id, client_name, client_rut, client_contact, client_email,
        quote_date, validity, payment_terms, delivery_terms, notes, iva_rate, status, include_bank_info,
        company_id, created_at, updated_at)
      SELECT id, number, client_id, client_name, client_rut, client_contact, client_email,
        quote_date, validity, payment_terms, delivery_terms, notes, iva_rate, status, include_bank_info,
        company_id, created_at, updated_at
      FROM quotes;
    `);
    db.exec('DROP TABLE quotes');
    db.exec('ALTER TABLE quotes_new RENAME TO quotes');
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_quotes_number_company ON quotes(number, company_id)');
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

// Asegura que exista al menos una empresa. Si esto es una instalación previa de una sola
// empresa (tenía datos en la vieja tabla "settings"), la Empresa 1 se crea a partir de esos
// datos para no perder nada. Si es instalación nueva, se crea una empresa en blanco.
const companyCount = db.prepare('SELECT COUNT(*) AS n FROM companies').get().n;
if (companyCount === 0) {
  const getOldSetting = db.prepare('SELECT value FROM settings WHERE key = ?');
  const old = (key, fallback) => { const r = getOldSetting.get(key); return r ? r.value : fallback; };
  db.prepare(`
    INSERT INTO companies (
      company_name, company_rut, company_address, company_phone, company_email, company_web,
      logo_path, quote_prefix, next_quote_seq, legal_notice, show_brand_logos,
      bank_name, bank_account_type, bank_account_number, bank_rut, bank_holder, bank_email
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    old('company_name', 'Mi Empresa'), old('company_rut', ''), old('company_address', ''),
    old('company_phone', ''), old('company_email', ''), old('company_web', ''),
    old('logo_path', ''), old('quote_prefix', 'COT'), old('next_quote_seq', '1'),
    old('legal_notice', ''), old('show_brand_logos', '1'),
    old('bank_name', ''), old('bank_account_type', ''), old('bank_account_number', ''),
    old('bank_rut', ''), old('bank_holder', ''), old('bank_email', '')
  );
}

module.exports = db;
