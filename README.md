# Landing Page Penjualan Produk Digital (Frontend)

Halaman penjualan + dashboard pemilik. Statis (HTML/CSS/JS), siap dipasang di **GitHub Pages**.
Backend & database: Google Apps Script + Google Sheets (berkas `.gs` terpisah).

## Isi
- `index.html` — halaman penjualan
- `admin.html` — dashboard pemilik (leads, CRM, WhatsApp, pengaturan, migrasi)
- `css/` , `js/` — gaya & logika
- `js/config.js` — **satu-satunya** yang perlu Anda isi: `GAS_URL`

## Mulai cepat
1. Pasang backend (lihat `PANDUAN-INSTALASI.md`), salin URL `/exec`.
2. Isi `GAS_URL` di `js/config.js`.
3. `git init` → `git add .` → `git commit` → push ke GitHub → aktifkan Pages (branch `main`, folder root).

Jangan menaruh token, kata sandi, atau kunci API apa pun di repository ini.
