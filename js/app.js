/* ============================================================
 * app.js — logika halaman penjualan
 * Alur data: cache lokal (SWR) → render instan → ambil terbaru dari GAS → render ulang bila berubah.
 * Tanpa GAS_URL / server tak terjangkau → mode demo (DEMO_DATA), lead tidak tercatat.
 * ============================================================ */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.Effects ? Effects.reduce : false;
  var DATA = null, MODE = 'live', CLEAN = [], BUY_LOC = 'halaman', GO_TIMER = 0, CACHE_KEY = 'nd_pub_v1';
  var vid = (function () { try { var v = localStorage.getItem('nd_vid'); if (!v) { v = Math.random().toString(36).slice(2, 12) + Date.now().toString(36); localStorage.setItem('nd_vid', v); } return v; } catch (e) { return 'anon' + Math.random().toString(36).slice(2, 8); } })();

  /* ---------- util ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function rp(n) { return 'Rp ' + (Number(n) || 0).toLocaleString('id-ID'); }
  function icon(n, c) { return '<svg class="ic ' + (c || '') + '" aria-hidden="true"><use href="#i-' + n + '"/></svg>'; }
  function hp08(v) { var s = String(v || '').replace(/[^0-9+]/g, '').replace(/^\+/, ''); if (!s) return ''; if (s.indexOf('62') === 0) s = '0' + s.slice(2); else if (s[0] === '8') s = '0' + s; return s; }
  function hp62(v) { var s = hp08(v); return s ? (s[0] === '0' ? '62' + s.slice(1) : s) : ''; }
  function hpOk(v) { return /^08\d{8,11}$/.test(hp08(v)); }
  function stars(n) { var h = ''; for (var i = 1; i <= 5; i++) h += icon('star', i <= n ? '' : 'off'); return '<span class="stars" aria-label="Rating ' + n + ' dari 5">' + h + '</span>'; }
  function initials(n) { return String(n || '?').trim().split(/\s+/).slice(0, 2).map(function (x) { return x[0]; }).join('').toUpperCase(); }
  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  var toastT; function toast(m) { var t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('show'); }, 3200); }
  function P(k, d) { var v = DATA && DATA.produk && DATA.produk[k]; return v == null || v === '' ? (d || '') : v; }
  function isLink(u) { return /^https?:\/\//i.test(u || '') && !/GANTI|XXXX/.test(u); }

  /* ---------- atribusi sumber trafik (UTM) ---------- */
  function attribution() {
    try { var s = sessionStorage.getItem('nd_attr'); if (s) return JSON.parse(s); } catch (e) {}
    var q = new URLSearchParams(location.search), a = { utm_source: q.get('utm_source') || q.get('ref') || q.get('src') || '', utm_medium: q.get('utm_medium') || '', utm_campaign: q.get('utm_campaign') || q.get('c') || '' };
    if (!a.utm_source && document.referrer) { try { var h = new URL(document.referrer).hostname.replace(/^(www|l|m|lm)\./, ''); if (h && h !== location.hostname) a.utm_source = h.split('.')[0]; } catch (e) {} }
    try { sessionStorage.setItem('nd_attr', JSON.stringify(a)); } catch (e) {}
    return a;
  }

  /* ---------- gambar bawaan (SVG) bila belum ada foto dari Drive ---------- */
  var PAL = [['#CFE3DA', '#F7F3EC', '#E8805E'], ['#D6E6F2', '#F7F3EC', '#1F2D3A'], ['#F9D9CB', '#FDF9F2', '#2C6A4D'], ['#D5EBDD', '#F7F3EC', '#E8805E']];
  function uri(s) { return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s); }
  function R(x, y, w, h, r, f, o) { return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + r + '" fill="' + f + '"' + (o ? ' opacity="' + o + '"' : '') + '/>'; }
  function coverCard(i, v, label) {
    var p = PAL[i % 4], b = '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + p[0] + '"/><stop offset="1" stop-color="' + p[1] + '"/></linearGradient></defs><rect width="800" height="500" fill="url(#g)"/>';
    b += '<circle cx="' + (v ? 650 : 140) + '" cy="110" r="74" fill="' + p[2] + '" opacity=".16"/><path d="M0 380C140 330 260 340 400 380S660 420 800 360V500H0Z" fill="#fff" opacity=".55"/><path d="M0 430C160 390 300 410 440 440S700 470 800 420V500H0Z" fill="' + p[2] + '" opacity=".14"/>';
    b += R(180, 70, 440, 270, 28, '#fff') + R(206, 98, 120, 14, 7, p[2], .85) + R(206, 122, 200, 10, 5, '#E6E0D5');
    if (!v) { [60, 110, 80, 150, 120, 170].forEach(function (h, k) { b += R(214 + k * 64, 318 - h, 40, h, 10, k % 2 ? p[0] : p[2], k % 2 ? 1 : .9); }); }
    else { [0, 1, 2].forEach(function (k) { b += '<circle cx="' + 226 + '" cy="' + (178 + k * 46) + '" r="14" fill="' + p[0] + '"/><path d="M219 ' + (178 + k * 46) + 'l5 5 9-10" stroke="' + p[2] + '" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' + R(254, 170 + k * 46, 250 - k * 30, 12, 6, '#E6E0D5') + R(254, 188 + k * 46, 150, 8, 4, '#EFE9DE'); }); }
    b += '<text x="400" y="408" text-anchor="middle" font-family="Plus Jakarta Sans,Arial,sans-serif" font-weight="800" font-size="30" fill="#1F2D3A">' + esc(label || '') + '</text>';
    return uri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500">' + b + '</svg>');
  }
  function coverHero(v) {
    var b = '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FDF9F2"/><stop offset="1" stop-color="#CFE3DA"/></linearGradient></defs><rect width="540" height="1140" fill="url(#g)"/>';
    b += R(34, 40, 90, 12, 6, '#1F2D3A', .55) + R(430, 40, 74, 12, 6, '#1F2D3A', .35) + '<circle cx="460" cy="120" r="150" fill="#F9D9CB" opacity=".7"/><path d="M0 900C120 840 250 860 330 910S480 960 540 900V1140H0Z" fill="#CFE3DA"/><path d="M0 1000C150 950 300 990 540 960V1140H0Z" fill="#1F2D3A" opacity=".9"/>';
    if (v === 0) {
      b += R(34, 104, 200, 22, 11, '#1F2D3A') + R(34, 138, 140, 12, 6, '#5C6A79', .5);
      b += R(34, 180, 228, 130, 26, '#E8805E') + R(58, 208, 90, 12, 6, '#fff', .8) + R(58, 236, 130, 34, 12, '#fff') + R(278, 180, 228, 130, 26, '#fff') + R(302, 208, 90, 12, 6, '#1F2D3A', .35) + R(302, 236, 110, 34, 12, '#CFE3DA');
      b += R(34, 338, 472, 270, 26, '#fff'); [90, 140, 110, 180, 150, 210, 240].forEach(function (h, k) { b += R(62 + k * 62, 580 - h, 38, h, 10, k === 6 ? '#E8805E' : '#CFE3DA'); });
      [0, 1, 2].forEach(function (k) { b += R(34, 636 + k * 78, 472, 62, 18, '#fff') + '<circle cx="70" cy="' + (667 + k * 78) + '" r="18" fill="' + ['#F9D9CB', '#D5EBDD', '#D6E6F2'][k] + '"/>' + R(104, 652 + k * 78, 150, 11, 5, '#1F2D3A', .7) + R(104, 672 + k * 78, 100, 9, 4, '#5C6A79', .35) + R(410, 653 + k * 78, 70, 28, 14, '#E8805E', .85); });
    } else if (v === 1) {
      b += R(34, 104, 150, 16, 8, '#1F2D3A') + R(34, 150, 440, 26, 13, '#1F2D3A') + R(34, 190, 360, 26, 13, '#1F2D3A') + R(34, 238, 400, 12, 6, '#5C6A79', .5) + R(34, 260, 300, 12, 6, '#5C6A79', .5) + R(34, 296, 190, 54, 27, '#E8805E') + R(250, 296, 150, 54, 27, '#fff');
      [0, 1, 2].forEach(function (k) { b += R(34 + k * 160, 400, 148, 150, 22, '#fff') + '<circle cx="' + (70 + k * 160) + '" cy="444" r="20" fill="' + ['#F9D9CB', '#D5EBDD', '#D6E6F2'][k] + '"/>' + R(52 + k * 160, 484, 90, 11, 5, '#1F2D3A', .7) + R(52 + k * 160, 506, 70, 9, 4, '#5C6A79', .35); });
      b += R(34, 586, 472, 150, 24, '#fff') + '<circle cx="74" cy="634" r="22" fill="#F9D9CB"/>' + R(110, 620, 130, 12, 6, '#1F2D3A', .7) + R(110, 642, 90, 10, 5, '#E8805E') + R(58, 676, 420, 10, 5, '#E6E0D5') + R(58, 698, 340, 10, 5, '#E6E0D5');
      b += R(34, 764, 472, 110, 24, '#14202B') + R(62, 794, 170, 14, 7, '#fff', .9) + R(62, 822, 120, 28, 14, '#E8805E');
    } else {
      b += R(0, 90, 540, 78, 0, '#1F2D3A') + '<circle cx="64" cy="129" r="24" fill="#CFE3DA"/>' + R(104, 112, 160, 14, 7, '#fff', .95) + R(104, 136, 90, 10, 5, '#fff', .55);
      var chat = [[0, 200, 300, 70], [1, 296, 250, 56], [0, 380, 340, 96], [1, 502, 210, 56], [0, 584, 300, 70], [1, 680, 280, 56]];
      chat.forEach(function (c) { var x = c[0] ? 540 - 34 - c[2] : 34; b += R(x, c[1], c[2], c[3], 22, c[0] ? '#DCF8C6' : '#fff') + R(x + 20, c[1] + 18, c[2] - 60, 11, 5, '#1F2D3A', .55) + (c[3] > 60 ? R(x + 20, c[1] + 40, c[2] - 110, 11, 5, '#1F2D3A', .3) : ''); });
      b += R(34, 790, 472, 56, 28, '#fff') + R(60, 811, 190, 12, 6, '#E6E0D5') + '<circle cx="470" cy="818" r="20" fill="#25D366"/>';
    }
    return uri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 1140" preserveAspectRatio="xMidYMid slice">' + b + '</svg>');
  }

  /* ---------- slideshow otomatis ---------- */
  function Slideshow(el, slides, o) {
    o = o || {}; var n = slides.length, i = 0, tm = 0, paused = false, vis = true, sx = null;
    if (!el || !n) return;
    el.classList.toggle('has-cap', !!o.caption);
    el.innerHTML = slides.map(function (s, k) { return '<div class="slide' + (k ? '' : ' on') + '"><img alt="' + esc(s.alt || '') + '" src="' + esc(s.src) + '" decoding="async" referrerpolicy="no-referrer"' + (k ? ' loading="lazy"' : '') + '></div>'; }).join('')
      + (o.caption ? '<div class="slide-cap"><b></b><span></span></div>' : '')
      + (n > 1 ? '<div class="dots">' + slides.map(function (_, k) { return '<button type="button" aria-label="Gambar ' + (k + 1) + '"' + (k ? '' : ' class="on"') + '></button>'; }).join('') + '</div>' : '');
    var imgs = $$('.slide img', el), sl = $$('.slide', el), dots = $$('.dots button', el), cap = $('.slide-cap', el);
    imgs.forEach(function (im, k) { im.addEventListener('error', function () { if (slides[k].fb && im.getAttribute('src') !== slides[k].fb) im.src = slides[k].fb; }); });
    function caption() { if (!cap) return; var s = slides[i]; $('b', cap).textContent = s.title || ''; $('span', cap).textContent = s.sub || ''; cap.style.opacity = s.title ? 1 : 0; }
    function go(k) { i = (k + n) % n; sl.forEach(function (e, j) { e.classList.toggle('on', j === i); }); dots.forEach(function (e, j) { e.classList.toggle('on', j === i); }); caption(); }
    function sched() { clearTimeout(tm); if (n < 2 || reduce) return; tm = setTimeout(function () { if (!paused && vis && !document.hidden) go(i + 1); sched(); }, (o.interval || 4200) + (o.offset || 0)); }
    dots.forEach(function (d, k) { d.addEventListener('click', function (e) { e.stopPropagation(); go(k); sched(); }); });
    el.addEventListener('pointerenter', function () { paused = true; }); el.addEventListener('pointerleave', function () { paused = false; });
    el.addEventListener('pointerdown', function (e) { sx = e.clientX; }); el.addEventListener('pointerup', function (e) { if (sx != null && Math.abs(e.clientX - sx) > 40) { go(i + (e.clientX < sx ? 1 : -1)); sched(); } sx = null; });
    var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) { vis = es[0].isIntersecting; }, { threshold: .1 }) : null; if (io) io.observe(el);
    caption(); sched();
    CLEAN.push(function () { clearTimeout(tm); if (io) io.disconnect(); });
  }

  /* ---------- render ---------- */
  function head(eyebrow, title, sub) { return '<div class="sec-head reveal">' + (eyebrow ? '<div class="eyebrow">' + esc(eyebrow) + '</div>' : '') + '<h2 class="h2">' + esc(title) + '</h2>' + (sub ? '<p class="lead">' + esc(sub) + '</p>' : '') + '</div>'; }
  function waUrl(nama, extra) {
    var msg = (P('wa_pesan', 'Halo, saya tertarik dengan {produk}.')).replace(/\{produk\}/g, P('nama_produk')).replace(/\{nama\}/g, nama || '');
    return 'https://wa.me/' + hp62(P('wa_cs')) + '?text=' + encodeURIComponent(msg + (extra || ''));
  }
  function payUrl() { return isLink(P('link_bayar')) ? P('link_bayar') : waUrl(''); }
  function saklar(k) { return !DATA.saklar || DATA.saklar[k] !== false; }

  function render() {
    CLEAN.forEach(function (f) { try { f(); } catch (e) {} }); CLEAN = [];
    var d = DATA, p = d.produk || {}, brand = p.brand || 'Nusantara Digital';
    document.title = (p.nama_produk ? p.nama_produk + ' — ' : '') + brand;
    var md = $('meta[name="description"]'); if (md && p.subheadline) md.content = p.subheadline;
    $('#logoText').textContent = brand;

    /* hero */
    var trust = [p.trust_1, p.trust_2, p.trust_3].filter(Boolean), tic = ['bolt', 'shield', 'headset'];
    $('#heroCopy').innerHTML =
      '<div class="eyebrow">' + esc(p.eyebrow || '') + '</div><h1 class="h1">' + esc(p.headline) + '</h1><p class="lead">' + esc(p.subheadline) + '</p>'
      + '<div class="hero-cta"><button class="btn btn-cta" data-buy="hero" type="button"><span class="btn-label">Beli Sekarang</span>' + icon('arrow') + '</button>'
      + '<a class="btn btn-ghost" data-wa="hero" href="' + esc(waUrl('')) + '" target="_blank" rel="noopener">' + icon('wa') + ' ' + esc(p.wa_label || 'Chat via WhatsApp') + '</a></div>'
      + '<ul class="trust">' + trust.map(function (t, i) { return '<li>' + icon(tic[i % 3]) + esc(t) + '</li>'; }).join('') + '</ul>';
    $('#heroVisual').innerHTML = '<div class="device"><div class="device-notch"></div><div class="slideshow" id="heroSlides"></div></div>'
      + '<div class="float-chip c1">' + icon('bolt') + 'Lead tercatat otomatis</div><div class="float-chip c2">' + icon('wa') + 'Notifikasi WhatsApp</div>'
      + (p.catatan_hero ? '<div class="hero-note"><span class="script">' + esc(p.catatan_hero) + '</span><svg viewBox="0 0 60 60" aria-hidden="true"><path d="M6 8c22 0 42 14 44 40M40 38l10 12 9-14"/></svg></div>' : '');
    var hs = []; (d.hero || []).forEach(function (h, i) {
      var imgs = (h.gambar && h.gambar.length) ? h.gambar : [null];
      imgs.forEach(function (u) { hs.push({ src: u || coverHero(i % 3), fb: coverHero(i % 3), title: h.judul, sub: h.subjudul, alt: h.judul }); });
    });
    if (!hs.length) hs = [0, 1, 2].map(function (i) { return { src: coverHero(i), title: ['Dashboard Lead Realtime', 'Landing Page Siap Pakai', 'Blast WhatsApp Aman'][i], sub: '' }; });
    Slideshow($('#heroSlides'), hs, { caption: true, interval: 4300 });

    /* masalah */
    var pains = d.masalah || [], ico = { wallet: 'wallet', gauge: 'gauge', table: 'table', message: 'message' };
    $('#masalahRoot').innerHTML = pains.length ? head('Masalah yang sering terjadi', p.masalah_judul, p.masalah_sub)
      + '<div class="grid g4">' + pains.map(function (m, i) { return '<article class="card spot glow tilt pain reveal" style="--d:' + (i * .08) + 's"><div class="ic-badge">' + icon(ico[m.ikon] || 'bolt') + '</div><h3 class="h3">' + esc(m.judul) + '</h3><p>' + esc(m.deskripsi) + '</p></article>'; }).join('') + '</div>' : '';
    $('#masalah').hidden = !pains.length;

    /* solusi */
    var poin = String(p.solusi_poin || '').split('|').filter(Boolean);
    $('#solusiRoot').innerHTML = '<div class="sol"><div class="sol-media reveal" id="solSlides"></div><div class="sol-copy reveal"><div class="eyebrow">Solusi untuk Anda</div><h2 class="h2">' + esc(p.solusi_judul) + '</h2><p class="lead">' + esc(p.solusi_deskripsi) + '</p>'
      + '<ul class="ticks">' + poin.map(function (t) { return '<li>' + icon('check') + '<span>' + esc(t) + '</span></li>'; }).join('') + '</ul>'
      + '<button class="btn btn-cta" data-buy="solusi" type="button"><span class="btn-label">Beli Sekarang</span>' + icon('arrow') + '</button></div></div>';
    var sf = []; (d.fitur || []).slice(0, 4).forEach(function (f, i) { (f.gambar && f.gambar.length ? f.gambar : [null]).slice(0, 1).forEach(function (u) { sf.push({ src: u || coverCard(i, i % 2, f.judul.split(':')[0]), fb: coverCard(i, i % 2, f.judul.split(':')[0]), alt: f.judul }); }); });
    if (!sf.length) sf = [{ src: coverCard(0, 0, 'Produk Digital') }, { src: coverCard(1, 1, 'Produk Digital') }];
    Slideshow($('#solSlides'), sf, { interval: 3800 });

    /* isi produk */
    var fit = d.fitur || [];
    $('#isiRoot').innerHTML = head('Isi paket', p.isi_judul, p.isi_sub) + '<div class="grid g3">' + fit.map(function (f, i) {
      return '<article class="card feat spot glow tilt reveal" style="--d:' + ((i % 3) * .08) + 's"><div class="feat-media slideshow" data-feat="' + i + '"></div><div class="feat-body">'
        + (f.tag ? '<span class="tag">' + esc(f.tag) + '</span>' : '') + '<h3 class="h3">' + esc(f.judul) + '</h3><p>' + esc(f.deskripsi) + '</p>' + (f.nilai ? '<span class="nilai">' + esc(f.nilai) + '</span>' : '') + '</div></article>';
    }).join('') + '</div>';
    $$('.feat-media').forEach(function (el, i) {
      var f = fit[i], lbl = String(f.judul).split(':')[0], sl = (f.gambar && f.gambar.length ? f.gambar.map(function (u, k) { return { src: u, fb: coverCard(i, k % 2, lbl), alt: f.judul }; }) : [{ src: coverCard(i, 0, lbl), alt: f.judul }, { src: coverCard(i, 1, lbl), alt: f.judul }]);
      Slideshow(el, sl, { interval: 3600, offset: i * 420 });
    });

    /* statistik */
    var st = d.statistik || [];
    $('#statRoot').innerHTML = st.length ? head('', p.statistik_judul) + '<div class="stats">' + st.map(function (s, i) { return '<div class="stat reveal" style="--d:' + (i * .08) + 's"><b data-count="' + esc(s.angka) + '">' + esc(s.angka) + '</b><span>' + esc(s.label) + '</span></div>'; }).join('') + '</div>' : '';
    $('#statistik').hidden = !st.length;

    /* testimoni */
    var ts = (d.testimoni || []), showT = saklar('SHOW_TESTIMONI') && ts.length, bg = ['#F9D9CB', '#D5EBDD', '#D6E6F2', '#F6E6B8'];
    $('#ulasan').hidden = !showT; $('#ulasanRoot').innerHTML = '';
    if (showT) {
      $('#ulasanRoot').innerHTML = head('Testimoni', p.testimoni_judul, p.testimoni_sub) + '<div class="tgrid" id="tgrid">' + ts.map(function (t, i) {
        var first = String(t.ulasan).split(/(?<=[.!?])\s/)[0];
        return '<div class="flip reveal" style="--d:' + ((i % 3) * .08) + 's" data-i="' + i + '" role="button" tabindex="0" aria-label="Baca testimoni lengkap ' + esc(t.nama) + '"><div class="flip-in">'
          + '<div class="face front"><div class="t-head"><div class="avatar" style="background:' + bg[i % 4] + '">' + esc(initials(t.nama)) + '</div><div><b>' + esc(t.nama) + '</b><span>' + esc(t.kota) + '</span></div></div>' + stars(t.rating)
          + '<p class="t-text">' + esc(t.ulasan) + '</p><div class="t-hint">' + icon('plus') + ' Klik untuk baca lengkap</div></div>'
          + '<div class="face back">' + icon('quote', 'q') + '<p class="t-sum">' + esc(first.length > 150 ? first.slice(0, 147) + '…' : first) + '</p><div class="t-foot"><span>' + esc(t.nama) + ' · ' + esc(t.kota) + '</span><span class="pill">Baca lengkap</span></div></div></div><div class="spot-layer"></div></div>';
      }).join('') + '</div>';
      initFlip($('#tgrid'));
    }

    /* harga */
    renderPrice();

    /* faq */
    var fq = d.faq || [];
    $('#faqRoot').innerHTML = fq.length ? head('FAQ', p.faq_judul) + '<div class="faq">' + fq.map(function (q, i) {
      return '<div class="qa card spot reveal' + (i === 0 ? ' open' : '') + '" style="--d:' + (i * .05) + 's"><button class="qa-q" type="button" aria-expanded="' + (i === 0) + '"><span>' + esc(q.pertanyaan) + '</span>' + icon('plus') + '</button><div class="qa-a"><div><p>' + esc(q.jawaban) + '</p></div></div></div>';
    }).join('') + '</div>' : '';
    $('#faq').hidden = !fq.length;

    /* cta akhir + footer */
    $('#ctaRoot').innerHTML = '<div class="cta-box reveal"><h2 class="h2">' + esc(p.cta_akhir_judul) + '</h2><p class="lead">' + esc(p.cta_akhir_sub) + '</p><div class="cta-row"><button class="btn btn-cta" data-buy="akhir" type="button"><span class="btn-label">Ambil Promo Sekarang</span>' + icon('arrow') + '</button><a class="btn btn-ghost" data-wa="akhir" href="' + esc(waUrl('')) + '" target="_blank" rel="noopener">' + icon('wa') + ' Konsultasi Gratis</a></div></div>';
    var soc = [p.instagram && ['Instagram', p.instagram], p.tiktok && ['TikTok', p.tiktok]].filter(Boolean).filter(function (x) { return isLink(x[1]); });
    $('#footerRoot').innerHTML = '<div class="foot-grid"><div><a class="logo foot-logo" href="#beranda"><span class="logo-mark">' + '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 3c4 3 5 7 0 15C7 10 8 6 12 3z" fill="currentColor"/></svg></span>' + esc(brand) + '</a><p>' + esc(p.footer_deskripsi) + '</p></div>'
      + '<div><h4>Bantuan</h4><a href="' + esc(waUrl('')) + '" data-wa="footer" target="_blank" rel="noopener">WhatsApp CS</a>' + (p.email_cs ? '<a href="mailto:' + esc(p.email_cs) + '">' + esc(p.email_cs) + '</a>' : '') + soc.map(function (s) { return '<a href="' + esc(s[1]) + '" target="_blank" rel="noopener">' + s[0] + '</a>'; }).join('') + '</div>'
      + '<div><h4>Informasi</h4><a href="#" data-info="privasi">Kebijakan Privasi</a><a href="#" data-info="syarat">Syarat &amp; Ketentuan</a><a href="#faq">FAQ</a></div></div>'
      + '<div class="foot-bottom"><span>© ' + new Date().getFullYear() + ' ' + esc(brand) + '. Hak cipta dilindungi.</span><span>Pembayaran aman · Akses instan</span></div>';

    /* elemen mengambang */
    var wf = $('#waFloat'); wf.hidden = !saklar('SHOW_WA_FLOAT'); wf.href = waUrl(''); wf.dataset.wa = 'float';
    $('#stickyWa').href = waUrl(''); $('#stickyWa').dataset.wa = 'sticky';
    $('#stickyNow').textContent = rp(p.harga_promo); $('#stickyOld').textContent = rp(p.harga_normal);
    var bt = $('#bfToggle'); bt.hidden = !saklar('SHOW_BUTTERFLY');
    afterRender();
  }

  function renderPrice() {
    var d = DATA, p = d.produk || {}, bonus = saklar('SHOW_BONUS') ? (d.bonus || []) : [], pays = String(p.metode_bayar || '').split('|').filter(Boolean);
    var dl = new Date(p.promo_sampai).getTime(), cd = saklar('SHOW_COUNTDOWN') && dl > Date.now();
    var off = Number(p.harga_normal) > Number(p.harga_promo) ? Math.round((1 - p.harga_promo / p.harga_normal) * 100) : 0;
    $('#hargaRoot').innerHTML = head('Penawaran', p.harga_judul, p.harga_sub) + '<div class="price-wrap"><div class="card price-card spot glow tilt reveal">'
      + '<div class="price-top"><span class="badge">' + icon('bolt') + ' Promo terbatas' + (off ? ' · hemat ' + off + '%' : '') + '</span><span class="badge soft">Akses selamanya</span></div>'
      + '<div><div class="price-name">' + esc(p.nama_produk) + '</div>' + (Number(p.harga_normal) ? '<div class="price-old">' + rp(p.harga_normal) + '</div>' : '') + '<div class="price-now">' + rp(p.harga_promo) + ' <small>sekali bayar</small></div></div>'
      + (cd ? '<div><div class="count" id="count" role="timer" aria-label="Sisa waktu promo"><div><b data-u="d">00</b><span>Hari</span></div><div><b data-u="h">00</b><span>Jam</span></div><div><b data-u="m">00</b><span>Menit</span></div><div><b data-u="s">00</b><span>Detik</span></div></div></div>' : '')
      + (bonus.length ? '<div><div class="bonus-t">Bonus eksklusif</div><ul class="bonus" style="padding:0;margin:10px 0 0">' + bonus.map(function (b) {
        return '<li><span class="ic-badge">' + icon('gift') + '</span><div><b>' + esc(b.nama) + '</b><div class="meta">' + (b.nilai ? '<s>' + esc(b.nilai) + '</s><span>GRATIS</span>' : '') + (b.kuota > 0 ? '<span class="quota">Sisa kuota: ' + b.kuota + '</span>' : '') + '</div></div></li>'; }).join('') + '</ul></div>' : '')
      + (pays.length ? '<div><div class="pay-label">Metode pembayaran</div><div class="pays" style="margin-top:12px">' + pays.map(function (m) { return '<span>' + esc(m) + '</span>'; }).join('') + '</div></div>' : '')
      + '<button class="btn btn-cta btn-block" data-buy="harga" type="button" style="min-height:56px;font-size:17px"><span class="btn-label">Beli Sekarang</span>' + icon('arrow') + '</button>'
      + '<p class="price-wa">Ada pertanyaan? <a data-wa="harga" href="' + esc(waUrl('')) + '" target="_blank" rel="noopener">Chat CS via WhatsApp</a></p></div></div>';
    if (cd) {
      var el = $('#count'), tick = function () {
        var s = Math.max(0, Math.floor((dl - Date.now()) / 1000)), v = { d: Math.floor(s / 86400), h: Math.floor(s % 86400 / 3600), m: Math.floor(s % 3600 / 60), s: s % 60 };
        Object.keys(v).forEach(function (k) { var n = $('[data-u="' + k + '"]', el); if (n) n.textContent = String(v[k]).padStart(2, '0'); });
        if (!s) { clearInterval(iv); el.parentNode.remove(); }
      };
      var iv = setInterval(tick, 1000); tick(); CLEAN.push(function () { clearInterval(iv); });
    }
  }

  /* ---------- testimoni: flip otomatis + popup ---------- */
  function initFlip(root) {
    var cards = $$('.flip', root); if (!cards.length) return;
    var idx = -1, cur = null, hover = false, vis = false, to = 0;
    var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) { vis = es[0].isIntersecting; }, { threshold: .2 }) : null; if (io) io.observe(root); else vis = true;
    function off(c) { if (c) c.classList.remove('is-flipped', 'hot'); }
    var iv = reduce ? 0 : setInterval(function () {
      if (!vis || hover || document.hidden) return;
      off(cur); idx = (idx + 1 + Math.floor(Math.random() * 2)) % cards.length; cur = cards[idx]; cur.classList.add('is-flipped', 'hot');
      clearTimeout(to); to = setTimeout(function () { off(cur); }, 3600);
    }, 4300);
    cards.forEach(function (c) {
      c.addEventListener('pointerenter', function () { hover = true; c.classList.add('hot'); });
      c.addEventListener('pointerleave', function () { hover = false; if (!c.classList.contains('is-flipped')) c.classList.remove('hot'); });
      var open = function () { openT(+c.dataset.i, c); };
      c.addEventListener('click', open); c.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    });
    CLEAN.push(function () { clearInterval(iv); clearTimeout(to); if (io) io.disconnect(); });
  }
  function openT(i, from) {
    var t = DATA.testimoni[i]; if (!t) return;
    $('#tBody').innerHTML = '<div class="t-modal"><div class="t-head"><div class="avatar" style="width:56px;height:56px;font-size:20px;background:#F9D9CB">' + esc(initials(t.nama)) + '</div><div><b id="tName" style="font-size:18px">' + esc(t.nama) + '</b><span>' + esc(t.kota) + '</span></div></div>'
      + stars(t.rating) + '<p class="t-full">' + esc(t.ulasan) + '</p>' + (t.screenshot && t.screenshot.length ? '<div class="t-shots slideshow" id="tShots"></div>' : '')
      + '<button class="btn btn-cta" data-buy="testimoni" type="button"><span class="btn-label">Saya juga mau</span></button></div>';
    if (t.screenshot && t.screenshot.length) Slideshow($('#tShots'), t.screenshot.map(function (u) { return { src: u, alt: 'Tangkapan layar ' + t.nama }; }), { interval: 3500 });
    openModal($('#tModal'), from);
  }

  /* ---------- modal ---------- */
  var modalStack = [], lastFocus = null;
  function openModal(m, from) { lastFocus = from || document.activeElement; m.hidden = false; document.documentElement.style.overflow = 'hidden'; modalStack.push(m); setTimeout(function () { var f = $('input, .modal-x', m); if (f) f.focus({ preventScroll: true }); }, 60); }
  function closeModal(m) {
    m = m || modalStack[modalStack.length - 1]; if (!m) return; m.hidden = true; modalStack = modalStack.filter(function (x) { return x !== m; });
    if (!modalStack.length) document.documentElement.style.overflow = ''; clearTimeout(GO_TIMER); if (lastFocus && lastFocus.focus) try { lastFocus.focus({ preventScroll: true }); } catch (e) {}
  }
  function info(kind) { $('#iTitle').textContent = kind === 'privasi' ? 'Kebijakan Privasi' : 'Syarat & Ketentuan'; $('#iText').textContent = kind === 'privasi' ? P('kebijakan_privasi', 'Data Anda hanya dipakai untuk konfirmasi pesanan.') : P('syarat_ketentuan', 'Produk digital, akses diberikan setelah pembayaran terkonfirmasi.'); openModal($('#iModal')); }

  /* ---------- pelacakan & alur beli ---------- */
  function track(payload) {
    var a = attribution();
    return Api.post('lead.track', Object.assign({ vid: vid, utm_source: a.utm_source, utm_medium: a.utm_medium, utm_campaign: a.utm_campaign }, payload), '', { keepalive: true, timeout: 8000 });
  }
  function setFld(id, state) { var f = $(id).closest('.fld'); f.classList.toggle('good', state === true); f.classList.toggle('bad', state === false); }
  function openBuy(loc) {
    BUY_LOC = loc || 'halaman'; var dm = $('#drawer'); if (!dm.hidden) { dm.hidden = true; $('#burger').setAttribute('aria-expanded', 'false'); }
    if (!saklar('SHOW_LEADFORM')) { track({ tombol: 'Beli Sekarang', lokasi: BUY_LOC, form: false }); showGo('pay', ''); return; }
    $('#leadStepForm').hidden = false; $('#leadStepGo').hidden = true; $('#leadErr').hidden = true;
    $('#leadForm').reset(); ['#fNama', '#fWa'].forEach(function (i) { $(i).closest('.fld').classList.remove('good', 'bad'); }); $('#okNama').hidden = $('#okWa').hidden = true;
    openModal($('#leadModal'));
  }
  function showGo(kind, nama) {
    var url = kind === 'wa' ? waUrl(nama) : payUrl(), isWa = kind === 'wa' || url.indexOf('wa.me') > -1;
    $('#leadStepForm').hidden = true; $('#leadStepGo').hidden = false;
    $('#goTitle').textContent = nama ? 'Terima kasih, ' + nama.split(' ')[0] + '!' : 'Terima kasih!';
    $('#goText').textContent = isWa ? 'Sistem mengarahkan Anda ke WhatsApp CS dalam 3 detik…' : 'Sistem mengarahkan Anda ke halaman pembayaran dalam 3 detik…';
    $('#goBtn').href = url; $('#goBtn').querySelector('.btn-label').textContent = isWa ? 'Buka WhatsApp Sekarang' : 'Buka Pembayaran Sekarang';
    var bar = $('#goBar'); bar.style.transition = 'none'; bar.style.width = '0'; void bar.offsetWidth; bar.style.transition = 'width 2.8s linear'; bar.style.width = '100%';
    if ($('#leadModal').hidden) openModal($('#leadModal'));
    clearTimeout(GO_TIMER); GO_TIMER = setTimeout(function () { location.href = url; }, 2900);
  }
  function proceed(kind) {
    var nama = $('#fNama').value.trim(), wa = $('#fWa').value.trim(), err = $('#leadErr');
    if (kind !== 'skip') {
      var okN = nama.length >= 2, okW = hpOk(wa); setFld('#fNama', okN); setFld('#fWa', okW);
      if (!okN || !okW) { err.textContent = !okN ? 'Nama lengkap wajib diisi.' : 'Nomor WhatsApp tidak valid (harus diawali 08/+62 dan 10–13 digit).'; err.hidden = false; (!okN ? $('#fNama') : $('#fWa')).focus(); return; }
    }
    err.hidden = true; var btns = $$('#leadForm .btn, .link-skip'); btns.forEach(function (b) { b.disabled = true; });
    var payload = { tombol: kind === 'wa' ? 'WhatsApp CS' : 'Beli Sekarang', lokasi: BUY_LOC, form: kind !== 'skip', nama: kind === 'skip' ? '' : nama, wa: kind === 'skip' ? '' : wa, hp_website: $('#fHp').value };
    Promise.race([track(payload), delay(3500).then(function () { return { success: true, timeout: true }; })]).then(function (res) {
      btns.forEach(function (b) { b.disabled = false; });
      if (!res.success && !res.network && !res.config) { err.textContent = res.message || 'Terjadi kesalahan, coba lagi.'; err.hidden = false; return; }   // validasi server → tampilkan
      showGo(kind, nama);
    });
  }

  /* ---------- hitung naik angka statistik ---------- */
  function countUp(el) {
    var raw = el.dataset.count, m = /^(\D*)([\d.,]+)(.*)$/.exec(raw); if (!m || reduce) return;
    var num = m[2], dec = 0, val;
    if (/,\d+$/.test(num)) { dec = num.split(',')[1].length; val = parseFloat(num.replace(/\./g, '').replace(',', '.')); }
    else if (/^\d{1,3}(\.\d{3})+$/.test(num)) val = parseInt(num.replace(/\./g, ''), 10); else val = parseFloat(num);
    if (!isFinite(val)) return; var t0 = performance.now(), dur = 1500;
    (function f(now) { var k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = m[1] + (val * e).toLocaleString('id-ID', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + m[3]; if (k < 1) requestAnimationFrame(f); else el.textContent = raw; })(t0);
  }

  var revealIO, countIO;
  function afterRender() {
    if (revealIO) revealIO.disconnect(); if (countIO) countIO.disconnect();
    if ('IntersectionObserver' in window && !reduce) {
      revealIO = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); revealIO.unobserve(e.target); } }); }, { threshold: .12, rootMargin: '0px 0px -40px 0px' });
      $$('.reveal').forEach(function (e) { revealIO.observe(e); });
      countIO = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { countUp(e.target); countIO.unobserve(e.target); } }); }, { threshold: .6 });
      $$('[data-count]').forEach(function (e) { countIO.observe(e); });
    } else $$('.reveal').forEach(function (e) { e.classList.add('in'); });
  }

  /* ---------- event global ---------- */
  function bindGlobal() {
    document.addEventListener('click', function (e) {
      var t = e.target, buy = t.closest('[data-buy]'), wa = t.closest('[data-wa]'), inf = t.closest('[data-info]'), cl = t.closest('[data-close]'), q = t.closest('.qa-q');
      if (buy) { e.preventDefault(); if (modalStack.length && !modalStack.some(function (m) { return m.id === 'leadModal'; })) closeModal(); openBuy(buy.dataset.buy); return; }
      if (wa) { track({ tombol: 'WhatsApp CS', lokasi: wa.dataset.wa, form: false }); return; }                    // biarkan tautan terbuka normal
      if (inf) { e.preventDefault(); info(inf.dataset.info); return; }
      if (cl) { closeModal(cl.closest('.modal')); return; }
      if (q) { var box = q.closest('.qa'), o = !box.classList.contains('open'); $$('.qa.open').forEach(function (x) { x.classList.remove('open'); $('.qa-q', x).setAttribute('aria-expanded', 'false'); }); if (o) { box.classList.add('open'); q.setAttribute('aria-expanded', 'true'); } }
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
    $('#leadForm').addEventListener('submit', function (e) { e.preventDefault(); proceed('pay'); });
    $('#btnWa').addEventListener('click', function () { proceed('wa'); });
    $('#btnSkip').addEventListener('click', function () { proceed('skip'); });
    $('#fNama').addEventListener('input', function () { var ok = this.value.trim().length >= 2; setFld('#fNama', this.value ? ok : null); $('#okNama').hidden = !ok; });
    $('#fWa').addEventListener('input', function () { var ok = hpOk(this.value); setFld('#fWa', this.value.length > 5 ? ok : null); $('#okWa').hidden = !ok; });
    $('#burger').addEventListener('click', function () { var d = $('#drawer'), o = d.hidden; d.hidden = !o; this.setAttribute('aria-expanded', o); document.documentElement.style.overflow = o ? 'hidden' : ''; });
    $('#drawer').addEventListener('click', function (e) { if (e.target.closest('a')) { this.hidden = true; $('#burger').setAttribute('aria-expanded', 'false'); document.documentElement.style.overflow = ''; } });
    var nav = $('#nav'); addEventListener('scroll', function () { nav.classList.toggle('scrolled', scrollY > 8); }, { passive: true });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { $('#stickyBar').classList.toggle('show', !es[0].isIntersecting); $('#stickyBar').hidden = false; }, { threshold: 0 }).observe($('.hero'));
      var links = $$('.nav-links a');
      ['masalah', 'isi', 'ulasan', 'harga', 'faq'].forEach(function (id) {
        var sec = document.getElementById(id); if (!sec) return;
        new IntersectionObserver(function (es) { if (es[0].isIntersecting) links.forEach(function (a) { a.classList.toggle('on', a.getAttribute('href') === '#' + id); }); }, { rootMargin: '-45% 0px -50% 0px' }).observe(sec);
      });
    }
    // kupu-kupu: preferensi pengunjung
    var bt = $('#bfToggle'), pref = null; try { pref = localStorage.getItem('nd_bf'); } catch (e) {}
    var wantBf = function () { return saklar('SHOW_BUTTERFLY') && (pref ? pref === 'on' : !reduce); };
    window.Butterfly && Butterfly.init();
    window.__applyBf = function () { var on = wantBf(); window.Butterfly && Butterfly.enable(on); bt.setAttribute('aria-pressed', on); };
    bt.addEventListener('click', function () { pref = wantBf() ? 'off' : 'on'; try { localStorage.setItem('nd_bf', pref); } catch (e) {} window.__applyBf(); });
  }

  /* ---------- pemuatan data (SWR) ---------- */
  function normalize(d) {
    d = d || {}; ['hero', 'masalah', 'fitur', 'statistik', 'testimoni', 'bonus', 'faq'].forEach(function (k) { d[k] = d[k] || []; });
    d.produk = d.produk || {}; d.saklar = d.saklar || {}; return d;
  }
  function banner(html) { var b = $('#demoBanner'); if (!html) { b.hidden = true; return; } b.innerHTML = html + ' <button type="button" style="background:none;border:0;color:#fff;margin-left:8px;cursor:pointer" aria-label="Tutup">✕</button>'; b.hidden = false; $('button', b).onclick = function () { b.hidden = true; }; }
  function useDemo(msg) { MODE = 'demo'; DATA = normalize(JSON.parse(JSON.stringify(window.DEMO_DATA || {}))); banner(msg); render(); window.__applyBf && window.__applyBf(); }

  function boot() {
    bindGlobal(); attribution();
    if (!Api.configured) { useDemo('Mode demo — isi <code>GAS_URL</code> di <code>js/config.js</code> agar konten &amp; lead tersambung ke Google Sheets Anda.'); return; }
    var cached = null; try { cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch (e) {}
    var sig = '';
    if (cached && cached.data) { DATA = normalize(cached.data); sig = JSON.stringify(cached.data); render(); window.__applyBf && window.__applyBf(); }
    Api.get('public').then(function (res) {
      if (res.success && res.data) {
        var s = JSON.stringify(res.data);
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), data: res.data })); } catch (e) {}
        if (s !== sig) { DATA = normalize(res.data); render(); window.__applyBf && window.__applyBf(); }
        banner('');
      } else if (!DATA) useDemo('Server belum dapat dijangkau (' + esc(res.message || 'tidak diketahui') + '). Menampilkan contoh — periksa deployment GAS Anda.');
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.__ND = { get data() { return DATA; }, get mode() { return MODE; }, render: render, openBuy: openBuy };
})();
