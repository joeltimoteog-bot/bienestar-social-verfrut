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
  function emp(v) { var s = up(v); return s.indexOf('VERFRUT') >= 0 ? 'VERFRUT' : (s.indexOf('RAPEL') >= 0 ? 'RAPEL' : 'OTRO'); }
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
    function met(arr) {
      var n = arr.length;
      var cer = arr.filter(function (d) { return esCerrado(d.status); }).length;
      var ab = arr.filter(function (d) { return !esCerrado(d.status); });
      var med = arr.filter(tieneMedida).length;
      var sd = 0; ab.forEach(function (d) { sd += diasCal(parseF(d.fecha_denuncia)); });
      return {
        n: n,
        cerr: n ? Math.round(cer * 100 / n) + ' %' : '—',
        abiertos: ab.length,
        dias: ab.length ? Math.round(sd / ab.length) : '—',
        medida: n ? Math.round(med * 100 / n) + ' %' : '—',
        fuera: ab.filter(function (d) { return diasHab(parseF(d.fecha_denuncia)) > PLAZO_HABILES; }).length,
        desv: n ? Math.round(arr.filter(function (d) { return normMedida(d) === 'DESVINCULACIÓN'; }).length * 100 / n) + ' %' : '—'
      };
    }
    var mP = met(porSede.PIURA), mO = met(porSede.OLMOS), mT = met(items);
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
    var empO = Object.keys(empSet).sort();
    barrasSede('hChEmpresa', empO.length ? empO : ['RAPEL', 'VERFRUT'], dEmp);

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
    ['', 'RAPEL', 'VERFRUT'].forEach(function (v) { e.appendChild(opt(v || 'Todas', F.empresa === v, function () { F.empresa = v; sidebar(); render(); })); });

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

  /* ---------- API pública ---------- */
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

  return { abrir: abrir, cerrar: cerrar, imprimir: imprimir };
})();
