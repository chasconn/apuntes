const path = require('path');
const fs = require('fs');

// ---------- Candado de instancia única ----------
// Dos procesos Node abriendo el mismo archivo SQLite al mismo tiempo pueden corromper
// la base de datos (pasó durante el desarrollo: un doble clic accidental + el inicio
// automático corriendo a la vez). Por eso esto se revisa ANTES de tocar la base de datos
// (antes de require('./db')), para que la segunda instancia se cierre sin escribir nada.
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const LOCK_FILE = path.join(DATA_DIR, '.server.lock');

function isProcessAlive(pid) {
  try { process.kill(pid, 0); return true; } catch (e) { return false; }
}

if (fs.existsSync(LOCK_FILE)) {
  const existingPid = parseInt(fs.readFileSync(LOCK_FILE, 'utf8').trim(), 10);
  if (existingPid && isProcessAlive(existingPid)) {
    console.error('\n  El cotizador ya está corriendo en este equipo (proceso ' + existingPid + ').');
    console.error('  No lo abra dos veces a la vez — puede dañar los datos guardados.');
    console.error('  Cierre esta ventana; ya puede usar el cotizador desde el navegador.\n');
    process.exit(1);
  }
  // el candado quedó de una sesión anterior que no cerró bien (ej. corte de luz); se reemplaza
}
fs.writeFileSync(LOCK_FILE, String(process.pid));
function releaseLock() { try { fs.unlinkSync(LOCK_FILE); } catch (e) { /* ya no está */ } }
process.on('exit', releaseLock);
process.on('SIGINT', () => { releaseLock(); process.exit(0); });
process.on('SIGTERM', () => { releaseLock(); process.exit(0); });

const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const puppeteer = require('puppeteer');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 8090;
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOAD_DIR));

// ---------- Empresa activa ----------
// El frontend manda la empresa con la que está trabajando en el header X-Company-Id.
// Si no la manda (o es inválida), se usa la primera empresa como respaldo seguro.
function getCompanyId(req) {
  const raw = req.get('X-Company-Id');
  const id = parseInt(raw, 10);
  if (id && db.prepare('SELECT id FROM companies WHERE id=?').get(id)) return id;
  return db.prepare('SELECT id FROM companies ORDER BY id LIMIT 1').get().id;
}

// ---------- Upload (imágenes de producto, logos) ----------
const ALLOWED_IMAGE_TYPES = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/svg+xml': '.svg' };
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = ALLOWED_IMAGE_TYPES[file.mimetype];
    if (!ext) return cb(new Error('Formato de imagen no soportado (usa PNG, JPG, WEBP o SVG)'));
    cb(null, 'img_' + crypto.randomBytes(8).toString('hex') + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = Object.keys(ALLOWED_IMAGE_TYPES).includes(file.mimetype);
    cb(ok ? null : new Error('Formato de imagen no soportado (usa PNG, JPG, WEBP o SVG)'), ok);
  }
});

app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió imagen' });
  res.json({ path: '/uploads/' + req.file.filename });
});

// ---------- Upload (datasheet PDF del fabricante, por producto) ----------
const uploadPdfStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, 'datasheet_' + crypto.randomBytes(8).toString('hex') + '.pdf')
});
const uploadPdf = multer({
  storage: uploadPdfStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype === 'application/pdf';
    cb(ok ? null : new Error('El datasheet debe ser un archivo PDF'), ok);
  }
});

app.post('/api/upload-pdf', uploadPdf.single('pdf'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió el PDF' });
  res.json({ path: '/uploads/' + req.file.filename });
});

// ---------- Empresas ----------
const COMPANY_FIELDS = [
  'company_name', 'company_rut', 'company_address', 'company_phone', 'company_email', 'company_web',
  'logo_path', 'quote_prefix', 'next_quote_seq', 'legal_notice', 'show_brand_logos',
  'bank_name', 'bank_account_type', 'bank_account_number', 'bank_rut', 'bank_holder', 'bank_email',
  'terms_delivery', 'terms_payment', 'terms_startup', 'terms_scope', 'terms_warranty', 'terms_docs', 'terms_link',
  'letter_intro', 'letter_signer_name', 'letter_signer_role',
  'company_phone2', 'company_email2', 'company_address2', 'company_address3', 'company_instagram',
  'enable_full_document'
];

// Estos 7 campos existen a nivel empresa (valor por defecto) y a nivel cotización (anula el
// de la empresa solo para ese documento). En la cotización se guardan como NULL/'' cuando no
// hay anulación — así el documento siempre hereda el valor vigente de la empresa.
const TERMS_FIELDS = ['terms_delivery', 'terms_payment', 'terms_startup', 'terms_scope', 'terms_warranty', 'terms_docs', 'terms_link'];

app.get('/api/companies', (req, res) => {
  res.json(db.prepare('SELECT id, company_name, logo_path FROM companies ORDER BY id').all());
});

app.post('/api/companies', (req, res) => {
  const name = (req.body.company_name || '').trim() || 'Nueva empresa';
  const info = db.prepare('INSERT INTO companies (company_name) VALUES (?)').run(name);
  res.json({ id: Number(info.lastInsertRowid) });
});

app.delete('/api/companies/:id', (req, res) => {
  const total = db.prepare('SELECT COUNT(*) AS n FROM companies').get().n;
  if (total <= 1) return res.status(400).json({ error: 'No puede eliminar la única empresa' });
  db.prepare('DELETE FROM companies WHERE id=?').run(req.params.id);
  db.prepare('DELETE FROM products WHERE company_id=?').run(req.params.id);
  db.prepare('DELETE FROM quotes WHERE company_id=?').run(req.params.id);
  db.prepare('DELETE FROM clients WHERE company_id=?').run(req.params.id);
  db.prepare('DELETE FROM brand_logos WHERE company_id=?').run(req.params.id);
  res.json({ ok: true });
});

// ---------- Settings (de la empresa activa) ----------
app.get('/api/settings', (req, res) => {
  const companyId = getCompanyId(req);
  const row = db.prepare('SELECT * FROM companies WHERE id=?').get(companyId);
  if (!row) return res.status(404).json({ error: 'Empresa no encontrada' });
  const obj = {};
  for (const f of COMPANY_FIELDS) obj[f] = row[f] ?? '';
  obj.company_id = row.id;
  res.json(obj);
});

app.put('/api/settings', (req, res) => {
  const companyId = getCompanyId(req);
  const fields = COMPANY_FIELDS.filter(f => f in (req.body || {}));
  if (!fields.length) return res.json({ ok: true });
  const setClause = fields.map(f => `${f}=?`).join(', ');
  const values = fields.map(f => String(req.body[f] ?? ''));
  db.prepare(`UPDATE companies SET ${setClause} WHERE id=?`).run(...values, companyId);
  res.json({ ok: true });
});

// ---------- Proveedores (logos para la franja de confianza) ----------
app.get('/api/brand-logos', (req, res) => {
  const companyId = getCompanyId(req);
  res.json(db.prepare('SELECT * FROM brand_logos WHERE company_id=? ORDER BY sort_order, id').all(companyId));
});

app.post('/api/brand-logos', (req, res) => {
  const companyId = getCompanyId(req);
  const { name, image_path } = req.body;
  if (!image_path) return res.status(400).json({ error: 'Falta la imagen del logo' });
  const maxRow = db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM brand_logos WHERE company_id=?').get(companyId);
  const info = db.prepare('INSERT INTO brand_logos (name, image_path, sort_order, company_id) VALUES (?,?,?,?)')
    .run((name || '').trim(), image_path, maxRow.m + 1, companyId);
  res.json({ id: Number(info.lastInsertRowid) });
});

app.put('/api/brand-logos/reorder', (req, res) => {
  const companyId = getCompanyId(req);
  const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
  const stmt = db.prepare('UPDATE brand_logos SET sort_order=? WHERE id=? AND company_id=?');
  ids.forEach((id, i) => stmt.run(i, id, companyId));
  res.json({ ok: true });
});

app.delete('/api/brand-logos/:id', (req, res) => {
  const companyId = getCompanyId(req);
  db.prepare('DELETE FROM brand_logos WHERE id=? AND company_id=?').run(req.params.id, companyId);
  res.json({ ok: true });
});

// ---------- Productos ----------
app.get('/api/products', (req, res) => {
  const companyId = getCompanyId(req);
  const q = (req.query.q || '').trim();
  let rows;
  if (q) {
    const like = `%${q}%`;
    rows = db.prepare(
      'SELECT * FROM products WHERE active=1 AND company_id=? AND (name LIKE ? OR code LIKE ? OR category LIKE ?) ORDER BY name'
    ).all(companyId, like, like, like);
  } else {
    rows = db.prepare('SELECT * FROM products WHERE active=1 AND company_id=? ORDER BY name').all(companyId);
  }
  res.json(rows);
});

// Nota: igual que /api/quotes/:id, la ficha de un producto siempre usa los datos de SU
// PROPIA empresa dueña (no la empresa activa de quien la abre) — así el enlace "Ver / PDF"
// funciona igual sin importar con qué empresa esté trabajando ahora quien lo abre.
app.get('/api/products/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'No encontrado' });
  const specs = db.prepare('SELECT * FROM product_specs WHERE product_id=? ORDER BY sort_order, id').all(req.params.id);
  const company = db.prepare('SELECT * FROM companies WHERE id=?').get(p.company_id) || {};
  const settings = {};
  for (const f of COMPANY_FIELDS) settings[f] = company[f] ?? '';
  res.json({ ...p, specs, settings });
});

app.post('/api/products', (req, res) => {
  const companyId = getCompanyId(req);
  const { code, name, category, price, description, image_path, datasheet_path } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
  try {
    const info = db.prepare(
      'INSERT INTO products (code,name,category,price,description,image_path,datasheet_path,company_id) VALUES (?,?,?,?,?,?,?,?)'
    ).run(code || null, name.trim(), category || '', Number(price) || 0, description || '', image_path || '', datasheet_path || '', companyId);
    res.json({ id: Number(info.lastInsertRowid) });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return res.status(400).json({ error: 'Ese código ya existe' });
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/products/:id', (req, res) => {
  const companyId = getCompanyId(req);
  const { code, name, category, price, description, image_path, datasheet_path } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
  try {
    db.prepare(
      `UPDATE products SET code=?, name=?, category=?, price=?, description=?, image_path=?, datasheet_path=?, updated_at=datetime('now','localtime') WHERE id=? AND company_id=?`
    ).run(code || null, name.trim(), category || '', Number(price) || 0, description || '', image_path || '', datasheet_path || '', req.params.id, companyId);
    res.json({ ok: true });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return res.status(400).json({ error: 'Ese código ya existe' });
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/products/:id', (req, res) => {
  const companyId = getCompanyId(req);
  db.prepare('UPDATE products SET active=0 WHERE id=? AND company_id=?').run(req.params.id, companyId);
  res.json({ ok: true });
});

// Fichas técnicas: reemplazo completo de specs de un producto
app.put('/api/products/:id/specs', (req, res) => {
  const productId = req.params.id;
  const specs = Array.isArray(req.body.specs) ? req.body.specs : [];
  const del = db.prepare('DELETE FROM product_specs WHERE product_id=?');
  const ins = db.prepare('INSERT INTO product_specs (product_id, section, label, value, sort_order) VALUES (?,?,?,?,?)');
  del.run(productId);
  specs.forEach((s, i) => {
    if (!s.label || !s.label.trim()) return;
    ins.run(productId, s.section || 'General', s.label.trim(), s.value || '', i);
  });
  res.json({ ok: true });
});

// ---------- Clientes ----------
app.get('/api/clients', (req, res) => {
  const companyId = getCompanyId(req);
  const q = (req.query.q || '').trim();
  let rows;
  if (q) {
    const like = `%${q}%`;
    rows = db.prepare('SELECT * FROM clients WHERE company_id=? AND (name LIKE ? OR rut LIKE ?) ORDER BY name').all(companyId, like, like);
  } else {
    rows = db.prepare('SELECT * FROM clients WHERE company_id=? ORDER BY name').all(companyId);
  }
  res.json(rows);
});

app.post('/api/clients', (req, res) => {
  const companyId = getCompanyId(req);
  const { name, rut, contact, email, phone } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
  const info = db.prepare('INSERT INTO clients (name,rut,contact,email,phone,company_id) VALUES (?,?,?,?,?,?)')
    .run(name.trim(), rut || '', contact || '', email || '', phone || '', companyId);
  res.json({ id: Number(info.lastInsertRowid) });
});

// ---------- Cotizaciones ----------
function nextQuoteNumber(companyId) {
  const company = db.prepare('SELECT quote_prefix, next_quote_seq FROM companies WHERE id=?').get(companyId);
  const prefix = company.quote_prefix || 'COT';
  const seq = parseInt(company.next_quote_seq, 10) || 1;
  db.prepare('UPDATE companies SET next_quote_seq=? WHERE id=?').run(String(seq + 1), companyId);
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(seq).padStart(4, '0')}`;
}

function computeTotals(items, ivaRate) {
  const neto = items.reduce((acc, it) => acc + (Number(it.qty) || 0) * (Number(it.unit_price) || 0) * (1 - (Number(it.discount_pct) || 0) / 100), 0);
  const iva = Math.round(neto * (Number(ivaRate) || 0));
  return { neto: Math.round(neto), iva, total: Math.round(neto) + iva };
}

app.get('/api/quotes', (req, res) => {
  const companyId = getCompanyId(req);
  const q = (req.query.q || '').trim();
  let rows;
  if (q) {
    const like = `%${q}%`;
    rows = db.prepare('SELECT * FROM quotes WHERE company_id=? AND (number LIKE ? OR client_name LIKE ?) ORDER BY id DESC').all(companyId, like, like);
  } else {
    rows = db.prepare('SELECT * FROM quotes WHERE company_id=? ORDER BY id DESC').all(companyId);
  }
  const withTotals = rows.map(q => {
    const items = db.prepare('SELECT * FROM quote_items WHERE quote_id=?').all(q.id);
    return { ...q, ...computeTotals(items, q.iva_rate), item_count: items.length };
  });
  res.json(withTotals);
});

// Nota: la ficha de una cotización específica se identifica por su propio id (único en toda
// la base), así que no depende del header de empresa activa — siempre usa los datos de la
// empresa DUEÑA de esa cotización. Así el enlace "Ver / PDF" funciona igual sin importar
// con qué empresa esté trabajando ahora quien lo abre.
app.get('/api/quotes/:id', (req, res) => {
  const quote = db.prepare('SELECT * FROM quotes WHERE id=?').get(req.params.id);
  if (!quote) return res.status(404).json({ error: 'No encontrada' });
  const items = db.prepare('SELECT * FROM quote_items WHERE quote_id=? ORDER BY sort_order, id').all(req.params.id);
  const company = db.prepare('SELECT * FROM companies WHERE id=?').get(quote.company_id) || {};
  const settings = {};
  for (const f of COMPANY_FIELDS) settings[f] = company[f] ?? '';
  // effective_terms: el valor que realmente se va a imprimir (el de la cotización si la
  // anuló, si no el de la empresa). terms_overrides: solo lo que este documento anuló, para
  // que el editor sepa qué campos mostrar como "personalizados" en esta cotización.
  const effective_terms = {};
  const terms_overrides = {};
  for (const f of TERMS_FIELDS) {
    const own = quote[f];
    effective_terms[f] = (own !== null && own !== undefined && own !== '') ? own : (company[f] ?? '');
    terms_overrides[f] = (own !== null && own !== undefined && own !== '') ? own : '';
  }
  res.json({ ...quote, items, totals: computeTotals(items, quote.iva_rate), settings, effective_terms, terms_overrides });
});

app.post('/api/quotes', (req, res) => {
  const companyId = getCompanyId(req);
  const b = req.body;
  if (!b.client_name || !b.client_name.trim()) return res.status(400).json({ error: 'El cliente es obligatorio' });
  const items = Array.isArray(b.items) ? b.items : [];
  const number = nextQuoteNumber(companyId);
  const info = db.prepare(`
    INSERT INTO quotes (number, client_id, client_name, client_rut, client_contact, client_email,
      quote_date, validity, payment_terms, delivery_terms, notes, iva_rate, status, include_bank_info, company_id,
      terms_delivery, terms_payment, terms_startup, terms_scope, terms_warranty, terms_docs, terms_link)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    number, b.client_id || null, b.client_name.trim(), b.client_rut || '', b.client_contact || '', b.client_email || '',
    b.quote_date || new Date().toISOString().slice(0, 10), b.validity || '15 días',
    b.payment_terms || '', b.delivery_terms || '', b.notes || '', b.iva_rate ?? 0.19, b.status || 'borrador',
    b.include_bank_info ? 1 : 0, companyId,
    ...TERMS_FIELDS.map(f => b[f] || null)
  );
  const quoteId = Number(info.lastInsertRowid);
  const ins = db.prepare(`
    INSERT INTO quote_items (quote_id, product_id, code, description, detail, image_path, qty, unit_price, discount_pct, sort_order)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `);
  items.forEach((it, i) => {
    if (!it.description || !it.description.trim()) return;
    ins.run(quoteId, it.product_id || null, it.code || '', it.description.trim(), it.detail || '',
      it.image_path || '', Number(it.qty) || 1, Number(it.unit_price) || 0, Number(it.discount_pct) || 0, i);
  });
  res.json({ id: quoteId, number });
});

app.put('/api/quotes/:id', (req, res) => {
  const companyId = getCompanyId(req);
  const b = req.body;
  if (!b.client_name || !b.client_name.trim()) return res.status(400).json({ error: 'El cliente es obligatorio' });
  const items = Array.isArray(b.items) ? b.items : [];
  const info = db.prepare(`
    UPDATE quotes SET client_id=?, client_name=?, client_rut=?, client_contact=?, client_email=?,
      quote_date=?, validity=?, payment_terms=?, delivery_terms=?, notes=?, iva_rate=?, status=?, include_bank_info=?,
      terms_delivery=?, terms_payment=?, terms_startup=?, terms_scope=?, terms_warranty=?, terms_docs=?, terms_link=?,
      updated_at=datetime('now','localtime')
    WHERE id=? AND company_id=?
  `).run(
    b.client_id || null, b.client_name.trim(), b.client_rut || '', b.client_contact || '', b.client_email || '',
    b.quote_date, b.validity || '15 días', b.payment_terms || '', b.delivery_terms || '', b.notes || '',
    b.iva_rate ?? 0.19, b.status || 'borrador', b.include_bank_info ? 1 : 0,
    ...TERMS_FIELDS.map(f => b[f] || null),
    req.params.id, companyId
  );
  if (info.changes === 0) return res.status(404).json({ error: 'No encontrada' });
  db.prepare('DELETE FROM quote_items WHERE quote_id=?').run(req.params.id);
  const ins = db.prepare(`
    INSERT INTO quote_items (quote_id, product_id, code, description, detail, image_path, qty, unit_price, discount_pct, sort_order)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `);
  items.forEach((it, i) => {
    if (!it.description || !it.description.trim()) return;
    ins.run(req.params.id, it.product_id || null, it.code || '', it.description.trim(), it.detail || '',
      it.image_path || '', Number(it.qty) || 1, Number(it.unit_price) || 0, Number(it.discount_pct) || 0, i);
  });
  res.json({ ok: true });
});

app.delete('/api/quotes/:id', (req, res) => {
  const companyId = getCompanyId(req);
  db.prepare('DELETE FROM quotes WHERE id=? AND company_id=?').run(req.params.id, companyId);
  res.json({ ok: true });
});

app.post('/api/quotes/:id/duplicate', (req, res) => {
  const companyId = getCompanyId(req);
  const quote = db.prepare('SELECT * FROM quotes WHERE id=? AND company_id=?').get(req.params.id, companyId);
  if (!quote) return res.status(404).json({ error: 'No encontrada' });
  const items = db.prepare('SELECT * FROM quote_items WHERE quote_id=?').all(req.params.id);
  const number = nextQuoteNumber(companyId);
  const info = db.prepare(`
    INSERT INTO quotes (number, client_id, client_name, client_rut, client_contact, client_email,
      quote_date, validity, payment_terms, delivery_terms, notes, iva_rate, status, include_bank_info, company_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'borrador',?,?)
  `).run(number, quote.client_id, quote.client_name, quote.client_rut, quote.client_contact, quote.client_email,
    new Date().toISOString().slice(0, 10), quote.validity, quote.payment_terms, quote.delivery_terms, quote.notes, quote.iva_rate,
    quote.include_bank_info || 0, companyId);
  const newId = Number(info.lastInsertRowid);
  const ins = db.prepare(`
    INSERT INTO quote_items (quote_id, product_id, code, description, detail, image_path, qty, unit_price, discount_pct, sort_order)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `);
  items.forEach(it => ins.run(newId, it.product_id, it.code, it.description, it.detail, it.image_path, it.qty, it.unit_price, it.discount_pct, it.sort_order));
  res.json({ id: newId, number });
});

// ---------- Documento completo (portada + cotización + datasheets + términos, fusionados) ----------

// Antes de generar, el frontend consulta esto para saber si falta algún datasheet
// y poder avisar (con opción de usar la Ficha Técnica como respaldo, o generar igual).
app.get('/api/quotes/:id/missing-datasheets', (req, res) => {
  const items = db.prepare(`
    SELECT DISTINCT p.id, p.name, p.datasheet_path
    FROM quote_items qi JOIN products p ON p.id = qi.product_id
    WHERE qi.quote_id = ?
  `).all(req.params.id);
  const missing = items.filter(p => !p.datasheet_path).map(p => ({ id: p.id, name: p.name }));
  res.json({ missing });
});

const BASE_URL = `http://127.0.0.1:${PORT}`;

async function renderPageToPdfBuffer(browser, url) {
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.waitForFunction(
      () => { const h = document.getElementById('hint'); return h && h.textContent && h.textContent !== 'Cargando…'; },
      { timeout: 15000 }
    ).catch(() => { /* si no hay hint, seguimos igual */ });
    return await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
  } finally {
    await page.close();
  }
}

app.post('/api/quotes/:id/full-pdf', async (req, res) => {
  const quoteId = req.params.id;
  const fallbackToFicha = !!req.body.fallbackToFicha;
  const quote = db.prepare('SELECT * FROM quotes WHERE id=?').get(quoteId);
  if (!quote) return res.status(404).json({ error: 'No encontrada' });

  let browser;
  try {
    browser = await puppeteer.launch();

    const company = db.prepare('SELECT company_name, letter_intro FROM companies WHERE id=?').get(quote.company_id) || {};

    const coverBuf = await renderPageToPdfBuffer(browser, `${BASE_URL}/print/cover.html?id=${quoteId}`);
    // La carta de presentación es opcional por empresa (algunas la usan, como Importparts;
    // Fluid Solutions históricamente no) — solo se genera y agrega si hay texto configurado.
    const letterBuf = company.letter_intro
      ? await renderPageToPdfBuffer(browser, `${BASE_URL}/print/presentacion.html?id=${quoteId}`)
      : null;
    const quoteBuf = await renderPageToPdfBuffer(browser, `${BASE_URL}/print/quote.html?id=${quoteId}`);
    const termsBuf = await renderPageToPdfBuffer(browser, `${BASE_URL}/print/terms.html?id=${quoteId}`);

    const items = db.prepare(`
      SELECT DISTINCT p.id, p.name, p.datasheet_path
      FROM quote_items qi JOIN products p ON p.id = qi.product_id
      WHERE qi.quote_id = ?
    `).all(quoteId);

    const itemBuffers = [];
    for (const p of items) {
      if (p.datasheet_path) {
        const filePath = path.join(UPLOAD_DIR, path.basename(p.datasheet_path));
        if (fs.existsSync(filePath)) {
          // Página separadora antes del PDF del fabricante (documento ajeno, con su propio
          // diseño) para que la transición se vea intencional y no como un PDF "pegado".
          const anexoBuf = await renderPageToPdfBuffer(browser, `${BASE_URL}/print/anexo.html?id=${quoteId}&pid=${p.id}`);
          itemBuffers.push({ buf: fs.readFileSync(filePath), name: p.name, anexoBuf, foreign: true });
        }
      } else if (fallbackToFicha) {
        itemBuffers.push({ buf: await renderPageToPdfBuffer(browser, `${BASE_URL}/print/ficha.html?id=${p.id}`), name: p.name, anexoBuf: null, foreign: false });
      }
    }

    const merged = await PDFDocument.create();
    const skipped = [];
    // Páginas propias (portada, carta, cotización, anexos, términos) reciben numeración de
    // pie de página al final; los PDF de fabricante ajenos quedan intactos, sin tocarlos.
    const ownPageIndices = [];
    function markOwn() { ownPageIndices.push(merged.getPageCount() - 1); }
    async function appendClean(buf, own) {
      const src = await PDFDocument.load(buf);
      const pages = await merged.copyPages(src, src.getPageIndices());
      pages.forEach(pg => { merged.addPage(pg); if (own) markOwn(); });
    }
    // Orden del documento: Portada → Carta de presentación (si aplica) → Cotización → Anexo + Datasheet de cada ítem → Términos.
    await appendClean(coverBuf, true);
    if (letterBuf) await appendClean(letterBuf, true);
    await appendClean(quoteBuf, true);
    // Los datasheets subidos por el usuario a veces vienen con una estructura interna dañada
    // (pasa con algunos PDF corporativos) — si uno falla, se salta con aviso en vez de
    // hacer fallar todo el documento.
    for (const { buf, name, anexoBuf } of itemBuffers) {
      if (anexoBuf) await appendClean(anexoBuf, true);
      try {
        const src = await PDFDocument.load(buf, { ignoreEncryption: true });
        const pages = await merged.copyPages(src, src.getPageIndices());
        pages.forEach(pg => merged.addPage(pg));
      } catch (e) {
        console.error('Datasheet no se pudo incluir (' + name + '):', e.message);
        skipped.push(name);
      }
    }
    await appendClean(termsBuf, true);

    const total = merged.getPageCount();
    const font = await merged.embedFont(StandardFonts.Helvetica);
    for (const idx of ownPageIndices) {
      const page = merged.getPage(idx);
      const { width } = page.getSize();
      const label = `${company.company_name || ''}   ·   Página ${idx + 1} de ${total}`;
      const textWidth = font.widthOfTextAtSize(label, 8);
      page.drawText(label, { x: (width - textWidth) / 2, y: 20, size: 8, font, color: rgb(0.55, 0.58, 0.64) });
    }

    const mergedBytes = await merged.save();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Cotizacion_${quote.number}_Completa.pdf"`);
    if (skipped.length) res.setHeader('X-Datasheet-Warnings', encodeURIComponent(skipped.join(', ')));
    res.setHeader('Access-Control-Expose-Headers', 'X-Datasheet-Warnings');
    res.send(Buffer.from(mergedBytes));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'No se pudo generar el documento completo: ' + e.message });
  } finally {
    if (browser) await browser.close();
  }
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Error interno' });
});

app.listen(PORT, '0.0.0.0', () => {
  const nets = require('os').networkInterfaces();
  console.log(`\n  Fluid Solutions · Cotizador — corriendo en el puerto ${PORT}\n`);
  console.log('  Accesos disponibles en la red local:');
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) console.log(`    http://${net.address}:${PORT}`);
    }
  }
  console.log(`    http://localhost:${PORT}\n`);
});
