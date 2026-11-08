/* ═══════════════════════════════════════════════════════════════════════════
   _BS_DASH_PRO_V1 (07-nov-2026) — Dashboards de indicadores · Bienestar Social
   Un solo motor para Hallazgos, Accidentes, Hostigamiento y Subsidios.
   · Datos: primero lo que la página ya tiene en caché (abre al instante), luego se refresca con
     api() (lectura rápida de Supabase). Hostigamiento lee de la Edge Function (bs/tabla).
     Personal activo: Edge bs/padron (Supabase, con caché de 6 h); si falla, bs_clasificacion.
   · Cálculos corregidos respecto a los dashboards anteriores:
       - se excluyen los registros anulados en todos los módulos;
       - los registros sin fecha se cuentan y se avisan (antes desaparecían en silencio);
       - el comparativo mensual ya no mezcla años: sin año elegido se muestra por año;
       - la tasa indica contra qué personal se calcula.
   · Indicadores de gestión nuevos: vencidos / por vencer, antigüedad de abiertos, variación vs. año anterior.
   · Reemplaza BSDashQuejas / BSDashAccidentes / BSDashHostigamiento / BSDashSubsidios (misma API abrir/cerrar),
     así los botones existentes no cambian. Reversible: quitar el <script> y vuelven los dashboards anteriores.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._BS_DASH_PRO_V1) return; window._BS_DASH_PRO_V1 = true;

  var NAVY = '#0f2748', RED = '#c8102e', BLUE = '#2563eb', GRN = '#16a34a', AMB = '#d97706', GRY = '#94a3b8', VIO = '#7c3aed', TEAL = '#0d9488';
  var PAL = [NAVY, RED, BLUE, GRN, AMB, VIO, TEAL, GRY, '#db2777', '#0891b2'];
  var C_EMP = { RAPEL: NAVY, VERFRUT: RED, BOMAREA: TEAL, OLMOS: TEAL, OTRO: GRY };
  var MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  var EDGE = 'https://exdjzbfinppzatjyimxn.supabase.co/functions/v1/api';
  var DEFS = {}, EST = {};   /* EST[key] = { ov, charts, F, data, personal, cargando } */

  /* ── utilidades ─────────────────────────────────────────────────────── */
  function txt(v) { return String(v == null ? '' : v).trim(); }
  function up(v) { return txt(v).toUpperCase(); }
  function esc(t) { return txt(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function n0(v) { return (Number(v) || 0).toLocaleString('es-PE'); }
  function soles(v) { return 'S/ ' + (Number(v) || 0).toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
  function pct(a, b) { return b ? Math.round(a * 100 / b) : 0; }
  function num(v) { var n = parseFloat(String(v == null ? '' : v).replace(/[^\d.\-]/g, '')); return isNaN(n) ? 0 : n; }
  function esAnulado(o) { var a = o && o.anulado; return a === true || /^(s|si|sí|true|1)$/i.test(txt(a)); }
  function emp(v) { var s = up(v); return s.indexOf('VERFRUT') >= 0 ? 'VERFRUT' : s.indexOf('RAPEL') >= 0 ? 'RAPEL' : (s.indexOf('BOMAREA') >= 0 || s.indexOf('OLMOS') >= 0) ? 'BOMAREA' : (s ? s : 'OTRO'); }
  function ymd(v) {
    if (!v) return '';
    if (v instanceof Date) return isNaN(v) ? '' : v.getFullYear() + '-' + ('0' + (v.getMonth() + 1)).slice(-2) + '-' + ('0' + v.getDate()).slice(-2);
    var s = txt(v), m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
    m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/); if (m) { var y = +m[3]; if (y < 100) y += 2000; return y + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2); }
    var d = new Date(s); return isNaN(d) ? '' : ymd(d);
  }
  function hoyYMD() { return ymd(new Date()); }
  function dias(a, b) { var A = ymd(a), B = ymd(b); if (!A || !B) return null; var d = Math.round((new Date(B + 'T12:00:00') - new Date(A + 'T12:00:00')) / 86400000); return isNaN(d) ? null : d; }
  function mesNum(m) {
    var s = up(m); if (!s) return 0; var n = parseInt(s, 10); if (n >= 1 && n <= 12) return n;
    var L = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']; if (s.indexOf('SET') === 0) return 9;
    for (var i = 0; i < 12; i++) if (s.indexOf(L[i]) === 0) return i + 1; return 0;
  }
  function conteo(items, fn) { var o = {}; items.forEach(function (it) { var k = txt(fn(it)) || '(sin dato)'; o[k] = (o[k] || 0) + 1; }); return o; }
  function ordenado(o, max) { var ks = Object.keys(o).sort(function (a, b) { return o[b] - o[a]; }); if (max) ks = ks.slice(0, max); return { labels: ks, data: ks.map(function (k) { return o[k]; }) }; }
  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function rlToken() { try { return (JSON.parse(localStorage.getItem('bienestarSocialAuth') || '{}') || {}).rl_token || ''; } catch (e) { return ''; } }

  /* ── librería de gráficos (se precarga al entrar al módulo) ────────── */
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

  /* ── personal activo (Supabase; caché 6 h) ─────────────────────────── */
  var personalP = null;
  function personal() {
    if (personalP) return personalP;
    var c = lsGet('bsdp_padron_v1');
    if (c && c.t && Date.now() - c.t < 6 * 3600e3 && c.total) return (personalP = Promise.resolve(c));
    personalP = (async function () {
      var out = null;
      try {
        var tk = rlToken();
        if (tk) {
          var ctl = new AbortController(), t = setTimeout(function () { ctl.abort(); }, 7000);
          var r = await fetch(EDGE + '/bs/padron', { headers: { Authorization: 'Bearer ' + tk }, signal: ctl.signal }); clearTimeout(t);
          var j = await r.json();
          if (j && j.ok && j.total) {
            out = { total: j.total, RAPEL: (j.porEmpresa.RAPEL || {}).total || 0, VERFRUT: (j.porEmpresa.VERFRUT || {}).total || 0, BOMAREA: (j.porEmpresa.OLMOS || {}).total || 0, fuente: 'Padrón RR.LL. (Supabase)', t: Date.now() };
          }
        }
      } catch (e) {}
      if (!out && typeof window.api === 'function') {
        try {
          var rC = await window.api('bs_clasificacion', {});
          if (rC && rC.ok) { var s = function (o) { return o ? (o.prueba || 0) + (o.plazoFijo || 0) + (o.indeterminado || 0) : 0; }; out = { total: rC.total || 0, RAPEL: rC.porEmpresa ? s(rC.porEmpresa.RAPEL) : 0, VERFRUT: rC.porEmpresa ? s(rC.porEmpresa.VERFRUT) : 0, BOMAREA: 0, fuente: 'Padrón (Google)', t: Date.now() }; }
        } catch (e) {}
      }
      if (out) lsSet('bsdp_padron_v1', out); else { out = c || { total: 0, RAPEL: 0, VERFRUT: 0, BOMAREA: 0, fuente: 'sin dato', t: 0 }; personalP = null; }   /* sin dato: se reintenta en la próxima apertura */
      return out;
    })();
    return personalP;
  }

  /* ── datos por módulo ──────────────────────────────────────────────── */
  async function tablaEdge(clave) {
    var tk = rlToken(); if (!tk) throw new Error('sin rl_token');
    var ctl = new AbortController(), t = setTimeout(function () { ctl.abort(); }, 8000);
    try {
      var r = await fetch(EDGE + '/bs/tabla?clave=' + encodeURIComponent(clave), { headers: { Authorization: 'Bearer ' + tk }, signal: ctl.signal });
      var j = await r.json(); if (!j || !j.success || !j.cargada) throw new Error('tabla no cargada'); return j.items || [];
    } finally { clearTimeout(t); }
  }

  /* ── shell ─────────────────────────────────────────────────────────── */
  function montar(key) {
    var S = EST[key]; if (S.ov) return S.ov;
    var D = DEFS[key];
    var ov = document.createElement('div'); ov.className = 'bsdp-ov'; ov.id = 'bsdp_' + key; ov.style.setProperty('--mod', D.color || RED);
    ov.innerHTML =
      '<div class="bsdp-bar"><div class="lg">U</div><div><small>Bienestar Social · ' + esc(D.titulo) + '</small><h1>Dashboard de indicadores</h1></div>' +
      '<div class="bsdp-f">' +
        '<select data-f="empresa"><option value="">Empresa: Todas</option></select>' +
        '<select data-f="anio"><option value="">Año: Todos</option></select>' +
        '<div class="bsdp-seg" data-f="tri"><button data-v="" class="on">Todo el año</button><button data-v="1">1T</button><button data-v="2">2T</button><button data-v="3">3T</button><button data-v="4">4T</button></div>' +
        '<select data-f="mes"><option value="">Mes: Todos</option>' + MESES.map(function (m, i) { return '<option value="' + (i + 1) + '">' + m + '</option>'; }).join('') + '</select>' +
        (D.filtroExtra ? '<select data-f="extra"><option value="">' + esc(D.filtroExtra.label) + ': Todos</option></select>' : '') +
      '</div>' +
      '<div class="bsdp-r"><button class="bsdp-btn" data-a="copiar">📄 Copiar resumen</button><button class="bsdp-btn d" data-a="pdf">⬇ PDF gerencial</button><button class="bsdp-x" data-a="cerrar" title="Cerrar (Esc)">✕</button></div></div>' +
      '<div class="bsdp-main"><div class="bsdp-load">Cargando datos…</div><div class="bsdp-nota" style="display:none"></div><div class="bsdp-k"></div><div class="bsdp-g"></div><div class="bsdp-ft"><span class="fu"></span><span class="ac"></span></div></div>';
    document.body.appendChild(ov);
    ov.querySelector('[data-a="cerrar"]').onclick = function () { cerrar(key); };
    ov.querySelector('[data-a="copiar"]').onclick = function () { copiar(key); };
    ov.querySelector('[data-a="pdf"]').onclick = function () { pdf(key); };
    ['empresa', 'anio', 'mes', 'extra'].forEach(function (f) { var s = ov.querySelector('select[data-f="' + f + '"]'); if (s) s.onchange = function () { S.F[f] = s.value; if (f === 'mes' && s.value) { S.F.tri = ''; pintarTri(key); } render(key); }; });
    Array.prototype.forEach.call(ov.querySelectorAll('[data-f="tri"] button'), function (b) { b.onclick = function () { S.F.tri = b.getAttribute('data-v'); if (S.F.tri) { S.F.mes = ''; ov.querySelector('select[data-f="mes"]').value = ''; } pintarTri(key); render(key); }; });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && ov.classList.contains('on')) cerrar(key); });
    S.ov = ov; return ov;
  }
  function pintarTri(key) { var S = EST[key]; Array.prototype.forEach.call(S.ov.querySelectorAll('[data-f="tri"] button'), function (b) { b.classList.toggle('on', b.getAttribute('data-v') === (S.F.tri || '')); }); }
  function llenarSelect(sel, valores, actual, pref) {
    if (!sel) return; var first = sel.options[0].outerHTML;
    sel.innerHTML = first + valores.map(function (v) { return '<option value="' + esc(v) + '">' + esc(pref ? pref + v : v) + '</option>'; }).join('');
    sel.value = valores.indexOf(actual) >= 0 ? actual : '';
  }

  /* ── contexto: filtra y prepara todo lo que las definiciones necesitan ── */
  function contexto(key) {
    var S = EST[key], D = DEFS[key], F = S.F;
    var todos = (S.data || []).filter(function (o) { return !esAnulado(o); });
    var base = todos.filter(function (o) { return !F.empresa || emp(D.empresa(o)) === F.empresa; });
    if (D.filtroExtra && F.extra) base = base.filter(function (o) { return txt(D.filtroExtra.valor(o)) === F.extra; });
    var conF = [], sinFecha = 0;
    base.forEach(function (o) { var p = D.periodo(o); if (p && p.anio) { o.__p = p; conF.push(o); } else sinFecha++; });
    function enPeriodo(o, anio) {
      var p = o.__p; if (anio && p.anio !== anio) return false;
      if (F.mes && p.mes !== +F.mes) return false;
      if (F.tri && Math.ceil(p.mes / 3) !== +F.tri) return false;
      return true;
    }
    var items = conF.filter(function (o) { return enPeriodo(o, F.anio); });
    var prev = F.anio ? conF.filter(function (o) { return enPeriodo(o, String(+F.anio - 1)); }) : [];
    var anios = {}; conF.forEach(function (o) { anios[o.__p.anio] = 1; });
    var per = S.personal || { total: 0 };
    var personalN = F.empresa ? (per[F.empresa] || 0) : per.total;
    return { D: D, F: F, todos: todos, base: base, conFecha: conF, items: items, prev: prev, sinFecha: sinFecha, anios: Object.keys(anios).sort(), personal: personalN, personalInfo: per, hoy: hoyYMD(),
      enPeriodo: enPeriodo, dias: dias, emp: emp, txt: txt, up: up, num: num, conteo: conteo, ordenado: ordenado, pct: pct, n0: n0, soles: soles, MESES: MESES, C_EMP: C_EMP, PAL: PAL,
      periodoTxt: (F.anio ? F.anio : 'todos los años') + (F.tri ? ' · ' + F.tri + 'T' : '') + (F.mes ? ' · ' + MESES[F.mes - 1] : '') };
  }

  /* ── gráficos ──────────────────────────────────────────────────────── */
  function destruir(key) { var S = EST[key]; Object.keys(S.charts).forEach(function (k) { try { S.charts[k].destroy(); } catch (e) {} }); S.charts = {}; }
  function baseOpt(extra) {
    var o = { responsive: true, maintainAspectRatio: false, animation: { duration: 250 }, plugins: { legend: { position: 'bottom', labels: { boxWidth: 9, boxHeight: 9, font: { size: 10.5, weight: '600' }, padding: 10 } }, tooltip: { enabled: true } } };
    return Object.assign(o, extra || {});
  }
  function DL() { return window.ChartDataLabels ? [window.ChartDataLabels] : []; }
  function vacio(b, msg) { b.innerHTML = '<div class="vacio">' + esc(msg || 'Sin datos para los filtros actuales') + '</div>'; }
  function dona(S, id, cv, g) {
    var tot = g.data.reduce(function (a, b) { return a + b; }, 0); if (!tot) return vacio(cv.parentNode);
    var centro = g.centro || { v: n0(tot), l: g.unidad || 'total' };
    cv.insertAdjacentHTML('afterend', '<div class="bsdp-dn"><b>' + esc(centro.v) + '</b><span>' + esc(centro.l) + '</span></div>');
    S.charts[id] = new Chart(cv, { type: 'doughnut', data: { labels: g.labels, datasets: [{ data: g.data, backgroundColor: g.colores || PAL, borderWidth: 2, borderColor: '#fff' }] },
      options: baseOpt({ cutout: '64%', plugins: { legend: baseOpt().plugins.legend, datalabels: { color: '#fff', font: { weight: '800', size: 10.5 }, textAlign: 'center', display: function (c) { return c.dataset.data[c.dataIndex] * 100 / tot >= 4; }, formatter: function (v) { var t = n0(v); return (t.length > 5 ? '' : t + '\n') + pct(v, tot) + '%'; } } } }), plugins: DL() });
  }
  function barras(S, id, cv, g, horiz, fmt) {
    var tot = 0; g.series.forEach(function (s) { s.data.forEach(function (v) { tot += v || 0; }); }); if (!tot) return vacio(cv.parentNode);
    var apil = g.series.length > 1 && g.apiladas !== false, f = fmt || n0;
    var ds = g.series.map(function (s, i) { return { label: s.label, data: s.data, backgroundColor: s.color || PAL[i % PAL.length], borderRadius: 3, barThickness: horiz ? 14 : undefined, maxBarThickness: 34 }; });
    var dl = horiz ? { anchor: 'end', align: 'right', color: '#0f172a', font: { weight: '800', size: 10.5 }, formatter: function (v) { return v ? f(v) : ''; }, clamp: true }
      : apil ? { display: function (c) { return c.datasetIndex === ds.length - 1; }, anchor: 'end', align: 'top', color: '#0f172a', font: { weight: '800', size: 10.5 }, formatter: function (v, c) { var s = 0; c.chart.data.datasets.forEach(function (d) { s += d.data[c.dataIndex] || 0; }); return s ? f(s) : ''; } }
      : { anchor: 'end', align: 'top', color: '#0f172a', font: { weight: '800', size: 10.5 }, formatter: function (v) { return v ? f(v) : ''; } };
    S.charts[id] = new Chart(cv, { type: 'bar', data: { labels: g.labels, datasets: ds },
      options: baseOpt({ indexAxis: horiz ? 'y' : 'x', layout: { padding: { top: horiz ? 0 : 24, right: horiz ? 44 : 0 } },
        scales: { x: { stacked: apil, grid: { display: horiz, color: '#eef2f7' }, ticks: horiz ? { font: { size: 10.5 }, precision: 0, callback: function (v) { return f(v); } } : { font: { size: 10.5 } } },
                  y: { stacked: apil, grid: { display: !horiz, color: '#eef2f7' }, ticks: !horiz ? { font: { size: 10.5 }, precision: 0, callback: function (v) { return f(v); } } : { font: { size: 10.5 } } } },
        plugins: { legend: Object.assign({}, baseOpt().plugins.legend, { display: ds.length > 1 }), datalabels: dl } }), plugins: DL() });
  }
  function lineas(S, id, cv, g, fmt) {
    var tot = 0; g.series.forEach(function (s) { s.data.forEach(function (v) { tot += v || 0; }); }); if (!tot) return vacio(cv.parentNode);
    var f = fmt || n0;
    S.charts[id] = new Chart(cv, { type: 'line', data: { labels: g.labels, datasets: g.series.map(function (s, i) { return { label: s.label, data: s.data, borderColor: s.color || PAL[i], backgroundColor: s.color || PAL[i], tension: .3, pointRadius: 3, fill: false }; }) },
      options: baseOpt({ layout: { padding: { top: 14 } }, scales: { x: { grid: { display: false } }, y: { grid: { color: '#eef2f7' }, ticks: { precision: 0 } } }, plugins: { legend: Object.assign({}, baseOpt().plugins.legend, { display: g.series.length > 1 }), datalabels: { align: 'top', color: '#0f172a', font: { weight: '800', size: 10 }, formatter: function (v) { return v ? f(v) : ''; } } } }), plugins: DL() });
  }
  function ranking(b, g, fmt) {
    var f = fmt || n0; if (!g.labels.length) return vacio(b);
    var max = Math.max.apply(null, g.data) || 1;
    b.innerHTML = '<div class="bsdp-rk">' + g.labels.map(function (l, i) { return '<div><span class="n">' + (i + 1) + '</span><span class="t" title="' + esc(l) + '">' + esc(l) + '</span><span class="p"><i style="width:' + Math.round(g.data[i] / max * 100) + '%;background:' + (g.colores ? g.colores[i] : (i < 3 ? RED : NAVY)) + '"></i></span><span class="q">' + f(g.data[i]) + '</span></div>'; }).join('') + '</div>';
    b.style.height = 'auto';
  }

  /* ── render ────────────────────────────────────────────────────────── */
  function render(key) {
    var S = EST[key], D = DEFS[key], ov = S.ov; if (!ov || !window.Chart) return;
    destruir(key);
    var C = contexto(key);
    /* selects con lo que hay en los datos */
    var emps = {}; C.todos.forEach(function (o) { emps[emp(D.empresa(o))] = 1; });
    llenarSelect(ov.querySelector('select[data-f="empresa"]'), Object.keys(emps).sort(), S.F.empresa, 'Empresa: ');
    llenarSelect(ov.querySelector('select[data-f="anio"]'), C.anios.slice().reverse(), S.F.anio, 'Año: ');
    if (D.filtroExtra) { var ex = {}; C.todos.forEach(function (o) { var v = txt(D.filtroExtra.valor(o)); if (v) ex[v] = 1; }); llenarSelect(ov.querySelector('select[data-f="extra"]'), Object.keys(ex).sort(), S.F.extra, D.filtroExtra.label + ': '); }
    /* KPIs */
    var kpis = []; try { kpis = D.kpis(C) || []; } catch (e) { console.warn('[_BS_DASH_PRO_V1] kpis', e); }
    ov.querySelector('.bsdp-k').innerHTML = kpis.map(function (k) { return '<div class="bsdp-kc" style="--c:' + (k.c || NAVY) + '"><div class="l">' + esc(k.l) + '</div><div class="v">' + esc(k.v) + '</div><div class="d">' + (k.d || '') + '</div></div>'; }).join('');
    S.kpis = kpis;
    /* nota de registros sin fecha */
    var nota = ov.querySelector('.bsdp-nota');
    if (C.sinFecha) { nota.style.display = ''; nota.textContent = '⚠️ ' + C.sinFecha + ' registro' + (C.sinFecha === 1 ? '' : 's') + ' sin fecha válida: se cuentan en el total general pero no entran en los gráficos por periodo. Revísalos en el módulo.'; } else nota.style.display = 'none';
    /* gráficos */
    var g = ov.querySelector('.bsdp-g'); g.innerHTML = '';
    var defs = []; try { defs = D.graficos(C) || []; } catch (e) { console.warn('[_BS_DASH_PRO_V1] graficos', e); }
    defs.forEach(function (gd, i) {
      if (!gd) return;
      var c = document.createElement('div'); c.className = 'bsdp-c ' + (gd.span || 's3') + (gd.alta ? ' alta' : '');
      c.innerHTML = '<div class="h"><b>' + esc(gd.titulo) + '</b><span>' + esc(gd.sub || '') + '</span></div><div class="b"></div>';
      g.appendChild(c); var b = c.querySelector('.b'); var id = key + '_g' + i;
      try {
        if (gd.tipo === 'ranking') { ranking(b, gd, gd.fmt); return; }
        var cv = document.createElement('canvas'); b.appendChild(cv);
        if (gd.tipo === 'dona') dona(S, id, cv, gd);
        else if (gd.tipo === 'barrasH') barras(S, id, cv, gd, true, gd.fmt);
        else if (gd.tipo === 'lineas') lineas(S, id, cv, gd, gd.fmt);
        else barras(S, id, cv, gd, false, gd.fmt);
      } catch (e) { console.warn('[_BS_DASH_PRO_V1] grafico ' + gd.titulo, e); vacio(b, 'No se pudo dibujar'); }
    });
    ov.querySelector('.bsdp-ft .fu').innerHTML = 'Fuente: <b>' + esc(S.origen || 'cargando…') + '</b> · ' + n0(C.todos.length) + ' registros válidos' + (S.data && S.data.length > C.todos.length ? ' (' + n0(S.data.length - C.todos.length) + ' anulados excluidos)' : '') + ' · Personal: <b>' + n0(C.personalInfo.total) + '</b> (' + esc(C.personalInfo.fuente || '') + ')';
    ov.querySelector('.bsdp-ft .ac').textContent = 'Periodo: ' + C.periodoTxt + ' · Actualizado: ' + new Date(S.t || Date.now()).toLocaleString('es-PE');
  }

  /* ── carga de datos ────────────────────────────────────────────────── */
  async function cargar(key) {
    var S = EST[key], D = DEFS[key], ov = S.ov, load = ov.querySelector('.bsdp-load');
    /* 1) caché de la página: abre al instante */
    if (!S.data || !S.data.length) { var c = D.cache ? lsGet(D.cache) : null; if (c && Array.isArray(c.items) && c.items.length) { S.data = c.items; S.origen = 'caché local'; S.t = c.t || Date.now(); } }
    var ok = await libs();
    if (!ok) { load.textContent = 'No se pudo cargar la librería de gráficos. Verifica tu conexión.'; return; }
    S.personal = await Promise.race([personal(), new Promise(function (r) { setTimeout(function () { r(S.personal || { total: 0, fuente: 'cargando' }); }, 1500); })]);
    anioPorDefecto(key);
    if (S.data && S.data.length) { load.style.display = 'none'; render(key); } else load.textContent = 'Cargando datos desde Supabase…';
    /* 2) datos frescos */
    if (S.cargando) return; S.cargando = true;
    try {
      var r = await D.cargar();
      if (r && r.items && r.items.length) { S.data = r.items; S.origen = r.origen || 'Supabase'; S.t = Date.now(); }
      S.personal = await personal(); anioPorDefecto(key);
      load.style.display = 'none'; render(key);
    } catch (e) { console.warn('[_BS_DASH_PRO_V1] cargar', e); load.style.display = S.data && S.data.length ? 'none' : 'flex'; if (!(S.data && S.data.length)) load.textContent = 'No se pudieron cargar los datos: ' + (e && e.message); }
    finally { S.cargando = false; }
  }

  /* al abrir por primera vez: el año actual, si hay datos de ese año (si no, todos) */
  function anioPorDefecto(key) {
    var S = EST[key]; if (S._anioAuto || !S.data || !S.data.length) return;
    var y = String(new Date().getFullYear()), hay = false; S.data.some(function (o) { if (esAnulado(o)) return false; var p = DEFS[key].periodo(o); if (p && p.anio === y) { hay = true; return true; } return false; });
    S._anioAuto = true; if (hay) { S.F.anio = y; var sel = S.ov && S.ov.querySelector('select[data-f="anio"]'); if (sel) sel.value = y; }
  }
  /* ── acciones ──────────────────────────────────────────────────────── */
  function copiar(key) {
    var S = EST[key], D = DEFS[key], C = contexto(key);
    var L = ['📊 ' + D.titulo.toUpperCase() + ' · INDICADORES', 'Periodo: ' + C.periodoTxt + (S.F.empresa ? ' · ' + S.F.empresa : ' · todas las empresas'), ''];
    (S.kpis || []).forEach(function (k) { L.push('• ' + k.l + ': ' + k.v + (k.d ? ' (' + k.d.replace(/<[^>]+>/g, '') + ')' : '')); });
    L.push('', 'Fuente: ' + (S.origen || 'Supabase') + ' · ' + new Date().toLocaleString('es-PE'));
    var t = L.join('\n');
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { aviso('Resumen copiado'); }, function () { window.prompt('Copia el resumen:', t); });
  }
  function aviso(m) { if (window.mostrarToast) return mostrarToast(m); if (window.showToast) return showToast(m); console.log(m); }
  function pdf(key) {
    var S = EST[key], D = DEFS[key], ov = S.ov, C = contexto(key);
    if (!window.BSPdfGerencial || !BSPdfGerencial.exportar) { window.print(); return; }
    var graficos = [], tablas = [];
    Array.prototype.forEach.call(ov.querySelectorAll('.bsdp-c'), function (c) { var t = txt(c.querySelector('.h b')), cv = c.querySelector('canvas'); if (cv) graficos.push({ titulo: t, canvas: cv }); });
    var filtros = [['Empresa', S.F.empresa || 'Todas'], ['Periodo', C.periodoTxt]]; if (D.filtroExtra && S.F.extra) filtros.push([D.filtroExtra.label, S.F.extra]);
    BSPdfGerencial.exportar({ titulo: D.titulo + ' · Dashboard de indicadores', subtitulo: 'Fuente: ' + (S.origen || 'Supabase') + ' · ' + new Date().toLocaleString('es-PE'), filtros: filtros,
      kpis: (S.kpis || []).map(function (k) { return [k.l, k.v, (k.d || '').replace(/<[^>]+>/g, '')]; }), graficos: graficos, tablas: tablas, notas: C.sinFecha ? [C.sinFecha + ' registros sin fecha no entran en los gráficos por periodo'] : [], archivo: 'Dashboard_' + D.titulo.replace(/\s+/g, '_') });
  }
  function abrir(key) {
    var ov = montar(key); ov.classList.add('on'); document.body.style.overflow = 'hidden';
    cargar(key);
  }
  function cerrar(key) { var S = EST[key]; if (S.ov) S.ov.classList.remove('on'); document.body.style.overflow = ''; }
  function registrar(key, def) {
    DEFS[key] = def; if (!EST[key]) EST[key] = { ov: null, charts: {}, F: { empresa: '', anio: def.anioInicial || '', tri: '', mes: '', extra: '' }, data: [], kpis: [] };
    var api = { abrir: function () { abrir(key); }, cerrar: function () { cerrar(key); }, render: function () { render(key); }, _pro: true };
    window[def.global] = api;
    return api;
  }

  /* ── helpers compartidos por las definiciones ──────────────────────── */
  function porMesOAnio(C, grupoFn, grupos, colores, titulo, valorFn) {
    /* con año elegido: 12 meses; sin año: por año (no se mezclan años) */
    var v = valorFn || function () { return 1; };
    if (C.F.anio) {
      return { titulo: titulo + ' · ' + C.F.anio, sub: grupos.join(' · '), labels: MESES, series: grupos.map(function (gname, i) { return { label: gname, color: colores[i], data: MESES.map(function (_, mi) { var s = 0; C.items.forEach(function (o) { if (o.__p.mes === mi + 1 && grupoFn(o) === gname) s += v(o); }); return s; }) }; }) };
    }
    var anios = C.anios;
    return { titulo: titulo.replace(/ por mes( y| por)?/i, ' por año$1'), sub: grupos.join(' · '), labels: anios, series: grupos.map(function (gname, i) { return { label: gname, color: colores[i], data: anios.map(function (a) { var s = 0; C.items.forEach(function (o) { if (o.__p.anio === a && grupoFn(o) === gname) s += v(o); }); return s; }) }; }) };
  }
  function antiguedad(C, abiertos, fechaFn) {
    var r = { '0–7 días': 0, '8–14 días': 0, '15–30 días': 0, '31–60 días': 0, '+60 días': 0 };
    abiertos.forEach(function (o) { var d = dias(fechaFn(o), C.hoy); if (d === null || d < 0) return; if (d <= 7) r['0–7 días']++; else if (d <= 14) r['8–14 días']++; else if (d <= 30) r['15–30 días']++; else if (d <= 60) r['31–60 días']++; else r['+60 días']++; });
    return { labels: Object.keys(r), series: [{ label: 'Casos abiertos', color: AMB, data: Object.keys(r).map(function (k) { return r[k]; }) }] };
  }
  function variacion(act, prev, anio) { if (!anio || !prev) return ''; var d = act - prev, p = prev ? Math.round(d * 100 / prev) : 0; return (d >= 0 ? '<b class="' + (d > 0 ? 'm' : 'n') + '">▲ ' + p + '%</b>' : '<b>▼ ' + Math.abs(p) + '%</b>') + ' vs ' + (anio - 1) + ' (' + n0(prev) + ')'; }
  function porAnioEmp(C, titulo, valorFn) {
    var emps = Object.keys(C.conFecha.reduce(function (a, o) { a[emp(C.D.empresa(o))] = 1; return a; }, {})).sort();
    var v = valorFn || function () { return 1; };
    return { titulo: titulo, sub: C.anios.join(' · '), tipo: 'barras', apiladas: false, labels: C.anios, series: emps.map(function (e) { return { label: e, color: C_EMP[e] || GRY, data: C.anios.map(function (a) { var s = 0; C.conFecha.forEach(function (o) { if (o.__p.anio === a && emp(C.D.empresa(o)) === e) s += v(o); }); return s; }) }; }) };
  }
  function donaDe(C, titulo, fn, colores, max) { var o = C.conteo(C.items, fn), r = C.ordenado(o, max || 8); return { titulo: titulo, sub: n0(C.items.length) + ' casos', tipo: 'dona', labels: r.labels, data: r.data, colores: colores ? r.labels.map(function (l, i) { return typeof colores === 'function' ? colores(l, i) : colores[i % colores.length]; }) : PAL, unidad: 'casos' }; }

  /* ═══════════════ HALLAZGOS (quejas) ═══════════════ */
  registrar('quejas', {
    global: 'BSDashQuejas', titulo: 'Hallazgos y Sugerencias', color: '#e08a1e', cache: 'bs_cache_quejas_v1',
    cargar: async function () { var r = await window.api('bs_listarQuejas', {}); return { items: (r && r.ok && r.items) || [], origen: r && r.origen === 'supabase' ? 'Supabase' : 'Google Sheets' }; },
    empresa: function (q) { return q.empresa; },
    periodo: function (q) { var y = ymd(q.fecha_recepcion); return y ? { anio: y.slice(0, 4), mes: +y.slice(5, 7) } : null; },
    kpis: function (C) {
      var cerr = function (q) { return /cerrad|resuelt/i.test(txt(q.resultado)); };
      var ab = C.items.filter(function (q) { return !cerr(q); }), cerrados = C.items.length - ab.length;
      var venc = ab.filter(function (q) { var d = dias(q.fecha_recepcion, C.hoy); return d !== null && d > 14; }).length, porV = ab.filter(function (q) { var d = dias(q.fecha_recepcion, C.hoy); return d !== null && d > 7 && d <= 14; }).length;
      var lev = C.items.map(function (q) { return dias(q.fecha_recepcion, q.fecha_levantamiento_ac); }).filter(function (d) { return d !== null && d >= 0; });
      var prom = lev.length ? Math.round(lev.reduce(function (a, b) { return a + b; }, 0) / lev.length) : null;
      return [
        { l: 'Casos registrados', v: n0(C.items.length), d: variacion(C.items.length, C.prev.length, C.F.anio) || (C.sinFecha ? '+ ' + C.sinFecha + ' sin fecha' : 'en el periodo'), c: NAVY },
        { l: 'Personal activo', v: n0(C.personal), d: 'RAPEL ' + n0(C.personalInfo.RAPEL) + ' · VERFRUT ' + n0(C.personalInfo.VERFRUT), c: BLUE },
        { l: 'Tasa de casos', v: (C.personal ? (C.items.length / C.personal * 100).toFixed(2) : '0.00') + ' %', d: 'por cada 100 trabajadores del padrón actual', c: AMB },
        { l: 'Casos cerrados', v: pct(cerrados, C.items.length) + ' %', d: n0(cerrados) + ' de ' + n0(C.items.length) + (prom !== null ? ' · <b class="n">' + prom + ' días</b> prom. al levantamiento' : ''), c: GRN },
        { l: 'Vencidos (+14 días)', v: n0(venc), d: '<b class="m">' + pct(venc, ab.length) + '%</b> de ' + n0(ab.length) + ' abiertos · ' + n0(porV) + ' por vencer', c: RED }
      ];
    },
    graficos: function (C) {
      var cerr = function (q) { return /cerrad|resuelt/i.test(txt(q.resultado)); };
      var tipos = Object.keys(C.conteo(C.conFecha, function (q) { return q.clasificacion; }));
      var ab = C.items.filter(function (q) { return !cerr(q); });
      var G = [
        donaDe(C, 'Por tipo de caso', function (q) { return q.clasificacion; }),
        donaDe(C, 'Por empresa', function (q) { return emp(q.empresa); }, function (l) { return C_EMP[l] || GRY; }),
        donaDe(C, 'Estado de atención', function (q) { return txt(q.resultado) || '(sin estado)'; }, function (l) { return cerr({ resultado: l }) ? GRN : /proceso/i.test(l) ? AMB : /monitoreo/i.test(l) ? BLUE : GRY; }),
        donaDe(C, 'Canal de recepción', function (q) { return q.canal; })
      ];
      G[2].centro = { v: pct(C.items.length - ab.length, C.items.length) + ' %', l: 'cerrados' };
      var m = porMesOAnio(C, function (q) { return txt(q.clasificacion) || '(sin dato)'; }, tipos, PAL, 'Casos por mes y tipo'); m.tipo = 'barras'; m.span = 's8'; m.alta = true; G.push(m);
      var sec = C.ordenado(C.conteo(C.items, function (q) { return q.sector; }), 8); G.push({ titulo: 'Top 8 sectores', sub: 'casos', tipo: 'ranking', span: 's4', alta: true, labels: sec.labels, data: sec.data });
      var cat = C.ordenado(C.conteo(C.items, function (q) { return q.categoria; }), 10); G.push({ titulo: 'Por categoría', sub: 'casos', tipo: 'barrasH', span: 's6', labels: cat.labels, series: [{ label: 'Casos', color: NAVY, data: cat.data }] });
      var ant = antiguedad(C, ab, function (q) { return q.fecha_recepcion; }); ant.titulo = 'Casos abiertos por antigüedad'; ant.sub = n0(ab.length) + ' abiertos'; ant.tipo = 'barras'; ant.span = 's6'; G.push(ant);
      var pa = porAnioEmp(C, 'Comparativo por año y empresa'); pa.span = 's12'; G.push(pa);
      return G;
    }
  });

  /* ═══════════════ ACCIDENTES ═══════════════ */
  function diasDeTexto(v) {
    var s = txt(v); if (!s) return 0;
    var f = s.match(/\d{1,4}[\/\-.]\d{1,2}[\/\-.]\d{1,4}/g);
    if (f && f.length >= 2) { var d = dias(f[0], f[f.length - 1]); return d !== null && d >= 0 && d <= 366 ? d + 1 : 0; }
    if (f && f.length === 1) return 0;
    var n = s.match(/^\s*(\d{1,3})(\s*d[ií]as?)?\s*$/i); return n ? +n[1] : 0;
  }
  function diasPerdidos(c) { var dm = diasDeTexto(c.descanso_medico) || num(c.descanso_medico_dias), rest = diasDeTexto(c.dias_restriccion); if (!dm && c.dia_accidente && c.fecha_reincorporo) { var d = dias(c.dia_accidente, c.fecha_reincorporo); if (d && d > 0) dm = d; } return dm + rest; }
  registrar('accidentes', {
    global: 'BSDashAccidentes', titulo: 'Accidentes Laborales', color: '#dc2626', cache: 'bs_cache_accidentes_v4',
    cargar: async function () { var r = await window.api('bs_listarAccidentes', {}); return { items: (r && r.ok && r.items) || [], origen: r && r.origen === 'supabase' ? 'Supabase' : 'Google Sheets' }; },
    empresa: function (c) { return c.empresa; },
    periodo: function (c) { var y = ymd(c.dia_accidente); return y ? { anio: y.slice(0, 4), mes: +y.slice(5, 7) } : null; },
    kpis: function (C) {
      var cerr = function (c) { return /reincorpor|cerrad|finaliz|alta/i.test(txt(c.estado_caso)) && !/restric/i.test(txt(c.estado_caso)); };
      var ab = C.items.filter(function (c) { return !cerr(c); }), dp = 0; C.items.forEach(function (c) { dp += diasPerdidos(c); });
      var graves = C.items.filter(function (c) { return diasPerdidos(c) > 30 || /grave|mortal|fatal|amputa|fractura/i.test(txt(c.diagnostico) + ' ' + txt(c.tipo_accidente)); }).length;
      return [
        { l: 'Accidentes', v: n0(C.items.length), d: variacion(C.items.length, C.prev.length, C.F.anio) || 'en el periodo', c: RED },
        { l: 'Personal activo', v: n0(C.personal), d: 'RAPEL ' + n0(C.personalInfo.RAPEL) + ' · VERFRUT ' + n0(C.personalInfo.VERFRUT), c: BLUE },
        { l: 'Índice de frecuencia', v: (C.personal ? (C.items.length / C.personal * 100).toFixed(2) : '0.00'), d: 'accidentes por cada 100 trabajadores', c: AMB },
        { l: 'Días perdidos', v: n0(dp), d: 'descanso médico + restricción · <b class="n">' + (C.items.length ? (dp / C.items.length).toFixed(1) : 0) + '</b> por accidente', c: NAVY },
        { l: 'Casos abiertos', v: n0(ab.length), d: '<b class="m">' + n0(graves) + ' graves</b> · ' + pct(C.items.length - ab.length, C.items.length) + ' % cerrados', c: GRN }
      ];
    },
    graficos: function (C) {
      var cerr = function (c) { return /reincorpor|cerrad|finaliz|alta/i.test(txt(c.estado_caso)) && !/restric/i.test(txt(c.estado_caso)); };
      var ab = C.items.filter(function (c) { return !cerr(c); });
      var G = [
        donaDe(C, 'Por empresa', function (c) { return emp(c.empresa); }, function (l) { return C_EMP[l] || GRY; }),
        donaDe(C, 'Estado de los casos', function (c) { return txt(c.estado_caso) || '(sin estado)'; }, function (l) { return cerr({ estado_caso: l }) ? GRN : /restric/i.test(l) ? AMB : /tratam/i.test(l) ? BLUE : RED; }),
        donaDe(C, 'Por tipo de accidente', function (c) { return c.tipo_accidente; }),
        donaDe(C, 'Cobertura (seguro)', function (c) { return c.seguro; })
      ];
      var emps = Object.keys(C.conteo(C.conFecha, function (c) { return emp(c.empresa); })).sort();
      var m = porMesOAnio(C, function (c) { return emp(c.empresa); }, emps, emps.map(function (e) { return C_EMP[e] || GRY; }), 'Accidentes por mes'); m.tipo = 'barras'; m.span = 's8'; m.alta = true; G.push(m);
      var fu = C.ordenado(C.conteo(C.items, function (c) { return c.fundo; }), 8); G.push({ titulo: 'Top 8 sectores / fundos', sub: 'accidentes', tipo: 'ranking', span: 's4', alta: true, labels: fu.labels, data: fu.data });
      var dpm = porMesOAnio(C, function () { return 'Días perdidos'; }, ['Días perdidos'], [AMB], 'Días perdidos', diasPerdidos); dpm.tipo = 'barras'; dpm.span = 's6'; G.push(dpm);
      var pc = C.ordenado(C.conteo(C.items, function (c) { return c.parte_cuerpo; }), 10); G.push({ titulo: 'Parte del cuerpo afectada', sub: 'accidentes', tipo: 'barrasH', span: 's6', labels: pc.labels, series: [{ label: 'Accidentes', color: NAVY, data: pc.data }] });
      var DS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'], dsem = [0, 0, 0, 0, 0, 0, 0]; C.items.forEach(function (c) { var y = ymd(c.dia_accidente); if (!y) return; var d = new Date(y + 'T12:00:00').getDay(); dsem[(d + 6) % 7]++; });
      G.push({ titulo: 'Por día de la semana', sub: 'accidentes', tipo: 'barras', span: 's4', labels: DS, series: [{ label: 'Accidentes', color: NAVY, data: dsem }] });
      var R = ['18–25', '26–35', '36–45', '46–55', '56+', 's/d'], sx = { M: [0, 0, 0, 0, 0, 0], F: [0, 0, 0, 0, 0, 0] };
      C.items.forEach(function (c) { var e = num(c.edad), i = !e ? 5 : e <= 25 ? 0 : e <= 35 ? 1 : e <= 45 ? 2 : e <= 55 ? 3 : 4; var s = /^f/i.test(txt(c.sexo)) ? 'F' : 'M'; sx[s][i]++; });
      G.push({ titulo: 'Por sexo y rango de edad', sub: 'accidentes', tipo: 'barras', span: 's4', labels: R, series: [{ label: 'Hombres', color: NAVY, data: sx.M }, { label: 'Mujeres', color: RED, data: sx.F }] });
      var ant = antiguedad(C, ab, function (c) { return c.dia_accidente; }); ant.titulo = 'Casos abiertos por antigüedad'; ant.sub = n0(ab.length) + ' abiertos'; ant.tipo = 'barras'; ant.span = 's4'; G.push(ant);
      var pa = porAnioEmp(C, 'Comparativo por año y empresa'); pa.span = 's12'; G.push(pa);
      return G;
    }
  });

  /* ═══════════════ HOSTIGAMIENTO ═══════════════ */
  registrar('hostigamiento', {
    global: 'BSDashHostigamiento', titulo: 'Hostigamiento Sexual', color: '#7c3aed', cache: null,
    cargar: async function () {
      try { var a = await Promise.all([tablaEdge('bs_hostigamiento'), tablaEdge('bs_hostigamiento_olmos').catch(function () { return []; })]); var it = a[0].concat(a[1]); if (it.length) return { items: it, origen: 'Supabase' }; } catch (e) { console.warn('[_BS_DASH_PRO_V1] hostigamiento edge:', e && e.message); }
      var r = await window.api('bs_listarHostigamiento', {}); return { items: (r && r.ok && r.items) || [], origen: 'Google Sheets' };
    },
    empresa: function (d) { return d.empresa; },
    periodo: function (d) { var y = ymd(d.fecha_denuncia); return y ? { anio: y.slice(0, 4), mes: +y.slice(5, 7) } : null; },
    kpis: function (C) {
      var cerr = function (d) { return /resuel|archiv|sin lugar|cerrad/i.test(txt(d.status)); };
      var ab = C.items.filter(function (d) { return !cerr(d); }), med = C.items.filter(function (d) { var m = txt(d.medida_proteccion); return m && !/^(no|ninguna|-)$/i.test(m); }).length;
      var venc = ab.filter(function (d) { var x = dias(d.fecha_denuncia, C.hoy); return x !== null && x > 30; }).length;
      return [
        { l: 'Denuncias', v: n0(C.items.length), d: variacion(C.items.length, C.prev.length, C.F.anio) || 'en el periodo', c: VIO },
        { l: 'Personal activo', v: n0(C.personal), d: 'RAPEL ' + n0(C.personalInfo.RAPEL) + ' · VERFRUT ' + n0(C.personalInfo.VERFRUT), c: BLUE },
        { l: 'Tasa de denuncias', v: (C.personal ? (C.items.length / C.personal * 100).toFixed(2) : '0.00') + ' %', d: 'por cada 100 trabajadores', c: AMB },
        { l: 'Resueltas', v: pct(C.items.length - ab.length, C.items.length) + ' %', d: n0(C.items.length - ab.length) + ' de ' + n0(C.items.length) + ' · <b class="n">' + n0(med) + '</b> con medida de protección', c: GRN },
        { l: 'Abiertas +30 días', v: n0(venc), d: '<b class="m">' + pct(venc, ab.length) + '%</b> de ' + n0(ab.length) + ' abiertas (plazo legal de investigación: 30 días)', c: RED }
      ];
    },
    graficos: function (C) {
      var cerr = function (d) { return /resuel|archiv|sin lugar|cerrad/i.test(txt(d.status)); };
      var ab = C.items.filter(function (d) { return !cerr(d); });
      var G = [
        donaDe(C, 'Por empresa', function (d) { return emp(d.empresa); }, function (l) { return C_EMP[l] || GRY; }),
        donaDe(C, 'Estado de la denuncia', function (d) { return txt(d.status) || '(sin estado)'; }, function (l) { return cerr({ status: l }) ? GRN : /investig|proceso/i.test(l) ? AMB : RED; }),
        donaDe(C, 'Decisión', function (d) { return d.decision; }),
        donaDe(C, 'Medida de protección', function (d) { return d.medida_proteccion; })
      ];
      var emps = Object.keys(C.conteo(C.conFecha, function (d) { return emp(d.empresa); })).sort();
      var m = porMesOAnio(C, function (d) { return emp(d.empresa); }, emps, emps.map(function (e) { return C_EMP[e] || GRY; }), 'Denuncias por mes'); m.tipo = 'barras'; m.span = 's8'; m.alta = true; G.push(m);
      var fu = C.ordenado(C.conteo(C.items, function (d) { return d.fundo; }), 8); G.push({ titulo: 'Top 8 sectores / fundos', sub: 'denuncias', tipo: 'ranking', span: 's4', alta: true, labels: fu.labels, data: fu.data });
      var pu = C.ordenado(C.conteo(C.items, function (d) { return d.denunciado_puesto; }), 10); G.push({ titulo: 'Puesto del denunciado', sub: 'denuncias', tipo: 'barrasH', span: 's6', labels: pu.labels, series: [{ label: 'Denuncias', color: NAVY, data: pu.data }] });
      var ant = antiguedad(C, ab, function (d) { return d.fecha_denuncia; }); ant.titulo = 'Denuncias abiertas por antigüedad'; ant.sub = n0(ab.length) + ' abiertas'; ant.tipo = 'barras'; ant.span = 's6'; G.push(ant);
      var pa = porAnioEmp(C, 'Comparativo por año y empresa'); pa.span = 's12'; G.push(pa);
      return G;
    }
  });

  /* ═══════════════ SUBSIDIOS ═══════════════ */
  function montoSub(s) { var v = num(s.monto_total); if (!v) v = num(s.pago_empresa) + num(s.recuperado_essalud); if (!v) v = num(s.reembolso_por_mes); if (!v) v = num(s.calculo_por_dia) * (parseInt(s.dias, 10) || 0); return v; }
  function catSub(s) { var e = up(s.estado_general); if (e === 'COBRADO' || e === 'RECUPERADO') return 'Recuperado'; if (e === 'NO RECUPERABLE') return 'No recuperable'; return 'Pendiente'; }
  function conting(s) { var t = up(s.tipo); if (!t || /^\d+$/.test(t)) t = up(s.descripcion); if (/MATERN/.test(t)) return 'Maternidad'; if (/INCAP/.test(t)) return 'Incapacidad temporal'; if (/LACTAN/.test(t)) return 'Lactancia'; if (/SEPELIO/.test(t)) return 'Sepelio'; return t ? t.charAt(0) + t.slice(1).toLowerCase() : '(sin contingencia)'; }
  registrar('subsidios', {
    global: 'BSDashSubsidios', titulo: 'Subsidios', color: '#0f766e', cache: 'bs_cache_subsidios_v1',
    cargar: async function () { var r = await window.api('bs_listarSubsidios', {}); return { items: (r && r.ok && r.items) || [], origen: r && r.origen === 'supabase' ? 'Supabase' : 'Google Sheets' }; },
    empresa: function (s) { return s.empresa; },
    periodo: function (s) { var a = parseInt(s.anio, 10), m = mesNum(s.mes); if (a >= 2000 && m) return { anio: String(a), mes: m }; var y = ymd(s.inicio); return y ? { anio: y.slice(0, 4), mes: +y.slice(5, 7) } : (a >= 2000 ? { anio: String(a), mes: 1 } : null); },
    filtroExtra: { label: 'Contingencia', valor: conting },
    kpis: function (C) {
      var tot = 0, rec = 0, pen = 0, nor = 0, nRec = 0, nPen = 0; var ds = [];
      C.items.forEach(function (s) { var m = montoSub(s), c = catSub(s); tot += m; if (c === 'Recuperado') { rec += m; nRec++; var d = dias(s.termino || s.inicio, s.updated_at || ''); } else if (c === 'Pendiente') { pen += m; nPen++; } else nor += m; });
      var totM = 0; C.items.forEach(function (s) { totM += num(s.dias); });
      return [
        { l: 'Subsidios', v: n0(C.items.length), d: variacion(C.items.length, C.prev.length, C.F.anio) || 'en el periodo', c: TEAL },
        { l: 'Monto total', v: soles(tot), d: '<b class="n">' + n0(totM) + '</b> días subsidiados', c: NAVY },
        { l: 'Recuperado de EsSalud', v: soles(rec), d: '<b>' + pct(rec, tot) + '%</b> del monto · ' + n0(nRec) + ' expedientes', c: GRN },
        { l: 'Pendiente de recuperar', v: soles(pen), d: '<b class="m">' + pct(pen, tot) + '%</b> · ' + n0(nPen) + ' expedientes', c: AMB },
        { l: 'No recuperable', v: soles(nor), d: pct(nor, tot) + ' % del monto', c: RED }
      ];
    },
    graficos: function (C) {
      var G = [
        donaDe(C, 'Por contingencia', conting),
        donaDe(C, 'Por empresa', function (s) { return emp(s.empresa); }, function (l) { return C_EMP[l] || GRY; }),
        donaDe(C, 'Estado de recuperación', catSub, function (l) { return l === 'Recuperado' ? GRN : l === 'Pendiente' ? AMB : RED; }),
        (function () { var o = {}; C.items.forEach(function (s) { var k = catSub(s); o[k] = (o[k] || 0) + montoSub(s); }); var r = C.ordenado(o); return { titulo: 'Monto por estado', sub: soles(r.data.reduce(function (a, b) { return a + b; }, 0)), tipo: 'dona', labels: r.labels, data: r.data.map(Math.round), colores: r.labels.map(function (l) { return l === 'Recuperado' ? GRN : l === 'Pendiente' ? AMB : RED; }), centro: { v: soles(r.data.reduce(function (a, b) { return a + b; }, 0)), l: 'total' } }; })()
      ];
      var m = porMesOAnio(C, catSub, ['Recuperado', 'Pendiente', 'No recuperable'], [GRN, AMB, RED], 'Monto por mes y estado', montoSub); m.tipo = 'barras'; m.span = 's8'; m.alta = true; m.fmt = soles; m.series.forEach(function (s) { s.data = s.data.map(Math.round); }); G.push(m);
      var ct = {}; C.items.forEach(function (s) { var k = conting(s); ct[k] = (ct[k] || 0) + montoSub(s); }); var ctr = C.ordenado(ct, 8); G.push({ titulo: 'Monto por contingencia', sub: 'S/', tipo: 'ranking', span: 's4', alta: true, labels: ctr.labels, data: ctr.data.map(Math.round), fmt: soles });
      var n = porMesOAnio(C, function (s) { return emp(s.empresa); }, Object.keys(C.conteo(C.conFecha, function (s) { return emp(s.empresa); })).sort(), [NAVY, RED, TEAL], 'Cantidad de subsidios por mes'); n.tipo = 'barras'; n.span = 's6'; G.push(n);
      var ab = C.items.filter(function (s) { return catSub(s) === 'Pendiente'; });
      var ant = antiguedad(C, ab, function (s) { return s.termino || s.inicio; }); ant.titulo = 'Pendientes por antigüedad (desde el término)'; ant.sub = n0(ab.length) + ' pendientes'; ant.tipo = 'barras'; ant.span = 's6'; G.push(ant);
      var pa = porAnioEmp(C, 'Monto por año y empresa', montoSub); pa.span = 's12'; pa.fmt = soles; pa.series.forEach(function (s) { s.data = s.data.map(Math.round); }); G.push(pa);
      return G;
    }
  });

  /* precarga silenciosa de la librería y del padrón al entrar al módulo */
  function precargar() { try { libs(); personal(); } catch (e) {} }
  if ('requestIdleCallback' in window) requestIdleCallback(precargar, { timeout: 4000 }); else setTimeout(precargar, 2500);
  /* si un dashboard antiguo se carga despues (p.ej. accidentes lo incluye al final del body), se vuelve a instalar el nuevo */
  function reinstalar() { Object.keys(DEFS).forEach(function (k) { var g = DEFS[k].global; if (!window[g] || !window[g]._pro) registrar(k, DEFS[k]); }); }
  document.addEventListener('DOMContentLoaded', reinstalar); window.addEventListener('load', reinstalar); setTimeout(reinstalar, 1500);
  window.BSDashPro = { abrir: abrir, cerrar: cerrar, registrar: registrar, render: render };
  console.log('[_BS_DASH_PRO_V1] listo');
})();
