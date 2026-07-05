const TERMS_FIELDS = ['terms_delivery', 'terms_payment', 'terms_startup', 'terms_scope', 'terms_warranty', 'terms_docs', 'terms_link'];

const Quotes = {
  cache: [],
  items: [],
  productsCache: [],
  ivaRate: 0.19,
  selectedClientId: null,

  init() {
    document.getElementById('btnNewQuote').addEventListener('click', () => this.openNew());
    document.getElementById('btnCancelQuote').addEventListener('click', () => closeModal('modalQuote'));
    document.getElementById('btnSaveQuote').addEventListener('click', () => this.save());
    document.getElementById('btnAddItem').addEventListener('click', () => this.addItem());
    document.getElementById('qSearch').addEventListener('input', debounce(() => this.load(), 250));
    document.getElementById('btnFullDoc').addEventListener('click', () => this.checkAndGenerateFullDoc());
    document.getElementById('btnMissingCancel').addEventListener('click', () => closeModal('modalMissingDatasheets'));
    document.getElementById('btnMissingSkip').addEventListener('click', () => { closeModal('modalMissingDatasheets'); this.downloadFullDoc(false); });
    document.getElementById('btnMissingUseFicha').addEventListener('click', () => { closeModal('modalMissingDatasheets'); this.downloadFullDoc(true); });

    const clientInput = document.getElementById('q_client_name');
    clientInput.addEventListener('input', debounce(() => this.searchClients(clientInput.value), 200));
    clientInput.addEventListener('focus', () => this.searchClients(clientInput.value));
    document.addEventListener('click', e => {
      if (!e.target.closest('.autocomplete')) document.getElementById('clientAcList').classList.remove('open');
    });
  },

  async load() {
    const q = document.getElementById('qSearch').value.trim();
    const wrap = document.getElementById('quotesTableWrap');
    wrap.innerHTML = '<div class="empty">Cargando…</div>';
    try {
      this.cache = await API.get('/api/quotes' + (q ? '?q=' + encodeURIComponent(q) : ''));
      this.render();
    } catch (e) { wrap.innerHTML = `<div class="empty">Error: ${esc(e.message)}</div>`; }
  },

  render() {
    const wrap = document.getElementById('quotesTableWrap');
    if (!this.cache.length) {
      wrap.innerHTML = `<div class="empty"><div class="big">🧾</div>Aún no hay cotizaciones.<br>Cree la primera con “＋ Nueva cotización”.</div>`;
      return;
    }
    wrap.innerHTML = `<div class="tablescroll"><table class="list"><thead><tr>
        <th>N°</th><th>Cliente</th><th>Fecha</th><th>Ítems</th><th>Total</th><th>Estado</th><th style="min-width:230px">Acciones</th>
      </tr></thead><tbody>
      ${this.cache.map(q => `<tr>
        <td><b>${esc(q.number)}</b></td>
        <td>${esc(q.client_name)}</td>
        <td>${fmtDate(q.quote_date)}</td>
        <td>${q.item_count}</td>
        <td><b>${fmtCLP(q.total)}</b></td>
        <td><span class="badge ${esc(q.status)}">${esc(q.status)}</span></td>
        <td class="rowactions">
          <button class="btn ghost sm" onclick="Quotes.openEdit(${q.id})">Editar</button>
          <a class="btn ghost sm" href="/print/quote.html?id=${q.id}" target="_blank">Ver / PDF</a>
          <button class="btn ghost sm" onclick="Quotes.duplicate(${q.id})">Duplicar</button>
          <button class="btn ghost sm" onclick="Quotes.remove(${q.id})">Eliminar</button>
        </td>
      </tr>`).join('')}
      </tbody></table></div>`;
  },

  async loadProductsCache() {
    try { this.productsCache = await API.get('/api/products'); }
    catch (e) { this.productsCache = []; }
  },

  async openNew() {
    document.getElementById('quoteModalTitle').textContent = 'Nueva cotización';
    document.getElementById('q_id').value = '';
    document.getElementById('q_client_name').value = '';
    document.getElementById('q_client_rut').value = '';
    document.getElementById('q_client_contact').value = '';
    document.getElementById('q_client_email').value = '';
    document.getElementById('q_date').value = todayISO();
    document.getElementById('q_validity').value = '15 días';
    document.getElementById('q_payment_terms').value = '';
    document.getElementById('q_delivery_terms').value = '';
    document.getElementById('q_status').value = 'borrador';
    document.getElementById('q_notes').value = '';
    document.getElementById('q_include_bank_info').checked = false;
    TERMS_FIELDS.forEach(f => { document.getElementById('q_' + f).value = ''; });
    document.getElementById('quoteFullDocRow').style.display = 'none';
    this.selectedClientId = null;
    this.ivaRate = 0.19;
    this.items = [];
    await this.loadProductsCache();
    this.addItem();
    this.renderItems();
    openModal('modalQuote');
  },

  async openEdit(id) {
    try {
      const q = await API.get('/api/quotes/' + id);
      document.getElementById('quoteModalTitle').textContent = 'Editar cotización ' + q.number;
      document.getElementById('q_id').value = q.id;
      document.getElementById('quoteFullDocRow').style.display = 'flex';
      document.getElementById('q_client_name').value = q.client_name || '';
      document.getElementById('q_client_rut').value = q.client_rut || '';
      document.getElementById('q_client_contact').value = q.client_contact || '';
      document.getElementById('q_client_email').value = q.client_email || '';
      document.getElementById('q_date').value = (q.quote_date || '').slice(0, 10);
      document.getElementById('q_validity').value = q.validity || '15 días';
      document.getElementById('q_payment_terms').value = q.payment_terms || '';
      document.getElementById('q_delivery_terms').value = q.delivery_terms || '';
      document.getElementById('q_status').value = q.status || 'borrador';
      document.getElementById('q_notes').value = q.notes || '';
      document.getElementById('q_include_bank_info').checked = !!q.include_bank_info;
      const overrides = q.terms_overrides || {};
      TERMS_FIELDS.forEach(f => { document.getElementById('q_' + f).value = overrides[f] || ''; });
      this.selectedClientId = q.client_id || null;
      this.ivaRate = q.iva_rate ?? 0.19;
      this.items = q.items.length ? q.items.map(it => ({ ...it })) : [];
      if (!this.items.length) this.addItem();
      await this.loadProductsCache();
      this.renderItems();
      openModal('modalQuote');
    } catch (e) { toast(e.message, true); }
  },

  async searchClients(text) {
    const list = document.getElementById('clientAcList');
    if (!text || text.trim().length < 1) { list.classList.remove('open'); return; }
    try {
      const res = await API.get('/api/clients?q=' + encodeURIComponent(text.trim()));
      if (!res.length) { list.classList.remove('open'); return; }
      list.innerHTML = res.map(c => `<div class="ac-item" onclick="Quotes.pickClient(${c.id})">
        <div><b>${esc(c.name)}</b><div class="meta">${esc(c.rut || '')}</div></div>
      </div>`).join('');
      list.classList.add('open');
    } catch (e) { /* silencioso */ }
  },

  async pickClient(id) {
    try {
      const list = await API.get('/api/clients?q=');
      const c = list.find(x => x.id === id);
      if (!c) return;
      document.getElementById('q_client_name').value = c.name;
      document.getElementById('q_client_rut').value = c.rut || '';
      document.getElementById('q_client_contact').value = c.contact || '';
      document.getElementById('q_client_email').value = c.email || '';
      this.selectedClientId = c.id;
      document.getElementById('clientAcList').classList.remove('open');
    } catch (e) { toast(e.message, true); }
  },

  addItem() {
    this.items.push({ product_id: null, code: '', description: '', detail: '', image_path: '', qty: 1, unit_price: 0, discount_pct: 0 });
    this.renderItems();
  },

  removeItem(idx) {
    this.items.splice(idx, 1);
    this.renderItems();
  },

  onProductSelect(idx, value) {
    if (!value) {
      // "Ítem libre": se conserva lo escrito, solo se suelta el vínculo al producto
      this.items[idx].product_id = null;
      this.renderItems();
      return;
    }
    const p = this.productsCache.find(x => x.id === Number(value));
    if (!p) return;
    this.items[idx] = {
      ...this.items[idx],
      product_id: p.id, code: p.code || '', description: p.name,
      detail: p.description || '', image_path: p.image_path || '',
      unit_price: p.price
    };
    this.renderItems();
  },

  onDescMainInput(idx, val) { this.items[idx].description = val; },
  onDescSubInput(idx, val) { this.items[idx].detail = val; },

  productOptions(selectedId) {
    const opts = ['<option value="">✎ Ítem libre (escribir descripción)</option>'];
    this.productsCache.forEach(p => {
      const sel = selectedId === p.id ? 'selected' : '';
      opts.push(`<option value="${p.id}" ${sel}>${esc(p.name)} — ${esc(p.code || 's/código')} — ${fmtCLP(p.price)}</option>`);
    });
    return opts.join('');
  },

  renderItems() {
    const body = document.getElementById('quoteItemsBody');
    body.innerHTML = this.items.map((it, idx) => `
      <tr data-idx="${idx}">
        <td>${it.image_path ? `<img class="itemthumb" src="${esc(it.image_path)}">` : `<div class="itemthumb"></div>`}</td>
        <td class="proddesc">
          <select onchange="Quotes.onProductSelect(${idx}, this.value)">${this.productOptions(it.product_id)}</select>
          <input class="desc-main-input" placeholder="Descripción" value="${esc(it.description)}" oninput="Quotes.onDescMainInput(${idx}, this.value)">
          <input class="desc-sub-input" placeholder="Detalle (opcional)" value="${esc(it.detail || '')}" oninput="Quotes.onDescSubInput(${idx}, this.value)">
        </td>
        <td class="num"><input type="number" min="0" step="1" value="${it.qty}" oninput="Quotes.onFieldInput(${idx},'qty',this.value)"></td>
        <td class="num"><input type="number" min="0" step="1" value="${it.unit_price}" oninput="Quotes.onFieldInput(${idx},'unit_price',this.value)"></td>
        <td class="num"><input type="number" min="0" max="100" step="1" value="${it.discount_pct}" oninput="Quotes.onFieldInput(${idx},'discount_pct',this.value)"></td>
        <td class="num"><b>${fmtCLP(this.subtotal(it))}</b></td>
        <td><button class="delbtn" onclick="Quotes.removeItem(${idx})">×</button></td>
      </tr>`).join('');
    this.recalc();
  },

  onFieldInput(idx, field, val) {
    this.items[idx][field] = Number(val) || 0;
    this.recalc();
    const cell = document.querySelector(`tr[data-idx="${idx}"] td.num:nth-of-type(4) b`);
    if (cell) cell.textContent = fmtCLP(this.subtotal(this.items[idx]));
  },

  subtotal(it) {
    return (Number(it.qty) || 0) * (Number(it.unit_price) || 0) * (1 - (Number(it.discount_pct) || 0) / 100);
  },

  recalc() {
    const neto = this.items.reduce((a, it) => a + this.subtotal(it), 0);
    const iva = Math.round(neto * this.ivaRate);
    document.getElementById('q_ivapct').textContent = Math.round(this.ivaRate * 100);
    document.getElementById('q_neto').textContent = fmtCLP(neto);
    document.getElementById('q_iva').textContent = fmtCLP(iva);
    document.getElementById('q_total').textContent = fmtCLP(neto + iva);
  },

  async save() {
    const clientName = document.getElementById('q_client_name').value.trim();
    if (!clientName) return toast('El cliente es obligatorio', true);
    const validItems = this.items.filter(it => it.description && it.description.trim());
    if (!validItems.length) return toast('Agregue al menos un ítem', true);

    const body = {
      client_id: this.selectedClientId,
      client_name: clientName,
      client_rut: document.getElementById('q_client_rut').value.trim(),
      client_contact: document.getElementById('q_client_contact').value.trim(),
      client_email: document.getElementById('q_client_email').value.trim(),
      quote_date: document.getElementById('q_date').value || todayISO(),
      validity: document.getElementById('q_validity').value.trim(),
      payment_terms: document.getElementById('q_payment_terms').value.trim(),
      delivery_terms: document.getElementById('q_delivery_terms').value.trim(),
      status: document.getElementById('q_status').value,
      notes: document.getElementById('q_notes').value.trim(),
      include_bank_info: document.getElementById('q_include_bank_info').checked,
      iva_rate: this.ivaRate,
      items: validItems
    };
    TERMS_FIELDS.forEach(f => { body[f] = document.getElementById('q_' + f).value.trim(); });

    const id = document.getElementById('q_id').value;
    try {
      // si el cliente no existe en la BD, se guarda de paso para reutilizarlo despues
      if (!this.selectedClientId) {
        try {
          const c = await API.post('/api/clients', {
            name: body.client_name, rut: body.client_rut, contact: body.client_contact, email: body.client_email
          });
          body.client_id = c.id;
        } catch (e) { /* si falla, igual se guarda la cotizacion con los datos sueltos */ }
      }
      if (id) { await API.put('/api/quotes/' + id, body); toast('Cotización actualizada'); }
      else { const r = await API.post('/api/quotes', body); toast('Cotización ' + r.number + ' creada'); }
      closeModal('modalQuote');
      this.load();
    } catch (e) { toast(e.message, true); }
  },

  async duplicate(id) {
    try { const r = await API.post(`/api/quotes/${id}/duplicate`); toast('Duplicada como ' + r.number); this.load(); }
    catch (e) { toast(e.message, true); }
  },

  async remove(id) {
    if (!confirm('¿Eliminar esta cotización? Esta acción no se puede deshacer.')) return;
    try { await API.del('/api/quotes/' + id); toast('Cotización eliminada'); this.load(); }
    catch (e) { toast(e.message, true); }
  },

  async checkAndGenerateFullDoc() {
    const id = document.getElementById('q_id').value;
    if (!id) return;
    try {
      const { missing } = await API.get(`/api/quotes/${id}/missing-datasheets`);
      if (missing.length) {
        document.getElementById('missingDatasheetsList').innerHTML = missing.map(m => `<li>${esc(m.name)}</li>`).join('');
        openModal('modalMissingDatasheets');
      } else {
        this.downloadFullDoc(false);
      }
    } catch (e) { toast(e.message, true); }
  },

  async downloadFullDoc(fallbackToFicha) {
    const id = document.getElementById('q_id').value;
    const btn = document.getElementById('btnFullDoc');
    const originalText = btn.textContent;
    btn.textContent = 'Generando…'; btn.disabled = true;
    try {
      const res = await fetch(`/api/quotes/${id}/full-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Company-Id': activeCompanyId() },
        body: JSON.stringify({ fallbackToFicha })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'No se pudo generar el documento');
      }
      const warn = res.headers.get('X-Datasheet-Warnings');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (res.headers.get('Content-Disposition') || '').match(/filename="(.+)"/)?.[1] || 'documento-completo.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast(warn ? 'Documento generado. No se pudo incluir: ' + decodeURIComponent(warn) : 'Documento completo generado');
    } catch (e) {
      toast(e.message, true);
    } finally {
      btn.textContent = originalText; btn.disabled = false;
    }
  }
};
