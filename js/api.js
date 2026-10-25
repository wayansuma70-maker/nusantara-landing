/* api.js — helper fetch ke GAS (dipakai halaman publik & dashboard) */
(function () {
  'use strict';
  var URL_ = (window.APP_CONFIG || {}).GAS_URL || '';
  var OK = !!URL_ && !/GANTI|XXXX/.test(URL_);

  function timeout(ms) { var c = new AbortController(); setTimeout(function () { c.abort(); }, ms); return c.signal; }

  window.Api = {
    configured: OK,
    /** GET publik (di-cache server) */
    get: function (action, ms) {
      if (!OK) return Promise.resolve({ success: false, config: true, message: 'Konfigurasi belum lengkap: isi GAS_URL di js/config.js' });
      return fetch(URL_ + '?action=' + encodeURIComponent(action), { signal: timeout(ms || 12000) })
        .then(function (r) { return r.json(); })
        .catch(function (e) { return { success: false, network: true, message: 'Tidak dapat menghubungi server (' + (e.name === 'AbortError' ? 'waktu habis' : 'jaringan') + ').' }; });
    },
    /** POST — WAJIB text/plain agar tidak memicu CORS preflight yang diblok GAS */
    post: function (action, data, token, opt) {
      if (!OK) return Promise.resolve({ success: false, config: true, message: 'Konfigurasi belum lengkap: isi GAS_URL di js/config.js' });
      opt = opt || {};
      return fetch(URL_, {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, keepalive: !!opt.keepalive,
        body: JSON.stringify({ action: action, token: token || '', data: data || {} }), signal: timeout(opt.timeout || 25000)
      }).then(function (r) { return r.json(); })
        .catch(function (e) { return { success: false, network: true, message: 'Tidak dapat menghubungi server (' + (e.name === 'AbortError' ? 'waktu habis' : 'jaringan') + ').' }; });
    },
    /** Beberapa aksi baca dalam 1 eksekusi server (maks 10) */
    batch: function (calls, token) {
      return window.Api.post('batch', { calls: calls }, token).then(function (r) {
        return r.success ? r.data.results : calls.map(function () { return r; });
      });
    },
    /** Pemanasan server (tanpa membaca respons) */
    warm: function (scope) {
      if (!OK) return;
      try { var k = 'nd_warm_' + scope, t = +sessionStorage.getItem(k) || 0; if (Date.now() - t < 240000) return; sessionStorage.setItem(k, Date.now()); } catch (e) {}
      fetch(URL_ + '?w=' + scope, { mode: 'no-cors' }).catch(function () {});
    }
  };
})();
