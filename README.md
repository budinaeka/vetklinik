# 🐾 VetKlinik — Sistem Manajemen Klinik Hewan (Versi Ringan)

Aplikasi web ringan untuk **klinik hewan & pusat kesehatan hewan di Indonesia**.
Terinspirasi dari proyek open-source [OpenVPM](https://github.com/evangauer/openvpm),
namun dirancang ulang agar **ringan, mudah dipasang, dan sesuai kebutuhan lokal**:
Bahasa Indonesia, mata uang Rupiah, format tanggal Indonesia, dan penekanan pada
**pengingat vaksinasi rabies**.

Data disimpan di satu server kecil (Node.js + SQLite) sehingga **bisa diakses
bersama oleh beberapa komputer/staf** dalam satu jaringan klinik (LAN/WiFi).

---

## ✨ Fitur

| Modul | Keterangan |
|-------|-----------|
| 🏠 **Beranda** | Ringkasan: pasien aktif, janji hari ini, vaksin jatuh tempo, pemasukan bulan ini, pengingat rabies. |
| 📅 **Janji Temu & Kedatangan Pasien** | Jadwal kunjungan per tanggal (status Menunggu / Diperiksa / Selesai / Batal) **plus antrian ruang tunggu**: *check-in* satu klik dari janji temu atau catat pasien *walk-in*, lacak waktu tunggu, dan ringkasan harian. |
| 🐾 **Pasien & Pemilik** | Data hewan lengkap (spesies, ras, umur, berat, microchip, alergi, steril) & data pemilik. |
| 📋 **Rekam Medis** | Catatan pemeriksaan format **SOAP** (Subjektif, Objektif, Assessment, Plan). |
| 💉 **Vaksinasi** | Riwayat & jadwal vaksin, pengingat otomatis yang terlambat / akan jatuh tempo. |
| 🧾 **Kasir & Tagihan** | Tagihan Rupiah dengan rincian item, diskon, pajak, status bayar, dan **cetak/PDF**. |
| 🤖 **Asisten Kasus** | Tanya-jawab **AI** seputar kasus (diagnosis banding, toksikologi, keamanan obat per-spesies). Bisa dikaitkan ke data pasien. *Opsional — perlu kunci API.* |
| 💬 **Komunikasi** | Kirim pesan ke pemilik lewat **WhatsApp** (klik-untuk-chat) dengan template siap pakai: pengingat vaksinasi, konfirmasi janji, tagihan, kontrol. Daftar pengingat otomatis & riwayat kiriman. *Tanpa biaya / kunci API.* |
| ⚙️ **Pengaturan** | Nama, alamat, telepon, email klinik & dokter (tampil pada kop tagihan). |

Profil setiap pasien menampilkan tab **Rekam Medis · Vaksinasi · Janji Temu · Tagihan**
dalam satu layar.

---

## 📋 Prasyarat

- **Node.js versi 20 atau lebih baru** ([unduh di sini](https://nodejs.org)).
  Cek versi Anda:
  ```bash
  node -v
  ```

Tidak perlu database terpisah — SQLite sudah otomatis dibuat.

---

## 🚀 Cara Menjalankan

1. Buka terminal di dalam folder `vetklinik`.

2. Pasang dependensi (**cukup sekali** saat pertama kali):
   ```bash
   npm install
   ```

3. Jalankan server:
   ```bash
   npm start
   ```

4. Terminal akan menampilkan alamat akses, misalnya:
   ```
   🐾  VetKlinik berjalan
       Lokal    : http://localhost:3000
       Jaringan : http://192.168.18.5:3000  (untuk diakses staf lain di jaringan yang sama)
   ```

5. Buka **http://localhost:3000** di browser (Chrome/Edge/Firefox).

> Saat pertama kali dijalankan, aplikasi otomatis mengisi **data contoh**
> (beberapa pemilik, hewan, janji temu, kedatangan pasien, vaksinasi, dan 1 tagihan)
> agar mudah dicoba.

Untuk mode pengembangan (server otomatis restart saat kode diubah):
```bash
npm run dev
```

---

## 🌐 Akses dari Komputer Lain (Staf Klinik)

Selama semua komputer terhubung ke **jaringan yang sama** (WiFi/LAN klinik):

1. Jalankan server di **satu komputer** (jadikan sebagai "server klinik").
2. Catat alamat **Jaringan** yang muncul di terminal (mis. `http://192.168.18.5:3000`).
3. Di komputer/HP lain, buka alamat tersebut di browser.

Tips:
- Jika tidak bisa diakses, izinkan Node.js pada **Windows Firewall** (biasanya
  muncul dialog "Allow access" saat pertama kali `npm start`).
- Agar alamat IP tidak berubah-ubah, atur **IP statis** untuk komputer server di router.
- Untuk mengganti port, jalankan: `PORT=8080 npm start` (Windows PowerShell:
  `$env:PORT=8080; npm start`).

---

## 🚶 Kedatangan Pasien (Antrian Ruang Tunggu)

Tab **Kedatangan Pasien** (di dalam menu **📅 Janji & Kedatangan**) mengubah daftar
janji temu menjadi **antrian ruang tunggu** yang hidup — memisahkan *jadwal*
(kapan pasien dijanjikan datang) dari *kehadiran fisik* (siapa yang sudah ada di
klinik dan sedang menunggu giliran).

**Cara kerja:**

1. **Check-in dari janji temu** — di tab *Janji Temu*, setiap janji hari ini punya
   tombol **🚶 Check-in**. Sekali klik, pasien masuk antrian dan janjinya ditandai
   **✓ Datang**. Keluhan dari janji temu ikut terbawa otomatis.
2. **Pasien tanpa janji (walk-in)** — klik **+ Catat Kedatangan** untuk mendaftarkan
   pasien yang datang langsung tanpa janji. Baris antriannya diberi label
   **"Tanpa janji (walk-in)"**.
3. **Alur status satu klik** — setiap pasien berjalan melalui
   **Menunggu → Diperiksa → Selesai → Pulang**. Tombol aksi selalu menampilkan
   langkah berikutnya (▶ Periksa · ✓ Selesai · 🏠 Pulang), jadi memindahkan antrian
   cukup satu klik.
4. **Pelacakan waktu** — antrian menampilkan **nomor urut**, jam datang, *sudah
   berapa lama menunggu*, lama diperiksa, serta **total durasi** kunjungan setelah
   selesai — membantu memantau pasien yang menunggu terlalu lama.
5. **Ringkasan harian** — chip di atas tabel merangkum jumlah **Total · Menunggu ·
   Diperiksa · Selesai · Pulang** untuk tanggal yang dipilih.

> 🗓️ Data kedatangan bersifat **per hari** — pilih tanggal untuk melihat antrian
> hari lain. Semua tercatat lokal di `data/klinik.db`; **tidak ada data yang
> dikirim ke pihak ketiga.**

---

## 🤖 Asisten Kasus (AI) — Opsional

Menu **Asisten Kasus** adalah chatbot AI (ditenagai **Claude** dari Anthropic,
terinspirasi proyek [VetClaw](https://github.com/OpenVet-Projects/VetClaw)) untuk
membantu dokter hewan berdiskusi seputar kasus: **diagnosis banding, triase,
toksikologi, dan keamanan/dosis obat per-spesies**. Percakapan bisa **dikaitkan
dengan seekor pasien** sehingga asisten membaca konteks rekam medis & vaksinasinya.

> ⚕️ Jawaban AI bersifat **bantuan referensi**, bukan pengganti pemeriksaan &
> diagnosis dokter hewan berlisensi. Selalu verifikasi dosis dari sumber resmi.

Fitur ini **opsional** — seluruh modul klinik lain tetap berjalan penuh tanpanya.
Bila belum diaktifkan, menu tetap terbuka namun akan menampilkan pesan pengingat.

### Mengaktifkan

1. Dapatkan **API key** Anthropic di <https://console.anthropic.com>.
2. Di dalam folder `vetklinik`, salin `.env.example` menjadi `.env`:
   ```bash
   cp .env.example .env
   ```
3. Buka `.env`, isi kunci Anda:
   ```
   ANTHROPIC_API_KEY=sk-ant-xxxxxxxx
   ```
4. Jalankan ulang server (`npm start`). Menu **🤖 Asisten Kasus** kini aktif.

**Pilihan lain (tanpa `.env`)** — setel variabel lingkungan langsung:
- Windows PowerShell: `$env:ANTHROPIC_API_KEY="sk-ant-..."; npm start`
- Windows CMD: `set ANTHROPIC_API_KEY=sk-ant-...&& npm start`

### Pengaturan tambahan
- **Ganti model:** default `claude-opus-5`. Untuk lebih hemat/cepat, setel
  `ASISTEN_MODEL` di `.env`, mis. `ASISTEN_MODEL=claude-sonnet-5` atau
  `claude-haiku-4-5`.
- **Privasi:** fitur ini **mengirim teks pertanyaan** (dan konteks pasien bila
  dipilih) ke layanan Anthropic melalui internet, jadi hanya modul ini yang butuh
  koneksi internet. Kunci API disimpan di berkas `.env` pada komputer server —
  **jangan** membagikannya.

---

## 💬 Komunikasi (WhatsApp)

Menu **Komunikasi** membantu staf mengirim pesan ke pemilik hewan lewat
**WhatsApp** — dengan pendekatan **ringan tanpa biaya**: memakai tautan resmi
**klik-untuk-chat** WhatsApp (`wa.me`), **bukan** WhatsApp Business API berbayar.
Tidak perlu kunci API, tidak ada langganan, dan nomor tetap terkirim dari akun
WhatsApp klinik sendiri.

**Cara kerja:**

1. Pilih pemilik (dan hewannya), lalu pilih **template** pesan — mis. *Pengingat
   Vaksinasi*, *Konfirmasi Janji*, *Tagihan*, *Kontrol Ulang*, atau *Ucapan
   Terima Kasih*. Isi pesan terbuat otomatis memakai nama klinik & data pemilik,
   dan bisa disunting bebas sebelum dikirim.
2. Klik **💬 Buka WhatsApp** — WhatsApp (aplikasi/WhatsApp Web) terbuka dengan
   **nomor tujuan & teks pesan sudah terisi**. Staf tinggal menekan *kirim*.
3. Setiap kiriman **dicatat** ke riwayat sehingga terlihat siapa yang sudah
   dihubungi (bisa dikirim ulang atau dihapus).

**Pengingat otomatis:** modul ini menampilkan daftar **vaksinasi yang akan/telah
jatuh tempo** dan **tagihan yang belum lunas**, lengkap dengan tombol 💬 untuk
langsung menyiapkan pesan ke pemilik terkait — jadi menagih & mengingatkan cukup
satu klik.

> 📱 **Nomor telepon** otomatis dinormalkan ke format internasional (mis.
> `0812-3456-7890` → `62812…`). Pastikan nomor pemilik terisi di data **Pemilik**.
> Fitur ini butuh WhatsApp terpasang di perangkat (atau WhatsApp Web di browser);
> selain membuka WhatsApp, **tidak ada data yang dikirim ke pihak ketiga.**

---

## 💾 Data & Cadangan (Backup)

- Semua data tersimpan dalam satu berkas: **`data/klinik.db`**.
- **Backup** cukup dengan menyalin folder `data/` ke tempat aman secara berkala.
- **Restore** cukup dengan mengembalikan berkas `data/klinik.db`.

### Mengosongkan / Reset Data
Untuk menghapus semua data dan memulai dari data contoh yang bersih:

1. Hentikan server (tekan `Ctrl + C` di terminal).
2. Hapus berkas di dalam folder `data/`:
   ```bash
   rm -f data/klinik.db data/klinik.db-shm data/klinik.db-wal
   ```
3. Jalankan lagi `npm start` — data contoh akan dibuat ulang otomatis.

> ⚠️ Reset menghapus **seluruh** data. Pastikan sudah backup bila perlu.

---

## 🛠️ Teknologi

- **Backend:** Node.js + [Express](https://expressjs.com) + [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
- **Database:** SQLite (berkas tunggal, mode WAL, dengan *foreign keys*)
- **Frontend:** JavaScript murni (ES Modules) — **tanpa proses build**, tanpa framework berat
- **Asisten AI (opsional):** [Claude](https://www.anthropic.com) via `@anthropic-ai/sdk`
- **Berjalan lokal** setelah `npm install`; hanya modul **Asisten Kasus** yang butuh internet

### Struktur Folder
```
vetklinik/
├── server.js          # Server Express + REST API
├── db.js              # Inisialisasi SQLite, skema, data contoh
├── helpers.js         # Validasi & util backend
├── routes/            # Endpoint API per modul
├── public/            # Frontend (HTML/CSS/JS)
│   ├── index.html
│   ├── css/style.css
│   └── js/            # app.js, util.js, views/
└── data/              # Database SQLite (dibuat otomatis)
```

---

## ❓ Masalah Umum

| Masalah | Solusi |
|---------|--------|
| `node: command not found` | Node.js belum terpasang. Pasang dari [nodejs.org](https://nodejs.org). |
| Port 3000 sudah dipakai | Jalankan dengan port lain: `PORT=8080 npm start`. |
| Komputer lain tidak bisa akses | Cek koneksi jaringan yang sama & izin Windows Firewall untuk Node.js. |
| Asisten Kasus menampilkan "belum dikonfigurasi" | Isi `ANTHROPIC_API_KEY` di berkas `.env`, lalu jalankan ulang server. Lihat bagian **Asisten Kasus (AI)**. |
| Tombol WhatsApp tidak membuka aplikasi | Pastikan WhatsApp terpasang, atau login ke [WhatsApp Web](https://web.whatsapp.com) di browser. Pastikan juga nomor pemilik sudah terisi di menu **Pemilik**. |
| Ingin data kosong dari awal | Lihat bagian **Reset Data** di atas. |

---

_Dibuat untuk membantu klinik hewan Indonesia mengelola pasien, rekam medis,
vaksinasi, dan tagihan dengan mudah. 🐾_
