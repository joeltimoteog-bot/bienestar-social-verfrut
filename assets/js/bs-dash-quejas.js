/* =========================================================================
 * BS-DASH-QUEJAS  ·  Dashboard del indicador: Quejas, Reclamos y/o Sugerencias
 * Bienestar Social · Unifrutti Group
 * -------------------------------------------------------------------------
 * Modal autónomo. Lee datos reales del backend via api() (global de quejas.html):
 *   - api('bs_listarQuejas', {})  -> casos
 *   - api('bs_clasificacion', {}) -> personal activo (total + por empresa)
 * Carga Chart.js + datalabels bajo demanda (lazy). NO requiere cambios en GAS.
 *
 * USO (2 toques en quejas.html):
 *   1) <script src="../assets/js/bs-dash-quejas.js"></script>
 *   2) <button onclick="BSDashQuejas.abrir()">📊 Estadísticas</button>
 * ========================================================================= */
window.BSDashQuejas = (function () {
  'use strict';

  var MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  var RED = '#E2001A', NAVY = '#1e3a8a', BLUE = '#3b5bdb';
  var PAL = [RED, NAVY, BLUE, '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#db2777'];

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
      return { anio: String(d.getFullYear()), mes: ('0' + (d.getMonth() + 1)).slice(-2), dia: d.getDate() };
    }
    return { anio: p[0], mes: ('0' + parseInt(p[1], 10)).slice(-2), dia: parseInt(p[2] || '1', 10) };
  }
  function esCerrado(r) { return /cerrad|resuelt/i.test(String(r || '')); }
  function emp(v) { var s = String(v || '').toUpperCase(); return s.indexOf('VERFRUT') >= 0 ? 'VERFRUT' : (s.indexOf('RAPEL') >= 0 ? 'RAPEL' : 'OTRO'); }
  function txt(v) { return String(v == null ? '' : v).trim(); }

  function aplicar() {
    return DATA.casos.filter(function (q) {
      if (F.empresa && emp(q.empresa) !== F.empresa) return false;
      var p = parseF(q.fecha_recepcion); if (!p) return false;
      if (F.anio && p.anio !== F.anio) return false;
      var hayMes = Object.keys(F.meses).length > 0;
      if (hayMes && !F.meses[p.mes]) return false;
      return true;
    });
  }
  function tiposUnicos() {
    var set = {}; DATA.casos.forEach(function (q) { var t = txt(q.clasificacion) || '(s/d)'; set[t] = true; });
    var arr = Object.keys(set);
    return arr.length ? arr : ['Queja', 'Sugerencia'];
  }
  function aniosUnicos() {
    var set = {}; DATA.casos.forEach(function (q) { var p = parseF(q.fecha_recepcion); if (p) set[p.anio] = true; });
    return Object.keys(set).sort();
  }

  /* ---------- lazy load Chart.js ---------- */
  function ensureLibs(cb) {
    function loadDL() {
      if (window.ChartDataLabels) return cb();
      var s2 = document.createElement('script');
      s2.src = 'https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0';
      s2.onload = function () { cb(); };
      s2.onerror = function () { cb(); }; // sin datalabels igual pinta
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

  /* ---------- estilos (una vez) ---------- */
  function inyectarEstilos() {
    if (document.getElementById('bsdq-css')) return;
    var st = document.createElement('style');
    st.id = 'bsdq-css';
    st.textContent =
      '.bsdq-ov{position:fixed;inset:0;z-index:9999;background:#eef1f6;display:none;flex-direction:column;font-family:Inter,system-ui,sans-serif;overflow:hidden;}' +
      '.bsdq-ov.on{display:flex;}' +
      '.bsdq-bar{display:flex;justify-content:space-between;align-items:center;background:#fff;border-bottom:1px solid #e2e8f0;padding:10px 16px;flex-wrap:wrap;gap:8px;}' +
      '.bsdq-bar .ti{display:flex;align-items:center;gap:12px;}' +
      '.bsdq-bar .logo{width:40px;height:40px;border-radius:8px;background:#E2001A;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;}' +
      '.bsdq-bar h1{margin:0;font-size:1rem;color:#E2001A;font-weight:800;line-height:1.1;}' +
      '.bsdq-bar p{margin:0;font-size:.7rem;color:#0a1c4d;font-weight:600;}' +
      '.bsdq-x{border:none;background:#0a1c4d;color:#fff;width:36px;height:36px;border-radius:8px;font-size:1.1rem;cursor:pointer;}' +
      '.bsdq-body{flex:1;display:flex;overflow:hidden;}' +
      '.bsdq-side{width:180px;flex-shrink:0;background:#fff;border-right:1px solid #e2e8f0;padding:12px;overflow-y:auto;}' +
      '.bsdq-side h4{margin:0 0 6px;font-size:.6rem;letter-spacing:.08em;text-transform:uppercase;color:#fff;background:#0a1c4d;padding:6px 10px;border-radius:6px;text-align:center;}' +
      '.bsdq-grp{margin-bottom:14px;}' +
      '.bsdq-opt{display:block;width:100%;text-align:left;border:1px solid #e2e8f0;background:#fff;color:#334155;padding:6px 10px;border-radius:6px;margin-bottom:4px;cursor:pointer;font:600 12px Inter;transition:.12s;}' +
      '.bsdq-opt:hover{border-color:#0a1c4d;}' +
      '.bsdq-opt.on{background:#0a1c4d;color:#fff;border-color:#0a1c4d;}' +
      '.bsdq-main{flex:1;padding:14px 16px;overflow-y:auto;}' +
      '.bsdq-hero{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:12px;}' +
      '.bsdq-hc{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;display:flex;align-items:center;gap:14px;box-shadow:0 1px 3px rgba(0,0,0,.04);}' +
      '.bsdq-hc .ic{font-size:1.6rem;}.bsdq-hc .big{font-size:1.6rem;font-weight:800;color:#0a1c4d;line-height:1;}' +
      '.bsdq-hc .lbl{font-size:.6rem;letter-spacing:.06em;text-transform:uppercase;color:#64748b;margin-top:3px;}' +
      '.bsdq-grid{display:grid;grid-template-columns:repeat(12,1fr);gap:12px;}' +
      '.bsdq-c{background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.04);display:flex;flex-direction:column;}' +
      '.bsdq-c .h{background:#0a1c4d;color:#fff;font-size:.64rem;letter-spacing:.04em;text-transform:uppercase;font-weight:700;padding:7px 10px;text-align:center;}' +
      '.bsdq-c .b{padding:10px;flex:1;position:relative;height:200px;}' +
      '.bsdq-tot{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;}' +
      '.bsdq-tot .n{font-size:3rem;font-weight:800;color:#0a1c4d;line-height:1;}' +
      '.bsdq-tot .t{font-size:.66rem;color:#64748b;text-transform:uppercase;letter-spacing:.05em;text-align:center;margin-top:6px;}' +
      '.bsdq-load{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#64748b;font-weight:600;background:#eef1f6;z-index:5;}' +
      '.c2{grid-column:span 2;}.c3{grid-column:span 3;}.c5{grid-column:span 5;}.c6{grid-column:span 6;}.c7{grid-column:span 7;}' +
      '@media(max-width:1100px){.c3{grid-column:span 6;}.c5,.c6,.c7{grid-column:span 12;}.bsdq-hero{grid-template-columns:1fr;}}';
    document.head.appendChild(st);
  }

  /* ---------- shell del modal (una vez) ---------- */
  function montar() {
    if (montado) return;
    inyectarEstilos();
    var ov = document.createElement('div');
    ov.className = 'bsdq-ov';
    ov.id = 'bsdqOverlay';
    ov.innerHTML =
      '<div class="bsdq-bar">' +
        '<div class="ti"><div class="logo">U</div><div>' +
          '<h1>BIENESTAR SOCIAL</h1>' +
          '<p>DASHBOARD DEL INDICADOR · QUEJAS, RECLAMOS Y/O SUGERENCIAS</p>' +
        '</div></div>' +
        '<div style="display:flex;align-items:center;gap:14px;">' +
          '<div id="bsdqUpd" style="font-size:.66rem;color:#64748b;text-align:right;"></div>' +
          '<button class="bsdq-x" onclick="BSDashQuejas.cerrar()">✕</button>' +
        '</div>' +
      '</div>' +
      '<div class="bsdq-body">' +
        '<aside class="bsdq-side">' +
          '<div class="bsdq-grp"><h4>Empresa</h4><div id="bsdqEmp"></div></div>' +
          '<div class="bsdq-grp"><h4>Año</h4><div id="bsdqAnio"></div></div>' +
          '<div class="bsdq-grp"><h4>Mes</h4><div id="bsdqMes"></div></div>' +
        '</aside>' +
        '<main class="bsdq-main" style="position:relative;">' +
          '<div class="bsdq-load" id="bsdqLoad">Cargando datos…</div>' +
          '<div class="bsdq-hero">' +
            '<div class="bsdq-hc"><div class="ic">👥</div><div><div class="big" id="kPersonal">—</div><div class="lbl">Personal activo</div></div></div>' +
            '<div class="bsdq-hc"><div class="ic">📈</div><div><div class="big" id="kTasa">—</div><div class="lbl">Tasa de quejas</div></div></div>' +
            '<div class="bsdq-hc"><div class="ic">✅</div><div><div class="big" id="kCerrados">—</div><div class="lbl">% casos cerrados</div></div></div>' +
          '</div>' +
          '<div class="bsdq-grid">' +
            '<div class="bsdq-c c3"><div class="h">Total de casos</div><div class="b"><div class="bsdq-tot"><div class="n" id="kTotal">0</div><div class="t">Quejas, reclamos<br>y/o sugerencias</div></div></div></div>' +
            '<div class="bsdq-c c3"><div class="h">Total por tipo de caso</div><div class="b"><canvas id="chTipo"></canvas></div></div>' +
            '<div class="bsdq-c c3"><div class="h">Casos por año</div><div class="b"><canvas id="chAnio"></canvas></div></div>' +
            '<div class="bsdq-c c3"><div class="h">Casos por empresa</div><div class="b"><canvas id="chEmpresa"></canvas></div></div>' +
            '<div class="bsdq-c c3"><div class="h">% por canal de recepción</div><div class="b"><canvas id="chCanal"></canvas></div></div>' +
            '<div class="bsdq-c c3"><div class="h">Estado de atención de casos</div><div class="b"><canvas id="chEstado"></canvas></div></div>' +
            '<div class="bsdq-c c6"><div class="h">Casos por categoría</div><div class="b"><canvas id="chCategoria"></canvas></div></div>' +
            '<div class="bsdq-c c5"><div class="h">Casos por sector</div><div class="b"><canvas id="chSector"></canvas></div></div>' +
            '<div class="bsdq-c c7"><div class="h">Comparativo de casos por mes</div><div class="b"><canvas id="chMes"></canvas></div></div>' +
          '</div>' +
        '</main>' +
      '</div>';
    document.body.appendChild(ov);
    montado = true;
  }

  /* ---------- charts ---------- */
  function destroy() { Object.keys(charts).forEach(function (k) { if (charts[k]) { charts[k].destroy(); charts[k] = null; } }); }
  function ctx(id) { var el = document.getElementById(id); return el ? el.getContext('2d') : null; }

  function doughnut(id, labels, data, colors) {
    var c = ctx(id); if (!c) return;
    var tot = data.reduce(function (a, b) { return a + b; }, 0);
    charts[id] = new Chart(c, {
      type: 'doughnut',
      data: { labels: labels, datasets: [{ data: data, backgroundColor: colors || PAL, borderWidth: 2, borderColor: '#fff' }] },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '62%',
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 10 } },
          datalabels: { color: '#fff', font: { weight: 'bold', size: 11 }, formatter: function (v) { if (!v) return ''; var p = tot ? Math.round(v * 100 / tot) : 0; return v + '\n' + p + '%'; } },
          tooltip: { callbacks: { label: function (x) { var p = tot ? Math.round(x.parsed * 100 / tot) : 0; return x.label + ': ' + x.parsed + ' (' + p + '%)'; } } }
        }
      }, plugins: DL()
    });
  }

  function render() {
    if (!window.Chart) return;
    destroy();
    var items = aplicar();
    var TIPOS = tiposUnicos();

    var personal = F.empresa ? (DATA.personal[F.empresa] || 0) : DATA.personal.total;
    var total = items.length;
    var cerrados = items.filter(function (q) { return esCerrado(q.resultado); }).length;
    document.getElementById('kPersonal').textContent = (personal || 0).toLocaleString('es-PE');
    document.getElementById('kTotal').textContent = total;
    document.getElementById('kTasa').textContent = (personal ? (total / personal * 100) : 0).toFixed(2) + ' %';
    document.getElementById('kCerrados').textContent = (total ? Math.round(cerrados * 100 / total) : 0) + ' %';
    document.getElementById('bsdqUpd').innerHTML = 'Última actualización<br>' + new Date().toLocaleString('es-PE');

    // tipo
    var byTipo = {}; items.forEach(function (q) { var t = txt(q.clasificacion) || '(s/d)'; byTipo[t] = (byTipo[t] || 0) + 1; });
    doughnut('chTipo', Object.keys(byTipo), Object.values(byTipo));

    // por año apilado por tipo
    var anios = aniosUnicos();
    var dsA = TIPOS.map(function (t, i) {
      return { label: t, backgroundColor: PAL[i % PAL.length],
        data: anios.map(function (a) { return DATA.casos.filter(function (q) { var p = parseF(q.fecha_recepcion); return p && p.anio === a && txt(q.clasificacion) === t && (!F.empresa || emp(q.empresa) === F.empresa); }).length; }) };
    });
    charts['chAnio'] = new Chart(ctx('chAnio'), {
      type: 'bar', data: { labels: anios, datasets: dsA },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 10 } }, datalabels: { color: '#fff', font: { weight: 'bold', size: 10 }, formatter: function (v) { return v || ''; } } }, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } } } },
      plugins: DL()
    });

    // empresa
    var byEmp = {}; items.forEach(function (q) { var e = emp(q.empresa); byEmp[e] = (byEmp[e] || 0) + 1; });
    doughnut('chEmpresa', Object.keys(byEmp), Object.values(byEmp), Object.keys(byEmp).map(function (e) { return e === 'RAPEL' ? NAVY : (e === 'VERFRUT' ? RED : '#94a3b8'); }));

    // canal
    var byCanal = {}; items.forEach(function (q) { var c = txt(q.canal) || '(s/d)'; byCanal[c] = (byCanal[c] || 0) + 1; });
    doughnut('chCanal', Object.keys(byCanal), Object.values(byCanal));

    // estado
    var byEst = {}; items.forEach(function (q) { var e = txt(q.resultado) || '(s/d)'; byEst[e] = (byEst[e] || 0) + 1; });
    doughnut('chEstado', Object.keys(byEst), Object.values(byEst), Object.keys(byEst).map(function (e) { return esCerrado(e) ? '#16a34a' : RED; }));

    // categoría desc
    var byCat = {}; items.forEach(function (q) { var c = txt(q.categoria) || '(s/d)'; byCat[c] = (byCat[c] || 0) + 1; });
    var catO = Object.keys(byCat).sort(function (a, b) { return byCat[b] - byCat[a]; });
    charts['chCategoria'] = new Chart(ctx('chCategoria'), {
      type: 'bar', data: { labels: catO, datasets: [{ data: catO.map(function (k) { return byCat[k]; }), backgroundColor: NAVY }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, datalabels: { anchor: 'end', align: 'top', color: NAVY, font: { weight: 'bold', size: 11 }, formatter: function (v) { return v || ''; } } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } },
      plugins: DL()
    });

    // sector desc, color por empresa dominante
    var bySec = {}, secEmp = {};
    items.forEach(function (q) { var s = txt(q.sector) || '(s/d)'; bySec[s] = (bySec[s] || 0) + 1; secEmp[s] = secEmp[s] || { RAPEL: 0, VERFRUT: 0, OTRO: 0 }; secEmp[s][emp(q.empresa)]++; });
    var secO = Object.keys(bySec).sort(function (a, b) { return bySec[b] - bySec[a]; });
    charts['chSector'] = new Chart(ctx('chSector'), {
      type: 'bar', data: { labels: secO, datasets: [{ data: secO.map(function (k) { return bySec[k]; }), backgroundColor: secO.map(function (s) { return secEmp[s].VERFRUT > secEmp[s].RAPEL ? RED : NAVY; }) }] },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, datalabels: { anchor: 'end', align: 'right', color: NAVY, font: { weight: 'bold', size: 11 }, formatter: function (v) { return v || ''; } } }, scales: { x: { beginAtZero: true, ticks: { precision: 0 } } } },
      plugins: DL()
    });

    // comparativo mensual por tipo
    var dsM = TIPOS.map(function (t, i) {
      return { label: t, backgroundColor: PAL[i % PAL.length],
        data: MESES.map(function (_, mi) { var mm = ('0' + (mi + 1)).slice(-2); return items.filter(function (q) { var p = parseF(q.fecha_recepcion); return p && p.mes === mm && txt(q.clasificacion) === t; }).length; }) };
    });
    charts['chMes'] = new Chart(ctx('chMes'), {
      type: 'bar', data: { labels: MESES, datasets: dsM },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 10 } }, datalabels: { anchor: 'end', align: 'top', color: '#475569', font: { weight: 'bold', size: 9 }, formatter: function (v) { return v || ''; } } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } },
      plugins: DL()
    });
  }

  /* ---------- sidebar ---------- */
  function opt(label, on, fn) { var b = document.createElement('button'); b.className = 'bsdq-opt' + (on ? ' on' : ''); b.textContent = label; b.onclick = fn; return b; }
  function sidebar() {
    var e = document.getElementById('bsdqEmp'); e.innerHTML = '';
    ['', 'RAPEL', 'VERFRUT'].forEach(function (v) { e.appendChild(opt(v || 'Todas', F.empresa === v, function () { F.empresa = v; sidebar(); render(); })); });
    var a = document.getElementById('bsdqAnio'); a.innerHTML = '';
    var anios = [''].concat(aniosUnicos());
    anios.forEach(function (v) { a.appendChild(opt(v || 'Todos', F.anio === v, function () { F.anio = v; sidebar(); render(); })); });
    var m = document.getElementById('bsdqMes'); m.innerHTML = '';
    m.appendChild(opt('Todos los meses', Object.keys(F.meses).length === 0, function () { F.meses = {}; sidebar(); render(); }));
    MESES.forEach(function (nm, i) { var mm = ('0' + (i + 1)).slice(-2); m.appendChild(opt(nm, !!F.meses[mm], function () { if (F.meses[mm]) delete F.meses[mm]; else F.meses[mm] = true; sidebar(); render(); })); });
  }

  /* ---------- carga de datos reales ---------- */
  function cargar() {
    var load = document.getElementById('bsdqLoad');
    if (load) { load.style.display = 'flex'; load.textContent = 'Cargando datos…'; }
    Promise.all([
      api('bs_listarQuejas', {}).catch(function () { return { ok: false }; }),
      api('bs_clasificacion', {}).catch(function () { return { ok: false }; })
    ]).then(function (res) {
      var rQ = res[0], rC = res[1];
      DATA.casos = (rQ && rQ.ok && rQ.items) ? rQ.items : [];
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
    document.getElementById('bsdqOverlay').classList.add('on');
    document.body.style.overflow = 'hidden';
    ensureLibs(function () { cargar(); });
  }
  function cerrar() {
    var ov = document.getElementById('bsdqOverlay');
    if (ov) ov.classList.remove('on');
    document.body.style.overflow = '';
    destroy();
  }

  return { abrir: abrir, cerrar: cerrar };
})();
