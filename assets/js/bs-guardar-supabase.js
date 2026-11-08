/* =========================================================================
 * _BS_GUARDA_SUPABASE_V1 (08-nov-2026) · Bienestar Social guarda y lee DIRECTO en Supabase  · v2: + Accidentes
 * -------------------------------------------------------------------------
 * Envuelve window.api(): para los módulos listados en BS_SUPABASE_MODULOS, las acciones del
 * Apps Script (bs_listarQuejas, bs_crearQueja, …) se convierten en llamadas a la Edge Function
 * (bs/tabla · bs/guardar) con la MISMA forma de respuesta que daba Google ({ ok, items, id, message }).
 * Lo que no está en la lista sigue yendo a Google tal cual.
 *
 * Seguridad: la Edge decide con la sesión del RR.LL. (rl_token) y "Acceso a Módulos".
 * Si la tabla todavía está en fuente 'hoja' (409) o la Edge no responde, la acción cae a Google.
 * Si la sesión venció (401), se avisa como siempre (bsSesionInvalida).
 *
 * USO: <script src="../assets/js/bs-guardar-supabase.js?v=1"></script> DESPUÉS de bs-core.js y
 *      bs-supabase-lectura.js (debe ser la última capa sobre window.api).
 * ========================================================================= */
(function () {
  'use strict';
  if (window.__BS_GUARDA_SUPABASE__) return; window.__BS_GUARDA_SUPABASE__ = true;
  var EDGE = window.BS_EDGE_URL || 'https://exdjzbfinppzatjyimxn.supabase.co/functions/v1/api';

  /* módulos que ya guardan en Supabase (se agregan uno a uno conforme avanza el plan) */
  window.BS_SUPABASE_MODULOS = window.BS_SUPABASE_MODULOS || ['quejas', 'accidentes'];

  var CLAVE_DE_MODULO = { quejas: 'bs_quejas', accidentes: 'bs_accidentes_casos', subsidios: 'bs_subsidios', hostigamiento: 'bs_hostigamiento', descansos: 'bs_descansos', rendiciones: 'bs_rendiciones', sugerencias: 'bs_sugerencias' };

  function token() { try { return (JSON.parse(localStorage.getItem('bienestarSocialAuth') || '{}') || {}).rl_token || ''; } catch (e) { return ''; } }
  function activo(modulo) { return (window.BS_SUPABASE_MODULOS || []).indexOf(modulo) >= 0; }
  function num(v) { var n = Number(v); return isNaN(n) ? 0 : n; }
  var CAE_A_GOOGLE = { caer: true };

  async function edge(ruta, metodo, cuerpo, query) {
    var tk = token(); if (!tk) return CAE_A_GOOGLE;            /* sin sesión RR.LL. en este navegador: Google como siempre */
    var ctl = new AbortController(), t = setTimeout(function () { ctl.abort(); }, 20000), res;
    try {
      res = await fetch(EDGE + '/bs/' + ruta + (query ? '?' + query : ''), {
        method: metodo, signal: ctl.signal,
        headers: Object.assign({ Authorization: 'Bearer ' + tk }, cuerpo ? { 'Content-Type': 'application/json' } : {}),
        body: cuerpo ? JSON.stringify(cuerpo) : undefined
      });
    } catch (e) { clearTimeout(t); return CAE_A_GOOGLE; }      /* red/timeout: Google */
    clearTimeout(t);
    var j = {}; try { j = await res.json(); } catch (e) { j = {}; }
    if (res.status === 409 && j.fuente === 'hoja') return CAE_A_GOOGLE;   /* la tabla aún no se pasó a Supabase */
    if (res.status === 401) { if (window.bsSesionInvalida && bsSesionInvalida({ code: 401 })) throw new Error('Sesión expirada. Vuelve a iniciar sesión.'); return CAE_A_GOOGLE; }
    if (res.status === 404 || res.status >= 500) return CAE_A_GOOGLE;
    if (j.ok === undefined) j.ok = !!j.success;
    if (!j.ok && !j.message) j.message = j.error || ('Error ' + res.status);
    return j;
  }
  async function tabla(clave, conAnulados) {
    var r = await edge('tabla', 'GET', null, 'clave=' + encodeURIComponent(clave) + (conAnulados ? '&anulados=1' : ''));
    if (r === CAE_A_GOOGLE) return r;
    if (!r.ok) return r;
    if (r.cargada === false) return CAE_A_GOOGLE;             /* tabla sin cargar todavía: Google */
    return r;
  }
  function guardar(clave, op, extra) { return edge('guardar', 'POST', Object.assign({ clave: clave, op: op }, extra || {})); }

  /* ---- HALLAZGOS (quejas) + seguimientos + buzones ---- */
  var ACCIONES = {
    bs_listarQuejas: async function () {
      var r = await tabla('bs_quejas', true); if (r === CAE_A_GOOGLE || !r.ok) return r;
      var items = (r.items || []).slice().sort(function (a, b) { return num(b.id) - num(a.id); });
      return { ok: true, items: items, total: items.length, fuente: 'supabase' };
    },
    bs_crearQueja: function (p) { return guardar('bs_quejas', 'crear', { datos: p.datos || {} }); },
    bs_actualizarQueja: function (p) { return guardar('bs_quejas', 'actualizar', { id: p.id, datos: p.datos || {} }); },
    bs_listarSeguimientosQueja: async function (p) {
      var r = await tabla('bs_quejas_seguim', true); if (r === CAE_A_GOOGLE || !r.ok) return r;
      var id = String(p.id_queja == null ? '' : p.id_queja).trim();
      var items = (r.items || []).filter(function (s) { return String(s.id_queja == null ? '' : s.id_queja).trim() === id; })
        .sort(function (a, b) { return num(a.numero_seguimiento) - num(b.numero_seguimiento); });
      return { ok: true, items: items };
    },
    bs_crearSeguimientoQueja: function (p) { return guardar('bs_quejas_seguim', 'seguimiento', { id: p.id_queja, datos: p.datos || {} }); },
    bs_cierreMasivoQuejas: function (p) { return guardar('bs_quejas', 'cierre_masivo', { fecha_corte: p.fecha_corte, motivo: p.motivo, simular: !!p.simular }); },
    bs_listarBuzones: async function (p) {
      var r = await tabla('bs_buzones', false); if (r === CAE_A_GOOGLE || !r.ok) return r;
      var fEmp = String((p && p.empresa) || '').trim().toUpperCase(), orden = [], mapa = {}, total = 0;
      (r.items || []).forEach(function (f) {
        var emp = String(f.empresa || '').trim(), sec = String(f.sector || '').trim();
        if (!emp && !sec) return;
        if (/^(false|no|0)$/i.test(String(f.activo == null ? '' : f.activo).trim())) return;
        if (fEmp && emp.toUpperCase() !== fEmp) return;
        var k = emp + '|' + sec;
        if (!mapa[k]) { mapa[k] = { empresa: emp, sector: sec, cantidad: 0, ubicaciones: [] }; orden.push(k); }
        mapa[k].ubicaciones.push({ numero: f.numero !== '' && f.numero != null ? f.numero : mapa[k].cantidad + 1, ubicacion: String(f.ubicacion || '').trim() });
        mapa[k].cantidad++; total++;
      });
      return { ok: true, total: total, sectores: orden.map(function (k) { return mapa[k]; }) };
    },
    /* ---- ACCIDENTES (casos + seguimientos + importación) ---- */
    bs_listarAccidentes: async function (p) {
      var r = await tabla('bs_accidentes_casos', true); if (r === CAE_A_GOOGLE || !r.ok) return r;
      var items = (r.items || []).slice();
      if (p && p.empresa) items = items.filter(function (i) { return i.empresa === p.empresa; });
      if (p && p.estado_caso) items = items.filter(function (i) { return i.estado_caso === p.estado_caso; });
      if (p && p.dni) items = items.filter(function (i) { return String(i.dni) === String(p.dni); });
      items.sort(function (a, b) { return num(b.id) - num(a.id); });
      return { ok: true, items: items, total: items.length, fuente: 'supabase' };
    },
    bs_crearAccidente: async function (p) {
      var r = await guardar('bs_accidentes_casos', 'crear', { datos: p.datos || {} });
      if (r !== CAE_A_GOOGLE && r.ok) { try { orig('bs_notificarCasoNuevo', { id: r.id, datos: p.datos || {} })['catch'](function () {}); } catch (e) {} }   /* el correo lo sigue mandando Google */
      if (r !== CAE_A_GOOGLE && r.ok && !r.message) r.message = 'Caso registrado';
      return r;
    },
    bs_actualizarAccidente: async function (p) { var r = await guardar('bs_accidentes_casos', 'actualizar', { id: p.id, datos: p.datos || {} }); if (r !== CAE_A_GOOGLE && r.ok && !r.message) r.message = 'Caso actualizado'; return r; },
    bs_listarSeguimientos: async function (p) {
      var r = await tabla('bs_accidentes_seguim', true); if (r === CAE_A_GOOGLE || !r.ok) return r;
      var id = String(p.id_caso == null ? p : p.id_caso).trim();
      var items = (r.items || []).filter(function (s) { return String(s.id_caso == null ? '' : s.id_caso).trim() === id; })
        .sort(function (a, b) { return num(a.numero_seguimiento) - num(b.numero_seguimiento); });
      return { ok: true, items: items, total: items.length };
    },
    bs_listarTodosSeguimientos: async function (p) {
      var r = await tabla('bs_accidentes_seguim', true); if (r === CAE_A_GOOGLE || !r.ok) return r;
      var items = r.items || [];
      if (p && p.id_caso) { var idc = String(p.id_caso); items = items.filter(function (x) { return String(x.id_caso) === idc; }); }
      return { ok: true, items: items };
    },
    bs_crearSeguimiento: function (p) { return guardar('bs_accidentes_seguim', 'seguimiento', { id: p.id_caso, datos: p.datos || {} }); },
    bs_importarAccidentes: function (p) { return guardar('bs_accidentes_casos', 'importar', { filas: p.filas || [] }); },
    /* anular / restaurar son genéricos: solo se redirigen si el módulo del registro ya está en Supabase */
    bs_anularRegistro: function (p) { var c = CLAVE_DE_MODULO[p.modulo]; return c && activo(p.modulo) ? guardar(c, 'anular', { id: p.id, motivo: p.motivo }) : CAE_A_GOOGLE; },
    bs_restaurarRegistro: function (p) { var c = CLAVE_DE_MODULO[p.modulo]; return c && activo(p.modulo) ? guardar(c, 'restaurar', { id: p.id, motivo: p.motivo }) : CAE_A_GOOGLE; }
  };
  var MODULO_DE_ACCION = { bs_listarQuejas: 'quejas', bs_crearQueja: 'quejas', bs_actualizarQueja: 'quejas', bs_listarSeguimientosQueja: 'quejas', bs_crearSeguimientoQueja: 'quejas', bs_cierreMasivoQuejas: 'quejas', bs_listarBuzones: 'quejas',
    bs_listarAccidentes: 'accidentes', bs_crearAccidente: 'accidentes', bs_actualizarAccidente: 'accidentes', bs_listarSeguimientos: 'accidentes', bs_listarTodosSeguimientos: 'accidentes', bs_crearSeguimiento: 'accidentes', bs_importarAccidentes: 'accidentes' };

  var orig = window.api;
  if (typeof orig !== 'function') return;
  window.api = async function (action, payload) {
    var fn = ACCIONES[action];
    var mod = MODULO_DE_ACCION[action];
    if (fn && (!mod || activo(mod))) {
      var r = await fn(payload || {});
      if (r !== CAE_A_GOOGLE) return r;
    }
    return orig(action, payload);
  };
  window.api.__supabase = true;
})();
