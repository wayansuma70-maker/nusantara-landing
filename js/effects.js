/* ============================================================
 * effects.js — efek interaktif (vanilla, tanpa dependensi)
 *  1) Kupu-kupu hidup (canvas) yang selalu mengikuti kursor / sentuhan
 *  2) Riak pada tombol, sorot cahaya kartu mengikuti kursor, tilt 3D kartu
 * Menghormati prefers-reduced-motion. Kupu-kupu bisa dimatikan pengunjung.
 * ============================================================ */
(function () {
  'use strict';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;
  var TAU = Math.PI * 2;

  /* ------------------------------------------------------------
   * 1) KUPU-KUPU
   * Fisika pegas-redam (lag alami, sedikit overshoot) + orbit melayang di sekitar kursor,
   * hinggap saat kursor diam, takeoff saat kursor bergerak lagi. Sayap menutup/membuka
   * mengikuti sin(fase) → lebar proyeksi cos(sudut) sehingga terlihat 3D.
   * ------------------------------------------------------------ */
  var cv, cx, W = 0, H = 0, DPR = 1, raf = 0, on = false, last = 0, t0 = 0;
  var mouse = { x: 0, y: 0, px: 0, py: 0, moved: 0, seen: false };
  var B = { x: -80, y: 0, vx: 0, vy: 0, head: -Math.PI / 2, phase: 0, mode: 'fly', amp: 1.1, spin: 0, restAt: 0, pump: 0, S: 0.52, glide: 0, nextGlide: 3 };
  var dust = [];

  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = innerWidth; H = innerHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    cx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  function angDiff(a, b) { var d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }

  function wingPath(c, hind) {
    c.beginPath();
    if (!hind) { c.moveTo(2, -6); c.bezierCurveTo(14, -42, 54, -48, 60, -24); c.bezierCurveTo(63, -10, 38, 4, 4, 3); }
    else { c.moveTo(3, 1); c.bezierCurveTo(36, -5, 53, 14, 40, 33); c.bezierCurveTo(29, 46, 8, 38, 3, 13); }
    c.closePath();
  }
  var DOTS_F = [[46, -37], [53, -31], [58, -23], [59, -14], [52, -42], [40, -41]];
  var DOTS_H = [[43, 14], [44, 24], [38, 34], [28, 40], [18, 39]];
  var VEIN_F = [[30, -36], [47, -33], [57, -22], [53, -7], [38, -1]];
  var VEIN_H = [[30, 2], [44, 12], [38, 28], [24, 34], [10, 26]];
  function drawWing(c, side, sx, hind, lw) {
    c.save(); c.scale(side * sx, 1);
    wingPath(c, hind);
    var g = c.createLinearGradient(0, 0, hind ? 40 : 56, hind ? 34 : -34);
    g.addColorStop(0, '#FFC27E'); g.addColorStop(0.45, '#F28A47'); g.addColorStop(1, '#C9501F');
    c.fillStyle = g; c.fill();
    c.save(); wingPath(c, hind); c.clip();                                   // urat sayap
    c.strokeStyle = 'rgba(31,45,58,.78)'; c.lineWidth = 1.5 * lw; c.lineCap = 'round';
    (hind ? VEIN_H : VEIN_F).forEach(function (p) { c.beginPath(); c.moveTo(4, hind ? 2 : -3); c.quadraticCurveTo(p[0] * 0.55, p[1] * 0.6, p[0], p[1]); c.stroke(); });
    var sh = c.createRadialGradient(8, hind ? 6 : -6, 2, 8, hind ? 6 : -6, 30);      // kilau dekat tubuh
    sh.addColorStop(0, 'rgba(255,240,205,.55)'); sh.addColorStop(1, 'rgba(255,240,205,0)');
    c.fillStyle = sh; c.fillRect(-4, -60, 80, 120);
    c.restore();
    wingPath(c, hind); c.strokeStyle = '#1F2D3A'; c.lineWidth = 2.6 * lw; c.lineJoin = 'round'; c.stroke();     // tepi gelap
    c.fillStyle = 'rgba(255,255,255,.92)';                                    // bintik putih
    (hind ? DOTS_H : DOTS_F).forEach(function (d, i) { c.beginPath(); c.arc(d[0], d[1], (i % 2 ? 1.6 : 2.2), 0, TAU); c.fill(); });
    c.restore();
  }
  function drawButterfly(t) {
    var S = B.S, lw = 1 / S * 0.6;
    var flapA = B.amp * Math.sin(B.phase), sxF = Math.max(0.12, Math.cos(flapA)), sxH = Math.max(0.12, Math.cos(B.amp * Math.sin(B.phase - 0.55)));
    var speed = Math.hypot(B.vx, B.vy), bob = Math.sin(B.phase) * (B.mode === 'rest' ? 0.4 : 2.6);
    var bank = Math.max(-0.35, Math.min(0.35, (B.vx * Math.sin(B.head) - B.vy * Math.cos(B.head)) / 2200));
    cx.save();
    cx.translate(B.x, B.y + bob); cx.rotate(B.head + Math.PI / 2 + bank); cx.scale(S, S);
    cx.save(); cx.translate(10, 26); cx.scale(1, 0.34); cx.fillStyle = 'rgba(20,32,43,.14)';                      // bayangan lembut
    cx.beginPath(); cx.arc(0, 0, 44 * (0.7 + 0.3 * sxF), 0, TAU); cx.fill(); cx.restore();
    cx.translate(0, -3);
    drawWing(cx, -1, sxH, true, lw); drawWing(cx, 1, sxH, true, lw);       // sayap belakang
    drawWing(cx, -1, sxF, false, lw); drawWing(cx, 1, sxF, false, lw);     // sayap depan
    cx.fillStyle = '#1F2D3A';                                              // tubuh
    cx.beginPath(); cx.ellipse(0, 3, 2.7, 16, 0, 0, TAU); cx.fill();
    cx.beginPath(); cx.ellipse(0, -6, 3.8, 6.5, 0, 0, TAU); cx.fill();
    cx.beginPath(); cx.arc(0, -16, 3.5, 0, TAU); cx.fill();
    cx.fillStyle = 'rgba(255,255,255,.85)'; [[-1.4, -7], [1.4, -4], [-1.2, 2], [1.2, 7]].forEach(function (d) { cx.beginPath(); cx.arc(d[0], d[1], .9, 0, TAU); cx.fill(); });
    var sway = Math.sin(t * 3.1) * 2.2 + Math.sin(t * 7.3) * (speed > 80 ? 1.6 : 0.4);                          // antena
    cx.strokeStyle = '#1F2D3A'; cx.lineWidth = 1.2; cx.lineCap = 'round';
    [-1, 1].forEach(function (s) { cx.beginPath(); cx.moveTo(s * 1.4, -18.5); cx.quadraticCurveTo(s * (6 + sway), -27, s * (11 + sway * 1.2), -33); cx.stroke(); cx.beginPath(); cx.arc(s * (11 + sway * 1.2), -33.4, 1.5, 0, TAU); cx.fillStyle = '#1F2D3A'; cx.fill(); });
    cx.restore();
  }
  function emitDust(speed) {
    if (speed < 120 || Math.random() > 0.22 || dust.length > 40) return;
    var a = B.head + Math.PI + (Math.random() - .5) * .8;
    dust.push({ x: B.x + Math.cos(a) * 12, y: B.y + Math.sin(a) * 12, vx: Math.cos(a) * 20 + (Math.random() - .5) * 14, vy: Math.sin(a) * 20 + 18 + Math.random() * 14, life: 1, r: 1 + Math.random() * 1.6, c: Math.random() < .5 ? '255,200,140' : '232,128,94' });
  }
  function drawDust(dt) {
    for (var i = dust.length - 1; i >= 0; i--) {
      var p = dust[i]; p.life -= dt * 1.15; if (p.life <= 0) { dust.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 22 * dt;
      cx.fillStyle = 'rgba(' + p.c + ',' + (p.life * .55).toFixed(2) + ')'; cx.beginPath(); cx.arc(p.x, p.y, p.r * (0.6 + p.life * .6), 0, TAU); cx.fill();
    }
  }

  function step(now) {
    raf = requestAnimationFrame(step);
    var dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
    var t = (now - t0) / 1000;
    cx.clearRect(0, 0, W, H);
    var idle = (now - mouse.moved) / 1000, tx, ty;
    if (!mouse.seen) {                                           // belum ada kursor: berkeliling lembut
      tx = W * 0.72 + Math.cos(t * 0.55) * W * 0.16; ty = H * 0.34 + Math.sin(t * 0.8) * H * 0.12;
    } else {
      var d0 = Math.hypot(B.x - mouse.x, B.y - mouse.y);
      if (B.mode === 'fly' && idle > 3.2 && d0 < 170) { B.mode = 'land'; }
      if ((B.mode === 'land' || B.mode === 'rest') && idle < 0.25 && Math.hypot(mouse.x - mouse.px, mouse.y - mouse.py) > 6) { B.mode = 'fly'; B.vy -= 160; B.vx += (Math.random() - .5) * 120; B.pump = 0; }
      if (B.mode === 'fly') {                                    // orbit melayang di sekitar kursor
        tx = mouse.x + Math.cos(t * 1.6) * 40 + Math.cos(t * 0.63) * 26 + 18;
        ty = mouse.y + Math.sin(t * 2.0) * 26 + Math.sin(t * 0.9) * 14 - 26;
      } else { tx = mouse.x + 30; ty = mouse.y + 18; }          // hinggap di dekat kursor
    }
    var dx = tx - B.x, dy = ty - B.y, dist = Math.hypot(dx, dy);
    var k = B.mode === 'fly' ? (dist > 260 ? 7 : 15) : 9, c = 2 * Math.sqrt(k) * (B.mode === 'fly' ? 0.62 : 1.0);
    B.vx += (dx * k - B.vx * c) * dt; B.vy += (dy * k - B.vy * c) * dt;
    var sp = Math.hypot(B.vx, B.vy), maxS = 1100;
    if (sp > maxS) { B.vx *= maxS / sp; B.vy *= maxS / sp; sp = maxS; }
    B.x += B.vx * dt; B.y += B.vy * dt;
    if (B.mode === 'land' && dist < 4 && sp < 14) { B.mode = 'rest'; B.restAt = t; }
    // arah hadap
    if (B.mode === 'rest') { var want = Math.atan2(mouse.y - B.y, mouse.x - B.x); B.head += angDiff(B.head, want) * Math.min(1, dt * 1.5); }
    else if (sp > 35) B.head += angDiff(B.head, Math.atan2(B.vy, B.vx)) * Math.min(1, dt * (B.mode === 'fly' ? 7 : 4));
    // sayap
    var targetAmp, freq;
    if (B.mode === 'fly') {
      targetAmp = 1.12; freq = 16 + Math.min(10, sp / 80);
      if (t > B.nextGlide && sp > 250) { B.glide = 0.55; B.nextGlide = t + 3 + Math.random() * 3; }
      if (B.glide > 0) { B.glide -= dt; targetAmp = 0.35; freq = 5; }
    } else if (B.mode === 'land') { targetAmp = 0.8; freq = 11; }
    else { targetAmp = 0.22; freq = 2.1; if (B.pump > 0) { B.pump -= dt; targetAmp = 0.95; freq = 13; } else if (t - B.restAt > 2.4 + Math.random()) { B.pump = 0.7; B.restAt = t; } }
    B.amp += (targetAmp - B.amp) * Math.min(1, dt * 7);
    B.phase += freq * dt;
    emitDust(sp);
    drawDust(dt);
    drawButterfly(t);
  }
  function setPointer(x, y) {
    mouse.px = mouse.x; mouse.py = mouse.y; mouse.x = x; mouse.y = y; mouse.moved = performance.now();
    if (!mouse.seen) { mouse.seen = true; B.x = x < W / 2 ? W + 60 : -60; B.y = Math.max(40, y - 80); B.vx = 0; B.vy = 0; }   // masuk dari tepi layar
  }
  function start() {
    if (on || !cv) return; on = true; cv.hidden = false;
    t0 = performance.now(); last = t0; raf = requestAnimationFrame(step);
  }
  function stop() { on = false; cancelAnimationFrame(raf); if (cx) cx.clearRect(0, 0, W, H); if (cv) cv.hidden = true; dust.length = 0; }
  var Butterfly = {
    init: function () {
      cv = document.getElementById('butterfly'); if (!cv) return; cx = cv.getContext('2d');
      resize(); addEventListener('resize', resize);
      addEventListener('pointermove', function (e) { setPointer(e.clientX, e.clientY); }, { passive: true });
      addEventListener('pointerdown', function (e) { setPointer(e.clientX, e.clientY); }, { passive: true });
      addEventListener('touchmove', function (e) { var t = e.touches[0]; if (t) setPointer(t.clientX, t.clientY); }, { passive: true });
      document.addEventListener('visibilitychange', function () { if (document.hidden) cancelAnimationFrame(raf); else if (on) { last = performance.now(); raf = requestAnimationFrame(step); } });
      B.y = H * 0.5; mouse.moved = performance.now();
    },
    enable: function (v) { if (v) start(); else stop(); },
    get running() { return on; },
    debug: function () { return { x: B.x, y: B.y, vx: B.vx, vy: B.vy, mode: B.mode, amp: B.amp, head: B.head, dust: dust.length }; }
  };
  window.Butterfly = Butterfly;

  /* ------------------------------------------------------------
   * 2) EFEK DELEGASI: riak tombol · sorot kartu · tilt 3D
   * ------------------------------------------------------------ */
  document.addEventListener('pointerdown', function (e) {
    var b = e.target.closest && e.target.closest('.btn'); if (!b || reduce) return;
    var r = b.getBoundingClientRect(), s = Math.max(r.width, r.height), d = document.createElement('span');
    d.className = 'ripple'; d.style.cssText = 'width:' + s + 'px;height:' + s + 'px;left:' + (e.clientX - r.left - s / 2) + 'px;top:' + (e.clientY - r.top - s / 2) + 'px';
    b.appendChild(d); setTimeout(function () { d.remove(); }, 650);
  }, { passive: true });

  var tiltEl = null, ticking = false, lastEv = null;
  function resetTilt(el) { if (el) { el.style.transform = ''; } }
  function onMove(e) {
    lastEv = e; if (ticking) return; ticking = true;
    requestAnimationFrame(function () {
      ticking = false; var ev = lastEv, tg = ev.target.closest ? ev.target.closest('.spot, .flip, .tilt') : null;
      if (tg) {
        var r = tg.getBoundingClientRect(), px = ev.clientX - r.left, py = ev.clientY - r.top;
        tg.style.setProperty('--mx', px + 'px'); tg.style.setProperty('--my', py + 'px');
        var lay = tg.querySelector && tg.querySelector('.spot-layer'); if (lay) { lay.style.setProperty('--mx', px + 'px'); lay.style.setProperty('--my', py + 'px'); }
      }
      var tl = ev.target.closest ? ev.target.closest('.tilt') : null;
      if (tiltEl && tiltEl !== tl) { resetTilt(tiltEl); tiltEl = null; }
      if (tl && fine && !reduce) {
        var rr = tl.getBoundingClientRect(), nx = (ev.clientX - rr.left) / rr.width - .5, ny = (ev.clientY - rr.top) / rr.height - .5;
        tl.style.transform = 'perspective(900px) rotateX(' + (-ny * 7).toFixed(2) + 'deg) rotateY(' + (nx * 9).toFixed(2) + 'deg) translateY(-4px) scale(1.015)';
        if (tiltEl !== tl) { tiltEl = tl; tl.addEventListener('pointerleave', function h() { resetTilt(tl); if (tiltEl === tl) tiltEl = null; tl.removeEventListener('pointerleave', h); }); }
      }
    });
  }
  document.addEventListener('pointermove', onMove, { passive: true });
  window.Effects = { reduce: reduce, fine: fine };
})();
