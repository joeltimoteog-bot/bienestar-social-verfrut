/* =========================================================================
 * BS-DASH-HOSTIGAMIENTO  ·  Dashboard gerencial del indicador
 * Hostigamiento Sexual · COMPARATIVO PIURA vs OLMOS
 * Bienestar Social · Unifrutti Group  ·  Ley N° 27942 / DS 014-2019-TR
 * -------------------------------------------------------------------------
 * Modal autónomo. Lee datos reales del backend via api() (global de
 * hostigamiento.html):
 *   - api('bs_listarHostigamiento', {}) -> denuncias de AMBAS sedes
 *   - api('bs_clasificacion', {})       -> personal activo (total + empresa)
 * Carga Chart.js + datalabels bajo demanda (lazy). NO requiere cambios en GAS
 * más allá del bloque bs-hostigamiento-sedes.gs.
 *
 * CONFIDENCIALIDAD: los nombres nunca se muestran completos.
 *
 * USO (2 toques en hostigamiento.html):
 *   1) <script src="../assets/js/bs-dash-hostigamiento.js"></script>
 *   2) <button onclick="BSDashHostigamiento.abrir()">📊 Indicadores</button>
 * ========================================================================= */
window.BSDashHostigamiento = (function () {
  'use strict';

  var MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  /* Paleta validada con el validador de contraste/CVD (light, surface #fcfcfb):
   * bandas de luminosidad, chroma, separación protan/deutan/tritan y contraste. */
  var C_PIURA = '#2563eb', C_OLMOS = '#d97706';
  var PAL = ['#2563eb', '#e2001a', '#d97706', '#7c3aed', '#16a34a', '#0891b2', '#db2777'];
  var OK = '#16a34a', WARN = '#d97706', CRIT = '#dc2626', NEUTRO = '#94a3b8';
  var INK = '#0f172a', INK2 = '#475569', INK3 = '#94a3b8', GRID = '#e8edf5', SURF = '#ffffff';

  var SEDES = ['PIURA', 'OLMOS'];
  var C_SEDE = { PIURA: C_PIURA, OLMOS: C_OLMOS };

  /* Plazo del procedimiento de investigación y sanción (DS 014-2019-TR) */
  var PLAZO_HABILES = 30;

  var DATA = { casos: [], personal: { total: 0, RAPEL: 0, VERFRUT: 0 } };
  var F = { sede: '', empresa: '', anio: '', meses: {} };
  var charts = {};
  var montado = false;

  /* ---------- utilidades ---------- */
  function txt(v) { return String(v == null ? '' : v).trim(); }
  function up(v) { return txt(v).toUpperCase(); }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function parseF(v) {
    if (!v) return null;
    var s = String(v); var base = s.indexOf('T') >= 0 ? s.split('T')[0] : s; var p = base.split('-');
    if (p.length < 2 || !/^\d{4}$/.test(p[0])) {
      var d = new Date(v); if (isNaN(d.getTime())) return null;
      return { anio: String(d.getFullYear()), mes: ('0' + (d.getMonth() + 1)).slice(-2), d: d };
    }
    var dd = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2] || '1', 10));
    return { anio: p[0], mes: ('0' + parseInt(p[1], 10)).slice(-2), d: dd };
  }
  /* La sede manda; si el registro es anterior a la migración, se deduce del fundo */
  function sede(d) {
    var s = up(d.sede);
    if (s.indexOf('OLM') >= 0) return 'OLMOS';
    if (s.indexOf('PIU') >= 0) return 'PIURA';
    return up(d.fundo).indexOf('OLM') >= 0 ? 'OLMOS' : 'PIURA';
  }
  function emp(v) {
    var s = up(v);
    if (s.indexOf('VERFRUT') >= 0) return 'VERFRUT';
    if (s.indexOf('RAPEL') >= 0) return 'RAPEL';
    if (s.indexOf('BOMAREA') >= 0) return 'BOMAREA';
    return 'OTRO';
  }
  var EMPRESAS = ['RAPEL', 'VERFRUT', 'BOMAREA'];
  /* Paleta de empresas validada en all-pairs (deutan/protan/tritan) */
  var C_EMPRESA = { RAPEL: '#e2001a', VERFRUT: '#1d4ed8', BOMAREA: '#0d9488', OTRO: '#94a3b8' };

  /* Métricas de gestión de un conjunto de denuncias */
  function metricas(arr) {
    var n = arr.length;
    var cer = arr.filter(function (d) { return esCerrado(d.status); }).length;
    var ab = arr.filter(function (d) { return !esCerrado(d.status); });
    var med = arr.filter(tieneMedida).length;
    var desv = arr.filter(function (d) { return normMedida(d) === 'DESVINCULACIÓN'; }).length;
    var sd = 0; ab.forEach(function (d) { sd += diasCal(parseF(d.fecha_denuncia)); });
    return {
      n: n,
      cerrN: cer,
      cerr: n ? Math.round(cer * 100 / n) + ' %' : '—',
      cerrNum: n ? Math.round(cer * 100 / n) : 0,
      abiertos: ab.length,
      dias: ab.length ? Math.round(sd / ab.length) : '—',
      diasNum: ab.length ? Math.round(sd / ab.length) : 0,
      medida: n ? Math.round(med * 100 / n) + ' %' : '—',
      medidaNum: n ? Math.round(med * 100 / n) : 0,
      fuera: ab.filter(function (d) { return diasHab(parseF(d.fecha_denuncia)) > PLAZO_HABILES; }).length,
      desv: n ? Math.round(desv * 100 / n) + ' %' : '—',
      desvNum: n ? Math.round(desv * 100 / n) : 0
    };
  }
  function esCerrado(st) { return /resuel|archiv|sin lugar|cerrad/i.test(txt(st)); }
  function tieneMedida(d) { return txt(d.medida_proteccion).length > 2; }
  function mask(t) { t = txt(t); if (!t) return '(s/d)'; return t.length <= 3 ? '***' : t.substring(0, 2) + '***'; }

  function diasCal(f) { return (!f || !f.d) ? 0 : Math.max(0, Math.floor((new Date() - f.d) / 86400000)); }
  function diasHab(f) {
    if (!f || !f.d) return 0;
    var ini = new Date(f.d.getFullYear(), f.d.getMonth(), f.d.getDate());
    var hoy = new Date(); var fin = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    if (fin <= ini) return 0;
    var dias = Math.round((fin - ini) / 86400000);
    var hab = Math.floor(dias / 7) * 5, resto = dias % 7, dow = ini.getDay();
    for (var i = 1; i <= resto; i++) { var d2 = (dow + i) % 7; if (d2 !== 0 && d2 !== 6) hab++; }
    return hab;
  }

  /* Normaliza la decisión final a las categorías del reporte corporativo */
  function normMedida(d) {
    var s = up(d.decision) || up(d.status);
    if (!s) return 'SIN MEDIDA REGISTRADA';
    if (/DESVINCUL|DESPIDO|CESE|BAJA/.test(s)) return 'DESVINCULACIÓN';
    if (/RENUNCIA/.test(s)) return 'RENUNCIA VOLUNTARIA';
    if (/SUSPEN/.test(s)) return 'SUSPENSIÓN';
    if (/LLAMAD|AMONEST|MEMORAND/.test(s)) return 'LLAMADO DE ATENCIÓN';
    if (/NO HUBO|NO SE ACREDIT|INFUNDAD|SIN LUGAR|DESESTIM|ARCHIV/.test(s)) return 'NO HUBO HOSTIGAMIENTO SEXUAL';
    if (/INVESTIG|PROCESO|TRÁMITE|TRAMITE|PENDIENTE/.test(s)) return 'EN INVESTIGACIÓN';
    return 'OTRAS MEDIDAS';
  }
  var ORDEN_MEDIDA = ['DESVINCULACIÓN','RENUNCIA VOLUNTARIA','SUSPENSIÓN','LLAMADO DE ATENCIÓN',
                      'NO HUBO HOSTIGAMIENTO SEXUAL','EN INVESTIGACIÓN','OTRAS MEDIDAS','SIN MEDIDA REGISTRADA'];
  function colorMedida(k) {
    var i = ORDEN_MEDIDA.indexOf(k);
    return i < 0 ? NEUTRO : (i >= PAL.length ? NEUTRO : PAL[i]);
  }
  function colorEstado(e) { return esCerrado(e) ? OK : (/medida/i.test(e) ? C_PIURA : WARN); }

  /* ---------- filtros ---------- */
  function vivos() { return DATA.casos.filter(function (d) { return !d.anulado; }); }
  function porSedeEmpresa() {
    return vivos().filter(function (d) {
      if (F.sede && sede(d) !== F.sede) return false;
      if (F.empresa && emp(d.empresa) !== F.empresa) return false;
      return true;
    });
  }
  function aplicar() {
    return porSedeEmpresa().filter(function (d) {
      var p = parseF(d.fecha_denuncia); if (!p) return false;
      if (F.anio && p.anio !== F.anio) return false;
      var hayMes = Object.keys(F.meses).length > 0;
      if (hayMes && !F.meses[p.mes]) return false;
      return true;
    });
  }
  function aniosUnicos() {
    var set = {}; vivos().forEach(function (d) { var p = parseF(d.fecha_denuncia); if (p) set[p.anio] = true; });
    return Object.keys(set).sort();
  }
  function sedesVisibles() { return F.sede ? [F.sede] : SEDES; }

  /* ---------- lazy load Chart.js ---------- */
  function ensureLibs(cb) {
    function loadDL() {
      if (window.ChartDataLabels) return cb();
      var s2 = document.createElement('script');
      s2.src = 'https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0';
      s2.onload = function () { cb(); };
      s2.onerror = function () { cb(); };
      document.head.appendChild(s2);
    }
    if (window.Chart) return loadDL();
    var s1 = document.createElement('script');
    s1.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
    s1.onload = loadDL;
    s1.onerror = function () { alert('No se pudo cargar la librería de gráficos. Verifica tu conexión.'); };
    document.head.appendChild(s1);
  }
  function DL() { return window.ChartDataLabels ? [window.ChartDataLabels] : []; }

  /* ---------- estilos ---------- */
  function inyectarEstilos() {
    if (document.getElementById('bsdh-css')) return;
    var st = document.createElement('style');
    st.id = 'bsdh-css';
    st.textContent =
      '.bsdh-ov{position:fixed;inset:0;z-index:9999;background:#f1f4f9;display:none;flex-direction:column;font-family:Inter,system-ui,sans-serif;overflow:hidden;color:' + INK + ';}' +
      '.bsdh-ov.on{display:flex;}' +
      '.bsdh-bar{display:flex;justify-content:space-between;align-items:center;background:#fff;border-bottom:1px solid #dfe5ee;padding:10px 18px;flex-wrap:wrap;gap:10px;}' +
      '.bsdh-bar .ti{display:flex;align-items:center;gap:12px;}' +
      '.bsdh-bar .logo{width:42px;height:42px;border-radius:9px;background:#E2001A;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1.1rem;}' +
      '.bsdh-bar h1{margin:0;font-size:1.02rem;color:#E2001A;font-weight:800;line-height:1.1;letter-spacing:.01em;}' +
      '.bsdh-bar p{margin:2px 0 0;font-size:.68rem;color:' + INK + ';font-weight:700;letter-spacing:.03em;}' +
      '.bsdh-btn{border:1px solid #cbd5e1;background:#fff;color:' + INK2 + ';height:34px;padding:0 12px;border-radius:8px;font:700 12px Inter;cursor:pointer;}' +
      '.bsdh-btn:hover{border-color:#0a1c4d;color:#0a1c4d;}' +
      '.bsdh-x{border:none;background:#0a1c4d;color:#fff;width:34px;height:34px;border-radius:8px;font-size:1.05rem;cursor:pointer;}' +
      '.bsdh-body{flex:1;display:flex;overflow:hidden;}' +
      '.bsdh-side{width:186px;flex-shrink:0;background:#fff;border-right:1px solid #dfe5ee;padding:12px;overflow-y:auto;}' +
      '.bsdh-side h4{margin:0 0 6px;font-size:.58rem;letter-spacing:.09em;text-transform:uppercase;color:#fff;background:#0a1c4d;padding:6px 10px;border-radius:6px;text-align:center;}' +
      '.bsdh-grp{margin-bottom:14px;}' +
      '.bsdh-opt{display:flex;align-items:center;gap:7px;width:100%;text-align:left;border:1px solid #e2e8f0;background:#fff;color:#334155;padding:6px 10px;border-radius:6px;margin-bottom:4px;cursor:pointer;font:600 12px Inter;transition:.12s;}' +
      '.bsdh-opt:hover{border-color:#0a1c4d;}' +
      '.bsdh-opt.on{background:#0a1c4d;color:#fff;border-color:#0a1c4d;}' +
      '.bsdh-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;}' +
      '.bsdh-main{flex:1;padding:14px 18px 26px;overflow-y:auto;}' +
      '.bsdh-conf{background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:9px;padding:7px 12px;font-size:.67rem;font-weight:700;margin-bottom:10px;}' +
      '.bsdh-alert{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;border-radius:9px;padding:8px 12px;font-size:.72rem;font-weight:800;margin-bottom:10px;display:none;}' +
      '.bsdh-secc{font-size:.6rem;letter-spacing:.1em;text-transform:uppercase;color:' + INK3 + ';font-weight:800;margin:14px 2px 7px;}' +
      '.bsdh-hero{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;}' +
      '.bsdh-hc{background:#fff;border:1px solid #e2e8f0;border-top:3px solid #0a1c4d;border-radius:11px;padding:11px 14px;box-shadow:0 1px 3px rgba(15,23,42,.05);}' +
      '.bsdh-hc .big{font-size:1.6rem;font-weight:800;color:' + INK + ';line-height:1;font-variant-numeric:tabular-nums;}' +
      '.bsdh-hc .lbl{font-size:.58rem;letter-spacing:.06em;text-transform:uppercase;color:' + INK2 + ';margin-top:5px;font-weight:700;}' +
      '.bsdh-hc .sub{font-size:.6rem;color:' + INK3 + ';font-weight:700;margin-top:2px;}' +
      '.bsdh-hc.piura{border-top-color:' + C_PIURA + ';}.bsdh-hc.piura .big{color:' + C_PIURA + ';}' +
      '.bsdh-hc.olmos{border-top-color:' + C_OLMOS + ';}.bsdh-hc.olmos .big{color:' + C_OLMOS + ';}' +
      '.bsdh-hc.ok{border-top-color:' + OK + ';}.bsdh-hc.warn{border-top-color:' + WARN + ';}.bsdh-hc.crit{border-top-color:' + CRIT + ';}' +
      '.bsdh-grid{display:grid;grid-template-columns:repeat(12,1fr);gap:12px;}' +
      '.bsdh-c{background:' + SURF + ';border:1px solid #e2e8f0;border-radius:11px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,.05);display:flex;flex-direction:column;}' +
      '.bsdh-c .h{background:#0a1c4d;color:#fff;font-size:.63rem;letter-spacing:.05em;text-transform:uppercase;font-weight:700;padding:8px 11px;display:flex;justify-content:space-between;align-items:center;gap:8px;}' +
      '.bsdh-c .h .tag{background:#dcfce7;color:#14532d;border-radius:999px;padding:2px 7px;font-size:.55rem;letter-spacing:.04em;}' +
      '.bsdh-c .b{padding:11px;flex:1;position:relative;height:230px;}' +
      '.bsdh-c .b.tabla{height:auto;padding:0;}' +
      '.bsdh-empty{position:absolute;inset:11px;display:flex;align-items:center;justify-content:center;color:' + INK3 + ';font-size:.72rem;font-weight:600;text-align:center;background:' + SURF + ';}' +
      '.bsdh-load{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:' + INK2 + ';font-weight:700;background:#f1f4f9;z-index:5;}' +
      '.bsdh-sc{width:100%;border-collapse:collapse;font-size:.74rem;}' +
      '.bsdh-sc th{background:#f8fafc;color:' + INK2 + ';font-size:.6rem;letter-spacing:.06em;text-transform:uppercase;padding:8px 12px;text-align:right;border-bottom:1px solid #e2e8f0;}' +
      '.bsdh-sc th:first-child{text-align:left;}' +
      '.bsdh-sc th .dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:5px;vertical-align:middle;}' +
      '.bsdh-sc td{padding:8px 12px;text-align:right;border-bottom:1px solid #f1f5f9;font-variant-numeric:tabular-nums;color:' + INK + ';font-weight:700;}' +
      '.bsdh-sc td:first-child{text-align:left;font-weight:600;color:' + INK2 + ';}' +
      '.bsdh-sc tr:last-child td{border-bottom:none;}' +
      '.bsdh-c3{grid-column:span 3;}.bsdh-c4{grid-column:span 4;}.bsdh-c5{grid-column:span 5;}.bsdh-c6{grid-column:span 6;}.bsdh-c7{grid-column:span 7;}.bsdh-c8{grid-column:span 8;}.bsdh-c12{grid-column:span 12;}' +
      '@media(max-width:1250px){.bsdh-hero{grid-template-columns:repeat(3,1fr);}}' +
      '@media(max-width:1100px){.bsdh-c3,.bsdh-c4{grid-column:span 6;}.bsdh-c5,.bsdh-c6,.bsdh-c7,.bsdh-c8{grid-column:span 12;}}' +
      '@media print{.bsdh-side,.bsdh-x,.bsdh-btn{display:none!important;}.bsdh-ov{position:static;overflow:visible;}' +
        '.bsdh-main{overflow:visible;padding:0;}.bsdh-c{break-inside:avoid;page-break-inside:avoid;}}';
    document.head.appendChild(st);
  }

  /* ---------- shell ---------- */
  function tarjeta(clase, titulo, canvas, tag, vacio) {
    return '<div class="bsdh-c ' + clase + '"><div class="h"><span>' + titulo + '</span>' +
      (tag ? '<span class="tag">' + tag + '</span>' : '') + '</div>' +
      '<div class="b"><canvas id="' + canvas + '"></canvas>' +
      (vacio ? '<div class="bsdh-empty" id="' + canvas + 'Vacio" style="display:none;">' + vacio + '</div>' : '') +
      '</div></div>';
  }

  function montar() {
    if (montado) return;
    inyectarEstilos();
    var ov = document.createElement('div');
    ov.className = 'bsdh-ov';
    ov.id = 'bsdhOverlay';
    ov.innerHTML =
      '<div class="bsdh-bar">' +
        '<div class="ti"><div class="logo">U</div><div>' +
          '<h1>BIENESTAR SOCIAL</h1>' +
          '<p>DASHBOARD GERENCIAL · HOSTIGAMIENTO SEXUAL · COMPARATIVO PIURA vs OLMOS</p>' +
        '</div></div>' +
        '<div style="display:flex;align-items:center;gap:10px;">' +
          '<div id="bsdhUpd" style="font-size:.64rem;color:' + INK3 + ';text-align:right;line-height:1.4;"></div>' +
          '<button class="bsdh-btn" onclick="BSDashHostigamiento.imprimir()">🖨️ Imprimir</button>' +
          '<button class="bsdh-x" onclick="BSDashHostigamiento.cerrar()">✕</button>' +
        '</div>' +
      '</div>' +
      '<div class="bsdh-body">' +
        '<aside class="bsdh-side">' +
          '<div class="bsdh-grp"><h4>Sede</h4><div id="bsdhSede"></div></div>' +
          '<div class="bsdh-grp"><h4>Empresa</h4><div id="bsdhEmp"></div></div>' +
          '<div class="bsdh-grp"><h4>Año</h4><div id="bsdhAnio"></div></div>' +
          '<div class="bsdh-grp"><h4>Mes</h4><div id="bsdhMes"></div></div>' +
        '</aside>' +
        '<main class="bsdh-main" style="position:relative;">' +
          '<div class="bsdh-load" id="bsdhLoad">Cargando datos…</div>' +
          '<div class="bsdh-conf">🔐 Información confidencial · Ley N° 29733 y Ley N° 27942. Los nombres se muestran enmascarados en todo el tablero.</div>' +
          '<div class="bsdh-alert" id="bsdhAlerta"></div>' +

          '<div class="bsdh-secc">Resumen del periodo</div>' +
          '<div class="bsdh-hero">' +
            '<div class="bsdh-hc"><div class="big" id="hkTotal">—</div><div class="lbl">Total casos registrados</div><div class="sub" id="hkTotalSub"></div></div>' +
            '<div class="bsdh-hc"><div class="big" id="hkA1">—</div><div class="lbl" id="hkA1Lbl">Casos año anterior</div></div>' +
            '<div class="bsdh-hc"><div class="big" id="hkA2">—</div><div class="lbl" id="hkA2Lbl">Casos año actual</div></div>' +
            '<div class="bsdh-hc piura"><div class="big" id="hkPiura">—</div><div class="lbl">Sede Piura</div><div class="sub" id="hkPiuraSub"></div></div>' +
            '<div class="bsdh-hc olmos"><div class="big" id="hkOlmos">—</div><div class="lbl">Sede Olmos</div><div class="sub" id="hkOlmosSub"></div></div>' +
          '</div>' +

          '<div class="bsdh-secc">Indicadores de gestión</div>' +
          '<div class="bsdh-hero">' +
            '<div class="bsdh-hc"><div class="big" id="hkTasa">—</div><div class="lbl">Denuncias × 1.000 trabajadores</div><div class="sub" id="hkTasaSub"></div></div>' +
            '<div class="bsdh-hc ok"><div class="big" id="hkCerrados">—</div><div class="lbl">% de casos cerrados</div><div class="sub" id="hkCerradosSub"></div></div>' +
            '<div class="bsdh-hc warn"><div class="big" id="hkDias">—</div><div class="lbl">Días prom. casos abiertos</div><div class="sub" id="hkDiasSub"></div></div>' +
            '<div class="bsdh-hc"><div class="big" id="hkMedida">—</div><div class="lbl">% con medida de protección</div><div class="sub" id="hkMedidaSub"></div></div>' +
            '<div class="bsdh-hc crit"><div class="big" id="hkPlazo">—</div><div class="lbl">Fuera de plazo legal</div><div class="sub">Más de ' + PLAZO_HABILES + ' días hábiles</div></div>' +
          '</div>' +

          '<div class="bsdh-secc">Comparativo por sede</div>' +
          '<div class="bsdh-grid">' +
            '<div class="bsdh-c bsdh-c12"><div class="h"><span>Tablero comparativo Piura vs Olmos</span><span class="tag">NUEVO</span></div><div class="b tabla" id="hScorecard"></div></div>' +
            tarjeta('bsdh-c7', 'Evolución mensual de denuncias por sede', 'hChMes') +
            tarjeta('bsdh-c5', 'Estado de los casos', 'hChEstado') +
            tarjeta('bsdh-c6', 'Casos por sede y año', 'hChSedeAnio') +
            tarjeta('bsdh-c6', 'Distribución por medida o conclusión', 'hChMedida') +
            tarjeta('bsdh-c6', 'Cargos de los denunciados', 'hChCargo') +
            tarjeta('bsdh-c6', 'Casos por empresa del denunciado', 'hChEmpresa') +
            tarjeta('bsdh-c6', 'Medida o conclusión por sede', 'hChMedidaSede', 'NUEVO') +
            tarjeta('bsdh-c6', 'Antigüedad de casos abiertos', 'hChEdad', 'NUEVO',
                    'No hay casos abiertos en el periodo filtrado ✔') +
          '</div>' +
        '</main>' +
      '</div>';
    document.body.appendChild(ov);
    montado = true;
  }

  /* ---------- helpers de charts ---------- */
  function destroy() { Object.keys(charts).forEach(function (k) { if (charts[k]) { charts[k].destroy(); charts[k] = null; } }); }
  function ctx(id) { var el = document.getElementById(id); return el ? el.getContext('2d') : null; }
  function vacio(id, mostrar) { var el = document.getElementById(id + 'Vacio'); if (el) el.style.display = mostrar ? 'flex' : 'none'; }

  var EJE = { ticks: { color: INK2, font: { size: 10 } }, grid: { color: GRID, drawTicks: false }, border: { color: GRID } };
  function ejeY(extra) {
    var y = { beginAtZero: true, ticks: { color: INK2, font: { size: 10 }, precision: 0 }, grid: { color: GRID, drawTicks: false }, border: { display: false } };
    if (extra) Object.keys(extra).forEach(function (k) { y[k] = extra[k]; });
    return y;
  }
  function leyenda(mostrar) {
    return { display: mostrar !== false, position: 'bottom', labels: { color: INK2, font: { size: 10, weight: '600' }, boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: 'circle', padding: 14 } };
  }

  function doughnut(id, labels, data, colors) {
    var c = ctx(id); if (!c) return;
    var tot = data.reduce(function (a, b) { return a + b; }, 0);
    charts[id] = new Chart(c, {
      type: 'doughnut',
      data: { labels: labels, datasets: [{ data: data, backgroundColor: colors, borderWidth: 2, borderColor: SURF, hoverOffset: 6 }] },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '60%',
        plugins: {
          legend: leyenda(),
          datalabels: {
            color: '#fff', font: { weight: '800', size: 11 },
            formatter: function (v) { if (!v) return ''; var p = tot ? Math.round(v * 100 / tot) : 0; return p < 6 ? '' : v + '\n' + p + '%'; }
          },
          tooltip: { callbacks: { label: function (x) { var p = tot ? Math.round(x.parsed * 100 / tot) : 0; return '  ' + x.label + ': ' + x.parsed + ' caso(s) · ' + p + '%'; } } }
        }
      }, plugins: DL()
    });
  }

  /* Barras por sede: agrupadas o apiladas, siempre con separador de 2px */
  function barrasSede(id, labels, dataPorSede, opciones) {
    opciones = opciones || {};
    var c = ctx(id); if (!c) return;
    var vis = sedesVisibles();
    var ds = vis.map(function (s) {
      return {
        label: s, data: labels.map(function (l) { return (dataPorSede[s] && dataPorSede[s][l]) || 0; }),
        backgroundColor: C_SEDE[s], borderRadius: 4, borderSkipped: false,
        borderWidth: opciones.apilado ? 2 : 0, borderColor: SURF, maxBarThickness: 34
      };
    });
    charts[id] = new Chart(c, {
      type: 'bar', data: { labels: labels, datasets: ds },
      options: {
        indexAxis: opciones.horizontal ? 'y' : 'x',
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: leyenda(vis.length > 1),
          datalabels: {
            anchor: 'end', align: opciones.horizontal ? 'right' : 'top', offset: 2,
            color: INK2, font: { weight: '700', size: 10 },
            display: function (c2) { return c2.dataset.data[c2.dataIndex] > 0; },
            formatter: function (v) { return v || ''; }
          },
          tooltip: { callbacks: { label: function (x) { return '  ' + x.dataset.label + ': ' + (opciones.horizontal ? x.parsed.x : x.parsed.y) + ' caso(s)'; } } }
        },
        scales: opciones.horizontal
          ? { x: ejeY({ stacked: !!opciones.apilado }), y: { stacked: !!opciones.apilado, ticks: { color: INK2, font: { size: 10 } }, grid: { display: false }, border: { display: false } } }
          : { x: { stacked: !!opciones.apilado, ticks: { color: INK2, font: { size: 10 } }, grid: { display: false }, border: { color: GRID } }, y: ejeY({ stacked: !!opciones.apilado }) }
      }, plugins: DL()
    });
  }

  /* ---------- render ---------- */
  function render() {
    if (!window.Chart) return;
    destroy();
    var items = aplicar();
    var total = items.length;
    var vis = sedesVisibles();
    var porSede = {}; SEDES.forEach(function (s) { porSede[s] = items.filter(function (d) { return sede(d) === s; }); });

    /* ---- KPIs del modelo ---- */
    var anios = aniosUnicos();
    var aAct = F.anio || (anios.length ? anios[anios.length - 1] : String(new Date().getFullYear()));
    var aAnt = String(parseInt(aAct, 10) - 1);
    var base = porSedeEmpresa();
    var nA1 = base.filter(function (d) { var p = parseF(d.fecha_denuncia); return p && p.anio === aAnt; }).length;
    var nA2 = base.filter(function (d) { var p = parseF(d.fecha_denuncia); return p && p.anio === aAct; }).length;

    document.getElementById('hkTotal').textContent = total;
    document.getElementById('hkTotalSub').textContent = F.anio ? ('Año ' + F.anio) : 'Serie histórica completa';
    document.getElementById('hkA1').textContent = nA1;
    document.getElementById('hkA1Lbl').textContent = 'Casos ' + aAnt;
    document.getElementById('hkA2').textContent = nA2;
    document.getElementById('hkA2Lbl').textContent = 'Casos ' + aAct;
    var pc = function (n) { return total ? Math.round(n * 100 / total) + '% del total' : '—'; };
    document.getElementById('hkPiura').textContent = porSede.PIURA.length;
    document.getElementById('hkPiuraSub').textContent = pc(porSede.PIURA.length);
    document.getElementById('hkOlmos').textContent = porSede.OLMOS.length;
    document.getElementById('hkOlmosSub').textContent = pc(porSede.OLMOS.length);

    /* ---- KPIs de gestión ---- */
    var personal = F.empresa ? (DATA.personal[F.empresa] || 0) : DATA.personal.total;
    var cerrados = items.filter(function (d) { return esCerrado(d.status); });
    var abiertos = items.filter(function (d) { return !esCerrado(d.status); });
    var conMedida = items.filter(tieneMedida);
    var sumD = 0; abiertos.forEach(function (d) { sumD += diasCal(parseF(d.fecha_denuncia)); });
    var promD = abiertos.length ? Math.round(sumD / abiertos.length) : 0;
    var fuera = abiertos.filter(function (d) { return diasHab(parseF(d.fecha_denuncia)) > PLAZO_HABILES; });

    document.getElementById('hkTasa').textContent = (personal ? (total / personal * 1000) : 0).toFixed(2);
    document.getElementById('hkTasaSub').textContent = personal ? (personal.toLocaleString('es-PE') + ' trabajadores activos') : 'Sin dato de planilla';
    document.getElementById('hkCerrados').textContent = (total ? Math.round(cerrados.length * 100 / total) : 0) + ' %';
    document.getElementById('hkCerradosSub').textContent = cerrados.length + ' de ' + total + ' casos';
    document.getElementById('hkDias').textContent = abiertos.length ? promD : '—';
    document.getElementById('hkDiasSub').textContent = abiertos.length ? (abiertos.length + ' caso(s) abierto(s)') : 'Todo cerrado ✔';
    document.getElementById('hkMedida').textContent = (total ? Math.round(conMedida.length * 100 / total) : 0) + ' %';
    document.getElementById('hkMedidaSub').textContent = conMedida.length + ' con medida dictada';
    document.getElementById('hkPlazo').textContent = fuera.length;
    document.getElementById('bsdhUpd').innerHTML = 'Última actualización<br>' + new Date().toLocaleString('es-PE');

    var al = document.getElementById('bsdhAlerta');
    if (fuera.length) {
      al.style.display = 'block';
      al.innerHTML = '⚠️ ' + fuera.length + ' caso(s) abierto(s) superan los ' + PLAZO_HABILES +
        ' días hábiles del procedimiento de investigación y sanción (DS 014-2019-TR): ' +
        fuera.map(function (d) { return (d.codigo || ('#' + d.id)) + ' (' + sede(d) + ')'; }).join(' · ');
    } else { al.style.display = 'none'; }

    /* ---- Scorecard comparativo ---- */
    var mP = metricas(porSede.PIURA), mO = metricas(porSede.OLMOS), mT = metricas(items);
    var filas = [
      ['Denuncias registradas', mP.n, mO.n, mT.n],
      ['Casos abiertos', mP.abiertos, mO.abiertos, mT.abiertos],
      ['% de casos cerrados', mP.cerr, mO.cerr, mT.cerr],
      ['Días promedio de casos abiertos', mP.dias, mO.dias, mT.dias],
      ['Casos fuera del plazo legal', mP.fuera, mO.fuera, mT.fuera],
      ['% con medida de protección', mP.medida, mO.medida, mT.medida],
      ['% que terminó en desvinculación', mP.desv, mO.desv, mT.desv]
    ];
    document.getElementById('hScorecard').innerHTML =
      '<table class="bsdh-sc"><thead><tr><th>Indicador</th>' +
      '<th><span class="dot" style="background:' + C_PIURA + '"></span>Piura</th>' +
      '<th><span class="dot" style="background:' + C_OLMOS + '"></span>Olmos</th>' +
      '<th>Total</th></tr></thead><tbody>' +
      filas.map(function (f) {
        return '<tr><td>' + esc(f[0]) + '</td><td>' + esc(f[1]) + '</td><td>' + esc(f[2]) + '</td><td>' + esc(f[3]) + '</td></tr>';
      }).join('') +
      '</tbody></table>';

    /* ---- Evolución mensual por sede (líneas) ---- */
    var dsM = vis.map(function (s) {
      var serie = MESES.map(function (_, mi) {
        var mm = ('0' + (mi + 1)).slice(-2);
        return items.filter(function (d) { var p = parseF(d.fecha_denuncia); return p && p.mes === mm && sede(d) === s; }).length;
      });
      var pico = Math.max.apply(null, serie);
      return {
        label: s, data: serie, borderColor: C_SEDE[s], backgroundColor: C_SEDE[s],
        borderWidth: 2, tension: .35, fill: false, pointRadius: 4, pointHoverRadius: 7,
        pointBorderColor: SURF, pointBorderWidth: 2, _pico: pico
      };
    });
    charts['hChMes'] = new Chart(ctx('hChMes'), {
      type: 'line', data: { labels: MESES, datasets: dsM },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: leyenda(vis.length > 1),
          datalabels: {
            align: 'top', offset: 6, color: INK2, font: { weight: '700', size: 10 },
            display: function (c2) {
              var v = c2.dataset.data[c2.dataIndex];
              return v > 0 && v === c2.dataset._pico;   // solo el pico de cada sede
            },
            formatter: function (v) { return v; }
          },
          tooltip: { callbacks: { label: function (x) { return '  ' + x.dataset.label + ': ' + x.parsed.y + ' caso(s)'; } } }
        },
        scales: { x: { ticks: { color: INK2, font: { size: 10 } }, grid: { display: false }, border: { color: GRID } }, y: ejeY() }
      }, plugins: DL()
    });

    /* ---- Estado de los casos (dona, colores de estado) ---- */
    var byEst = {}; items.forEach(function (d) { var e = txt(d.status) || '(s/d)'; byEst[e] = (byEst[e] || 0) + 1; });
    var estO = Object.keys(byEst).sort(function (a, b) { return byEst[b] - byEst[a]; });
    doughnut('hChEstado', estO, estO.map(function (k) { return byEst[k]; }), estO.map(colorEstado));

    /* ---- Casos por sede y año ---- */
    var aniosX = F.anio ? [F.anio] : anios;
    var dSA = {}; SEDES.forEach(function (s) {
      dSA[s] = {};
      aniosX.forEach(function (a) {
        dSA[s][a] = base.filter(function (d) { var p = parseF(d.fecha_denuncia); return p && p.anio === a && sede(d) === s; }).length;
      });
    });
    barrasSede('hChSedeAnio', aniosX, dSA);

    /* ---- Distribución por medida o conclusión (dona) ---- */
    var byMed = {}; items.forEach(function (d) { var k = normMedida(d); byMed[k] = (byMed[k] || 0) + 1; });
    var medO = ORDEN_MEDIDA.filter(function (k) { return byMed[k]; });
    doughnut('hChMedida', medO, medO.map(function (k) { return byMed[k]; }), medO.map(colorMedida));

    /* ---- Cargos de los denunciados (barras horizontales apiladas por sede) ---- */
    var byCargo = {}, dCargo = { PIURA: {}, OLMOS: {} };
    items.forEach(function (d) {
      var c = up(d.denunciado_puesto) || '(SIN CARGO)';
      byCargo[c] = (byCargo[c] || 0) + 1;
      dCargo[sede(d)][c] = (dCargo[sede(d)][c] || 0) + 1;
    });
    var cargoO = Object.keys(byCargo).sort(function (a, b) { return byCargo[a] - byCargo[b]; }).slice(-10);
    barrasSede('hChCargo', cargoO, dCargo, { horizontal: true, apilado: true });

    /* ---- Casos por empresa del denunciado ---- */
    var dEmp = { PIURA: {}, OLMOS: {} }, empSet = {};
    items.forEach(function (d) { var e = emp(d.empresa); empSet[e] = true; dEmp[sede(d)][e] = (dEmp[sede(d)][e] || 0) + 1; });
    var empO = EMPRESAS.filter(function (e) { return empSet[e]; }).concat(empSet.OTRO ? ['OTRO'] : []);
    barrasSede('hChEmpresa', empO.length ? empO : EMPRESAS, dEmp);

    /* ---- NUEVO: medida o conclusión por sede (apiladas) ---- */
    var dMedSede = { PIURA: {}, OLMOS: {} };
    items.forEach(function (d) { var k = normMedida(d); dMedSede[sede(d)][k] = (dMedSede[sede(d)][k] || 0) + 1; });
    barrasSede('hChMedidaSede', medO, dMedSede, { horizontal: true, apilado: true });

    /* ---- NUEVO: antigüedad de casos abiertos por sede ---- */
    var tramos = ['0–15 días', '16–30 días', '31–60 días', 'Más de 60 días'];
    var dEdad = { PIURA: {}, OLMOS: {} };
    abiertos.forEach(function (d) {
      var n = diasCal(parseF(d.fecha_denuncia));
      var k = n <= 15 ? tramos[0] : n <= 30 ? tramos[1] : n <= 60 ? tramos[2] : tramos[3];
      dEdad[sede(d)][k] = (dEdad[sede(d)][k] || 0) + 1;
    });
    if (!abiertos.length) { vacio('hChEdad', true); }
    else { vacio('hChEdad', false); barrasSede('hChEdad', tramos, dEdad, { apilado: true }); }
  }

  /* ---------- sidebar ---------- */
  function opt(label, on, fn, color) {
    var b = document.createElement('button');
    b.className = 'bsdh-opt' + (on ? ' on' : '');
    if (color) {
      var d = document.createElement('span');
      d.className = 'bsdh-dot'; d.style.background = color;
      b.appendChild(d);
    }
    b.appendChild(document.createTextNode(label));
    b.onclick = fn;
    return b;
  }
  function sidebar() {
    var s = document.getElementById('bsdhSede'); s.innerHTML = '';
    s.appendChild(opt('Piura + Olmos', F.sede === '', function () { F.sede = ''; sidebar(); render(); }));
    SEDES.forEach(function (v) { s.appendChild(opt(v, F.sede === v, function () { F.sede = v; sidebar(); render(); }, C_SEDE[v])); });

    var e = document.getElementById('bsdhEmp'); e.innerHTML = '';
    [''].concat(EMPRESAS).forEach(function (v) { e.appendChild(opt(v || 'Todas', F.empresa === v, function () { F.empresa = v; sidebar(); render(); }, v ? C_EMPRESA[v] : null)); });

    var a = document.getElementById('bsdhAnio'); a.innerHTML = '';
    [''].concat(aniosUnicos()).forEach(function (v) { a.appendChild(opt(v || 'Todos', F.anio === v, function () { F.anio = v; sidebar(); render(); })); });

    var m = document.getElementById('bsdhMes'); m.innerHTML = '';
    m.appendChild(opt('Todos los meses', Object.keys(F.meses).length === 0, function () { F.meses = {}; sidebar(); render(); }));
    MESES.forEach(function (nm, i) {
      var mm = ('0' + (i + 1)).slice(-2);
      m.appendChild(opt(nm, !!F.meses[mm], function () { if (F.meses[mm]) delete F.meses[mm]; else F.meses[mm] = true; sidebar(); render(); }));
    });
  }

  /* ---------- carga ---------- */
  function cargar() {
    var load = document.getElementById('bsdhLoad');
    if (load) { load.style.display = 'flex'; load.textContent = 'Cargando datos…'; }
    Promise.all([
      api('bs_listarHostigamiento', {}).catch(function () { return { ok: false }; }),
      api('bs_clasificacion', {}).catch(function () { return { ok: false }; })
    ]).then(function (res) {
      var rH = res[0], rC = res[1];
      DATA.casos = (rH && rH.ok && rH.items) ? rH.items : [];
      if (rC && rC.ok) {
        DATA.personal.total = rC.total || 0;
        function sumEmp(o) { if (!o) return 0; return (o.prueba || 0) + (o.plazoFijo || 0) + (o.indeterminado || 0); }
        DATA.personal.RAPEL = rC.porEmpresa ? sumEmp(rC.porEmpresa.RAPEL) : 0;
        DATA.personal.VERFRUT = rC.porEmpresa ? sumEmp(rC.porEmpresa.VERFRUT) : 0;
      }
      if (load) load.style.display = 'none';
      sidebar();
      render();
    });
  }

  /* =======================================================================
   * VISTA COMPARATIVA · mitad Piura / mitad Olmos
   * ===================================================================== */
  var cmpMontado = false;
  var chartsC = {};
  var CF = { anio: '', empresa: '' };

  function destroyC() { Object.keys(chartsC).forEach(function (k) { if (chartsC[k]) { chartsC[k].destroy(); chartsC[k] = null; } }); }

  function itemsSede(s) {
    return vivos().filter(function (d) {
      if (sede(d) !== s) return false;
      if (CF.empresa && emp(d.empresa) !== CF.empresa) return false;
      var p = parseF(d.fecha_denuncia); if (!p) return false;
      if (CF.anio && p.anio !== CF.anio) return false;
      return true;
    });
  }

  function estilosCmp() {
    if (document.getElementById('bsdh-cmp-css')) return;
    var st = document.createElement('style');
    st.id = 'bsdh-cmp-css';
    st.textContent =
      '.cmp-ov{position:fixed;inset:0;z-index:10000;background:#0b1220;display:none;flex-direction:column;font-family:Inter,system-ui,sans-serif;overflow:hidden;}' +
      '.cmp-ov.on{display:flex;}' +
      '.cmp-bar{display:flex;justify-content:space-between;align-items:center;background:#0b1220;border-bottom:1px solid #1e293b;padding:11px 20px;gap:12px;flex-wrap:wrap;}' +
      '.cmp-bar .ti{display:flex;align-items:center;gap:12px;}' +
      '.cmp-bar .logo{width:40px;height:40px;border-radius:9px;background:#E2001A;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;}' +
      '.cmp-bar h1{margin:0;font-size:.98rem;color:#fff;font-weight:800;letter-spacing:.02em;}' +
      '.cmp-bar p{margin:2px 0 0;font-size:.66rem;color:#94a3b8;font-weight:700;letter-spacing:.06em;}' +
      '.cmp-btn{border:1px solid #334155;background:#111c33;color:#e2e8f0;height:34px;padding:0 13px;border-radius:8px;font:700 12px Inter;cursor:pointer;}' +
      '.cmp-btn:hover{border-color:#64748b;}' +
      '.cmp-btn.cta{background:#E2001A;border-color:#E2001A;color:#fff;}' +
      '.cmp-tools{display:flex;gap:18px;align-items:center;padding:9px 20px;background:#111c33;border-bottom:1px solid #1e293b;flex-wrap:wrap;}' +
      '.cmp-tools .grp{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}' +
      '.cmp-tools .lb{font-size:.58rem;letter-spacing:.1em;text-transform:uppercase;color:#64748b;font-weight:800;margin-right:2px;}' +
      '.cmp-chip{border:1px solid #334155;background:transparent;color:#cbd5e1;height:27px;padding:0 11px;border-radius:999px;font:700 11.5px Inter;cursor:pointer;}' +
      '.cmp-chip.on{background:#fff;color:#0b1220;border-color:#fff;}' +
      '.cmp-scroll{flex:1;overflow-y:auto;padding:16px 20px 30px;background:#0b1220;}' +

      '.cmp-marc{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:18px;background:#111c33;border:1px solid #1e293b;border-radius:14px;padding:16px 22px;margin-bottom:16px;}' +
      '.cmp-marc .lado{display:flex;align-items:center;gap:14px;}' +
      '.cmp-marc .lado.der{justify-content:flex-end;text-align:right;flex-direction:row-reverse;}' +
      '.cmp-marc .n{font-size:2.6rem;font-weight:800;line-height:1;font-variant-numeric:tabular-nums;}' +
      '.cmp-marc .nm{font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;color:#94a3b8;font-weight:800;}' +
      '.cmp-marc .sb{font-size:.64rem;color:#64748b;font-weight:700;margin-top:3px;}' +
      '.cmp-vs{font-size:.68rem;letter-spacing:.16em;color:#475569;font-weight:800;}' +
      '.cmp-prop{grid-column:1/-1;height:10px;border-radius:999px;overflow:hidden;display:flex;background:#1e293b;margin-top:4px;}' +
      '.cmp-prop i{display:block;height:100%;}' +

      '.cmp-split{display:grid;grid-template-columns:1fr 1fr;gap:0;background:#111c33;border:1px solid #1e293b;border-radius:14px;overflow:hidden;}' +
      '.cmp-lado{padding:14px 16px 18px;}' +
      '.cmp-lado + .cmp-lado{border-left:2px solid #0b1220;}' +
      '.cmp-cab{display:flex;align-items:center;gap:9px;padding:8px 12px;border-radius:9px;margin-bottom:12px;}' +
      '.cmp-cab .pt{width:11px;height:11px;border-radius:50%;}' +
      '.cmp-cab h2{margin:0;font-size:.86rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#fff;}' +
      '.cmp-cab .tot{margin-left:auto;font-size:.72rem;color:#cbd5e1;font-weight:700;}' +
      '.cmp-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px;}' +
      '.cmp-k{background:#0b1220;border:1px solid #1e293b;border-radius:10px;padding:9px 11px;}' +
      '.cmp-k .v{font-size:1.12rem;font-weight:800;color:#fff;line-height:1.1;font-variant-numeric:tabular-nums;}' +
      '.cmp-k .l{font-size:.54rem;letter-spacing:.05em;text-transform:uppercase;color:#64748b;font-weight:800;margin-top:3px;line-height:1.3;}' +
      '.cmp-card{background:#0b1220;border:1px solid #1e293b;border-radius:11px;margin-bottom:10px;overflow:hidden;}' +
      '.cmp-card .h{font-size:.6rem;letter-spacing:.07em;text-transform:uppercase;color:#94a3b8;font-weight:800;padding:8px 12px;border-bottom:1px solid #1e293b;}' +
      '.cmp-card .b{padding:9px;height:196px;position:relative;}' +
      '.cmp-vacio{position:absolute;inset:9px;display:flex;align-items:center;justify-content:center;color:#475569;font-size:.7rem;font-weight:700;text-align:center;}' +

      '.cmp-full{background:#111c33;border:1px solid #1e293b;border-radius:14px;margin-top:16px;overflow:hidden;}' +
      '.cmp-full .h{font-size:.62rem;letter-spacing:.09em;text-transform:uppercase;color:#94a3b8;font-weight:800;padding:10px 16px;border-bottom:1px solid #1e293b;}' +
      '.cmp-full .b{padding:12px 16px;height:250px;position:relative;}' +
      '.cmp-full .b.tabla{height:auto;padding:0;}' +
      '.cmp-t{width:100%;border-collapse:collapse;font-size:.75rem;}' +
      '.cmp-t th{font-size:.58rem;letter-spacing:.08em;text-transform:uppercase;color:#64748b;font-weight:800;padding:10px 16px;text-align:right;border-bottom:1px solid #1e293b;}' +
      '.cmp-t th:first-child{text-align:left;}' +
      '.cmp-t td{padding:10px 16px;text-align:right;color:#e2e8f0;font-weight:700;border-bottom:1px solid #16233d;font-variant-numeric:tabular-nums;}' +
      '.cmp-t td:first-child{text-align:left;color:#94a3b8;font-weight:600;}' +
      '.cmp-t tr:last-child td{border-bottom:none;}' +
      '.cmp-d{display:inline-block;min-width:52px;padding:2px 8px;border-radius:999px;font-size:.68rem;font-weight:800;}' +
      '@media(max-width:900px){.cmp-split{grid-template-columns:1fr;}.cmp-lado + .cmp-lado{border-left:none;border-top:2px solid #0b1220;}.cmp-kpis{grid-template-columns:repeat(2,1fr);}}';
    document.head.appendChild(st);
  }

  function ladoHTML(s) {
    var c = C_SEDE[s];
    return '<section class="cmp-lado">' +
      '<div class="cmp-cab" style="background:' + c + '22;border:1px solid ' + c + '55;">' +
        '<span class="pt" style="background:' + c + '"></span><h2>' + s + '</h2>' +
        '<span class="tot" id="cmpTot' + s + '">—</span>' +
      '</div>' +
      '<div class="cmp-kpis" id="cmpKpis' + s + '"></div>' +
      '<div class="cmp-card"><div class="h">Estado de los casos</div><div class="b"><canvas id="cmpEstado' + s + '"></canvas><div class="cmp-vacio" id="cmpEstado' + s + 'Vacio" style="display:none;">Sin casos en el periodo</div></div></div>' +
      '<div class="cmp-card"><div class="h">Distribución por medida o conclusión</div><div class="b"><canvas id="cmpMedida' + s + '"></canvas><div class="cmp-vacio" id="cmpMedida' + s + 'Vacio" style="display:none;">Sin casos en el periodo</div></div></div>' +
      '<div class="cmp-card"><div class="h">Cargos de los denunciados</div><div class="b"><canvas id="cmpCargo' + s + '"></canvas><div class="cmp-vacio" id="cmpCargo' + s + 'Vacio" style="display:none;">Sin casos en el periodo</div></div></div>' +
      '<div class="cmp-card"><div class="h">Casos por empresa del denunciado</div><div class="b"><canvas id="cmpEmpresa' + s + '"></canvas><div class="cmp-vacio" id="cmpEmpresa' + s + 'Vacio" style="display:none;">Sin casos en el periodo</div></div></div>' +
      '</section>';
  }

  function montarCmp() {
    if (cmpMontado) return;
    estilosCmp();
    var ov = document.createElement('div');
    ov.className = 'cmp-ov';
    ov.id = 'bsdhCmpOverlay';
    ov.innerHTML =
      '<div class="cmp-bar">' +
        '<div class="ti"><div class="logo">U</div><div>' +
          '<h1>COMPARATIVO DE SEDES · HOSTIGAMIENTO SEXUAL</h1>' +
          '<p>BIENESTAR SOCIAL · UNIFRUTTI GROUP · PIURA vs OLMOS</p>' +
        '</div></div>' +
        '<div style="display:flex;align-items:center;gap:9px;">' +
          '<span id="cmpPeriodo" style="font-size:.64rem;color:#64748b;font-weight:700;"></span>' +
          '<button class="cmp-btn cta" onclick="BSDashHostigamiento.exportarPDF()">📄 Exportar PDF</button>' +
          '<button class="cmp-btn" onclick="BSDashHostigamiento.cerrarComparativo()">✕ Cerrar</button>' +
        '</div>' +
      '</div>' +
      '<div class="cmp-tools">' +
        '<div class="grp"><span class="lb">Año</span><span id="cmpAnios"></span></div>' +
        '<div class="grp"><span class="lb">Empresa</span><span id="cmpEmpresas"></span></div>' +
      '</div>' +
      '<div class="cmp-scroll">' +
        '<div class="cmp-marc">' +
          '<div class="lado">' +
            '<div class="n" id="cmpNPIURA" style="color:' + C_PIURA + '">0</div>' +
            '<div><div class="nm">Sede Piura</div><div class="sb" id="cmpSbPIURA"></div></div>' +
          '</div>' +
          '<div class="cmp-vs">VS</div>' +
          '<div class="lado der">' +
            '<div class="n" id="cmpNOLMOS" style="color:' + C_OLMOS + '">0</div>' +
            '<div><div class="nm">Sede Olmos</div><div class="sb" id="cmpSbOLMOS"></div></div>' +
          '</div>' +
          '<div class="cmp-prop"><i id="cmpPropP" style="background:' + C_PIURA + '"></i><i id="cmpPropO" style="background:' + C_OLMOS + '"></i></div>' +
        '</div>' +
        '<div class="cmp-split">' + ladoHTML('PIURA') + ladoHTML('OLMOS') + '</div>' +
        '<div class="cmp-full"><div class="h">Evolución mensual de denuncias · Piura vs Olmos</div><div class="b"><canvas id="cmpMes"></canvas></div></div>' +
        '<div class="cmp-full"><div class="h">Indicadores de gestión · diferencia entre sedes</div><div class="b tabla" id="cmpTabla"></div></div>' +
        '<div style="color:#475569;font-size:.62rem;font-weight:700;margin-top:14px;text-align:center;">' +
          '🔐 Información confidencial · Ley N° 29733 y Ley N° 27942 · Nombres enmascarados' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);
    cmpMontado = true;
  }

  /* ---- charts de la vista comparativa (fondo oscuro) ---- */
  var INKD = '#e2e8f0', INKD2 = '#94a3b8', GRIDD = '#1e293b', SURFD = '#0b1220';

  function donaCmp(id, labels, data, colors) {
    var c = ctx(id); if (!c) return;
    var tot = data.reduce(function (a, b) { return a + b; }, 0);
    chartsC[id] = new Chart(c, {
      type: 'doughnut',
      data: { labels: labels, datasets: [{ data: data, backgroundColor: colors, borderWidth: 2, borderColor: SURFD, hoverOffset: 6 }] },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '58%',
        plugins: {
          legend: { position: 'bottom', labels: { color: INKD2, font: { size: 9, weight: '600' }, boxWidth: 9, boxHeight: 9, usePointStyle: true, pointStyle: 'circle', padding: 10 } },
          datalabels: {
            color: '#fff', font: { weight: '800', size: 10 },
            formatter: function (v) { if (!v) return ''; var p = tot ? Math.round(v * 100 / tot) : 0; return p < 8 ? '' : v + '\n' + p + '%'; }
          },
          tooltip: { callbacks: { label: function (x) { var p = tot ? Math.round(x.parsed * 100 / tot) : 0; return '  ' + x.label + ': ' + x.parsed + ' (' + p + '%)'; } } }
        }
      }, plugins: DL()
    });
  }

  function barrasCmp(id, labels, data, color, maxComun, horizontal) {
    var c = ctx(id); if (!c) return;
    var colores = Array.isArray(color) ? color : labels.map(function () { return color; });
    chartsC[id] = new Chart(c, {
      type: 'bar',
      data: { labels: labels, datasets: [{ data: data, backgroundColor: colores, borderRadius: 4, borderSkipped: false, maxBarThickness: 22 }] },
      options: {
        indexAxis: horizontal ? 'y' : 'x',
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          datalabels: {
            anchor: 'end', align: horizontal ? 'right' : 'top', offset: 2,
            color: INKD, font: { weight: '700', size: 10 },
            display: function (c2) { return c2.dataset.data[c2.dataIndex] > 0; },
            formatter: function (v) { return v; }
          },
          tooltip: { callbacks: { label: function (x) { return '  ' + (horizontal ? x.parsed.x : x.parsed.y) + ' caso(s)'; } } }
        },
        scales: horizontal
          ? { x: { beginAtZero: true, suggestedMax: maxComun, ticks: { color: INKD2, font: { size: 9 }, precision: 0 }, grid: { color: GRIDD, drawTicks: false }, border: { display: false } },
              y: { ticks: { color: INKD2, font: { size: 9 } }, grid: { display: false }, border: { display: false } } }
          : { x: { ticks: { color: INKD2, font: { size: 9 } }, grid: { display: false }, border: { color: GRIDD } },
              y: { beginAtZero: true, suggestedMax: maxComun, ticks: { color: INKD2, font: { size: 9 }, precision: 0 }, grid: { color: GRIDD, drawTicks: false }, border: { display: false } } }
      }, plugins: DL()
    });
  }

  function chipsCmp() {
    var a = document.getElementById('cmpAnios'); a.innerHTML = '';
    [''].concat(aniosUnicos()).forEach(function (v) {
      var b = document.createElement('button');
      b.className = 'cmp-chip' + (CF.anio === v ? ' on' : '');
      b.textContent = v || 'Todos';
      b.onclick = function () { CF.anio = v; chipsCmp(); renderCmp(); };
      a.appendChild(b);
    });
    var e = document.getElementById('cmpEmpresas'); e.innerHTML = '';
    [''].concat(EMPRESAS).forEach(function (v) {
      var b = document.createElement('button');
      b.className = 'cmp-chip' + (CF.empresa === v ? ' on' : '');
      b.textContent = v || 'Todas';
      b.onclick = function () { CF.empresa = v; chipsCmp(); renderCmp(); };
      e.appendChild(b);
    });
  }

  function renderCmp() {
    if (!window.Chart) return;
    destroyC();

    var it = { PIURA: itemsSede('PIURA'), OLMOS: itemsSede('OLMOS') };
    var m = { PIURA: metricas(it.PIURA), OLMOS: metricas(it.OLMOS) };
    var totalGen = it.PIURA.length + it.OLMOS.length;

    document.getElementById('cmpPeriodo').textContent =
      (CF.anio ? 'Año ' + CF.anio : 'Serie histórica') + (CF.empresa ? ' · ' + CF.empresa : '') +
      ' · generado ' + new Date().toLocaleDateString('es-PE');

    /* ---- marcador ---- */
    SEDES.forEach(function (s) {
      document.getElementById('cmpN' + s).textContent = it[s].length;
      document.getElementById('cmpSb' + s).textContent =
        totalGen ? (Math.round(it[s].length * 100 / totalGen) + '% del total · ' + m[s].abiertos + ' abierto(s)') : 'Sin casos';
      document.getElementById('cmpTot' + s).textContent = it[s].length + ' denuncia(s)';
    });
    var pP = totalGen ? (it.PIURA.length * 100 / totalGen) : 50;
    document.getElementById('cmpPropP').style.width = pP + '%';
    document.getElementById('cmpPropO').style.width = (100 - pP) + '%';

    /* ---- escalas comunes para que las mitades sean comparables ---- */
    function cuentaPor(arr, fn) { var o = {}; arr.forEach(function (d) { var k = fn(d); o[k] = (o[k] || 0) + 1; }); return o; }
    var cargo = {}, empC = {}, maxCargo = 0, maxEmp = 0;
    SEDES.forEach(function (s) {
      cargo[s] = cuentaPor(it[s], function (d) { return up(d.denunciado_puesto) || '(SIN CARGO)'; });
      empC[s] = cuentaPor(it[s], function (d) { return emp(d.empresa); });
      Object.keys(cargo[s]).forEach(function (k) { maxCargo = Math.max(maxCargo, cargo[s][k]); });
      Object.keys(empC[s]).forEach(function (k) { maxEmp = Math.max(maxEmp, empC[s][k]); });
    });

    SEDES.forEach(function (s) {
      var arr = it[s], hay = arr.length > 0;

      /* KPIs del lado */
      document.getElementById('cmpKpis' + s).innerHTML =
        '<div class="cmp-k"><div class="v">' + m[s].cerr + '</div><div class="l">Casos cerrados</div></div>' +
        '<div class="cmp-k"><div class="v">' + m[s].dias + '</div><div class="l">Días prom. abiertos</div></div>' +
        '<div class="cmp-k"><div class="v">' + m[s].medida + '</div><div class="l">Con medida protec.</div></div>' +
        '<div class="cmp-k"><div class="v" style="color:' + (m[s].fuera ? '#f87171' : '#4ade80') + '">' + m[s].fuera + '</div><div class="l">Fuera de plazo</div></div>';

      /* estado */
      var est = cuentaPor(arr, function (d) { return txt(d.status) || '(s/d)'; });
      var estO = Object.keys(est).sort(function (a, b) { return est[b] - est[a]; });
      vacioC('cmpEstado' + s, !hay);
      if (hay) donaCmp('cmpEstado' + s, estO, estO.map(function (k) { return est[k]; }), estO.map(colorEstado));

      /* medida o conclusión */
      var med = cuentaPor(arr, normMedida);
      var medO = ORDEN_MEDIDA.filter(function (k) { return med[k]; });
      vacioC('cmpMedida' + s, !hay);
      if (hay) donaCmp('cmpMedida' + s, medO, medO.map(function (k) { return med[k]; }), medO.map(colorMedida));

      /* cargos (escala común) */
      var cgO = Object.keys(cargo[s]).sort(function (a, b) { return cargo[s][a] - cargo[s][b]; }).slice(-8);
      vacioC('cmpCargo' + s, !hay);
      if (hay) barrasCmp('cmpCargo' + s, cgO, cgO.map(function (k) { return cargo[s][k]; }), C_SEDE[s], maxCargo, true);

      /* empresa (escala común) */
      var emO = EMPRESAS.filter(function (e) { return empC[s][e]; });
      if (empC[s].OTRO) emO = emO.concat(['OTRO']);
      vacioC('cmpEmpresa' + s, !hay);
      if (hay) barrasCmp('cmpEmpresa' + s, emO, emO.map(function (k) { return empC[s][k]; }),
                         emO.map(function (e) { return C_EMPRESA[e] || C_EMPRESA.OTRO; }), maxEmp, false);
    });

    /* ---- evolución mensual comparada ---- */
    chartsC['cmpMes'] = new Chart(ctx('cmpMes'), {
      type: 'line',
      data: {
        labels: MESES,
        datasets: SEDES.map(function (s) {
          var serie = MESES.map(function (_, mi) {
            var mm = ('0' + (mi + 1)).slice(-2);
            return it[s].filter(function (d) { var p = parseF(d.fecha_denuncia); return p && p.mes === mm; }).length;
          });
          return {
            label: s, data: serie, borderColor: C_SEDE[s], backgroundColor: C_SEDE[s] + '22',
            borderWidth: 2, tension: .35, fill: true, pointRadius: 4, pointHoverRadius: 8,
            pointBorderColor: SURFD, pointBorderWidth: 2, _pico: Math.max.apply(null, serie)
          };
        })
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'bottom', labels: { color: INKD2, font: { size: 10, weight: '600' }, boxWidth: 10, usePointStyle: true, pointStyle: 'circle', padding: 14 } },
          datalabels: {
            align: 'top', offset: 6, color: INKD, font: { weight: '700', size: 10 },
            display: function (c2) { var v = c2.dataset.data[c2.dataIndex]; return v > 0 && v === c2.dataset._pico; },
            formatter: function (v) { return v; }
          },
          tooltip: { callbacks: { label: function (x) { return '  ' + x.dataset.label + ': ' + x.parsed.y + ' caso(s)'; } } }
        },
        scales: {
          x: { ticks: { color: INKD2, font: { size: 10 } }, grid: { display: false }, border: { color: GRIDD } },
          y: { beginAtZero: true, ticks: { color: INKD2, font: { size: 10 }, precision: 0 }, grid: { color: GRIDD, drawTicks: false }, border: { display: false } }
        }
      }, plugins: DL()
    });

    /* ---- tabla de diferencias ---- */
    function delta(p, o, inverso, sufijo) {
      var d = o - p;
      var color = d === 0 ? '#475569' : ((inverso ? d < 0 : d > 0) ? '#4ade80' : '#f87171');
      var fondo = d === 0 ? '#16233d' : ((inverso ? d < 0 : d > 0) ? '#052e1a' : '#3b0d0d');
      var signo = d > 0 ? '+' : '';
      return '<span class="cmp-d" style="color:' + color + ';background:' + fondo + '">' + signo + d + (sufijo || '') + '</span>';
    }
    var filas = [
      ['Denuncias registradas', m.PIURA.n, m.OLMOS.n, delta(m.PIURA.n, m.OLMOS.n, true)],
      ['Casos abiertos', m.PIURA.abiertos, m.OLMOS.abiertos, delta(m.PIURA.abiertos, m.OLMOS.abiertos, true)],
      ['% de casos cerrados', m.PIURA.cerr, m.OLMOS.cerr, delta(m.PIURA.cerrNum, m.OLMOS.cerrNum, false, ' pts')],
      ['Días promedio de casos abiertos', m.PIURA.dias, m.OLMOS.dias, delta(m.PIURA.diasNum, m.OLMOS.diasNum, true)],
      ['Casos fuera del plazo legal', m.PIURA.fuera, m.OLMOS.fuera, delta(m.PIURA.fuera, m.OLMOS.fuera, true)],
      ['% con medida de protección', m.PIURA.medida, m.OLMOS.medida, delta(m.PIURA.medidaNum, m.OLMOS.medidaNum, false, ' pts')],
      ['% que terminó en desvinculación', m.PIURA.desv, m.OLMOS.desv, delta(m.PIURA.desvNum, m.OLMOS.desvNum, false, ' pts')]
    ];
    document.getElementById('cmpTabla').innerHTML =
      '<table class="cmp-t"><thead><tr><th>Indicador</th><th style="color:' + C_PIURA + '">Piura</th>' +
      '<th style="color:' + C_OLMOS + '">Olmos</th><th>Olmos vs Piura</th></tr></thead><tbody>' +
      filas.map(function (f) {
        return '<tr><td>' + esc(f[0]) + '</td><td>' + esc(f[1]) + '</td><td>' + esc(f[2]) + '</td><td>' + f[3] + '</td></tr>';
      }).join('') + '</tbody></table>';
  }
  function vacioC(id, mostrar) { var el = document.getElementById(id + 'Vacio'); if (el) el.style.display = mostrar ? 'flex' : 'none'; }

  /* =======================================================================
   * EXPORTAR A PDF · formato presentación (horizontal)
   * ===================================================================== */
  function ensureJsPDF(cb) {
    if (window.jspdf && window.jspdf.jsPDF) return cb();
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
    s.onload = function () { cb(); };
    s.onerror = function () { alert('No se pudo cargar el generador de PDF. Verifica tu conexión.'); };
    document.head.appendChild(s);
  }
  /* Canvas de Chart.js -> PNG con fondo sólido (el PDF no admite transparencia bonita) */
  function canvasPNG(id, fondo) {
    var el = document.getElementById(id);
    if (!el || !el.width) return null;
    var off = document.createElement('canvas');
    off.width = el.width; off.height = el.height;
    var c = off.getContext('2d');
    c.fillStyle = fondo || '#ffffff';
    c.fillRect(0, 0, off.width, off.height);
    c.drawImage(el, 0, 0);
    return { url: off.toDataURL('image/png'), w: off.width, h: off.height };
  }

  function exportarPDF() {
    if (!cmpMontado || !document.getElementById('bsdhCmpOverlay').classList.contains('on')) {
      return alert('Abre primero el comparativo Piura vs Olmos.');
    }
    ensureJsPDF(function () {
      var jsPDF = window.jspdf.jsPDF;
      var doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      var W = 297, H = 210, M = 16;
      var it = { PIURA: itemsSede('PIURA'), OLMOS: itemsSede('OLMOS') };
      var m = { PIURA: metricas(it.PIURA), OLMOS: metricas(it.OLMOS) };
      var totalGen = it.PIURA.length + it.OLMOS.length;
      var periodo = (CF.anio ? 'Año ' + CF.anio : 'Serie histórica completa') + (CF.empresa ? ' · ' + CF.empresa : ' · Todas las empresas');
      var pagina = 0;

      function rgb(hex) {
        return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
      }
      function fill(hex) { var c = rgb(hex); doc.setFillColor(c[0], c[1], c[2]); }
      function ink(hex) { var c = rgb(hex); doc.setTextColor(c[0], c[1], c[2]); }

      function slide(titulo) {
        if (pagina > 0) doc.addPage();
        pagina++;
        fill('#0b1220'); doc.rect(0, 0, W, 15, 'F');
        fill('#E2001A'); doc.rect(0, 0, 4, 15, 'F');
        ink('#ffffff'); doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
        doc.text(String(titulo).toUpperCase(), M, 9.5);
        ink('#94a3b8'); doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
        doc.text('BIENESTAR SOCIAL · UNIFRUTTI GROUP', W - M, 9.5, { align: 'right' });
        // pie
        ink('#94a3b8'); doc.setFontSize(6.5);
        doc.text('Información confidencial · Ley N° 29733 y Ley N° 27942 · Nombres enmascarados', M, H - 6);
        doc.text(String(pagina), W - M, H - 6, { align: 'right' });
      }

      /* ---- 1. portada ---- */
      pagina = 1;
      fill('#0b1220'); doc.rect(0, 0, W, H, 'F');
      fill('#E2001A'); doc.rect(0, 0, W, 6, 'F');
      ink('#ffffff'); doc.setFont('helvetica', 'bold'); doc.setFontSize(30);
      doc.text('COMPARATIVO DE SEDES', M, 74);
      ink('#E2001A'); doc.setFontSize(30);
      doc.text('PIURA  vs  OLMOS', M, 90);
      ink('#94a3b8'); doc.setFont('helvetica', 'normal'); doc.setFontSize(12);
      doc.text('Indicador de Hostigamiento Sexual · Ley N° 27942', M, 104);
      doc.setFontSize(10);
      doc.text(periodo, M, 114);
      doc.text('Generado el ' + new Date().toLocaleString('es-PE'), M, 122);
      // marcador grande
      fill('#111c33'); doc.roundedRect(M, 136, W - M * 2, 42, 3, 3, 'F');
      ink(C_PIURA); doc.setFont('helvetica', 'bold'); doc.setFontSize(34);
      doc.text(String(it.PIURA.length), M + 24, 162, { align: 'center' });
      ink(C_OLMOS);
      doc.text(String(it.OLMOS.length), W - M - 24, 162, { align: 'center' });
      ink('#94a3b8'); doc.setFontSize(9);
      doc.text('PIURA', M + 24, 170, { align: 'center' });
      doc.text('OLMOS', W - M - 24, 170, { align: 'center' });
      ink('#475569'); doc.setFontSize(11);
      doc.text('VS', W / 2, 160, { align: 'center' });
      ink('#e2e8f0'); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      doc.text(totalGen + ' denuncia(s) en total', W / 2, 172, { align: 'center' });
      ink('#94a3b8'); doc.setFontSize(6.5);
      doc.text('Información confidencial · Ley N° 29733 y Ley N° 27942', M, H - 8);

      /* ---- 2. indicadores de gestión ---- */
      slide('Indicadores de gestión por sede');
      var kpis = [
        ['Denuncias registradas', m.PIURA.n, m.OLMOS.n],
        ['Casos abiertos', m.PIURA.abiertos, m.OLMOS.abiertos],
        ['% de casos cerrados', m.PIURA.cerr, m.OLMOS.cerr],
        ['Días promedio de casos abiertos', m.PIURA.dias, m.OLMOS.dias],
        ['Casos fuera del plazo legal (30 días hábiles)', m.PIURA.fuera, m.OLMOS.fuera],
        ['% con medida de protección', m.PIURA.medida, m.OLMOS.medida],
        ['% que terminó en desvinculación', m.PIURA.desv, m.OLMOS.desv]
      ];
      var y = 34;
      fill('#f1f5f9'); doc.rect(M, y - 8, W - M * 2, 10, 'F');
      ink('#475569'); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
      doc.text('INDICADOR', M + 4, y - 1);
      ink(C_PIURA); doc.text('PIURA', W - M - 70, y - 1, { align: 'right' });
      ink(C_OLMOS); doc.text('OLMOS', W - M - 12, y - 1, { align: 'right' });
      y += 6;
      kpis.forEach(function (f, i) {
        if (i % 2 === 0) { fill('#f8fafc'); doc.rect(M, y - 6, W - M * 2, 13, 'F'); }
        ink('#334155'); doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
        doc.text(String(f[0]), M + 4, y + 2);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
        ink(C_PIURA); doc.text(String(f[1]), W - M - 70, y + 2, { align: 'right' });
        ink(C_OLMOS); doc.text(String(f[2]), W - M - 12, y + 2, { align: 'right' });
        y += 13;
      });

      /* ---- 3..n. gráficos, mitad y mitad ---- */
      function slideDoble(titulo, idBase) {
        var iP = canvasPNG(idBase + 'PIURA', '#0b1220');
        var iO = canvasPNG(idBase + 'OLMOS', '#0b1220');
        if (!iP && !iO) return;
        slide(titulo);
        var cw = (W - M * 2 - 8) / 2, chh = 140, top = 30;
        [[iP, M, 'PIURA', C_PIURA], [iO, M + cw + 8, 'OLMOS', C_OLMOS]].forEach(function (par) {
          var img = par[0], x = par[1];
          fill(par[3]); doc.rect(x, top - 8, cw, 7, 'F');
          ink('#ffffff'); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
          doc.text(par[2], x + 3, top - 3);
          if (!img) return;
          fill('#0b1220'); doc.rect(x, top, cw, chh, 'F');
          var esc2 = Math.min(cw / img.w, chh / img.h);
          var w2 = img.w * esc2, h2 = img.h * esc2;
          doc.addImage(img.url, 'PNG', x + (cw - w2) / 2, top + (chh - h2) / 2, w2, h2);
        });
      }
      slideDoble('Estado de los casos', 'cmpEstado');
      slideDoble('Distribución por medida o conclusión', 'cmpMedida');
      slideDoble('Cargos de los denunciados', 'cmpCargo');
      slideDoble('Casos por empresa del denunciado', 'cmpEmpresa');

      /* ---- evolución mensual, a pantalla completa ---- */
      var iM = canvasPNG('cmpMes', '#0b1220');
      if (iM) {
        slide('Evolución mensual de denuncias · Piura vs Olmos');
        var mw = W - M * 2, mh = 150, escM = Math.min(mw / iM.w, mh / iM.h);
        fill('#0b1220'); doc.rect(M, 26, mw, mh, 'F');
        doc.addImage(iM.url, 'PNG', M + (mw - iM.w * escM) / 2, 26 + (mh - iM.h * escM) / 2, iM.w * escM, iM.h * escM);
      }

      /* ---- cierre: lectura del comparativo ---- */
      slide('Lectura del comparativo');
      var notas = [];
      notas.push('Piura concentra ' + (totalGen ? Math.round(it.PIURA.length * 100 / totalGen) : 0) +
                 '% de las denuncias del periodo y Olmos el ' + (totalGen ? 100 - Math.round(it.PIURA.length * 100 / totalGen) : 0) + '%.');
      notas.push('Cierre de casos: Piura ' + m.PIURA.cerr + ' frente a Olmos ' + m.OLMOS.cerr + '.');
      notas.push('Medida de protección dictada: Piura ' + m.PIURA.medida + ' frente a Olmos ' + m.OLMOS.medida + '.');
      if (m.PIURA.fuera || m.OLMOS.fuera) {
        notas.push('Atención: ' + (m.PIURA.fuera + m.OLMOS.fuera) + ' caso(s) superan los 30 días hábiles del DS 014-2019-TR (Piura ' +
                   m.PIURA.fuera + ' · Olmos ' + m.OLMOS.fuera + ').');
      } else {
        notas.push('Ningún caso supera el plazo de 30 días hábiles del DS 014-2019-TR.');
      }
      notas.push('Desvinculación como medida final: Piura ' + m.PIURA.desv + ' frente a Olmos ' + m.OLMOS.desv +
                 '. Una brecha amplia sugiere revisar la uniformidad del criterio sancionador entre sedes.');
      var yy = 40;
      notas.forEach(function (t) {
        fill('#E2001A'); doc.circle(M + 2, yy - 1.4, 1.4, 'F');
        ink('#334155'); doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
        doc.splitTextToSize(t, W - M * 2 - 12).forEach(function (linea, i) {
          doc.text(linea, M + 8, yy + i * 6);
        });
        yy += 6 * doc.splitTextToSize(t, W - M * 2 - 12).length + 8;
      });

      var nombre = 'Comparativo_Piura_Olmos_Hostigamiento_' +
                   (CF.anio || 'historico') + '_' + new Date().toISOString().split('T')[0] + '.pdf';
      doc.save(nombre);
    });
  }

  /* ---------- API pública ---------- */
  function comparativo() {
    montarCmp();
    document.getElementById('bsdhCmpOverlay').classList.add('on');
    document.body.style.overflow = 'hidden';
    ensureLibs(function () {
      if (DATA.casos.length) { chipsCmp(); renderCmp(); return; }
      api('bs_listarHostigamiento', {}).then(function (r) {
        DATA.casos = (r && r.ok && r.items) ? r.items : [];
        chipsCmp(); renderCmp();
      }).catch(function () { chipsCmp(); renderCmp(); });
    });
  }
  function cerrarComparativo() {
    var ov = document.getElementById('bsdhCmpOverlay');
    if (ov) ov.classList.remove('on');
    document.body.style.overflow = '';
    destroyC();
  }

  function abrir() {
    montar();
    document.getElementById('bsdhOverlay').classList.add('on');
    document.body.style.overflow = 'hidden';
    ensureLibs(function () { cargar(); });
  }
  function cerrar() {
    var ov = document.getElementById('bsdhOverlay');
    if (ov) ov.classList.remove('on');
    document.body.style.overflow = '';
    destroy();
  }
  function imprimir() { window.print(); }

  return {
    abrir: abrir, cerrar: cerrar, imprimir: imprimir,
    comparativo: comparativo, cerrarComparativo: cerrarComparativo, exportarPDF: exportarPDF
  };
})();
