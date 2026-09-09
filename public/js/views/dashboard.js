// views/dashboard.js — Beranda: ringkasan klinik.
import { api, rupiah, esc, tanggal, jam, selisihHari, statusBadge, spesiesEmoji } from '../util.js';

function stat(icon, cls, val, label) {
  return `<div class="stat">
    <div class="stat-ic ${cls}">${icon}</div>
    <div><div class="stat-val">${val}</div><div class="stat-lbl">${esc(label)}</div></div>
  </div>`;
}

function dueBadge(iso) {
  const d = selisihHari(iso);
  if (d == null) return '';
  if (d < 0) return `<span class="badge badge-danger">Terlambat ${Math.abs(d)} hari</span>`;
  if (d === 0) return `<span class="badge badge-wait">Hari ini</span>`;
  if (d <= 7) return `<span class="badge badge-wait">${d} hari lagi</span>`;
  return `<span class="badge badge-muted">${d} hari lagi</span>`;
}

export default async function dashboard(view) {
  const d = await api.get('/api/dashboard');
  const c = d.counts;
  const overdue = d.vacc_due.filter((v) => selisihHari(v.next_due_date) < 0).length;

  const apptRows = d.appts_today.length
    ? d.appts_today
        .map(
          (a) => `<tr>
            <td class="t-strong">${jam(a.scheduled_at)}</td>
            <td><a href="#/patients/${a.patient_id}">${spesiesEmoji(a.patient_species)} ${esc(a.patient_name)}</a><div class="t-muted">${esc(a.owner_name)}</div></td>
            <td><span class="pill">${esc(a.type || '-')}</span></td>
            <td>${statusBadge(a.status)}</td>
          </tr>`
        )
        .join('')
    : `<tr><td colspan="4" class="t-muted" style="padding:22px;text-align:center">Tidak ada janji temu hari ini.</td></tr>`;

  const vaccRows = d.vacc_due.length
    ? d.vacc_due
        .slice(0, 8)
        .map(
          (v) => `<tr>
            <td><a href="#/patients/${v.patient_id}">${esc(v.patient_name)}</a><div class="t-muted">${esc(v.owner_name)}${v.owner_phone ? ' · ' + esc(v.owner_phone) : ''}</div></td>
            <td><span class="badge badge-teal">${esc(v.vaccine_name)}</span></td>
            <td>${tanggal(v.next_due_date)}</td>
            <td>${dueBadge(v.next_due_date)}</td>
          </tr>`
        )
        .join('')
    : `<tr><td colspan="4" class="t-muted" style="padding:22px;text-align:center">Tidak ada vaksin yang akan jatuh tempo.</td></tr>`;

  const invRows = d.recent_invoices.length
    ? d.recent_invoices
        .map(
          (i) => `<tr class="row-link" onclick="location.hash='#/invoices/${i.id}'">
            <td class="t-strong">${esc(i.invoice_no || '-')}</td>
            <td>${esc(i.patient_name || i.owner_name || '-')}</td>
            <td class="num">${rupiah(i.total)}</td>
            <td>${statusBadge(i.status)}</td>
          </tr>`
        )
        .join('')
    : `<tr><td colspan="4" class="t-muted" style="padding:22px;text-align:center">Belum ada tagihan.</td></tr>`;

  view.innerHTML = `
    ${overdue ? `<div class="alert alert-danger">⚠️ Ada <b>${overdue} vaksinasi</b> yang sudah lewat jatuh tempo. Segera hubungi pemilik untuk penjadwalan ulang.</div>` : ''}
    <div class="stats">
      ${stat('🐾', 'ic-teal', c.patients, 'Pasien Aktif')}
      ${stat('📅', 'ic-blue', c.appts_today, 'Janji Hari Ini')}
      ${stat('💉', 'ic-amber', d.vacc_due.length, 'Vaksin Jatuh Tempo (30 hari)')}
      ${stat('💰', 'ic-green', rupiah(d.revenue_month), 'Pemasukan Bulan Ini')}
    </div>

    <div class="grid cols-2">
      <div class="card">
        <div class="card-head">📅 Janji Temu Hari Ini <span class="spacer"></span><a class="btn btn-ghost btn-sm" href="#/appointments">Lihat semua</a></div>
        <div class="table-wrap"><table class="tbl"><thead><tr><th>Jam</th><th>Pasien</th><th>Jenis</th><th>Status</th></tr></thead><tbody>${apptRows}</tbody></table></div>
      </div>
      <div class="card">
        <div class="card-head">💉 Pengingat Vaksinasi <span class="spacer"></span><a class="btn btn-ghost btn-sm" href="#/vaccinations">Lihat semua</a></div>
        <div class="table-wrap"><table class="tbl"><thead><tr><th>Pasien</th><th>Vaksin</th><th>Jatuh Tempo</th><th></th></tr></thead><tbody>${vaccRows}</tbody></table></div>
      </div>
    </div>

    <div class="grid cols-2" style="margin-top:16px">
      <div class="card">
        <div class="card-head">🧾 Tagihan Terbaru <span class="spacer"></span><a class="btn btn-ghost btn-sm" href="#/invoices">Lihat semua</a></div>
        <div class="table-wrap"><table class="tbl"><thead><tr><th>No.</th><th>Pasien/Pemilik</th><th class="num">Total</th><th>Status</th></tr></thead><tbody>${invRows}</tbody></table></div>
      </div>
      <div class="card card-pad">
        <div style="font-weight:700;margin-bottom:12px">💰 Ringkasan Keuangan</div>
        <dl class="dl">
          <dt>Pemasukan bulan ini</dt><dd class="t-strong">${rupiah(d.revenue_month)}</dd>
          <dt>Total belum lunas</dt><dd class="t-strong" style="color:var(--danger)">${rupiah(d.unpaid_total)}</dd>
          <dt>Tagihan belum lunas</dt><dd>${c.unpaid} tagihan</dd>
          <dt>Total pemilik terdaftar</dt><dd>${c.owners} orang</dd>
        </dl>
        <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">
          <a class="btn btn-primary btn-sm" href="#/appointments">+ Janji Temu</a>
          <a class="btn btn-ghost btn-sm" href="#/invoices">+ Tagihan</a>
          <a class="btn btn-ghost btn-sm" href="#/patients">+ Pasien</a>
        </div>
      </div>
    </div>`;
}
