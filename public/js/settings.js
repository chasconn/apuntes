const Settings = {
  data: {},
  pendingLogoPath: '',

  init() {
    document.getElementById('btnSaveSettings').addEventListener('click', () => this.save());
    document.getElementById('settingsLogoFile').addEventListener('change', e => this.onLogoPick(e));
    document.getElementById('btnSaveBank').addEventListener('click', () => this.saveBank());
    document.getElementById('btnSaveTerms').addEventListener('click', () => this.saveTerms());
    document.getElementById('btnSaveLetter').addEventListener('click', () => this.saveLetter());
  },

  async loadSidebarLogo() {
    try {
      const s = await API.get('/api/settings');
      if (s.logo_path) document.getElementById('sidebarLogo').src = s.logo_path;
      if (s.company_name) document.querySelector('.sidebar .brand .name').firstChild.textContent = s.company_name + ' ';
    } catch (e) { /* silencioso */ }
  },

  async load() {
    try {
      this.data = await API.get('/api/settings');
      document.getElementById('s_company_name').value = this.data.company_name || '';
      document.getElementById('s_company_rut').value = this.data.company_rut || '';
      document.getElementById('s_company_phone').value = this.data.company_phone || '';
      document.getElementById('s_company_address').value = this.data.company_address || '';
      document.getElementById('s_company_email').value = this.data.company_email || '';
      document.getElementById('s_company_web').value = this.data.company_web || '';
      document.getElementById('s_quote_prefix').value = this.data.quote_prefix || 'COT';
      document.getElementById('s_next_quote_seq').value = this.data.next_quote_seq || '1';
      document.getElementById('s_legal_notice').value = this.data.legal_notice || '';
      document.getElementById('s_bank_name').value = this.data.bank_name || '';
      document.getElementById('s_bank_account_type').value = this.data.bank_account_type || '';
      document.getElementById('s_bank_account_number').value = this.data.bank_account_number || '';
      document.getElementById('s_bank_rut').value = this.data.bank_rut || '';
      document.getElementById('s_bank_holder').value = this.data.bank_holder || '';
      document.getElementById('s_bank_email').value = this.data.bank_email || '';
      document.getElementById('s_terms_delivery').value = this.data.terms_delivery || '';
      document.getElementById('s_terms_payment').value = this.data.terms_payment || '';
      document.getElementById('s_terms_startup').value = this.data.terms_startup || '';
      document.getElementById('s_terms_scope').value = this.data.terms_scope || '';
      document.getElementById('s_terms_warranty').value = this.data.terms_warranty || '';
      document.getElementById('s_terms_docs').value = this.data.terms_docs || '';
      document.getElementById('s_terms_link').value = this.data.terms_link || '';
      document.getElementById('s_letter_intro').value = this.data.letter_intro || '';
      document.getElementById('s_letter_signer_name').value = this.data.letter_signer_name || '';
      document.getElementById('s_letter_signer_role').value = this.data.letter_signer_role || '';
      this.pendingLogoPath = this.data.logo_path || '';
      this.setLogoPreview(this.pendingLogoPath);
      BrandLogos.load();
    } catch (e) { toast(e.message, true); }
  },

  setLogoPreview(path) {
    const el = document.getElementById('settingsLogoPrev');
    el.innerHTML = path ? `<img src="${esc(path)}" alt="">` : `<span style="font-size:10px;color:#a9b2c6">Sin logo</span>`;
  },

  async onLogoPick(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const path = await API.upload(file);
      this.pendingLogoPath = path;
      this.setLogoPreview(path);
    } catch (err) { toast(err.message, true); }
  },

  async save() {
    const body = {
      company_name: document.getElementById('s_company_name').value.trim(),
      company_rut: document.getElementById('s_company_rut').value.trim(),
      company_phone: document.getElementById('s_company_phone').value.trim(),
      company_address: document.getElementById('s_company_address').value.trim(),
      company_email: document.getElementById('s_company_email').value.trim(),
      company_web: document.getElementById('s_company_web').value.trim(),
      quote_prefix: document.getElementById('s_quote_prefix').value.trim() || 'COT',
      next_quote_seq: document.getElementById('s_next_quote_seq').value || '1',
      legal_notice: document.getElementById('s_legal_notice').value.trim(),
      logo_path: this.pendingLogoPath
    };
    try {
      await API.put('/api/settings', body);
      toast('Configuración guardada');
      this.loadSidebarLogo();
    } catch (e) { toast(e.message, true); }
  },

  async saveBank() {
    const body = {
      bank_name: document.getElementById('s_bank_name').value.trim(),
      bank_account_type: document.getElementById('s_bank_account_type').value.trim(),
      bank_account_number: document.getElementById('s_bank_account_number').value.trim(),
      bank_rut: document.getElementById('s_bank_rut').value.trim(),
      bank_holder: document.getElementById('s_bank_holder').value.trim(),
      bank_email: document.getElementById('s_bank_email').value.trim()
    };
    try {
      await API.put('/api/settings', body);
      toast('Datos de transferencia guardados');
    } catch (e) { toast(e.message, true); }
  },

  async saveTerms() {
    const body = {
      terms_delivery: document.getElementById('s_terms_delivery').value.trim(),
      terms_payment: document.getElementById('s_terms_payment').value.trim(),
      terms_startup: document.getElementById('s_terms_startup').value.trim(),
      terms_scope: document.getElementById('s_terms_scope').value.trim(),
      terms_warranty: document.getElementById('s_terms_warranty').value.trim(),
      terms_docs: document.getElementById('s_terms_docs').value.trim(),
      terms_link: document.getElementById('s_terms_link').value.trim()
    };
    try {
      await API.put('/api/settings', body);
      toast('Términos y Condiciones guardados');
    } catch (e) { toast(e.message, true); }
  },

  async saveLetter() {
    const body = {
      letter_intro: document.getElementById('s_letter_intro').value.trim(),
      letter_signer_name: document.getElementById('s_letter_signer_name').value.trim(),
      letter_signer_role: document.getElementById('s_letter_signer_role').value.trim()
    };
    try {
      await API.put('/api/settings', body);
      toast('Carta de presentación guardada');
    } catch (e) { toast(e.message, true); }
  }
};
