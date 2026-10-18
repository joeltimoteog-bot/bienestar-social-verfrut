/* =========================================================================
 * BS-DASH-ACCIDENTES  ·  Dashboard del indicador: Accidentes de Trabajo
 * Bienestar Social · Unifrutti Group
 * -------------------------------------------------------------------------
 * Modal autónomo (mismo patrón que bs-dash-quejas.js). Lee datos reales via
 * api() global de accidentes.html:
 *   - api('bs_listarAccidentes', {})  -> casos
 *   - api('bs_clasificacion', {})     -> personal activo (total + por empresa)
 * Índices Ley 29783 / R.M. 050-2013-TR (base 200 000 HH):
 *   IF = accidentes × 200 000 / HHT      IG = días perdidos × 200 000 / HHT
 *   IA = IF × IG / 1000
 *   HHT estimadas = personal activo × HORAS_MES × meses del periodo filtrado.
 * Carga Chart.js + datalabels bajo demanda. NO requiere cambios en GAS.
 *
 * USO (2 toques en accidentes.html):
 *   1) <script src="../assets/js/bs-dash-accidentes.js"></script>
 *   2) <button onclick="BSDashAccidentes.abrir()">📊 Estadísticas</button>
 * ========================================================================= */
window.BSDashAccidentes = (function () {
  'use strict';

  var HORAS_MES = 208;   // 48 h/sem × 52 / 12 (régimen agrario; ajustar si planillas indica otro valor)
  var MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'];
  var DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  var RED = '#dc2626', NAVY = '#1e3a8a', BLUE = '#3b5bdb', GREEN = '#16a34a', AMBER = '#d97706';
  var C_EMPRESA = { RAPEL: '#e2001a', VERFRUT: '#1d4ed8', OTRO: '#94a3b8' };
  var PAL = [RED, NAVY, BLUE, GREEN, AMBER, '#7c3aed', '#0891b2', '#db2777', '#64748b', '#84cc16'];

  var DATA = { casos: [], personal: { total: 0, RAPEL: 0, VERFRUT: 0 } };
  var F = { empresa: '', anio: '', meses: {} };
  var charts = {};
  var montado = false;

  /* ---------- utilidades ---------- */
  function parseF(v) {
    if (!v) return null;
    var s = String(v); var base = s.indexOf('T') >= 0 ? s.split('T')[0] : s; var p = base.split('-');
    if (p.length < 2 || !/^\d{4}$/.test(p[0])) {
      var d = new Date(v); if (isNaN(d.getTime())) return null;
      return { anio: String(d.getFullYear()), mes: ('0' + (d.getMonth() + 1)).slice(-2), dia: d.getDate(), dow: d.getDay(), hora: d.getHours() };
    }
    var dt = new Date(+p[0], +p[1] - 1, +(p[2] || 1));
    var hh = s.indexOf('T') >= 0 ? parseInt(s.split('T')[1], 10) : NaN;
    return { anio: p[0], mes: ('0' + parseInt(p[1], 10)).slice(-2), dia: parseInt(p[2] || '1', 10), dow: dt.getDay(), hora: isNaN(hh) ? null : hh };
  }
  function emp(v) { var s = String(v || '').toUpperCase(); return s.indexOf('VERFRUT') >= 0 ? 'VERFRUT' : (s.indexOf('RAPEL') >= 0 ? 'RAPEL' : 'OTRO'); }
  function txt(v) { return String(v == null ? '' : v).trim(); }
  function num(v) { var n = parseFloat(String(v == null ? '' : v).replace(/[^\d.]/g, '')); return isNaN(n) ? 0 : n; }
  function esCerrado(c) { return /reincorpor|cerrad|finaliz|alta/i.test(txt(c.estado_caso)) && !/restric/i.test(txt(c.estado_caso)); }
  function diasPerdidos(c) {
    // Días de descanso médico (texto libre "Días de DM autorizados") + días de restricción
    var dm = num(c.descanso_medico), rest = num(c.dias_restriccion);
    if (!dm && c.dia_accidente && c.fecha_reincorporo) {
      var a = new Date(c.dia_accidente), b = new Date(c.fecha_reincorporo);
      if (!isNaN(a) && !isNaN(b) && b > a) dm = Math.round((b - a) / 86400000);
    }
    return dm + rest;
  }
  function esGrave(c) { return diasPerdidos(c) > 30 || /grave|mortal|fatal|amputa|fractura/i.test(txt(c.diagnostico) + ' ' + txt(c.tipo_accidente)); }

  function aplicar() {
    return DATA.casos.filter(function (c) {
      if (F.empresa && emp(c.empresa) !== F.empresa) return false;
      var p = parseF(c.dia_accidente); if (!p) return false;
      if (F.anio && p.anio !== F.anio) return false;
      var hayMes = Object.keys(F.meses).length > 0;
      if (hayMes && !F.meses[p.mes]) return false;
      return true;
    });
  }
  function aniosUnicos() {
    var set = {}; DATA.casos.forEach(function (c) { var p = parseF(c.dia_accidente); if (p) set[p.anio] = true; });
    return Object.keys(set).sort();
  }
  function mesesPeriodo() {
    var n = Object.keys(F.meses).length;
    if (n) return n;
    if (F.anio) { var hoy = new Date(); return String(hoy.getFullYear()) === F.anio ? hoy.getMonth() + 1 : 12; }
    return Math.max(1, aniosUnicos().length * 12);
  }

  /* ---------- lazy load Chart.js ---------- */
  function ensureLibs(cb) {
    function loadDL() {
      if (window.ChartDataLabels) return cb();
      var s2 = document.createElement('script');
      s2.src = 'https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0';
      s2.onload = function () { cb(); }; s2.onerror = function () { cb(); };
      document.head.appendChild(s2);
    }
    if (window.Chart) return loadDL();
    var s1 = document.createElement('script');
    s1.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
    s1.onload = loadDL;
    s1.onerror = function () { (window.appAlert || alert)('No se pudo cargar la librería de gráficos. Verifica tu conexión.'); };
    document.head.appendChild(s1);
  }
  function DL() { return window.ChartDataLabels ? [window.ChartDataLabels] : []; }

  /* ---------- estilos (una vez) ---------- */
  function inyectarEstilos() {
    if (document.getElementById('bsda-css')) return;
    var st = document.createElement('style');
    st.id = 'bsda-css';
    st.textContent =
      '.bsda-ov{position:fixed;inset:0;z-index:9999;background:#eef1f6;display:none;flex-direction:column;font-family:Inter,system-ui,sans-serif;overflow:hidden;}' +
      '.bsda-ov.on{display:flex;}' +
      '.bsda-bar{display:flex;justify-content:space-between;align-items:center;background:#fff;border-bottom:1px solid #e2e8f0;padding:10px 16px;flex-wrap:wrap;gap:8px;}' +
      '.bsda-bar .ti{display:flex;align-items:center;gap:12px;}' +
      '.bsda-bar .logo{width:40px;height:40px;border-radius:8px;background:#dc2626;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;}' +
      '.bsda-bar h1{margin:0;font-size:1rem;color:#dc2626;font-weight:800;line-height:1.1;}' +
      '.bsda-bar p{margin:0;font-size:.7rem;color:#0a1c4d;font-weight:600;}' +
      '.bsda-x{border:none;background:#0a1c4d;color:#fff;width:36px;height:36px;border-radius:8px;font-size:1.1rem;cursor:pointer;}' +
      '.bsda-body{flex:1;display:flex;overflow:hidden;}' +
      '.bsda-side{width:180px;flex-shrink:0;background:#fff;border-right:1px solid #e2e8f0;padding:12px;overflow-y:auto;}' +
      '.bsda-side h4{margin:0 0 6px;font-size:.6rem;letter-spacing:.08em;text-transform:uppercase;color:#fff;background:#0a1c4d;padding:6px 10px;border-radius:6px;text-align:center;}' +
      '.bsda-grp{margin-bottom:14px;}' +
      '.bsda-opt{display:block;width:100%;text-align:left;border:1px solid #e2e8f0;background:#fff;color:#334155;padding:6px 10px;border-radius:6px;margin-bottom:4px;cursor:pointer;font-size:.78rem;font-weight:600;}' +
      '.bsda-opt:hover{border-color:#0a1c4d;}' +
      '.bsda-opt.on{background:#0a1c4d;color:#fff;border-color:#0a1c4d;}' +
      '.bsda-main{flex:1;padding:14px 16px;overflow-y:auto;}' +
      '.bsda-hero{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:12px;}' +
      '.bsda-hc{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;display:flex;align-items:center;gap:12px;box-shadow:0 1px 3px rgba(0,0,0,.04);}' +
      '.bsda-hc .ic{font-size:1.5rem;}.bsda-hc .big{font-size:1.5rem;font-weight:800;color:#0a1c4d;line-height:1;font-variant-numeric:tabular-nums;}' +
      '.bsda-hc .lbl{font-size:.58rem;letter-spacing:.06em;text-transform:uppercase;color:#64748b;margin-top:3px;}' +
      '.bsda-hc.ix .big{color:#dc2626;}' +
      '.bsda-grid{display:grid;grid-template-columns:repeat(12,1fr);gap:12px;}' +
      '.bsda-c{background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.04);display:flex;flex-direction:column;}' +
      '.bsda-c .h{background:#0a1c4d;color:#fff;font-size:.64rem;letter-spacing:.04em;text-transform:uppercase;font-weight:700;padding:7px 10px;text-align:center;}' +
      '.bsda-c .b{padding:10px;flex:1;position:relative;height:210px;}' +
      '.bsda-tot{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;}' +
      '.bsda-tot .n{font-size:3rem;font-weight:800;color:#0a1c4d;line-height:1;}' +
      '.bsda-tot .t{font-size:.66rem;color:#64748b;text-transform:uppercase;letter-spacing:.05em;text-align:center;margin-top:6px;}' +
      '.bsda-load{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#64748b;font-weight:600;background:#eef1f6;z-index:5;}' +
      '.bsda-note{font-size:.66rem;color:#64748b;margin:10px 0 0;}' +
      '.c3{grid-column:span 3;}.c4{grid-column:span 4;}.c6{grid-column:span 6;}.c8{grid-column:span 8;}' +
      '@media(max-width:1100px){.c3,.c4{grid-column:span 6;}.c6,.c8{grid-column:span 12;}.bsda-hero{grid-template-columns:repeat(2,1fr);}}' +
      '@media(max-width:640px){.c3,.c4,.c6{grid-column:span 12;}.bsda-hero{grid-template-columns:1fr;}.bsda-side{width:130px;}}';
    document.head.appendChild(st);
  }

  /* ---------- shell del modal (una vez) ---------- */
  function montar() {
    if (montado) return;
    inyectarEstilos();
    var ov = document.createElement('div');
    ov.className = 'bsda-ov'; ov.id = 'bsdaOverlay';
    ov.innerHTML =
      '<div class="bsda-bar">' +
        '<div class="ti"><div class="logo">U</div><div><h1>BIENESTAR SOCIAL</h1><p>DASHBOARD DEL INDICADOR · ACCIDENTES DE TRABAJO (LEY 29783)</p></div></div>' +
        '<div style="display:flex;align-items:center;gap:14px;"><div id="bsdaUpd" style="font-size:.66rem;color:#64748b;text-align:right;"></div><button class="bsda-x" onclick="BSDashAccidentes.cerrar()">✕</button></div>' +
      '</div>' +
      '<div class="bsda-body">' +
        '<aside class="bsda-side">' +
          '<div class="bsda-grp"><h4>Empresa</h4><div id="bsdaEmp"></div></div>' +
          '<div class="bsda-grp"><h4>Año</h4><div id="bsdaAnio"></div></div>' +
          '<div class="bsda-grp"><h4>Mes</h4><div id="bsdaMes"></div></div>' +
        '</aside>' +
        '<main class="bsda-main" style="position:relative;">' +
          '<div class="bsda-load" id="bsdaLoad">Cargando datos…</div>' +
          '<div class="bsda-hero">' +
            '<div class="bsda-hc"><div class="ic">👥</div><div><div class="big" id="kaPersonal">—</div><div class="lbl">Personal activo</div></div></div>' +
            '<div class="bsda-hc"><div class="ic">🩹</div><div><div class="big" id="kaDias">—</div><div class="lbl">Días perdidos</div></div></div>' +
            '<div class="bsda-hc ix"><div class="ic">📉</div><div><div class="big" id="kaIF">—</div><div class="lbl">Índice de frecuencia</div></div></div>' +
            '<div class="bsda-hc ix"><div class="ic">📊</div><div><div class="big" id="kaIG">—</div><div class="lbl">Índice de gravedad</div></div></div>' +
            '<div class="bsda-hc ix"><div class="ic">⚠️</div><div><div class="big" id="kaIA">—</div><div class="lbl">Índice de accidentabilidad</div></div></div>' +
          '</div>' +
          '<div class="bsda-grid">' +
            '<div class="bsda-c c3"><div class="h">Total de accidentes</div><div class="b"><div class="bsda-tot"><div class="n" id="kaTotal">0</div><div class="t" id="kaTotalSub">en el periodo</div></div></div></div>' +
            '<div class="bsda-c c3"><div class="h">Por empresa</div><div class="b"><canvas id="caEmpresa"></canvas></div></div>' +
            '<div class="bsda-c c3"><div class="h">Estado de los casos</div><div class="b"><canvas id="caEstado"></canvas></div></div>' +
            '<div class="bsda-c c3"><div class="h">Por tipo de accidente</div><div class="b"><canvas id="caTipo"></canvas></div></div>' +
            '<div class="bsda-c c8"><div class="h">Accidentes y días perdidos por mes</div><div class="b"><canvas id="caMes"></canvas></div></div>' +
            '<div class="bsda-c c4"><div class="h">Por año</div><div class="b"><canvas id="caAnio"></canvas></div></div>' +
            '<div class="bsda-c c6"><div class="h">Parte del cuerpo afectada</div><div class="b"><canvas id="caParte"></canvas></div></div>' +
            '<div class="bsda-c c6"><div class="h">Por sector / fundo</div><div class="b"><canvas id="caFundo"></canvas></div></div>' +
            '<div class="bsda-c c4"><div class="h">Por día de la semana</div><div class="b"><canvas id="caDow"></canvas></div></div>' +
            '<div class="bsda-c c4"><div class="h">Por sexo y rango de edad</div><div class="b"><canvas id="caEdad"></canvas></div></div>' +
            '<div class="bsda-c c4"><div class="h">Cobertura (seguro)</div><div class="b"><canvas id="caSeguro"></canvas></div></div>' +
          '</div>' +
          '<p class="bsda-note" id="bsdaNota"></p>' +
        '</main>' +
      '</div>';
    document.body.appendChild(ov);
    montado = true;
  }

  /* ---------- charts ---------- */
  function destroy() { Object.keys(charts).forEach(function (k) { if (charts[k]) { charts[k].destroy(); charts[k] = null; } }); }
  function ctx(id) { var el = document.getElementById(id); return el ? el.getContext('2d') : null; }
  function legend() { return { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 10 } }; }

  function doughnut(id, labels, data, colors) {
    var c = ctx(id); if (!c) return;
    var tot = data.reduce(function (a, b) { return a + b; }, 0);
    charts[id] = new Chart(c, {
      type: 'doughnut',
      data: { labels: labels, datasets: [{ data: data, backgroundColor: colors || PAL, borderWidth: 2, borderColor: '#fff' }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '62%',
        plugins: { legend: legend(),
          datalabels: { color: '#fff', font: { weight: 'bold', size: 11 }, formatter: function (v) { if (!v) return ''; var p = tot ? Math.round(v * 100 / tot) : 0; return p >= 6 ? p + '%' : ''; } },
          tooltip: { callbacks: { label: function (x) { var p = tot ? Math.round(x.parsed * 100 / tot) : 0; return x.label + ': ' + x.parsed + ' (' + p + '%)'; } } } } },
      plugins: DL()
    });
  }
  function barras(id, labels, data, color, horizontal) {
    var c = ctx(id); if (!c) return;
    charts[id] = new Chart(c, {
      type: 'bar', data: { labels: labels, datasets: [{ data: data, backgroundColor: color || NAVY, borderRadius: 4 }] },
      options: { indexAxis: horizontal ? 'y' : 'x', responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, datalabels: { anchor: 'end', align: horizontal ? 'right' : 'top', color: '#0a1c4d', font: { weight: 'bold', size: 10 }, formatter: function (v) { return v || ''; } } },
        scales: { x: { grid: { display: horizontal } , ticks: { font: { size: 10 } } }, y: { grid: { display: !horizontal }, ticks: { font: { size: 10 } }, beginAtZero: true } } },
      plugins: DL()
    });
  }
  function conteo(items, fn) { var m = {}; items.forEach(function (c) { var k = fn(c) || '(s/d)'; m[k] = (m[k] || 0) + 1; }); return m; }
  function ordenado(m) { return Object.keys(m).sort(function (a, b) { return m[b] - m[a]; }); }

  function render() {
    if (!window.Chart) return;
    destroy();
    var items = aplicar();
    var total = items.length;
    var personal = F.empresa ? (DATA.personal[F.empresa] || 0) : DATA.personal.total;
    var dias = items.reduce(function (s, c) { return s + diasPerdidos(c); }, 0);
    var hht = personal * HORAS_MES * mesesPeriodo();
    var IF = hht ? total * 200000 / hht : 0;
    var IG = hht ? dias * 200000 / hht : 0;
    var IA = IF * IG / 1000;
    var graves = items.filter(esGrave).length;

    document.getElementById('kaPersonal').textContent = (personal || 0).toLocaleString('es-PE');
    document.getElementById('kaDias').textContent = dias.toLocaleString('es-PE');
    document.getElementById('kaIF').textContent = IF.toFixed(2);
    document.getElementById('kaIG').textContent = IG.toFixed(2);
    document.getElementById('kaIA').textContent = IA.toFixed(2);
    document.getElementById('kaTotal').textContent = total;
    document.getElementById('kaTotalSub').textContent = graves + ' grave(s) · ' + items.filter(function (c) { return !esCerrado(c); }).length + ' en seguimiento';
    document.getElementById('bsdaUpd').innerHTML = 'Última actualización<br>' + new Date().toLocaleString('es-PE');
    document.getElementById('bsdaNota').textContent = 'Índices base 200 000 HH (R.M. 050-2013-TR). HHT estimadas = ' + (personal || 0).toLocaleString('es-PE') + ' trabajadores × ' + HORAS_MES + ' h/mes × ' + mesesPeriodo() + ' mes(es) = ' + hht.toLocaleString('es-PE') + ' HH. Días perdidos = descanso médico + días de restricción. "Grave" = más de 30 días perdidos o diagnóstico de fractura/amputación/mortal.';

    var byEmp = conteo(items, function (c) { return emp(c.empresa); });
    doughnut('caEmpresa', Object.keys(byEmp), Object.values(byEmp), Object.keys(byEmp).map(function (e) { return C_EMPRESA[e] || C_EMPRESA.OTRO; }));

    var byEst = conteo(items, function (c) { return txt(c.estado_caso); });
    doughnut('caEstado', Object.keys(byEst), Object.values(byEst), Object.keys(byEst).map(function (e) { return /reincorpor/i.test(e) && !/restric/i.test(e) ? GREEN : /restric|tratam/i.test(e) ? AMBER : RED; }));

    var byTipo = conteo(items, function (c) { return txt(c.tipo_accidente).toUpperCase(); });
    doughnut('caTipo', Object.keys(byTipo), Object.values(byTipo));

    // mes: accidentes (barras) + días perdidos (línea)
    var accM = MESES.map(function () { return 0; }), diaM = MESES.map(function () { return 0; });
    items.forEach(function (c) { var p = parseF(c.dia_accidente); if (!p) return; var i = parseInt(p.mes, 10) - 1; accM[i]++; diaM[i] += diasPerdidos(c); });
    charts['caMes'] = new Chart(ctx('caMes'), {
      type: 'bar', data: { labels: MESES, datasets: [
        { label: 'Accidentes', data: accM, backgroundColor: RED, borderRadius: 4, yAxisID: 'y' },
        { label: 'Días perdidos', data: diaM, type: 'line', borderColor: NAVY, backgroundColor: NAVY, tension: .3, yAxisID: 'y1', datalabels: { display: false } }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: legend(), datalabels: { anchor: 'end', align: 'top', color: '#0a1c4d', font: { weight: 'bold', size: 10 }, formatter: function (v) { return v || ''; } } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, y1: { position: 'right', beginAtZero: true, grid: { display: false } } } },
      plugins: DL()
    });

    // año (todo el histórico, respetando empresa)
    var anios = aniosUnicos();
    var porAnio = anios.map(function (a) { return DATA.casos.filter(function (c) { var p = parseF(c.dia_accidente); return p && p.anio === a && (!F.empresa || emp(c.empresa) === F.empresa); }).length; });
    barras('caAnio', anios, porAnio, NAVY, false);

    var byParte = conteo(items, function (c) { return txt(c.parte_cuerpo); }); var pO = ordenado(byParte).slice(0, 10);
    barras('caParte', pO, pO.map(function (k) { return byParte[k]; }), RED, true);

    var byFundo = conteo(items, function (c) { return txt(c.fundo); }); var fO = ordenado(byFundo).slice(0, 10);
    barras('caFundo', fO, fO.map(function (k) { return byFundo[k]; }), BLUE, true);

    var dow = DIAS.map(function () { return 0; });
    items.forEach(function (c) { var p = parseF(c.dia_accidente); if (p && p.dow != null) dow[p.dow]++; });
    barras('caDow', DIAS, dow, AMBER, false);

    // sexo × edad
    var rangos = ['18-25', '26-35', '36-45', '46-55', '56+', 's/d'];
    function rango(e) { e = num(e); if (!e) return 's/d'; return e <= 25 ? '18-25' : e <= 35 ? '26-35' : e <= 45 ? '36-45' : e <= 55 ? '46-55' : '56+'; }
    var sexos = ['M', 'F'];
    var dsS = sexos.map(function (sx, i) { return { label: sx === 'M' ? 'Masculino' : 'Femenino', backgroundColor: i ? '#db2777' : BLUE, borderRadius: 4,
      data: rangos.map(function (r) { return items.filter(function (c) { return txt(c.sexo).toUpperCase().charAt(0) === sx && rango(c.edad) === r; }).length; }) }; });
    charts['caEdad'] = new Chart(ctx('caEdad'), { type: 'bar', data: { labels: rangos, datasets: dsS },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: legend(), datalabels: { color: '#fff', font: { weight: 'bold', size: 10 }, formatter: function (v) { return v || ''; } } }, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } } } }, plugins: DL() });

    var bySeg = conteo(items, function (c) { return txt(c.seguro).toUpperCase(); });
    doughnut('caSeguro', Object.keys(bySeg), Object.values(bySeg));
  }

  /* ---------- sidebar ---------- */
  function opt(label, on, fn) { var b = document.createElement('button'); b.className = 'bsda-opt' + (on ? ' on' : ''); b.textContent = label; b.onclick = fn; return b; }
  function sidebar() {
    var e = document.getElementById('bsdaEmp'); e.innerHTML = '';
    ['', 'RAPEL', 'VERFRUT'].forEach(function (v) { e.appendChild(opt(v || 'Todas', F.empresa === v, function () { F.empresa = v; sidebar(); render(); })); });
    var a = document.getElementById('bsdaAnio'); a.innerHTML = '';
    [''].concat(aniosUnicos()).forEach(function (v) { a.appendChild(opt(v || 'Todos', F.anio === v, function () { F.anio = v; sidebar(); render(); })); });
    var m = document.getElementById('bsdaMes'); m.innerHTML = '';
    m.appendChild(opt('Todos los meses', Object.keys(F.meses).length === 0, function () { F.meses = {}; sidebar(); render(); }));
    MESES.forEach(function (nm, i) { var mm = ('0' + (i + 1)).slice(-2); m.appendChild(opt(nm, !!F.meses[mm], function () { if (F.meses[mm]) delete F.meses[mm]; else F.meses[mm] = true; sidebar(); render(); })); });
  }

  /* ---------- carga de datos reales ---------- */
  function cargar() {
    var load = document.getElementById('bsdaLoad');
    if (load) { load.style.display = 'flex'; load.textContent = 'Cargando datos…'; }
    Promise.all([
      api('bs_listarAccidentes', {}).catch(function () { return { ok: false }; }),
      api('bs_clasificacion', {}).catch(function () { return { ok: false }; })
    ]).then(function (res) {
      var rA = res[0], rC = res[1];
      DATA.casos = (rA && rA.ok && rA.items) ? rA.items.filter(function (c) { return !/^(s|si|sí|true|1)$/i.test(String(c.anulado || '')); }) : [];
      if (rC && rC.ok) {
        function sumEmp(o) { if (!o) return 0; return (o.prueba || 0) + (o.plazoFijo || 0) + (o.indeterminado || 0); }
        DATA.personal.total = rC.total || 0;
        DATA.personal.RAPEL = rC.porEmpresa ? sumEmp(rC.porEmpresa.RAPEL) : 0;
        DATA.personal.VERFRUT = rC.porEmpresa ? sumEmp(rC.porEmpresa.VERFRUT) : 0;
      }
      if (!F.anio) { var hoy = String(new Date().getFullYear()); if (aniosUnicos().indexOf(hoy) >= 0) F.anio = hoy; }
      if (load) load.style.display = 'none';
      sidebar(); render();
    });
  }

  /* ---------- API pública ---------- */
  function abrir() {
    montar();
    document.getElementById('bsdaOverlay').classList.add('on');
    document.body.style.overflow = 'hidden';
    ensureLibs(function () { cargar(); });
  }
  function cerrar() {
    var ov = document.getElementById('bsdaOverlay');
    if (ov) ov.classList.remove('on');
    document.body.style.overflow = '';
    destroy();
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { var ov = document.getElementById('bsdaOverlay'); if (ov && ov.classList.contains('on')) cerrar(); } });

  return { abrir: abrir, cerrar: cerrar };
})();
