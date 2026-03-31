const API_URL = "URL_GOOGLE_APPS_SCRIPT_WEB_APP_KAMU_DISINI"; 
let currentUser = null;
let sessionToken = "";

function switchView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(viewId).classList.add('active');
  window.scrollTo(0,0);
}

// FORMAT RUPIAH
function formatRp(angka) {
  return "Rp " + parseInt(angka).toLocaleString('id-ID');
}

// LOGIN
async function doLogin() {
  const user = document.getElementById('username').value;
  const pass = document.getElementById('password').value;
  if(!user || !pass) return alert('Isi Username & Password!');
  
  let res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: "login", username: user, password: pass }) }).then(r => r.json());
  
  if(res.success) {
    currentUser = res.data;
    sessionToken = res.token;
    document.getElementById('user-name').innerText = currentUser.name;
    switchView('dashboard-view');
  } else {
    alert(res.message);
  }
}

function doLogout() {
  fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: "doLogout", username: currentUser.username, token: sessionToken }) });
  currentUser = null; sessionToken = "";
  switchView('login-view');
}

// LOGIKA FORM PENGAJUAN
function updateFormLogic() {
  let kategori = document.getElementById('kategori').value;
  let nominal = parseInt(document.getElementById('nominal').value);
  let tempoSelect = document.getElementById('tempo');
  let komisiText = document.getElementById('komisi-text');

  tempoSelect.innerHTML = '<option value="1 Minggu">1 Minggu</option>';
  if (kategori === "Pinjaman Uang" && nominal >= 400000) {
    tempoSelect.innerHTML += '<option value="2 Minggu">2 Minggu</option>';
  }

  let komisi = 0;
  if (kategori === "Pinjaman Uang") {
      komisi = (nominal / 100000) * 30000; 
  } else if (kategori === "Beli Baju Cicil") {
      komisi = (nominal * 0.15); // Misal cicil baju kena 15%
  }

  komisiText.innerText = formatRp(komisi);
  komisiText.dataset.val = komisi;
}

async function submitPengajuan() {
  let btn = document.getElementById('btn-submit');
  let payload = {
    namaPeminjam: document.getElementById('nama-peminjam').value.trim(),
    noHp: document.getElementById('no-hp').value.trim(),
    kategori: document.getElementById('kategori').value,
    nominal: document.getElementById('nominal').value,
    tempo: document.getElementById('tempo').value,
    komisi: document.getElementById('komisi-text').dataset.val,
  };

  if(!payload.namaPeminjam || !payload.noHp) return alert("Nama dan No HP Wajib diisi!");

  btn.disabled = true; btn.innerText = "Menyimpan...";

  let date = new Date();
  date.setDate(date.getDate() + (payload.tempo === "1 Minggu" ? 7 : 14));
  payload.jatuhTempo = date.toISOString();

  let res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: "submitPengajuan", username: currentUser.username, token: sessionToken, payload: payload }) }).then(r => r.json());

  if(res.success) {
    alert("Data Tersimpan!");
    document.getElementById('nama-peminjam').value = ''; document.getElementById('no-hp').value = '';
    switchView('dashboard-view');
  } else { alert("Gagal: " + res.message); }
  
  btn.disabled = false; btn.innerText = "Simpan Data";
}

// LOAD TAGIHAN AKTIF (PEMBAYARAN)
async function loadTagihan() {
  let list = document.getElementById('list-tagihan');
  list.innerHTML = "<div style='text-align:center; padding:20px;'>Memuat Data...</div>";

  let res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: "getTagihan", username: currentUser.username, token: sessionToken }) }).then(r => r.json());

  if(res.success) {
    list.innerHTML = "";
    if(res.data.length === 0) return list.innerHTML = "<div style='text-align:center; padding:20px; color:gray;'>Tidak ada tagihan aktif.</div>";

    res.data.forEach(item => {
      let jt = new Date(item.jatuhTempo);
      let diffDays = Math.ceil((jt - new Date()) / (1000 * 60 * 60 * 24));
      
      let badgeHtml = `<span class="badge-status badge-lancar">Aman (${diffDays} Hari)</span>`;
      if (diffDays <= 2 && diffDays >= 0) badgeHtml = `<span class="badge-status badge-warning">⚠️ ${diffDays} Hari Lagi</span>`;
      else if (diffDays < 0) badgeHtml = `<span class="badge-status badge-terlambat">🚨 TERLAMBAT DENDA</span>`;

      list.innerHTML += `
        <div class="list-card">
          <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
             <span style="font-size:12px; font-weight:800; color:gray;">${item.kodePelanggan}</span>
             ${badgeHtml}
          </div>
          <div style="font-weight: 800; font-size: 16px;">${item.namaPeminjam}</div>
          <div style="font-size: 12px; color: var(--text-main); font-weight:600; margin-bottom:12px;">📞 ${item.noHp}</div>
          
          <div style="background: rgba(0,0,0,0.03); padding:10px; border-radius:10px; font-size:13px; display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
             <div><b>${item.kategori}</b><br><span style="color:var(--primary); font-weight:800;">${formatRp(item.nominal)}</span></div>
             <div style="text-align:right;">Tempo: ${item.tempo}<br><span style="color:var(--danger); font-weight:800;">+ ${formatRp(item.komisi)}</span></div>
          </div>
          
          <button class="btn-primary" style="padding: 12px; font-size: 14px;" onclick="bayar('${item.id}')">💰 Tandai Lunas</button>
        </div>
      `;
    });
  }
}

async function bayar(id) {
  if(!confirm("Yakin pelanggan ini sudah membayar lunas?")) return;
  let res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: "bayarTagihan", username: currentUser.username, token: sessionToken, payload: {id: id} }) }).then(r => r.json());
  if(res.success) { alert("Lunas!"); loadTagihan(); }
}

// LOAD DATA PELANGGAN (RIWAYAT & SKOR KREDIT)
async function loadPelanggan() {
  let list = document.getElementById('list-pelanggan');
  list.innerHTML = "<div style='text-align:center; padding:20px;'>Menganalisis Riwayat...</div>";

  let res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: "getPelanggan", username: currentUser.username, token: sessionToken }) }).then(r => r.json());

  if(res.success) {
    list.innerHTML = "";
    res.data.forEach(p => {
      let skorBadge = p.statusLancar 
          ? `<span class="badge-status badge-lancar">🟢 Skor Kredit: BAIK</span>` 
          : `<span class="badge-status badge-terlambat">🔴 Skor Kredit: BURUK (Pernah Telat)</span>`;
      
      let riwayatHtml = p.riwayat.map(r => `
         <div style="font-size:11px; display:flex; justify-content:space-between; border-bottom:1px dashed #ccc; padding:4px 0;">
            <span>${r.kategori}</span>
            <b style="color:${r.status === 'LUNAS' ? 'green' : 'red'}">${r.status}</b>
         </div>
      `).join('');

      list.innerHTML += `
        <div class="list-card">
          <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
             <span style="font-size:12px; font-weight:800; color:var(--primary);">${p.kode}</span>
             ${skorBadge}
          </div>
          <div style="font-weight: 800; font-size: 16px;">${p.nama}</div>
          <div style="font-size: 12px; color: gray; font-weight:600; margin-bottom:12px;">📞 ${p.noHp}</div>
          
          <div style="font-size: 12px; font-weight: 700; margin-bottom: 8px;">Total Putaran Pinjaman: ${formatRp(p.totalPinjaman)}</div>
          
          <details style="background:rgba(0,0,0,0.03); padding:8px; border-radius:8px;">
             <summary style="font-size:12px; font-weight:800; cursor:pointer; outline:none;">Lihat Semua Riwayat</summary>
             <div style="margin-top:8px;">${riwayatHtml}</div>
          </details>
        </div>
      `;
    });
  }
}
