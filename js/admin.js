/* ============================================================
 * admin.js — Dashboard pemilik
 * Token sesi disimpan di sessionStorage (hilang saat tab ditutup). Tidak ada rahasia di file ini.
 * ============================================================ */
(function () {
  'use strict';
  var UI_VERSION = '1.1', API_MIN = '1.1.0';
  window.__UI_VERSION = UI_VERSION;                                   // dibaca pemeriksa versi di admin.html
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var S = { tok: '', me: null, view: 'ringkasan', waTab: 'blast', poll: 0, aud: null, leads: null, crm: null };
  try { S.tok = sessionStorage.getItem('nd_tok') || ''; } catch (e) {}
  var TITLES = { ringkasan: 'Ringkasan & Data Leads', leads: 'Data Leads', crm: 'CRM Kontak', produk: 'Produk & Video', wa: 'WhatsApp & Notifikasi', pengaturan: 'Pengaturan Konten', migrasi: 'Migrasi Data' };
  var STATUS = ['Baru Masuk', 'Menunggu', 'Followed Up', 'Closing', 'Batal'], STC = { 'Baru Masuk': 'p', 'Menunggu': 'y', 'Followed Up': 'g', 'Closing': 's', 'Batal': 'r' };
  var COL = ['#1F2D3A', '#E8805E', '#9DC3B0', '#8DB6D6', '#F2B79F'];
  var view = $('#view');

  /* ---------- util ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function rp(n) { return 'Rp ' + (Number(n) || 0).toLocaleString('id-ID'); }
  function num(n) { return (Number(n) || 0).toLocaleString('id-ID'); }
  function tgl(iso) { if (!iso) return '-'; var d = new Date(iso); return isNaN(d) ? esc(iso) : d.toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  function wa62(v) { var s = String(v || '').replace(/\D/g, ''); return s[0] === '0' ? '62' + s.slice(1) : s; }
  var tt; function toast(m, bad) { var t = $('#toast'); t.textContent = m; t.className = 'toast show' + (bad ? ' bad' : ''); clearTimeout(tt); tt = setTimeout(function () { t.className = 'toast'; }, 3600); }
  function busy(b, on, txt) { if (!b) return; if (on) { b.dataset.t = b.innerHTML; b.disabled = true; if (txt) b.textContent = txt; } else { b.disabled = false; if (b.dataset.t) b.innerHTML = b.dataset.t; } }
  function skel(n) { var h = ''; for (var i = 0; i < (n || 4); i++) h += '<div class="skel" style="width:' + (60 + (i * 13) % 40) + '%"></div>'; return '<div class="card">' + h + '</div>'; }
  function verCmp(a, b) { var x = String(a || '0').split('.').map(Number), y = String(b || '0').split('.').map(Number); for (var i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) < (y[i] || 0) ? -1 : 1; } return 0; }
  function showVer(v) { var el = $('#verInfo'); if (!el || !v) return; var lama = verCmp(v, API_MIN) < 0; el.innerHTML = 'Tampilan v' + UI_VERSION + ' · Server v' + esc(v) + (lama ? '<br><b>Server lama — perbarui Kode.gs &amp; Deploy versi baru</b>' : ''); }
  function api(a, d) {
    return Api.post(a, d, S.tok).then(function (r) {
      if (r && r.v) showVer(r.v);
      if (r && r.code === 'AUTH' && S.me) logout('Sesi berakhir, silakan masuk lagi.');
      if (r && r.code === 'FORBIDDEN') toast(r.message, true);
      if (r && r.message === 'Aksi tidak dikenal.') r.message = 'Server Apps Script belum diperbarui (versi ' + (r.v || 'lama') + ', dibutuhkan ≥ ' + API_MIN + '). Tempel kode terbaru (termasuk Katalog.gs), jalankan setupAppEnvironment, lalu Deploy → Manage deployments → New version.';
      return r;
    });
  }
  function fail(r) { view.innerHTML = '<div class="card"><div class="err">' + esc((r && r.message) || 'Gagal memuat data.') + '</div></div>'; }
  function pager(total, hal, per, key) {
    var pages = Math.max(1, Math.ceil(total / per)), b = '', from = Math.max(1, hal - 2), to = Math.min(pages, from + 4); from = Math.max(1, to - 4);
    b += '<button data-pg="' + key + ':' + (hal - 1) + '" ' + (hal <= 1 ? 'disabled' : '') + ' aria-label="Sebelumnya">‹</button>';
    for (var i = from; i <= to; i++) b += '<button data-pg="' + key + ':' + i + '" class="' + (i === hal ? 'on' : '') + '">' + i + '</button>';
    b += '<button data-pg="' + key + ':' + (hal + 1) + '" ' + (hal >= pages ? 'disabled' : '') + ' aria-label="Berikutnya">›</button>';
    var a = total ? (hal - 1) * per + 1 : 0, z = Math.min(total, hal * per);
    return '<div class="pager"><span>Menampilkan ' + a + '–' + z + ' dari ' + num(total) + '</span><div>' + b + '</div></div>';
  }
  function debounce(f, ms) { var t; return function () { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { f.apply(c, a); }, ms || 350); }; }
  function loadScript(src) { return new Promise(function (ok, no) { var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); }); }
  function download(name, text, type) { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/plain' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
  function csvCell(v) { v = String(v == null ? '' : v); if (/^[=+\-@]/.test(v)) v = "'" + v; return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function toCSV(rows) { if (!rows.length) return ''; var h = Object.keys(rows[0]); return '\ufeff' + [h.join(',')].concat(rows.map(function (r) { return h.map(function (k) { return csvCell(r[k]); }).join(','); })).join('\n'); }
  function exportRows(rows, name, fmt) {
    if (!rows.length) return toast('Tidak ada data untuk diekspor.', true);
    if (fmt === 'pdf') {
      var w = window.open('', '_blank'); if (!w) return toast('Izinkan pop-up untuk membuat PDF, atau gunakan Excel.', true);
      var h = Object.keys(rows[0]);
      w.document.write('<!doctype html><meta charset="utf-8"><title>' + esc(name) + '</title><style>body{font:12px Arial;margin:24px}h1{font-size:16px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:5px 7px;text-align:left}th{background:#eee}</style><h1>' + esc(name) + ' — ' + new Date().toLocaleDateString('id-ID') + '</h1><table><tr>' + h.map(function (k) { return '<th>' + esc(k) + '</th>'; }).join('') + '</tr>' + rows.map(function (r) { return '<tr>' + h.map(function (k) { return '<td>' + esc(r[k]) + '</td>'; }).join('') + '</tr>'; }).join('') + '</table>');
      w.document.close(); w.focus(); setTimeout(function () { w.print(); }, 400); return;
    }
    loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js').then(function () {
      var wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Data'); XLSX.writeFile(wb, name + '.xlsx');
    }).catch(function () { download(name + '.csv', toCSV(rows), 'text/csv'); toast('Pustaka Excel tidak termuat — diunduh sebagai CSV (bisa dibuka di Excel).'); });
  }

  /* ---------- autentikasi ---------- */
  function showLogin(msg) {
    $('#app').hidden = true; $('#login').hidden = false; document.title = 'Masuk — Dashboard Pemilik';
    var i = $('#loginInfo'); i.hidden = !msg; i.textContent = msg || '';
  }
  function enter(me) {
    S.me = me; $('#login').hidden = true; $('#app').hidden = false;
    $('#whoName').textContent = me.nama || me.email; $('#whoRole').textContent = (me.role === 'owner' ? 'Pemilik' : 'Admin') + (me.darurat ? ' · akses darurat' : '');
    $$('[data-owner]').forEach(function (b) { b.hidden = me.role !== 'owner'; });
    go('ringkasan');
  }
  function logout(msg) { try { sessionStorage.removeItem('nd_tok'); } catch (e) {} S.tok = ''; S.me = null; clearInterval(S.poll); showLogin(msg || ''); initLogin(); }
  function setToken(t) { S.tok = t; try { sessionStorage.setItem('nd_tok', t); } catch (e) {} }
  function onGoogle(resp) { api('auth.google', { credential: resp.credential }).then(function (r) { if (r.success) { setToken(r.data.token); enter(r.data.me); } else showLogin(r.message); }); }
  function initLogin() {
    if (S.loginInit) return; S.loginInit = true;
    if (!Api.configured) { showLogin('Konfigurasi belum lengkap: isi GAS_URL di js/config.js'); return; }
    var dar = location.hash === '#darurat';
    Api.get('auth.config').then(function (r) {
      var cid = r.success && r.data.googleClientId;
      if (cid) {
        loadScript('https://accounts.google.com/gsi/client').then(function () { google.accounts.id.initialize({ client_id: cid, callback: onGoogle }); google.accounts.id.renderButton($('#gbtn'), { theme: 'outline', size: 'large', shape: 'pill', width: 320 }); })
          .catch(function () { $('#darForm').hidden = false; showLogin('Google Sign-In tidak dapat dimuat. Gunakan akses darurat.'); });
      } else { $('#darForm').hidden = false; showLogin(r.success ? 'Login Google belum diaktifkan. Masuk dengan akses darurat, lalu isi Google Client ID di Pengaturan → Keamanan.' : r.message); }
      if (dar) $('#darForm').hidden = false;
    });
    $('#darForm').addEventListener('submit', function (e) {
      e.preventDefault(); var b = $('button', this); busy(b, true, 'Memeriksa…');
      api('auth.darurat', { username: $('#darUser').value.trim(), password: $('#darPass').value }).then(function (r) { busy(b, false); $('#darPass').value = ''; if (r.success) { setToken(r.data.token); enter(r.data.me); } else showLogin(r.message); });
    });
  }

  /* ---------- router ---------- */
  function go(v) {
    clearInterval(S.poll); S.view = v; $$('.side nav button').forEach(function (b) { b.classList.toggle('on', b.dataset.go === v); });
    $('#pageTitle').textContent = TITLES[v]; $('#side').classList.remove('open'); $('#scrim').hidden = true; $('#cacheInfo').hidden = true; window.scrollTo(0, 0);
    if (!V[v]) { view.innerHTML = '<div class="card"><div class="err"><b>Menu "' + esc(TITLES[v] || v) + '" belum tersedia di berkas <code>js/admin.js</code> yang sedang dimuat browser</b> (berkas lama).<br>Tekan <b>Ctrl+Shift+R</b> (Mac: Cmd+Shift+R). Jika tetap sama, pastikan <code>js/admin.js</code> versi ' + UI_VERSION + ' sudah di-push ke GitHub dan tunggu 1–2 menit.</div></div>'; return; }
    view.innerHTML = skel(5); V[v]();
  }

  var V = {};
  /* ======================= RINGKASAN ======================= */
  function delta(a, b, lbl) { if (!b) return a ? '<span class="d up">▲ ' + a + ' baru</span>' : '<span class="d flat">belum ada data</span>'; var p = Math.round((a - b) * 100 / b); return '<span class="d ' + (p > 0 ? 'up' : p < 0 ? 'down' : 'flat') + '">' + (p > 0 ? '▲ +' : p < 0 ? '▼ ' : '• ') + p + '% <span class="muted" style="font-weight:500">' + lbl + '</span></span>'; }
  V.ringkasan = function () {
    api('dash.summary', {}).then(function (r) {
      if (!r.success) return fail(r); var d = r.data, max = Math.max.apply(null, d.tren.map(function (x) { return x.jumlah; }).concat(1));
      var ci = $('#cacheInfo'); ci.hidden = false; ci.textContent = r.cached ? '● Cache aktif' : '● Data segar';
      var cnt = $('#cntLeads'); cnt.hidden = !d.hariIni; cnt.textContent = d.hariIni;
      var acc = 0, seg = d.sumber.map(function (s, i) { var a = acc; acc += s.persen; return COL[i % 5] + ' ' + a + '% ' + acc + '%'; });
      view.innerHTML = '<div class="stats">'
        + '<div class="stat"><span class="l">Lead Hari Ini</span><b>' + num(d.hariIni) + '</b>' + delta(d.hariIni, d.kemarin, 'vs kemarin') + '</div>'
        + '<div class="stat"><span class="l">Lead 7 Hari</span><b>' + num(d.minggu) + '</b>' + delta(d.minggu, d.mingguLalu, 'vs minggu lalu') + '</div>'
        + '<div class="stat"><span class="l">Total Klik Beli</span><b>' + num(d.beli) + '</b><span class="d flat">' + num(d.wa) + ' klik WhatsApp · ' + d.rasioForm + '% isi nomor</span></div>'
        + '<div class="stat"><span class="l">Estimasi Omset Lead</span><b>' + rp(d.estimasiOmset) + '</b><span class="d flat">' + num(d.pending) + ' lead beli menunggu follow-up</span></div></div>'
        + '<div class="two"><div class="card"><div class="card-h"><div><h2>Tren Lead per Hari</h2><p class="sub">Pergerakan 7 hari terakhir</p></div></div><div class="bars">' + d.tren.map(function (x) { return '<div class="bar" title="' + x.jumlah + ' lead"><b>' + x.jumlah + '</b><i class="' + (x.hariIni ? 't' : '') + '" style="height:' + Math.max(3, x.jumlah / max * 100) + '%"></i><span>' + esc(x.label) + '</span></div>'; }).join('') + '</div></div>'
        + '<div class="card"><div class="card-h"><div><h2>Sumber Traffic</h2><p class="sub">Atribusi UTM</p></div></div>' + (d.total ? '<div class="donut-w"><div class="donut" style="background:conic-gradient(' + seg.join(',') + ')"><div><b>' + num(d.total) + '</b><small>TOTAL</small></div></div><ul class="legend">' + d.sumber.map(function (s, i) { return '<li><i style="background:' + COL[i % 5] + '"></i>' + esc(s.nama) + '<b>' + s.persen + '%</b></li>'; }).join('') + '</ul></div>' : '<div class="empty"><b>Belum ada data</b>Bagikan link halaman penjualan Anda.</div>') + '</div></div>'
        + '<div class="card"><div class="card-h"><div><h2>Lead Terbaru</h2><p class="sub">Total ' + num(d.total) + ' calon pembeli tercatat</p></div><button class="btn btn-soft btn-sm" data-go-view="leads">Lihat semua →</button></div>' + leadTable(d.terbaru, false) + '</div>';
    });
  };
  function leadTable(rows, sel) {
    if (!rows.length) return '<div class="empty"><b>Belum ada lead</b>Setiap klik tombol beli/WhatsApp akan tercatat di sini.</div>';
    return '<div class="twrap"><table><thead><tr>' + (sel ? '<th><input type="checkbox" data-selall aria-label="Pilih semua"></th>' : '') + '<th>Waktu</th><th>Nama</th><th>WhatsApp</th><th>Sumber</th><th>Tombol</th><th>Status</th><th></th></tr></thead><tbody>' + rows.map(function (l) {
      return '<tr>' + (sel ? '<td><input type="checkbox" data-sel="' + l.id + '"' + (S.leads && S.leads.sel[l.id] ? ' checked' : '') + '></td>' : '') + '<td class="nowrap">' + tgl(l.waktu) + '</td><td><b>' + esc(l.nama || '—') + '</b><small>' + esc(l.lokasi || '') + (l.produk ? ' · ' + esc(l.produk) : '') + '</small></td><td class="nowrap">' + esc(l.wa || '—') + (l.statusWA ? '<small>' + (l.statusWA === 'Terdaftar' ? '✓ WA aktif' : '✗ tidak di WA') + '</small>' : '') + '</td><td><span class="badge s">' + esc(l.sumber || 'direct') + '</span></td>'
        + '<td><span class="badge ' + (l.tombol === 'Beli Sekarang' ? 'g' : 'b') + '">' + (l.tombol === 'Beli Sekarang' ? 'Beli Sekarang' : 'WhatsApp CS') + '</span></td>'
        + '<td>' + (sel ? '<select data-st="' + l.id + '" style="min-height:34px;width:auto;font-size:13px">' + STATUS.map(function (s) { return '<option' + (s === l.status ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select>' : '<span class="badge ' + (STC[l.status] || '') + '">' + esc(l.status) + '</span>') + '</td>'
        + '<td>' + (l.wa ? '<a class="btn btn-primary btn-sm" target="_blank" rel="noopener" href="https://wa.me/' + wa62(l.wa) + '">Chat WA</a>' : '') + '</td></tr>';
    }).join('') + '</tbody></table></div>';
  }

  /* ======================= DATA LEADS ======================= */
  V.leads = function () {
    S.leads = S.leads || { f: { halaman: 1, per: 10 }, sel: {} };
    view.innerHTML = '<div class="card"><div class="card-h"><div><h2>Data Lead</h2><p class="sub" id="ldSub">Memuat…</p></div><div class="row"><button class="btn btn-soft btn-sm" data-exp="xlsx">⬇ Excel (.xlsx)</button><button class="btn btn-soft btn-sm" data-exp="pdf">⬇ PDF</button></div></div>'
      + '<div class="tools"><input class="grow" id="ldQ" type="search" placeholder="Cari nama atau nomor WA…"><input id="ldA" type="date" aria-label="Dari tanggal"><input id="ldB" type="date" aria-label="Sampai tanggal"><select id="ldSum"><option value="">Semua sumber</option></select><select id="ldTb"><option value="">Semua tombol</option><option>Beli Sekarang</option><option>WhatsApp CS</option></select><select id="ldSt"><option value="">Semua status</option>' + STATUS.map(function (s) { return '<option>' + s + '</option>'; }).join('') + '</select><button class="btn btn-soft btn-sm" id="ldReset">↺ Reset</button></div>'
      + '<div id="ldBulk" class="bulk" hidden><b id="ldN"></b><select id="ldBulkSt">' + STATUS.map(function (s) { return '<option>' + s + '</option>'; }).join('') + '</select><button class="btn btn-primary btn-sm" id="ldApply">Terapkan status</button></div><div id="ldTbl">' + '<div class="skel"></div><div class="skel"></div><div class="skel"></div></div></div>';
    var f = S.leads.f; $('#ldQ').value = f.cari || ''; $('#ldA').value = f.dari || ''; $('#ldB').value = f.sampai || ''; $('#ldTb').value = f.tombol || ''; $('#ldSt').value = f.status || '';
    var rd = function () { S.leads.f = { cari: $('#ldQ').value, dari: $('#ldA').value, sampai: $('#ldB').value, sumber: $('#ldSum').value, tombol: $('#ldTb').value, status: $('#ldSt').value, halaman: 1, per: S.leads.f.per }; loadLeads(); };
    $('#ldQ').addEventListener('input', debounce(rd)); ['#ldA', '#ldB', '#ldSum', '#ldTb', '#ldSt'].forEach(function (i) { $(i).addEventListener('change', rd); });
    $('#ldReset').addEventListener('click', function () { S.leads.f = { halaman: 1, per: 10 }; S.leads.sel = {}; V.leads(); });
    loadLeads();
  };
  function loadLeads() {
    api('leads.list', S.leads.f).then(function (r) {
      if (!r.success) return ($('#ldTbl').innerHTML = '<div class="err">' + esc(r.message) + '</div>'); var d = r.data;
      var sel = $('#ldSum'), cur = S.leads.f.sumber || ''; sel.innerHTML = '<option value="">Semua sumber</option>' + d.sumber.map(function (s) { return '<option' + (s === cur ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('');
      $('#ldSub').textContent = num(d.total) + ' lead sesuai filter'; S.leads.rows = d.rows; S.leads.f.halaman = d.halaman;
      $('#ldTbl').innerHTML = leadTable(d.rows, true) + pager(d.total, d.halaman, d.per, 'leads'); updBulk();
    });
  }
  function updBulk() { var n = Object.keys(S.leads.sel).length; $('#ldBulk').hidden = !n; if (n) $('#ldN').textContent = n + ' dipilih'; }
  function exportLeads(fmt) {
    var w = null; toast('Menyiapkan data…');
    api('leads.export', S.leads.f).then(function (r) {
      if (!r.success) return toast(r.message, true);
      exportRows(r.data.rows.map(function (l) { return { Waktu: new Date(l.waktu).toLocaleString('id-ID'), Nama: l.nama, WhatsApp: l.wa, Tombol: l.tombol, Lokasi: l.lokasi, Produk: l.produk, Sumber: l.sumber, Medium: l.medium, Kampanye: l.kampanye, Status: l.status }; }), 'Data-Lead-' + new Date().toISOString().slice(0, 10), fmt);
    });
  }

  /* ======================= CRM ======================= */
  V.crm = function () {
    S.crm = S.crm || { f: { halaman: 1, per: 25 }, sel: {} };
    view.innerHTML = '<div class="stats six" id="crmKpi"></div><div class="card"><div class="card-h"><div><h2>CRM Kontak</h2><p class="sub" id="crSub">Memuat…</p></div><div class="row"><button class="btn btn-soft btn-sm" data-act="crmsync">⟳ Sinkron</button><button class="btn btn-soft btn-sm" data-act="crmimp">⬆ Import CSV</button><button class="btn btn-soft btn-sm" data-act="crmexp">⬇ Ekspor</button><input type="file" id="crFile" accept=".csv,text/csv" hidden></div></div>'
      + '<div class="tools"><input class="grow" id="crQ" type="search" placeholder="Cari nama, email, atau nomor…"><select id="crSeg"><option value="">Semua segmen</option></select><select id="crWa"><option value="">Semua status WA</option><option value="Terdaftar">Terdaftar WA</option><option value="Tidak Terdaftar">Tidak terdaftar</option><option value="belum">Belum dicek</option></select></div>'
      + '<div class="chips" style="margin-bottom:14px"><button class="chip" data-chip="duplikat">Duplikat</button><button class="chip" data-chip="masalah">Bermasalah</button><button class="chip" data-chip="optOut">Opt-out</button></div>'
      + '<div id="crBulk" class="bulk" hidden><b id="crN"></b><button class="btn btn-primary btn-sm" data-act="crtag">+ Tag</button><button class="btn btn-soft btn-sm" data-act="crwa">Cek WA</button><button class="btn btn-soft btn-sm" data-act="crout">Opt-out</button><button class="btn btn-soft btn-sm" data-act="crmerge">Gabungkan</button></div><div id="crTbl"><div class="skel"></div><div class="skel"></div></div></div>';
    var f = S.crm.f; $('#crQ').value = f.cari || '';
    var rd = function () { S.crm.f = Object.assign({}, S.crm.f, { cari: $('#crQ').value, segmen: $('#crSeg').value, statusWA: $('#crWa').value, halaman: 1 }); loadCrm(); };
    $('#crQ').addEventListener('input', debounce(rd)); $('#crSeg').addEventListener('change', rd); $('#crWa').addEventListener('change', rd);
    $('#crFile').addEventListener('change', importCsv);
    loadCrm().then(function () { return api('crm.stats', {}); }).then(function (r) { if (!r.success) return; var s = r.data; $('#crmKpi').innerHTML = [['Total Kontak', s.total], ['WA Valid', s.wa], ['Terdaftar WA', s.terdaftarWA], ['Belum Dicek', s.belumDicek], ['Opt-out', s.optOut], ['Duplikat', s.duplikat]].map(function (k) { return '<div class="stat"><span class="l">' + k[0] + '</span><b>' + num(k[1]) + '</b></div>'; }).join(''); });
  };
  function loadCrm() {
    return api('crm.list', S.crm.f).then(function (r) {
      if (!r.success) return ($('#crTbl').innerHTML = '<div class="err">' + esc(r.message) + '</div>'); var d = r.data;
      var sg = $('#crSeg'), cur = S.crm.f.segmen || ''; sg.innerHTML = '<option value="">Semua segmen</option>' + Object.keys(d.facet.segmen).map(function (s) { return '<option' + (s === cur ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('');
      $('#crWa').value = S.crm.f.statusWA || ''; $$('.chip').forEach(function (c) { c.classList.toggle('on', !!S.crm.f[c.dataset.chip]); });
      $('#crSub').textContent = num(d.total) + ' kontak' + (d.syncTerakhir ? ' · sinkron terakhir ' + tgl(d.syncTerakhir) : ''); S.crm.rows = d.rows;
      $('#crTbl').innerHTML = !d.rows.length ? '<div class="empty"><b>Belum ada kontak</b>Kontak terbentuk otomatis dari lead yang mengisi nomor WhatsApp, atau import CSV.</div>'
        : '<div class="twrap"><table><thead><tr><th><input type="checkbox" data-crall aria-label="Pilih semua"></th><th>Nama</th><th>WhatsApp</th><th>Email</th><th>Segmen / Tag</th><th>Status WA</th><th>Pesan</th><th></th></tr></thead><tbody>' + d.rows.map(function (k) {
          return '<tr><td><input type="checkbox" data-cr="' + k.id + '"' + (S.crm.sel[k.id] ? ' checked' : '') + '></td><td><b>' + esc(k.nama) + '</b>' + (k.optOut ? ' <span class="badge r">opt-out</span>' : '') + (k.dup ? ' <span class="badge y">duplikat</span>' : '') + '</td><td class="nowrap">' + esc(k.wa || '—') + '</td><td>' + esc(k.email || '—') + '</td><td><span class="badge s">' + esc(k.segmen) + '</span>' + (k.tag ? '<small>' + esc(k.tag) + '</small>' : '') + '</td><td>' + (k.statusWA === 'Terdaftar' ? '<span class="badge g">Terdaftar</span>' : k.statusWA ? '<span class="badge r">Tidak terdaftar</span>' : '<span class="badge">belum dicek</span>') + '</td><td>' + num(k.jumlahPesan) + '</td><td><button class="btn btn-soft btn-sm" data-det="' + k.id + '">Detail</button></td></tr>';
        }).join('') + '</tbody></table></div>' + pager(d.total, d.halaman, d.per, 'crm'); updCrBulk();
    });
  }
  function updCrBulk() { var n = Object.keys(S.crm.sel).length; $('#crBulk').hidden = !n; if (n) $('#crN').textContent = n + ' dipilih'; }
  function parseCSV(text) {
    text = text.replace(/^\ufeff/, ''); var first = text.split(/\r?\n/)[0] || '', dl = first.split(';').length > first.split(',').length ? ';' : ',', rows = [], row = [], cur = '', q = false;
    for (var i = 0; i < text.length; i++) { var c = text[i];
      if (q) { if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
      else if (c === '"') q = true; else if (c === dl) { row.push(cur); cur = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.join('').trim()) rows.push(row); row = []; } else cur += c; }
    row.push(cur); if (row.join('').trim()) rows.push(row); return rows;
  }
  function importCsv() {
    var f = this.files[0]; if (!f) return; var rd = new FileReader();
    rd.onload = function () {
      var rows = parseCSV(String(rd.result)); if (rows.length < 2) return toast('File kosong atau tanpa baris data.', true);
      var h = rows[0].map(function (x) { return x.trim().toLowerCase(); }), idx = function (names) { for (var i = 0; i < h.length; i++) if (names.indexOf(h[i]) > -1) return i; return -1; };
      var iN = idx(['nama', 'name']), iW = idx(['wa', 'whatsapp', 'hp', 'telepon', 'phone', 'no', 'nomor']), iE = idx(['email', 'e-mail']), iS = idx(['segmen', 'segment']), iT = idx(['tag', 'label']);
      if (iN < 0 || (iW < 0 && iE < 0)) return toast('Header wajib: nama, dan wa atau email (opsional: segmen, tag).', true);
      var data = rows.slice(1, 2001).map(function (r) { return { nama: r[iN], wa: iW > -1 ? r[iW] : '', email: iE > -1 ? r[iE] : '', segmen: iS > -1 ? r[iS] : '', tag: iT > -1 ? r[iT] : '' }; });
      toast('Mengimpor ' + data.length + ' baris…'); api('crm.import', { rows: data }).then(function (r) { toast(r.message, !r.success); if (r.success) V.crm(); });
    }; rd.readAsText(f); this.value = '';
  }
  function crmDetail(id) {
    $('#drawerBody').innerHTML = skel(5); $('#drawer').hidden = false;
    api('crm.detail', { kontakId: id }).then(function (r) {
      if (!r.success) return ($('#drawerBody').innerHTML = '<div class="err">' + esc(r.message) + '</div>'); var k = r.data.kontak, man = k.sumber === 'manual';
      $('#drawerBody').innerHTML = '<h3>' + esc(k.nama) + '</h3><div class="row"><span class="badge s">' + esc(k.segmen) + '</span><span class="badge ' + (k.statusWA === 'Terdaftar' ? 'g' : k.statusWA ? 'r' : '') + '">' + esc(k.statusWA || 'WA belum dicek') + '</span>' + (k.optOut ? '<span class="badge r">opt-out</span>' : '') + '</div>'
        + '<div class="col"><label class="fld"><span>Nama</span><input id="dNama" value="' + esc(k.nama) + '"></label><div class="grid2"><label class="fld"><span>WhatsApp ' + (man ? '' : '<em>(dari lead)</em>') + '</span><input id="dWa" value="' + esc(k.wa) + '" ' + (man ? '' : 'disabled') + '></label><label class="fld"><span>Email</span><input id="dEmail" type="email" value="' + esc(k.email) + '"></label></div>'
        + '<label class="fld"><span>Tag <em>(pisahkan koma)</em></span><input id="dTag" value="' + esc(k.tag) + '"></label><label class="fld"><span>Catatan</span><textarea id="dCat" maxlength="500">' + esc(k.catatan) + '</textarea></label>'
        + '<label class="row" style="font-weight:600"><input type="checkbox" id="dOut"' + (k.optOut ? ' checked' : '') + '> Jangan kirim pesan (opt-out)</label><button class="btn btn-primary" data-dsave="' + k.id + '">Simpan</button></div>'
        + '<h4>Catat interaksi</h4><div class="row"><select id="iKanal" style="width:auto"><option>Telepon</option><option>WA Manual</option><option>Kunjungan</option><option>Catatan</option></select><input id="iTeks" placeholder="Ringkasan singkat…" style="flex:1;min-width:160px"><button class="btn btn-dark btn-sm" data-dint="' + k.id + '">Tambah</button></div>'
        + '<h4>Riwayat lead</h4>' + (r.data.leads.length ? '<ul class="tl">' + r.data.leads.map(function (l) { return '<li><b>' + esc(l.tombol) + '</b> · ' + esc(l.sumber) + '<small>' + tgl(l.waktu) + ' · ' + esc(l.status) + '</small></li>'; }).join('') + '</ul>' : '<p class="muted sm">Tidak ada.</p>')
        + '<h4>Linimasa</h4>' + (r.data.timeline.length ? '<ul class="tl">' + r.data.timeline.map(function (t) { return '<li>' + esc(t.teks) + '<small>' + esc(t.jenis) + ' · ' + tgl(t.waktu) + ' · ' + esc(t.oleh) + '</small></li>'; }).join('') + '</ul>' : '<p class="muted sm">Belum ada interaksi.</p>')
        + (k.wa ? '<a class="btn btn-primary" target="_blank" rel="noopener" href="https://wa.me/' + wa62(k.wa) + '">Buka WhatsApp</a>' : '');
    });
  }

  /* ======================= WHATSAPP & NOTIFIKASI ======================= */
  V.wa = function () {
    var owner = S.me.role === 'owner', tabs = [['blast', 'Blast WhatsApp'], ['antrean', 'Antrean'], owner && ['config', 'Konfigurasi']].filter(Boolean);
    view.innerHTML = '<div class="tabs" role="tablist">' + tabs.map(function (t) { return '<button class="tab' + (S.waTab === t[0] ? ' on' : '') + '" data-tab="' + t[0] + '" role="tab">' + t[1] + '</button>'; }).join('') + '</div><div id="waBody">' + '<div class="skel"></div></div>';
    ({ blast: waBlast, antrean: waAntrean, config: waConfig }[S.waTab] || waBlast)();
  };
  function waBlast() {
    $('#waBody').innerHTML = '<div class="two" style="grid-template-columns:1fr 1fr"><div class="card col"><div><h2>1 · Pilih penerima</h2><p class="sub">Dari CRM atau tempel manual.</p></div>'
      + '<div class="radios"><label><input type="radio" name="aud" value="crm" checked>Kontak CRM</label><label><input type="radio" name="aud" value="manual">Tempel manual</label></div>'
      + '<div id="audCrm" class="grid2"><label class="fld"><span>Segmen</span><input id="aSeg" placeholder="kosong = semua"></label><label class="fld"><span>Tag</span><input id="aTag" placeholder="kosong = semua"></label><label class="fld"><span>Status WA</span><select id="aSt"><option value="">Semua</option><option value="Terdaftar">Terdaftar WA</option><option value="belum">Belum dicek</option></select></label></div>'
      + '<label class="fld" id="audMan" hidden><span>Satu per baris: <em>nomor|nama</em></span><textarea id="aTxt" placeholder="081234567890|Budi&#10;081298765432|Siti"></textarea></label>'
      + '<div class="row"><button class="btn btn-dark btn-sm" data-act="audload">Muat penerima</button><button class="btn btn-soft btn-sm" data-act="audcheck">Cek WA (50 per klik)</button></div><div id="audSum" class="muted sm">Belum dimuat.</div></div>'
      + '<div class="card col"><div><h2>2 · Tulis pesan</h2><p class="sub">Gunakan {nama}, {produk}, {link}.</p></div><label class="fld"><span>Judul internal</span><input id="bJudul" maxlength="80" placeholder="Promo Oktober"></label><label class="fld"><span>Isi pesan</span><textarea id="bPesan" maxlength="1500" placeholder="Halo {nama}, terima kasih sudah tertarik dengan {produk}…"></textarea></label>'
      + '<div class="grid2"><div class="fld"><span>Ukuran batch / menit</span><div class="radios"><label><input type="radio" name="bb" value="10">10</label><label><input type="radio" name="bb" value="20" checked>20</label><label><input type="radio" name="bb" value="50">50</label></div></div><label class="fld"><span>Jeda antarpesan (detik)</span><input id="bJeda" value="5" placeholder="5 atau 3-8"></label></div>'
      + '<label class="row" style="font-weight:600"><input type="checkbox" id="bSkip" checked> Lewati nomor yang terdeteksi tidak terdaftar WA</label><button class="btn btn-primary" data-act="blastgo">Buat & mulai blast</button></div></div>'
      + '<div class="card"><div class="card-h"><div><h2>Riwayat blast</h2><p class="sub">Pesan dikirim bertahap oleh trigger tiap menit agar nomor tetap aman.</p></div><button class="btn btn-soft btn-sm" data-act="blastref">⟳ Segarkan</button></div><div id="blastList"><div class="skel"></div></div></div>';
    $$('input[name=aud]').forEach(function (r) { r.addEventListener('change', function () { var m = r.value === 'manual' && r.checked; $('#audMan').hidden = !m; $('#audCrm').hidden = m; }); });
    loadBlasts();
  }
  function loadBlasts() {
    api('wa.blastList', {}).then(function (r) {
      var el = $('#blastList'); if (!el) return; if (!r.success) return (el.innerHTML = '<div class="err">' + esc(r.message) + '</div>');
      var run = r.data.rows.some(function (b) { return b.status === 'Berjalan'; });
      el.innerHTML = r.data.rows.length ? '<div class="twrap"><table><thead><tr><th>Blast</th><th>Progres</th><th>Terkirim</th><th>Gagal</th><th>Batch</th><th>Status</th><th></th></tr></thead><tbody>' + r.data.rows.map(function (b) {
        return '<tr><td><b>' + esc(b.judul) + '</b><small>' + tgl(b.tanggal) + ' · ' + esc(b.sasaran) + '</small></td><td style="min-width:130px"><div class="prog ' + (b.status === 'Selesai' ? 'done' : '') + '"><i style="width:' + b.persen + '%"></i></div><small>' + b.persen + '% · sisa ' + num(b.sisa) + '</small></td><td>' + num(b.terkirim) + ' / ' + num(b.total) + '</td><td>' + num(b.gagal) + '</td><td>' + b.ukuran + ' · ' + esc(b.jeda) + 'd</td><td><span class="badge ' + ({ Berjalan: 'y', Selesai: 'g', Dihentikan: 'r' }[b.status] || '') + '">' + esc(b.status) + '</span></td><td class="nowrap">' + (b.status === 'Berjalan' ? '<button class="btn btn-soft btn-sm" data-bproc="' + b.id + '">Proses 1 batch</button> <button class="btn btn-danger btn-sm" data-bstop="' + b.id + '">Stop</button>' : '') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="empty"><b>Belum ada blast</b>Muat penerima, tulis pesan, lalu mulai.</div>';
      clearInterval(S.poll); if (run) S.poll = setInterval(function () { if (S.view === 'wa' && S.waTab === 'blast') loadBlasts(); else clearInterval(S.poll); }, 15000);
    });
  }
  function waAntrean() {
    $('#waBody').innerHTML = '<div class="card"><div class="card-h"><div><h2>Antrean notifikasi</h2><p class="sub" id="qSub"></p></div><div class="row"><select id="qSt" style="width:auto"><option value="">Semua status</option><option>Antri</option><option>Terkirim</option><option>Gagal</option><option>Batal</option></select><button class="btn btn-dark btn-sm" data-act="qproc">▶ Proses sekarang</button><button class="btn btn-soft btn-sm" data-act="qretry">↻ Ulangi yang gagal</button></div></div><div id="qTbl"><div class="skel"></div></div></div>';
    $('#qSt').addEventListener('change', loadQueue); loadQueue();
  }
  function loadQueue() {
    api('notif.queue', { status: $('#qSt').value }).then(function (r) {
      if (!r.success) return ($('#qTbl').innerHTML = '<div class="err">' + esc(r.message) + '</div>'); var s = r.data.ringkas;
      $('#qSub').textContent = s.Antri + ' antri · ' + s.Terkirim + ' terkirim · ' + s.Gagal + ' gagal · ' + s.Batal + ' batal (3.000 terakhir)';
      $('#qTbl').innerHTML = r.data.rows.length ? '<div class="twrap"><table><thead><tr><th>Waktu</th><th>Kanal</th><th>Tujuan</th><th>Event</th><th>Pesan</th><th>Status</th></tr></thead><tbody>' + r.data.rows.map(function (q) { return '<tr><td class="nowrap">' + tgl(q.waktu) + '</td><td><span class="badge ' + (q.kanal === 'WA' ? 'g' : 'b') + '">' + q.kanal + '</span></td><td>' + esc(q.tujuan) + '<small>' + esc(q.nama) + '</small></td><td>' + esc(q.event) + '</td><td style="max-width:260px"><small style="color:var(--slate)">' + esc(q.pesan) + '</small></td><td><span class="badge ' + ({ Antri: 'y', Terkirim: 'g', Gagal: 'r' }[q.status] || '') + '">' + q.status + '</span><small>' + esc(q.respon) + '</small></td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="empty"><b>Antrean kosong</b></div>';
    });
  }
  function waConfig() {
    api('notif.config', {}).then(function (r) {
      if (!r.success) return ($('#waBody').innerHTML = '<div class="err">' + esc(r.message) + '</div>'); var c = r.data;
      $('#waBody').innerHTML = '<div class="two" style="grid-template-columns:1fr 1fr"><div class="card col"><div><h2>Koneksi WhatsApp (Fonnte)</h2><p class="sub">Token disimpan aman di Script Properties — tidak pernah ditampilkan ulang.</p></div>'
        + '<label class="fld"><span>Token Fonnte <em>' + (c.tokenAda ? '(tersimpan: ' + esc(c.token) + ')' : '(belum diisi)') + '</em></span><input id="cTok" type="password" autocomplete="new-password" placeholder="' + (c.tokenAda ? 'Kosongkan jika tidak diganti' : 'Tempel token dari fonnte.com') + '"></label>'
        + '<div class="row"><button class="btn btn-soft btn-sm" data-act="cdev">Cek perangkat</button>' + (c.tokenAda ? '<button class="btn btn-danger btn-sm" data-act="ctokdel">Hapus token</button>' : '') + '</div><div id="devInfo" class="sm muted"></div>'
        + '<div class="sw"><div><b>Kirim WhatsApp otomatis</b><small>Saklar utama semua event & blast otomatis</small></div><label><input type="checkbox" id="cWa"' + (c.waAktif ? ' checked' : '') + '><i></i></label></div>'
        + '<div class="sw"><div><b>Kirim Email otomatis</b><small>Sisa kuota email hari ini: ' + num(c.sisaKuotaEmail) + '</small></div><label><input type="checkbox" id="cEm"' + (c.emailAktif ? ' checked' : '') + '><i></i></label></div>'
        + '<div class="sw"><div><b>Deteksi nomor WA otomatis</b><small>Cek nomor kontak baru terdaftar WA</small></div><label><input type="checkbox" id="cDet"' + (c.deteksiOtomatis ? ' checked' : '') + '><i></i></label></div>'
        + '<div class="grid2"><div class="fld"><span>Batch bawaan</span><select id="cBatch"><option>10</option><option>20</option><option>50</option></select></div><label class="fld"><span>Jeda (detik)</span><input id="cJeda" value="' + esc(c.jeda) + '"></label></div>'
        + '<label class="fld"><span>Nama pengirim email</span><input id="cNama" value="' + esc(c.namaPengirim) + '"></label><label class="fld"><span>URL halaman penjualan <em>(untuk {link})</em></span><input id="cUrl" value="' + esc(c.appUrl) + '" placeholder="https://username.github.io/nama-repo/"></label>'
        + '<div class="row" style="color:var(--muted);font-size:13px">Trigger antrean: <span class="badge ' + (c.triggerAktif ? 'g' : 'r') + '">' + (c.triggerAktif ? 'aktif' : 'belum aktif') + '</span></div></div>'
        + '<div class="card col"><div><h2>Matriks event</h2><p class="sub">Pilih kanal & ubah isi pesan tiap event.</p></div>' + Object.keys(c.matriks).map(function (k) { var m = c.matriks[k]; return '<div class="matrix" data-ev="' + k + '"><h4>' + esc(m.label) + '</h4><div class="row"><label><input type="checkbox" data-mw' + (m.wa ? ' checked' : '') + '> WhatsApp</label><label><input type="checkbox" data-me' + (m.email ? ' checked' : '') + '> Email</label></div><label class="fld"><span>Subjek email</span><input data-ms value="' + esc(m.subjek) + '"></label><label class="fld"><span>Isi pesan</span><textarea data-mp>' + esc(m.pesan) + '</textarea></label></div>'; }).join('')
        + '<div class="grid2"><div class="fld"><span>Tes WhatsApp ke</span><input id="tWa" placeholder="08…"></div><div class="fld"><span>&nbsp;</span><button class="btn btn-soft btn-sm" data-act="twa">Kirim tes</button></div><div class="fld"><span>Tes email ke</span><input id="tEm" type="email" placeholder="anda@email.com"></div><div class="fld"><span>&nbsp;</span><button class="btn btn-soft btn-sm" data-act="tem">Kirim tes</button></div></div></div></div>'
        + '<div class="row"><button class="btn btn-primary" data-act="csave">Simpan konfigurasi</button></div>';
      $('#cBatch').value = String(c.batchDefault || 20);
    });
  }
  function saveConfig(b) {
    var m = {}; $$('.matrix').forEach(function (el) { m[el.dataset.ev] = { wa: $('[data-mw]', el).checked, email: $('[data-me]', el).checked, subjek: $('[data-ms]', el).value, pesan: $('[data-mp]', el).value }; });
    var d = { waAktif: $('#cWa').checked, emailAktif: $('#cEm').checked, deteksiOtomatis: $('#cDet').checked, batchDefault: +$('#cBatch').value, jeda: $('#cJeda').value.trim(), namaPengirim: $('#cNama').value, appUrl: $('#cUrl').value.trim(), matriks: m }; if ($('#cTok').value.trim()) d.token = $('#cTok').value.trim();
    busy(b, true, 'Menyimpan…'); api('notif.configSave', d).then(function (r) { busy(b, false); toast(r.message || (r.success ? 'Tersimpan.' : 'Gagal.'), !r.success); if (r.success) waConfig(); });
  }

  /* ======================= PENGATURAN ======================= */
  V.pengaturan = function () {
    var owner = S.me.role === 'owner';
    if (!owner) { view.innerHTML = '<div class="card"><div class="empty"><b>Khusus pemilik</b>Pengaturan konten hanya dapat diubah oleh pemilik.</div></div>'; return; }
    Promise.all([api('settings.get', {}), api('rahasia.status', {})]).then(function (rs) {
      var r = rs[0], k = rs[1]; if (!r.success) return fail(r); var s = r.data.pengaturan, p = r.data.produk, t = r.data.tautan || {};
      var sw = function (key, title, desc) { return '<div class="sw"><div><b>' + title + '</b><small>' + desc + '</small></div><label><input type="checkbox" data-set="' + key + '"' + (s[key] === 'YA' ? ' checked' : '') + '><i></i></label></div>'; };
      view.innerHTML = '<div class="two" style="grid-template-columns:1fr 1fr"><div class="card col"><div class="card-h" style="margin:0"><div><h2>Saklar Tampilan Landing Page</h2><p class="sub">Berlaku langsung — tanpa mengubah kode.</p></div><span class="badge g">Auto save ke Sheets</span></div>'
        + sw('SHOW_TESTIMONI', 'Seksi Testimoni', 'Kartu flip & popup ulasan') + sw('SHOW_BONUS', 'Bonus & Sisa Kuota', 'Daftar bonus di kartu harga') + sw('SHOW_COUNTDOWN', 'Timer Hitung Mundur', 'Aktif selama batas promo belum lewat') + sw('SHOW_LEADFORM', 'Form Nama & WhatsApp', 'Muncul saat tombol beli ditekan') + sw('SHOW_WA_FLOAT', 'Tombol WhatsApp Mengambang', 'Pojok kanan bawah') + sw('SHOW_BUTTERFLY', 'Kupu-kupu Interaktif', 'Mengikuti kursor pengunjung')
        + '<label class="fld"><span>Mode notifikasi lead ke email Anda</span><select data-set="NOTIF_MODE"><option value="langsung"' + (s.NOTIF_MODE !== 'ringkasan' ? ' selected' : '') + '>Langsung tiap lead baru</option><option value="ringkasan"' + (s.NOTIF_MODE === 'ringkasan' ? ' selected' : '') + '>Rangkuman harian</option></select></label>'
        + '<label class="fld"><span>Email penerima notifikasi</span><input data-set="EMAIL_OWNER" type="email" value="' + esc(s.EMAIL_OWNER) + '" placeholder="kosong = email akun Google pemilik"></label></div>'
        + '<div class="card col"><div><h2>Produk & Harga</h2><p class="sub">Teks lain (modul, testimoni, FAQ) diedit langsung di Google Sheets.</p></div>'
        + '<label class="fld"><span>Nama produk</span><input data-pr="nama_produk" value="' + esc(p.nama_produk) + '"></label><label class="fld"><span>Headline</span><input data-pr="headline" value="' + esc(p.headline) + '"></label><label class="fld"><span>Sub-headline</span><textarea data-pr="subheadline">' + esc(p.subheadline) + '</textarea></label>'
        + '<div class="grid2"><label class="fld"><span>Harga normal (Rp)</span><input data-pr="harga_normal" inputmode="numeric" value="' + esc(p.harga_normal) + '"></label><label class="fld"><span>Harga promo (Rp)</span><input data-pr="harga_promo" inputmode="numeric" value="' + esc(p.harga_promo) + '"></label></div>'
        + '<label class="fld"><span>Batas promo <em>(contoh 2026-12-31T23:59:00+08:00)</em></span><input data-pr="promo_sampai" value="' + esc(p.promo_sampai) + '"></label><label class="fld"><span>Link pembayaran <em>(Lynk.id, Mayar, dll)</em></span><input data-pr="link_bayar" value="' + esc(p.link_bayar) + '"></label><label class="fld"><span>Nomor WhatsApp CS</span><input data-pr="wa_cs" value="' + esc(p.wa_cs) + '"></label>'
        + '<div class="row"><button class="btn btn-primary" data-act="setsave">Simpan perubahan</button>' + (t.sheet ? '<a class="btn btn-soft" target="_blank" rel="noopener" href="' + esc(t.sheet) + '">Buka Google Sheets</a>' : '') + (t.drive ? '<a class="btn btn-soft" target="_blank" rel="noopener" href="' + esc(t.drive) + '">Folder gambar</a>' : '') + '</div></div></div>'
        + '<div class="two" style="grid-template-columns:1fr 1fr"><div class="card col"><div><h2>Keamanan</h2><p class="sub">Rahasia disimpan di Script Properties dan tidak pernah ditampilkan ulang.</p></div>'
        + '<label class="fld"><span>Google Client ID <em>' + (k.success && k.data.GOOGLE_CLIENT_ID.ada ? '(tersimpan: ' + esc(k.data.GOOGLE_CLIENT_ID.samar) + ')' : '(belum diisi — login Google nonaktif)') + '</em></span><input id="gcid" placeholder="xxxx.apps.googleusercontent.com"></label><button class="btn btn-dark btn-sm" data-act="gcidsave" style="justify-self:start">Simpan Client ID</button>'
        + '<hr style="border:0;border-top:1px solid var(--line);width:100%"><b>Ganti kata sandi akses darurat</b><label class="fld"><span>Sandi lama</span><input id="rOld" type="password" autocomplete="current-password"></label><label class="fld"><span>Sandi baru <em>(min. 12 karakter, huruf + angka)</em></span><input id="rNew" type="password" autocomplete="new-password"></label><button class="btn btn-soft btn-sm" data-act="rotate" style="justify-self:start">Ganti sandi</button>'
        + '<hr style="border:0;border-top:1px solid var(--line);width:100%"><button class="btn btn-danger btn-sm" data-act="logoutall" style="justify-self:start">Keluarkan semua perangkat</button></div>'
        + '<div class="card col"><div><h2>Cache & Sinkronisasi</h2><p class="sub">Konten dari Sheets disimpan sementara (±10 menit) agar halaman cepat saat trafik iklan melonjak.</p></div><p class="sm muted">Setelah mengedit teks langsung di Google Sheets, tekan tombol ini agar perubahan tampil seketika.</p><button class="btn btn-primary" data-act="cacheclear" style="justify-self:start">⚡ Hapus cache sekarang</button></div></div>';
    });
  };

  /* ======================= MIGRASI ======================= */
  V.migrasi = function () {
    if (S.me.role !== 'owner') { view.innerHTML = '<div class="card"><div class="empty"><b>Khusus pemilik</b></div></div>'; return; }
    var names = ['Produk', 'Hero_Slide', 'Masalah', 'Fitur_Isi', 'Statistik', 'Testimoni', 'Bonus', 'FAQ', 'Leads'];
    view.innerHTML = '<div class="card col"><div><h2>Impor dari spreadsheet lama</h2><p class="sub">Aman diulang: sumber hanya dibaca, data ganda dilewati, nomor WA dinormalisasi. Jalankan <b>Pindai</b> dulu (tidak menulis apa pun).</p></div>'
      + '<label class="fld"><span>URL atau ID spreadsheet lama</span><input id="mgSrc" placeholder="https://docs.google.com/spreadsheets/d/…"></label>'
      + '<div class="fld"><span>Sheet yang diimpor</span><div class="chips">' + names.map(function (n) { return '<label class="chip on" style="cursor:pointer"><input type="checkbox" value="' + n + '" checked style="display:none">' + n + '</label>'; }).join('') + '</div></div>'
      + '<label class="row" style="font-weight:600"><input type="checkbox" id="mgOver"> Timpa isi data yang sudah ada (ikuti data lama)</label>'
      + '<div class="row"><button class="btn btn-soft" data-act="mgscan">🔍 Pindai (aman)</button><button class="btn btn-primary" data-act="mgrun">Jalankan import</button></div><div id="mgOut"></div></div>';
    $$('.chips label').forEach(function (l) { l.addEventListener('click', function (e) { e.preventDefault(); var c = $('input', l); c.checked = !c.checked; l.classList.toggle('on', c.checked); }); });
  };
  function migrate(dry, b) {
    var src = $('#mgSrc').value.trim(); if (!src) return toast('Tempel URL atau ID spreadsheet lama.', true);
    var sheets = $$('.chips input:checked').map(function (i) { return i.value; });
    if (!dry && !confirm('Jalankan import ke database app ini?\nDisarankan sudah menjalankan Pindai.')) return;
    busy(b, true, dry ? 'Memindai…' : 'Mengimpor…');
    api(dry ? 'migrasi.scan' : 'migrasi.run', { sumber: src, sheets: sheets, timpa: $('#mgOver').checked }).then(function (r) {
      busy(b, false); var o = $('#mgOut'); if (!r.success) { o.innerHTML = '<div class="err">' + esc(r.message) + '</div>'; return; } var d = r.data;
      o.innerHTML = '<div class="okmsg">' + (dry ? 'Pindai selesai — belum ada data yang ditulis. ' : 'Import selesai. ') + 'Sumber: ' + esc(d.sumber.nama) + '</div><div class="twrap"><table><thead><tr><th>Sheet</th><th>Di sumber</th><th>' + (dry ? 'Akan ditambah' : 'Ditambah') + '</th><th>' + (dry ? 'Akan diperbarui' : 'Diperbarui') + '</th><th>Dilewati</th></tr></thead><tbody>' + Object.keys(d.laporan).map(function (k) { var x = d.laporan[k]; return '<tr><td><b>' + k + '</b>' + (x.tidakAda ? '<small>tidak ada di sumber</small>' : '') + '</td><td>' + x.source + '</td><td>' + x.inserted + '</td><td>' + x.updated + '</td><td>' + x.skipped + '</td></tr>'; }).join('') + '</tbody></table></div>' + d.peringatan.map(function (w) { return '<div class="err" style="background:#FEF9C3;color:#854D0E">⚠ ' + esc(w) + '</div>'; }).join('');
      toast(dry ? 'Pindai selesai.' : 'Import selesai.');
    });
  }

  /* ======================= PRODUK & VIDEO ======================= */
  var YT = /^[A-Za-z0-9_-]{11}$/;
  function parseYT(s) {
    s = String(s || '').trim(); var m, id = null;
    if (YT.test(s)) id = s; else { m = s.match(/^(?:https?:\/\/)?(?:www\.|m\.|music\.)?(?:youtube\.com|youtube-nocookie\.com)\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/|v\/)([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])/i) || s.match(/^(?:https?:\/\/)?youtu\.be\/([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])/i); if (m) id = m[1]; }
    return id;
  }
  function imgSrc(u) { var m = String(u).match(/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]{20,})/); return m ? 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w400' : u; }
  function digits(v) { return String(v == null ? '' : v).replace(/[^\d]/g, ''); }
  function fileB64(blob) { return new Promise(function (ok, no) { var r = new FileReader(); r.onload = function () { ok(String(r.result).split(',')[1] || ''); }; r.onerror = function () { no(new Error('Gagal membaca file.')); }; r.readAsDataURL(blob); }); }
  /** Kompres di browser (maks 1400 px, JPEG ±84%) agar unggahan kecil & cepat. Gagal kompres → kirim asli bila ≤ 1,4 MB. */
  function compress(file) {
    return new Promise(function (res, rej) {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return rej(new Error('Format harus JPG, PNG, atau WebP (' + (file.name || 'file') + ').'));
      var url = URL.createObjectURL(file), img = new Image(), done = false, to;
      function fallback() { if (done) return; done = true; clearTimeout(to); try { URL.revokeObjectURL(url); } catch (e) {} if (file.size <= 1400000) fileB64(file).then(function (d) { res({ data: d, mime: file.type }); }, rej); else rej(new Error('Gambar terlalu besar dan tidak dapat dikompres: ' + (file.name || '') + '.')); }
      to = setTimeout(fallback, 5000);
      img.onload = function () {
        if (done) return;
        try {
          var k = Math.min(1, 1400 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
          var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
          c.toBlob(function (b) { if (!b || done) return b ? 0 : fallback(); done = true; clearTimeout(to); try { URL.revokeObjectURL(url); } catch (e) {} fileB64(b).then(function (d) { res({ data: d, mime: 'image/jpeg' }); }, rej); }, 'image/jpeg', 0.84);
        } catch (e) { fallback(); }
      };
      img.onerror = fallback; img.src = url;
    });
  }
  function uploadImage(file) {
    return compress(file).then(function (c) { return api('media.upload', { nama: file.name, mime: c.mime, data: c.data }); })
      .then(function (r) { if (!r.success) throw new Error(r.message); if (r.data.publik === false) toast(r.message, true); return r.data.url; });
  }
  function copyText(txt) {
    var done = function () { toast('Link disalin.'); };
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(txt).then(done, function () { toast('Salin manual: ' + txt, true); });
    var ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { toast('Salin manual: ' + txt, true); } ta.remove();
  }
  var swHtml = function (attr, on, label) { return '<div class="sw mini"><label title="' + label + '"><input type="checkbox" ' + attr + (on ? ' checked' : '') + ' aria-label="' + label + '"><i></i></label></div>'; };

  V.produk = function () {
    if (S.me.role !== 'owner') { view.innerHTML = '<div class="card"><div class="empty"><b>Khusus pemilik</b></div></div>'; return; }
    S.pv = S.pv || { tab: 'produk', media: [] };
    view.innerHTML = '<div class="tabs" role="tablist">' + [['produk', 'Produk'], ['video', 'Video YouTube'], ['media', 'Unggah Gambar']].map(function (t) { return '<button class="tab' + (S.pv.tab === t[0] ? ' on' : '') + '" data-ptab="' + t[0] + '" role="tab">' + t[1] + '</button>'; }).join('') + '</div><div id="pvBody"><div class="skel"></div></div>';
    ({ produk: pvProduk, video: pvVideo, media: pvMedia }[S.pv.tab] || pvProduk)();
  };

  /* ---- PRODUK ---- */
  function pvProduk() {
    api('katalog.list', {}).then(function (r) {
      if (!r.success) return ($('#pvBody').innerHTML = '<div class="err">' + esc(r.message) + '</div>'); S.pv.rows = r.data.rows;
      $('#pvBody').innerHTML = '<div class="card"><div class="card-h"><div><h2>Katalog Produk</h2><p class="sub">Produk tambahan yang tampil di seksi "Pilihan Produk" pada halaman penjualan, masing-masing dengan slideshow gambar & tombol beli sendiri. <b>Produk utama</b> (kartu harga) diedit di <a href="#" data-go-view="pengaturan">Pengaturan Konten</a>.</p></div><button class="btn btn-primary" data-pnew>+ Tambah produk</button></div>'
        + (r.data.rows.length ? '<div class="twrap"><table><thead><tr><th>Produk</th><th>Harga</th><th>Label / Kuota</th><th>Gambar</th><th>Tampil</th><th></th></tr></thead><tbody>' + r.data.rows.map(function (p) {
          return '<tr><td><div class="media-cell"><img class="thumb" alt="" src="' + esc(p.gambar[0] || '') + '" onerror="this.removeAttribute(\'src\')"><div><b>' + esc(p.nama) + '</b><small>' + esc(p.tagline || '') + '</small></div></div></td><td class="nowrap">' + (p.harga_normal > p.harga_promo ? '<s class="muted">' + rp(p.harga_normal) + '</s><br>' : '') + '<b>' + (p.harga_promo > 0 ? rp(p.harga_promo) : 'Gratis') + '</b></td><td>' + (p.label ? '<span class="badge p">' + esc(p.label) + '</span> ' : '') + (p.kuota ? '<span class="badge y">kuota ' + p.kuota + '</span>' : '') + '</td><td>' + p.gambar.length + ' foto</td><td>' + swHtml('data-ptog="' + p.id + '"', p.aktif, 'Tampilkan ' + p.nama) + '</td><td class="nowrap"><button class="btn btn-soft btn-sm" data-pedit="' + p.id + '">Edit</button> <button class="btn btn-danger btn-sm" data-pdel="' + p.id + '">Hapus</button></td></tr>'; }).join('') + '</tbody></table></div>'
          : '<div class="empty"><b>Belum ada produk tambahan</b>Klik "Tambah produk" untuk membuat kartu produk pertama.</div>') + '</div>';
    });
  }
  function pfImgs() {
    var g = S.pf.gambar, el = $('#pfImgs'); if (!el) return;
    el.innerHTML = g.map(function (u, i) { return '<div class="img"><img alt="Gambar ' + (i + 1) + '" src="' + esc(imgSrc(u)) + '" onerror="this.style.opacity=.2">' + (i === 0 ? '<span class="cover">Sampul</span>' : '') + '<div class="bar2"><button type="button" data-imgl="' + i + '" aria-label="Geser ke kiri" ' + (i === 0 ? 'disabled' : '') + '>◀</button><button type="button" data-imgd="' + i + '" aria-label="Hapus gambar">✕</button><button type="button" data-imgr="' + i + '" aria-label="Geser ke kanan" ' + (i === g.length - 1 ? 'disabled' : '') + '>▶</button></div></div>'; }).join('') + (S.pf.busy ? '<div class="img up">Mengunggah…</div>' : '');
    $('#pfCount').textContent = g.length + ' / 8 gambar' + (g.length > 1 ? ' · tampil sebagai slideshow otomatis' : '');
  }
  function pfOpen(p) {
    var it = p || { gambar: [], poin: [], aktif: true, harga_promo: '', harga_normal: '', kuota: '', label: '', urutan: '', nama: '', tagline: '', deskripsi: '', link_bayar: '' };
    S.pf = { id: p ? p.id : '', gambar: (it.gambar || []).slice(), busy: 0 };
    $('#drawerBody').innerHTML = '<h3>' + (p ? 'Edit produk' : 'Tambah produk') + '</h3><div class="col">'
      + '<label class="fld"><span>Nama produk *</span><input id="pfNama" maxlength="100" value="' + esc(it.nama) + '" placeholder="Contoh: E-book Starter Kreator"></label>'
      + '<label class="fld"><span>Tagline <em>(1 baris)</em></span><input id="pfTag" maxlength="140" value="' + esc(it.tagline) + '"></label>'
      + '<label class="fld"><span>Deskripsi</span><textarea id="pfDesk" maxlength="600">' + esc(it.deskripsi) + '</textarea></label>'
      + '<label class="fld"><span>Poin keunggulan <em>(satu per baris, maks 8)</em></span><textarea id="pfPoin">' + esc((it.poin || []).join('\n')) + '</textarea></label>'
      + '<div class="grid2"><label class="fld"><span>Harga normal (Rp)</span><input id="pfHn" inputmode="numeric" value="' + esc(it.harga_normal) + '" placeholder="coret, opsional"></label><label class="fld"><span>Harga promo (Rp) *</span><input id="pfHp" inputmode="numeric" value="' + esc(it.harga_promo) + '" placeholder="0 = Gratis"></label></div>'
      + '<div class="grid3"><label class="fld"><span>Label</span><input id="pfLabel" maxlength="24" value="' + esc(it.label) + '" placeholder="Terlaris"></label><label class="fld"><span>Sisa kuota</span><input id="pfKuota" inputmode="numeric" value="' + esc(it.kuota) + '" placeholder="kosong = tanpa"></label><label class="fld"><span>Urutan</span><input id="pfUrut" inputmode="numeric" value="' + esc(it.urutan) + '" placeholder="otomatis"></label></div>'
      + '<label class="fld"><span>Link pembayaran <em>(kosong = pembeli diarahkan ke WhatsApp)</em></span><input id="pfLink" value="' + esc(it.link_bayar) + '" placeholder="https://lynk.id/…"></label>'
      + '<div class="fld"><span>Gambar produk <em id="pfCount"></em></span><div class="imgs" id="pfImgs"></div>'
      + '<div class="drop" id="pfDrop"><input type="file" id="pfFile" accept="image/png,image/jpeg,image/webp" multiple hidden><button class="btn btn-dark btn-sm" type="button" data-act="pfpick">⬆ Unggah dari perangkat</button><span class="hint">atau seret gambar ke sini · JPG/PNG/WebP · dikompres otomatis · urutan = urutan slideshow</span></div>'
      + '<div class="row"><input id="pfUrl" placeholder="atau tempel link gambar / link berkas Google Drive" style="flex:1;min-width:180px"><button class="btn btn-soft btn-sm" type="button" data-act="pfaddurl">Tambah</button></div></div>'
      + '<div class="sw"><div><b>Tampilkan di halaman penjualan</b><small>Matikan untuk menyembunyikan sementara</small></div><label><input type="checkbox" id="pfAktif"' + (it.aktif ? ' checked' : '') + '><i></i></label></div>'
      + '<div id="pfErr" class="err" hidden></div><button class="btn btn-primary btn-block" data-act="pfsave">Simpan produk</button></div>';
    $('#drawer').hidden = false; pfImgs();
    var dz = $('#pfDrop'); ['dragenter', 'dragover'].forEach(function (ev) { dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add('over'); }); }); ['dragleave', 'drop'].forEach(function (ev) { dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove('over'); }); });
    dz.addEventListener('drop', function (e) { pfUpload(Array.prototype.slice.call(e.dataTransfer.files || [])); });
  }
  function pfUpload(files) {
    var room = 8 - S.pf.gambar.length; if (room <= 0) return toast('Maksimal 8 gambar per produk.', true);
    files = files.slice(0, room);
    return files.reduce(function (p, f) {
      return p.then(function () { S.pf.busy++; pfImgs(); return uploadImage(f).then(function (u) { S.pf.gambar.push(u); }, function (e) { toast(e.message, true); }).then(function () { S.pf.busy--; pfImgs(); }); });
    }, Promise.resolve());
  }
  function pfSave(b) {
    var err = $('#pfErr'); err.hidden = true;
    if (S.pf.busy) { err.textContent = 'Tunggu unggahan gambar selesai.'; err.hidden = false; return; }
    var d = { id: S.pf.id || undefined, nama: $('#pfNama').value, tagline: $('#pfTag').value, deskripsi: $('#pfDesk').value, poin: $('#pfPoin').value.split(/\r?\n/), harga_normal: digits($('#pfHn').value), harga_promo: digits($('#pfHp').value),
      label: $('#pfLabel').value, kuota: digits($('#pfKuota').value), urutan: digits($('#pfUrut').value), link_bayar: $('#pfLink').value.trim(), gambar: S.pf.gambar, aktif: $('#pfAktif').checked };
    busy(b, true, 'Menyimpan…');
    api('katalog.save', d).then(function (r) { busy(b, false); if (!r.success) { err.textContent = r.message; err.hidden = false; return; } toast(r.message); $('#drawer').hidden = true; pvProduk(); });
  }

  /* ---- VIDEO ---- */
  function pvVideo() {
    api('video.list', {}).then(function (r) {
      if (!r.success) return ($('#pvBody').innerHTML = '<div class="err">' + esc(r.message) + '</div>'); S.pv.vrows = r.data.rows; S.pv.kat = r.data.kategori;
      $('#pvBody').innerHTML = '<div class="card"><div class="card-h"><div><h2>Video YouTube</h2><p class="sub">Tutorial membuat aplikasi, konten jualan, atau testimoni. Cukup tempel link YouTube — video dimuat saat pengunjung menekan tombol putar (hemat kuota & lebih privat).</p></div><button class="btn btn-primary" data-vnew>+ Tambah video</button></div>'
        + (r.data.rows.length ? '<div class="vgrid">' + r.data.rows.map(function (v) {
          return '<div class="vcard' + (v.aktif ? '' : ' off') + '"><div class="vt">' + (v.thumb ? '<img alt="" loading="lazy" referrerpolicy="no-referrer" src="' + esc(v.thumb) + '" onerror="this.style.display=\'none\'">' : '') + '</div><div class="vb"><div class="row"><span class="badge s">' + esc(v.kategori) + '</span>' + (v.yt ? '' : '<span class="badge y">link belum diisi</span>') + '<span style="margin-left:auto">' + swHtml('data-vtog="' + v.id + '"', v.aktif && !!v.yt, 'Tampilkan ' + v.judul) + '</span></div><b>' + esc(v.judul) + '</b><div class="row"><button class="btn btn-soft btn-sm" data-vedit="' + v.id + '">Edit</button><button class="btn btn-danger btn-sm" data-vdel="' + v.id + '">Hapus</button></div></div></div>'; }).join('') + '</div>'
          : '<div class="empty"><b>Belum ada video</b>Klik "Tambah video" lalu tempel link YouTube.</div>') + '</div>';
    });
  }
  function vfPreview() {
    var id = parseYT($('#vfLink').value), box = $('#vfPrev'), hint = $('#vfHint'), v = $('#vfLink').value.trim();
    if (!v) { box.innerHTML = ''; box.hidden = true; hint.className = 'hint'; hint.textContent = 'Format: youtube.com/watch?v=…, youtu.be/…, /shorts/…, /embed/… atau ID 11 karakter. Tambahkan ?t=90 untuk mulai di detik ke-90.'; return; }
    if (!id) { box.hidden = true; hint.className = 'hint bad'; hint.textContent = 'Link YouTube belum dikenali.'; return; }
    box.hidden = false; box.innerHTML = '<img alt="Pratinjau" referrerpolicy="no-referrer" src="https://i.ytimg.com/vi/' + id + '/hqdefault.jpg">'; hint.className = 'hint good'; hint.textContent = '✓ Terdeteksi video ' + id;
  }
  function vfOpen(v) {
    var it = v || { judul: '', deskripsi: '', link: '', kategori: 'Tutorial', urutan: '', aktif: true }; S.vf = { id: v ? v.id : '' };
    $('#drawerBody').innerHTML = '<h3>' + (v ? 'Edit video' : 'Tambah video') + '</h3><div class="col">'
      + '<label class="fld"><span>Judul video *</span><input id="vfJudul" maxlength="120" value="' + esc(it.judul) + '" placeholder="Tutorial: Cara memasang landing page"></label>'
      + '<label class="fld"><span>Link YouTube *</span><input id="vfLink" value="' + esc(it.link) + '" placeholder="https://www.youtube.com/watch?v=…"></label><div class="hint" id="vfHint"></div><div class="vprev" id="vfPrev" hidden></div>'
      + '<div class="grid2"><label class="fld"><span>Kategori</span><select id="vfKat">' + (S.pv.kat || ['Tutorial', 'Konten Jualan', 'Testimoni', 'Lainnya']).map(function (k) { return '<option' + (k === it.kategori ? ' selected' : '') + '>' + esc(k) + '</option>'; }).join('') + '</select></label><label class="fld"><span>Urutan</span><input id="vfUrut" inputmode="numeric" value="' + esc(it.urutan) + '" placeholder="otomatis"></label></div>'
      + '<label class="fld"><span>Deskripsi singkat</span><textarea id="vfDesk" maxlength="300">' + esc(it.deskripsi) + '</textarea></label>'
      + '<div class="sw"><div><b>Tampilkan di halaman penjualan</b><small>Video hanya muncul jika link valid</small></div><label><input type="checkbox" id="vfAktif"' + (it.aktif ? ' checked' : '') + '><i></i></label></div>'
      + '<div id="vfErr" class="err" hidden></div><button class="btn btn-primary btn-block" data-act="vfsave">Simpan video</button></div>';
    $('#drawer').hidden = false; $('#vfLink').addEventListener('input', vfPreview); vfPreview();
  }
  function vfSave(b) {
    var err = $('#vfErr'); err.hidden = true;
    var d = { id: S.vf.id || undefined, judul: $('#vfJudul').value, youtube: $('#vfLink').value, kategori: $('#vfKat').value, urutan: digits($('#vfUrut').value), deskripsi: $('#vfDesk').value, aktif: $('#vfAktif').checked };
    busy(b, true, 'Menyimpan…'); api('video.save', d).then(function (r) { busy(b, false); if (!r.success) { err.textContent = r.message; err.hidden = false; return; } toast(r.message); $('#drawer').hidden = true; pvVideo(); });
  }

  /* ---- PUSTAKA GAMBAR ---- */
  function pvMedia() {
    $('#pvBody').innerHTML = '<div class="card col"><div><h2>Unggah gambar & salin link</h2><p class="sub">Untuk gambar di bagian lain (slide hero, kartu isi produk, screenshot testimoni): unggah di sini, salin link-nya, lalu tempel ke kolom <code>gambar</code> / <code>screenshot</code> di Google Sheets. Beberapa gambar dalam satu sel dipisah tanda <code>|</code>.</p></div>'
      + '<div class="drop" id="mdDrop"><input type="file" id="mdFile" accept="image/png,image/jpeg,image/webp" multiple hidden><button class="btn btn-dark" type="button" data-act="mdpick">⬆ Pilih gambar</button><span class="hint">atau seret ke sini · dikompres otomatis (maks 1400 px)</span></div><div class="urls" id="mdList"></div></div>';
    mdList();
    var dz = $('#mdDrop'); ['dragenter', 'dragover'].forEach(function (ev) { dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add('over'); }); }); ['dragleave', 'drop'].forEach(function (ev) { dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove('over'); }); });
    dz.addEventListener('drop', function (e) { mdUpload(Array.prototype.slice.call(e.dataTransfer.files || [])); });
  }
  function mdList() { var el = $('#mdList'); if (!el) return; el.innerHTML = S.pv.media.map(function (u, i) { return '<div class="row"><img class="thumb" alt="" src="' + esc(imgSrc(u).replace('w1200', 'w200')) + '"><code>' + esc(u) + '</code><button class="btn btn-soft btn-sm" data-mdcopy="' + i + '">Salin link</button></div>'; }).join('') || '<p class="muted sm">Belum ada unggahan pada sesi ini.</p>'; }
  function mdUpload(files) {
    return files.reduce(function (p, f) { return p.then(function () { toast('Mengunggah ' + (f.name || 'gambar') + '…'); return uploadImage(f).then(function (u) { S.pv.media.unshift(u); mdList(); toast('Gambar diunggah.'); }, function (e) { toast(e.message, true); }); }); }, Promise.resolve());
  }

  /* ---------- event delegasi ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target, el;
    if ((el = t.closest('[data-go]'))) return go(el.dataset.go);
    if ((el = t.closest('[data-go-view]'))) return go(el.dataset.goView);
    if (t.closest('[data-x]')) { $('#drawer').hidden = true; return; }
    if ((el = t.closest('[data-pg]'))) { var p = el.dataset.pg.split(':'); if (p[0] === 'leads') { S.leads.f.halaman = +p[1]; loadLeads(); } else { S.crm.f.halaman = +p[1]; loadCrm(); } return; }
    if ((el = t.closest('[data-exp]'))) return exportLeads(el.dataset.exp);
    if ((el = t.closest('[data-det]'))) return crmDetail(el.dataset.det);
    if ((el = t.closest('[data-tab]'))) { S.waTab = el.dataset.tab; clearInterval(S.poll); return V.wa(); }
    if ((el = t.closest('[data-chip]'))) { var k = el.dataset.chip; S.crm.f[k] = S.crm.f[k] ? '' : true; S.crm.f.halaman = 1; return loadCrm(); }
    if ((el = t.closest('[data-bproc]'))) { busy(el, true, '…'); return api('wa.blastProcess', { blastId: el.dataset.bproc }).then(function (r) { toast(r.success ? 'Batch diproses: ' + r.data.proses.terkirim + ' terkirim, ' + r.data.proses.gagal + ' gagal.' : r.message, !r.success); loadBlasts(); }); }
    if ((el = t.closest('[data-bstop]'))) { if (!confirm('Hentikan blast ini? Pesan yang belum terkirim dibatalkan.')) return; return api('wa.blastStop', { blastId: el.dataset.bstop }).then(function (r) { toast(r.message, !r.success); loadBlasts(); }); }
    if ((el = t.closest('[data-dsave]'))) { var d = { kontakId: el.dataset.dsave, nama: $('#dNama').value, email: $('#dEmail').value, tag: $('#dTag').value, catatan: $('#dCat').value, optOut: $('#dOut').checked }; if (!$('#dWa').disabled) d.wa = $('#dWa').value; busy(el, true, 'Menyimpan…'); return api('crm.save', d).then(function (r) { busy(el, false); toast(r.message, !r.success); if (r.success) { loadCrm(); crmDetail(d.kontakId); } }); }
    if ((el = t.closest('[data-dint]'))) { return api('crm.interaksi', { kontakId: el.dataset.dint, kanal: $('#iKanal').value, ringkasan: $('#iTeks').value }).then(function (r) { toast(r.message, !r.success); if (r.success) crmDetail(el.dataset.dint); }); }
    if ((el = t.closest('[data-ptab]'))) { S.pv.tab = el.dataset.ptab; return V.produk(); }
    if (t.closest('[data-pnew]')) return pfOpen(null);
    if ((el = t.closest('[data-pedit]'))) return pfOpen(S.pv.rows.filter(function (p) { return p.id === el.dataset.pedit; })[0]);
    if ((el = t.closest('[data-pdel]'))) { var pp = S.pv.rows.filter(function (p) { return p.id === el.dataset.pdel; })[0]; if (!pp || !confirm('Hapus produk "' + pp.nama + '" dari katalog? Tindakan ini tidak dapat dibatalkan.')) return; return api('katalog.hapus', { id: pp.id }).then(function (r) { toast(r.message, !r.success); pvProduk(); }); }
    if (t.closest('[data-vnew]')) return vfOpen(null);
    if ((el = t.closest('[data-vedit]'))) return vfOpen(S.pv.vrows.filter(function (v) { return v.id === el.dataset.vedit; })[0]);
    if ((el = t.closest('[data-vdel]'))) { var vv = S.pv.vrows.filter(function (v) { return v.id === el.dataset.vdel; })[0]; if (!vv || !confirm('Hapus video "' + vv.judul + '"?')) return; return api('video.hapus', { id: vv.id }).then(function (r) { toast(r.message, !r.success); pvVideo(); }); }
    if ((el = t.closest('[data-imgd]'))) { S.pf.gambar.splice(+el.dataset.imgd, 1); return pfImgs(); }
    if ((el = t.closest('[data-imgl]'))) { var i = +el.dataset.imgl, g = S.pf.gambar; if (i > 0) { var x = g[i]; g[i] = g[i - 1]; g[i - 1] = x; } return pfImgs(); }
    if ((el = t.closest('[data-imgr]'))) { var j = +el.dataset.imgr, h = S.pf.gambar; if (j < h.length - 1) { var y = h[j]; h[j] = h[j + 1]; h[j + 1] = y; } return pfImgs(); }
    if ((el = t.closest('[data-mdcopy]'))) return copyText(S.pv.media[+el.dataset.mdcopy]);
    if ((el = t.closest('[data-act]'))) return act(el.dataset.act, el);
  });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.matches('[data-selall]')) { $$('[data-sel]').forEach(function (c) { c.checked = t.checked; if (t.checked) S.leads.sel[c.dataset.sel] = 1; else delete S.leads.sel[c.dataset.sel]; }); updBulk(); }
    else if (t.matches('[data-sel]')) { if (t.checked) S.leads.sel[t.dataset.sel] = 1; else delete S.leads.sel[t.dataset.sel]; updBulk(); }
    else if (t.matches('[data-st]')) api('leads.update', { ids: [t.dataset.st], status: t.value }).then(function (r) { toast(r.success ? 'Status diperbarui.' : r.message, !r.success); });
    else if (t.matches('[data-ptog]')) api('katalog.save', { id: t.dataset.ptog, aktif: t.checked }).then(function (r) { toast(r.success ? (t.checked ? 'Produk ditampilkan.' : 'Produk disembunyikan.') : r.message, !r.success); if (!r.success) pvProduk(); });
    else if (t.matches('[data-vtog]')) api('video.save', { id: t.dataset.vtog, aktif: t.checked }).then(function (r) { toast(r.success ? (t.checked ? 'Video ditampilkan.' : 'Video disembunyikan.') : r.message, !r.success); pvVideo(); });
    else if (t.id === 'pfFile') { pfUpload(Array.prototype.slice.call(t.files || [])); t.value = ''; }
    else if (t.id === 'mdFile') { mdUpload(Array.prototype.slice.call(t.files || [])); t.value = ''; }
    else if (t.matches('[data-crall]')) { $$('[data-cr]').forEach(function (c) { c.checked = t.checked; if (t.checked) S.crm.sel[c.dataset.cr] = 1; else delete S.crm.sel[c.dataset.cr]; }); updCrBulk(); }
    else if (t.matches('[data-cr]')) { if (t.checked) S.crm.sel[t.dataset.cr] = 1; else delete S.crm.sel[t.dataset.cr]; updCrBulk(); }
  });
  document.addEventListener('click', function (e) { if (e.target && e.target.id === 'ldApply') { var ids = Object.keys(S.leads.sel); api('leads.update', { ids: ids, status: $('#ldBulkSt').value }).then(function (r) { toast(r.message, !r.success); S.leads.sel = {}; loadLeads(); }); } });

  function act(a, b) {
    var ids = function (m) { return Object.keys(m); };
    switch (a) {
      case 'pfpick': return $('#pfFile').click();
      case 'pfaddurl': var u = $('#pfUrl').value.trim(); if (!/^https?:\/\//i.test(u)) return toast('Link gambar harus diawali http:// atau https://', true); if (S.pf.gambar.length >= 8) return toast('Maksimal 8 gambar per produk.', true); S.pf.gambar.push(u); $('#pfUrl').value = ''; return pfImgs();
      case 'pfsave': return pfSave(b);
      case 'vfsave': return vfSave(b);
      case 'mdpick': return $('#mdFile').click();
      case 'crmsync': busy(b, true, 'Sinkron…'); return api('crm.sync', {}).then(function (r) { busy(b, false); toast(r.message, !r.success); V.crm(); });
      case 'crmimp': return $('#crFile').click();
      case 'crmexp': return api('crm.export', S.crm.f).then(function (r) { if (r.success) exportRows(r.data.rows, 'Kontak-CRM-' + new Date().toISOString().slice(0, 10), 'xlsx'); else toast(r.message, true); });
      case 'crtag': var tag = prompt('Nama tag untuk ' + ids(S.crm.sel).length + ' kontak:'); if (!tag) return; return api('crm.bulk', { ids: ids(S.crm.sel), aksi: 'tag', nilai: tag }).then(function (r) { toast(r.message, !r.success); S.crm.sel = {}; loadCrm(); });
      case 'crwa': return api('crm.bulk', { ids: ids(S.crm.sel).slice(0, 50), aksi: 'deteksiWA' }).then(function (r) { toast(r.message, !r.success); S.crm.sel = {}; loadCrm(); });
      case 'crout': if (!confirm('Tandai opt-out? Kontak tidak akan menerima blast.')) return; return api('crm.bulk', { ids: ids(S.crm.sel), aksi: 'optout' }).then(function (r) { toast(r.message, !r.success); S.crm.sel = {}; loadCrm(); });
      case 'crmerge': var sel = ids(S.crm.sel); if (sel.length < 2) return toast('Pilih minimal 2 kontak.', true); if (!confirm('Gabungkan ' + sel.length + ' kontak ke yang pertama dipilih?')) return; return api('crm.merge', { utama: sel[0], gabung: sel.slice(1) }).then(function (r) { toast(r.message, !r.success); S.crm.sel = {}; loadCrm(); });
      case 'audload': return loadAudience();
      case 'audcheck': if (!S.aud) return toast('Muat penerima dulu.', true); var nm = S.aud.rows.filter(function (x) { return x.valid && !x.ganda && !x.statusWA; }).slice(0, 50).map(function (x) { return x.hp; }); if (!nm.length) return toast('Semua nomor sudah dicek.'); busy(b, true, 'Mengecek…'); return api('wa.validate', { nomor: nm }).then(function (r) { busy(b, false); toast(r.success ? nm.length + ' nomor dicek.' : r.message, !r.success); if (r.success) loadAudience(); });
      case 'blastgo': return createBlast(b);
      case 'blastref': return loadBlasts();
      case 'qproc': busy(b, true, 'Memproses…'); return api('notif.processNow', {}).then(function (r) { busy(b, false); toast(r.success ? 'Diproses: ' + r.data.terkirim + ' terkirim, ' + r.data.gagal + ' gagal.' : r.message, !r.success); loadQueue(); });
      case 'qretry': return api('notif.retry', {}).then(function (r) { toast(r.message, !r.success); loadQueue(); });
      case 'cdev': return api('wa.device', {}).then(function (r) { $('#devInfo').textContent = r.success ? 'Perangkat ' + r.data.device + ' · ' + r.data.status + ' · paket ' + r.data.paket + ' · kuota ' + r.data.kuota : r.message; });
      case 'ctokdel': if (!confirm('Hapus token Fonnte?')) return; return api('notif.configSave', { token: '__HAPUS__', waAktif: false }).then(function (r) { toast(r.message, !r.success); waConfig(); });
      case 'twa': return api('wa.test', { nomor: $('#tWa').value }).then(function (r) { toast(r.message, !r.success); });
      case 'tem': return api('email.test', { email: $('#tEm').value }).then(function (r) { toast(r.message, !r.success); });
      case 'csave': return saveConfig(b);
      case 'setsave':
        var pg = {}, pr = {}; $$('[data-set]').forEach(function (i) { pg[i.dataset.set] = i.type === 'checkbox' ? (i.checked ? 'YA' : 'TIDAK') : i.value; }); $$('[data-pr]').forEach(function (i) { pr[i.dataset.pr] = i.value; });
        busy(b, true, 'Menyimpan…'); return api('settings.save', { pengaturan: pg, produk: pr }).then(function (r) { busy(b, false); toast(r.message, !r.success); });
      case 'gcidsave': return api('rahasia.simpan', { kunci: 'GOOGLE_CLIENT_ID', nilai: $('#gcid').value }).then(function (r) { toast(r.message, !r.success); if (r.success) V.pengaturan(); });
      case 'rotate': return api('auth.rotasi', { sandiLama: $('#rOld').value, sandiBaru: $('#rNew').value }).then(function (r) { if (r.success) { toast(r.message); setTimeout(function () { logout('Sandi diperbarui. Masuk dengan sandi baru.'); }, 900); } else toast(r.message, true); });
      case 'logoutall': if (!confirm('Keluarkan semua perangkat, termasuk perangkat ini?')) return; return api('auth.logoutAll', {}).then(function () { logout('Semua perangkat dikeluarkan.'); });
      case 'cacheclear': busy(b, true, 'Menghapus…'); return api('cache.clear', {}).then(function (r) { busy(b, false); toast(r.message, !r.success); });
      case 'mgscan': return migrate(true, b);
      case 'mgrun': return migrate(false, b);
    }
  }
  function loadAudience() {
    var man = $('input[name=aud]:checked').value === 'manual';
    api('wa.audience', man ? { sumber: 'manual', teks: $('#aTxt').value } : { sumber: 'crm', segmen: $('#aSeg').value.trim(), tag: $('#aTag').value.trim(), statusWA: $('#aSt').value }).then(function (r) {
      if (!r.success) return toast(r.message, true); S.aud = r.data; var s = r.data.ringkas;
      $('#audSum').innerHTML = '<b>' + num(s.total) + '</b> baris · <span class="badge g">' + num(s.valid) + ' valid</span> <span class="badge r">' + num(s.tidakValid) + ' tidak valid</span> <span class="badge y">' + num(s.ganda) + ' ganda</span> <span class="badge r">' + num(s.optOut) + ' opt-out</span> <span class="badge s">' + num(s.terdaftarWA) + ' terdaftar WA</span> <span class="badge">' + num(s.tidakTerdaftarWA) + ' tidak di WA</span>';
    });
  }
  function createBlast(b) {
    if (!S.aud) return toast('Muat penerima dulu.', true); var skip = $('#bSkip').checked;
    var rec = S.aud.rows.filter(function (x) { return x.valid && !x.ganda && !x.optOut && !(skip && x.statusWA === 'Tidak Terdaftar'); }).map(function (x) { return { nama: x.nama, hp: x.hp }; });
    var pesan = $('#bPesan').value.trim(), judul = $('#bJudul').value.trim(), batch = +$('input[name=bb]:checked').value;
    if (!judul || !pesan) return toast('Judul dan isi pesan wajib diisi.', true); if (!rec.length) return toast('Tidak ada penerima valid.', true);
    if (!confirm('Kirim ke ' + num(rec.length) + ' penerima, ' + batch + ' pesan per menit (±' + Math.ceil(rec.length / batch) + ' menit)?\n\nPastikan penerima memang bersedia dihubungi.')) return;
    busy(b, true, 'Membuat…'); api('wa.blastCreate', { judul: judul, pesan: pesan, ukuranBatch: batch, jeda: $('#bJeda').value.trim() || '5', sasaran: $('input[name=aud]:checked').value === 'manual' ? 'manual' : ($('#aSeg').value || 'semua CRM'), penerima: rec }).then(function (r) { busy(b, false); toast(r.message, !r.success); if (r.success) loadBlasts(); });
  }

  /* ---------- mulai ---------- */
  $('#btnLogout').addEventListener('click', function () { logout(''); });
  $('#menuBtn').addEventListener('click', function () { $('#side').classList.add('open'); $('#scrim').hidden = false; });
  $('#scrim').addEventListener('click', function () { $('#side').classList.remove('open'); $('#scrim').hidden = true; });
  window.addEventListener('hashchange', function () { if (location.hash === '#darurat' && !S.me) $('#darForm').hidden = false; });
  if (!S.tok) { showLogin(''); initLogin(); }
  else api('auth.me', {}).then(function (r) { if (r.success) { enter({ email: r.data.email, role: r.data.role, nama: r.data.nama, darurat: r.data.darurat }); } else { logout(r.config ? r.message : ''); initLogin(); } });
})();
