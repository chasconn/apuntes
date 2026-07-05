const Companies = {
  cache: [],
  activeId: null,

  // Se llama antes que cualquier otro módulo: resuelve con qué empresa se va a trabajar.
  async resolveActive() {
    this.cache = await API.get('/api/companies');
    if (!this.cache.length) return; // no debería pasar, db.js siempre crea al menos 1
    const saved = localStorage.getItem('fs_company_id');
    const stillExists = saved && this.cache.some(c => String(c.id) === String(saved));
    this.activeId = stillExists ? saved : String(this.cache[0].id);
    localStorage.setItem('fs_company_id', this.activeId);
  },

  init() {
    document.getElementById('companySwitcher').addEventListener('change', e => this.switchTo(e.target.value));
    document.getElementById('btnNewCompany').addEventListener('click', () => this.createNew());
    this.renderSwitcher();
  },

  renderSwitcher() {
    const sel = document.getElementById('companySwitcher');
    sel.innerHTML = this.cache.map(c => `<option value="${c.id}" ${String(c.id) === String(this.activeId) ? 'selected' : ''}>${esc(c.company_name)}</option>`).join('');
  },

  async switchTo(id) {
    this.activeId = String(id);
    localStorage.setItem('fs_company_id', this.activeId);
    this.renderSwitcher();
    await Settings.loadSidebarLogo();
    showView('quotes');
    toast('Trabajando ahora con: ' + (this.cache.find(c => String(c.id) === this.activeId) || {}).company_name);
  },

  async load() {
    const wrap = document.getElementById('companiesGridWrap');
    wrap.innerHTML = '<div class="empty">Cargando…</div>';
    try {
      this.cache = await API.get('/api/companies');
      this.renderSwitcher();
      this.render();
    } catch (e) { wrap.innerHTML = `<div class="empty">Error: ${esc(e.message)}</div>`; }
  },

  render() {
    const wrap = document.getElementById('companiesGridWrap');
    wrap.innerHTML = `<div class="grid-cards">${this.cache.map(c => {
      const active = String(c.id) === String(this.activeId);
      return `
      <div class="pcard">
        <div class="thumb">${c.logo_path ? `<img src="${esc(c.logo_path)}" style="object-fit:contain;padding:10px">` : `<span class="noimg">Sin logo</span>`}</div>
        <div class="body">
          <div class="name">${esc(c.company_name)}</div>
          ${active ? '<span class="badge aceptada">Activa</span>' : ''}
        </div>
        <div class="actions">
          ${active ? '' : `<button class="btn ghost sm" onclick="Companies.switchTo(${c.id})">Usar esta</button>`}
          <button class="btn ghost sm" onclick="Companies.remove(${c.id})">Eliminar</button>
        </div>
      </div>`;
    }).join('')}</div>`;
  },

  async createNew() {
    const name = prompt('Nombre de la nueva empresa:');
    if (!name || !name.trim()) return;
    try {
      const r = await API.post('/api/companies', { company_name: name.trim() });
      toast('Empresa creada');
      await this.switchTo(r.id);
      this.load();
      showView('settings');
      toast('Complete los datos de "' + name.trim() + '" en Configuración');
    } catch (e) { toast(e.message, true); }
  },

  async remove(id) {
    if (this.cache.length <= 1) return toast('No puede eliminar la única empresa', true);
    if (!confirm('¿Eliminar esta empresa? Se borran también TODOS sus productos, cotizaciones, clientes y logos. Esta acción no se puede deshacer.')) return;
    try {
      await API.del('/api/companies/' + id);
      toast('Empresa eliminada');
      if (String(id) === String(this.activeId)) {
        await this.resolveActive();
        await Settings.loadSidebarLogo();
      }
      this.load();
    } catch (e) { toast(e.message, true); }
  }
};
