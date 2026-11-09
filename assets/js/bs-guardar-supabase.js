/* =========================================================================
 * _BS_GUARDA_SUPABASE_V1 (08-nov-2026) · Bienestar Social guarda y lee DIRECTO en Supabase  · v6: todos los módulos (Hallazgos, Accidentes, Subsidios, Hostigamiento, Descansos, Rendiciones, Sugerencias)
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
  window.BS_SUPABASE_MODULOS = window.BS_SUPABASE_MODULOS || ['quejas', 'accidentes', 'subsidios', 'hostigamiento', 'descansos', 'rendiciones', 'sugerencias'];

  function hostSede(v) { return String(v || '').trim().toUpperCase().indexOf('OLM') >= 0 ? 'OLMOS' : 'PIURA'; }
  function hostClave(sede) { return hostSede(sede) === 'OLMOS' ? 'bs_hostigamiento_olmos' : 'bs_hostigamiento'; }
  function hostCodigo(sede, id) { return (hostSede(sede) === 'OLMOS' ? 'OLM' : 'PIU') + '-' + ('000' + (parseInt(id, 10) || 0)).slice(-3); }
  function claveDe(p) { var m = String((p && p.modulo) || '').toLowerCase(); return m === 'hostigamiento' ? hostClave(p.sede) : CLAVE_DE_MODULO[m]; }
  var DM = { UMBRAL_DIAS: 20, UMBRAL_AMBAR: 15, UMBRAL_INVALIDEZ: 150, PLAZO_CANJE_DIAS: 30, TIPOS: ['Enfermedad común', 'Accidente de trabajo', 'Accidente común', 'Maternidad'], ORIGENES: ['Particular', 'EsSalud'], CITT_ESTADOS: ['Pendiente de canje', 'Canjeado', 'Observado', 'No aplica'] };
  function dmHoy() { var n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
  function dmFecha(v) { var s = String(v || '').slice(0, 10), m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
  function dmAcumulados(items, anio) {
    var acc = {};
    items.forEach(function (x) {
      if (String(x.fecha_inicio).slice(0, 4) != anio) return;
      var k = String(x.dni), d = Number(x.dias) || 0;
      if (!acc[k]) acc[k] = { total: 0, maternidad: 0, porTipo: {}, nombre: x.nombre, empresa: x.empresa, items: [] };
      if (x.tipo === 'Maternidad') acc[k].maternidad += d; else acc[k].total += d;
      acc[k].porTipo[x.tipo] = (acc[k].porTipo[x.tipo] || 0) + d;
      acc[k].items.push({ id: x.id, tipo: x.tipo, inicio: x.fecha_inicio, fin: x.fecha_fin, dias: d, citt: x.citt_estado, id_subsidio: x.id_subsidio });
    });
    Object.keys(acc).forEach(function (k) { acc[k].subsidiable = Math.max(0, acc[k].total - DM.UMBRAL_DIAS); });
    return acc;
  }
  function dmSemaforo(total, tipo) { if (tipo === 'Maternidad') return 'azul'; if (total > DM.UMBRAL_DIAS) return 'rojo'; if (total >= DM.UMBRAL_AMBAR) return 'ambar'; return 'verde'; }
  function dmAlertas(items, acum) {
    var hoy = dmHoy(), al = [];
    items.forEach(function (x) {
      if (x.estado === 'Activo') al.push({ nivel: 'info', id: x.id, dni: x.dni, nombre: x.nombre, titulo: 'Descanso médico vigente hasta ' + x.fecha_fin });
      if (x.citt_estado === 'Pendiente de canje') {
        var ini = dmFecha(x.fecha_inicio), edad = ini ? Math.round((hoy.getTime() - ini.getTime()) / 86400000) : 0;
        if (edad > DM.PLAZO_CANJE_DIAS) al.push({ nivel: 'rojo', id: x.id, dni: x.dni, nombre: x.nombre, titulo: 'Certificado sin canjear a CITT hace ' + edad + ' días' });
        else if (edad > DM.PLAZO_CANJE_DIAS - 10) al.push({ nivel: 'ambar', id: x.id, dni: x.dni, nombre: x.nombre, titulo: 'Canje de CITT vence en ' + (DM.PLAZO_CANJE_DIAS - edad) + ' días' });
      }
    });
    Object.keys(acum).forEach(function (k) {
      var a = acum[k];
      if (a.total > DM.UMBRAL_DIAS) { var sinSub = a.items.some(function (i) { return i.tipo !== 'Maternidad' && !i.id_subsidio; }); al.push({ nivel: sinSub ? 'rojo' : 'ambar', dni: k, nombre: a.nombre, titulo: a.total + ' días acumulados (supera ' + DM.UMBRAL_DIAS + ')' + (sinSub ? ' · falta expediente de subsidio' : ' · con subsidio') }); }
      else if (a.total >= DM.UMBRAL_AMBAR) al.push({ nivel: 'ambar', dni: k, nombre: a.nombre, titulo: a.total + ' días acumulados, cerca del umbral' });
      if (a.total >= DM.UMBRAL_INVALIDEZ) al.push({ nivel: 'rojo', dni: k, nombre: a.nombre, titulo: a.total + ' días: evaluar incapacidad prolongada con EsSalud' });
    });
    var peso = { rojo: 0, ambar: 1, info: 2 }; al.sort(function (a, b) { return peso[a.nivel] - peso[b.nivel]; });
    return al;
  }
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
    /* ---- SUBSIDIOS ---- */
    bs_listarSubsidios: async function (p) {
      var r = await tabla('bs_subsidios', true); if (r === CAE_A_GOOGLE || !r.ok) return r;
      var items = (r.items || []).slice(), f = (p && p.filtros) || p || {};
      if (f.empresa) items = items.filter(function (i) { return i.empresa === f.empresa; });
      if (f.tipo) items = items.filter(function (i) { return i.tipo === f.tipo; });
      if (f.anio) items = items.filter(function (i) { return String(i.anio) === String(f.anio); });
      if (f.estado_general) items = items.filter(function (i) { return i.estado_general === f.estado_general; });
      items.sort(function (a, b) { return num(b.id) - num(a.id); });
      return { ok: true, items: items, total: items.length, fuente: 'supabase' };
    },
    bs_crearSubsidio: async function (p) { var r = await guardar('bs_subsidios', 'crear', { datos: p.datos || {} }); if (r !== CAE_A_GOOGLE && r.ok && !r.message) r.message = 'Subsidio registrado'; return r; },
    bs_actualizarSubsidio: async function (p) { var r = await guardar('bs_subsidios', 'actualizar', { id: p.id, datos: p.datos || {} }); if (r !== CAE_A_GOOGLE && r.ok && !r.message) r.message = 'Subsidio actualizado'; return r; },
    bs_importarSubsidios: function (p) { return guardar('bs_subsidios', 'importar', { filas: p.filas || [], modo: p.modo || 'upsert' }); },
    /* ---- HOSTIGAMIENTO (dos sedes = dos tablas; correlativo independiente; códigos PIU-001 / OLM-001) ---- */
    bs_listarHostigamiento: async function (p) {
      var f = (p && p.filtros) || p || {}, items = [];
      for (var i = 0; i < 2; i++) {
        var sede = i ? 'OLMOS' : 'PIURA', r = await edge('tabla', 'GET', null, 'clave=' + hostClave(sede) + '&anulados=1');
        if (r === CAE_A_GOOGLE) return r;
        if (!r.ok) return r;
        if (r.cargada === false) continue;                           /* OLMOS puede no tener registros aún */
        (r.items || []).forEach(function (o) { o.sede = sede; o.codigo = hostCodigo(sede, o.id); o.uid = sede + '-' + o.id; items.push(o); });
      }
      if (f.sede) items = items.filter(function (x) { return x.sede === hostSede(f.sede); });
      if (f.empresa) items = items.filter(function (x) { return x.empresa === f.empresa; });
      if (f.status) items = items.filter(function (x) { return x.status === f.status; });
      if (f.fundo) items = items.filter(function (x) { return String(x.fundo || '').toLowerCase().indexOf(String(f.fundo).toLowerCase()) >= 0; });
      items.sort(function (a, b) { var fa = String(a.fecha_denuncia || ''), fb = String(b.fecha_denuncia || ''); if (fa !== fb) return fa < fb ? 1 : -1; return num(b.id) - num(a.id); });
      return { ok: true, items: items, total: items.length, fuente: 'supabase' };
    },
    bs_crearHostigamiento: async function (p) {
      var sede = hostSede((p.datos || {}).sede), r = await guardar(hostClave(sede), 'crear', { datos: p.datos || {} });
      if (r !== CAE_A_GOOGLE && r.ok) { r.sede = sede; r.codigo = hostCodigo(sede, r.id); r.message = 'Denuncia ' + r.codigo + ' registrada en ' + sede; }
      return r;
    },
    bs_actualizarHostigamiento: async function (p) {
      var sede = hostSede((p.datos || {}).sede), r = await guardar(hostClave(sede), 'actualizar', { id: p.id, datos: p.datos || {} });
      if (r !== CAE_A_GOOGLE && r.ok) r.message = 'Denuncia ' + hostCodigo(sede, p.id) + ' actualizada';
      return r;
    },
    /* ---- DESCANSOS MÉDICOS (reglas = bs-descansos.js del Apps Script; los cálculos se hacen aquí sobre los datos de Supabase) ---- */
    bs_listarDescansos: async function (p) {
      var r = await tabla('bs_descansos', false); if (r === CAE_A_GOOGLE || !r.ok) return r;
      var f = (p && p.filtros) || p || {}, todos = r.items || [], items = todos.slice(), anio = parseInt(f.anio) || 0;
      if (f.empresa) items = items.filter(function (x) { return x.empresa === f.empresa; });
      if (f.dni) items = items.filter(function (x) { return String(x.dni) === String(f.dni); });
      if (f.tipo) items = items.filter(function (x) { return x.tipo === f.tipo; });
      if (f.estado) items = items.filter(function (x) { return x.estado === f.estado; });
      if (anio) items = items.filter(function (x) { return String(x.fecha_inicio).slice(0, 4) == anio; });
      var acum = dmAcumulados(todos, anio || dmHoy().getFullYear());
      items.forEach(function (x) { var a = acum[x.dni]; x.acumulado_anual = a ? a.total : 0; x.semaforo = dmSemaforo(x.acumulado_anual, x.tipo); });
      items.sort(function (a, b) { return num(b.id) - num(a.id); });
      return { ok: true, items: items, total: items.length, alertas: dmAlertas(items, acum), umbral: DM.UMBRAL_DIAS, catalogos: { tipos: DM.TIPOS, origenes: DM.ORIGENES, citt_estados: DM.CITT_ESTADOS }, fuente: 'supabase' };
    },
    bs_acumuladoDescansos: async function (p) {
      var dni = String((p && p.dni) || '').trim(), anio = parseInt(p && p.anio) || dmHoy().getFullYear();
      if (!dni) return { ok: false, message: 'Falta DNI.' };
      var r = await tabla('bs_descansos', false); if (r === CAE_A_GOOGLE || !r.ok) return r;
      var a = dmAcumulados((r.items || []).filter(function (x) { return String(x.dni) === dni; }), anio)[dni] || { total: 0, maternidad: 0, subsidiable: 0, porTipo: {}, items: [] };
      a.ok = true; a.dni = dni; a.anio = anio; a.umbral = DM.UMBRAL_DIAS; a.semaforo = dmSemaforo(a.total, ''); a.excedente = Math.max(0, a.total - DM.UMBRAL_DIAS);
      return a;
    },
    bs_dashboardDescansos: async function (p) {
      var r = await tabla('bs_descansos', false); if (r === CAE_A_GOOGLE || !r.ok) return r;
      var anio = parseInt(p && p.anio) || dmHoy().getFullYear(), empresa = (p && p.empresa) || '';
      var all = (r.items || []).filter(function (x) { return String(x.fecha_inicio).slice(0, 4) == anio && (!empresa || x.empresa === empresa); });
      var mesHoy = dmHoy().getMonth(), porMes = [], i; for (i = 0; i < 12; i++) porMes.push({ dm: 0, dias: 0 });
      var porTipo = {}, porEmpresa = { RAPEL: 0, VERFRUT: 0 }, porSector = {}, diag = {}, canje = { Canjeado: 0, 'Pendiente de canje': 0, Observado: 0, 'No aplica': 0 }, activos = 0, diasMes = 0;
      all.forEach(function (x) {
        var d = Number(x.dias) || 0, m = parseInt(String(x.fecha_inicio).slice(5, 7)) - 1;
        if (m >= 0 && m < 12) { porMes[m].dm++; porMes[m].dias += d; if (m === mesHoy) diasMes += d; }
        porTipo[x.tipo] = (porTipo[x.tipo] || 0) + d;
        if (porEmpresa[x.empresa] !== undefined) porEmpresa[x.empresa] += d;
        var sec = x.sector || '(sin sector)'; porSector[sec] = (porSector[sec] || 0) + d;
        var dg = x.cie10 || x.diagnostico || '(sin diagnóstico)'; diag[dg] = (diag[dg] || 0) + 1;
        if (canje[x.citt_estado] !== undefined) canje[x.citt_estado]++;
        if (x.estado === 'Activo') activos++;
      });
      var acum = dmAcumulados(all, anio);
      var rojos = Object.keys(acum).filter(function (k) { return acum[k].total > DM.UMBRAL_DIAS; }).map(function (k) { return { dni: k, nombre: acum[k].nombre, total: acum[k].total, empresa: acum[k].empresa }; }).sort(function (a, b) { return b.total - a.total; });
      var topDiag = Object.keys(diag).map(function (k) { return { k: k, n: diag[k] }; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 8);
      var topSector = Object.keys(porSector).map(function (k) { return { k: k, dias: porSector[k] }; }).sort(function (a, b) { return b.dias - a.dias; }).slice(0, 8);
      return { ok: true, anio: anio, kpis: { total_dm: all.length, dias_perdidos: all.reduce(function (s, x) { return s + (Number(x.dias) || 0); }, 0), activos: activos, dias_mes: diasMes, pendientes_canje: canje['Pendiente de canje'], trabajadores_rojo: rojos.length },
        porMes: porMes, porTipo: porTipo, porEmpresa: porEmpresa, topSector: topSector, topDiag: topDiag, canje: canje, rojos: rojos.slice(0, 15) };
    },
    bs_crearDescanso: async function (p) {
      var d = p.datos || {}, r = await guardar('bs_descansos', 'crear', { datos: d });
      if (r === CAE_A_GOOGLE || !r.ok) return r;
      var ac = await ACCIONES.bs_acumuladoDescansos({ dni: d.dni, anio: String(d.fecha_inicio || '').slice(0, 4) });
      r.acumulado = ac && ac.ok ? ac.total : null; r.message = 'Descanso médico registrado (' + r.dias + ' día(s)).';
      return r;
    },
    bs_actualizarDescanso: async function (p) { var r = await guardar('bs_descansos', 'actualizar', { id: p.id, datos: p.datos || {} }); if (r !== CAE_A_GOOGLE && r.ok) r.message = 'Descanso actualizado.'; return r; },
    bs_generarSubsidioDesdeDM: function (p) { return guardar('bs_descansos', 'generar_subsidio', { id: p.id }); },
    /* ---- RENDICIONES ---- */
    bs_listarRendiciones: async function (p) {
      var r = await tabla('bs_rendiciones', false); if (r === CAE_A_GOOGLE || !r.ok) return r;
      var f = (p && p.filtros) || p || {}, items = (r.items || []).slice();
      if (f.anio) items = items.filter(function (i) { return String(i.anio) === String(f.anio); });
      if (f.empresa) items = items.filter(function (i) { return i.empresa === f.empresa; });
      if (f.responsable) items = items.filter(function (i) { return i.responsable === f.responsable; });
      if (f.estado) items = items.filter(function (i) { return String(i.estado).toUpperCase() === String(f.estado).toUpperCase(); });
      items.sort(function (a, b) { return num(b.id) - num(a.id); });
      return { ok: true, items: items, total: items.length, fuente: 'supabase' };
    },
    bs_crearRendicion: async function (p) { var r = await guardar('bs_rendiciones', 'crear', { datos: p.datos || {} }); if (r !== CAE_A_GOOGLE && r.ok) r.message = 'Rendición registrada'; return r; },
    bs_actualizarRendicion: async function (p) { var r = await guardar('bs_rendiciones', 'actualizar', { id: p.id, datos: p.datos || {} }); if (r !== CAE_A_GOOGLE && r.ok) r.message = 'Rendición actualizada'; return r; },
    bs_eliminarRendicion: async function (p) { var r = await guardar('bs_rendiciones', 'eliminar', { id: p.id }); if (r !== CAE_A_GOOGLE && r.ok) r.message = 'Rendición eliminada'; return r; },
    /* ---- SUGERENCIAS (el correo al administrador lo sigue mandando Google: bs_notificarSugerencia) ---- */
    bs_listarSugerencias: async function (p) {
      var r = await edge('tabla', 'GET', null, 'clave=bs_sugerencias'); if (r === CAE_A_GOOGLE) return r; if (!r.ok) return r;
      var f = (p && p.filtros) || p || {}, items = r.cargada === false ? [] : (r.items || []).slice();
      if (f.estado) items = items.filter(function (i) { return i.estado === f.estado; });
      if (f.usuario) items = items.filter(function (i) { return i.usuario === f.usuario; });
      if (f.modulo) items = items.filter(function (i) { return i.modulo === f.modulo; });
      items.sort(function (a, b) { return num(b.id) - num(a.id); });
      return { ok: true, items: items, total: items.length, fuente: 'supabase' };
    },
    bs_crearSugerencia: async function (p) {
      var r = await guardar('bs_sugerencias', 'crear', { datos: p.datos || {} });
      if (r !== CAE_A_GOOGLE && r.ok) { r.message = 'Sugerencia enviada'; try { orig('bs_notificarSugerencia', { id: r.id, datos: p.datos || {} })['catch'](function () {}); } catch (e) {} }
      return r;
    },
    bs_actualizarSugerencia: async function (p) { var r = await guardar('bs_sugerencias', 'actualizar', { id: p.id, datos: p.datos || {} }); if (r !== CAE_A_GOOGLE && r.ok) r.message = 'Sugerencia actualizada'; return r; },
    bs_eliminarSugerencia: async function (p) { var r = await guardar('bs_sugerencias', 'eliminar', { id: p.id }); if (r !== CAE_A_GOOGLE && r.ok) r.message = 'Sugerencia eliminada'; return r; },
    /* anular / restaurar son genéricos: solo se redirigen si el módulo del registro ya está en Supabase */
    bs_anularRegistro: function (p) { var c = claveDe(p); return c && activo(p.modulo) ? guardar(c, 'anular', { id: p.id, motivo: p.motivo }) : CAE_A_GOOGLE; },
    bs_restaurarRegistro: function (p) { var c = claveDe(p); return c && activo(p.modulo) ? guardar(c, 'restaurar', { id: p.id, motivo: p.motivo }) : CAE_A_GOOGLE; }
  };
  var MODULO_DE_ACCION = { bs_listarQuejas: 'quejas', bs_crearQueja: 'quejas', bs_actualizarQueja: 'quejas', bs_listarSeguimientosQueja: 'quejas', bs_crearSeguimientoQueja: 'quejas', bs_cierreMasivoQuejas: 'quejas', bs_listarBuzones: 'quejas',
    bs_listarAccidentes: 'accidentes', bs_crearAccidente: 'accidentes', bs_actualizarAccidente: 'accidentes', bs_listarSeguimientos: 'accidentes', bs_listarTodosSeguimientos: 'accidentes', bs_crearSeguimiento: 'accidentes', bs_importarAccidentes: 'accidentes',
    bs_listarSubsidios: 'subsidios', bs_crearSubsidio: 'subsidios', bs_actualizarSubsidio: 'subsidios', bs_importarSubsidios: 'subsidios',
    bs_listarHostigamiento: 'hostigamiento', bs_crearHostigamiento: 'hostigamiento', bs_actualizarHostigamiento: 'hostigamiento',
    bs_listarDescansos: 'descansos', bs_acumuladoDescansos: 'descansos', bs_dashboardDescansos: 'descansos', bs_crearDescanso: 'descansos', bs_actualizarDescanso: 'descansos', bs_generarSubsidioDesdeDM: 'descansos',
    bs_listarRendiciones: 'rendiciones', bs_crearRendicion: 'rendiciones', bs_actualizarRendicion: 'rendiciones', bs_eliminarRendicion: 'rendiciones',
    bs_listarSugerencias: 'sugerencias', bs_crearSugerencia: 'sugerencias', bs_actualizarSugerencia: 'sugerencias', bs_eliminarSugerencia: 'sugerencias' };

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
