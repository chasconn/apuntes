const Clients = {
  cache: [],

  init() {
    document.getElementById('btnNewClient').addEventListener('click', () => this.openNew());
    document.getElementById('btnCancelClient').addEventListener('click', () => closeModal('modalClient'));
    document.getElementById('btnSaveClient').addEventListener('click', () => this.save());
    document.getElementById('cSearch').addEventListener('input', debounce(() => this.load(), 250));
  },

  async load() {
    const q = document.getElementById('cSearch').value.trim();
    const wrap = document.getElementById('clientsTableWrap');
    wrap.innerHTML = '<div class="empty">Cargando…</div>';
    try {
      this.cache = await API.get('/api/clients' + (q ? '?q=' + encodeURIComponent(q) : ''));
      this.render();
    } catch (e) { wrap.innerHTML = `<div class="empty">Error: ${esc(e.message)}</div>`; }
  },

  render() {
    const wrap = document.getElementById('clientsTableWrap');
    if (!this.cache.length) {
      wrap.innerHTML = `<div class="empty"><div class="big">👥</div>Aún no hay clientes guardados.<br>Se crean automáticamente al hacer una cotización, o agréguelos aquí.</div>`;
      return;
    }
    wrap.innerHTML = `<div class="tablescroll"><table class="list"><thead><tr>
        <th>Cliente</th><th>RUT</th><th>Contacto</th><th>Correo</th><th>Teléfono</th>
      </tr></thead><tbody>
      ${this.cache.map(c => `<tr>
        <td><b>${esc(c.name)}</b></td><td>${esc(c.rut || '—')}</td><td>${esc(c.contact || '—')}</td>
        <td>${esc(c.email || '—')}</td><td>${esc(c.phone || '—')}</td>
      </tr>`).join('')}
      </tbody></table></div>`;
  },

  openNew() {
    ['c_name', 'c_rut', 'c_contact', 'c_email', 'c_phone'].forEach(id => document.getElementById(id).value = '');
    openModal('modalClient');
  },

  async save() {
    const body = {
      name: document.getElementById('c_name').value.trim(),
      rut: document.getElementById('c_rut').value.trim(),
      contact: document.getElementById('c_contact').value.trim(),
      email: document.getElementById('c_email').value.trim(),
      phone: document.getElementById('c_phone').value.trim(),
    };
    if (!body.name) return toast('El nombre es obligatorio', true);
    try {
      await API.post('/api/clients', body);
      closeModal('modalClient');
      toast('Cliente creado');
      this.load();
    } catch (e) { toast(e.message, true); }
  }
};
