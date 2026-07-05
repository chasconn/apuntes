function activeCompanyId() { return localStorage.getItem('fs_company_id') || ''; }

const API = {
  async _req(method, url, body) {
    const opts = { method, headers: { 'X-Company-Id': activeCompanyId() } };
    if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    const res = await fetch(url, opts);
    let data = null;
    try { data = await res.json(); } catch (e) { /* no body */ }
    if (!res.ok) throw new Error((data && data.error) || `Error ${res.status}`);
    return data;
  },
  get(url) { return this._req('GET', url); },
  post(url, body) { return this._req('POST', url, body); },
  put(url, body) { return this._req('PUT', url, body); },
  del(url) { return this._req('DELETE', url); },
  async upload(file) {
    const fd = new FormData();
    fd.append('image', file);
    const res = await fetch('/api/upload', { method: 'POST', headers: { 'X-Company-Id': activeCompanyId() }, body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al subir imagen');
    return data.path;
  },
  async uploadPdf(file) {
    const fd = new FormData();
    fd.append('pdf', file);
    const res = await fetch('/api/upload-pdf', { method: 'POST', headers: { 'X-Company-Id': activeCompanyId() }, body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al subir el PDF');
    return data.path;
  }
};

function fmtCLP(n) {
  n = Math.round(Number(n) || 0);
  return '$' + n.toLocaleString('es-CL');
}
function fmtDate(s) {
  if (!s) return '';
  const [y, m, d] = String(s).slice(0, 10).split('-');
  return `${d}-${m}-${y}`;
}
function todayISO() { return new Date().toISOString().slice(0, 10); }
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
