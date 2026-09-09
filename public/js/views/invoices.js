// views/invoices.js — Kasir & tagihan: daftar, tampilan cetak, dan editor.
import { api, esc, rupiah, tanggal, store, statusBadge, openModal, closeModal, toast, confirmDialog, hariIniISO } from '../util.js';

const CATEGORIES = ['Jasa', 'Obat', 'Vaksin', 'Produk', 'Tindakan', 'Rawat Inap', 'Lainnya'];
const METHODS = ['Tunai', 'Transfer', 'QRIS', 'Kartu Debit', 'Kartu Kredit'];

// ---------------------------------------------------------------------------
// Daftar tagihan
// ---------------------------------------------------------------------------
export async function list(view) {
  const state = { q: '', status: '' };

  view.innerHTML = `
    <div class="page-head"><h2>Tagihan</h2><span class="spacer"></span>
      <button class="btn btn-primary" id="btn-add">+ Buat Tagihan</button></div>
    <div class="toolbar">
      <div class="search"><input class="input" id="f-q" placeholder="Cari no. tagihan / pasien / pemilik..." /></div>
      <select class="filter-select" id="f-status"><option value="">Semua status</option><option>Belum Bayar</option><option>Sebagian</option><option>Lunas</option></select>
    </div>
    <div class="card"><div class="table-wrap"><table class="tbl">
      <thead><tr><th>No.</th><th>Tanggal</th><th>Pasien / Pemilik</th><th class="num">Total</th><th class="num">Dibayar</th><th>Status</th><th></th></tr></thead>
      <tbody id="body"></tbody>
    </table></div></div>`;

  const body = view.querySelector('#body');

  async function load() {
    const p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (state.status) p.set('status', state.status);
    body.innerHTML = `<tr><td colspan="7" class="t-muted" style="text-align:center;padding:20px">Memuat…</td></tr>`;
    const data = await api.get('/api/invoices?' + p.toString());
    if (!data.length) {
      body.innerHTML = `<tr><td colspan="7" class="t-muted" style="text-align:center;padding:26px">Belum ada tagihan.</td></tr>`;
      return;
    }
    body.innerHTML = data
      .map(
        (i) => `<tr class="row-link" data-open="${i.id}">
          <td class="t-strong">${esc(i.invoice_no || '-')}</td>
          <td>${tanggal(i.invoice_date)}</td>
          <td>${esc(i.patient_name || '-')}<div class="t-muted">${esc(i.owner_name || '')}</div></td>
          <td class="num">${rupiah(i.total)}</td>
          <td class="num">${rupiah(i.paid)}</td>
          <td>${statusBadge(i.status)}</td>
          <td class="num"><button class="btn-icon" data-del="${i.id}" title="Hapus">🗑️</button></td>
        </tr>`
      )
      .join('');
    body.querySelectorAll('[data-open]').forEach((tr) =>
      tr.addEventListener('click', (e) => {
        if (e.target.closest('[data-del]')) return;
        location.hash = '#/invoices/' + tr.dataset.open;
      })
    );
    body.querySelectorAll('[data-del]').forEach((b) =>
      b.addEventListener('click', async () => {
        if (await confirmDialog('Hapus tagihan ini?')) {
          await api.del('/api/invoices/' + b.dataset.del);
          toast('Tagihan dihapus.');
          load();
        }
      })
    );
  }

  view.querySelector('#btn-add').addEventListener('click', () => openInvoiceEditor(null, load));
  view.querySelector('#f-status').addEventListener('change', (e) => {
    state.status = e.target.value;
    load();
  });
  let t;
  view.querySelector('#f-q').addEventListener('input', (e) => {
    clearTimeout(t);
    state.q = e.target.value.trim();
    t = setTimeout(load, 250);
  });

  await load();
}

// ---------------------------------------------------------------------------
// Detail / cetak
// ---------------------------------------------------------------------------
function sumRow(label, val) {
  return `<div style="display:flex;justify-content:space-between;padding:3px 0"><span class="t-muted">${label}</span><span>${val}</span></div>`;
}

export async function detail(view, id) {
  const inv = await api.get('/api/invoices/' + id);
  const s = store.settings || {};
  const subtotal = inv.items.reduce((a, it) => a + it.amount, 0);
  const sisa = inv.total - inv.paid;

  view.innerHTML = `
    <div class="no-print" style="display:flex;gap:8px;margin-bottom:14px;align-items:center">
      <div class="back-link" style="margin:0" onclick="location.hash='#/invoices'">← Kembali ke daftar</div>
      <span class="spacer" style="flex:1"></span>
      <button class="btn btn-ghost btn-sm" id="edit">✏️ Edit</button>
      <button class="btn btn-ghost btn-sm" id="del">🗑️ Hapus</button>
      <button class="btn btn-primary btn-sm" id="print">🖨️ Cetak / PDF</button>
    </div>
    <div class="card card-pad" style="max-width:760px;margin:0 auto">
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;border-bottom:2px solid var(--border);padding-bottom:14px;margin-bottom:16px">
        <div>
          <div style="font-size:20px;font-weight:800;color:var(--primary-700)">${esc(s.clinic_name || 'Klinik Hewan')}</div>
          <div class="t-muted">${esc(s.clinic_address || '')}</div>
          <div class="t-muted">${esc(s.clinic_phone || '')}${s.clinic_email ? ' · ' + esc(s.clinic_email) : ''}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:18px;font-weight:800;letter-spacing:1px">TAGIHAN</div>
          <div class="t-strong">${esc(inv.invoice_no || '')}</div>
          <div class="t-muted">${tanggal(inv.invoice_date)}</div>
          <div style="margin-top:4px">${statusBadge(inv.status)}</div>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:16px">
        <div><div class="t-muted">Ditagihkan kepada</div><div class="t-strong">${esc(inv.owner_name || '-')}</div><div class="t-muted">${esc(inv.owner_phone || '')}</div><div class="t-muted">${esc(inv.owner_address || '')}</div></div>
        <div style="text-align:right"><div class="t-muted">Pasien</div><div class="t-strong">${esc(inv.patient_name || '-')}</div><div class="t-muted">${esc(inv.patient_species || '')}</div></div>
      </div>
      <div class="table-wrap"><table class="tbl" style="margin-bottom:16px">
        <thead><tr><th>Deskripsi</th><th>Kategori</th><th class="num">Qty</th><th class="num">Harga</th><th class="num">Jumlah</th></tr></thead>
        <tbody>${inv.items
          .map(
            (it) => `<tr><td class="t-strong">${esc(it.description)}</td><td class="t-muted">${esc(it.category || '-')}</td>
              <td class="num">${it.qty}</td><td class="num">${rupiah(it.unit_price)}</td><td class="num">${rupiah(it.amount)}</td></tr>`
          )
          .join('')}</tbody>
      </table></div>
      <div style="display:flex;justify-content:flex-end">
        <div style="min-width:280px">
          ${sumRow('Subtotal', rupiah(subtotal))}
          ${inv.discount ? sumRow('Diskon', '− ' + rupiah(inv.discount)) : ''}
          ${inv.tax ? sumRow('Pajak', rupiah(inv.tax)) : ''}
          <div style="border-top:1px solid var(--border);margin:6px 0"></div>
          ${sumRow('<b>TOTAL</b>', `<b style="font-size:18px">${rupiah(inv.total)}</b>`)}
          ${sumRow('Dibayar', rupiah(inv.paid))}
          ${sisa > 0 ? sumRow('Sisa Tagihan', `<b style="color:var(--danger)">${rupiah(sisa)}</b>`) : ''}
          ${inv.payment_method ? sumRow('Metode', esc(inv.payment_method)) : ''}
        </div>
      </div>
      ${inv.notes ? `<div style="margin-top:16px" class="t-muted">Catatan: ${esc(inv.notes)}</div>` : ''}
      <div class="print-only" style="margin-top:36px;text-align:right">
        <div>Hormat kami,</div>
        <div style="margin-top:46px;font-weight:700">${esc(s.clinic_vet || '')}</div>
      </div>
      <div class="print-only" style="margin-top:24px;text-align:center;font-size:11px;color:#888">Terima kasih atas kepercayaan Anda 🐾</div>
    </div>`;

  view.querySelector('#print').addEventListener('click', () => window.print());
  view.querySelector('#edit').addEventListener('click', () => openInvoiceEditor(inv, () => detail(view, id)));
  view.querySelector('#del').addEventListener('click', async () => {
    if (await confirmDialog('Hapus tagihan ini?')) {
      await api.del('/api/invoices/' + id);
      toast('Tagihan dihapus.');
      location.hash = '#/invoices';
    }
  });
}

// ---------------------------------------------------------------------------
// Editor tagihan (modal dengan item dinamis)
// ---------------------------------------------------------------------------
export async function openInvoiceEditor(existing, onSaved, prefill = {}) {
  const e = existing || {};
  const [patients, owners] = await Promise.all([api.get('/api/patients'), api.get('/api/owners')]);
  const items =
    e.items && e.items.length
      ? e.items.map((it) => ({ description: it.description, category: it.category || 'Jasa', qty: it.qty, unit_price: it.unit_price }))
      : [{ description: '', category: 'Jasa', qty: 1, unit_price: 0 }];

  const selPatient = e.patient_id || prefill.patientId || '';
  const selOwner = e.owner_id || prefill.ownerId || '';

  const patientOpts =
    `<option value="">— tanpa pasien —</option>` +
    patients
      .map((p) => `<option value="${p.id}" data-owner="${p.owner_id}" ${p.id == selPatient ? 'selected' : ''}>${esc(p.name)} — ${esc(p.owner_name)}</option>`)
      .join('');
  const ownerOpts =
    `<option value="">— tanpa pemilik —</option>` +
    owners.map((o) => `<option value="${o.id}" ${o.id == selOwner ? 'selected' : ''}>${esc(o.name)}</option>`).join('');

  function itemsHtml() {
    return items
      .map(
        (it, i) => `<tr>
          <td><input class="input" data-i="${i}" data-f="description" value="${esc(it.description)}" placeholder="Deskripsi layanan/obat" /></td>
          <td><select class="input" data-i="${i}" data-f="category">${CATEGORIES.map((c) => `<option ${c === it.category ? 'selected' : ''}>${c}</option>`).join('')}</select></td>
          <td style="width:64px"><input class="input num" type="number" min="0" step="1" data-i="${i}" data-f="qty" value="${it.qty}" /></td>
          <td style="width:118px"><input class="input num" type="number" min="0" step="1000" data-i="${i}" data-f="unit_price" value="${it.unit_price}" /></td>
          <td class="num" data-amt="${i}" style="width:110px;font-weight:600">${rupiah(it.qty * it.unit_price)}</td>
          <td style="width:28px"><button type="button" class="btn-icon rm" data-rm="${i}">✕</button></td>
        </tr>`
      )
      .join('');
  }

  const body = `
    <div class="form-row">
      <div class="field"><label>Pemilik</label><select name="owner_id" id="inv-owner">${ownerOpts}</select></div>
      <div class="field"><label>Pasien</label><select name="patient_id" id="inv-patient">${patientOpts}</select></div>
    </div>
    <div class="field"><label>Tanggal <span class="req">*</span></label><input class="input" type="date" name="invoice_date" required value="${esc(e.invoice_date) || hariIniISO()}" style="max-width:200px" /></div>
    <label style="font-size:13px;font-weight:600;color:#334155">Rincian Item</label>
    <div class="table-wrap"><table class="tbl items-tbl" style="margin:6px 0 4px">
      <thead><tr><th>Deskripsi</th><th>Kategori</th><th class="num">Qty</th><th class="num">Harga</th><th class="num">Jumlah</th><th></th></tr></thead>
      <tbody id="inv-items">${itemsHtml()}</tbody>
    </table></div>
    <button type="button" class="btn btn-ghost btn-sm" id="add-item">+ Tambah Item</button>

    <div style="display:flex;justify-content:flex-end;margin-top:14px">
      <div style="min-width:280px">
        <div style="display:flex;justify-content:space-between;padding:3px 0"><span class="t-muted">Subtotal</span><span id="sum-subtotal">Rp 0</span></div>
        <div class="form-row" style="gap:8px;margin:4px 0">
          <div class="field" style="margin:0"><label>Diskon (Rp)</label><input class="input num" type="number" min="0" step="1000" name="discount" value="${e.discount || 0}" /></div>
          <div class="field" style="margin:0"><label>Pajak (Rp)</label><input class="input num" type="number" min="0" step="1000" name="tax" value="${e.tax || 0}" /></div>
        </div>
        <div style="display:flex;justify-content:space-between;padding:5px 0;border-top:1px solid var(--border)"><b>Total</b><b id="sum-total" style="font-size:17px">Rp 0</b></div>
        <div class="form-row" style="gap:8px;margin-top:4px">
          <div class="field" style="margin:0"><label>Dibayar (Rp)</label><input class="input num" type="number" min="0" step="1000" name="paid" value="${e.paid || 0}" /></div>
          <div class="field" style="margin:0"><label>Metode</label><select name="payment_method">${METHODS.map((m) => `<option ${m === e.payment_method ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
        </div>
        <div style="display:flex;justify-content:space-between;padding:3px 0" id="sisa-row"><span class="t-muted">Sisa / Kembali</span><span id="sum-sisa">Rp 0</span></div>
      </div>
    </div>
    <div class="field" style="margin-top:6px"><label>Catatan</label><textarea name="notes">${esc(e.notes)}</textarea></div>`;

  openModal(
    `<div class="modal-head"><h3>${e.id ? 'Edit Tagihan' : 'Buat Tagihan'}</h3><button class="x" data-close>&times;</button></div>
     <form><div class="modal-body">${body}</div>
     <div class="modal-foot"><button type="button" class="btn btn-ghost" data-close>Batal</button><button type="submit" class="btn btn-primary">${e.id ? 'Simpan Perubahan' : 'Simpan Tagihan'}</button></div></form>`,
    {
      width: '760px',
      onMount(card) {
        const tbody = card.querySelector('#inv-items');
        const form = card.querySelector('form');

        function recalc() {
          let subtotal = 0;
          items.forEach((it, i) => {
            const amt = (Number(it.qty) || 0) * (Number(it.unit_price) || 0);
            subtotal += amt;
            const cell = card.querySelector(`[data-amt="${i}"]`);
            if (cell) cell.textContent = rupiah(amt);
          });
          const discount = Number(form.discount.value) || 0;
          const tax = Number(form.tax.value) || 0;
          const total = Math.max(0, subtotal - discount + tax);
          const paid = Number(form.paid.value) || 0;
          card.querySelector('#sum-subtotal').textContent = rupiah(subtotal);
          card.querySelector('#sum-total').textContent = rupiah(total);
          const diff = paid - total;
          const sisaEl = card.querySelector('#sum-sisa');
          if (diff < 0) {
            sisaEl.innerHTML = `<b style="color:var(--danger)">${rupiah(-diff)}</b>`;
            card.querySelector('#sisa-row span:first-child').textContent = 'Sisa Tagihan';
          } else {
            sisaEl.innerHTML = `<b style="color:var(--ok)">${rupiah(diff)}</b>`;
            card.querySelector('#sisa-row span:first-child').textContent = 'Kembalian';
          }
        }

        function rebuild() {
          tbody.innerHTML = itemsHtml();
          recalc();
        }

        // Input pada item (delegasi)
        tbody.addEventListener('input', (ev) => {
          const el = ev.target;
          const i = el.dataset.i;
          if (i == null) return;
          const f = el.dataset.f;
          items[i][f] = f === 'qty' || f === 'unit_price' ? Number(el.value) || 0 : el.value;
          recalc();
        });
        tbody.addEventListener('click', (ev) => {
          const rm = ev.target.closest('[data-rm]');
          if (!rm) return;
          items.splice(Number(rm.dataset.rm), 1);
          if (!items.length) items.push({ description: '', category: 'Jasa', qty: 1, unit_price: 0 });
          rebuild();
        });
        card.querySelector('#add-item').addEventListener('click', () => {
          items.push({ description: '', category: 'Jasa', qty: 1, unit_price: 0 });
          rebuild();
        });
        ['discount', 'tax', 'paid'].forEach((n) => form[n].addEventListener('input', recalc));

        // Pilih pasien → set pemilik otomatis
        card.querySelector('#inv-patient').addEventListener('change', (ev) => {
          const optEl = ev.target.selectedOptions[0];
          const ownerId = optEl && optEl.dataset.owner;
          if (ownerId) card.querySelector('#inv-owner').value = ownerId;
        });

        recalc();

        form.addEventListener('submit', async (ev) => {
          ev.preventDefault();
          const btn = form.querySelector('[type=submit]');
          btn.disabled = true;
          try {
            const payload = {
              invoice_date: form.invoice_date.value,
              owner_id: form.owner_id.value || null,
              patient_id: form.patient_id.value || null,
              discount: Number(form.discount.value) || 0,
              tax: Number(form.tax.value) || 0,
              paid: Number(form.paid.value) || 0,
              payment_method: form.payment_method.value,
              notes: form.notes.value,
              items: items.filter((it) => (it.description || '').trim() || it.unit_price),
            };
            if (!payload.items.length) throw new Error('Tambahkan minimal satu item.');
            const saved = e.id ? await api.put(`/api/invoices/${e.id}`, payload) : await api.post('/api/invoices', payload);
            closeModal();
            toast(e.id ? 'Tagihan diperbarui.' : 'Tagihan dibuat.');
            onSaved && onSaved(saved);
          } catch (err) {
            toast(err.message, 'error');
            btn.disabled = false;
          }
        });
      },
    }
  );
}
