/* _BS_SUPABASE_V1 (28-oct-2026) — Lectura rápida desde la copia en Supabase.
 * Google Sheets sigue siendo la base oficial. Si Supabase no está configurado,
 * falla, tarda más de 5 s o no tiene el módulo listo, se lee de Sheets como siempre. */
(function () {
  if (window._BS_SB_LECTURA_V1) return; window._BS_SB_LECTURA_V1 = true;
  var MAPA = { bs_listarRendiciones: 'rendiciones' };
  var KEY = 'bs_sb_pase', APAGADO = 'bs_sb_apagado';
  var orig = window.api; if (typeof orig !== 'function') return;

  async function pase() {
    try { if (Number(sessionStorage.getItem(APAGADO) || 0) > Date.now()) return null; } catch (e) {}
    try { var c = JSON.parse(sessionStorage.getItem(KEY) || 'null'); if (c && c.exp * 1000 > Date.now() + 60000) return c; } catch (e) {}
    var r = await orig('bs_sbToken', {});
    if (!r || !r.ok || !r.token) { try { sessionStorage.setItem(APAGADO, String(Date.now() + 10 * 60000)); } catch (e) {} return null; }
    try { sessionStorage.setItem(KEY, JSON.stringify(r)); } catch (e) {}
    return r;
  }

  async function leer(p, modulo) {
    var todo = [], desde = 0, pag;
    var ctl = new AbortController(), t = setTimeout(function () { ctl.abort(); }, 5000);
    try {
      do {
        var res = await fetch(p.url + '/rest/v1/bs_registros?select=datos&modulo=eq.' + modulo + '&order=id&offset=' + desde + '&limit=1000',
          { headers: { apikey: p.publica, Authorization: 'Bearer ' + p.token }, signal: ctl.signal });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        pag = await res.json(); if (!Array.isArray(pag)) throw new Error('respuesta rara');
        pag.forEach(function (f) { todo.push(f.datos); }); desde += 1000;
      } while (pag.length === 1000);
    } finally { clearTimeout(t); }
    return todo;
  }

  window.api = async function (action, payload) {
    var modulo = MAPA[action];
    var f = payload && payload.filtros;
    if (modulo && (!f || !Object.keys(f).length)) {
      try {
        var t0 = Date.now(), p = await pase();
        if (p && (p.mods || []).indexOf(modulo) >= 0) {
          var items = await leer(p, modulo);
          if (items.length) {
            items.sort(function (a, b) { return (Number(b.id) || 0) - (Number(a.id) || 0); });
            console.info('[_BS_SUPABASE_V1] ' + modulo + ': ' + items.length + ' registros en ' + (Date.now() - t0) + ' ms (Supabase)');
            return { ok: true, items: items, total: items.length, origen: 'supabase' };
          }
        }
      } catch (e) {
        try { sessionStorage.removeItem(KEY); } catch (e2) {}
        console.warn('[_BS_SUPABASE_V1] se lee de Sheets:', e && e.message);
      }
    }
    return orig.apply(this, arguments);
  };
})();
