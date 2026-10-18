/* =========================================================================
 * BS-FICHA · Ficha del Trabajador 360°
 * Bienestar Social · Unifrutti Group — RAPEL S.A.C. / VERFRUT S.A.C.
 * Autor: Joel Ángel Timoteo Gonza
 * -------------------------------------------------------------------------
 * QUÉ HACE:
 *   Dos acciones de SOLO LECTURA que arman, a partir de un DNI, todo lo que
 *   Bienestar Social sabe de un trabajador. No crea hojas ni modifica datos.
 *
 *   bs_fichaBuscar     { q }    -> candidatos del padrón (DNI o apellido)
 *   bs_fichaTrabajador { dni }  -> padrón + contrato + kpis + alertas +
 *                                  accidentes + subsidios + hostigamiento
 *                                  (solo con permiso) + documentos + timeline
 *
 * INSTALACIÓN (2 pasos):
 *   1. Archivo nuevo "bs-ficha" en el editor de Apps Script → pegar todo.
 *   2. En el switch de doPost agregar:
 *
 *        case 'bs_fichaBuscar':      result = bs_fichaBuscar(params); break;
 *        case 'bs_fichaTrabajador':  result = bs_fichaTrabajador(params); break;
 *
 *   Luego: Implementar → Administrar implementaciones → ✏️ → Nueva versión.
 *
 * DEPENDE DE (ya existen en Código.gs):
 *   BS_CONFIG, PADRON_CONFIG, BS_HOSTIG_HOJAS, _aFecha, _hoy, _ymd,
 *   _bsSheetDocs_ (bs-evidencias), params._sesion (bs-seguridad).
 * ========================================================================= */

var BS_FICHA = {
  CACHE_SEG: 600,          // 10 min de caché por DNI
  MAX_CANDIDATOS: 12,
  POR_COBRAR_DIAS: 90      // alerta: subsidio por cobrar con más de 90 días
};

/* ---------- BUSCAR CANDIDATOS (DNI o apellido) ---------- */
function bs_fichaBuscar(d) {
  try {
    var q = String((d && d.q) || '').trim().toUpperCase();
    if (q.length < 3) return { ok: true, items: [] };
    var esDni = /^\d{3,8}$/.test(q);
    var C = PADRON_CONFIG;
    var ss = SpreadsheetApp.openById(C.SPREADSHEET_ID);
    var items = [];
    C.HOJAS.forEach(function (nombreHoja) {
      if (items.length >= BS_FICHA.MAX_CANDIDATOS) return;
      var sh = ss.getSheetByName(nombreHoja);
      if (!sh) return;
      var lr = sh.getLastRow(); if (lr < 2) return;
      var data = sh.getRange(2, 1, lr - 1, sh.getLastColumn()).getValues();
      var emp = nombreHoja.indexOf('RAPEL') >= 0 ? 'RAPEL' : 'VERFRUT';
      for (var i = 0; i < data.length && items.length < BS_FICHA.MAX_CANDIDATOS; i++) {
        var r = data[i];
        var dni = String(r[C.COL_DNI] || '').trim();
        var nombre = String(r[C.COL_NOMBRE] || '').trim().toUpperCase();
        if (!dni) continue;
        var hit = esDni ? dni.indexOf(q) === 0 : nombre.indexOf(q) >= 0;
        if (hit) items.push({ dni: dni, nombre: nombre, empresa: emp, cargo: String(r[7] || ''), zona: String(r[10] || '') });
      }
    });
    return { ok: true, items: items };
  } catch (e) {
    return { ok: false, message: 'Error buscando: ' + e.message };
  }
}

/* ---------- FICHA COMPLETA ---------- */
function bs_fichaTrabajador(d) {
  try {
    var dni = String((d && d.dni) || '').trim();
    if (!/^\d{8}$/.test(dni)) return { ok: false, message: 'DNI inválido (8 dígitos).' };

    var ses = (d && d._sesion) || {};
    var rol = String(ses.rol || '').toLowerCase();
    var esAdmin = rol.indexOf('admin') >= 0;
    var perm = ses.permisos || {};
    var puede = function (m) { return esAdmin || !!perm[m]; };

    // Caché por DNI + perfil de permisos (para no filtrar datos entre usuarios)
    var claveCache = 'bs_ficha_' + dni + '_' + (esAdmin ? 'A' : ['accidentes', 'subsidios', 'hostigamiento', 'quejas'].map(function (m) { return perm[m] ? 1 : 0; }).join(''));
    try {
      var c = CacheService.getScriptCache().get(claveCache);
      if (c) { var cached = JSON.parse(c); cached.cache = true; return cached; }
    } catch (e0) {}

    var hoy = _hoy();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var out = { ok: true, dni: dni, padron: null, contrato: null, kpis: {}, alertas: [], accidentes: [], subsidios: [], hostigamiento: [], documentos: [], timeline: [], permisos: { accidentes: puede('accidentes'), subsidios: puede('subsidios'), hostigamiento: puede('hostigamiento') } };

    /* --- 1. Padrón + clasificación de contrato --- */
    out.padron = _fichaPadron_(dni);
    if (out.padron) out.contrato = _fichaContrato_(out.padron, hoy);
    if (out.contrato) {
      if (out.contrato.porVencerDias !== null && out.contrato.porVencerDias >= 0 && out.contrato.porVencerDias <= PADRON_CONFIG.POR_VENCER_DIAS) {
        out.alertas.push({ nivel: 'ambar', modulo: 'contrato', titulo: 'Contrato vence en ' + out.contrato.porVencerDias + ' día(s)', detalle: 'Término: ' + out.contrato.fechaTermino });
      }
      if (out.contrato.proximoIndeterminado) {
        out.alertas.push({ nivel: 'ambar', modulo: 'contrato', titulo: 'Próximo a indeterminado', detalle: 'Cumple 54 meses el ' + out.contrato.fechaIndeterminado });
      }
    }

    /* --- 2. Accidentes --- */
    if (puede('accidentes')) {
      var acc = _fichaLeerHoja_(ss, BS_CONFIG.HOJA_ACC_CASOS, function (o) { return String(o.dni) === dni && !_fichaAnulado_(o); });
      acc.sort(function (a, b) { return (b.id || 0) - (a.id || 0); });
      out.accidentes = acc.map(function (o) {
        return { id: o.id, dia_accidente: _fichaFecha_(o.dia_accidente), tipo_accidente: o.tipo_accidente, parte_cuerpo: o.parte_cuerpo, diagnostico: o.diagnostico, estado_caso: o.estado_caso, estado: o.estado, descanso_medico: o.descanso_medico, dias_restriccion: Number(o.dias_restriccion) || 0, fecha_fin_restriccion: _fichaFecha_(o.fecha_fin_restriccion), fecha_reincorporo: _fichaFecha_(o.fecha_reincorporo), empresa: o.empresa, fundo: o.fundo };
      });
      var abiertos = out.accidentes.filter(function (a) { return !/cerrad|finaliz/i.test(String(a.estado_caso || '')); });
      out.kpis.accidentes_total = out.accidentes.length;
      out.kpis.accidentes_abiertos = abiertos.length;
      out.accidentes.forEach(function (a) {
        var fin = _aFecha(a.fecha_fin_restriccion);
        if (fin && fin.getTime() >= hoy.getTime()) {
          out.alertas.push({ nivel: 'rojo', modulo: 'accidentes', titulo: 'Restricción médica vigente', detalle: 'Hasta ' + a.fecha_fin_restriccion + ' · caso #' + a.id, id: a.id });
        }
        out.timeline.push({ fecha: a.dia_accidente, modulo: 'accidentes', id: a.id, titulo: 'Accidente: ' + (a.tipo_accidente || ''), detalle: a.diagnostico || '' });
      });
    }

    /* --- 3. Subsidios (columna "numero" = DNI) --- */
    if (puede('subsidios')) {
      var sub = _fichaLeerHoja_(ss, BS_CONFIG.HOJA_SUBSIDIOS, function (o) { return String(o.numero) === dni && !_fichaAnulado_(o); });
      sub.sort(function (a, b) { return (b.id || 0) - (a.id || 0); });
      var tram = 0, cob = 0, porCob = 0, noRec = 0, dias = 0;
      out.subsidios = sub.map(function (o) {
        var monto = _fichaMonto_(o);
        var cat = _fichaCatSub_(o);
        tram += monto; dias += Number(o.dias) || 0;
        if (cat === 'cobrado') cob += monto; else if (cat === 'no_recuperable') noRec += monto; else porCob += monto;
        var inicio = _fichaFecha_(o.inicio);
        if (cat === 'por_cobrar') {
          var fi = _aFecha(inicio);
          var edad = fi ? Math.round((hoy.getTime() - fi.getTime()) / 86400000) : 0;
          if (edad > BS_FICHA.POR_COBRAR_DIAS) out.alertas.push({ nivel: 'ambar', modulo: 'subsidios', titulo: 'Subsidio por cobrar con ' + edad + ' días', detalle: 'S/ ' + monto.toFixed(2) + ' · ' + (o.tipo || '') + ' · exp. ' + (o.expediente || '-'), id: o.id });
        }
        out.timeline.push({ fecha: inicio, modulo: 'subsidios', id: o.id, titulo: 'Subsidio ' + (o.tipo || ''), detalle: (o.dias || 0) + ' días · S/ ' + monto.toFixed(2) + ' · ' + cat.replace('_', ' ') });
        return { id: o.id, anio: o.anio, mes: o.mes, tipo: o.tipo, dias: Number(o.dias) || 0, inicio: inicio, termino: _fichaFecha_(o.termino), monto: monto, categoria: cat, estado: o.estado, estado_general: o.estado_general, expediente: o.expediente, empresa: o.empresa };
      });
      out.kpis.subsidios_total = out.subsidios.length;
      out.kpis.subsidios_dias = dias;
      out.kpis.subsidios_tramitado = Math.round(tram * 100) / 100;
      out.kpis.subsidios_cobrado = Math.round(cob * 100) / 100;
      out.kpis.subsidios_por_cobrar = Math.round(porCob * 100) / 100;
      out.kpis.subsidios_no_recuperable = Math.round(noRec * 100) / 100;
    }

    /* --- 4. Hostigamiento (ambas sedes; nombres enmascarados siempre) --- */
    if (puede('hostigamiento')) {
      var hojas = BS_HOSTIG_HOJAS || { PIURA: BS_CONFIG.HOJA_HOSTIG };
      Object.keys(hojas).forEach(function (sede) {
        var casos = _fichaLeerHoja_(ss, hojas[sede], function (o) { return (String(o.denunciante_dni) === dni || String(o.denunciado_dni) === dni) && !_fichaAnulado_(o); });
        casos.forEach(function (o) {
          var rolCaso = String(o.denunciante_dni) === dni ? 'denunciante' : 'denunciado';
          var f = _fichaFecha_(o.fecha_denuncia);
          out.hostigamiento.push({ id: o.id, codigo: o.codigo || (sede.slice(0, 3) + '-' + ('000' + o.id).slice(-3)), sede: sede, fecha_denuncia: f, rol: rolCaso, status: o.status, decision: o.decision, medida_proteccion: o.medida_proteccion, otra_parte: _fichaMascara_(rolCaso === 'denunciante' ? o.denunciado_nombre : o.denunciante_nombre), empresa: o.empresa });
          out.timeline.push({ fecha: f, modulo: 'hostigamiento', id: o.id, titulo: 'Caso de hostigamiento (' + rolCaso + ')', detalle: sede + ' · ' + (o.status || '') });
        });
      });
      out.kpis.hostigamiento_total = out.hostigamiento.length;
    }

    /* --- 5. Documentos de sus casos --- */
    try {
      if (typeof _bsSheetDocs_ === 'function') {
        var shD = _bsSheetDocs_();
        var lastD = shD.getLastRow();
        if (lastD >= 2) {
          var idsAcc = {}; out.accidentes.forEach(function (a) { idsAcc[String(a.id)] = 1; });
          var idsSub = {}; out.subsidios.forEach(function (s) { idsSub[String(s.id)] = 1; });
          var vals = shD.getRange(2, 1, lastD - 1, 9).getValues();
          vals.forEach(function (r) {
            var mod = String(r[1]).toUpperCase(), caso = String(r[2]);
            if ((mod === 'ACCIDENTES' && idsAcc[caso]) || (mod === 'SUBSIDIOS' && idsSub[caso])) {
              out.documentos.push({ id: r[0], modulo: mod, caso_id: caso, nombre: r[3], tipo: r[5], tamano_kb: r[6], fecha: _fichaFecha_(r[8]) });
            }
          });
        }
      }
    } catch (eDoc) {}
    out.kpis.documentos = out.documentos.length;

    /* --- 6. Línea de tiempo ordenada (más reciente primero) --- */
    out.timeline.sort(function (a, b) { return String(b.fecha || '').localeCompare(String(a.fecha || '')); });
    out.alertas.sort(function (a, b) { return (a.nivel === 'rojo' ? 0 : 1) - (b.nivel === 'rojo' ? 0 : 1); });

    try { CacheService.getScriptCache().put(claveCache, JSON.stringify(out), BS_FICHA.CACHE_SEG); } catch (e9) {}
    return out;
  } catch (e) {
    return { ok: false, message: 'Error armando la ficha: ' + e.message };
  }
}

/* ---------- helpers ---------- */
function _fichaPadron_(dni) {
  var C = PADRON_CONFIG;
  var ss = SpreadsheetApp.openById(C.SPREADSHEET_ID);
  for (var h = 0; h < C.HOJAS.length; h++) {
    var sh = ss.getSheetByName(C.HOJAS[h]);
    if (!sh) continue;
    var lr = sh.getLastRow(); if (lr < 2) continue;
    var col = sh.getRange(2, C.COL_DNI + 1, lr - 1, 1).getValues();
    for (var i = 0; i < col.length; i++) {
      if (String(col[i][0]).trim() === dni) {
        var r = sh.getRange(i + 2, 1, 1, sh.getLastColumn()).getValues()[0];
        // A=dni F=inicio G=sexo H=cargo I=régimen K=zona L=cumple/dirección N=empresa O=nombre P=ruta Q=código R=término
        return { dni: dni, nombre: String(r[C.COL_NOMBRE] || ''), empresa: String(r[C.COL_EMPRESA] || (C.HOJAS[h].indexOf('RAPEL') >= 0 ? 'RAPEL' : 'VERFRUT')), sexo: String(r[6] || ''), cargo: String(r[7] || ''), regimen: String(r[8] || ''), zona: String(r[10] || ''), ruta: String(r[15] || ''), codigo: String(r[16] || ''), fecha_inicio: _ymd(_aFecha(r[C.COL_INICIO])), fecha_termino: _ymd(_aFecha(r[C.COL_TERMINO])) };
      }
    }
  }
  return null;
}

function _fichaContrato_(p, hoy) {
  var C = PADRON_CONFIG;
  var ini = _aFecha(p.fecha_inicio);
  if (!ini) return { tipo: 'sin_fecha', etiqueta: 'Sin fecha de ingreso', antiguedadMeses: null, porVencerDias: null, proximoIndeterminado: false };
  var dias = Math.round((hoy.getTime() - ini.getTime()) / 86400000);
  var meses = (hoy.getFullYear() - ini.getFullYear()) * 12 + (hoy.getMonth() - ini.getMonth());
  if (hoy.getDate() < ini.getDate()) meses--;
  var tipo = dias <= C.PERIODO_PRUEBA_DIAS ? 'prueba' : (meses >= C.INDETERMINADO_MESES ? 'indeterminado' : 'plazo_fijo');
  var fIndet = new Date(ini.getFullYear(), ini.getMonth() + C.INDETERMINADO_MESES, ini.getDate());
  var dPara = Math.round((fIndet.getTime() - hoy.getTime()) / 86400000);
  var term = _aFecha(p.fecha_termino);
  return {
    tipo: tipo,
    etiqueta: tipo === 'prueba' ? 'Período de prueba' : tipo === 'indeterminado' ? 'Indeterminado' : 'Plazo fijo',
    antiguedadDias: dias,
    antiguedadMeses: meses,
    antiguedadTexto: Math.floor(meses / 12) + ' a ' + (meses % 12) + ' m',
    fechaIndeterminado: _ymd(fIndet),
    proximoIndeterminado: tipo === 'plazo_fijo' && dPara >= 0 && dPara <= C.PROXIMO_INDET_DIAS,
    fechaTermino: p.fecha_termino || '',
    porVencerDias: term ? Math.round((term.getTime() - hoy.getTime()) / 86400000) : null
  };
}

function _fichaLeerHoja_(ss, nombre, filtro) {
  var sh = ss.getSheetByName(nombre);
  if (!sh) return [];
  var data = sh.getDataRange().getValues();
  if (data.length <= 1) return [];
  var headers = data[0];
  var out = [];
  for (var i = 1; i < data.length; i++) {
    var o = {};
    for (var j = 0; j < headers.length; j++) o[headers[j]] = data[i][j];
    if (filtro(o)) out.push(o);
  }
  return out;
}

function _fichaAnulado_(o) { return /^(s|si|sí|true|1)$/i.test(String(o.anulado || '').trim()); }

function _fichaFecha_(v) {
  if (!v) return '';
  if (v instanceof Date) return _ymd(v);
  var s = String(v).trim();
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return m[1] + '-' + m[2] + '-' + m[3];
  var d = _aFecha(s); return d ? _ymd(d) : s;
}

// Misma lógica que montoSub() / catEstadoSub() del módulo y su dashboard,
// para que la ficha cuadre con la tabla de Subsidios.
function _fichaNum_(v) { var n = parseFloat(String(v === null || v === undefined ? '' : v).replace(/[^\d.-]/g, '')); return isNaN(n) ? 0 : n; }
function _fichaMonto_(o) {
  var v = _fichaNum_(o.monto_total);
  if (!v) v = _fichaNum_(o.pago_empresa) + _fichaNum_(o.recuperado_essalud);
  if (!v) v = _fichaNum_(o.reembolso_por_mes);
  if (!v) v = _fichaNum_(o.calculo_por_dia) * (parseInt(o.dias, 10) || 0);
  return Math.round(v * 100) / 100;
}

function _fichaCatSub_(o) {
  var e = String(o.estado_general || '').trim().toUpperCase();
  if (e === 'COBRADO' || e === 'RECUPERADO') return 'cobrado';
  if (e === 'NO RECUPERABLE') return 'no_recuperable';
  return 'por_cobrar';
}

function _fichaMascara_(nombre) {
  return String(nombre || '').trim().split(/\s+/).map(function (p) { return p ? p.charAt(0) + '***' : ''; }).join(' ');
}

/* ---------- Prueba manual (Run → ver Log) ---------- */
function probarFicha() {
  var r = bs_fichaTrabajador({ dni: '00000000', _sesion: { rol: 'admin', permisos: {} } });
  Logger.log(JSON.stringify(r).slice(0, 1500));
}
