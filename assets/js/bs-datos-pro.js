/* ═══════════════════════════════════════════════════════════════════════════
   _BS_DATOS_PRO_V1 (07-nov-2026) — Bienestar Social · cargador común desde Supabase
   Trae en paralelo las tablas de los módulos (copia íntegra que sube el Apps Script a Supabase) a través
   de la Edge Function (bs/tabla, sin anulados) + el padrón (bs/padron). Caché de 5 min en sessionStorage.
   Si la Edge no responde (sin rl_token, red), cae a window.api() (lectura rápida / Google) cuando existe.
   Reglas de vencimiento ÚNICAS (las mismas que los dashboards de cada módulo):
     Hallazgos   abierto = resultado no cerrado/resuelto · vencido > 14 días · por vencer 8–14
     Accidentes  abierto = estado_caso no reincorporado/cerrado/alta · vencido > 30 días · por vencer 15–30
     Hostig.     abierto = status no resuelto/archivado/sin lugar · vencido > 30 días (plazo legal) · por vencer 20–30
     Subsidios   por cobrar (no cobrado/recuperado/no recuperable) · vencido > 90 días desde el inicio · por vencer 60–90
     Descansos   Activo con fecha_fin pasada = vencido · CITT pendiente de canje = por vencer
   Expone: window.BSDatos.cargar({modulos, fresco}) -> Promise<{quejas, accidentes, hostigamiento, subsidios, descansos, documentos, padron, origen, t, faltantes}>
           window.BSReglas  (ymd, dias, emp, estado por módulo, alertasDe(datos, permisos), montoSub, etc.)
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._BS_DATOS_PRO_V1) return; window._BS_DATOS_PRO_V1 = true;
  var EDGE = 'https://exdjzbfinppzatjyimxn.supabase.co/functions/v1/api';
  var TTL = 5 * 60e3;
  var TABLAS = { quejas: ['bs_quejas'], accidentes: ['bs_accidentes_casos'], hostigamiento: ['bs_hostigamiento', 'bs_hostigamiento_olmos'], subsidios: ['bs_subsidios'], descansos: ['bs_descansos'], documentos: ['bs_documentos'], auditoria: ['bs_auditoria'] };
  var API_MAP = { quejas: 'bs_listarQuejas', accidentes: 'bs_listarAccidentes', hostigamiento: 'bs_listarHostigamiento', subsidios: 'bs_listarSubsidios', descansos: 'bs_listarDescansos', auditoria: 'bs_listarAuditoria' };

  function txt(v) { return String(v == null ? '' : v).trim(); }
  function up(v) { return txt(v).toUpperCase(); }
  function num(v) { var n = parseFloat(String(v == null ? '' : v).replace(/[^\d.\-]/g, '')); return isNaN(n) ? 0 : n; }
  function ymd(v) {
    if (!v) return '';
    if (v instanceof Date) return isNaN(v) ? '' : v.getFullYear() + '-' + ('0' + (v.getMonth() + 1)).slice(-2) + '-' + ('0' + v.getDate()).slice(-2);
    var s = txt(v), m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
    m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/); if (m) { var y = +m[3]; if (y < 100) y += 2000; return y + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2); }
    var d = new Date(s); return isNaN(d) ? '' : ymd(d);
  }
  function hoy() { return ymd(new Date()); }
  function dias(a, b) { var A = ymd(a), B = ymd(b); if (!A || !B) return null; var d = Math.round((new Date(B + 'T12:00:00') - new Date(A + 'T12:00:00')) / 86400000); return isNaN(d) ? null : d; }
  function emp(v) { var s = up(v); return s.indexOf('VERFRUT') >= 0 ? 'VERFRUT' : s.indexOf('RAPEL') >= 0 ? 'RAPEL' : (s.indexOf('BOMAREA') >= 0 || s.indexOf('OLMOS') >= 0) ? 'BOMAREA' : (s ? s : 'OTRO'); }
  function esAnulado(o) { var a = o && o.anulado; return a === true || /^(s|si|sí|true|1)$/i.test(txt(a)); }
  function mesNum(m) { var s = up(m); if (!s) return 0; var n = parseInt(s, 10); if (n >= 1 && n <= 12) return n; var L = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']; if (s.indexOf('SET') === 0) return 9; for (var i = 0; i < 12; i++) if (s.indexOf(L[i]) === 0) return i + 1; return 0; }
  function rlToken() { try { return (JSON.parse(localStorage.getItem('bienestarSocialAuth') || '{}') || {}).rl_token || ''; } catch (e) { return ''; } }
  function sesion() { try { return JSON.parse(localStorage.getItem('bienestarSocialAuth') || '{}') || {}; } catch (e) { return {}; } }
  function puede(mod) { var u = sesion(); if (!u || !u.usuario) return false; if (/admin|geren/i.test(u.rol || '') || ['jtimoteo', 'ovilela'].indexOf(String(u.usuario).toLowerCase()) >= 0) return true; return !!(u.permisos && u.permisos[mod]); }

  /* ── reglas por módulo ─────────────────────────────────────────────── */
  var R = {
    quejas: { fecha: function (q) { return ymd(q.fecha_recepcion); }, cerrado: function (q) { return /cerrad|resuelt/i.test(txt(q.resultado)); }, limite: [14, 7], titulo: 'Hallazgos', color: '#e08a1e',
      desc: function (q) { return '#' + txt(q.id) + ' · ' + (txt(q.clasificacion) || 'Hallazgo') + (q.categoria ? ' · ' + txt(q.categoria) : ''); }, resp: function (q) { return txt(q.created_by); }, pagina: 'modulos/quejas.html' },
    accidentes: { fecha: function (c) { return ymd(c.dia_accidente); }, cerrado: function (c) { return /reincorpor|cerrad|finaliz|alta/i.test(txt(c.estado_caso)) && !/restric/i.test(txt(c.estado_caso)); }, limite: [30, 15], titulo: 'Accidentes', color: '#dc2626',
      desc: function (c) { return '#' + txt(c.id) + ' · ' + (txt(c.nombre) || 'Accidente') + (c.tipo_accidente ? ' · ' + txt(c.tipo_accidente) : ''); }, resp: function (c) { return txt(c.responsable) || txt(c.created_by); }, pagina: 'modulos/accidentes.html' },
    hostigamiento: { fecha: function (d) { return ymd(d.fecha_denuncia); }, cerrado: function (d) { return /resuel|archiv|sin lugar|cerrad/i.test(txt(d.status)); }, limite: [30, 20], titulo: 'Hostigamiento', color: '#7c3aed',
      desc: function (d) { return 'Denuncia #' + txt(d.id) + (d.fundo ? ' · ' + txt(d.fundo) : ''); }, resp: function (d) { return txt(d.created_by); }, pagina: 'modulos/hostigamiento.html' },
    subsidios: { fecha: function (s) { var y = ymd(s.inicio); if (y) return y; var a = parseInt(s.anio, 10), m = mesNum(s.mes); return a >= 2000 && m ? a + '-' + ('0' + m).slice(-2) + '-01' : ''; }, cerrado: function (s) { return catSub(s) !== 'Pendiente'; }, limite: [90, 60], titulo: 'Subsidios', color: '#0f766e',
      desc: function (s) { return (s.expediente ? 'Exp. ' + txt(s.expediente) : '#' + txt(s.id)) + ' · ' + conting(s) + ' · S/ ' + Math.round(montoSub(s)).toLocaleString('es-PE'); }, resp: function (s) { return txt(s.created_by); }, pagina: 'modulos/subsidios.html' },
    descansos: { fecha: function (x) { return ymd(x.fecha_inicio); }, cerrado: function (x) { return up(x.estado) !== 'ACTIVO'; }, limite: [0, 0], titulo: 'Descansos', color: '#0369a1',
      desc: function (x) { return (x.citt_numero ? 'CITT ' + txt(x.citt_numero) : 'DM ' + txt(x.id)) + ' · ' + (txt(x.nombre) || txt(x.dni)); }, resp: function (x) { return txt(x.created_by); }, pagina: 'modulos/descansos.html' }
  };
  function catSub(s) { var e = up(s.estado_general); if (e === 'COBRADO' || e === 'RECUPERADO') return 'Recuperado'; if (e === 'NO RECUPERABLE') return 'No recuperable'; return 'Pendiente'; }
  function montoSub(s) { var v = num(s.monto_total); if (!v) v = num(s.pago_empresa) + num(s.recuperado_essalud); if (!v) v = num(s.reembolso_por_mes); if (!v) v = num(s.calculo_por_dia) * (parseInt(s.dias, 10) || 0); return v; }
  function conting(s) { var t = up(s.tipo); if (!t || /^\d+$/.test(t)) t = up(s.descripcion); if (/MATERN/.test(t)) return 'Maternidad'; if (/INCAP/.test(t)) return 'Incapacidad temporal'; if (/LACTAN/.test(t)) return 'Lactancia'; if (/SEPELIO/.test(t)) return 'Sepelio'; return t ? t.charAt(0) + t.slice(1).toLowerCase() : '(sin contingencia)'; }

  /* estado de un registro: 'cerrado' | 'verde' | 'ambar' | 'rojo' (+ días) */
  function estado(mod, o, h) {
    var r = R[mod]; if (!r) return { n: 'verde', d: null };
    h = h || hoy();
    if (mod === 'descansos') {
      if (r.cerrado(o)) return { n: 'cerrado', d: null };
      var fin = ymd(o.fecha_fin), df = fin ? dias(fin, h) : null;
      if (df !== null && df > 0) return { n: 'rojo', d: df, motivo: 'activo con fecha de fin vencida hace ' + df + ' días' };
      if (/pendiente de canje/i.test(txt(o.citt_estado))) return { n: 'ambar', d: df, motivo: 'certificado pendiente de canje a CITT' };
      return { n: 'verde', d: df };
    }
    if (r.cerrado(o)) return { n: 'cerrado', d: null };
    var d = dias(r.fecha(o), h); if (d === null || d < 0) return { n: 'verde', d: null };
    if (d > r.limite[0]) return { n: 'rojo', d: d, motivo: d + ' días de atraso (límite ' + r.limite[0] + ')' };
    if (d > r.limite[1]) return { n: 'ambar', d: d, motivo: 'vence en ' + (r.limite[0] - d) + ' días' };
    return { n: 'verde', d: d };
  }
  /* alertas (rojo/ámbar) de todos los módulos cargados, ordenadas por atraso */
  function alertasDe(D, permisos) {
    var out = [], h = hoy();
    Object.keys(R).forEach(function (mod) {
      if (!D[mod] || (permisos && permisos[mod] === false)) return;
      D[mod].forEach(function (o) {
        var e = estado(mod, o, h); if (e.n !== 'rojo' && e.n !== 'ambar') return;
        var lim = mod === 'descansos' ? ymd(o.fecha_fin) : (function () { var f = R[mod].fecha(o); if (!f) return ''; var x = new Date(f + 'T12:00:00'); x.setDate(x.getDate() + R[mod].limite[0]); return ymd(x); })();
        out.push({ modulo: mod, titulo: R[mod].titulo, color: R[mod].color, estado: e.n, dias: e.d, motivo: e.motivo || '', descripcion: R[mod].desc(o), empresa: emp(o.empresa), limite: lim, responsable: R[mod].resp(o), id: o.id, pagina: R[mod].pagina, reg: o });
      });
    });
    out.sort(function (a, b) { if (a.estado !== b.estado) return a.estado === 'rojo' ? -1 : 1; return (b.dias || 0) - (a.dias || 0); });
    return out;
  }

  /* ── carga ─────────────────────────────────────────────────────────── */
  async function tabla(clave, tk) {
    var ctl = new AbortController(), t = setTimeout(function () { ctl.abort(); }, 12000);
    try {
      var r = await fetch(EDGE + '/bs/tabla?clave=' + encodeURIComponent(clave) + (clave === 'bs_auditoria' ? '&hora=1' : ''), { headers: { Authorization: 'Bearer ' + tk }, signal: ctl.signal });
      if (r.status === 403) return { items: [], prohibido: true };
      var j = await r.json(); if (!j || !j.success) throw new Error(j && j.error || 'HTTP ' + r.status);
      /* _BS_DATOS_FIX_V2 (07-nov): si la tabla aun no fue sincronizada a Supabase (cargada=false) NO es "0 registros":
         se avisa como error para que el modulo caiga a Google y se marque como parcial (antes Auditoria mostraba 0 eventos e "Integro"). */
      if (!j.cargada) throw new Error(clave + ' aún no está sincronizada en Supabase');
      return { items: j.items || [], cargada: true };
    } finally { clearTimeout(t); }
  }
  async function padron(tk) {
    try { var c = JSON.parse(localStorage.getItem('bsdp_padron_v1') || 'null'); if (c && c.t && Date.now() - c.t < 6 * 3600e3 && c.total) return c; } catch (e) {}
    var out = null;
    try { if (tk) { var r = await fetch(EDGE + '/bs/padron', { headers: { Authorization: 'Bearer ' + tk } }); var j = await r.json(); if (j && j.ok && j.total) out = { total: j.total, RAPEL: (j.porEmpresa.RAPEL || {}).total || 0, VERFRUT: (j.porEmpresa.VERFRUT || {}).total || 0, BOMAREA: (j.porEmpresa.OLMOS || {}).total || 0, fuente: 'Padrón RR.LL. (Supabase)', t: Date.now() }; } } catch (e) {}
    if (!out && typeof window.api === 'function') { try { var rC = await window.api('bs_clasificacion', {}); if (rC && rC.ok) { var s = function (o) { return o ? (o.prueba || 0) + (o.plazoFijo || 0) + (o.indeterminado || 0) : 0; }; out = { total: rC.total || 0, RAPEL: rC.porEmpresa ? s(rC.porEmpresa.RAPEL) : 0, VERFRUT: rC.porEmpresa ? s(rC.porEmpresa.VERFRUT) : 0, BOMAREA: 0, fuente: 'Padrón (Google)', t: Date.now() }; } } catch (e) {} }
    if (out) { try { localStorage.setItem('bsdp_padron_v1', JSON.stringify(out)); } catch (e) {} }
    return out || { total: 0, RAPEL: 0, VERFRUT: 0, BOMAREA: 0, fuente: 'sin dato', t: 0 };
  }
  var enCurso = null;
  async function cargar(opts) {
    opts = opts || {};
    var mods = opts.modulos || ['quejas', 'accidentes', 'hostigamiento', 'subsidios', 'descansos', 'documentos'];
    var key = 'bsdatos_' + mods.join('_');
    if (!opts.fresco) { try { var c = JSON.parse(sessionStorage.getItem(key) || 'null'); if (c && c.t && Date.now() - c.t < TTL) { c.deCache = true; return c; } } catch (e) {} }
    if (enCurso && enCurso.key === key) return enCurso.p;
    var p = (async function () {
      var tk = rlToken(), D = { origen: tk ? 'Supabase' : 'Google', t: Date.now(), faltantes: [], prohibidos: [] };
      var tareas = mods.map(async function (mod) {
        var items = [], ok = false;
        if (tk) {
          try { var partes = await Promise.all(TABLAS[mod].map(function (k) { return tabla(k, tk).catch(function (e) { return { items: [], error: e }; }); }));
            var prohib = partes.some(function (x) { return x.prohibido; }); if (prohib) { D.prohibidos.push(mod); D[mod] = []; return; }
            if (partes.every(function (x) { return x.error; })) throw partes[0].error;
            partes.forEach(function (x) { items = items.concat(x.items || []); }); ok = true; } catch (e) { console.warn('[_BS_DATOS_PRO_V1] ' + mod + ' edge:', e && e.message); }
        }
        if (!ok && typeof window.api === 'function' && API_MAP[mod]) { try { var r = await window.api(API_MAP[mod], {}); items = (r && r.ok && r.items) || []; ok = true; D.origen = 'Google / caché'; } catch (e) {} }
        if (!ok) D.faltantes.push(mod);
        D[mod] = items.filter(function (o) { return !esAnulado(o); });
        D[mod + '_anulados'] = items.length - D[mod].length;
      });
      tareas.push(padron(tk).then(function (p) { D.padron = p; }));
      await Promise.all(tareas);
      try { if (!D.faltantes.length && mods.indexOf('auditoria') < 0) sessionStorage.setItem(key, JSON.stringify(D)); } catch (e) {}
      return D;
    })();
    enCurso = { key: key, p: p };
    try { return await p; } finally { enCurso = null; }
  }
  /* evento de auditoría informado por el frontend (si el Apps Script tiene bs_registrarEvento; si no, se ignora) */
  function evento(accion, modulo, detalle, registro_id) {
    try { if (typeof window.api === 'function') window.api('bs_registrarEvento', { accion: accion, modulo: modulo, detalle: detalle || '', registro_id: registro_id || '' }).catch(function () {}); } catch (e) {}
  }
  window.BSDatos = { cargar: cargar, padron: padron, evento: evento, sesion: sesion, puede: puede };
  window.BSReglas = { R: R, estado: estado, alertasDe: alertasDe, ymd: ymd, hoy: hoy, dias: dias, emp: emp, txt: txt, up: up, num: num, mesNum: mesNum, catSub: catSub, montoSub: montoSub, conting: conting, esAnulado: esAnulado };
  console.log('[_BS_DATOS_PRO_V1 + _BS_DATOS_FIX_V2] listo');
})();
