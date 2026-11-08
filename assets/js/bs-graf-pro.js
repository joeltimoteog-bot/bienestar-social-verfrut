/* _BS_GRAF_PRO_V1 (07-nov-2026) — helpers de gráficos (Chart.js + datalabels) para Panel, Estadísticas y Auditoría.
   Misma paleta y reglas que bs-dash-pro.js: número y % en todas las piezas. */
(function () {
  'use strict';
  if (window.BSGraf) return;
  var NAVY = '#0f2748', RED = '#c8102e', BLUE = '#2563eb', GRN = '#16a34a', AMB = '#d97706', GRY = '#94a3b8', VIO = '#7c3aed', TEAL = '#0d9488', ORA = '#e08a1e', SKY = '#0369a1';
  var PAL = [NAVY, RED, BLUE, GRN, AMB, VIO, TEAL, GRY, '#db2777', '#0891b2'];
  var MOD_COLOR = { quejas: ORA, accidentes: RED, hostigamiento: VIO, subsidios: TEAL, descansos: SKY, documentos: '#334155' };
  function n0(v) { return (Number(v) || 0).toLocaleString('es-PE'); }
  function soles(v) { return 'S/ ' + (Number(v) || 0).toLocaleString('es-PE', { maximumFractionDigits: 0 }); }
  function pct(a, b) { return b ? Math.round(a * 100 / b) : 0; }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var libsP = null;
  function libs() {
    if (libsP) return libsP;
    libsP = new Promise(function (ok) {
      function dl() { if (window.ChartDataLabels) return ok(true); var s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0'; s.onload = function () { ok(true); }; s.onerror = function () { ok(true); }; document.head.appendChild(s); }
      if (window.Chart) return dl();
      var s1 = document.createElement('script'); s1.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js'; s1.onload = dl; s1.onerror = function () { ok(false); }; document.head.appendChild(s1);
    });
    return libsP;
  }
  function base() { return { responsive: true, maintainAspectRatio: false, animation: { duration: 250 }, plugins: { legend: { position: 'bottom', labels: { boxWidth: 9, boxHeight: 9, font: { size: 10.5, weight: '600' }, padding: 10 } } } }; }
  function DL() { return window.ChartDataLabels ? [window.ChartDataLabels] : []; }
  function vacio(b, msg) { b.innerHTML = '<div class="vacio">' + esc(msg || 'Sin datos para los filtros actuales') + '</div>'; }
  function lienzo(b) { b.innerHTML = ''; var cv = document.createElement('canvas'); b.appendChild(cv); return cv; }
  function dona(b, g) {
    var tot = g.data.reduce(function (a, x) { return a + x; }, 0); if (!tot) return vacio(b), null;
    var cv = lienzo(b), centro = g.centro || { v: n0(tot), l: g.unidad || 'total' };
    b.insertAdjacentHTML('beforeend', '<div class="dn"><b>' + esc(centro.v) + '</b><span>' + esc(centro.l) + '</span></div>');
    var o = base(); o.cutout = '64%'; o.plugins.datalabels = { color: '#fff', font: { weight: '800', size: 10.5 }, textAlign: 'center', display: function (c) { return c.dataset.data[c.dataIndex] * 100 / tot >= 4; }, formatter: function (v) { var t = n0(v); return (t.length > 5 ? '' : t + '\n') + pct(v, tot) + '%'; } };
    return new Chart(cv, { type: 'doughnut', data: { labels: g.labels, datasets: [{ data: g.data, backgroundColor: g.colores || PAL, borderWidth: 2, borderColor: '#fff' }] }, options: o, plugins: DL() });
  }
  function barras(b, g, horiz, fmt) {
    var tot = 0; g.series.forEach(function (s) { s.data.forEach(function (v) { tot += v || 0; }); }); if (!tot) return vacio(b), null;
    var cv = lienzo(b), apil = g.series.length > 1 && g.apiladas !== false, f = fmt || n0;
    var ds = g.series.map(function (s, i) { return { label: s.label, data: s.data, backgroundColor: s.color || PAL[i % PAL.length], borderRadius: 3, barThickness: horiz ? 14 : undefined, maxBarThickness: 34 }; });
    var dl = horiz ? { anchor: 'end', align: 'right', color: '#0f172a', font: { weight: '800', size: 10.5 }, formatter: function (v) { return v ? f(v) : ''; }, clamp: true }
      : apil ? { display: function (c) { return c.datasetIndex === ds.length - 1; }, anchor: 'end', align: 'top', color: '#0f172a', font: { weight: '800', size: 10.5 }, formatter: function (v, c) { var s = 0; c.chart.data.datasets.forEach(function (d) { s += d.data[c.dataIndex] || 0; }); return s ? f(s) : ''; } }
      : { anchor: 'end', align: 'top', color: '#0f172a', font: { weight: '800', size: 10.5 }, formatter: function (v) { return v ? f(v) : ''; } };
    var o = base(); o.indexAxis = horiz ? 'y' : 'x'; o.layout = { padding: { top: horiz ? 0 : 24, right: horiz ? 44 : 0 } };
    o.scales = { x: { stacked: apil, grid: { display: horiz, color: '#eef2f7' }, ticks: horiz ? { font: { size: 10.5 }, precision: 0, callback: function (v) { return f(v); } } : { font: { size: 10.5 } } },
                 y: { stacked: apil, grid: { display: !horiz, color: '#eef2f7' }, ticks: !horiz ? { font: { size: 10.5 }, precision: 0, callback: function (v) { return f(v); } } : { font: { size: 10.5 } } } };
    o.plugins.legend.display = ds.length > 1; o.plugins.datalabels = dl;
    return new Chart(cv, { type: 'bar', data: { labels: g.labels, datasets: ds }, options: o, plugins: DL() });
  }
  function lineas(b, g, fmt) {
    var tot = 0; g.series.forEach(function (s) { s.data.forEach(function (v) { tot += v || 0; }); }); if (!tot) return vacio(b), null;
    var cv = lienzo(b), f = fmt || n0, o = base(); o.layout = { padding: { top: 14 } };
    o.scales = { x: { grid: { display: false } }, y: { grid: { color: '#eef2f7' }, ticks: { precision: 0 } } };
    o.plugins.legend.display = g.series.length > 1; o.plugins.datalabels = { align: 'top', color: '#0f172a', font: { weight: '800', size: 9.5 }, display: function (c) { return g.series.length === 1 || c.datasetIndex === 0; }, formatter: function (v) { return v ? f(v) : ''; } };
    return new Chart(cv, { type: 'line', data: { labels: g.labels, datasets: g.series.map(function (s, i) { return { label: s.label, data: s.data, borderColor: s.color || PAL[i], backgroundColor: s.color || PAL[i], tension: .3, pointRadius: 3, fill: false }; }) }, options: o, plugins: DL() });
  }
  function ranking(b, g, fmt) {
    var f = fmt || n0; if (!g.labels.length) return vacio(b);
    var max = Math.max.apply(null, g.data) || 1;
    b.innerHTML = '<div class="bsp-rk">' + g.labels.map(function (l, i) { return '<div><span class="n">' + (i + 1) + '</span><span class="t" title="' + esc(l) + '">' + esc(l) + '</span><span class="p"><i style="width:' + Math.round(g.data[i] / max * 100) + '%;background:' + (g.colores ? g.colores[i] : (i < 3 ? RED : NAVY)) + '"></i></span><span class="q">' + f(g.data[i]) + '</span></div>'; }).join('') + '</div>';
    b.style.height = 'auto';
  }
  window.BSGraf = { libs: libs, dona: dona, barras: barras, lineas: lineas, ranking: ranking, vacio: vacio, n0: n0, soles: soles, pct: pct, esc: esc, PAL: PAL, C: { NAVY: NAVY, RED: RED, BLUE: BLUE, GRN: GRN, AMB: AMB, GRY: GRY, VIO: VIO, TEAL: TEAL, ORA: ORA, SKY: SKY }, MOD_COLOR: MOD_COLOR };
})();
