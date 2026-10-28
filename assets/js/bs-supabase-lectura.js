/* _BS_SUPABASE_V1 (28-oct-2026) — Lectura rápida desde la copia en Supabase.
 * Google Sheets sigue siendo la base oficial. Si Supabase no está configurado,
 * falla, tarda más de 5 s o no tiene el módulo listo, se lee de Sheets como siempre. */
(function () {
  if (window._BS_SB_LECTURA_V1) return; window._BS_SB_LECTURA_V1 = true;
  var MAPA = { bs_listarRendiciones: 'rendiciones', bs_listarQuejas: 'quejas', bs_listarAccidentes: 'accidentes', bs_listarSubsidios: 'subsidios' };   /* _BS_SUPABASE_3MOD_V1 */
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
    /* _BS_SB_PARALELO_V1: el primer bloque trae el total; los demás bloques de 1000 se piden a la vez */
    var ctl = new AbortController(), t = setTimeout(function () { ctl.abort(); }, 8000);
    var base = p.url + '/rest/v1/bs_registros?select=datos&modulo=eq.' + modulo + '&order=id&limit=1000&offset=';
    var H = { apikey: p.publica, Authorization: 'Bearer ' + p.token };
    var pedir = async function (desde, contar) {
      var h = Object.assign({}, H); if (contar) h.Prefer = 'count=exact';
      var res = await fetch(base + desde, { headers: h, signal: ctl.signal });
      if (!res.ok && res.status !== 206) throw new Error('HTTP ' + res.status);
      var filas = await res.json(); if (!Array.isArray(filas)) throw new Error('respuesta rara');
      return { filas: filas, total: contar ? Number(String(res.headers.get('content-range') || '').split('/')[1]) : 0 };
    };
    try {
      var r0 = await pedir(0, true), todo = r0.filas.map(function (f) { return f.datos; });
      var total = r0.total || 0, extras = [];
      if (total > 1000) for (var d = 1000; d < total; d += 1000) extras.push(pedir(d, false));
      else if (!total && r0.filas.length === 1000) { var d2 = 1000, pg; do { pg = await pedir(d2, false); pg.filas.forEach(function (f) { todo.push(f.datos); }); d2 += 1000; } while (pg.filas.length === 1000); }
      (await Promise.all(extras)).forEach(function (pg2) { pg2.filas.forEach(function (f) { todo.push(f.datos); }); });
      if (total && todo.length !== total) throw new Error('llegaron ' + todo.length + ' de ' + total);
      return todo;
    } finally { clearTimeout(t); }
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
