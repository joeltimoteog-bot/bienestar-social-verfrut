/* ═══════════════════════════════════════════════════════════════════════════
   _BS_ESTAD_PRO_V1 (07-nov-2026) — Bienestar Social · Estadísticas empresariales (modulos/estadisticas.html)
   Informe ejecutivo calculado en el navegador con los datos de Supabase (BSDatos) y las reglas únicas de BSReglas:
   KPIs · cuadro de mando por módulo con semáforo · tendencia mensual · cumplimiento por módulo · empresa · estado
   general · gestión por responsable · Excel y PDF gerencial. Definiciones (se muestran en el pie):
     En plazo  = cerrados + abiertos que aún no vencen (regla de cada módulo) · Vencido = abierto fuera del plazo
     T. medio  = días desde el registro hasta el cierre, solo en los casos que tienen fecha de cierre
   Capa aditiva: oculta la vista anterior; quitar el <script> la devuelve.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._BS_ESTAD_PRO_V1) return; window._BS_ESTAD_PRO_V1 = true;
  var G = window.BSGraf, Rg = window.BSReglas, esc = G.esc, n0 = G.n0, soles = G.soles, pct = G.pct, C = G.C, MC = G.MOD_COLOR;
  var MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  var MODS = ['quejas', 'accidentes', 'hostigamiento', 'subsidios', 'descansos'];
  var TIT = { quejas: 'Hallazgos y sugerencias', accidentes: 'Accidentes laborales', hostigamiento: 'Hostigamiento sexual', subsidios: 'Subsidios', descansos: 'Descansos médicos' };
  var S = { D: null, F: { empresa: '', anio: '', tri: '' }, charts: {}, filas: [], K: [] };
  function cierreDe(mod, o) {
    if (mod === 'quejas') return Rg.ymd(o.fecha_levantamiento_ac);
    if (mod === 'accidentes') return Rg.ymd(o.fecha_reincorporo);
    if (mod === 'descansos') return Rg.R.descansos.cerrado(o) ? Rg.ymd(o.fecha_fin) : '';
    if (mod === 'subsidios') return Rg.catSub(o) !== 'Pendiente' ? (Rg.ymd(o.updated_at) || '') : '';
    return Rg.R[mod].cerrado(o) ? (Rg.ymd(o.updated_at) || '') : '';
  }
  function enPeriodo(mod, o) { var f = Rg.R[mod].fecha(o); if (!f) return false; if (S.F.anio && f.slice(0, 4) !== S.F.anio) return false; if (S.F.tri && Math.ceil(+f.slice(5, 7) / 3) !== +S.F.tri) return false; if (S.F.empresa && Rg.emp(o.empresa) !== S.F.empresa) return false; return true; }
  function enPeriodoPrev(mod, o) { var f = Rg.R[mod].fecha(o); if (!f || !S.F.anio) return false; if (f.slice(0, 4) !== String(+S.F.anio - 1)) return false; if (S.F.tri && Math.ceil(+f.slice(5, 7) / 3) !== +S.F.tri) return false; if (S.F.empresa && Rg.emp(o.empresa) !== S.F.empresa) return false; return true; }
  function evaluar(mod, items) {
    var h = Rg.hoy(), cer = 0, enPl = 0, venc = 0, porV = 0, tm = [], abiertos = 0;
    items.forEach(function (o) { var e = Rg.estado(mod, o, h); if (e.n === 'cerrado') { cer++; enPl++; var c = cierreDe(mod, o), d = c ? Rg.dias(Rg.R[mod].fecha(o), c) : null; if (d !== null && d >= 0 && d < 400) tm.push(d); } else { abiertos++; if (e.n === 'rojo') venc++; else { enPl++; if (e.n === 'ambar') porV++; } } });
    return { n: items.length, cer: cer, pctCer: pct(cer, items.length), enPl: enPl, pctPl: pct(enPl, items.length), venc: venc, porV: porV, abiertos: abiertos, tm: tm.length ? Math.round(tm.reduce(function (a, b) { return a + b; }, 0) / tm.length) : null, tmN: tm.length };
  }
  function semaforo(p, n) { if (!n) return ['#94a3b8', 'Sin casos']; return p >= 85 ? ['#16a34a', 'Óptimo'] : p >= 70 ? ['#d97706', 'Atención'] : ['#dc2626', 'Crítico']; }
  function variacion(act, prev) { if (!S.F.anio) return ['n', '—']; if (!prev) return act ? ['r', 'nuevo'] : ['n', '= 0']; var d = act - prev, p = Math.round(d * 100 / prev); return d > 0 ? ['r', '▲ ' + p + ' %'] : d < 0 ? ['ok', '▼ ' + Math.abs(p) + ' %'] : ['n', '= 0 %']; }

  function montar() {
    var main = document.querySelector('main.bs-main') || document.querySelector('main'); if (!main) return null;
    document.body.classList.add('bsp-pagina');
    ['#contenido', '#loading'].forEach(function (s) { var e = main.querySelector(s); if (e) e.style.display = 'none'; });
    Array.prototype.forEach.call(main.querySelectorAll(':scope > .bs-card'), function (c) { c.style.display = 'none'; });
    var root = document.createElement('div'); root.id = 'bsEst'; root.className = 'bsp';
    root.innerHTML =
      '<div class="bsp-hd" style="--c:#0f2748"><div><div class="cr">Portal › Estadísticas</div><h1>Informe empresarial de Bienestar Social</h1></div>' +
      '<div class="bsp-f"><select data-f="empresa"><option value="">Empresa: Todas</option><option value="RAPEL">Empresa: RAPEL</option><option value="VERFRUT">Empresa: VERFRUT</option></select><select data-f="anio"></select>' +
      '<div class="bsp-seg" data-f="tri"><button data-v="" class="on">Todo el año</button><button data-v="1">1T</button><button data-v="2">2T</button><button data-v="3">3T</button><button data-v="4">4T</button></div><span id="bsEstCmp" style="font-size:11.5px;color:#64748b;font-weight:600"></span></div>' +
      '<div class="bsp-acts"><button class="bsp-btn" data-a="xls">📊 Excel</button><button class="bsp-btn d" data-a="pdf">⬇ PDF gerencial</button></div></div>' +
      '<div class="bsp-nota" id="bsEstNota" style="display:none"></div>' +
      '<div class="bsp-k" id="bsEstK"><div class="bsp-load">Cargando datos desde Supabase…</div></div>' +
      '<div class="bsp-g">' +
        '<div class="bsp-c s12"><div class="h"><b>Cuadro de mando por módulo</b><span>semáforo por % en plazo: verde ≥ 85 % · ámbar 70–84 % · rojo &lt; 70 %</span></div><div id="bsEstCM" style="overflow:auto"></div></div>' +
        '<div class="bsp-c s8 alta"><div class="h"><b id="bsEstTT">Tendencia mensual por módulo</b><span>casos registrados</span></div><div class="b" id="bsEstT"></div></div>' +
        '<div class="bsp-c s4 alta"><div class="h"><b>Cumplimiento de plazos por módulo</b><span>% en plazo</span></div><div class="b" id="bsEstCu"></div></div>' +
        '<div class="bsp-c s4"><div class="h"><b>Casos por empresa y módulo</b><span id="bsEstP1"></span></div><div class="b" id="bsEstE"></div></div>' +
        '<div class="bsp-c s4"><div class="h"><b>Estado general de casos</b><span id="bsEstP2"></span></div><div class="b" id="bsEstEs"></div></div>' +
        '<div class="bsp-c s4"><div class="h"><b>Gestión por responsable</b><span>quien registró · casos en plazo</span></div><div id="bsEstR" style="overflow:auto"></div></div>' +
      '</div><div class="bsp-ft"><span id="bsEstFu"></span><span id="bsEstAc"></span></div>';
    var hero = main.querySelector('.bs-hero'); if (hero && hero.parentNode === main) main.insertBefore(root, hero.nextSibling); else main.insertBefore(root, main.firstChild);
    root.querySelector('select[data-f="empresa"]').onchange = function () { S.F.empresa = this.value; render(); };
    root.querySelector('select[data-f="anio"]').onchange = function () { S.F.anio = this.value; render(); };
    root.querySelectorAll('[data-f="tri"] button').forEach(function (b) { b.onclick = function () { S.F.tri = b.getAttribute('data-v'); root.querySelectorAll('[data-f="tri"] button').forEach(function (x) { x.classList.toggle('on', x === b); }); render(); }; });
    root.querySelector('[data-a="xls"]').onclick = excel; root.querySelector('[data-a="pdf"]').onclick = pdf;
    return root;
  }
  async function cargar() {
    var mods = MODS.filter(function (m) { return m !== 'hostigamiento' || BSDatos.puede('hostigamiento'); });
    var D = await BSDatos.cargar({ modulos: mods }); S.D = D;
    var anios = {}; mods.forEach(function (m) { (D[m] || []).forEach(function (o) { var f = Rg.R[m].fecha(o); if (f) anios[f.slice(0, 4)] = 1; }); });
    var ks = Object.keys(anios).sort().reverse(), y = String(new Date().getFullYear()); S.F.anio = ks.indexOf(y) >= 0 ? y : (ks[0] || '');
    var sel = document.querySelector('#bsEst select[data-f="anio"]'); sel.innerHTML = '<option value="">Año: Todos</option>' + ks.map(function (a) { return '<option value="' + a + '">Año: ' + a + '</option>'; }).join(''); sel.value = S.F.anio;
    var nota = document.getElementById('bsEstNota'); if (D.faltantes.length) { nota.style.display = ''; nota.textContent = '⚠️ No se pudieron cargar: ' + D.faltantes.join(', ') + '.'; } else nota.style.display = 'none';
    await G.libs(); render();
  }
  function render() {
    if (!S.D) return; var D = S.D, per = (S.F.anio || 'todos los años') + (S.F.tri ? ' · ' + S.F.tri + 'T' : ''), h = Rg.hoy();
    document.getElementById('bsEstCmp').textContent = S.F.anio ? 'Comparado con ' + (+S.F.anio - 1) : ''; document.getElementById('bsEstP1').textContent = per; document.getElementById('bsEstP2').textContent = per;
    var filas = [], totN = 0, totPl = 0, totV = 0, tmAll = [], tmN = 0, prevTot = 0, estado = { 'Cerrado / resuelto': 0, 'En plazo': 0, 'Por vencer': 0, 'Vencido': 0 };
    MODS.forEach(function (m) {
      if (!D[m]) { filas.push({ mod: m, lk: true }); return; }
      var it = D[m].filter(function (o) { return enPeriodo(m, o); }), pv = D[m].filter(function (o) { return enPeriodoPrev(m, o); }), e = evaluar(m, it);
      totN += e.n; totPl += e.enPl; totV += e.venc; if (e.tm !== null) { tmAll.push(e.tm * e.tmN); tmN += e.tmN; } prevTot += pv.length;
      it.forEach(function (o) { var x = Rg.estado(m, o, h); estado[x.n === 'cerrado' ? 'Cerrado / resuelto' : x.n === 'rojo' ? 'Vencido' : x.n === 'ambar' ? 'Por vencer' : 'En plazo']++; });
      filas.push({ mod: m, e: e, prev: pv.length, it: it });
    });
    S.filas = filas;
    var rec = 0, totS = 0, pen = 0; (D.subsidios || []).filter(function (o) { return enPeriodo('subsidios', o); }).forEach(function (s) { var m = Rg.montoSub(s); totS += m; var c = Rg.catSub(s); if (c === 'Recuperado') rec += m; else if (c === 'Pendiente') pen += m; });
    var tmG = tmN ? Math.round(tmAll.reduce(function (a, b) { return a + b; }, 0) / tmN) : null, vt = variacion(totN, prevTot);
    S.K = [
      { l: 'Casos atendidos', v: n0(totN), d: (S.F.anio ? '<b class="' + (vt[0] === 'r' ? 'm' : vt[0] === 'ok' ? '' : 'n') + '">' + vt[1] + '</b> vs ' + (+S.F.anio - 1) + ' (' + n0(prevTot) + ') · ' : '') + MODS.filter(function (m) { return D[m]; }).length + ' módulos', c: C.NAVY },
      { l: 'Cumplimiento de plazos', v: pct(totPl, totN) + ' %', d: n0(totPl) + ' en plazo · meta <b>85 %</b>', c: C.GRN },
      { l: 'Vencidos abiertos', v: n0(totV), d: '<b class="m">' + pct(totV, totN) + ' %</b> del total' + (filas.length ? ' · ' + n0(Math.max.apply(null, filas.map(function (f) { return f.e ? f.e.venc : 0; }))) + ' en ' + TIT[filas.slice().sort(function (a, b) { return (b.e ? b.e.venc : 0) - (a.e ? a.e.venc : 0); })[0].mod].split(' ')[0] : ''), c: C.RED },
      { l: 'Tiempo medio de atención', v: tmG !== null ? tmG + ' días' : '—', d: 'sobre ' + n0(tmN) + ' casos con fecha de cierre', c: C.AMB },
      { l: 'Recuperación EsSalud', v: soles(rec), d: '<b>' + pct(rec, totS) + ' %</b> del subsidiado · ' + soles(pen) + ' en gestión', c: C.TEAL }
    ];
    document.getElementById('bsEstK').innerHTML = S.K.map(function (k) { return '<div class="bsp-kc" style="--c:' + k.c + '"><div class="l">' + esc(k.l) + '</div><div class="v">' + esc(k.v) + '</div><div class="d">' + k.d + '</div></div>'; }).join('');
    /* cuadro de mando */
    document.getElementById('bsEstCM').innerHTML = '<table><thead><tr><th>Módulo</th><th>Casos</th><th>Cerrados</th><th>% cierre</th><th>En plazo</th><th>% en plazo</th><th>Vencidos</th><th>Por vencer</th><th>T. medio</th><th>' + (S.F.anio ? 'Vs ' + (+S.F.anio - 1) : 'Var.') + '</th><th>Semáforo</th></tr></thead><tbody>' +
      filas.map(function (f) { if (f.lk) return '<tr><td><b>' + esc(TIT[f.mod]) + '</b></td><td colspan="10" style="color:#94a3b8">🔒 sin permiso / no disponible</td></tr>'; var e = f.e, sm = semaforo(e.pctPl, e.n), v = variacion(e.n, f.prev); return '<tr><td><b>' + esc(TIT[f.mod]) + '</b></td><td>' + n0(e.n) + '</td><td>' + n0(e.cer) + '</td><td>' + e.pctCer + ' %</td><td>' + n0(e.enPl) + '</td><td><b>' + e.pctPl + ' %</b></td><td><span class="tag ' + (e.venc ? 'r' : 'ok') + '">' + n0(e.venc) + '</span></td><td><span class="tag ' + (e.porV ? 'a' : 'n') + '">' + n0(e.porV) + '</span></td><td>' + (e.tm !== null ? e.tm + ' d' : '—') + '</td><td><span class="tag ' + v[0] + '">' + v[1] + '</span></td><td><span class="bsp-sem" style="background:' + sm[0] + '"></span>' + sm[1] + '</td></tr>'; }).join('') + '</tbody></table>';
    /* gráficos */
    Object.keys(S.charts).forEach(function (k) { try { S.charts[k].destroy(); } catch (e) {} }); S.charts = {};
    if (window.Chart) {
      var ok = filas.filter(function (f) { return !f.lk; });
      if (S.F.anio) { document.getElementById('bsEstTT').textContent = 'Tendencia mensual por módulo · ' + S.F.anio; S.charts.t = G.barras(document.getElementById('bsEstT'), { labels: MESES, series: ok.map(function (f) { return { label: TIT[f.mod].split(' ')[0], color: MC[f.mod], data: MESES.map(function (_, i) { return f.it.filter(function (o) { return +Rg.R[f.mod].fecha(o).slice(5, 7) === i + 1; }).length; }) }; }) }); }
      else { var anios = {}; ok.forEach(function (f) { f.it.forEach(function (o) { anios[Rg.R[f.mod].fecha(o).slice(0, 4)] = 1; }); }); var ak = Object.keys(anios).sort(); document.getElementById('bsEstTT').textContent = 'Casos por año y módulo'; S.charts.t = G.barras(document.getElementById('bsEstT'), { labels: ak, series: ok.map(function (f) { return { label: TIT[f.mod].split(' ')[0], color: MC[f.mod], data: ak.map(function (a) { return f.it.filter(function (o) { return Rg.R[f.mod].fecha(o).slice(0, 4) === a; }).length; }) }; }) }); }
      var cu = ok.slice().sort(function (a, b) { return b.e.pctPl - a.e.pctPl; });
      S.charts.cu = G.barras(document.getElementById('bsEstCu'), { labels: cu.map(function (f) { return TIT[f.mod].split(' ')[0]; }), series: [{ label: '% en plazo', data: cu.map(function (f) { return f.e.pctPl; }), color: C.NAVY }] }, true, function (v) { return v + ' %'; });
      var emps = ['RAPEL', 'VERFRUT'].filter(function (e) { return !S.F.empresa || S.F.empresa === e; });
      S.charts.e = G.barras(document.getElementById('bsEstE'), { labels: ok.map(function (f) { return TIT[f.mod].split(' ')[0]; }), apiladas: false, series: emps.map(function (e) { return { label: e, color: e === 'RAPEL' ? C.NAVY : C.RED, data: ok.map(function (f) { return f.it.filter(function (o) { return Rg.emp(o.empresa) === e; }).length; }) }; }) });
      var ek = Object.keys(estado); S.charts.es = G.dona(document.getElementById('bsEstEs'), { labels: ek, data: ek.map(function (k) { return estado[k]; }), colores: [C.GRN, C.BLUE, C.AMB, C.RED], unidad: 'casos' });
    }
    /* responsables */
    var R = {}; filas.forEach(function (f) { if (f.lk) return; f.it.forEach(function (o) { var u = Rg.txt(o.created_by).toLowerCase() || '(sin usuario)'; R[u] = R[u] || { n: 0, pl: 0 }; R[u].n++; var x = Rg.estado(f.mod, o, h); if (x.n !== 'rojo') R[u].pl++; }); });
    var rk = Object.keys(R).sort(function (a, b) { return R[b].n - R[a].n; }).slice(0, 10);
    document.getElementById('bsEstR').innerHTML = rk.length ? '<table><thead><tr><th>Responsable</th><th>Casos</th><th>En plazo</th><th>%</th></tr></thead><tbody>' + rk.map(function (u) { var p = pct(R[u].pl, R[u].n), sm = semaforo(p, R[u].n); return '<tr><td>' + esc(u) + '</td><td>' + n0(R[u].n) + '</td><td>' + n0(R[u].pl) + '</td><td><span class="tag ' + (p >= 85 ? 'ok' : p >= 70 ? 'a' : 'r') + '">' + p + ' %</span></td></tr>'; }).join('') + '</tbody></table>' : '<div class="bsp-load">Sin datos</div>';
    var nreg = MODS.reduce(function (a, m) { return a + ((D[m] || []).length); }, 0), nanu = MODS.reduce(function (a, m) { return a + (D[m + '_anulados'] || 0); }, 0);
    document.getElementById('bsEstFu').innerHTML = 'Fuente: <b>' + esc(D.origen) + '</b> · ' + n0(nreg) + ' registros válidos · ' + n0(nanu) + ' anulados excluidos · En plazo = cerrados + abiertos dentro del límite · T. medio sobre casos con fecha de cierre';
    document.getElementById('bsEstAc').textContent = 'Periodo: ' + per + (S.F.empresa ? ' · ' + S.F.empresa : '') + ' · Generado: ' + new Date().toLocaleString('es-PE') + ' · Bienestar Social · Unifrutti';
  }
  function excel() {
    var filas = [['Módulo', 'Casos', 'Cerrados', '% cierre', 'En plazo', '% en plazo', 'Vencidos', 'Por vencer', 'T. medio (días)', 'Periodo anterior']].concat(S.filas.filter(function (f) { return !f.lk; }).map(function (f) { return [TIT[f.mod], f.e.n, f.e.cer, f.e.pctCer, f.e.enPl, f.e.pctPl, f.e.venc, f.e.porV, f.e.tm === null ? '' : f.e.tm, f.prev]; }));
    var nombre = 'Informe_Bienestar_' + (S.F.anio || 'todos') + (S.F.tri ? '_' + S.F.tri + 'T' : '');
    if (window.XLSX) { var wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Informe empresarial de Bienestar Social', '', '', 'Periodo', (S.F.anio || 'todos') + (S.F.tri ? ' ' + S.F.tri + 'T' : ''), 'Empresa', S.F.empresa || 'Todas'], []].concat(S.K.map(function (k) { return [k.l, k.v, String(k.d).replace(/<[^>]+>/g, '')]; })).concat([[]]).concat(filas)), 'Cuadro de mando'); XLSX.writeFile(wb, nombre + '.xlsx'); }
    else { var csv = filas.map(function (r) { return r.map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n'); var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })); a.download = nombre + '.csv'; a.click(); }
    BSDatos.evento('EXPORTAR', 'Estadísticas', 'Excel ' + nombre);
  }
  function pdf() {
    var per = (S.F.anio || 'todos') + (S.F.tri ? ' ' + S.F.tri + 'T' : '');
    if (window.BSPdfGerencial && BSPdfGerencial.exportar) {
      var graficos = []; document.querySelectorAll('#bsEst .bsp-c').forEach(function (c) { var t = c.querySelector('.h b') ? c.querySelector('.h b').textContent : '', cv = c.querySelector('canvas'); if (cv) graficos.push({ titulo: t, canvas: cv }); });
      var tablas = []; var tc = document.querySelector('#bsEstCM table'), tr = document.querySelector('#bsEstR table'); if (tc) tablas.push({ titulo: 'Cuadro de mando por módulo', table: tc }); if (tr) tablas.push({ titulo: 'Gestión por responsable', table: tr });
      BSPdfGerencial.exportar({ titulo: 'Informe empresarial de Bienestar Social', subtitulo: 'Fuente: ' + (S.D && S.D.origen) + ' · ' + new Date().toLocaleString('es-PE'), filtros: [['Empresa', S.F.empresa || 'Todas'], ['Periodo', per]], kpis: S.K.map(function (k) { return [k.l, k.v, String(k.d).replace(/<[^>]+>/g, '')]; }), graficos: graficos, tablas: tablas, tablasPrimero: true, notas: ['En plazo = cerrados + abiertos dentro del límite de cada módulo. Tiempo medio calculado solo sobre casos con fecha de cierre.'], archivo: 'Informe_Bienestar_' + per.replace(/\s/g, '_') });
    } else window.print();
    BSDatos.evento('EXPORTAR', 'Estadísticas', 'PDF ' + per);
  }
  function iniciar() { if (!montar()) return; cargar(); console.log('[_BS_ESTAD_PRO_V1] listo'); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
