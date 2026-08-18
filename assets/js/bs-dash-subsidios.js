/* =========================================================================
 * BS-DASH-SUBSIDIOS  ·  Dashboard del indicador: Subsidios
 * Bienestar Social · Unifrutti Group
 * -------------------------------------------------------------------------
 * Modal autónomo. Lee datos reales del backend via api() (global de
 * subsidios.html):
 *   - api('bs_listarSubsidios', {}) -> subsidios
 * Usa la MISMA lógica de monto y estado que el módulo (montoSub/catEstadoSub)
 * para que los importes del dashboard cuadren siempre con la tabla.
 * Carga Chart.js + datalabels bajo demanda (lazy). NO requiere cambios en GAS.
 *
 * USO (2 toques en subsidios.html):
 *   1) <script src="../assets/js/bs-dash-subsidios.js"></script>
 *   2) <button onclick="BSDashSubsidios.abrir()">📊 Dashboard</button>
 * ========================================================================= */
window.BSDashSubsidios = (function () {
  'use strict';

  var MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  var MESES_L = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SETIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
  var RED = '#E2001A', NAVY = '#1e3a8a', BLUE = '#3b5bdb';
  var VERDE = '#16a34a', AMBAR = '#d97706', GRIS = '#94a3b8';
  var PAL = [NAVY, RED, BLUE, VERDE, AMBAR, '#7c3aed', '#0891b2', '#db2777'];
  var C_EST = { rec: VERDE, pen: NAVY, nor: AMBAR };
  var C_EMPRESA = { RAPEL: '#e2001a', VERFRUT: '#1d4ed8', BOMAREA: '#0d9488', OTRO: '#94a3b8' };
  var L_EST = { rec: 'Cobrado', pen: 'Por cobrar', nor: 'No recuperable' };

  var DATA = { subs: [] };
  var F = { empresa: '', anio: '', tipo: '', meses: {} };
  var charts = {};
  var montado = false;

  /* ---------- utilidades ---------- */
  function txt(v) { return String(v == null ? '' : v).trim(); }
  function up(v) { return txt(v).toUpperCase(); }
  function emp(v) { var s = up(v); return s.indexOf('VERFRUT') >= 0 ? 'VERFRUT' : (s.indexOf('RAPEL') >= 0 ? 'RAPEL' : (s.indexOf('BOMAREA') >= 0 ? 'BOMAREA' : 'OTRO')); }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function numMoney(v) {
    if (v === '' || v === null || v === undefined) return 0;
    var n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
    return isNaN(n) ? 0 : n;
  }
  /* Mismo cálculo que subsidios.html */
  function montoSub(s) {
    var v = numMoney(s.monto_total);
    if (!v) v = numMoney(s.pago_empresa) + numMoney(s.recuperado_essalud);
    if (!v) v = numMoney(s.reembolso_por_mes);
    if (!v) v = numMoney(s.calculo_por_dia) * (parseInt(s.dias, 10) || 0);
    return v;
  }
  function catEstadoSub(s) {
    var e = up(s.estado_general);
    if (e === 'COBRADO' || e === 'RECUPERADO') return 'rec';
    if (e === 'NO RECUPERABLE') return 'nor';
    return 'pen';
  }
  /* Contingencia normalizada */
  function conting(s) {
    var t = up(s.tipo) || up(s.descripcion);
    if (/MATERN/.test(t)) return 'Maternidad pre y post natal';
    if (/INCAP/.test(t)) return 'Incapacidad temporal';
    if (/LACTAN/.test(t)) return 'Lactancia';
    if (/SEPELIO/.test(t)) return 'Sepelio';
    return t ? (t.charAt(0) + t.slice(1).toLowerCase()) : '(Sin contingencia)';
  }
  function colorConting(c) {
    if (/Incapacidad/i.test(c)) return NAVY;
    if (/Maternidad/i.test(c)) return RED;
    if (/Lactancia/i.test(c)) return BLUE;
    if (/Sepelio/i.test(c)) return '#7c3aed';
    return GRIS;
  }
  function mesNum(m) {
    m = up(m);
    if (!m) return 0;
    if (m.indexOf('SEPT') === 0 || m.indexOf('SETI') === 0) return 9;
    for (var i = 0; i < MESES_L.length; i++) {
      if (m.indexOf(MESES_L[i].slice(0, 4)) === 0) return i + 1;
    }
    var n = parseInt(m, 10);
    return (n >= 1 && n <= 12) ? n : 0;
  }
  function S(n, dec) {
    n = n || 0;
    return 'S/ ' + n.toLocaleString('es-PE', { minimumFractionDigits: dec === undefined ? 2 : dec, maximumFractionDigits: dec === undefined ? 2 : dec });
  }
  function Sc(n) { return 'S/ ' + Math.round(n || 0).toLocaleString('es-PE'); }

  function aplicar() {
    return DATA.subs.filter(function (s) {
      if (s.anulado) return false;
      if (F.empresa && emp(s.empresa) !== F.empresa) return false;
      if (F.anio && String(s.anio) !== F.anio) return false;
      if (F.tipo && conting(s) !== F.tipo) return false;
      var hayMes = Object.keys(F.meses).length > 0;
      if (hayMes && !F.meses[mesNum(s.mes)]) return false;
      return true;
    });
  }
  function baseSinAnio() {
    return DATA.subs.filter(function (s) {
      if (s.anulado) return false;
      if (F.empresa && emp(s.empresa) !== F.empresa) return false;
      if (F.tipo && conting(s) !== F.tipo) return false;
      return true;
    });
  }
  function aniosUnicos() {
    var set = {}; DATA.subs.forEach(function (s) { if (!s.anulado && s.anio) set[String(s.anio)] = true; });
    return Object.keys(set).sort();
  }
  function contingUnicas() {
    var set = {}; DATA.subs.forEach(function (s) { if (!s.anulado) set[conting(s)] = true; });
    return Object.keys(set).sort();
  }

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
    if (document.getElementById('bsds-css')) return;
    var st = document.createElement('style');
    st.id = 'bsds-css';
    st.textContent =
      '.bsds-ov{position:fixed;inset:0;z-index:9999;background:#eef1f6;display:none;flex-direction:column;font-family:Inter,system-ui,sans-serif;overflow:hidden;}' +
      '.bsds-ov.on{display:flex;}' +
      '.bsds-bar{display:flex;justify-content:space-between;align-items:center;background:#fff;border-bottom:1px solid #e2e8f0;padding:10px 16px;flex-wrap:wrap;gap:8px;}' +
      '.bsds-bar .ti{display:flex;align-items:center;gap:12px;}' +
      '.bsds-bar .logo{width:40px;height:40px;border-radius:8px;background:#E2001A;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;}' +
      '.bsds-bar h1{margin:0;font-size:1rem;color:#E2001A;font-weight:800;line-height:1.1;}' +
      '.bsds-bar p{margin:0;font-size:.7rem;color:#0a1c4d;font-weight:600;}' +
      '.bsds-x{border:none;background:#0a1c4d;color:#fff;width:36px;height:36px;border-radius:8px;font-size:1.1rem;cursor:pointer;}' +
      '.bsds-body{flex:1;display:flex;overflow:hidden;}' +
      '.bsds-side{width:190px;flex-shrink:0;background:#fff;border-right:1px solid #e2e8f0;padding:12px;overflow-y:auto;}' +
      '.bsds-side h4{margin:0 0 6px;font-size:.6rem;letter-spacing:.08em;text-transform:uppercase;color:#fff;background:#0a1c4d;padding:6px 10px;border-radius:6px;text-align:center;}' +
      '.bsds-grp{margin-bottom:14px;}' +
      '.bsds-opt{display:block;width:100%;text-align:left;border:1px solid #e2e8f0;background:#fff;color:#334155;padding:6px 10px;border-radius:6px;margin-bottom:4px;cursor:pointer;font:600 12px Inter;transition:.12s;}' +
      '.bsds-opt:hover{border-color:#0a1c4d;}' +
      '.bsds-opt.on{background:#0a1c4d;color:#fff;border-color:#0a1c4d;}' +
      '.bsds-main{flex:1;padding:14px 16px;overflow-y:auto;}' +
      '.bsds-alert{background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:10px;padding:8px 12px;font-size:.72rem;font-weight:800;margin-bottom:10px;display:none;}' +
      '.bsds-hero{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:12px;}' +
      '.bsds-hc{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;display:flex;align-items:center;gap:12px;box-shadow:0 1px 3px rgba(0,0,0,.04);}' +
      '.bsds-hc .ic{font-size:1.5rem;}.bsds-hc .big{font-size:1.15rem;font-weight:800;color:#0a1c4d;line-height:1.15;}' +
      '.bsds-hc .lbl{font-size:.58rem;letter-spacing:.05em;text-transform:uppercase;color:#64748b;margin-top:3px;}' +
      '.bsds-hc .sub{font-size:.6rem;color:#94a3b8;font-weight:700;}' +
      '.bsds-hc.v .big{color:#15803d;}.bsds-hc.a .big{color:#b45309;}' +
      '.bsds-grid{display:grid;grid-template-columns:repeat(12,1fr);gap:12px;}' +
      '.bsds-c{background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.04);display:flex;flex-direction:column;}' +
      '.bsds-c .h{background:#0a1c4d;color:#fff;font-size:.64rem;letter-spacing:.04em;text-transform:uppercase;font-weight:700;padding:7px 10px;text-align:center;}' +
      '.bsds-c .h .tag{background:#22c55e;color:#052e16;border-radius:999px;padding:1px 6px;font-size:.55rem;margin-left:6px;}' +
      '.bsds-c .b{padding:10px;flex:1;position:relative;height:215px;}' +
      '.bsds-c .b.tabla{height:auto;min-height:215px;overflow:auto;}' +
      '.bsds-load{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#64748b;font-weight:600;background:#eef1f6;z-index:5;}' +
      '.bsds-mx{width:100%;border-collapse:collapse;font-size:.72rem;}' +
      '.bsds-mx th{background:#0a1c4d;color:#fff;padding:6px 8px;text-align:right;font-weight:700;}' +
      '.bsds-mx th:first-child{text-align:left;}' +
      '.bsds-mx td{padding:6px 8px;text-align:right;border-bottom:1px solid #e2e8f0;font-variant-numeric:tabular-nums;}' +
      '.bsds-mx td:first-child{text-align:left;font-weight:700;color:#334155;}' +
      '.bsds-mx tr.tot td{background:#f1f5f9;font-weight:800;color:#0a1c4d;border-top:2px solid #cbd5e1;}' +
      '.bsds-c4{grid-column:span 4;}.bsds-c6{grid-column:span 6;}.bsds-c8{grid-column:span 8;}.bsds-c12{grid-column:span 12;}' +
      '@media(max-width:1200px){.bsds-hero{grid-template-columns:repeat(2,1fr);}}' +
      '@media(max-width:1100px){.bsds-c4,.bsds-c6,.bsds-c8{grid-column:span 12;}}';
    document.head.appendChild(st);
  }

  /* ---------- shell ---------- */
  function montar() {
    if (montado) return;
    inyectarEstilos();
    var ov = document.createElement('div');
    ov.className = 'bsds-ov';
    ov.id = 'bsdsOverlay';
    ov.innerHTML =
      '<div class="bsds-bar">' +
        '<div class="ti"><div class="logo">U</div><div>' +
          '<h1>BIENESTAR SOCIAL</h1>' +
          '<p>DASHBOARD DEL INDICADOR · SUBSIDIOS</p>' +
        '</div></div>' +
        '<div style="display:flex;align-items:center;gap:14px;">' +
          '<div id="bsdsUpd" style="font-size:.66rem;color:#64748b;text-align:right;"></div>' +
          '<button class="bsds-x" onclick="BSDashSubsidios.cerrar()">✕</button>' +
        '</div>' +
      '</div>' +
      '<div class="bsds-body">' +
        '<aside class="bsds-side">' +
          '<div class="bsds-grp"><h4>Empresa</h4><div id="bsdsEmp"></div></div>' +
          '<div class="bsds-grp"><h4>Contingencia</h4><div id="bsdsTipo"></div></div>' +
          '<div class="bsds-grp"><h4>Año</h4><div id="bsdsAnio"></div></div>' +
          '<div class="bsds-grp"><h4>Mes</h4><div id="bsdsMes"></div></div>' +
        '</aside>' +
        '<main class="bsds-main" style="position:relative;">' +
          '<div class="bsds-load" id="bsdsLoad">Cargando datos…</div>' +
          '<div class="bsds-alert" id="bsdsAlerta"></div>' +
          '<div class="bsds-hero">' +
            '<div class="bsds-hc"><div class="ic">📋</div><div><div class="big" id="skTotal">—</div><div class="lbl">Monto tramitado</div><div class="sub" id="skCasos"></div></div></div>' +
            '<div class="bsds-hc v"><div class="ic">✅</div><div><div class="big" id="skCobrado">—</div><div class="lbl">Cobrado</div><div class="sub" id="skCobradoP"></div></div></div>' +
            '<div class="bsds-hc"><div class="ic">⏳</div><div><div class="big" id="skPorCobrar">—</div><div class="lbl">Por cobrar</div><div class="sub" id="skPorCobrarP"></div></div></div>' +
            '<div class="bsds-hc a"><div class="ic">⚠️</div><div><div class="big" id="skNoRec">—</div><div class="lbl">No recuperable</div><div class="sub" id="skNoRecP"></div></div></div>' +
            '<div class="bsds-hc v"><div class="ic">🎯</div><div><div class="big" id="skTasa">—</div><div class="lbl">% de recuperación</div><div class="sub" id="skTicket"></div></div></div>' +
          '</div>' +
          '<div class="bsds-grid">' +
            '<div class="bsds-c bsds-c4"><div class="h">1 · Subsidios por año</div><div class="b"><canvas id="sChAnio"></canvas></div></div>' +
            '<div class="bsds-c bsds-c4"><div class="h">2 · Subsidios por empresa</div><div class="b"><canvas id="sChEmpresa"></canvas></div></div>' +
            '<div class="bsds-c bsds-c4"><div class="h">4 · Subsidios por contingencia</div><div class="b"><canvas id="sChConting"></canvas></div></div>' +
            '<div class="bsds-c bsds-c12"><div class="h">3 · Cantidad de subsidios mensuales por contingencia</div><div class="b"><canvas id="sChMes"></canvas></div></div>' +
            '<div class="bsds-c bsds-c6"><div class="h">5 · Subsidios por empresa y contingencia</div><div class="b"><canvas id="sChEmpConting"></canvas></div></div>' +
            '<div class="bsds-c bsds-c6"><div class="h">6 · Resumen de montos por subsidios (S/)</div><div class="b"><canvas id="sChMontoEstado"></canvas></div></div>' +
            '<div class="bsds-c bsds-c6"><div class="h">7 · Montos por estado y contingencia (S/)</div><div class="b"><canvas id="sChMontoConting"></canvas></div></div>' +
            '<div class="bsds-c bsds-c6"><div class="h">8 · Estado de subsidios (S/)</div><div class="b"><canvas id="sChEstado"></canvas></div></div>' +
            '<div class="bsds-c bsds-c6"><div class="h">A · Antigüedad del monto por cobrar <span class="tag">NUEVO</span></div><div class="b"><canvas id="sChAging"></canvas></div></div>' +
            '<div class="bsds-c bsds-c6"><div class="h">B · Recuperación acumulada del año <span class="tag">NUEVO</span></div><div class="b"><canvas id="sChAcum"></canvas></div></div>' +
            '<div class="bsds-c bsds-c12"><div class="h">9 · Resumen de subsidios tramitados (S/ por estado y año)</div><div class="b tabla" id="sMatriz"></div></div>' +
          '</div>' +
        '</main>' +
      '</div>';
    document.body.appendChild(ov);
    montado = true;
  }

  /* ---------- helpers charts ---------- */
  function destroy() { Object.keys(charts).forEach(function (k) { if (charts[k]) { charts[k].destroy(); charts[k] = null; } }); }
  function ctx(id) { var el = document.getElementById(id); return el ? el.getContext('2d') : null; }

  function doughnut(id, labels, data, colors, money) {
    var c = ctx(id); if (!c) return;
    var tot = data.reduce(function (a, b) { return a + b; }, 0);
    charts[id] = new Chart(c, {
      type: 'doughnut',
      data: { labels: labels, datasets: [{ data: data, backgroundColor: colors || PAL, borderWidth: 2, borderColor: '#fff' }] },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '60%',
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 9 }, boxWidth: 10 } },
          datalabels: {
            color: '#fff', font: { weight: 'bold', size: 10 },
            formatter: function (v) { if (!v) return ''; var p = tot ? Math.round(v * 100 / tot) : 0; return (money ? Sc(v) : v) + '\n' + p + '%'; }
          },
          tooltip: { callbacks: { label: function (x) { var p = tot ? Math.round(x.parsed * 100 / tot) : 0; return x.label + ': ' + (money ? S(x.parsed) : x.parsed) + ' (' + p + '%)'; } } }
        }
      }, plugins: DL()
    });
  }
  function barras(id, labels, datasets, money, stacked) {
    var c = ctx(id); if (!c) return;
    charts[id] = new Chart(c, {
      type: 'bar', data: { labels: labels, datasets: datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: datasets.length > 1, position: 'bottom', labels: { font: { size: 9 }, boxWidth: 10 } },
          datalabels: {
            anchor: 'end', align: 'top', color: '#334155', font: { weight: 'bold', size: 9 },
            formatter: function (v) { return v ? (money ? Sc(v) : v) : ''; }
          },
          tooltip: { callbacks: { label: function (x) { return x.dataset.label + ': ' + (money ? S(x.parsed.y) : x.parsed.y); } } }
        },
        scales: {
          x: { stacked: !!stacked, ticks: { font: { size: 9 } } },
          y: { stacked: !!stacked, beginAtZero: true, ticks: { precision: money ? undefined : 0, callback: function (v) { return money ? Sc(v) : v; }, font: { size: 9 } } }
        }
      }, plugins: DL()
    });
  }

  /* ---------- render ---------- */
  function render() {
    if (!window.Chart) return;
    destroy();
    var items = aplicar();
    var CONT = contingUnicas();

    /* --- KPIs --- */
    var tot = { rec: 0, pen: 0, nor: 0 }, dias = 0, monto = 0;
    items.forEach(function (s) { var m = montoSub(s); tot[catEstadoSub(s)] += m; monto += m; dias += parseInt(s.dias, 10) || 0; });
    var baseRec = tot.rec + tot.pen;
    document.getElementById('skTotal').textContent = S(monto);
    document.getElementById('skCasos').textContent = items.length + ' casos · ' + dias.toLocaleString('es-PE') + ' días subsidiados';
    document.getElementById('skCobrado').textContent = S(tot.rec);
    document.getElementById('skCobradoP').textContent = (monto ? Math.round(tot.rec * 100 / monto) : 0) + '% del total';
    document.getElementById('skPorCobrar').textContent = S(tot.pen);
    document.getElementById('skPorCobrarP').textContent = (monto ? Math.round(tot.pen * 100 / monto) : 0) + '% del total';
    document.getElementById('skNoRec').textContent = S(tot.nor);
    document.getElementById('skNoRecP').textContent = (monto ? Math.round(tot.nor * 100 / monto) : 0) + '% del total';
    document.getElementById('skTasa').textContent = (baseRec ? Math.round(tot.rec * 100 / baseRec) : 0) + ' %';
    document.getElementById('skTicket').textContent = 'Ticket prom.: ' + S(items.length ? monto / items.length : 0);
    document.getElementById('bsdsUpd').innerHTML = 'Última actualización<br>' + new Date().toLocaleString('es-PE');

    /* --- 1. subsidios por año (cantidad) --- */
    var anios = aniosUnicos();
    var baseA = baseSinAnio();
    var porAnioN = anios.map(function (a) { return baseA.filter(function (s) { return String(s.anio) === a; }).length; });
    barras('sChAnio', anios, [{ label: 'Subsidios', data: porAnioN, backgroundColor: anios.map(function (a, i) { return PAL[i % PAL.length]; }), borderRadius: 4 }]);

    /* --- 2. subsidios por empresa (dona, cantidad) --- */
    var byEmp = {}; items.forEach(function (s) { var e = emp(s.empresa); byEmp[e] = (byEmp[e] || 0) + 1; });
    var empO = Object.keys(byEmp);
    doughnut('sChEmpresa', empO, empO.map(function (k) { return byEmp[k]; }),
      empO.map(function (e) { return C_EMPRESA[e] || C_EMPRESA.OTRO; }));

    /* --- 4. por contingencia (dona, cantidad) --- */
    var byCon = {}; items.forEach(function (s) { var c = conting(s); byCon[c] = (byCon[c] || 0) + 1; });
    var conO = Object.keys(byCon).sort(function (a, b) { return byCon[b] - byCon[a]; });
    doughnut('sChConting', conO, conO.map(function (k) { return byCon[k]; }), conO.map(colorConting));

    /* --- 3. cantidad mensual por contingencia (líneas) --- */
    var dsM = CONT.map(function (c) {
      return {
        label: c, borderColor: colorConting(c), backgroundColor: colorConting(c),
        tension: .35, fill: false, pointRadius: 3,
        data: MESES.map(function (_, mi) {
          return items.filter(function (s) { return conting(s) === c && mesNum(s.mes) === mi + 1; }).length;
        })
      };
    });
    charts['sChMes'] = new Chart(ctx('sChMes'), {
      type: 'line', data: { labels: MESES, datasets: dsM },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 10 } },
          datalabels: { align: 'top', color: '#475569', font: { weight: 'bold', size: 9 }, formatter: function (v) { return v || ''; } }
        },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
      }, plugins: DL()
    });

    /* --- 5. empresa x contingencia (cantidad) --- */
    var empLabels = empO.length ? empO : ['RAPEL', 'VERFRUT', 'BOMAREA'];
    barras('sChEmpConting', empLabels, CONT.map(function (c) {
      return {
        label: c, backgroundColor: colorConting(c), borderRadius: 4,
        data: empLabels.map(function (e) { return items.filter(function (s) { return emp(s.empresa) === e && conting(s) === c; }).length; })
      };
    }));

    /* --- 6. montos por estado, desglosado por empresa --- */
    var estKeys = ['rec', 'pen', 'nor'];
    barras('sChMontoEstado', estKeys.map(function (k) { return L_EST[k]; }), empLabels.map(function (e) {
      return {
        label: e, backgroundColor: C_EMPRESA[e] || C_EMPRESA.OTRO, borderRadius: 4,
        data: estKeys.map(function (k) {
          var v = 0; items.forEach(function (s) { if (emp(s.empresa) === e && catEstadoSub(s) === k) v += montoSub(s); });
          return Math.round(v);
        })
      };
    }), true);

    /* --- 7. montos por estado y contingencia --- */
    barras('sChMontoConting', estKeys.map(function (k) { return L_EST[k]; }), CONT.map(function (c) {
      return {
        label: c, backgroundColor: colorConting(c), borderRadius: 4,
        data: estKeys.map(function (k) {
          var v = 0; items.forEach(function (s) { if (conting(s) === c && catEstadoSub(s) === k) v += montoSub(s); });
          return Math.round(v);
        })
      };
    }), true);

    /* --- 8. estado de subsidios por monto (dona) --- */
    doughnut('sChEstado', estKeys.map(function (k) { return L_EST[k]; }), estKeys.map(function (k) { return Math.round(tot[k]); }),
      estKeys.map(function (k) { return C_EST[k]; }), true);

    /* --- NUEVO A: antigüedad del monto por cobrar --- */
    var hoy = new Date();
    var ag = { '0–30 días': 0, '31–60 días': 0, '61–90 días': 0, '91–180 días': 0, 'Más de 180 días': 0 };
    var agN = { '0–30 días': 0, '31–60 días': 0, '61–90 días': 0, '91–180 días': 0, 'Más de 180 días': 0 };
    var vencido = 0, vencidoN = 0;
    items.forEach(function (s) {
      if (catEstadoSub(s) !== 'pen') return;
      var m = montoSub(s);
      var mn = mesNum(s.mes), an = parseInt(s.anio, 10);
      var ref = (an && mn) ? new Date(an, mn, 0) : null; // último día del mes del subsidio
      var d = ref ? Math.max(0, Math.floor((hoy - ref) / 86400000)) : 0;
      var k = d <= 30 ? '0–30 días' : d <= 60 ? '31–60 días' : d <= 90 ? '61–90 días' : d <= 180 ? '91–180 días' : 'Más de 180 días';
      ag[k] += m; agN[k]++;
      if (d > 90) { vencido += m; vencidoN++; }
    });
    var agK = Object.keys(ag);
    charts['sChAging'] = new Chart(ctx('sChAging'), {
      type: 'bar',
      data: { labels: agK, datasets: [{ label: 'Por cobrar', data: agK.map(function (k) { return Math.round(ag[k]); }), backgroundColor: [VERDE, '#84cc16', AMBAR, '#ea580c', RED], borderRadius: 4 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          datalabels: { anchor: 'end', align: 'top', color: '#334155', font: { weight: 'bold', size: 9 }, formatter: function (v) { return v ? Sc(v) : ''; } },
          tooltip: { callbacks: { label: function (x) { return S(x.parsed.y) + ' · ' + agN[x.label] + ' caso(s)'; } } }
        },
        scales: { y: { beginAtZero: true, ticks: { callback: function (v) { return Sc(v); }, font: { size: 9 } } }, x: { ticks: { font: { size: 9 } } } }
      }, plugins: DL()
    });

    var al = document.getElementById('bsdsAlerta');
    if (vencido > 0) {
      al.style.display = 'block';
      al.innerHTML = '⚠️ ' + Sc(vencido) + ' por cobrar en ' + vencidoN + ' caso(s) con más de 90 días de antigüedad. ' +
        'EsSalud exige presentar el canje / reembolso dentro de los plazos vigentes: revisa estos expedientes antes de que pasen a NO RECUPERABLE.';
    } else { al.style.display = 'none'; }

    /* --- NUEVO B: recuperación acumulada del año --- */
    var anioRef = F.anio || (anios.length ? anios[anios.length - 1] : '');
    var itemsAnio = baseA.filter(function (s) { return String(s.anio) === String(anioRef); });
    var accT = 0, accR = 0, serieT = [], serieR = [];
    MESES.forEach(function (_, mi) {
      itemsAnio.forEach(function (s) {
        if (mesNum(s.mes) !== mi + 1) return;
        var m = montoSub(s);
        accT += m;
        if (catEstadoSub(s) === 'rec') accR += m;
      });
      serieT.push(Math.round(accT)); serieR.push(Math.round(accR));
    });
    charts['sChAcum'] = new Chart(ctx('sChAcum'), {
      type: 'line',
      data: {
        labels: MESES,
        datasets: [
          { label: 'Tramitado acumulado ' + anioRef, data: serieT, borderColor: NAVY, backgroundColor: 'rgba(30,58,138,.10)', fill: true, tension: .3, pointRadius: 2 },
          { label: 'Cobrado acumulado ' + anioRef, data: serieR, borderColor: VERDE, backgroundColor: 'rgba(22,163,74,.15)', fill: true, tension: .3, pointRadius: 2 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 9 }, boxWidth: 10 } },
          datalabels: { display: false },
          tooltip: { callbacks: { label: function (x) { return x.dataset.label + ': ' + S(x.parsed.y); } } }
        },
        scales: { y: { beginAtZero: true, ticks: { callback: function (v) { return Sc(v); }, font: { size: 9 } } } }
      }, plugins: DL()
    });

    /* --- 9. matriz estado x año --- */
    var mx = {}; estKeys.forEach(function (k) { mx[k] = {}; });
    var totA = {}, granTot = 0;
    baseA.forEach(function (s) {
      var a = String(s.anio || 's/a'), k = catEstadoSub(s), m = montoSub(s);
      mx[k][a] = (mx[k][a] || 0) + m; totA[a] = (totA[a] || 0) + m; granTot += m;
    });
    var colA = Object.keys(totA).sort();
    var html = '<table class="bsds-mx"><thead><tr><th>ESTADO</th>' +
      colA.map(function (a) { return '<th>' + esc(a) + '</th>'; }).join('') + '<th>TOTAL</th></tr></thead><tbody>';
    ['nor', 'pen', 'rec'].forEach(function (k) {
      var fila = 0;
      html += '<tr><td>' + L_EST[k].toUpperCase() + '</td>' +
        colA.map(function (a) { var v = mx[k][a] || 0; fila += v; return '<td>' + (v ? S(v) : '—') + '</td>'; }).join('') +
        '<td><strong>' + S(fila) + '</strong></td></tr>';
    });
    html += '<tr class="tot"><td>TOTAL</td>' +
      colA.map(function (a) { return '<td>' + S(totA[a] || 0) + '</td>'; }).join('') +
      '<td>' + S(granTot) + '</td></tr></tbody></table>' +
      '<p style="font-size:.62rem;color:#94a3b8;margin:8px 2px 0;">La matriz no aplica el filtro de año ni de mes: muestra la serie histórica completa según empresa y contingencia seleccionadas.</p>';
    document.getElementById('sMatriz').innerHTML = html;
  }

  /* ---------- sidebar ---------- */
  function opt(label, on, fn) { var b = document.createElement('button'); b.className = 'bsds-opt' + (on ? ' on' : ''); b.textContent = label; b.onclick = fn; return b; }
  function sidebar() {
    var e = document.getElementById('bsdsEmp'); e.innerHTML = '';
    ['', 'RAPEL', 'VERFRUT', 'BOMAREA'].forEach(function (v) { e.appendChild(opt(v || 'Todas', F.empresa === v, function () { F.empresa = v; sidebar(); render(); })); });

    var t = document.getElementById('bsdsTipo'); t.innerHTML = '';
    [''].concat(contingUnicas()).forEach(function (v) { t.appendChild(opt(v || 'Todas', F.tipo === v, function () { F.tipo = v; sidebar(); render(); })); });

    var a = document.getElementById('bsdsAnio'); a.innerHTML = '';
    [''].concat(aniosUnicos()).forEach(function (v) { a.appendChild(opt(v || 'Todos', F.anio === v, function () { F.anio = v; sidebar(); render(); })); });

    var m = document.getElementById('bsdsMes'); m.innerHTML = '';
    m.appendChild(opt('Todos los meses', Object.keys(F.meses).length === 0, function () { F.meses = {}; sidebar(); render(); }));
    MESES.forEach(function (nm, i) {
      var n = i + 1;
      m.appendChild(opt(nm, !!F.meses[n], function () { if (F.meses[n]) delete F.meses[n]; else F.meses[n] = true; sidebar(); render(); }));
    });
  }

  /* ---------- carga ---------- */
  function cargar() {
    var load = document.getElementById('bsdsLoad');
    if (load) { load.style.display = 'flex'; load.textContent = 'Cargando datos…'; }
    /* Si el módulo ya tiene la caché en memoria, se usa al instante */
    if (window._CACHE_S && window._CACHE_S.length) {
      DATA.subs = window._CACHE_S;
      if (load) load.style.display = 'none';
      sidebar(); render();
    }
    api('bs_listarSubsidios', {}).then(function (res) {
      DATA.subs = (res && res.ok && res.items) ? res.items : (DATA.subs || []);
      if (load) load.style.display = 'none';
      sidebar();
      render();
    }).catch(function () {
      if (load) load.textContent = 'No se pudieron cargar los subsidios. Cierra y vuelve a intentar.';
    });
  }

  /* ---------- API pública ---------- */
  function abrir() {
    montar();
    document.getElementById('bsdsOverlay').classList.add('on');
    document.body.style.overflow = 'hidden';
    ensureLibs(function () { cargar(); });
  }
  function cerrar() {
    var ov = document.getElementById('bsdsOverlay');
    if (ov) ov.classList.remove('on');
    document.body.style.overflow = '';
    destroy();
  }

  return { abrir: abrir, cerrar: cerrar };
})();
