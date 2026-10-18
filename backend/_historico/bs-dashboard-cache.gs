/*************************************************************************
 * BS-DASHBOARD-RAPIDO · Arregla la lentitud del portal
 * Bienestar Social · Unifrutti Group
 * ----------------------------------------------------------------------
 * MEDICIÓN REAL (tomada en el navegador de Joel):
 *   bs_dashboard .......... 42,479 ms   ← el cuello de botella
 *   bs_listarSubsidios ......  3,117 ms (2,319 registros, 1.4 MB)
 *   bs_listarHostigamiento ...... 3 ms
 *
 * POR QUÉ ERA TAN LENTO
 *   getEstadisticasBienestar arma un arreglo "recientes" con UN OBJETO POR
 *   CADA REGISTRO del sistema —más de 2,300 solo en subsidios— y para cada
 *   uno ejecuta new Date() sobre un texto. Después ordena miles de objetos
 *   para quedarse con 10. Todo eso en cada carga del portal, sin caché.
 *
 *   Y como Apps Script encola las ejecuciones de un mismo usuario, mientras
 *   esos 42 segundos corren, CUALQUIER otra llamada del sistema espera su
 *   turno. Por eso entrar a un módulo se sentía eterno: no era el módulo,
 *   era la cola detrás del dashboard del portal.
 *
 * QUÉ HACE ESTE BLOQUE
 *   1. Versión rápida: los totales se cuentan igual, pero "recientes" solo
 *      mira las últimas 60 filas de cada hoja (que es donde están los
 *      registros nuevos, porque las hojas crecen hacia abajo).
 *   2. Caché de 5 minutos, que se borra sola cuando alguien crea, edita,
 *      anula o importa algo.
 *   3. Suma la sede OLMOS al conteo de hostigamiento.
 *   4. Agrega rendiciones y sugerencias, que el portal pedía y el backend
 *      nunca devolvía (por eso esos dos KPIs jamás se llenaban).
 *
 * PASOS
 *   1) Pega este bloque al final del código GAS.
 *   2) En doPost, reemplaza la línea del dashboard por:
 *
 *        case 'bs_dashboard':  result = bs_dashboardRapido(params); break;
 *
 *   3) Justo ANTES del `return ContentService...` final de doPost, agrega:
 *
 *        try { bs_invalidarDashboard_(action, result); } catch (eInv) {}
 *
 *   4) Run -> bs_medirDashboard  (compara la vieja con la nueva; mira el Log)
 *   5) Implementar -> ✏️ -> Nueva versión.
 *
 *   NO hay que tocar getEstadisticasBienestar: se queda donde está, sin uso.
 *************************************************************************/

var BS_DASH_CACHE_SEG = 300;                        // 5 minutos
var BS_DASH_CLAVES = ['bs_dash_h0', 'bs_dash_h1'];  // sin / con acceso a hostigamiento
var BS_DASH_RECIENTES_POR_HOJA = 60;                // filas del final que se miran

/* ---------------- utilidades internas ---------------- */
function _bsdTxt_(v) { return String(v == null ? '' : v).trim(); }
function _bsdNum_(v) {
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  var x = Number(_bsdTxt_(v).replace(/[^0-9.\-]/g, ''));
  return isNaN(x) ? 0 : x;
}
function _bsdEmp_(v) {
  var s = _bsdTxt_(v).toUpperCase();
  if (s.indexOf('RAPEL') >= 0) return 'RAPEL';
  if (s.indexOf('VERFRUT') >= 0) return 'VERFRUT';
  if (s.indexOf('BOMAREA') >= 0) return 'BOMAREA';
  return 'OTRO';
}
/* Periodo AAAA-MM sin construir objetos Date cuando el valor ya es Date */
function _bsdYm_(v) {
  if (v instanceof Date) return v.getFullYear() + '-' + ('0' + (v.getMonth() + 1)).slice(-2);
  var m = _bsdTxt_(v).match(/(\d{4})\D(\d{1,2})/);
  return m ? m[1] + '-' + ('0' + m[2]).slice(-2) : '';
}
function _bsdFecha_(v) {
  if (v instanceof Date) return v;
  var s = _bsdTxt_(v);
  if (!s) return null;
  var d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
function _bsdCorta_(d) {
  return d ? (d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2)) : '';
}
function _bsdLeer_(ss, nombre) {
  var sh = ss.getSheetByName(nombre);
  if (!sh) return { h: [], rows: [] };
  var lr = sh.getLastRow(), lc = sh.getLastColumn();
  if (lc === 0 || lr < 2) return { h: [], rows: [] };
  var data = sh.getRange(1, 1, lr, lc).getValues();
  var h = data.shift().map(function (x) { return _bsdTxt_(x); });
  return { h: h, rows: data };
}

/* ---------------- versión rápida ---------------- */
function getEstadisticasBienestarRapido(permisos) {
  try {
    permisos = permisos || {};
    var verHost = permisos.hostigamiento === true || permisos.mod_hostigamiento === true;
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    var tend = {};
    function bump(p, mod) {
      if (!p) return;
      if (!tend[p]) tend[p] = { quejas: 0, accidentes: 0, hostigamiento: 0, subsidios: 0 };
      tend[p][mod]++;
    }

    var recientes = [];
    /* Solo se examinan las últimas filas de cada hoja: ahí están los
       registros nuevos, y son los únicos que pueden entrar al top 10. */
    function recientesDeCola(datos, cfg) {
      var n = datos.rows.length;
      var desde = Math.max(0, n - BS_DASH_RECIENTES_POR_HOJA);
      for (var i = desde; i < n; i++) {
        var r = datos.rows[i];
        var f = _bsdFecha_(cfg.fecha(r));
        recientes.push({
          modulo: cfg.modulo, icon: cfg.icon, fecha: _bsdCorta_(f),
          titulo: cfg.titulo(r), estado: cfg.estado(r), empresa: cfg.empresa ? cfg.empresa(r) : '',
          _ts: f ? f.getTime() : 0
        });
      }
    }
    function ix(h, n) { return h.indexOf(n); }

    /* ---- QUEJAS ---- */
    var q = _bsdLeer_(ss, 'BS_Quejas');
    var qRes = ix(q.h, 'resultado'), qFec = ix(q.h, 'fecha_recepcion'), qEmp = ix(q.h, 'empresa'), qCat = ix(q.h, 'categoria');
    var quejas = { total: 0, resueltas: 0, pendientes: 0, porEmpresa: { RAPEL: 0, VERFRUT: 0, BOMAREA: 0 } };
    for (var i = 0; i < q.rows.length; i++) {
      var r = q.rows[i];
      quejas.total++;
      if (qRes >= 0 && /resuelt|cerrad/i.test(_bsdTxt_(r[qRes]))) quejas.resueltas++;
      if (qEmp >= 0) { var e = _bsdEmp_(r[qEmp]); if (quejas.porEmpresa[e] !== undefined) quejas.porEmpresa[e]++; }
      if (qFec >= 0) bump(_bsdYm_(r[qFec]), 'quejas');
    }
    quejas.pendientes = quejas.total - quejas.resueltas;
    recientesDeCola(q, {
      modulo: 'Quejas', icon: '📋',
      fecha: function (r) { return qFec >= 0 ? r[qFec] : ''; },
      titulo: function (r) { return 'Queja' + (qCat >= 0 && _bsdTxt_(r[qCat]) ? ' · ' + _bsdTxt_(r[qCat]) : ''); },
      estado: function (r) { return (qRes >= 0 ? _bsdTxt_(r[qRes]) : '') || 'Pendiente'; },
      empresa: function (r) { return qEmp >= 0 ? _bsdEmp_(r[qEmp]) : ''; }
    });

    /* ---- ACCIDENTES ---- */
    var a = _bsdLeer_(ss, 'BS_Accidentes_Casos');
    var aEst = ix(a.h, 'estado_caso'), aFec = ix(a.h, 'dia_reportado'), aFec2 = ix(a.h, 'dia_accidente'),
        aEmp = ix(a.h, 'empresa'), aParte = ix(a.h, 'parte_cuerpo'), aTipo = ix(a.h, 'tipo_accidente');
    var accidentes = { total: 0, cerrados: 0, enSeguimiento: 0, porEmpresa: { RAPEL: 0, VERFRUT: 0, BOMAREA: 0 } };
    function aFechaDe(r) { return (aFec >= 0 && _bsdTxt_(r[aFec]) !== '') ? r[aFec] : (aFec2 >= 0 ? r[aFec2] : ''); }
    for (var i2 = 0; i2 < a.rows.length; i2++) {
      var r2 = a.rows[i2];
      accidentes.total++;
      if (aEst >= 0 && /cerrad/i.test(_bsdTxt_(r2[aEst]))) accidentes.cerrados++;
      if (aEmp >= 0) { var e2 = _bsdEmp_(r2[aEmp]); if (accidentes.porEmpresa[e2] !== undefined) accidentes.porEmpresa[e2]++; }
      bump(_bsdYm_(aFechaDe(r2)), 'accidentes');
    }
    accidentes.enSeguimiento = accidentes.total - accidentes.cerrados;
    recientesDeCola(a, {
      modulo: 'Accidentes', icon: '🩺', fecha: aFechaDe,
      titulo: function (r) {
        var det = (aParte >= 0 && _bsdTxt_(r[aParte])) ? _bsdTxt_(r[aParte]) : (aTipo >= 0 ? _bsdTxt_(r[aTipo]) : '');
        return 'Accidente' + (det ? ' · ' + det : '');
      },
      estado: function (r) { return (aEst >= 0 ? _bsdTxt_(r[aEst]) : '') || 'En seguimiento'; },
      empresa: function (r) { return aEmp >= 0 ? _bsdEmp_(r[aEmp]) : ''; }
    });

    /* ---- HOSTIGAMIENTO · las DOS sedes (gateado, confidencial) ---- */
    var hostigamiento = { acceso: verHost, total: 0, piura: 0, olmos: 0 };
    if (verHost) {
      ['BS_Hostigamiento', 'BS_Hostigamiento_Olmos'].forEach(function (hoja) {
        var hh = _bsdLeer_(ss, hoja);
        var hFec = ix(hh.h, 'fecha_denuncia'), hSt = ix(hh.h, 'status'), hSed = ix(hh.h, 'sede');
        var esOlmos = hoja.indexOf('Olmos') >= 0;
        for (var i3 = 0; i3 < hh.rows.length; i3++) {
          hostigamiento.total++;
          if (esOlmos) hostigamiento.olmos++; else hostigamiento.piura++;
          if (hFec >= 0) bump(_bsdYm_(hh.rows[i3][hFec]), 'hostigamiento');
        }
        recientesDeCola(hh, {
          modulo: 'Hostigamiento', icon: '🔒',
          fecha: function (r) { return hFec >= 0 ? r[hFec] : ''; },
          titulo: function (r) {
            var sd = (hSed >= 0 ? _bsdTxt_(r[hSed]) : '') || (esOlmos ? 'OLMOS' : 'PIURA');
            return 'Denuncia · ' + sd;
          },
          estado: function (r) { return (hSt >= 0 ? _bsdTxt_(r[hSt]) : '') || 'En proceso'; }
        });
      });
    }

    /* ---- SUBSIDIOS ---- */
    var s = _bsdLeer_(ss, 'BS_Subsidios');
    var sEst = ix(s.h, 'estado_general'), sAnio = ix(s.h, 'anio'), sMes = ix(s.h, 'mes'), sIni = ix(s.h, 'inicio'),
        sRec = ix(s.h, 'recuperado_essalud'), sTot = ix(s.h, 'monto_total'), sEmp = ix(s.h, 'empresa'), sTipo = ix(s.h, 'tipo');
    var subsidios = { total: 0, recuperadoEssalud: 0, montoTotal: 0, porEmpresa: { RAPEL: 0, VERFRUT: 0, BOMAREA: 0 }, porEstado: {} };
    var MESN = { ENERO: '01', FEBRERO: '02', MARZO: '03', ABRIL: '04', MAYO: '05', JUNIO: '06', JULIO: '07',
                 AGOSTO: '08', SEPTIEMBRE: '09', SETIEMBRE: '09', OCTUBRE: '10', NOVIEMBRE: '11', DICIEMBRE: '12' };
    function sPeriodo(r) {
      if (sAnio >= 0 && _bsdTxt_(r[sAnio])) {
        var mm = MESN[_bsdTxt_(r[sMes]).toUpperCase()] || ('0' + _bsdTxt_(r[sMes])).slice(-2);
        if (/^\d{2}$/.test(mm)) return _bsdTxt_(r[sAnio]) + '-' + mm;
      }
      return sIni >= 0 ? _bsdYm_(r[sIni]) : '';
    }
    for (var i4 = 0; i4 < s.rows.length; i4++) {
      var r4 = s.rows[i4];
      subsidios.total++;
      if (sRec >= 0) subsidios.recuperadoEssalud += _bsdNum_(r4[sRec]);
      if (sTot >= 0) subsidios.montoTotal += _bsdNum_(r4[sTot]);
      if (sEmp >= 0) { var e4 = _bsdEmp_(r4[sEmp]); if (subsidios.porEmpresa[e4] !== undefined) subsidios.porEmpresa[e4]++; }
      var est4 = (sEst >= 0 ? _bsdTxt_(r4[sEst]) : '') || 'Sin estado';
      subsidios.porEstado[est4] = (subsidios.porEstado[est4] || 0) + 1;
      bump(sPeriodo(r4), 'subsidios');
    }
    recientesDeCola(s, {
      modulo: 'Subsidios', icon: '💰',
      fecha: function (r) {
        if (sIni >= 0 && _bsdTxt_(r[sIni]) !== '') return r[sIni];
        var p = sPeriodo(r);
        return p ? p + '-01' : '';
      },
      titulo: function (r) { return 'Subsidio' + (sTipo >= 0 && _bsdTxt_(r[sTipo]) ? ' · ' + _bsdTxt_(r[sTipo]) : ''); },
      estado: function (r) { return (sEst >= 0 ? _bsdTxt_(r[sEst]) : '') || 'Sin estado'; },
      empresa: function (r) { return sEmp >= 0 ? _bsdEmp_(r[sEmp]) : ''; }
    });

    /* ---- RENDICIONES (el portal las pedía y no llegaban) ---- */
    var rd = _bsdLeer_(ss, 'BS_Rendiciones');
    var rTot = ix(rd.h, 'monto_total'), rEst = ix(rd.h, 'estado');
    var rendiciones = { total: 0, monto_total: 0, pendientes: 0 };
    for (var i5 = 0; i5 < rd.rows.length; i5++) {
      var r5 = rd.rows[i5];
      rendiciones.total++;
      if (rTot >= 0) rendiciones.monto_total += _bsdNum_(r5[rTot]);
      if (rEst >= 0 && !/deposit|cerrad|conform|aprobad/i.test(_bsdTxt_(r5[rEst]))) rendiciones.pendientes++;
    }

    /* ---- SUGERENCIAS ---- */
    var sg = _bsdLeer_(ss, 'BS_Sugerencias');
    var gEst = ix(sg.h, 'estado') >= 0 ? ix(sg.h, 'estado') : ix(sg.h, 'status');
    var sugerencias = { recibidas: 0, enProceso: 0 };
    for (var i6 = 0; i6 < sg.rows.length; i6++) {
      sugerencias.recibidas++;
      if (gEst >= 0 && /proceso|revis|pendient/i.test(_bsdTxt_(sg.rows[i6][gEst]))) sugerencias.enProceso++;
    }

    /* ---- TENDENCIA (últimos 12 periodos) ---- */
    var tendencia = Object.keys(tend).sort().slice(-12).map(function (p) {
      return { periodo: p, quejas: tend[p].quejas, accidentes: tend[p].accidentes, hostigamiento: tend[p].hostigamiento, subsidios: tend[p].subsidios };
    });

    /* ---- RECIENTES (top 10) ---- */
    recientes.sort(function (x, y) { return y._ts - x._ts; });
    recientes = recientes.slice(0, 10).map(function (it) {
      return { modulo: it.modulo, icon: it.icon, fecha: it.fecha, titulo: it.titulo, estado: it.estado, empresa: it.empresa };
    });

    return {
      ok: true, quejas: quejas, accidentes: accidentes, hostigamiento: hostigamiento,
      subsidios: subsidios, rendiciones: rendiciones, sugerencias: sugerencias,
      tendencia: tendencia, recientes: recientes, generado: new Date().toISOString()
    };
  } catch (err) {
    return { ok: false, message: String(err) };
  }
}

/* ---------------- caché de 5 minutos ---------------- */
function bs_dashboardRapido(params) {
  var permisos = (params && params.permisos) || {};
  var verHost = permisos.hostigamiento === true || permisos.mod_hostigamiento === true;
  var clave = verHost ? 'bs_dash_h1' : 'bs_dash_h0';
  var cache = null;
  try { cache = CacheService.getScriptCache(); } catch (e) {}

  if (cache) {
    try {
      var hit = cache.get(clave);
      if (hit) { var j = JSON.parse(hit); j.desdeCache = true; return j; }
    } catch (e) {}
  }

  var t0 = Date.now();
  var r = getEstadisticasBienestarRapido(permisos);
  r.msCalculo = Date.now() - t0;
  r.desdeCache = false;

  if (cache && r.ok) {
    try {
      var txt = JSON.stringify(r);
      if (txt.length < 95000) cache.put(clave, txt, BS_DASH_CACHE_SEG);
    } catch (e) {}
  }
  return r;
}

/* Borra la caché cuando alguien escribe, para que el portal no muestre
   datos viejos justo después de registrar algo. */
function bs_invalidarDashboard_(action, result) {
  if (!result || !result.ok) return;
  if (!/^bs_(crear|actualizar|eliminar|importar|anular|restaurar)/i.test(String(action))) return;
  try { CacheService.getScriptCache().removeAll(BS_DASH_CLAVES); } catch (e) {}
}

/* ---------------- diagnóstico: Run -> bs_medirDashboard ---------------- */
function bs_medirDashboard() {
  try { CacheService.getScriptCache().removeAll(BS_DASH_CLAVES); } catch (e) {}
  var P = { hostigamiento: true };

  var t1 = Date.now(); var vieja = getEstadisticasBienestar(P);      var msVieja = Date.now() - t1;
  var t2 = Date.now(); var nueva = getEstadisticasBienestarRapido(P); var msNueva = Date.now() - t2;
  var t3 = Date.now(); bs_dashboardRapido({ permisos: P });           var msCache1 = Date.now() - t3;
  var t4 = Date.now(); var c2 = bs_dashboardRapido({ permisos: P });  var msCache2 = Date.now() - t4;

  var msg = 'VIEJA: ' + msVieja + ' ms | NUEVA: ' + msNueva + ' ms | 1a con caché: ' + msCache1 +
            ' ms | 2a con caché: ' + msCache2 + ' ms (desdeCache=' + (c2.desdeCache === true) + ')\n' +
            'Totales -> quejas ' + vieja.quejas.total + '/' + nueva.quejas.total +
            ' · accidentes ' + vieja.accidentes.total + '/' + nueva.accidentes.total +
            ' · hostigamiento ' + vieja.hostigamiento.total + '/' + nueva.hostigamiento.total +
            ' (Piura ' + nueva.hostigamiento.piura + ' · Olmos ' + nueva.hostigamiento.olmos + ')' +
            ' · subsidios ' + vieja.subsidios.total + '/' + nueva.subsidios.total +
            ' | rendiciones ' + nueva.rendiciones.total + ' · sugerencias ' + nueva.sugerencias.recibidas;
  Logger.log(msg);
  return msg;
}
