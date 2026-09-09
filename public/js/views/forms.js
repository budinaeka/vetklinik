// views/forms.js — Modal form yang dipakai bersama beberapa halaman.
import { api, openModal, closeModal, toast, esc, formData, store, toInputDatetime, fromInputDatetime, hariIniISO } from '../util.js';

const SPECIES = ['Anjing', 'Kucing', 'Kelinci', 'Burung', 'Hamster', 'Marmut', 'Reptil', 'Ikan', 'Musang', 'Lainnya'];
const APPT_TYPES = ['Konsultasi', 'Vaksinasi', 'Kontrol', 'Operasi', 'Grooming', 'Rawat Inap', 'Darurat', 'Lainnya'];
const APPT_STATUS = ['Menunggu', 'Diperiksa', 'Selesai', 'Batal'];
const VACCINES = ['Rabies', 'Tricat', 'Tetracat', 'F4', 'F5', 'DHPP', 'DHPPi', 'Puppy DP', 'Kennel Cough', 'Feline Panleukopenia'];

function wrap(title, bodyHtml, saveText = 'Simpan') {
  return `
    <div class="modal-head"><h3>${esc(title)}</h3><button class="x" data-close>&times;</button></div>
    <form>
      <div class="modal-body">${bodyHtml}</div>
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost" data-close>Batal</button>
        <button type="submit" class="btn btn-primary">${esc(saveText)}</button>
      </div>
    </form>`;
}

function onSubmit(card, handler) {
  const form = card.querySelector('form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      await handler(formData(form));
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false;
    }
  });
}

function opt(list, selected) {
  return list.map((v) => `<option ${v === selected ? 'selected' : ''}>${esc(v)}</option>`).join('');
}

// ---------------------------------------------------------------------------
// Pemilik
// ---------------------------------------------------------------------------
export function ownerForm(existing, onSaved) {
  const e = existing || {};
  const body = `
    <div class="field"><label>Nama Pemilik <span class="req">*</span></label>
      <input class="input" name="name" required value="${esc(e.name)}" placeholder="mis. Siti Rahmawati" /></div>
    <div class="form-row">
      <div class="field"><label>No. HP / WA</label><input class="input" name="phone" value="${esc(e.phone)}" placeholder="0812-xxxx-xxxx" /></div>
      <div class="field"><label>Email</label><input class="input" name="email" value="${esc(e.email)}" /></div>
    </div>
    <div class="field"><label>Alamat</label><textarea name="address" placeholder="Alamat lengkap">${esc(e.address)}</textarea></div>
    <div class="field"><label>Catatan</label><textarea name="notes">${esc(e.notes)}</textarea></div>`;
  openModal(wrap(e.id ? 'Edit Pemilik' : 'Tambah Pemilik', body), {
    onMount(card) {
      onSubmit(card, async (data) => {
        const saved = e.id ? await api.put(`/api/owners/${e.id}`, data) : await api.post('/api/owners', data);
        closeModal();
        toast(e.id ? 'Data pemilik diperbarui.' : 'Pemilik ditambahkan.');
        onSaved && onSaved(saved);
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Pasien
// ---------------------------------------------------------------------------
export async function patientForm(existing, onSaved, { ownerId } = {}) {
  const e = existing || {};
  const owners = await api.get('/api/owners');
  const sel = e.owner_id || ownerId;
  const ownerOpts = owners
    .map((o) => `<option value="${o.id}" ${o.id == sel ? 'selected' : ''}>${esc(o.name)}${o.phone ? ' — ' + esc(o.phone) : ''}</option>`)
    .join('');
  const body = `
    <div class="field"><label>Pemilik <span class="req">*</span></label>
      <select name="owner_id" required><option value="">— pilih pemilik —</option>${ownerOpts}</select>
      ${owners.length === 0 ? '<div class="hint">Belum ada pemilik. Tambahkan pemilik terlebih dahulu.</div>' : ''}</div>
    <div class="form-row">
      <div class="field"><label>Nama Hewan <span class="req">*</span></label><input class="input" name="name" required value="${esc(e.name)}" placeholder="mis. Milo" /></div>
      <div class="field"><label>Spesies</label><input class="input" name="species" list="dl-species" value="${esc(e.species)}" placeholder="Anjing / Kucing / ..." />
        <datalist id="dl-species">${SPECIES.map((s) => `<option>${s}</option>`).join('')}</datalist></div>
    </div>
    <div class="form-row-3">
      <div class="field"><label>Ras</label><input class="input" name="breed" value="${esc(e.breed)}" placeholder="mis. Persia" /></div>
      <div class="field"><label>Jenis Kelamin</label><select name="sex"><option value="">-</option><option ${e.sex === 'Jantan' ? 'selected' : ''}>Jantan</option><option ${e.sex === 'Betina' ? 'selected' : ''}>Betina</option></select></div>
      <div class="field"><label>Warna</label><input class="input" name="color" value="${esc(e.color)}" /></div>
    </div>
    <div class="form-row-3">
      <div class="field"><label>Tgl Lahir</label><input class="input" type="date" name="birth_date" value="${esc(e.birth_date)}" /></div>
      <div class="field"><label>Berat (kg)</label><input class="input" type="number" step="0.1" min="0" name="weight" value="${e.weight ?? ''}" /></div>
      <div class="field"><label>No. Microchip</label><input class="input" name="microchip" value="${esc(e.microchip)}" /></div>
    </div>
    <div class="field"><label>Alergi</label><input class="input" name="allergies" value="${esc(e.allergies)}" placeholder="mis. Seafood, obat tertentu" /></div>
    <div class="field"><label class="check"><input type="checkbox" name="sterilized" ${e.sterilized ? 'checked' : ''} /> Sudah steril / kastrasi</label></div>
    <div class="field"><label>Catatan</label><textarea name="notes">${esc(e.notes)}</textarea></div>`;
  openModal(wrap(e.id ? 'Edit Pasien' : 'Tambah Pasien', body), {
    width: '620px',
    onMount(card) {
      onSubmit(card, async (data) => {
        const saved = e.id ? await api.put(`/api/patients/${e.id}`, data) : await api.post('/api/patients', data);
        closeModal();
        toast(e.id ? 'Data pasien diperbarui.' : 'Pasien ditambahkan.');
        onSaved && onSaved(saved);
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Janji temu
// ---------------------------------------------------------------------------
export async function appointmentForm(existing, onSaved, { patientId } = {}) {
  const e = existing || {};
  const patients = await api.get('/api/patients');
  const sel = e.patient_id || patientId;
  const patientOpts = patients
    .map((p) => `<option value="${p.id}" ${p.id == sel ? 'selected' : ''}>${esc(p.name)} — ${esc(p.owner_name)} (${esc(p.species || '?')})</option>`)
    .join('');
  const body = `
    <div class="field"><label>Pasien <span class="req">*</span></label>
      <select name="patient_id" required><option value="">— pilih pasien —</option>${patientOpts}</select></div>
    <div class="form-row">
      <div class="field"><label>Waktu <span class="req">*</span></label><input class="input" type="datetime-local" name="scheduled_at" required value="${toInputDatetime(e.scheduled_at) || hariIniISO() + 'T09:00'}" /></div>
      <div class="field"><label>Jenis</label><select name="type">${opt(APPT_TYPES, e.type || 'Konsultasi')}</select></div>
    </div>
    <div class="field"><label>Status</label><select name="status">${opt(APPT_STATUS, e.status || 'Menunggu')}</select></div>
    <div class="field"><label>Keluhan / Alasan</label><textarea name="reason">${esc(e.reason)}</textarea></div>
    <div class="field"><label>Catatan</label><textarea name="notes">${esc(e.notes)}</textarea></div>`;
  openModal(wrap(e.id ? 'Edit Janji Temu' : 'Buat Janji Temu', body), {
    onMount(card) {
      onSubmit(card, async (data) => {
        data.scheduled_at = fromInputDatetime(data.scheduled_at);
        const saved = e.id ? await api.put(`/api/appointments/${e.id}`, data) : await api.post('/api/appointments', data);
        closeModal();
        toast(e.id ? 'Janji temu diperbarui.' : 'Janji temu dibuat.');
        onSaved && onSaved(saved);
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Kedatangan pasien (check-in / walk-in)
// ---------------------------------------------------------------------------
const ARRIVAL_STATUS = ['Menunggu', 'Diperiksa', 'Selesai', 'Pulang'];

function nowInput() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export async function arrivalForm(existing, onSaved, { patientId } = {}) {
  const e = existing || {};
  const patients = await api.get('/api/patients');
  const sel = e.patient_id || patientId;
  const patientOpts = patients
    .map((p) => `<option value="${p.id}" ${p.id == sel ? 'selected' : ''}>${esc(p.name)} — ${esc(p.owner_name)} (${esc(p.species || '?')})</option>`)
    .join('');
  const body = `
    <div class="field"><label>Pasien <span class="req">*</span></label>
      <select name="patient_id" required><option value="">— pilih pasien —</option>${patientOpts}</select></div>
    <div class="form-row">
      <div class="field"><label>Waktu Datang <span class="req">*</span></label>
        <input class="input" type="datetime-local" name="arrived_at" required value="${toInputDatetime(e.arrived_at) || nowInput()}" /></div>
      <div class="field"><label>Status</label><select name="status">${opt(ARRIVAL_STATUS, e.status || 'Menunggu')}</select></div>
    </div>
    <div class="field"><label>Keluhan / Alasan</label><textarea name="complaint" placeholder="mis. Gatal, nafsu makan menurun">${esc(e.complaint)}</textarea></div>
    <div class="field"><label>Catatan</label><textarea name="notes">${esc(e.notes)}</textarea></div>`;
  openModal(wrap(e.id ? 'Edit Kedatangan' : 'Catat Kedatangan Pasien', body), {
    onMount(card) {
      onSubmit(card, async (data) => {
        data.arrived_at = fromInputDatetime(data.arrived_at);
        if (e.appointment_id) data.appointment_id = e.appointment_id;
        const saved = e.id
          ? await api.put(`/api/arrivals/${e.id}`, data)
          : await api.post('/api/arrivals', data);
        closeModal();
        toast(e.id ? 'Data kedatangan diperbarui.' : 'Kedatangan pasien dicatat.');
        onSaved && onSaved(saved);
      });
    },
  });
}

export async function recordForm(existing, onSaved, { patientId, patientName } = {}) {
  const e = existing || {};
  const fixedPatient = patientId || e.patient_id;
  let patientField;
  if (fixedPatient && patientName) {
    patientField = `<input type="hidden" name="patient_id" value="${fixedPatient}" />
      <div class="field"><label>Pasien</label><input class="input" value="${esc(patientName)}" disabled /></div>`;
  } else {
    const patients = await api.get('/api/patients');
    const patientOpts = patients
      .map((p) => `<option value="${p.id}" ${p.id == fixedPatient ? 'selected' : ''}>${esc(p.name)} — ${esc(p.owner_name)}</option>`)
      .join('');
    patientField = `<div class="field"><label>Pasien <span class="req">*</span></label>
      <select name="patient_id" required><option value="">— pilih pasien —</option>${patientOpts}</select></div>`;
  }
  const body = `
    ${patientField}
    <div class="form-row-3">
      <div class="field"><label>Tanggal <span class="req">*</span></label><input class="input" type="date" name="visit_date" required value="${esc(e.visit_date) || hariIniISO()}" /></div>
      <div class="field"><label>Berat (kg)</label><input class="input" type="number" step="0.1" min="0" name="weight" value="${e.weight ?? ''}" /></div>
      <div class="field"><label>Suhu (°C)</label><input class="input" type="number" step="0.1" name="temperature" value="${e.temperature ?? ''}" /></div>
    </div>
    <div class="field"><label>S — Anamnesa / Keluhan</label><textarea name="subjective" placeholder="Keluhan yang disampaikan pemilik">${esc(e.subjective)}</textarea></div>
    <div class="field"><label>O — Pemeriksaan / Status Present</label><textarea name="objective" placeholder="Hasil pemeriksaan fisik">${esc(e.objective)}</textarea></div>
    <div class="field"><label>A — Diagnosis / Assessment</label><textarea name="assessment">${esc(e.assessment)}</textarea></div>
    <div class="field"><label>P — Terapi & Rencana</label><textarea name="plan" placeholder="Obat, tindakan, kontrol berikutnya">${esc(e.plan)}</textarea></div>
    <div class="field"><label>Dokter Pemeriksa</label><input class="input" name="vet_name" value="${esc(e.vet_name || store.settings.clinic_vet || '')}" /></div>`;
  openModal(wrap(e.id ? 'Edit Rekam Medis' : 'Rekam Medis Baru', body), {
    width: '640px',
    onMount(card) {
      onSubmit(card, async (data) => {
        const saved = e.id ? await api.put(`/api/records/${e.id}`, data) : await api.post('/api/records', data);
        closeModal();
        toast(e.id ? 'Rekam medis diperbarui.' : 'Rekam medis disimpan.');
        onSaved && onSaved(saved);
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Vaksinasi
// ---------------------------------------------------------------------------
export async function vaccineForm(existing, onSaved, { patientId, patientName } = {}) {
  const e = existing || {};
  const fixedPatient = patientId || e.patient_id;
  let patientField;
  if (fixedPatient && patientName) {
    patientField = `<input type="hidden" name="patient_id" value="${fixedPatient}" />
      <div class="field"><label>Pasien</label><input class="input" value="${esc(patientName)}" disabled /></div>`;
  } else {
    const patients = await api.get('/api/patients');
    const patientOpts = patients
      .map((p) => `<option value="${p.id}" ${p.id == fixedPatient ? 'selected' : ''}>${esc(p.name)} — ${esc(p.owner_name)}</option>`)
      .join('');
    patientField = `<div class="field"><label>Pasien <span class="req">*</span></label>
      <select name="patient_id" required><option value="">— pilih pasien —</option>${patientOpts}</select></div>`;
  }
  const body = `
    ${patientField}
    <div class="field"><label>Vaksin <span class="req">*</span></label>
      <input class="input" name="vaccine_name" list="dl-vaccines" required value="${esc(e.vaccine_name)}" placeholder="mis. Rabies" />
      <datalist id="dl-vaccines">${VACCINES.map((v) => `<option>${v}</option>`).join('')}</datalist></div>
    <div class="form-row">
      <div class="field"><label>Tgl Pemberian <span class="req">*</span></label><input class="input" type="date" name="given_date" required value="${esc(e.given_date) || hariIniISO()}" /></div>
      <div class="field"><label>Jadwal Berikutnya</label><input class="input" type="date" name="next_due_date" value="${esc(e.next_due_date)}" /></div>
    </div>
    <div class="form-row">
      <div class="field"><label>No. Batch</label><input class="input" name="batch_no" value="${esc(e.batch_no)}" /></div>
      <div class="field"><label>Dokter</label><input class="input" name="vet_name" value="${esc(e.vet_name || store.settings.clinic_vet || '')}" /></div>
    </div>
    <div class="field"><label>Catatan</label><textarea name="notes">${esc(e.notes)}</textarea></div>`;
  openModal(wrap(e.id ? 'Edit Vaksinasi' : 'Catat Vaksinasi', body), {
    onMount(card) {
      onSubmit(card, async (data) => {
        const saved = e.id ? await api.put(`/api/vaccinations/${e.id}`, data) : await api.post('/api/vaccinations', data);
        closeModal();
        toast(e.id ? 'Data vaksinasi diperbarui.' : 'Vaksinasi dicatat.');
        onSaved && onSaved(saved);
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Pengguna (manajemen akun & peran)
// ---------------------------------------------------------------------------
const USER_ROLES = [
  ['resepsionis', 'Resepsionis'],
  ['dokter', 'Dokter'],
  ['admin', 'Admin'],
];

export function userForm(existing, onSaved) {
  const e = existing || {};
  const isEdit = !!e.id;
  const roleOpts = USER_ROLES.map(
    ([v, l]) => `<option value="${v}" ${v === (e.role || 'resepsionis') ? 'selected' : ''}>${l}</option>`
  ).join('');
  const body = `
    <div class="form-row">
      <div class="field"><label>Username <span class="req">*</span></label>
        <input class="input" name="username" required value="${esc(e.username)}" ${isEdit ? 'disabled' : ''} placeholder="mis. budi" autocomplete="off" /></div>
      <div class="field"><label>Nama Lengkap <span class="req">*</span></label>
        <input class="input" name="name" required value="${esc(e.name)}" placeholder="mis. drh. Budi" /></div>
    </div>
    <div class="field"><label>Peran <span class="req">*</span></label>
      <select name="role">${roleOpts}</select>
      <div class="hint">Admin: akses penuh + kelola pengguna & pengaturan. Dokter: klinis (rekam medis, vaksinasi, asisten). Resepsionis: pendaftaran, janji, tagihan, komunikasi.</div></div>
    ${
      isEdit
        ? `<div class="field"><label class="check"><input type="checkbox" name="active" ${e.active ? 'checked' : ''} /> Akun aktif</label></div>`
        : `<div class="field"><label>Sandi Awal <span class="req">*</span></label>
            <input class="input" type="text" name="password" required minlength="6" placeholder="minimal 6 karakter" autocomplete="new-password" />
            <div class="hint">Beri tahu pengguna sandi ini — mereka bisa menggantinya setelah masuk.</div></div>`
    }`;
  openModal(wrap(isEdit ? 'Edit Pengguna' : 'Tambah Pengguna', body), {
    onMount(card) {
      onSubmit(card, async (data) => {
        const saved = isEdit
          ? await api.put(`/api/users/${e.id}`, { name: data.name, role: data.role, active: data.active })
          : await api.post('/api/users', {
              username: data.username,
              name: data.name,
              role: data.role,
              password: data.password,
            });
        closeModal();
        toast(isEdit ? 'Data pengguna diperbarui.' : 'Pengguna ditambahkan.');
        onSaved && onSaved(saved);
      });
    },
  });
}

export function resetPasswordForm(user, onSaved) {
  const body = `
    <p style="margin:0 0 12px">Setel sandi baru untuk <b>${esc(user.name || user.username)}</b>. Pengguna akan diminta menggantinya saat login berikutnya.</p>
    <div class="field"><label>Sandi Baru <span class="req">*</span></label>
      <input class="input" type="text" name="new_password" required minlength="6" placeholder="minimal 6 karakter" autocomplete="new-password" /></div>`;
  openModal(wrap('Reset Sandi', body, 'Simpan Sandi'), {
    onMount(card) {
      onSubmit(card, async (data) => {
        await api.put(`/api/users/${user.id}/password`, { new_password: data.new_password });
        closeModal();
        toast('Sandi pengguna direset.');
        onSaved && onSaved();
      });
    },
  });
}

// Ganti sandi milik sendiri. force=true → modal tak bisa ditutup (untuk sandi bawaan).
export function changePasswordForm(onSaved, { force = false } = {}) {
  const bodyInner = `
    ${force ? '<div class="alert alert-warn">Demi keamanan, Anda wajib mengganti sandi bawaan sebelum melanjutkan.</div>' : ''}
    <div class="field"><label>Sandi Saat Ini <span class="req">*</span></label>
      <input class="input" type="password" name="current_password" required autocomplete="current-password" /></div>
    <div class="field"><label>Sandi Baru <span class="req">*</span></label>
      <input class="input" type="password" name="new_password" required minlength="6" placeholder="minimal 6 karakter" autocomplete="new-password" /></div>
    <div class="field"><label>Ulangi Sandi Baru <span class="req">*</span></label>
      <input class="input" type="password" name="confirm" required autocomplete="new-password" /></div>`;
  const head = force
    ? `<div class="modal-head"><h3>Ganti Sandi</h3></div>`
    : `<div class="modal-head"><h3>Ganti Sandi</h3><button class="x" data-close>&times;</button></div>`;
  const foot = force
    ? `<div class="modal-foot"><button type="submit" class="btn btn-primary">Simpan Sandi</button></div>`
    : `<div class="modal-foot"><button type="button" class="btn btn-ghost" data-close>Batal</button><button type="submit" class="btn btn-primary">Simpan Sandi</button></div>`;
  const html = `${head}<form><div class="modal-body">${bodyInner}</div>${foot}</form>`;
  openModal(html, {
    dismissable: !force,
    onMount(card) {
      onSubmit(card, async (data) => {
        if (data.new_password !== data.confirm) throw new Error('Konfirmasi sandi tidak cocok.');
        await api.post('/api/auth/change-password', {
          current_password: data.current_password,
          new_password: data.new_password,
        });
        closeModal();
        toast('Sandi berhasil diganti.');
        onSaved && onSaved();
      });
    },
  });
}
