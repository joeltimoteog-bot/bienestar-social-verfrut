/* ═══════════════════════════════════════════════════════════════════════════
   bs-ficha-azure.js — _BS_FICHA_AZURE_V1 (28-oct-2026)
   Ficha del Trabajador conectada a AZURE para la busqueda del padron:
   · Buscar (nombre o DNI) -> Azure /trabajadores/buscar (todas las empresas: RAPEL, VERFRUT, OLMOS...).
     Antes recorria la hoja de Google completa en cada busqueda (lento) y solo RAPEL/VERFRUT.
   · Abrir ficha: sigue armandose en el servidor de Bienestar (casos, subsidios, descansos...); si ese
     servidor no encuentra al trabajador en el padron, los datos personales se completan desde Azure.
   · Si Azure no responde, todo funciona como antes (hoja de Google). Usa la sesion de RR.LL. (rl_token).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._BS_FICHA_AZURE_V1) return; window._BS_FICHA_AZURE_V1 = true;
  var URL = 'https://rl-fn-verfrut.azurewebsites.net/api/trabajadores/buscar', MAX = 15;
  var previo = window.api; if (typeof previo !== 'function') return;

  function token() { try { return (JSON.parse(localStorage.getItem('bienestarSocialAuth') || '{}') || {}).rl_token || ''; } catch (e) { return ''; } }
  function nombreDe(t) { return String(t.nombre_completo || [t.ap_paterno, t.ap_materno, t.nombres].filter(Boolean).join(' ') || '').trim().toUpperCase(); }
  function empDe(t) { return String(t.empresa_origen || t.empresa || '').toUpperCase().replace(/\s*S\.?A\.?C\.?\s*$/, '').trim(); }
  async function azure(params) {
    var tk = token(); if (!tk) return null;
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null, reloj = setTimeout(function () { try { ctl && ctl.abort(); } catch (e) {} }, 6000);
    try {
      var r = await fetch(URL + '?' + new URLSearchParams(params), { headers: { Authorization: 'Bearer ' + tk }, signal: ctl ? ctl.signal : undefined });
      clearTimeout(reloj);
      if (r.status === 404) return { trabajadores: [] };      /* DNI no existe: respuesta definitiva */
      if (!r.ok) return null;
      var j = await r.json(); return j && j.success !== false ? j : null;
    } catch (e) { clearTimeout(reloj); return null; }
  }
  function aItem(t) { return { dni: String(t.dni || '').trim(), nombre: nombreDe(t), empresa: empDe(t), cargo: String(t.oficio || t.cargo || ''), zona: String(t.zona_labor || t.fundo || '') }; }

  async function buscar(d) {
    var q = String((d && d.q) || '').trim(); if (q.length < 3) return { ok: true, items: [] };
    var j = null;
    if (/^\d{8}$/.test(q)) j = await azure({ dni: q });
    else if (!/^\d+$/.test(q)) j = await azure({ q: q });
    else return null;                                   /* DNI incompleto (3-7 digitos): lo resuelve la hoja, como antes */
    if (!j) return null;
    var vistos = {}, items = (j.trabajadores || []).map(aItem).filter(function (x) { if (!x.dni || vistos[x.dni]) return false; vistos[x.dni] = 1; return true; }).slice(0, MAX);
    return { ok: true, items: items, fuente: 'azure' };
  }
  function padronDe(t) {
    return { dni: String(t.dni || ''), nombre: nombreDe(t), empresa: empDe(t), sexo: String(t.sexo || ''), cargo: String(t.oficio || ''), regimen: String(t.tipo_regimen || ''),
      zona: String(t.zona_labor || ''), fecha_inicio: t.fecha_inicio || '', fecha_termino: t.fecha_termino || '', ruta: String(t.ruta || ''), codigo: String(t.codigo_trab || t.cod || ''), fuente: 'azure' };
  }

  window.api = async function (accion, payload) {
    if (accion === 'bs_fichaBuscar') {
      var r = null; try { r = await buscar(payload); } catch (e) { r = null; }
      if (r && (r.items.length || /^\d{8}$/.test(String((payload || {}).q || '').trim()))) return r;
      return previo.apply(this, arguments);                /* respaldo: hoja de Google */
    }
    if (accion === 'bs_fichaTrabajador') {
      var res = await previo.apply(this, arguments);
      try {
        var dni = String((payload || {}).dni || '').trim();
        if (res && res.ok && !res.padron && /^\d{8}$/.test(dni)) {
          var j = await azure({ dni: dni });
          var t = j && j.trabajadores && j.trabajadores[0]; if (t) res.padron = padronDe(t);
        }
      } catch (e) {}
      return res;
    }
    return previo.apply(this, arguments);
  };
})();
