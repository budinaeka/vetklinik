// views/patients.js — Pasien: daftar & profil lengkap (tab rekam medis, vaksinasi, janji, tagihan).
import {
  api, esc, spesiesEmoji, rupiah, tanggal, tanggalWaktu, umur, selisihHari,
  statusBadge, confirmDialog, toast,
} from '../util.js';
import { patientForm, recordForm, vaccineForm, appointmentForm } from './forms.js';
import { openInvoiceEditor } from './invoices.js';

// ---------------------------------------------------------------------------
// Daftar pasien
// ---------------------------------------------------------------------------
export async function list(view) {
  const state = { q: '' };

  view.innerHTML = `
    <div class="page-head"><h2>Pasien</h2><span class="spacer"></span>
      <button class="btn btn-primary" id="btn-add">+ Tambah Pasien</button></div>
    <div class="toolbar"><div class="search"><input class="input" id="f-q" placeholder="Cari nama hewan / spesies / ras / pemilik..." /></div></div>
    <div class="card"><div class="table-wrap"><table class="tbl">
      <thead><tr><th>Nama</th><th>Spesies / Ras</th><th>Pemilik</th><th>Umur</th><th class="num">Berat</th><th></th></tr></thead>
      <tbody id="body"></tbody>
    </table></div></div>`;

  const body = view.querySelector('#body');

  async function load() {
    body.innerHTML = `<tr><td colspan="6" class="t-muted" style="text-align:center;padding:20px">Memuat…</td></tr>`;
    const data = await api.get('/api/patients' + (state.q ? `?q=${encodeURIComponent(state.q)}` : ''));
    if (!data.length) {
      body.innerHTML = `<tr><td colspan="6" class="t-muted" style="text-align:center;padding:26px">Belum ada pasien.</td></tr>`;
      return;
    }
    body.innerHTML = data
      .map(
        (p) => `<tr class="row-link" data-open="${p.id}">
          <td class="t-strong">${spesiesEmoji(p.species)} ${esc(p.name)}</td>
          <td>${esc(p.species || '-')}${p.breed ? `<div class="t-muted">${esc(p.breed)}</div>` : ''}</td>
          <td>${esc(p.owner_name)}<div class="t-muted">${esc(p.owner_phone || '')}</div></td>
          <td>${umur(p.birth_date) || '-'}</td>
          <td class="num">${p.weight ? p.weight + ' kg' : '-'}</td>
          <td class="num"><button class="btn-icon" data-edit="${p.id}" title="Edit">✏️</button><button class="btn-icon" data-del="${p.id}" title="Hapus">🗑️</button></td>
        </tr>`
      )
      .join('');
    body.querySelectorAll('[data-open]').forEach((tr) =>
      tr.addEventListener('click', (e) => {
        if (e.target.closest('[data-edit],[data-del]')) return;
        location.hash = '#/patients/' + tr.dataset.open;
      })
    );
    body.querySelectorAll('[data-edit]').forEach((b) =>
      b.addEventListener('click', () => patientForm(data.find((x) => x.id == b.dataset.edit), load))
    );
    body.querySelectorAll('[data-del]').forEach((b) =>
      b.addEventListener('click', async () => {
        const p = data.find((x) => x.id == b.dataset.del);
        if (await confirmDialog(`Hapus pasien "${p.name}"? Rekam medis, vaksinasi, dan janji temunya ikut terhapus.`)) {
          await api.del('/api/patients/' + p.id);
          toast('Pasien dihapus.');
          load();
        }
      })
    );
  }

  view.querySelector('#btn-add').addEventListener('click', () => patientForm(null, load));
  let t;
  view.querySelector('#f-q').addEventListener('input', (e) => {
    clearTimeout(t);
    state.q = e.target.value.trim();
    t = setTimeout(load, 250);
  });

  await load();
}

// ---------------------------------------------------------------------------
// Profil pasien (detail)
// ---------------------------------------------------------------------------
function pill(label, value) {
  return value ? `<span class="pill">${label}: <b>${esc(value)}</b></span>` : '';
}

function dueBadge(iso) {
  const d = selisihHari(iso);
  if (d == null) return '';
  if (d < 0) return `<span class="badge badge-danger">Terlambat ${Math.abs(d)} hr</span>`;
  if (d === 0) return `<span class="badge badge-wait">Hari ini</span>`;
  if (d <= 30) return `<span class="badge badge-wait">${d} hari lagi</span>`;
  return `<span class="badge badge-muted">${d} hari lagi</span>`;
}

function soapLine(label, text) {
  return text ? `<div><b>${label}</b> ${esc(text)}</div>` : '';
}

function soapAll(r) {
  const lines = [
    soapLine('S — Anamnesa:', r.subjective),
    soapLine('O — Pemeriksaan:', r.objective),
    soapLine('A — Diagnosis:', r.assessment),
    soapLine('P — Terapi:', r.plan),
  ].join('');
  return lines ? `<div class="soap">${lines}</div>` : `<div class="soap"><div class="t-muted">Tidak ada catatan SOAP.</div></div>`;
}

export async function detail(view, id) {
  let p;

  async function reload() {
    p = await api.get('/api/patients/' + id);
    render();
  }

  const state = { tab: 'rekam' };
  const meta = { patientId: Number(id), patientName: '', ownerId: null };

  function render() {
    meta.patientName = p.name;
    meta.ownerId = p.owner_id;

    const info = [
      pill('Kelamin', p.sex),
      pill('Umur', umur(p.birth_date)),
      pill('Berat', p.weight ? p.weight + ' kg' : ''),
      pill('Warna', p.color),
      p.sterilized ? `<span class="pill">✓ Steril</span>` : '',
      pill('Microchip', p.microchip),
    ].join('');

    view.innerHTML = `
      <div class="back-link" onclick="location.hash='#/patients'">← Kembali ke daftar pasien</div>
      <div class="card card-pad" style="margin-bottom:16px">
        <div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap">
          <div class="avatar">${spesiesEmoji(p.species)}</div>
          <div style="flex:1;min-width:220px">
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
              <h2 style="margin:0">${esc(p.name)}</h2>
              <span class="t-muted">${esc(p.species || '')}${p.breed ? ' · ' + esc(p.breed) : ''}</span>
            </div>
            <div class="pill-row" style="margin-top:8px">${info}</div>
          </div>
          <div style="text-align:right">
            <div class="t-muted">Pemilik</div>
            <div class="t-strong"><a href="#/owners">${esc(p.owner_name)}</a></div>
            <div class="t-muted">${esc(p.owner_phone || '')}</div>
            <button class="btn btn-ghost btn-sm" id="edit-patient" style="margin-top:8px">✏️ Edit Pasien</button>
          </div>
        </div>
        ${p.allergies ? `<div class="alert alert-danger" style="margin-top:14px">⚠️ <b>Alergi:</b> ${esc(p.allergies)}</div>` : ''}
        ${p.notes ? `<div class="t-muted" style="margin-top:10px">📝 ${esc(p.notes)}</div>` : ''}
      </div>

      <div class="tabs" id="tabs">
        <button data-tab="rekam" class="${state.tab === 'rekam' ? 'active' : ''}">Rekam Medis <span class="pill">${p.records.length}</span></button>
        <button data-tab="vaksin" class="${state.tab === 'vaksin' ? 'active' : ''}">Vaksinasi <span class="pill">${p.vaccinations.length}</span></button>
        <button data-tab="janji" class="${state.tab === 'janji' ? 'active' : ''}">Janji Temu <span class="pill">${p.appointments.length}</span></button>
        <button data-tab="tagihan" class="${state.tab === 'tagihan' ? 'active' : ''}">Tagihan <span class="pill">${p.invoices.length}</span></button>
      </div>
      <div id="tab-body"></div>`;

    view.querySelector('#edit-patient').addEventListener('click', () => patientForm(p, reload));
    view.querySelectorAll('#tabs button').forEach((b) =>
      b.addEventListener('click', () => {
        state.tab = b.dataset.tab;
        view.querySelectorAll('#tabs button').forEach((x) => x.classList.toggle('active', x === b));
        renderTab();
      })
    );
    renderTab();
  }

  function renderTab() {
    const el = view.querySelector('#tab-body');
    if (state.tab === 'rekam') renderRekam(el);
    else if (state.tab === 'vaksin') renderVaksin(el);
    else if (state.tab === 'janji') renderJanji(el);
    else renderTagihan(el);
  }

  // ---- Rekam Medis ----
  function renderRekam(el) {
    const head = `<div class="card-head" style="border:none;padding:0 0 12px"><span class="t-strong">Riwayat Pemeriksaan (SOAP)</span><span class="spacer"></span>
      <button class="btn btn-primary btn-sm" id="add-rekam">+ Rekam Medis</button></div>`;
    if (!p.records.length) {
      el.innerHTML = head + `<div class="card"><div class="empty"><span class="big">📋</span>Belum ada rekam medis.</div></div>`;
    } else {
      el.innerHTML =
        head +
        `<div class="timeline">${p.records
          .map(
            (r) => `<div class="tl-item">
              <div class="tl-head">
                <span class="t-strong">${tanggal(r.visit_date)}</span>
                ${r.weight ? `<span class="pill">${r.weight} kg</span>` : ''}
                ${r.temperature ? `<span class="pill">${r.temperature}°C</span>` : ''}
                <span class="spacer"></span>
                <span class="t-muted">${esc(r.vet_name || '')}</span>
                <button class="btn-icon" data-edit="${r.id}" title="Edit">✏️</button>
                <button class="btn-icon" data-del="${r.id}" title="Hapus">🗑️</button>
              </div>
              ${soapAll(r)}
            </div>`
          )
          .join('')}</div>`;
    }
    el.querySelector('#add-rekam').addEventListener('click', () => recordForm(null, reload, meta));
    el.querySelectorAll('[data-edit]').forEach((b) =>
      b.addEventListener('click', () => recordForm(p.records.find((x) => x.id == b.dataset.edit), reload, meta))
    );
    el.querySelectorAll('[data-del]').forEach((b) =>
      b.addEventListener('click', async () => {
        if (await confirmDialog('Hapus rekam medis ini?')) {
          await api.del('/api/records/' + b.dataset.del);
          toast('Rekam medis dihapus.');
          reload();
        }
      })
    );
  }

  // ---- Vaksinasi ----
  function renderVaksin(el) {
    const head = `<div class="card-head" style="border:none;padding:0 0 12px"><span class="t-strong">Riwayat Vaksinasi</span><span class="spacer"></span>
      <button class="btn btn-primary btn-sm" id="add-vaksin">+ Catat Vaksinasi</button></div>`;
    if (!p.vaccinations.length) {
      el.innerHTML = head + `<div class="card"><div class="empty"><span class="big">💉</span>Belum ada data vaksinasi.</div></div>`;
    } else {
      el.innerHTML =
        head +
        `<div class="card"><div class="table-wrap"><table class="tbl">
          <thead><tr><th>Vaksin</th><th>Diberikan</th><th>Jadwal Berikutnya</th><th></th><th>Batch</th><th></th></tr></thead>
          <tbody>${p.vaccinations
            .map(
              (v) => `<tr>
                <td><span class="badge badge-teal">${esc(v.vaccine_name)}</span></td>
                <td>${tanggal(v.given_date)}</td>
                <td class="t-strong">${v.next_due_date ? tanggal(v.next_due_date) : '-'}</td>
                <td>${dueBadge(v.next_due_date)}</td>
                <td class="t-muted">${esc(v.batch_no || '-')}</td>
                <td class="num"><button class="btn-icon" data-edit="${v.id}" title="Edit">✏️</button><button class="btn-icon" data-del="${v.id}" title="Hapus">🗑️</button></td>
              </tr>`
            )
            .join('')}</tbody></table></div></div>`;
    }
    el.querySelector('#add-vaksin').addEventListener('click', () => vaccineForm(null, reload, meta));
    el.querySelectorAll('[data-edit]').forEach((b) =>
      b.addEventListener('click', () => vaccineForm(p.vaccinations.find((x) => x.id == b.dataset.edit), reload, meta))
    );
    el.querySelectorAll('[data-del]').forEach((b) =>
      b.addEventListener('click', async () => {
        if (await confirmDialog('Hapus data vaksinasi ini?')) {
          await api.del('/api/vaccinations/' + b.dataset.del);
          toast('Data vaksinasi dihapus.');
          reload();
        }
      })
    );
  }

  // ---- Janji Temu ----
  function renderJanji(el) {
    const head = `<div class="card-head" style="border:none;padding:0 0 12px"><span class="t-strong">Janji Temu</span><span class="spacer"></span>
      <button class="btn btn-primary btn-sm" id="add-janji">+ Buat Janji Temu</button></div>`;
    if (!p.appointments.length) {
      el.innerHTML = head + `<div class="card"><div class="empty"><span class="big">📅</span>Belum ada janji temu.</div></div>`;
    } else {
      el.innerHTML =
        head +
        `<div class="card"><div class="table-wrap"><table class="tbl">
          <thead><tr><th>Waktu</th><th>Jenis</th><th>Keluhan</th><th>Status</th><th></th></tr></thead>
          <tbody>${p.appointments
            .map(
              (a) => `<tr>
                <td class="t-strong">${tanggalWaktu(a.scheduled_at)}</td>
                <td>${esc(a.type || '-')}</td>
                <td class="t-muted">${esc(a.reason || '-')}</td>
                <td>${statusBadge(a.status)}</td>
                <td class="num"><button class="btn-icon" data-edit="${a.id}" title="Edit">✏️</button><button class="btn-icon" data-del="${a.id}" title="Hapus">🗑️</button></td>
              </tr>`
            )
            .join('')}</tbody></table></div></div>`;
    }
    el.querySelector('#add-janji').addEventListener('click', () => appointmentForm(null, reload, { patientId: meta.patientId }));
    el.querySelectorAll('[data-edit]').forEach((b) =>
      b.addEventListener('click', () => appointmentForm(p.appointments.find((x) => x.id == b.dataset.edit), reload, { patientId: meta.patientId }))
    );
    el.querySelectorAll('[data-del]').forEach((b) =>
      b.addEventListener('click', async () => {
        if (await confirmDialog('Hapus janji temu ini?')) {
          await api.del('/api/appointments/' + b.dataset.del);
          toast('Janji temu dihapus.');
          reload();
        }
      })
    );
  }

  // ---- Tagihan ----
  function renderTagihan(el) {
    const head = `<div class="card-head" style="border:none;padding:0 0 12px"><span class="t-strong">Tagihan</span><span class="spacer"></span>
      <button class="btn btn-primary btn-sm" id="add-tagihan">+ Buat Tagihan</button></div>`;
    if (!p.invoices.length) {
      el.innerHTML = head + `<div class="card"><div class="empty"><span class="big">🧾</span>Belum ada tagihan.</div></div>`;
    } else {
      el.innerHTML =
        head +
        `<div class="card"><div class="table-wrap"><table class="tbl">
          <thead><tr><th>No.</th><th>Tanggal</th><th class="num">Total</th><th class="num">Dibayar</th><th>Status</th></tr></thead>
          <tbody>${p.invoices
            .map(
              (i) => `<tr class="row-link" data-open="${i.id}">
                <td class="t-strong">${esc(i.invoice_no || '-')}</td>
                <td>${tanggal(i.invoice_date)}</td>
                <td class="num">${rupiah(i.total)}</td>
                <td class="num">${rupiah(i.paid)}</td>
                <td>${statusBadge(i.status)}</td>
              </tr>`
            )
            .join('')}</tbody></table></div></div>`;
      el.querySelectorAll('[data-open]').forEach((tr) =>
        tr.addEventListener('click', () => (location.hash = '#/invoices/' + tr.dataset.open))
      );
    }
    el.querySelector('#add-tagihan').addEventListener('click', () =>
      openInvoiceEditor(null, reload, { patientId: meta.patientId, ownerId: meta.ownerId })
    );
  }

  view.innerHTML = `<div class="loading">Memuat…</div>`;
  await reload();
}
