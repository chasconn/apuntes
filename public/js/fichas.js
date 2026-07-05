const Fichas = {
  cache: [],
  sections: [], // [{section, rows:[{label,value}]}]

  init() {
    document.getElementById('btnCancelFicha').addEventListener('click', () => closeModal('modalFicha'));
    document.getElementById('btnSaveFicha').addEventListener('click', () => this.save());
    document.getElementById('btnAddSection').addEventListener('click', () => this.addSection());
    document.getElementById('fSearch').addEventListener('input', debounce(() => this.load(), 250));
  },

  async load() {
    const q = document.getElementById('fSearch').value.trim();
    const wrap = document.getElementById('fichasGridWrap');
    wrap.innerHTML = '<div class="empty">Cargando…</div>';
    try {
      this.cache = await API.get('/api/products' + (q ? '?q=' + encodeURIComponent(q) : ''));
      this.render();
    } catch (e) { wrap.innerHTML = `<div class="empty">Error: ${esc(e.message)}</div>`; }
  },

  render() {
    const wrap = document.getElementById('fichasGridWrap');
    if (!this.cache.length) {
      wrap.innerHTML = `<div class="empty"><div class="big">📋</div>Primero cree productos en la sección “Productos”.<br>Luego podrá completar su ficha técnica aquí.</div>`;
      return;
    }
    wrap.innerHTML = `<div class="grid-cards">${this.cache.map(p => `
      <div class="pcard">
        <div class="thumb">${p.image_path ? `<img src="${esc(p.image_path)}" alt="">` : `<span class="noimg">Sin imagen</span>`}</div>
        <div class="body">
          <div class="code">${esc(p.code || '—')}</div>
          <div class="name">${esc(p.name)}</div>
          <div class="cat">${esc(p.category || '')}</div>
        </div>
        <div class="actions">
          <button class="btn ghost sm" onclick="Fichas.openEdit(${p.id})">Editar ficha</button>
          <a class="btn ghost sm" href="/print/ficha.html?id=${p.id}" target="_blank">Ver / PDF</a>
        </div>
      </div>`).join('')}</div>`;
  },

  async openEdit(productId) {
    try {
      const p = await API.get('/api/products/' + productId);
      document.getElementById('fichaModalTitle').textContent = 'Ficha técnica — ' + p.name;
      document.getElementById('fi_product_id').value = p.id;
      const bySection = {};
      (p.specs || []).forEach(s => {
        bySection[s.section] = bySection[s.section] || [];
        bySection[s.section].push({ label: s.label, value: s.value });
      });
      this.sections = Object.keys(bySection).length
        ? Object.entries(bySection).map(([section, rows]) => ({ section, rows }))
        : [
            { section: 'Especificaciones generales', rows: [{ label: 'Marca', value: '' }, { label: 'Modelo', value: '' }] },
            { section: 'Características técnicas', rows: [{ label: '', value: '' }] }
          ];
      this.renderSections();
      openModal('modalFicha');
    } catch (e) { toast(e.message, true); }
  },

  addSection() {
    this.sections.push({ section: 'Nueva sección', rows: [{ label: '', value: '' }] });
    this.renderSections();
  },

  removeSection(si) { this.sections.splice(si, 1); this.renderSections(); },
  addRow(si) { this.sections[si].rows.push({ label: '', value: '' }); this.renderSections(); },
  removeRow(si, ri) { this.sections[si].rows.splice(ri, 1); this.renderSections(); },

  renderSections() {
    const wrap = document.getElementById('specSections');
    wrap.innerHTML = this.sections.map((sec, si) => `
      <div class="specsection">
        <div class="sechead">
          <input value="${esc(sec.section)}" onchange="Fichas.sections[${si}].section=this.value">
          <button class="delbtn" onclick="Fichas.removeSection(${si})" title="Quitar sección">×</button>
        </div>
        ${sec.rows.map((r, ri) => `
          <div class="specrow">
            <input placeholder="Campo (ej: Procesador)" value="${esc(r.label)}" onchange="Fichas.sections[${si}].rows[${ri}].label=this.value">
            <input placeholder="Valor (ej: Intel Core i7)" value="${esc(r.value)}" onchange="Fichas.sections[${si}].rows[${ri}].value=this.value">
            <button class="delbtn" onclick="Fichas.removeRow(${si},${ri})" title="Quitar fila">×</button>
          </div>`).join('')}
        <div class="addspec" onclick="Fichas.addRow(${si})">＋ Agregar campo</div>
      </div>`).join('');
  },

  async save() {
    const productId = document.getElementById('fi_product_id').value;
    const specs = [];
    this.sections.forEach(sec => {
      sec.rows.forEach(r => { if (r.label && r.label.trim()) specs.push({ section: sec.section, label: r.label, value: r.value }); });
    });
    try {
      await API.put(`/api/products/${productId}/specs`, { specs });
      toast('Ficha técnica guardada');
      closeModal('modalFicha');
    } catch (e) { toast(e.message, true); }
  }
};
