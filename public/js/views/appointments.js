// views/appointments.js — Janji Temu & Kedatangan Pasien (dua tab).
import {
  api, esc, jam, tanggal, tanggalPanjang, hariIniISO, statusBadge, spesiesEmoji,
  confirmDialog, toast, selisihMenit, durasiSingkat,
} from '../util.js';
import { appointmentForm, arrivalForm } from './forms.js';

const APPT_STATUS = ['Menunggu', 'Diperiksa', 'Selesai', 'Batal'];
const ARR_STATUS = ['Menunggu', 'Diperiksa', 'Selesai', 'Pulang'];

// Urutan lanjut antrian + label tombol untuk status berikutnya.
const NEXT = { Menunggu: 'Diperiksa', Diperiksa: 'Selesai', Selesai: 'Pulang' };
const NEXT_LABEL = { Diperiksa: '▶ Periksa', Selesai: '✓ Selesai', Pulang: '🏠 Pulang' };

export default async function appointments(view) {
  const state = { tab: 'janji', date: hariIniISO(), apptStatus: '', arrStatus: '', q: '' };

  view.innerHTML = `
    <div class="page-head">
      <h2>Janji Temu &amp; Kedatangan Pasien</h2>
      <span class="spacer"></span>
    </div>
    <div class="tabs" id="tabs">
      <button data-tab="janji" class="active">📅 Janji Temu</button>
      <button data-tab="kedatangan">🚶 Kedatangan Pasien</button>
    </div>
    <div id="tab-body"></div>`;

  const tabBody = view.querySelector('#tab-body');
  const tabs = view.querySelector('#tabs');

  tabs.querySelectorAll('button').forEach((b) =>
    b.addEventListener('click', () => {
      if (state.tab === b.dataset.tab) return;
      state.tab = b.dataset.tab;
      tabs.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
      render();
    })
  );

  function render() {
    return state.tab === 'janji' ? renderJanji() : renderKedatangan();
  }

  // =========================================================================
  // Tab 1 — Janji Temu
  // =========================================================================
  async function renderJanji() {
    tabBody.innerHTML = `
      <div class="toolbar">
        <input class="input" type="date" id="f-date" value="${state.date}" style="width:auto" />
        <select class="filter-select" id="f-status"><option value="">Semua status</option>${APPT_STATUS.map((s) => `<option ${s === state.apptStatus ? 'selected' : ''}>${s}</option>`).join('')}</select>
        <div class="search"><input class="input" id="f-q" value="${esc(state.q)}" placeholder="Cari pasien / pemilik (semua tanggal)..." /></div>
        <span class="spacer"></span>
        <button class="btn btn-primary" id="btn-add">+ Buat Janji</button>
      </div>
      <div class="t-muted" id="sub" style="margin-bottom:10px"></div>
      <div class="card"><div class="table-wrap"><table class="tbl">
        <thead><tr><th>Waktu</th><th>Pasien</th><th>Pemilik</th><th>Jenis</th><th>Status</th><th></th></tr></thead>
        <tbody id="body"></tbody>
      </table></div></div>`;

    const body = tabBody.querySelector('#body');
    const sub = tabBody.querySelector('#sub');
    const today = hariIniISO();

    async function load() {
      const p = new URLSearchParams();
      if (state.q) p.set('q', state.q);
      else if (state.date) p.set('date', state.date);
      if (state.apptStatus) p.set('status', state.apptStatus);
      body.innerHTML = `<tr><td colspan="6" class="t-muted" style="text-align:center;padding:20px">Memuat…</td></tr>`;
      const [list, arrivals] = await Promise.all([
        api.get('/api/appointments?' + p.toString()),
        api.get('/api/arrivals?date=' + today),
      ]);
      const arrivedAppt = new Set(arrivals.filter((x) => x.appointment_id).map((x) => x.appointment_id));
      sub.textContent = state.q ? `Hasil pencarian "${state.q}"` : tanggalPanjang(state.date);

      if (!list.length) {
        body.innerHTML = `<tr><td colspan="6" class="t-muted" style="text-align:center;padding:26px">Tidak ada janji temu.</td></tr>`;
        return;
      }
      body.innerHTML = list
        .map((a) => {
          const isToday = String(a.scheduled_at).slice(0, 10) === today;
          const arrived = arrivedAppt.has(a.id);
          let checkin = '';
          if (arrived) {
            checkin = `<span class="pill" style="background:var(--ok-bg);color:var(--ok)">✓ Datang</span> `;
          } else if (isToday && a.status !== 'Batal') {
            checkin = `<button class="btn btn-sm btn-primary" data-checkin="${a.id}" title="Catat kedatangan">🚶 Check-in</button> `;
          }
          return `<tr>
            <td class="t-strong">${state.q ? tanggal(a.scheduled_at) + ' · ' : ''}${jam(a.scheduled_at)}</td>
            <td><a href="#/patients/${a.patient_id}">${spesiesEmoji(a.patient_species)} ${esc(a.patient_name)}</a></td>
            <td>${esc(a.owner_name)}<div class="t-muted">${esc(a.owner_phone || '')}</div></td>
            <td><span class="pill">${esc(a.type || '-')}</span>${a.reason ? `<div class="t-muted">${esc(a.reason)}</div>` : ''}</td>
            <td>${statusBadge(a.status)}</td>
            <td class="num" style="white-space:nowrap">${checkin}<button class="btn-icon" data-edit="${a.id}" title="Edit">✏️</button><button class="btn-icon" data-del="${a.id}" title="Hapus">🗑️</button></td>
          </tr>`;
        })
        .join('');

      body.querySelectorAll('[data-edit]').forEach((b) =>
        b.addEventListener('click', () => appointmentForm(list.find((x) => x.id == b.dataset.edit), load))
      );
      body.querySelectorAll('[data-del]').forEach((b) =>
        b.addEventListener('click', async () => {
          if (await confirmDialog('Hapus janji temu ini?')) {
            await api.del('/api/appointments/' + b.dataset.del);
            toast('Janji temu dihapus.');
            load();
          }
        })
      );
      body.querySelectorAll('[data-checkin]').forEach((b) =>
        b.addEventListener('click', async () => {
          const a = list.find((x) => x.id == b.dataset.checkin);
          b.disabled = true;
          try {
            await api.post('/api/arrivals', {
              patient_id: a.patient_id,
              appointment_id: a.id,
              complaint: a.reason || '',
              status: 'Menunggu',
            });
            toast(`${a.patient_name} ditandai datang — lihat tab Kedatangan.`);
            load();
          } catch (err) {
            toast(err.message, 'error');
            b.disabled = false;
          }
        })
      );
    }

    tabBody.querySelector('#btn-add').addEventListener('click', () => appointmentForm(null, load));
    tabBody.querySelector('#f-date').addEventListener('change', (e) => {
      state.date = e.target.value;
      state.q = '';
      tabBody.querySelector('#f-q').value = '';
      load();
    });
    tabBody.querySelector('#f-status').addEventListener('change', (e) => {
      state.apptStatus = e.target.value;
      load();
    });
    let t;
    tabBody.querySelector('#f-q').addEventListener('input', (e) => {
      clearTimeout(t);
      state.q = e.target.value.trim();
      t = setTimeout(load, 250);
    });

    await load();
  }

  // =========================================================================
  // Tab 2 — Kedatangan Pasien (antrian ruang tunggu)
  // =========================================================================
  async function renderKedatangan() {
    tabBody.innerHTML = `
      <div class="toolbar">
        <input class="input" type="date" id="k-date" value="${state.date}" style="width:auto" />
        <select class="filter-select" id="k-status"><option value="">Semua status</option>${ARR_STATUS.map((s) => `<option ${s === state.arrStatus ? 'selected' : ''}>${s}</option>`).join('')}</select>
        <span class="spacer"></span>
        <button class="btn btn-primary" id="k-add">+ Catat Kedatangan</button>
      </div>
      <div class="q-sum" id="k-sum"></div>
      <div class="t-muted" id="k-sub" style="margin:2px 0 10px"></div>
      <div class="card"><div class="table-wrap"><table class="tbl">
        <thead><tr><th>#</th><th>Datang</th><th>Pasien</th><th>Pemilik</th><th>Keluhan</th><th>Status</th><th></th></tr></thead>
        <tbody id="k-body"></tbody>
      </table></div></div>`;

    const body = tabBody.querySelector('#k-body');
    const sum = tabBody.querySelector('#k-sum');
    const sub = tabBody.querySelector('#k-sub');

    async function load() {
      body.innerHTML = `<tr><td colspan="7" class="t-muted" style="text-align:center;padding:20px">Memuat…</td></tr>`;
      const dayList = await api.get('/api/arrivals?date=' + state.date);

      const c = { Menunggu: 0, Diperiksa: 0, Selesai: 0, Pulang: 0 };
      dayList.forEach((a) => { if (c[a.status] != null) c[a.status]++; });
      sum.innerHTML = `
        <div class="q-chip q-total"><b>${dayList.length}</b> Total</div>
        <div class="q-chip q-wait"><b>${c.Menunggu}</b> Menunggu</div>
        <div class="q-chip q-exam"><b>${c.Diperiksa}</b> Diperiksa</div>
        <div class="q-chip q-done"><b>${c.Selesai}</b> Selesai</div>
        <div class="q-chip"><b>${c.Pulang}</b> Pulang</div>`;
      sub.textContent = tanggalPanjang(state.date);

      const list = state.arrStatus ? dayList.filter((a) => a.status === state.arrStatus) : dayList;
      if (!list.length) {
        body.innerHTML = `<tr><td colspan="7" class="t-muted" style="text-align:center;padding:26px">Belum ada kedatangan pasien${state.arrStatus ? ' berstatus "' + esc(state.arrStatus) + '"' : ''}.</td></tr>`;
        return;
      }
      const order = new Map(dayList.map((a, i) => [a.id, i + 1]));
      body.innerHTML = list.map((a) => rowHtml(a, order.get(a.id))).join('');

      body.querySelectorAll('[data-adv]').forEach((b) =>
        b.addEventListener('click', async () => {
          b.disabled = true;
          try {
            await api.put(`/api/arrivals/${b.dataset.adv}/status`, { status: b.dataset.next });
            toast('Status antrian diperbarui.');
            load();
          } catch (err) {
            toast(err.message, 'error');
            b.disabled = false;
          }
        })
      );
      body.querySelectorAll('[data-edit]').forEach((b) =>
        b.addEventListener('click', () => arrivalForm(dayList.find((x) => x.id == b.dataset.edit), load))
      );
      body.querySelectorAll('[data-del]').forEach((b) =>
        b.addEventListener('click', async () => {
          if (await confirmDialog('Hapus data kedatangan ini?')) {
            await api.del('/api/arrivals/' + b.dataset.del);
            toast('Data kedatangan dihapus.');
            load();
          }
        })
      );
    }

    function rowHtml(a, no) {
      const waited = selisihMenit(a.arrived_at);
      let elapsed = '';
      if (a.status === 'Menunggu') elapsed = `menunggu ${durasiSingkat(waited)}`;
      else if (a.status === 'Diperiksa') elapsed = a.called_at ? `diperiksa ${durasiSingkat(selisihMenit(a.called_at))}` : '';
      else if (a.finished_at) elapsed = `durasi ${durasiSingkat(waited - selisihMenit(a.finished_at))}`;

      const apptInfo = a.appt_time
        ? `Janji ${jam(a.appt_time)}${a.appt_type ? ' · ' + esc(a.appt_type) : ''}`
        : 'Tanpa janji (walk-in)';
      const nxt = NEXT[a.status];
      const adv = nxt ? `<button class="btn btn-sm btn-primary" data-adv="${a.id}" data-next="${nxt}">${NEXT_LABEL[nxt]}</button> ` : '';

      return `<tr>
        <td><span class="q-no">${no}</span></td>
        <td class="t-strong">${jam(a.arrived_at)}<div class="t-muted">${durasiSingkat(waited)} lalu</div></td>
        <td><a href="#/patients/${a.patient_id}">${spesiesEmoji(a.patient_species)} ${esc(a.patient_name)}</a><div class="t-muted">${apptInfo}</div></td>
        <td>${esc(a.owner_name)}<div class="t-muted">${esc(a.owner_phone || '')}</div></td>
        <td>${a.complaint ? esc(a.complaint) : '<span class="t-muted">—</span>'}</td>
        <td>${statusBadge(a.status)}${elapsed ? `<div class="t-muted">${elapsed}</div>` : ''}</td>
        <td class="num" style="white-space:nowrap">${adv}<button class="btn-icon" data-edit="${a.id}" title="Edit">✏️</button><button class="btn-icon" data-del="${a.id}" title="Hapus">🗑️</button></td>
      </tr>`;
    }

    tabBody.querySelector('#k-add').addEventListener('click', () => arrivalForm(null, load));
    tabBody.querySelector('#k-date').addEventListener('change', (e) => {
      state.date = e.target.value;
      load();
    });
    tabBody.querySelector('#k-status').addEventListener('change', (e) => {
      state.arrStatus = e.target.value;
      load();
    });

    await load();
  }

  await render();
}
