/* =========================================================================
 * BS-DASH-HOSTIGAMIENTO  ·  Dashboard del indicador: Hostigamiento Sexual
 * Bienestar Social · Unifrutti Group  ·  Ley N° 27942 / DS 014-2019-TR
 * -------------------------------------------------------------------------
 * Modal autónomo. Lee datos reales del backend via api() (global de
 * hostigamiento.html):
 *   - api('bs_listarHostigamiento', {}) -> denuncias
 *   - api('bs_clasificacion', {})       -> personal activo (total + empresa)
 * Carga Chart.js + datalabels bajo demanda (lazy). NO requiere cambios en GAS.
 *
 * CONFIDENCIALIDAD: los nombres nunca se muestran completos en los gráficos.
 *
 * USO (2 toques en hostigamiento.html):
 *   1) <script src="../assets/js/bs-dash-hostigamiento.js"></script>
 *   2) <button onclick="BSDashHostigamiento.abrir()">📊 Dashboard</button>
 * ========================================================================= */
window.BSDashHostigamiento = (function () {
  'use strict';

  var MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  var RED = '#E2001A', NAVY = '#1e3a8a', BLUE = '#3b5bdb';
  var VERDE = '#16a34a', AMBAR = '#d97706', GRIS = '#94a3b8';
  var PAL = [RED, NAVY, BLUE, VERDE, AMBAR, '#7c3aed', '#0891b2', '#db2777', '#65a30d', '#475569'];

  /* Plazo legal del procedimiento de investigación y sanción (DS 014-2019-TR) */
  var PLAZO_HABILES = 30;

  var DATA = { casos: [], personal: { total: 0, RAPEL: 0, VERFRUT: 0 } };
  var F = { empresa: '', anio: '', sede: '', meses: {} };
  var charts = {};
  var montado = false;

  /* ---------- utilidades ---------- */
  function parseF(v) {
    if (!v) return null;
    var s = String(v); var base = s.indexOf('T') >= 0 ? s.split('T')[0] : s; var p = base.split('-');
    if (p.length < 2 || !/^\d{4}$/.test(p[0])) {
      var d = new Date(v); if (isNaN(d.getTime())) return null;
      return { anio: String(d.getFullYear()), mes: ('0' + (d.getMonth() + 1)).slice(-2), dia: d.getDate(), d: d };
    }
    var dd = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2] || '1', 10));
    return { anio: p[0], mes: ('0' + parseInt(p[1], 10)).slice(-2), dia: parseInt(p[2] || '1', 10), d: dd };
  }
  function txt(v) { return String(v == null ? '' : v).trim(); }
  function up(v) { return txt(v).toUpperCase(); }
  function emp(v) { var s = up(v); return s.indexOf('VERFRUT') >= 0 ? 'VERFRUT' : (s.indexOf('RAPEL') >= 0 ? 'RAPEL' : 'OTRO'); }
  function esCerrado(st) { return /resuel|archiv|sin lugar|cerrad/i.test(txt(st)); }
  function tieneMedida(d) { return txt(d.medida_proteccion).length > 2; }
  /* Enmascara nombres: modo discreto permanente dentro del dashboard */
  function mask(t) { t = txt(t); if (!t) return '(s/d)'; return t.length <= 3 ? '***' : t.substring(0, 2) + '***'; }

  function diasCalendario(f) {
    if (!f || !f.d) return 0;
    return Math.max(0, Math.floor((new Date() - f.d) / 86400000));
  }
  function diasHabiles(f) {
    if (!f || !f.d) return 0;
    var ini = new Date(f.d.getFullYear(), f.d.getMonth(), f.d.getDate());
    var fin = new Date(); fin = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate());
    if (fin <= ini) return 0;
    var dias = Math.round((fin - ini) / 86400000);
    var semanas = Math.floor(dias / 7), resto = dias % 7, habiles = semanas * 5;
    var dow = ini.getDay();
    for (var i = 1; i <= resto; i++) { var d2 = (dow + i) % 7; if (d2 !== 0 && d2 !== 6) habiles++; }
    return habiles;
  }

  /* Normaliza la decisión final a las categorías del reporte corporativo */
  function normMedida(d) {
    var s = up(d.decision);
    if (!s) s = up(d.status);
    if (!s) return 'SIN MEDIDA REGISTRADA';
    if (/DESVINCUL|DESPIDO|CESE|BAJA/.test(s)) return 'DESVINCULACIÓN';
    if (/RENUNCIA/.test(s)) return 'RENUNCIA VOLUNTARIA';
    if (/SUSPEN/.test(s)) return 'SUSPENSIÓN';
    if (/LLAMAD|AMONEST|MEMORAND/.test(s)) return 'LLAMADO DE ATENCIÓN';
    if (/NO HUBO|NO SE ACREDIT|INFUNDAD|SIN LUGAR|DESESTIM|ARCHIV/.test(s)) return 'NO HUBO HOSTIGAMIENTO SEXUAL';
    if (/INVESTIG|PROCESO|TRÁMITE|TRAMITE|PENDIENTE/.test(s)) return 'EN INVESTIGACIÓN';
    return 'OTRAS MEDIDAS';
  }
  function colorMedida(k) {
    if (k === 'DESVINCULACIÓN') return RED;
    if (k === 'RENUNCIA VOLUNTARIA') return NAVY;
    if (k === 'SUSPENSIÓN') return BLUE;
    if (k === 'LLAMADO DE ATENCIÓN') return AMBAR;
    if (k === 'NO HUBO HOSTIGAMIENTO SEXUAL') return VERDE;
    if (k === 'EN INVESTIGACIÓN') return '#7c3aed';
    return GRIS;
  }

  function baseEmpresa() {
    return DATA.casos.filter(function (d) {
      if (d.anulado) return false;
      if (F.empresa && emp(d.empresa) !== F.empresa) return false;
      if (F.sede && up(d.fundo) !== F.sede) return false;
      return true;
    });
  }
  function aplicar() {
    return baseEmpresa().filter(function (d) {
      var p = parseF(d.fecha_denuncia); if (!p) return false;
      if (F.anio && p.anio !== F.anio) return false;
      var hayMes = Object.keys(F.meses).length > 0;
      if (hayMes && !F.meses[p.mes]) return false;
      return true;
    });
  }
  function aniosUnicos() {
    var set = {}; DATA.casos.forEach(function (d) { if (d.anulado) return; var p = parseF(d.fecha_denuncia); if (p) set[p.anio] = true; });
    return Object.keys(set).sort();
  }
  function sedesUnicas() {
    var set = {}; DATA.casos.forEach(function (d) { if (d.anulado) return; var s = up(d.fundo); if (s) set[s] = true; });
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

  /* ---------- estilos (una vez) ---------- */
  function inyectarEstilos() {
    if (document.getElementById('bsdh-css')) return;
    var st = document.createElement('style');
    st.id = 'bsdh-css';
    st.textContent =
      '.bsdh-ov{position:fixed;inset:0;z-index:9999;background:#eef1f6;display:none;flex-direction:column;font-family:Inter,system-ui,sans-serif;overflow:hidden;}' +
      '.bsdh-ov.on{display:flex;}' +
      '.bsdh-bar{display:flex;justify-content:space-between;align-items:center;background:#fff;border-bottom:1px solid #e2e8f0;padding:10px 16px;flex-wrap:wrap;gap:8px;}' +
      '.bsdh-bar .ti{display:flex;align-items:center;gap:12px;}' +
      '.bsdh-bar .logo{width:40px;height:40px;border-radius:8px;background:#E2001A;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;}' +
      '.bsdh-bar h1{margin:0;font-size:1rem;color:#E2001A;font-weight:800;line-height:1.1;}' +
      '.bsdh-bar p{margin:0;font-size:.7rem;color:#0a1c4d;font-weight:600;}' +
      '.bsdh-x{border:none;background:#0a1c4d;color:#fff;width:36px;height:36px;border-radius:8px;font-size:1.1rem;cursor:pointer;}' +
      '.bsdh-body{flex:1;display:flex;overflow:hidden;}' +
      '.bsdh-side{width:180px;flex-shrink:0;background:#fff;border-right:1px solid #e2e8f0;padding:12px;overflow-y:auto;}' +
      '.bsdh-side h4{margin:0 0 6px;font-size:.6rem;letter-spacing:.08em;text-transform:uppercase;color:#fff;background:#0a1c4d;padding:6px 10px;border-radius:6px;text-align:center;}' +
      '.bsdh-grp{margin-bottom:14px;}' +
      '.bsdh-opt{display:block;width:100%;text-align:left;border:1px solid #e2e8f0;background:#fff;color:#334155;padding:6px 10px;border-radius:6px;margin-bottom:4px;cursor:pointer;font:600 12px Inter;transition:.12s;}' +
      '.bsdh-opt:hover{border-color:#0a1c4d;}' +
      '.bsdh-opt.on{background:#0a1c4d;color:#fff;border-color:#0a1c4d;}' +
      '.bsdh-main{flex:1;padding:14px 16px;overflow-y:auto;}' +
      '.bsdh-conf{background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:10px;padding:7px 12px;font-size:.68rem;font-weight:700;margin-bottom:10px;}' +
      '.bsdh-alert{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;border-radius:10px;padding:8px 12px;font-size:.72rem;font-weight:800;margin-bottom:10px;display:none;}' +
      '.bsdh-hero{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:12px;}' +
      '.bsdh-hc{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;display:flex;align-items:center;gap:12px;box-shadow:0 1px 3px rgba(0,0,0,.04);}' +
      '.bsdh-hc .ic{font-size:1.5rem;}.bsdh-hc .big{font-size:1.45rem;font-weight:800;color:#0a1c4d;line-height:1;}' +
      '.bsdh-hc .lbl{font-size:.58rem;letter-spacing:.05em;text-transform:uppercase;color:#64748b;margin-top:3px;}' +
      '.bsdh-hc.new{border-color:#c7d2fe;}' +
      '.bsdh-grid{display:grid;grid-template-columns:repeat(12,1fr);gap:12px;}' +
      '.bsdh-c{background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.04);display:flex;flex-direction:column;}' +
      '.bsdh-c .h{background:#0a1c4d;color:#fff;font-size:.64rem;letter-spacing:.04em;text-transform:uppercase;font-weight:700;padding:7px 10px;text-align:center;}' +
      '.bsdh-c .h .tag{background:#22c55e;color:#052e16;border-radius:999px;padding:1px 6px;font-size:.55rem;margin-left:6px;}' +
      '.bsdh-c .b{padding:10px;flex:1;position:relative;height:210px;}' +
      '.bsdh-tot{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;}' +
      '.bsdh-tot .n{font-size:3rem;font-weight:800;color:#0a1c4d;line-height:1;}' +
      '.bsdh-tot .t{font-size:.66rem;color:#64748b;text-transform:uppercase;letter-spacing:.05em;text-align:center;margin-top:6px;}' +
      '.bsdh-load{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#64748b;font-weight:600;background:#eef1f6;z-index:5;}' +
      '.bsdh-empty{display:flex;align-items:center;justify-content:center;height:100%;color:#94a3b8;font-size:.72rem;font-weight:600;text-align:center;}' +
      '.bsdh-c2{grid-column:span 2;}.bsdh-c3{grid-column:span 3;}.bsdh-c4{grid-column:span 4;}.bsdh-c5{grid-column:span 5;}.bsdh-c6{grid-column:span 6;}.bsdh-c7{grid-column:span 7;}.bsdh-c8{grid-column:span 8;}.bsdh-c12{grid-column:span 12;}' +
      '@media(max-width:1200px){.bsdh-hero{grid-template-columns:repeat(2,1fr);}}' +
      '@media(max-width:1100px){.bsdh-c3,.bsdh-c4{grid-column:span 6;}.bsdh-c5,.bsdh-c6,.bsdh-c7,.bsdh-c8{grid-column:span 12;}}';
    document.head.appendChild(st);
  }

  /* ---------- shell del modal (una vez) ---------- */
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
          '<p>DASHBOARD DEL INDICADOR · HOSTIGAMIENTO SEXUAL</p>' +
        '</div></div>' +
        '<div style="display:flex;align-items:center;gap:14px;">' +
          '<div id="bsdhUpd" style="font-size:.66rem;color:#64748b;text-align:right;"></div>' +
          '<button class="bsdh-x" onclick="BSDashHostigamiento.cerrar()">✕</button>' +
        '</div>' +
      '</div>' +
      '<div class="bsdh-body">' +
        '<aside class="bsdh-side">' +
          '<div class="bsdh-grp"><h4>Empresa</h4><div id="bsdhEmp"></div></div>' +
          '<div class="bsdh-grp"><h4>Sede / Fundo</h4><div id="bsdhSede"></div></div>' +
          '<div class="bsdh-grp"><h4>Año</h4><div id="bsdhAnio"></div></div>' +
          '<div class="bsdh-grp"><h4>Mes</h4><div id="bsdhMes"></div></div>' +
        '</aside>' +
        '<main class="bsdh-main" style="position:relative;">' +
          '<div class="bsdh-load" id="bsdhLoad">Cargando datos…</div>' +
          '<div class="bsdh-conf">🔐 Información confidencial · Ley N° 29733 y Ley N° 27942. Los nombres se muestran enmascarados en todo el tablero.</div>' +
          '<div class="bsdh-alert" id="bsdhAlerta"></div>' +
          '<div class="bsdh-hero">' +
            '<div class="bsdh-hc"><div class="ic">🔒</div><div><div class="big" id="hkTotal">—</div><div class="lbl">Denuncias registradas</div></div></div>' +
            '<div class="bsdh-hc new"><div class="ic">📈</div><div><div class="big" id="hkTasa">—</div><div class="lbl">Tasa × 1.000 trabajadores</div></div></div>' +
            '<div class="bsdh-hc"><div class="ic">✅</div><div><div class="big" id="hkCerrados">—</div><div class="lbl">% casos cerrados</div></div></div>' +
            '<div class="bsdh-hc new"><div class="ic">⏱️</div><div><div class="big" id="hkDias">—</div><div class="lbl">Días prom. casos abiertos</div></div></div>' +
            '<div class="bsdh-hc new"><div class="ic">🛡️</div><div><div class="big" id="hkMedida">—</div><div class="lbl">% con medida de protección</div></div></div>' +
          '</div>' +
          '<div class="bsdh-grid">' +
            '<div class="bsdh-c bsdh-c3"><div class="h">Total de denuncias</div><div class="b"><div class="bsdh-tot"><div class="n" id="hkTotal2">0</div><div class="t">Casos de hostigamiento<br>sexual registrados</div></div></div></div>' +
            '<div class="bsdh-c bsdh-c3"><div class="h">Casos por empresa</div><div class="b"><canvas id="hChEmpresa"></canvas></div></div>' +
            '<div class="bsdh-c bsdh-c3"><div class="h">Casos por sede</div><div class="b"><canvas id="hChSede"></canvas></div></div>' +
            '<div class="bsdh-c bsdh-c3"><div class="h">Estado de los casos</div><div class="b"><canvas id="hChEstado"></canvas></div></div>' +
            '<div class="bsdh-c bsdh-c7"><div class="h">Evolución mensual de denuncias por año</div><div class="b"><canvas id="hChMes"></canvas></div></div>' +
            '<div class="bsdh-c bsdh-c5"><div class="h">Distribución por medida o conclusión</div><div class="b"><canvas id="hChMedida"></canvas></div></div>' +
            '<div class="bsdh-c bsdh-c6"><div class="h">Cargos de los denunciados</div><div class="b"><canvas id="hChCargo"></canvas></div></div>' +
            '<div class="bsdh-c bsdh-c6"><div class="h">Casos por sede y año</div><div class="b"><canvas id="hChSedeAnio"></canvas></div></div>' +
            '<div class="bsdh-c bsdh-c6"><div class="h">Antigüedad de casos abiertos <span class="tag">NUEVO</span></div><div class="b"><canvas id="hChEdad"></canvas></div></div>' +
            '<div class="bsdh-c bsdh-c6"><div class="h">Denunciados con más de un caso <span class="tag">NUEVO</span></div><div class="b"><canvas id="hChReinc"></canvas><div class="bsdh-empty" id="hReincVacio" style="display:none;">Sin denunciados reincidentes en el periodo filtrado ✔</div></div></div>' +
          '</div>' +
        '</main>' +
      '</div>';
    document.body.appendChild(ov);
    montado = true;
  }

  /* ---------- helpers de charts ---------- */
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
          legend: { position: 'bottom', labels: { font: { size: 9 }, boxWidth: 10 } },
          datalabels: { color: '#fff', font: { weight: 'bold', size: 11 }, formatter: function (v) { if (!v) return ''; var p = tot ? Math.round(v * 100 / tot) : 0; return v + '\n' + p + '%'; } },
          tooltip: { callbacks: { label: function (x) { var p = tot ? Math.round(x.parsed * 100 / tot) : 0; return x.label + ': ' + x.parsed + ' (' + p + '%)'; } } }
        }
      }, plugins: DL()
    });
  }
  function barras(id, labels, data, color, horizontal) {
    var c = ctx(id); if (!c) return;
    charts[id] = new Chart(c, {
      type: 'bar',
      data: { labels: labels, datasets: [{ data: data, backgroundColor: color || NAVY, borderRadius: 4 }] },
      options: {
        indexAxis: horizontal ? 'y' : 'x', responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          datalabels: { anchor: 'end', align: horizontal ? 'right' : 'top', color: NAVY, font: { weight: 'bold', size: 10 }, formatter: function (v) { return v || ''; } }
        },
        scales: horizontal
          ? { x: { beginAtZero: true, ticks: { precision: 0 } }, y: { ticks: { font: { size: 9 } } } }
          : { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { ticks: { font: { size: 9 } } } }
      }, plugins: DL()
    });
  }

  /* ---------- render ---------- */
  function render() {
    if (!window.Chart) return;
    destroy();
    var items = aplicar();
    var total = items.length;

    /* --- KPIs --- */
    var personal = F.empresa ? (DATA.personal[F.empresa] || 0) : DATA.personal.total;
    var cerrados = items.filter(function (d) { return esCerrado(d.status); }).length;
    var abiertos = items.filter(function (d) { return !esCerrado(d.status); });
    var conMedida = items.filter(tieneMedida).length;
    var sumDias = 0;
    abiertos.forEach(function (d) { sumDias += diasCalendario(parseF(d.fecha_denuncia)); });
    var promDias = abiertos.length ? Math.round(sumDias / abiertos.length) : 0;
    var fueraPlazo = abiertos.filter(function (d) { return diasHabiles(parseF(d.fecha_denuncia)) > PLAZO_HABILES; });

    document.getElementById('hkTotal').textContent = total;
    document.getElementById('hkTotal2').textContent = total;
    document.getElementById('hkTasa').textContent = (personal ? (total / personal * 1000) : 0).toFixed(2);
    document.getElementById('hkCerrados').textContent = (total ? Math.round(cerrados * 100 / total) : 0) + ' %';
    document.getElementById('hkDias').textContent = abiertos.length ? promDias : '—';
    document.getElementById('hkMedida').textContent = (total ? Math.round(conMedida * 100 / total) : 0) + ' %';
    document.getElementById('bsdhUpd').innerHTML = 'Última actualización<br>' + new Date().toLocaleString('es-PE') +
      (personal ? '<br>Personal activo: ' + personal.toLocaleString('es-PE') : '');

    var al = document.getElementById('bsdhAlerta');
    if (fueraPlazo.length) {
      al.style.display = 'block';
      al.innerHTML = '⚠️ ' + fueraPlazo.length + ' caso(s) abierto(s) superan los ' + PLAZO_HABILES +
        ' días hábiles del procedimiento de investigación y sanción (DS 014-2019-TR). IDs: ' +
        fueraPlazo.map(function (d) { return '#' + d.id; }).join(', ');
    } else { al.style.display = 'none'; }

    /* --- empresa --- */
    var byEmp = {}; items.forEach(function (d) { var e = emp(d.empresa); byEmp[e] = (byEmp[e] || 0) + 1; });
    doughnut('hChEmpresa', Object.keys(byEmp), Object.values(byEmp),
      Object.keys(byEmp).map(function (e) { return e === 'RAPEL' ? NAVY : (e === 'VERFRUT' ? RED : GRIS); }));

    /* --- sede --- */
    var bySede = {}; items.forEach(function (d) { var s = up(d.fundo) || '(SIN SEDE)'; bySede[s] = (bySede[s] || 0) + 1; });
    var sedeO = Object.keys(bySede).sort(function (a, b) { return bySede[b] - bySede[a]; });
    doughnut('hChSede', sedeO, sedeO.map(function (k) { return bySede[k]; }));

    /* --- estado --- */
    var byEst = {}; items.forEach(function (d) { var e = txt(d.status) || '(s/d)'; byEst[e] = (byEst[e] || 0) + 1; });
    var estO = Object.keys(byEst);
    doughnut('hChEstado', estO, estO.map(function (k) { return byEst[k]; }),
      estO.map(function (e) { return esCerrado(e) ? VERDE : (/medida/i.test(e) ? BLUE : AMBAR); }));

    /* --- evolución mensual, una serie por año --- */
    var anios = F.anio ? [F.anio] : aniosUnicos();
    var baseMes = baseEmpresa();
    var dsM = anios.map(function (a, i) {
      return {
        label: a, borderColor: PAL[i % PAL.length], backgroundColor: PAL[i % PAL.length],
        tension: .35, fill: false, pointRadius: 3,
        data: MESES.map(function (_, mi) {
          var mm = ('0' + (mi + 1)).slice(-2);
          return baseMes.filter(function (d) { var p = parseF(d.fecha_denuncia); return p && p.anio === a && p.mes === mm; }).length;
        })
      };
    });
    charts['hChMes'] = new Chart(ctx('hChMes'), {
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

    /* --- medida o conclusión --- */
    var byMed = {}; items.forEach(function (d) { var k = normMedida(d); byMed[k] = (byMed[k] || 0) + 1; });
    var medO = Object.keys(byMed).sort(function (a, b) { return byMed[b] - byMed[a]; });
    doughnut('hChMedida', medO, medO.map(function (k) { return byMed[k]; }), medO.map(colorMedida));

    /* --- cargos de los denunciados --- */
    var byCargo = {}; items.forEach(function (d) { var c = up(d.denunciado_puesto) || '(SIN CARGO)'; byCargo[c] = (byCargo[c] || 0) + 1; });
    var cargoO = Object.keys(byCargo).sort(function (a, b) { return byCargo[b] - byCargo[a]; }).slice(0, 12);
    barras('hChCargo', cargoO, cargoO.map(function (k) { return byCargo[k]; }), BLUE, true);

    /* --- casos por sede y año (barras agrupadas) --- */
    var sedes = sedeO.slice(0, 8);
    var dsSA = anios.map(function (a, i) {
      return {
        label: a, backgroundColor: PAL[i % PAL.length], borderRadius: 4,
        data: sedes.map(function (s) {
          return baseMes.filter(function (d) {
            var p = parseF(d.fecha_denuncia);
            return p && p.anio === a && (up(d.fundo) || '(SIN SEDE)') === s;
          }).length;
        })
      };
    });
    charts['hChSedeAnio'] = new Chart(ctx('hChSedeAnio'), {
      type: 'bar', data: { labels: sedes, datasets: dsSA },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 10 } },
          datalabels: { anchor: 'end', align: 'top', color: '#475569', font: { weight: 'bold', size: 9 }, formatter: function (v) { return v || ''; } }
        },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { ticks: { font: { size: 9 } } } }
      }, plugins: DL()
    });

    /* --- NUEVO: antigüedad de casos abiertos --- */
    var buckets = { '0–15 días': 0, '16–30 días': 0, '31–60 días': 0, 'Más de 60 días': 0 };
    abiertos.forEach(function (d) {
      var n = diasCalendario(parseF(d.fecha_denuncia));
      if (n <= 15) buckets['0–15 días']++;
      else if (n <= 30) buckets['16–30 días']++;
      else if (n <= 60) buckets['31–60 días']++;
      else buckets['Más de 60 días']++;
    });
    var bk = Object.keys(buckets);
    charts['hChEdad'] = new Chart(ctx('hChEdad'), {
      type: 'bar',
      data: { labels: bk, datasets: [{ data: bk.map(function (k) { return buckets[k]; }), backgroundColor: [VERDE, '#84cc16', AMBAR, RED], borderRadius: 4 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          datalabels: { anchor: 'end', align: 'top', color: NAVY, font: { weight: 'bold', size: 11 }, formatter: function (v) { return v || ''; } },
          tooltip: { callbacks: { title: function (x) { return 'Casos abiertos · ' + x[0].label; } } }
        },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
      }, plugins: DL()
    });

    /* --- NUEVO: denunciados reincidentes (enmascarados) --- */
    var byDen = {};
    items.forEach(function (d) {
      var k = txt(d.denunciado_dni) || up(d.denunciado_nombre);
      if (!k) return;
      if (!byDen[k]) byDen[k] = { n: 0, et: mask(d.denunciado_nombre) + (txt(d.denunciado_puesto) ? ' · ' + up(d.denunciado_puesto) : '') };
      byDen[k].n++;
    });
    var reinc = Object.keys(byDen).filter(function (k) { return byDen[k].n > 1; })
      .sort(function (a, b) { return byDen[b].n - byDen[a].n; }).slice(0, 10);
    var vac = document.getElementById('hReincVacio');
    if (!reinc.length) {
      vac.style.display = 'flex';
    } else {
      vac.style.display = 'none';
      barras('hChReinc', reinc.map(function (k) { return byDen[k].et; }), reinc.map(function (k) { return byDen[k].n; }), RED, true);
    }
  }

  /* ---------- sidebar ---------- */
  function opt(label, on, fn) { var b = document.createElement('button'); b.className = 'bsdh-opt' + (on ? ' on' : ''); b.textContent = label; b.onclick = fn; return b; }
  function sidebar() {
    var e = document.getElementById('bsdhEmp'); e.innerHTML = '';
    ['', 'RAPEL', 'VERFRUT'].forEach(function (v) { e.appendChild(opt(v || 'Todas', F.empresa === v, function () { F.empresa = v; sidebar(); render(); })); });

    var s = document.getElementById('bsdhSede'); s.innerHTML = '';
    [''].concat(sedesUnicas()).forEach(function (v) { s.appendChild(opt(v || 'Todas', F.sede === v, function () { F.sede = v; sidebar(); render(); })); });

    var a = document.getElementById('bsdhAnio'); a.innerHTML = '';
    [''].concat(aniosUnicos()).forEach(function (v) { a.appendChild(opt(v || 'Todos', F.anio === v, function () { F.anio = v; sidebar(); render(); })); });

    var m = document.getElementById('bsdhMes'); m.innerHTML = '';
    m.appendChild(opt('Todos los meses', Object.keys(F.meses).length === 0, function () { F.meses = {}; sidebar(); render(); }));
    MESES.forEach(function (nm, i) {
      var mm = ('0' + (i + 1)).slice(-2);
      m.appendChild(opt(nm, !!F.meses[mm], function () { if (F.meses[mm]) delete F.meses[mm]; else F.meses[mm] = true; sidebar(); render(); }));
    });
  }

  /* ---------- carga de datos reales ---------- */
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

  return { abrir: abrir, cerrar: cerrar };
})();
