// util.js — Fondasi frontend: API client, format Indonesia, toast, modal.

// State bersama antar view (mis. pengaturan klinik & user aktif). Diisi saat app dimuat.
export const store = { settings: {}, user: null };

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------
export const api = {
  async req(method, url, body) {
    const opt = { method, headers: {}, credentials: 'same-origin' };
    if (body !== undefined) {
      opt.headers['Content-Type'] = 'application/json';
      opt.body = JSON.stringify(body);
    }
    const res = await fetch(url, opt);
    const text = await res.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    if (!res.ok) {
      const err = new Error((data && data.error) || `Kesalahan ${res.status}`);
      err.status = res.status;
      // Sesi berakhir di tengah pemakaian → beri tahu app agar tampilkan layar login.
      // Endpoint /api/auth sendiri dikecualikan (mis. login gagal, cek /me awal).
      if (res.status === 401 && !url.includes('/api/auth/')) {
        window.dispatchEvent(new Event('vk-unauthorized'));
      }
      throw err;
    }
    return data;
  },
  get(u) {
    return this.req('GET', u);
  },
  post(u, b) {
    return this.req('POST', u, b);
  },
  put(u, b) {
    return this.req('PUT', u, b);
  },
  del(u) {
    return this.req('DELETE', u);
  },
};

// ---------------------------------------------------------------------------
// Escape HTML (mencegah XSS dari data pengguna)
// ---------------------------------------------------------------------------
export function esc(s) {
  if (s == null) return '';
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}

// Emoji sesuai spesies (untuk tampilan yang lebih hidup)
export function spesiesEmoji(s) {
  const k = String(s || '').toLowerCase();
  if (k.includes('anjing')) return '🐶';
  if (k.includes('kucing')) return '🐱';
  if (k.includes('kelinci')) return '🐰';
  if (k.includes('burung')) return '🐦';
  if (k.includes('hamster') || k.includes('marmut')) return '🐹';
  if (k.includes('reptil') || k.includes('ular') || k.includes('kadal')) return '🦎';
  if (k.includes('ikan')) return '🐠';
  if (k.includes('musang')) return '🦡';
  return '🐾';
}

// ---------------------------------------------------------------------------
// Format Rupiah & tanggal Indonesia
// ---------------------------------------------------------------------------
export function rupiah(n) {
  const v = Math.round(Number(n) || 0);
  return 'Rp ' + v.toLocaleString('id-ID');
}

export function angka(n) {
  return (Number(n) || 0).toLocaleString('id-ID');
}

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const BULAN_PANJANG = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

function parseDate(iso) {
  if (!iso) return null;
  const [datePart, timePart] = String(iso).split(/[ T]/);
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) return null;
  let hh = 0,
    mm = 0;
  if (timePart) [hh, mm] = timePart.split(':').map(Number);
  return new Date(y, m - 1, d, hh || 0, mm || 0);
}

export function tanggal(iso) {
  const dt = parseDate(iso);
  if (!dt) return '-';
  return `${dt.getDate()} ${BULAN[dt.getMonth()]} ${dt.getFullYear()}`;
}

export function tanggalPanjang(iso) {
  const dt = parseDate(iso);
  if (!dt) return '-';
  return `${HARI[dt.getDay()]}, ${dt.getDate()} ${BULAN_PANJANG[dt.getMonth()]} ${dt.getFullYear()}`;
}

export function jam(iso) {
  const dt = parseDate(iso);
  if (!dt) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(dt.getHours())}:${p(dt.getMinutes())}`;
}

export function tanggalWaktu(iso) {
  const t = tanggal(iso);
  const j = jam(iso);
  return j ? `${t} · ${j}` : t;
}

export function hariIniISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d - off * 60000).toISOString().slice(0, 10);
}

export function toInputDatetime(iso) {
  if (!iso) return '';
  return String(iso).replace(' ', 'T').slice(0, 16);
}

export function fromInputDatetime(v) {
  if (!v) return '';
  return v.replace('T', ' ').slice(0, 16);
}

export function umur(birth) {
  const dt = parseDate(birth);
  if (!dt) return null;
  const now = new Date();
  let months = (now.getFullYear() - dt.getFullYear()) * 12 + (now.getMonth() - dt.getMonth());
  if (now.getDate() < dt.getDate()) months--;
  if (months < 0) return null;
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m} bln`;
  if (m === 0) return `${y} thn`;
  return `${y} thn ${m} bln`;
}

// Selisih hari dari hari ini: positif = mendatang, negatif = lewat.
export function selisihHari(iso) {
  const dt = parseDate(iso);
  if (!dt) return null;
  const now = parseDate(hariIniISO());
  return Math.round((dt - now) / 86400000);
}

// Selisih menit dari sekarang: positif = sudah lewat (masa lalu).
export function selisihMenit(iso) {
  const dt = parseDate(iso);
  if (!dt) return null;
  return Math.round((new Date() - dt) / 60000);
}

// Durasi ringkas dari jumlah menit → "12 mnt" / "1 jam 5 mnt".
export function durasiSingkat(menit) {
  if (menit == null) return '';
  const m = Math.max(0, Math.abs(menit));
  if (m < 60) return `${m} mnt`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} jam ${r} mnt` : `${h} jam`;
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------
export function toast(msg, type = 'success') {
  const box = document.getElementById('toast');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  box.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, 3200);
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------
let modalOnClose = null;

export function openModal(html, { onMount, onClose, width, dismissable = true } = {}) {
  const root = document.getElementById('modal');
  root.innerHTML = `<div class="modal-backdrop"><div class="modal-card"${
    width ? ` style="max-width:${width}"` : ''
  }>${html}</div></div>`;
  root.classList.add('open');
  document.body.style.overflow = 'hidden';
  const backdrop = root.querySelector('.modal-backdrop');
  if (dismissable) {
    backdrop.addEventListener('mousedown', (e) => {
      if (e.target === backdrop) closeModal();
    });
    document.addEventListener('keydown', escClose);
  }
  root.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => closeModal()));
  modalOnClose = onClose || null;
  if (onMount) onMount(root.querySelector('.modal-card'));
  // fokus input pertama
  const first = root.querySelector('input, select, textarea, button');
  if (first) first.focus();
}

function escClose(e) {
  if (e.key === 'Escape') closeModal();
}

export function closeModal() {
  const root = document.getElementById('modal');
  if (!root.classList.contains('open')) return;
  root.classList.remove('open');
  root.innerHTML = '';
  document.body.style.overflow = '';
  document.removeEventListener('keydown', escClose);
  const cb = modalOnClose;
  modalOnClose = null;
  if (cb) cb();
}

export function confirmDialog(msg, { danger = true, okText = 'Hapus', cancelText = 'Batal', title = 'Konfirmasi' } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => {
      if (done) return;
      done = true;
      resolve(v);
    };
    openModal(
      `<div class="modal-head"><h3>${esc(title)}</h3></div>
       <div class="modal-body"><p style="margin:0">${esc(msg)}</p></div>
       <div class="modal-foot">
         <button class="btn btn-ghost" data-cancel>${esc(cancelText)}</button>
         <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${esc(okText)}</button>
       </div>`,
      {
        onClose: () => finish(false),
        onMount(card) {
          card.querySelector('[data-cancel]').addEventListener('click', () => {
            finish(false);
            closeModal();
          });
          card.querySelector('[data-ok]').addEventListener('click', () => {
            finish(true);
            closeModal();
          });
        },
      }
    );
  });
}

// ---------------------------------------------------------------------------
// Helper form: ambil nilai dari elemen form sebagai objek
// ---------------------------------------------------------------------------
export function formData(formEl) {
  const obj = {};
  formEl.querySelectorAll('[name]').forEach((el) => {
    if (el.type === 'checkbox') obj[el.name] = el.checked;
    else obj[el.name] = el.value;
  });
  return obj;
}

// Badge status untuk janji temu & tagihan
export function statusBadge(status) {
  const map = {
    Menunggu: 'badge-wait',
    Diperiksa: 'badge-info',
    Selesai: 'badge-ok',
    Batal: 'badge-muted',
    Lunas: 'badge-ok',
    'Belum Bayar': 'badge-danger',
    Sebagian: 'badge-wait',
  };
  return `<span class="badge ${map[status] || 'badge-muted'}">${esc(status || '-')}</span>`;
}

// ---------------------------------------------------------------------------
// WhatsApp (klik-untuk-chat / wa.me)
// ---------------------------------------------------------------------------
// Normalisasi nomor telepon Indonesia ke format internasional tanpa "+"/spasi,
// mis. "0812-3456-7890" → "6281234567890" (dipakai wa.me).
export function nomorWa(phone) {
  let s = String(phone || '').replace(/[^\d+]/g, '');
  if (!s) return '';
  s = s.replace(/^\+/, '');
  if (s.startsWith('62')) return s;
  if (s.startsWith('0')) return '62' + s.slice(1);
  if (s.startsWith('8')) return '62' + s; // nomor HP tanpa awalan 0
  return s;
}

// Tautan klik-untuk-chat WhatsApp. Tanpa nomor → WhatsApp minta pilih kontak.
export function waLink(phone, text) {
  const num = nomorWa(phone);
  const base = num ? `https://wa.me/${num}` : 'https://wa.me/';
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

// ---------------------------------------------------------------------------
// Peran & hak akses (mirror dari guard sisi server)
// ---------------------------------------------------------------------------
export const ROLE_LABEL = { admin: 'Admin', dokter: 'Dokter', resepsionis: 'Resepsionis' };

export function roleLabel(role) {
  return ROLE_LABEL[role] || role || '-';
}

export function roleBadge(role) {
  const cls = role === 'admin' ? 'badge-teal' : role === 'dokter' ? 'badge-info' : 'badge-muted';
  return `<span class="badge ${cls}">${esc(roleLabel(role))}</span>`;
}

// Section yang dibatasi peran tertentu. Section tak terdaftar = boleh semua peran.
export const CAN = {
  records: ['admin', 'dokter'],
  vaccinations: ['admin', 'dokter'],
  asisten: ['admin', 'dokter'],
  settings: ['admin'],
  users: ['admin'],
};

export function canAccess(section, role) {
  const allowed = CAN[section];
  return !allowed || allowed.includes(role);
}
