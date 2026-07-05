const BrandLogos = {
  cache: [],
  pendingImagePath: '',

  init() {
    document.getElementById('brandLogoFile').addEventListener('change', e => this.onImagePick(e));
    document.getElementById('btnAddBrandLogo').addEventListener('click', () => this.add());
  },

  async load() {
    const wrap = document.getElementById('brandLogosGrid');
    wrap.innerHTML = '<div class="empty" style="padding:20px">Cargando…</div>';
    try {
      this.cache = await API.get('/api/brand-logos');
      this.render();
    } catch (e) { wrap.innerHTML = `<div class="empty">Error: ${esc(e.message)}</div>`; }
  },

  render() {
    const wrap = document.getElementById('brandLogosGrid');
    if (!this.cache.length) {
      wrap.innerHTML = `<div class="empty" style="padding:24px"><div class="big">🏷️</div>Aún no hay proveedores cargados.<br>Suba el primer logo arriba.</div>`;
      return;
    }
    wrap.innerHTML = `<div class="grid-cards" style="grid-template-columns:repeat(auto-fill, minmax(150px,1fr))">
      ${this.cache.map((b, i) => `
        <div class="pcard">
          <div class="thumb" style="height:80px;background:#fff"><img src="${esc(b.image_path)}" style="object-fit:contain;padding:8px"></div>
          <div class="body" style="padding:8px 10px">
            <div class="name" style="font-size:12px;text-align:center">${esc(b.name || '—')}</div>
          </div>
          <div class="actions">
            <button class="btn ghost sm" title="Subir" ${i === 0 ? 'disabled' : ''} onclick="BrandLogos.move(${i},-1)">↑</button>
            <button class="btn ghost sm" title="Bajar" ${i === this.cache.length - 1 ? 'disabled' : ''} onclick="BrandLogos.move(${i},1)">↓</button>
            <button class="btn ghost sm" title="Eliminar" onclick="BrandLogos.remove(${b.id})">×</button>
          </div>
        </div>`).join('')}
      </div>`;
  },

  setPreview(path) {
    const el = document.getElementById('brandLogoPrev');
    el.innerHTML = path ? `<img src="${esc(path)}" alt="">` : `<span style="font-size:10px;color:#a9b2c6">Sin imagen</span>`;
  },

  async onImagePick(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const path = await API.upload(file);
      this.pendingImagePath = path;
      this.setPreview(path);
    } catch (err) { toast(err.message, true); }
  },

  async add() {
    if (!this.pendingImagePath) return toast('Seleccione primero la imagen del logo', true);
    const name = document.getElementById('brandLogoName').value.trim();
    try {
      await API.post('/api/brand-logos', { name, image_path: this.pendingImagePath });
      toast('Proveedor agregado');
      this.pendingImagePath = '';
      this.setPreview('');
      document.getElementById('brandLogoName').value = '';
      document.getElementById('brandLogoFile').value = '';
      this.load();
    } catch (e) { toast(e.message, true); }
  },

  async move(idx, dir) {
    const target = idx + dir;
    if (target < 0 || target >= this.cache.length) return;
    [this.cache[idx], this.cache[target]] = [this.cache[target], this.cache[idx]];
    this.render();
    try { await API.put('/api/brand-logos/reorder', { ids: this.cache.map(b => b.id) }); }
    catch (e) { toast(e.message, true); }
  },

  async remove(id) {
    if (!confirm('¿Quitar este logo de la franja de proveedores?')) return;
    try { await API.del('/api/brand-logos/' + id); toast('Proveedor eliminado'); this.load(); }
    catch (e) { toast(e.message, true); }
  }
};
