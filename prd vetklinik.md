# Sistem Login & Manajemen Pengguna — VetKlinik

## Context

VetKlinik saat ini **tidak punya autentikasi sama sekali**: `express.static` menyajikan seluruh SPA dan setiap endpoint `/api/*` terbuka untuk siapa pun di jaringan (LAN klinik). Untuk klinik multi-komputer, ini berisiko — semua staf punya akses penuh, tanpa akuntabilitas.

Tujuan: menambahkan **login** (semua modul terkunci di balik autentikasi) dan **manajemen pengguna** dengan **tiga peran** (Admin, Dokter, Resepsionis) dan pembatasan akses per-modul. Tetap setia pada semangat "versi ringan": **tanpa dependency baru** (pakai `crypto` bawaan Node + sesi di SQLite + cookie HttpOnly), self-migrasi pada DB yang sudah ada, dan langsung jalan lewat akun admin bawaan.

Keputusan yang sudah dikonfirmasi user:
- **3 peran**: Admin, Dokter, Resepsionis (gating per-modul).
- **Akun admin bawaan**: `admin` / `admin123`, **wajib ganti sandi saat pertama login**.

## Matriks Hak Akses

| Modul (section)                    | Admin | Dokter | Resepsionis |
|------------------------------------|:---:|:---:|:---:|
| Beranda `dashboard`                | ✓ | ✓ | ✓ |
| Janji & Kedatangan `appointments` + `arrivals` | ✓ | ✓ | ✓ |
| Pasien `patients` / Pemilik `owners` | ✓ | ✓ | ✓ |
| Tagihan `invoices`                 | ✓ | ✓ | ✓ |
| Komunikasi `komunikasi`            | ✓ | ✓ | ✓ |
| Rekam Medis `records`              | ✓ | ✓ | ✗ |
| Vaksinasi `vaccinations`           | ✓ | ✓ | ✗ |
| Asisten Kasus `asisten`            | ✓ | ✓ | ✗ |
| Pengaturan `settings` (PUT)        | ✓ | ✗ | ✗ |
| Pengguna `users`                   | ✓ | ✗ | ✗ |

Catatan: `GET /api/settings` tetap boleh untuk semua peran (dipakai `init()` untuk nama klinik di kop/topbar); hanya **PUT** yang dibatasi Admin. Peran disimpan sebagai `'admin' | 'dokter' | 'resepsionis'`.

## Pendekatan Teknis (tanpa dependency baru)

- **Hash sandi**: `crypto.scryptSync` + salt acak 16-byte, disimpan `"saltHex:hashHex"`. Verifikasi pakai `crypto.timingSafeEqual`.
- **Sesi**: tabel `sessions` di SQLite berisi token acak (`crypto.randomBytes(32)`), `user_id`, `expires_at` (7 hari). Dikirim via **cookie HttpOnly** `vk_session` (`SameSite=Lax`, `Path=/`, tanpa `Secure` karena LAN via HTTP). Set/clear pakai `res.cookie()` / `res.clearCookie()` bawaan Express (tak butuh cookie-parser). Baca via parse manual `req.headers.cookie`.
- Pola error tetap: lempar `Error` dengan `.status` (401/403/409) → ditangani error handler terpusat di [server.js](server.js:48).

## Berkas Baru

1. **`security.js`** (murni, tanpa import db — hindari siklus): `hashPassword(pw)`, `verifyPassword(pw, stored)`, `randomToken()`.
2. **`auth.js`** (import `db` + `security`): `parseCookies(req)`, `createSession(userId)`, `destroySession(token)`, `getSessionUser(token)`, middleware `requireAuth`, factory `requireRole(...roles)`, `setSessionCookie(res, token)` / `clearSessionCookie(res)`. `requireAuth` menolak user non-aktif.
3. **`routes/auth.js`** (publik, tanpa guard global): 
   - `POST /login` `{username,password}` → verifikasi, buat sesi + set cookie, update `last_login_at`, balas `{id,username,name,role,must_change}`. Gagal → 401 generik "Username atau sandi salah."
   - `POST /logout` → hapus sesi + clear cookie.
   - `GET /me` → user aktif dari cookie, atau 401.
   - `POST /change-password` (pakai `requireAuth`) `{current_password,new_password}` → verifikasi lama, set hash baru, `must_change=0`.
4. **`routes/users.js`** (Admin-only): `GET /` (tanpa hash), `POST /` `{username,name,role,password}` (tangani UNIQUE → 409 "Username sudah dipakai."), `PUT /:id` `{name,role,active}`, `PUT /:id/password` `{new_password}` (+ hapus sesi user itu → paksa login ulang), `DELETE /:id`. **Pengaman anti-terkunci**: minimal harus selalu ada **≥1 admin aktif** — tolak hapus/nonaktif/turunkan-peran admin terakhir, dan tolak hapus/nonaktifkan diri sendiri bila admin terakhir (helper `activeAdminCount()`).
5. **`public/js/views/users.js`** (Admin): tabel pengguna (username, nama, badge peran, status aktif, login terakhir) + aksi Edit / Reset Sandi / Aktif-Nonaktif / Hapus + tombol "Tambah Pengguna". Mengikuti pola [settings.js](public/js/views/settings.js) & modal di [forms.js](public/js/views/forms.js).

## Berkas Dimodifikasi

- **[db.js](db.js)**: tambah tabel `users` (`username UNIQUE`, `name`, `role`, `password_hash`, `active`, `last_login_at`, `must_change`, `created_at`) + `sessions` (`token PK`, `user_id` FK CASCADE, `expires_at`) di blok `exec()` (setelah `arrivals`). Import `hashPassword` dari `security.js`. Tambah seed ala `ownerCount`: `if (SELECT COUNT(*) FROM users === 0)` → buat admin bawaan (`admin`/`admin123`, role `admin`, `must_change=1`). DB lama otomatis ter-migrasi (`CREATE TABLE IF NOT EXISTS` + seed saat kosong).
- **[server.js](server.js)**: import `authRoutes`, `users`, `{ requireAuth, requireRole }`. Urutan mount:
  ```
  app.use('/api/auth', authRoutes);                 // publik
  app.use('/api', requireAuth);                      // semua di bawah wajib login
  app.use('/api/owners', owners); ...                // semua peran
  app.use('/api/records', requireRole('admin','dokter'), records);
  app.use('/api/vaccinations', requireRole('admin','dokter'), vaccinations);
  app.use('/api/asisten', requireRole('admin','dokter'), asisten);
  app.use('/api/users', requireRole('admin'), users);
  ```
  `settings` PUT dibatasi di dalam [routes/settings.js](routes/settings.js) (`r.put('/', requireRole('admin'), ...)`), GET tetap terbuka.
- **[public/js/util.js](public/js/util.js)**: `api.req` → tambah `credentials:'same-origin'`; saat `!res.ok` sematkan `err.status = res.status`; bila `401` dan bukan panggilan `/api/auth/*`, `window.dispatchEvent(new Event('vk-unauthorized'))` lalu lempar. Tambah `store.user = null`, helper `roleLabel(role)` & `roleBadge(role)`, dan set `CAN` (peta izin per-section) + `canAccess(section, role)`.
- **[public/index.html](public/index.html)**: tambah layer `<div id="auth" class="auth-screen" hidden></div>` (sibling `.app`). Tambah nav link `👥 Pengguna` (`data-route="users" data-roles="admin"`) dan atribut `data-roles` pada link records/vaccinations/asisten/settings. `.sidebar-foot` diisi kotak user (nama + peran) + tombol **Ganti Sandi** & **Keluar** oleh JS.
- **[public/js/app.js](public/js/app.js)**: 
  - `init()` diawali **auth gate**: `const me = await api.get('/api/auth/me').catch(()=>null)`; bila null → `showLogin()` & berhenti. Bila ada → `store.user = me`, lanjut init lama (settings, brand, tanggal, menu, router), isi kotak user, sembunyikan nav yang tak diizinkan (`data-roles`), dan bila `me.must_change` → buka modal **Ganti Sandi** wajib + toast peringatan.
  - `router()`: sebelum dispatch, `if (!canAccess(section, store.user.role))` → tampilkan "Akses ditolak". Tambah `case 'users'`, `TITLES.users='Manajemen Pengguna'`.
  - Fungsi baru: `showLogin()` (render kartu login ke `#auth`, sembunyikan `.app`), submit → `POST /api/auth/login` → sukses → `location.reload()` (re-init bersih). `logout()` → `POST /api/auth/logout` → reload. Listener `vk-unauthorized` → `showLogin()`.
- **[public/js/views/forms.js](public/js/views/forms.js)**: tambah `userForm(existing,onSaved)` (username [disabled saat edit], nama, select peran, sandi [hanya saat buat]), `resetPasswordForm(user,onSaved)`, `changePasswordForm(onSaved,{force})`. Pakai `wrap/onSubmit/opt` yang sudah ada.
- **[public/css/style.css](public/css/style.css)**: `.auth-screen` (full-screen, gradient teal, grid center), `.auth-card` (kartu putih), `.auth-logo`, `.user-box` (chip user di sidebar-foot), badge peran (pakai `.badge` yang ada).
- **[README.md](README.md)**: bagian baru **🔐 Login & Pengguna** (peran + matriks, kredensial admin bawaan `admin`/`admin123`, wajib ganti sandi, alur reset). Update baris fitur & catatan "Reset Data" (tabel `users`/`sessions` ikut).

## Verifikasi (end-to-end)

1. **Restart server** (buat tabel + seed admin). Cek log boot bersih.
2. **API (via curl/preview_eval `fetch`)**:
   - `POST /api/auth/login` `admin`/`admin123` → 200 + `Set-Cookie: vk_session`; `must_change:1`.
   - `GET /api/owners` tanpa cookie → **401**.
   - `GET /api/auth/me` dengan cookie → data admin.
3. **UI (preview_* di serverId aktif)**:
   - Muat halaman → **layar login** tampil (`.app` tersembunyi).
   - Login admin → modal **wajib ganti sandi** muncul; ganti → tersimpan.
   - Nav Admin lengkap termasuk **Pengguna**; buka Pengguna → **Tambah** user Dokter & Resepsionis.
   - **Keluar**, login sebagai Resepsionis → nav **tanpa** Rekam Medis/Vaksinasi/Asisten/Pengaturan/Pengguna; akses paksa `#/records` → "Akses ditolak"; `fetch('/api/records')` → **403**.
   - Login sebagai Dokter → Rekam Medis/Vaksinasi/Asisten muncul; Pengguna/Pengaturan tidak.
   - Uji **anti-terkunci**: coba hapus/nonaktifkan admin terakhir → ditolak dengan pesan.
4. **Bersihkan data uji**: hapus user Dokter/Resepsionis percobaan, kembalikan sandi admin ke `admin123` + `must_change=1`, sehingga data contoh tetap bersih. Verifikasi lewat `preview_snapshot`/`fetch`.

## Catatan
- Tak ada dependency baru → `npm install` tetap ringan; hanya `crypto` bawaan Node.
- Frontend statis tetap publik (wajar untuk SPA); **data** dilindungi di lapisan API.
- Sesi kadaluarsa 7 hari; user dinonaktifkan/dihapus → ditolak pada request berikutnya (dan sesi ikut terhapus via CASCADE saat delete).
