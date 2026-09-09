// app.js — Router (hash-based) + inisialisasi aplikasi + gerbang autentikasi.
import { api, store, tanggalPanjang, hariIniISO, esc, canAccess, roleLabel } from './util.js';
import dashboard from './views/dashboard.js';
import appointments from './views/appointments.js';
import owners from './views/owners.js';
import records from './views/records.js';
import vaccinations from './views/vaccinations.js';
import settings from './views/settings.js';
import asisten from './views/asisten.js';
import komunikasi from './views/komunikasi.js';
import users from './views/users.js';
import * as patients from './views/patients.js';
import * as invoices from './views/invoices.js';
import { changePasswordForm } from './views/forms.js';

const TITLES = {
  dashboard: 'Beranda',
  appointments: 'Janji Temu & Kedatangan',
  patients: 'Pasien',
  owners: 'Pemilik',
  records: 'Rekam Medis',
  vaccinations: 'Vaksinasi',
  invoices: 'Tagihan',
  settings: 'Pengaturan',
  asisten: 'Asisten Kasus',
  komunikasi: 'Komunikasi',
  users: 'Manajemen Pengguna',
};

async function router() {
  const hash = location.hash.slice(1) || '/dashboard';
  const parts = hash.replace(/^\//, '').split('/');
  const section = parts[0] || 'dashboard';
  const id = parts[1];
  const view = document.getElementById('view');

  document.querySelectorAll('.nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === section));
  document.getElementById('pageTitle').textContent = TITLES[section] || 'VetKlinik';
  document.getElementById('sidebar').classList.remove('open');
  view.innerHTML = '<div class="loading">Memuat…</div>';

  // Gerbang hak akses sisi klien (server tetap penjaga utama).
  if (store.user && !canAccess(section, store.user.role)) {
    view.innerHTML =
      '<div class="empty"><span class="big">🔒</span>Akses ditolak. Anda tidak punya izin membuka halaman ini.</div>';
    return;
  }

  try {
    switch (section) {
      case 'dashboard':
        await dashboard(view);
        break;
      case 'appointments':
        await appointments(view);
        break;
      case 'patients':
        id ? await patients.detail(view, id) : await patients.list(view);
        break;
      case 'owners':
        await owners(view);
        break;
      case 'records':
        await records(view);
        break;
      case 'vaccinations':
        await vaccinations(view);
        break;
      case 'invoices':
        id ? await invoices.detail(view, id) : await invoices.list(view);
        break;
      case 'settings':
        await settings(view);
        break;
      case 'asisten':
        await asisten(view, id);
        break;
      case 'komunikasi':
        await komunikasi(view);
        break;
      case 'users':
        await users(view);
        break;
      default:
        view.innerHTML = '<div class="empty"><span class="big">🔍</span>Halaman tidak ditemukan.</div>';
    }
    window.scrollTo(0, 0);
  } catch (e) {
    console.error(e);
    view.innerHTML = `<div class="empty"><span class="big">⚠️</span>${esc(e.message || 'Terjadi kesalahan.')}</div>`;
  }
}

// Sembunyikan menu yang tak diizinkan untuk peran user saat ini.
function applyRoleNav() {
  const role = store.user && store.user.role;
  document.querySelectorAll('.nav a[data-roles]').forEach((a) => {
    const roles = a.dataset.roles.split(',').map((s) => s.trim());
    a.style.display = roles.includes(role) ? '' : 'none';
  });
}

// Kotak identitas user + tombol Ganti Sandi & Keluar di kaki sidebar.
function fillUserBox() {
  const foot = document.getElementById('sidebarFoot');
  const u = store.user;
  if (!foot || !u) return;
  const initial = esc((u.name || u.username || '?').slice(0, 1).toUpperCase());
  foot.innerHTML = `
    <div class="user-box">
      <div class="user-ava">${initial}</div>
      <div class="user-meta">
        <div class="user-name">${esc(u.name || u.username)}</div>
        <div class="user-role">${esc(roleLabel(u.role))}</div>
      </div>
    </div>
    <div class="user-actions">
      <button class="btn btn-ghost btn-sm" id="btnChangePw">Ganti Sandi</button>
      <button class="btn btn-ghost btn-sm" id="btnLogout">Keluar</button>
    </div>`;
  foot.querySelector('#btnChangePw').addEventListener('click', () => changePasswordForm());
  foot.querySelector('#btnLogout').addEventListener('click', logout);
}

async function logout() {
  try {
    await api.post('/api/auth/logout');
  } catch {
    /* abaikan — tetap keluar di sisi klien */
  }
  store.user = null;
  location.reload();
}

// Layar login penuh (ditampilkan saat belum ada sesi aktif).
function showLogin(message) {
  const app = document.querySelector('.app');
  if (app) app.style.display = 'none';
  const auth = document.getElementById('auth');
  auth.hidden = false;
  auth.innerHTML = `
    <div class="auth-card">
      <div class="auth-logo">🐾</div>
      <h1 class="auth-title">VetKlinik</h1>
      <p class="auth-sub">Masuk untuk melanjutkan</p>
      ${message ? `<div class="auth-err">${esc(message)}</div>` : ''}
      <form id="loginForm" autocomplete="on">
        <div class="field"><label>Username</label>
          <input class="input" name="username" autocomplete="username" required /></div>
        <div class="field"><label>Sandi</label>
          <input class="input" type="password" name="password" autocomplete="current-password" required /></div>
        <div id="loginErr" class="auth-err" hidden></div>
        <button type="submit" class="btn btn-primary" style="width:100%">Masuk</button>
      </form>
    </div>`;
  const form = auth.querySelector('#loginForm');
  const errBox = auth.querySelector('#loginErr');
  form.username.focus();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    errBox.hidden = true;
    try {
      await api.post('/api/auth/login', {
        username: form.username.value.trim(),
        password: form.password.value,
      });
      location.reload();
    } catch (err) {
      errBox.textContent = err.message || 'Gagal masuk.';
      errBox.hidden = false;
      btn.disabled = false;
    }
  });
}

async function init() {
  // --- Gerbang autentikasi: cek sesi aktif dulu. ---
  let me = null;
  try {
    me = await api.get('/api/auth/me');
  } catch {
    me = null;
  }
  if (!me) {
    showLogin();
    return;
  }
  store.user = me;

  // Muat pengaturan klinik untuk sidebar & form.
  try {
    store.settings = (await api.get('/api/settings')) || {};
  } catch {
    store.settings = {};
  }
  if (store.settings.clinic_name) {
    document.getElementById('brandName').textContent = store.settings.clinic_name;
  }
  document.getElementById('topDate').textContent = tanggalPanjang(hariIniISO());

  document.getElementById('menuBtn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  applyRoleNav();
  fillUserBox();

  window.addEventListener('hashchange', router);
  window.addEventListener('vk-unauthorized', () =>
    showLogin('Sesi Anda berakhir. Silakan masuk kembali.')
  );
  await router();

  // Akun bawaan / sandi yang direset admin → wajib ganti sandi sebelum lanjut.
  if (me.must_change) {
    changePasswordForm(
      () => {
        store.user.must_change = 0;
      },
      { force: true }
    );
  }
}

init();
