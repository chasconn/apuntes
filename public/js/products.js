const Products = {
  cache: [],
  pendingImagePath: '',
  pendingDatasheetPath: '',

  init() {
    document.getElementById('btnNewProduct').addEventListener('click', () => this.openNew());
    document.getElementById('btnCancelProduct').addEventListener('click', () => closeModal('modalProduct'));
    document.getElementById('btnSaveProduct').addEventListener('click', () => this.save());
    document.getElementById('p_image_file').addEventListener('change', e => this.onImagePick(e));
    document.getElementById('p_datasheet_file').addEventListener('change', e => this.onDatasheetPick(e));
    document.getElementById('pSearch').addEventListener('input', debounce(() => this.load(), 250));
  },

  async load() {
    const q = document.getElementById('pSearch').value.trim();
    const wrap = document.getElementById('productsGridWrap');
    wrap.innerHTML = '<div class="empty">Cargando…</div>';
    try {
      this.cache = await API.get('/api/products' + (q ? '?q=' + encodeURIComponent(q) : ''));
      this.render();
    } catch (e) { wrap.innerHTML = `<div class="empty">Error al cargar productos: ${esc(e.message)}</div>`; }
  },

  render() {
    const wrap = document.getElementById('productsGridWrap');
    if (!this.cache.length) {
      wrap.innerHTML = `<div class="empty"><div class="big">📦</div>Aún no hay productos.<br>Cree el primero con “＋ Nuevo producto”.</div>`;
      return;
    }
    wrap.innerHTML = `<div class="grid-cards">${this.cache.map(p => `
      <div class="pcard">
        <div class="thumb">${p.image_path ? `<img src="${esc(p.image_path)}" alt="">` : `<span class="noimg">Sin imagen</span>`}</div>
        <div class="body">
          <div class="code">${esc(p.code || '—')}</div>
          <div class="name">${esc(p.name)}</div>
          <div class="cat">${esc(p.category || '')}</div>
          <div class="price">${fmtCLP(p.price)}</div>
        </div>
        <div class="actions">
          <button class="btn ghost sm" onclick="Products.openEdit(${p.id})">Editar</button>
          <button class="btn ghost sm" onclick="Products.remove(${p.id})">Eliminar</button>
        </div>
        ${p.datasheet_path ? '<div class="hint" style="text-align:center;padding-bottom:8px">📄 Con datasheet</div>' : ''}
      </div>`).join('')}</div>`;
  },

  openNew() {
    document.getElementById('productModalTitle').textContent = 'Nuevo producto';
    document.getElementById('p_id').value = '';
    document.getElementById('p_name').value = '';
    document.getElementById('p_code').value = '';
    document.getElementById('p_category').value = '';
    document.getElementById('p_price').value = '';
    document.getElementById('p_description').value = '';
    this.pendingImagePath = '';
    this.pendingDatasheetPath = '';
    this.setImgPreview('');
    this.setPdfPreview('');
    openModal('modalProduct');
  },

  openEdit(id) {
    const p = this.cache.find(x => x.id === id);
    if (!p) return;
    document.getElementById('productModalTitle').textContent = 'Editar producto';
    document.getElementById('p_id').value = p.id;
    document.getElementById('p_name').value = p.name;
    document.getElementById('p_code').value = p.code || '';
    document.getElementById('p_category').value = p.category || '';
    document.getElementById('p_price').value = p.price;
    document.getElementById('p_description').value = p.description || '';
    this.pendingImagePath = p.image_path || '';
    this.pendingDatasheetPath = p.datasheet_path || '';
    this.setImgPreview(this.pendingImagePath);
    this.setPdfPreview(this.pendingDatasheetPath);
    openModal('modalProduct');
  },

  setImgPreview(path) {
    const el = document.getElementById('productImgPrev');
    el.innerHTML = path ? `<img src="${esc(path)}" alt="">` : `<span style="font-size:10px;color:#a9b2c6">Sin imagen</span>`;
  },

  setPdfPreview(path) {
    document.getElementById('productPdfName').textContent = path ? '📄 Datasheet cargado — ' + path.split('/').pop() : 'Sin datasheet cargado';
  },

  async onImagePick(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const path = await API.upload(file);
      this.pendingImagePath = path;
      this.setImgPreview(path);
    } catch (err) { toast(err.message, true); }
  },

  async onDatasheetPick(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const path = await API.uploadPdf(file);
      this.pendingDatasheetPath = path;
      this.setPdfPreview(path);
      toast('Datasheet cargado');
    } catch (err) { toast(err.message, true); }
  },

  async save() {
    const id = document.getElementById('p_id').value;
    const body = {
      name: document.getElementById('p_name').value.trim(),
      code: document.getElementById('p_code').value.trim(),
      category: document.getElementById('p_category').value.trim(),
      price: document.getElementById('p_price').value,
      description: document.getElementById('p_description').value.trim(),
      image_path: this.pendingImagePath,
      datasheet_path: this.pendingDatasheetPath
    };
    if (!body.name) return toast('El nombre es obligatorio', true);
    try {
      if (id) await API.put('/api/products/' + id, body);
      else await API.post('/api/products', body);
      closeModal('modalProduct');
      toast(id ? 'Producto actualizado' : 'Producto creado');
      this.load();
    } catch (e) { toast(e.message, true); }
  },

  async remove(id) {
    if (!confirm('¿Eliminar este producto? No se borrará de cotizaciones ya creadas.')) return;
    try { await API.del('/api/products/' + id); toast('Producto eliminado'); this.load(); }
    catch (e) { toast(e.message, true); }
  }
};

function debounce(fn, ms) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
