function toast(msg, isError) {
  const el = document.createElement('div');
  el.className = 'toastmsg' + (isError ? ' error' : '');
  el.textContent = msg;
  document.getElementById('toast').appendChild(el);
  setTimeout(() => el.remove(), 3600);
}

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
  document.querySelectorAll('.nav button').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  if (name === 'quotes') Quotes.load();
  if (name === 'products') Products.load();
  if (name === 'fichas') Fichas.load();
  if (name === 'clients') Clients.load();
  if (name === 'settings') Settings.load();
  if (name === 'companies') Companies.load();
}

function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('fs_theme', theme);
  document.getElementById('themeIcon').textContent = theme === 'dark' ? '☀️' : '🌙';
  document.getElementById('themeLabel').textContent = theme === 'dark' ? 'Modo claro' : 'Modo oscuro';
}

document.addEventListener('DOMContentLoaded', async () => {
  const currentTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  applyTheme(currentTheme);
  document.getElementById('btnThemeToggle').addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  });
  document.querySelectorAll('.nav button').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));
  document.querySelectorAll('.overlay').forEach(ov => {
    ov.addEventListener('click', e => { if (e.target === ov) ov.classList.remove('open'); });
  });

  // Primero hay que saber con qué empresa se trabaja: todo lo demás depende de eso
  // (el header X-Company-Id que api.js manda en cada request se arma con este valor).
  await Companies.resolveActive();
  Companies.init();

  Settings.loadSidebarLogo();
  Products.init();
  Clients.init();
  Quotes.init();
  Fichas.init();
  Settings.init();
  BrandLogos.init();
  showView('quotes');
});
