/* ═══════════════════════════════════════════════════════════════════════════
   bs-lactancia-motor.js — _BS_LACTANCIA_V1 (16-nov-2026)
   Motor de ACUMULACIÓN DEL PERMISO DE LACTANCIA (Ley 27240, mod. Leyes 27591 y 28731): 1 hora diaria (2 si parto múltiple)
   desde el retorno al trabajo hasta que el hijo cumple 1 año. La empresa la acumula en DÍAS COMPLETOS de descanso
   (con acuerdo escrito de la trabajadora). Reglas de Joel (16-nov-2026):
     · Temporada alta (jun–dic): L–V 06:15–16:36 = 9.6 h efectivas (refrigerio 45 min no cuenta); sábado y domingo descanso.
     · Temporada baja (ene–may): L–V 06:15–15:27 = 8.45 h; sábado 06:15–12:00 = 5.75 h (el sábado también genera su hora).
     · Los horarios pueden cambiar o mantenerse: se leen de la tabla bs_gs_lactancia_horarios (si no hay, estos valores).
     · El descanso se propone en el PRIMER día laborable en que el saldo alcanza las horas de ese día ("según el horario").
   Mismo archivo en el navegador (window.BSLactancia) y en el servidor (module.exports) para que la alerta y la pantalla
   calculen exactamente igual.
   ═══════════════════════════════════════════════════════════════════════════ */
(function (root, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(); else root.BSLactancia = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var DIA = 86400000;
  var HORARIOS_DEFECTO = [
    { nombre: 'Temporada alta', meses: '6-12', lv_horas: 9.6, sab_horas: 0, activo: 'SI', detalle: 'L–V 06:15–16:36 · sáb y dom descanso' },
    { nombre: 'Temporada baja', meses: '1-5', lv_horas: 8.45, sab_horas: 5.75, activo: 'SI', detalle: 'L–V 06:15–15:27 · sáb 06:15–12:00' }
  ];
  function ymd(v) { if (!v) return ''; if (v instanceof Date) { if (isNaN(v)) return ''; var z = new Date(v.getTime() - v.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); } var m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[1] + '-' + m[2] + '-' + m[3] : ''; }
  function fechaUTC(s) { return new Date(s + 'T00:00:00Z'); }
  function aYmd(d) { return d.toISOString().slice(0, 10); }
  function sumaDias(s, n) { var d = fechaUTC(s); d.setUTCDate(d.getUTCDate() + n); return aYmd(d); }
  function sumaAnios(s, n) { var d = fechaUTC(s); d.setUTCFullYear(d.getUTCFullYear() + n); return aYmd(d); }
  function diasEntre(a, b) { return Math.round((fechaUTC(b) - fechaUTC(a)) / DIA); }
  function num(v) { var n = Number(String(v == null ? '' : v).replace(',', '.')); return isNaN(n) ? 0 : n; }
  function si(v) { return v === true || String(v || '').trim().toUpperCase() === 'SI'; }
  function lista(v) { if (Array.isArray(v)) return v; if (!v) return []; try { var j = JSON.parse(v); return Array.isArray(j) ? j : []; } catch (e) { return []; } }
  function r2(n) { return Math.round(n * 100) / 100; }
  function mesEn(rango, mes) {   /* '6-12' · '1-5' · '1,2,3' · '' = todos */
    var s = String(rango || '').trim(); if (!s) return true;
    return s.split(',').some(function (p) { var m = p.trim().match(/^(\d+)\s*-\s*(\d+)$/); if (m) return mes >= +m[1] && mes <= +m[2]; return +p.trim() === mes; });
  }
  /* horario vigente para una fecha: activo, dentro de su vigencia (si la tiene) y cuyo rango de meses incluye el mes */
  function horarioDe(fecha, horarios) {
    var H = (horarios && horarios.length ? horarios : HORARIOS_DEFECTO).filter(function (h) { return h && !String(h.anulado || '').trim() && (h.activo === undefined || si(h.activo)); });
    var mes = +fecha.slice(5, 7);
    var conVig = H.filter(function (h) { var d = ymd(h.desde_fecha), hs = ymd(h.hasta_fecha); return (d || hs) && (!d || fecha >= d) && (!hs || fecha <= hs) && mesEn(h.meses, mes); });
    if (conVig.length) return conVig[0];
    var gen = H.filter(function (h) { return !ymd(h.desde_fecha) && !ymd(h.hasta_fecha) && mesEn(h.meses, mes); });
    return gen[0] || null;
  }
  function enAusencia(fecha, ausencias) { return ausencias.some(function (a) { var d = ymd(a.desde), h = ymd(a.hasta) || d; return d && fecha >= d && fecha <= h; }); }
  /* horas de jornada de un dia (0 = no laborable para ella) */
  function jornada(fecha, cfg) {
    if ((cfg.feriados || []).indexOf(fecha) >= 0) return { h: 0, motivo: 'feriado' };
    if (enAusencia(fecha, cfg.ausencias || [])) return { h: 0, motivo: 'ausencia' };
    var dow = fechaUTC(fecha).getUTCDay(), H = horarioDe(fecha, cfg.horarios);
    if (!H) return { h: 0, motivo: 'sin horario' };
    if (dow === 0) return { h: 0, motivo: 'domingo' };
    if (dow === 6) return { h: num(H.sab_horas), motivo: num(H.sab_horas) ? '' : 'sábado descanso', horario: H };
    return { h: num(H.lv_horas), motivo: '', horario: H };
  }
  function habilesDesde(hoy, fecha, cfg) { var n = 0, d = hoy; while (d < fecha && n < 400) { d = sumaDias(d, 1); if (jornada(d, { feriados: cfg.feriados, horarios: cfg.horarios, ausencias: [] }).h > 0) n++; } return n; }

  /* ── cálculo principal ──
     reg: { fecha_parto, parto_multiple, fecha_retorno, fecha_fin?, descansos:[{fecha, estado:'programado'|'tomado', horas?}], ausencias:[{desde,hasta,motivo}], estado }
     cfg: { horarios:[...], feriados:['aaaa-mm-dd'], hoy:'aaaa-mm-dd', anticipacionHabiles: 3, avisoFinDias: 30 } */
  function calcular(reg, cfg) {
    cfg = cfg || {};
    var hoy = ymd(cfg.hoy) || aYmd(new Date());
    var parto = ymd(reg.fecha_parto), retorno = ymd(reg.fecha_retorno);
    var fin = ymd(reg.fecha_fin) || (parto ? sumaDias(sumaAnios(parto, 1), -1) : '');   /* hasta el día anterior al 1er cumpleaños */
    var horasLact = si(reg.parto_multiple) ? 2 : 1;
    var R = { inicio: retorno, fin: fin, horasLact: horasLact, hoy: hoy, saldo: 0, horasGanadas: 0, horasDescansadas: 0, diasTomados: 0, diasProgramados: 0,
      diasDisponibles: 0, proximo: null, proyeccion: [], descansos: [], bitacora: [], alertas: [], diasRestantes: fin ? diasEntre(hoy, fin) : null, vigente: false, errores: [] };
    if (!parto) R.errores.push('Falta la fecha de parto.');
    if (!retorno) R.errores.push('Falta la fecha de retorno al trabajo.');
    if (R.errores.length) return R;
    if (retorno > fin) { R.errores.push('El retorno (' + retorno + ') es posterior al fin de la lactancia (' + fin + ').'); return R; }
    var C = { horarios: cfg.horarios, feriados: cfg.feriados || [], ausencias: lista(reg.ausencias) };
    var regDesc = {}; lista(reg.descansos).forEach(function (d) { var f = ymd(d.fecha); if (f && !/anulad/i.test(d.estado || '')) regDesc[f] = d; });
    var saldo = 0, d = retorno, tope = fin, guard = 0;
    R.vigente = String(reg.estado || 'Activa') !== 'Cerrada' && hoy <= fin;
    while (d <= tope && guard++ < 800) {
      var J = jornada(d, C), rd = regDesc[d], futuro = d > hoy;
      if (rd && !futuro && d < hoy && !/tomad/i.test(rd.estado || '')) {   /* programado que ya pasó y no se registró como tomado: se asume que trabajó (genera su hora) y se alerta */
        R.descansos.push({ fecha: d, estado: rd.estado || 'programado', horas: 0, saldo: null, registrado_por: rd.registrado_por || '', nota: rd.nota || '', vencido: true });
        rd = null;
      }
      if (rd) {   /* descanso registrado (programado o tomado): consume las horas de ese día, no genera */
        var h = rd.horas ? num(rd.horas) : (J.h || num((horarioDe(d, C.horarios) || {}).lv_horas));
        saldo -= h; R.horasDescansadas += h;
        if (/tomad/i.test(rd.estado)) R.diasTomados++; else R.diasProgramados++;
        R.descansos.push({ fecha: d, estado: rd.estado || 'programado', horas: r2(h), saldo: r2(saldo), registrado_por: rd.registrado_por || '', nota: rd.nota || '', vencido: !futuro && d < hoy && !/tomad/i.test(rd.estado) });
        R.bitacora.push({ fecha: d, tipo: 'descanso', horas: -r2(h), saldo: r2(saldo), estado: rd.estado });
        d = sumaDias(d, 1); continue;
      }
      if (J.h <= 0) { d = sumaDias(d, 1); continue; }   /* no laborable: ni genera ni consume */
      var esSab = fechaUTC(d).getUTCDay() === 6, evitarSab = cfg.evitarSabado !== false;   /* Joel: el descanso se propone en día de semana; el sábado (jornada corta) solo si se registra a mano */
      if (futuro && saldo >= J.h - 1e-9 && !(esSab && evitarSab)) {   /* proyección: primer día laborable en que alcanza -> descanso propuesto */
        saldo -= J.h; R.proyeccion.push({ fecha: d, horas: r2(J.h), saldo: r2(saldo) });
        R.bitacora.push({ fecha: d, tipo: 'propuesto', horas: -r2(J.h), saldo: r2(saldo) });
        d = sumaDias(d, 1); continue;
      }
      if (!futuro) { saldo += horasLact; R.horasGanadas += horasLact; R.bitacora.push({ fecha: d, tipo: 'trabajo', horas: horasLact, saldo: r2(saldo) }); }
      else { saldo += horasLact; }   /* futuro: sigue acumulando para proyectar los siguientes */
      if (d === hoy) R.saldo = r2(saldo);
      d = sumaDias(d, 1);
    }
    if (hoy < retorno) R.saldo = 0; else if (hoy > fin) { R.saldo = r2(saldo); } else if (R.saldo === 0 && R.bitacora.length) { var ult = R.bitacora.filter(function (b) { return b.fecha <= hoy; }).pop(); R.saldo = ult ? ult.saldo : 0; }
    /* próximo día laborable y días disponibles con el saldo de HOY */
    var sig = hoy, k = 0, JS = null; while (k++ < 60) { sig = sumaDias(sig, 1); JS = jornada(sig, C); if (JS.h > 0) break; }
    var jProx = JS && JS.h > 0 ? JS.h : num((horarioDe(hoy, C.horarios) || {}).lv_horas) || 9.6;
    R.jornadaProxima = r2(jProx); R.proximoLaborable = sig;
    R.diasDisponibles = Math.floor((R.saldo + 1e-9) / jProx);
    var progFuturos = R.descansos.filter(function (x) { return x.fecha >= hoy; })   /* v1.1: un descanso futuro ya registrado como tomado tambien cuenta como programado (antes disparaba 'sin_programar') */.sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; });
    R.proximo = progFuturos.length ? { fecha: progFuturos[0].fecha, horas: progFuturos[0].horas, estado: progFuturos[0].estado } : (R.proyeccion.length ? { fecha: R.proyeccion[0].fecha, horas: R.proyeccion[0].horas, estado: 'propuesto' } : null);
    /* alertas */
    var ant = cfg.anticipacionHabiles == null ? 3 : cfg.anticipacionHabiles, finAviso = cfg.avisoFinDias == null ? 30 : cfg.avisoFinDias;
    if (R.vigente) {
      R.descansos.forEach(function (x) { if (x.vencido) R.alertas.push({ n: 'rojo', t: 'Descanso por lactancia programado el ' + x.fecha + ' sin registrar como tomado', fecha: x.fecha, tipo: 'vencido' }); });
      if (R.proximo) {
        var hab = habilesDesde(hoy, R.proximo.fecha, C);
        if (R.proximo.fecha === hoy) R.alertas.push({ n: 'rojo', t: 'HOY le corresponde descanso por lactancia (' + R.proximo.horas + ' h)' + (R.proximo.estado === 'propuesto' ? ' · falta programarlo' : ''), fecha: R.proximo.fecha, tipo: 'hoy' });
        else if (hab <= ant) R.alertas.push({ n: 'ambar', t: 'Le corresponde descanso por lactancia el ' + R.proximo.fecha + ' (' + R.proximo.horas + ' h)' + (R.proximo.estado === 'propuesto' ? ' · falta programarlo' : /tomad/i.test(R.proximo.estado) ? ' · registrado como tomado' : ' · programado'), fecha: R.proximo.fecha, tipo: 'proximo' });
      }
      if (R.diasDisponibles >= 1 && !progFuturos.length && (!R.proyeccion.length || R.proyeccion[0].fecha > sig)) R.alertas.push({ n: 'ambar', t: 'Tiene ' + R.saldo + ' h acumuladas (' + R.diasDisponibles + ' día(s)) sin descanso programado', fecha: hoy, tipo: 'sin_programar' });
      if (R.diasRestantes != null && R.diasRestantes <= finAviso && R.saldo > 0) R.alertas.push({ n: R.diasRestantes <= 7 ? 'rojo' : 'ambar', t: 'La lactancia termina el ' + fin + ' (' + R.diasRestantes + ' días): quedan ' + R.saldo + ' h por programar', fecha: fin, tipo: 'fin' });
    }
    return R;
  }
  return { calcular: calcular, jornada: jornada, horarioDe: horarioDe, HORARIOS_DEFECTO: HORARIOS_DEFECTO, sumaDias: sumaDias, sumaAnios: sumaAnios, diasEntre: diasEntre, ymd: ymd, lista: lista };
});
