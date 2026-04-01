// Ganti URL ini dengan URL Web App dari Google Script Anda!
const API_URL = "https://script.google.com/macros/s/AKfycbyjDAdWZU3vOC7OYeATq3w_UGe30nGp5K7f00HiN6cWzAQCgZD90lSIie7joKdTymB49A/exec";
let currentUser = null;
let logoutTimer = null;

// ===================================
// 1. JAM & TANGGAL REALTIME
// ===================================
setInterval(() => {
    let now = new Date();
    let opt = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second:'2-digit' };
    let jamEl = document.getElementById('jam-tanggal');
    if(jamEl) jamEl.innerText = now.toLocaleDateString('id-ID', opt);
}, 1000);

// ===================================
// 2. SISTEM LOGIN & AUTO-LOGOUT 20 JAM
// ===================================
async function prosesLogin() {
    let u = document.getElementById('log-user').value;
    let p = document.getElementById('log-pass').value;
    if(!u || !p) return alert("Isi username & password!");

    // Simulasi Call API (Ganti dgn fetch sungguhan)
    let res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'login', username: u, password: p }) }).then(r=>r.json());
    
    if(res.success) {
        currentUser = { username: res.username, role: res.role, loginTime: Date.now() };
        localStorage.setItem("session_pinjam", JSON.stringify(currentUser));
        
        setupDashboard();
    } else {
        alert(res.msg);
    }
}

function cekSesiMasaAktif() {
    let data = localStorage.getItem("session_pinjam");
    if(data) {
        let sesi = JSON.parse(data);
        let umurSesi = Date.now() - sesi.loginTime;
        const BATAS_WAKTU = 20 * 60 * 60 * 1000; // 20 Jam dalam milidetik
        
        if (umurSesi >= BATAS_WAKTU) {
            prosesLogout(false); // Logout otomatis karena waktu habis
        } else {
            currentUser = sesi;
            setupDashboard();
            // Set timer sisa waktu untuk auto-logout
            logoutTimer = setTimeout(() => { prosesLogout(false); }, BATAS_WAKTU - umurSesi);
        }
    }
}

function prosesLogout(manual = true) {
    localStorage.removeItem("session_pinjam");
    clearTimeout(logoutTimer);
    currentUser = null;
    document.getElementById('dashboard-layer').style.display = 'none';
    document.getElementById('login-layer').style.display = 'flex';
    if(!manual) alert("Sesi login berakhir otomatis (20 Jam). Silakan login kembali.");
}

// Panggil saat aplikasi baru dibuka
cekSesiMasaAktif();

function setupDashboard() {
    document.getElementById('login-layer').style.display = 'none';
    document.getElementById('dashboard-layer').style.display = 'block';
    document.getElementById('welcome-text').innerText = `Halo, ${currentUser.username} (${currentUser.role})`;

    if(currentUser.role === "Admin" || currentUser.role === "SuperAdmin") {
        document.getElementById('admin-panel').style.display = 'block';
        if(currentUser.role === "SuperAdmin") document.getElementById('btn-add-staff').style.display = 'block';
        loadAdminStats();
    }
}

// ===================================
// 3. LOGIKA BUNGA, TENOR & KOMISI
// ===================================
let hitungCache = null;

function hitungSistem() {
    let nominal = parseInt(document.getElementById('input-nominal').value);
    if(!nominal) return;

    let bunga = 0;
    let tenorHari = (nominal <= 300000) ? 7 : 14; 
    
    if (nominal === 100000) bunga = 30000;
    else if (nominal === 200000) bunga = 60000;
    else if (nominal === 300000) bunga = 90000;
    else if (nominal === 400000) bunga = 120000;
    else if (nominal >= 500000 && nominal <= 700000) bunga = 150000;
    else if (nominal >= 800000 && nominal <= 1000000) bunga = 200000;

    let komisi = bunga * 0.10;
    let total = nominal + bunga;

    hitungCache = { nominal, bunga, total, tenorHari, komisi };

    document.getElementById('out-bunga').innerText = `Rp ${bunga.toLocaleString()}`;
    document.getElementById('out-tenor').innerText = `${tenorHari} Hari`;
    document.getElementById('out-total').innerText = `Rp ${total.toLocaleString()}`;
    document.getElementById('out-komisi').innerText = `Rp ${komisi.toLocaleString()}`;
    document.getElementById('preview-hitungan').style.display = 'block';
}

async function submitPinjaman() {
    let hp = document.getElementById('input-hp').value;
    let nama = document.getElementById('input-nama').value;
    if(!hp || !hitungCache) return alert("Lengkapi data No HP dan Nominal!");

    let tgl = new Date();
    let formatTgl = tgl.toISOString().split('T')[0].replace(/-/g, '');
    let idPinjaman = `LN-${formatTgl}-${hp}`; // Sesuai format ID
    
    let jatuhTempo = new Date();
    jatuhTempo.setDate(jatuhTempo.getDate() + hitungCache.tenorHari);

    let payload = {
        ID_Pinjaman: idPinjaman,
        Tgl: tgl.toISOString(),
        Customer: nama,
        No_HP: hp,
        Nominal: hitungCache.nominal,
        Bunga: hitungCache.bunga,
        Total_Tagihan: hitungCache.total,
        Tenor_Hari: hitungCache.tenorHari,
        Jatuh_Tempo: jatuhTempo.toISOString(),
        Status: "AKTIF",
        Staff: currentUser.username,
        Komisi_Staff: hitungCache.komisi
    };

    let res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'savePinjaman', payload: payload }) }).then(r=>r.json());
    if(res.success) {
        alert("Pinjaman berhasil disimpan!");
        document.getElementById('input-hp').value = "";
        document.getElementById('input-nominal').value = "";
        document.getElementById('preview-hitungan').style.display = 'none';
    }
}

// ===================================
// 4. REQUEST EDIT (LOGIKA 1 JAM)
// ===================================
async function requestEditData(idPinjaman, dataLama, dataBaru) {
    // Fungsi ini akan dipanggil jika staff mengedit data dari riwayat
    let payload = { ID_Pinjaman: idPinjaman, User: currentUser.username, Data_Lama: dataLama, Data_Baru: dataBaru };
    let res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'requestEdit', payload: payload }) }).then(r=>r.json());
    alert(res.msg); // Akan memberikan alert "Berhasil" jika < 1 Jam, atau "Masuk Antrian" jika > 1 jam
}

async function loadAdminStats() {
    let res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'getAdminStats' }) }).then(r=>r.json());
    if(res.success) {
        document.getElementById('admin-modal').innerText = `Rp ${res.modal.toLocaleString()}`;
        document.getElementById('admin-untung').innerText = `Rp ${res.untung.toLocaleString()}`;
    }
}
