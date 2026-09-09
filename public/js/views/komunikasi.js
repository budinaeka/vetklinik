// views/komunikasi.js — Komunikasi WhatsApp (OpenVPM "communications" versi ringan).
// Kirim pengingat & pesan ke pemilik lewat WhatsApp klik-untuk-chat (wa.me):
// tanpa API key, tanpa biaya, tetap ramah-offline. Pilih penerima + template →
// WhatsApp terbuka dengan nomor & teks siap kirim → pesan dicatat ke riwayat.
import {
  api, store, esc, spesiesEmoji, rupiah, tanggal, tanggalWaktu,
  selisihHari, statusBadge, nomorWa, waLink, toast, confirmDialog,
} from '../util.js';

// ---------------------------------------------------------------------------
// Template pesan (Bahasa Indonesia). Placeholder diisi dari data klinik/pasien.
// ---------------------------------------------------------------------------
const klinikNama = () => (store.settings && store.settings.clinic_name) || 'klinik hewan';
const klinikTelp = () => (store.settings && store.settings.clinic_phone) || '';

const sapa = (pemilik) => (pemilik ? `Halo Kak ${pemilik},` : 'Halo,');
const ttd = () => {
  const t = klinikTelp();
  return `\n\nSalam,\n${klinikNama()}${t ? `\n${t}` : ''}`;
};

const TEMPLATES = [
  {
    key: 'umum',
    label: '📝 Pesan Umum',
    build: ({ pemilik }) => `${sapa(pemilik)} `,
  },
  {
    key: 'vaksin',
    label: '💉 Pengingat Vaksinasi',
    build: ({ pemilik, pasien, vaksin, tgl }) =>
      `${sapa(pemilik)} kami dari ${klinikNama()} ingin mengingatkan jadwal vaksinasi ${vaksin || 'ulang'} untuk ${pasien || 'hewan kesayangan Anda'}${tgl ? ` yang jatuh tempo pada ${tgl}` : ''}. Mohon konfirmasi untuk jadwal kunjungannya ya 🐾${ttd()}`,
  },
  {
    key: 'janji',
    label: '📅 Pengingat Janji Temu',
    build: ({ pemilik, pasien, tgl, waktu }) =>
      `${sapa(pemilik)} ini pengingat janji temu${pasien ? ` untuk ${pasien}` : ''} di ${klinikNama()}${tgl ? ` pada ${tgl}` : ''}${waktu ? ` pukul ${waktu}` : ''}. Sampai jumpa! 🐾${ttd()}`,
  },
  {
    key: 'bayar',
    label: '🧾 Pengingat Pembayaran',
    build: ({ pemilik, pasien, no, jumlah }) =>
      `${sapa(pemilik)} kami informasikan tagihan${no ? ` ${no}` : ''}${pasien ? ` untuk ${pasien}` : ''}${jumlah ? ` sebesar ${jumlah}` : ''} masih tercatat belum lunas. Mohon dapat diselesaikan, terima kasih 🙏${ttd()}`,
  },
  {
    key: 'kontrol',
    label: '🩺 Kontrol / Follow-up',
    build: ({ pemilik, pasien }) =>
      `${sapa(pemilik)} bagaimana kondisi ${pasien || 'hewan kesayangan Anda'} setelah kunjungan terakhir? Bila masih ada keluhan atau perlu kontrol lanjutan, jangan ragu menghubungi kami. Semoga lekas sehat 🐾${ttd()}`,
  },
  {
    key: 'terimakasih',
    label: '💚 Ucapan Terima Kasih',
    build: ({ pemilik, pasien }) =>
      `${sapa(pemilik)} terima kasih telah mempercayakan perawatan ${pasien || 'hewan kesayangan Anda'} kepada ${klinikNama()}. Sehat selalu untuk mereka 🐾${ttd()}`,
  },
];
const TPL = Object.fromEntries(TEMPLATES.map((t) => [t.key, t]));
const catLabel = (key) => (TPL[key] ? TPL[key].label : '📝 Pesan');

// Badge tenggat vaksinasi.
function dueBadge(iso) {
  const d = selisihHari(iso);
  if (d == null) return '';
  if (d < 0) return `<span class="badge badge-danger">Terlambat ${Math.abs(d)} hr</span>`;
  if (d === 0) return `<span class="badge badge-wait">Hari ini</span>`;
  return `<span class="badge badge-wait">${d} hr lagi</span>`;
}

export default async function komunikasi(view) {
  const [owners, patients, suggest, history] = await Promise.all([
    api.get('/api/owners').catch(() => []),
    api.get('/api/patients').catch(() => []),
    api.get('/api/komunikasi/suggestions').catch(() => ({ vaccinations: [], invoices: [] })),
    api.get('/api/komunikasi').catch(() => []),
  ]);

  let hist = history;

  view.innerHTML = `
    <div class="page-head">
      <h2>💬 Komunikasi WhatsApp</h2>
      <span class="sub">Kirim pengingat & pesan ke pemilik lewat WhatsApp</span>
    </div>

    <div class="alert alert-warn" style="background:var(--info-bg);color:var(--info);border-color:#bfdbfe">
      ℹ️ Pesan dikirim lewat <b>WhatsApp Anda sendiri</b> (klik-untuk-chat). Menekan <b>Buka WhatsApp</b> membuka aplikasi WhatsApp dengan nomor &amp; teks yang sudah terisi — Anda tinggal menekan tombol kirim. Tanpa biaya &amp; tanpa kunci API.
    </div>

    <div class="grid cols-2" style="align-items:start">
      <div class="card" id="compose">
        <div class="card-head">✍️ Susun Pesan</div>
        <div class="card-pad">
          <div class="form-row">
            <div class="field" style="margin-bottom:0">
              <label>Pemilik (penerima)</label>
              <select id="c-owner" class="input">
                <option value="">— Pilih pemilik —</option>
                ${owners
                  .map((o) => `<option value="${o.id}">${esc(o.name)}${o.phone ? ' · ' + esc(o.phone) : ''}</option>`)
                  .join('')}
              </select>
            </div>
            <div class="field" style="margin-bottom:0">
              <label>Pasien (opsional)</label>
              <select id="c-patient" class="input"><option value="">— Tanpa pasien —</option></select>
            </div>
          </div>
          <div class="field" style="margin-top:14px">
            <label>Jenis pesan / template</label>
            <select id="c-cat" class="input">
              ${TEMPLATES.map((t) => `<option value="${t.key}">${esc(t.label)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>Nomor WhatsApp</label>
            <input id="c-phone" class="input" placeholder="mis. 0812-3456-7890" />
            <div class="hint" id="c-phone-hint"></div>
          </div>
          <div class="field">
            <label>Pesan</label>
            <textarea id="c-msg" rows="7" placeholder="Tulis pesan…"></textarea>
          </div>
          <div class="btn-row">
            <button class="btn btn-wa" id="c-send">💬 Buka WhatsApp</button>
            <button class="btn btn-ghost" id="c-copy">📋 Salin</button>
            <button class="btn btn-ghost" id="c-reset">Bersihkan</button>
          </div>
        </div>
      </div>

      <div class="stack" style="gap:16px">
        <div class="card">
          <div class="card-head">💉 Pengingat Vaksinasi<span class="spacer"></span><span class="badge badge-muted">${suggest.vaccinations.length}</span></div>
          <div id="sug-vacc"></div>
        </div>
        <div class="card">
          <div class="card-head">🧾 Tagihan Belum Lunas<span class="spacer"></span><span class="badge badge-muted">${suggest.invoices.length}</span></div>
          <div id="sug-inv"></div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-top:16px">
      <div class="card-head">🕘 Riwayat Komunikasi<span class="spacer"></span><button class="btn btn-ghost btn-sm" id="h-refresh">↻ Muat ulang</button></div>
      <div id="hist"></div>
    </div>`;

  const ownerEl = view.querySelector('#c-owner');
  const patientEl = view.querySelector('#c-patient');
  const catEl = view.querySelector('#c-cat');
  const phoneEl = view.querySelector('#c-phone');
  const phoneHint = view.querySelector('#c-phone-hint');
  const msgEl = view.querySelector('#c-msg');

  const ownerById = (id) => owners.find((o) => String(o.id) === String(id));
  const patientById = (id) => patients.find((p) => String(p.id) === String(id));

  function ctx() {
    const o = ownerById(ownerEl.value);
    const p = patientById(patientEl.value);
    return { pemilik: o ? o.name : '', pasien: p ? p.name : '' };
  }

  function renderPatientOptions(ownerId, selected = '') {
    const list = ownerId ? patients.filter((p) => String(p.owner_id) === String(ownerId)) : patients;
    patientEl.innerHTML =
      '<option value="">— Tanpa pasien —</option>' +
      list
        .map(
          (p) =>
            `<option value="${p.id}">${esc(p.name)} — ${esc(p.species || 'Hewan')}${
              !ownerId && p.owner_name ? ' (' + esc(p.owner_name) + ')' : ''
            }</option>`
        )
        .join('');
    patientEl.value = selected || '';
  }

  function updatePhoneHint() {
    const raw = phoneEl.value.trim();
    const num = nomorWa(raw);
    phoneHint.textContent = raw
      ? num
        ? `Akan menghubungi: +${num}`
        : 'Nomor tidak dikenali.'
      : 'Kosong — WhatsApp akan meminta Anda memilih kontak.';
  }

  // Terapkan template ke textarea berdasarkan konteks terkini.
  function applyTemplate(extra = {}) {
    const t = TPL[catEl.value] || TPL.umum;
    msgEl.value = t.build({ ...ctx(), ...extra });
  }

  // ---------------------- Saran pesan (pengingat) ----------------------
  function renderSuggestions() {
    const vEl = view.querySelector('#sug-vacc');
    if (!suggest.vaccinations.length) {
      vEl.innerHTML = `<div class="empty" style="padding:22px"><span class="big">✅</span>Tidak ada vaksinasi jatuh tempo.</div>`;
    } else {
      vEl.innerHTML = `<div class="comm-list">${suggest.vaccinations
        .map(
          (v, i) => `<div class="comm-row">
            <div class="comm-main">
              <div class="t-strong">${spesiesEmoji(v.patient_species)} ${esc(v.patient_name)} <span class="badge badge-teal">${esc(v.vaccine_name)}</span></div>
              <div class="t-muted">${esc(v.owner_name)}${v.owner_phone ? ' · ' + esc(v.owner_phone) : ' · (tanpa nomor)'} · ${tanggal(v.next_due_date)} ${dueBadge(v.next_due_date)}</div>
            </div>
            <button class="btn btn-wa btn-sm" data-vacc="${i}" title="Susun pesan WhatsApp">💬</button>
          </div>`
        )
        .join('')}</div>`;
    }

    const iEl = view.querySelector('#sug-inv');
    if (!suggest.invoices.length) {
      iEl.innerHTML = `<div class="empty" style="padding:22px"><span class="big">✅</span>Semua tagihan sudah lunas.</div>`;
    } else {
      iEl.innerHTML = `<div class="comm-list">${suggest.invoices
        .map((inv, i) => {
          const sisa = (inv.total || 0) - (inv.paid || 0);
          return `<div class="comm-row">
            <div class="comm-main">
              <div class="t-strong">${esc(inv.invoice_no || 'Tagihan')} · ${rupiah(sisa)}</div>
              <div class="t-muted">${esc(inv.owner_name || '-')}${inv.owner_phone ? ' · ' + esc(inv.owner_phone) : ' · (tanpa nomor)'}${inv.patient_name ? ' · ' + esc(inv.patient_name) : ''} · ${statusBadge(inv.status)}</div>
            </div>
            <button class="btn btn-wa btn-sm" data-inv="${i}" title="Susun pesan WhatsApp">💬</button>
          </div>`;
        })
        .join('')}</div>`;
    }

    vEl.querySelectorAll('[data-vacc]').forEach((b) =>
      b.addEventListener('click', () => fillFromVacc(suggest.vaccinations[+b.dataset.vacc]))
    );
    iEl.querySelectorAll('[data-inv]').forEach((b) =>
      b.addEventListener('click', () => fillFromInvoice(suggest.invoices[+b.dataset.inv]))
    );
  }

  function fillForm({ owner_id, patient_id, category, phone, message }) {
    ownerEl.value = owner_id ? String(owner_id) : '';
    renderPatientOptions(ownerEl.value, patient_id ? String(patient_id) : '');
    catEl.value = category || 'umum';
    phoneEl.value = phone || '';
    msgEl.value = message || '';
    updatePhoneHint();
    document.getElementById('compose').scrollIntoView({ behavior: 'smooth', block: 'start' });
    msgEl.focus();
  }

  function fillFromVacc(v) {
    const message = TPL.vaksin.build({
      pemilik: v.owner_name,
      pasien: v.patient_name,
      vaksin: v.vaccine_name,
      tgl: tanggal(v.next_due_date),
    });
    fillForm({ owner_id: v.owner_id, patient_id: v.patient_id, category: 'vaksin', phone: v.owner_phone, message });
  }

  function fillFromInvoice(inv) {
    const sisa = (inv.total || 0) - (inv.paid || 0);
    const message = TPL.bayar.build({
      pemilik: inv.owner_name,
      pasien: inv.patient_name,
      no: inv.invoice_no,
      jumlah: rupiah(sisa),
    });
    fillForm({ owner_id: inv.owner_id, patient_id: inv.patient_id, category: 'bayar', phone: inv.owner_phone, message });
  }

  // ---------------------- Riwayat ----------------------
  function renderHistory() {
    const el = view.querySelector('#hist');
    if (!hist.length) {
      el.innerHTML = `<div class="empty" style="padding:30px"><span class="big">💬</span>Belum ada pesan terkirim.</div>`;
      return;
    }
    el.innerHTML = `<div class="table-wrap"><table class="tbl">
      <thead><tr><th>Waktu</th><th>Penerima</th><th>Jenis</th><th>Pesan</th><th></th><th></th></tr></thead>
      <tbody>${hist
        .map((c) => {
          const full = (c.message || '').replace(/\s+/g, ' ').trim();
          const snippet = full.slice(0, 90);
          return `<tr>
            <td class="t-muted" style="white-space:nowrap">${tanggalWaktu(c.created_at)}</td>
            <td><div class="t-strong">${esc(c.owner_name || '—')}</div><div class="t-muted">${esc(c.phone || '')}${c.patient_name ? ' · ' + esc(c.patient_name) : ''}</div></td>
            <td><span class="badge badge-teal">${esc(catLabel(c.category))}</span></td>
            <td class="t-muted" style="max-width:340px">${esc(snippet)}${full.length > 90 ? '…' : ''}</td>
            <td><button class="btn-icon" data-resend="${c.id}" title="Buka lagi di WhatsApp">💬</button></td>
            <td class="num"><button class="btn-icon" data-del="${c.id}" title="Hapus catatan">🗑️</button></td>
          </tr>`;
        })
        .join('')}</tbody></table></div>`;

    el.querySelectorAll('[data-resend]').forEach((b) =>
      b.addEventListener('click', () => {
        const c = hist.find((x) => String(x.id) === b.dataset.resend);
        if (c) window.open(waLink(c.phone, c.message), '_blank');
      })
    );
    el.querySelectorAll('[data-del]').forEach((b) =>
      b.addEventListener('click', async () => {
        if (await confirmDialog('Hapus catatan komunikasi ini?')) {
          await api.del('/api/komunikasi/' + b.dataset.del);
          hist = hist.filter((x) => String(x.id) !== b.dataset.del);
          renderHistory();
          toast('Catatan dihapus.');
        }
      })
    );
  }

  async function reloadHistory() {
    hist = await api.get('/api/komunikasi').catch(() => hist);
    renderHistory();
  }

  // ---------------------- Aksi penyusun ----------------------
  async function bukaWhatsApp() {
    const message = msgEl.value.trim();
    if (!message) {
      toast('Tulis pesan terlebih dahulu.', 'error');
      msgEl.focus();
      return;
    }
    // Buka WhatsApp (klik-untuk-chat) — sinkron di dalam handler klik.
    window.open(waLink(phoneEl.value, message), '_blank');
    // Catat ke riwayat.
    try {
      const saved = await api.post('/api/komunikasi', {
        owner_id: ownerEl.value ? Number(ownerEl.value) : null,
        patient_id: patientEl.value ? Number(patientEl.value) : null,
        category: catEl.value,
        phone: phoneEl.value,
        message,
      });
      hist.unshift(saved);
      renderHistory();
      toast('WhatsApp dibuka & pesan dicatat.');
    } catch (err) {
      toast(err.message || 'Gagal mencatat pesan.', 'error');
    }
  }

  // ---------------------- Wiring ----------------------
  ownerEl.addEventListener('change', () => {
    const o = ownerById(ownerEl.value);
    renderPatientOptions(ownerEl.value, '');
    if (o && o.phone) phoneEl.value = o.phone;
    updatePhoneHint();
    applyTemplate();
  });
  patientEl.addEventListener('change', () => {
    // Bila pemilik belum dipilih, ambil dari pasien.
    if (patientEl.value && !ownerEl.value) {
      const p = patientById(patientEl.value);
      if (p) {
        ownerEl.value = String(p.owner_id);
        if (p.owner_phone) phoneEl.value = p.owner_phone;
        updatePhoneHint();
      }
    }
    applyTemplate();
  });
  catEl.addEventListener('change', () => applyTemplate());
  phoneEl.addEventListener('input', updatePhoneHint);

  view.querySelector('#c-send').addEventListener('click', bukaWhatsApp);
  view.querySelector('#c-copy').addEventListener('click', async () => {
    const message = msgEl.value.trim();
    if (!message) return;
    try {
      await navigator.clipboard.writeText(message);
      toast('Pesan disalin.');
    } catch {
      toast('Tidak bisa menyalin otomatis — salin manual.', 'error');
    }
  });
  view.querySelector('#c-reset').addEventListener('click', () => {
    ownerEl.value = '';
    renderPatientOptions('', '');
    catEl.value = 'umum';
    phoneEl.value = '';
    updatePhoneHint();
    applyTemplate();
  });
  view.querySelector('#h-refresh').addEventListener('click', reloadHistory);

  // ---------------------- Inisialisasi ----------------------
  renderPatientOptions('', '');
  applyTemplate();
  updatePhoneHint();
  renderSuggestions();
  renderHistory();
}
