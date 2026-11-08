/* ═══════════════════════════════════════════════════════════════════════════
   _BS_PANEL_PRO_V1 (07-nov-2026) — Bienestar Social · Panel gerencial (panel.html)
   · Todo se calcula en el navegador con los datos de Supabase (BSDatos: bs/tabla + bs/padron), con las MISMAS reglas
     de vencimiento que los dashboards de cada módulo (BSReglas). Así el Panel y cada módulo dicen la misma cifra.
   · 6 KPIs (uno por módulo) con vencidos y variación vs. periodo anterior · alertas con pestañas + panel lateral
     · tendencia 12 meses · distribución y empresa · últimos registros. Hostigamiento solo si el usuario tiene permiso.
   · "Casos por contrato y antigüedad" se conserva de la vista anterior (se calcula en Google con el padrón) y se recoloca.
   Capa aditiva: oculta la vista anterior; quitar el <script> la devuelve.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._BS_PANEL_PRO_V1) return; window._BS_PANEL_PRO_V1 = true;
  var G = window.BSGraf, Rg = window.BSReglas, esc = G.esc, n0 = G.n0, soles = G.soles, pct = G.pct, C = G.C, MC = G.MOD_COLOR;
  var MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  var S = { D: null, F: { empresa: '', tipo: 'tri', ref: '' }, charts: {}, alertas: [], tab: '' };
  var MODS = ['quejas', 'accidentes', 'hostigamiento', 'subsidios', 'descansos', 'documentos'];
  var TIT = { quejas: 'Hallazgos', accidentes: 'Accidentes', hostigamiento: 'Hostigamiento', subsidios: 'Subsidios', descansos: 'Descansos médicos', documentos: 'Documentos adjuntos' };
  var PAG = { quejas: 'modulos/quejas.html', accidentes: 'modulos/accidentes.html', hostigamiento: 'modulos/hostigamiento.html', subsidios: 'modulos/subsidios.html', descansos: 'modulos/descansos.html', documentos: 'modulos/accidentes.html' };

  function fechaDe(mod, o) { if (mod === 'documentos') return Rg.ymd(o.created_at); return Rg.R[mod] ? Rg.R[mod].fecha(o) : ''; }
  /* periodos: devuelve [desde, hasta] y el anterior equivalente */
  function periodo() {
    var h = new Date(), y = h.getFullYear(), m = h.getMonth(), F = S.F, a, b, pa, pb;
    if (F.tipo === 'mes') { var mm = F.ref ? +F.ref.slice(5, 7) - 1 : m, yy = F.ref ? +F.ref.slice(0, 4) : y; a = new Date(yy, mm, 1); b = new Date(yy, mm + 1, 0); pa = new Date(yy, mm - 1, 1); pb = new Date(yy, mm, 0); }
    else if (F.tipo === 'anio') { var ya = F.ref ? +F.ref : y; a = new Date(ya, 0, 1); b = new Date(ya, 11, 31); pa = new Date(ya - 1, 0, 1); pb = new Date(ya - 1, 11, 31); }
    else if (F.tipo === '12m') { a = new Date(y, m - 11, 1); b = new Date(y, m + 1, 0); pa = new Date(y, m - 23, 1); pb = new Date(y, m - 11, 0); }
    else { var q = F.ref ? +F.ref.split('-')[1] : Math.floor(m / 3) + 1, yq = F.ref ? +F.ref.split('-')[0] : y; a = new Date(yq, (q - 1) * 3, 1); b = new Date(yq, q * 3, 0); pa = new Date(yq, (q - 1) * 3 - 3, 1); pb = new Date(yq, (q - 1) * 3, 0); }
    return { a: Rg.ymd(a), b: Rg.ymd(b), pa: Rg.ymd(pa), pb: Rg.ymd(pb), txt: etiqueta(a, b) };
  }
  function etiqueta(a, b) { var f = function (d) { return MESES[d.getMonth()] + ' ' + d.getFullYear(); }; return a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear() ? f(a) : MESES[a.getMonth()] + ' – ' + f(b); }
  function enRango(f, a, b) { return f && f >= a && f <= b; }
  function filtrados(mod, a, b) { var L = (S.D && S.D[mod]) || []; return L.filter(function (o) { if (S.F.empresa && Rg.emp(o.empresa) !== S.F.empresa && mod !== 'documentos') return false; var f = fechaDe(mod, o); return enRango(f, a, b); }); }
  function variacion(act, prev) { if (!prev) return act ? '<b class="m">nuevo</b>' : '<b class="n">= 0</b>'; var d = act - prev, p = Math.round(d * 100 / prev); return d > 0 ? '<b class="m">▲ ' + p + '%</b>' : d < 0 ? '<b>▼ ' + Math.abs(p) + '%</b>' : '<b class="n">= 0%</b>'; }

  /* ── shell ─────────────────────────────────────────────────────────── */
  function montar() {
    var viejo = document.getElementById('content'); if (!viejo) return null;
    document.body.classList.add('bsp-pagina');
    ['loading', 'errorBox'].forEach(function (id) { var e = document.getElementById(id); if (e) e.style.display = 'none'; });
    viejo.style.display = 'none';
    var root = document.createElement('div'); root.id = 'bsPanel'; root.className = 'bsp';
    root.innerHTML =
      '<div class="bsp-hd" style="--c:#0f2748"><div><div class="cr">Portal › Panel</div><h1>Panel gerencial</h1></div>' +
      '<div class="bsp-f"><select data-f="empresa"><option value="">Empresa: Todas</option><option value="RAPEL">Empresa: RAPEL</option><option value="VERFRUT">Empresa: VERFRUT</option></select>' +
      '<div class="bsp-seg" data-f="tipo"><button data-v="mes">Mes</button><button data-v="tri" class="on">Trimestre</button><button data-v="anio">Año</button><button data-v="12m">12 meses</button></div>' +
      '<select data-f="ref"></select></div>' +
      '<div class="bsp-acts"><button class="bsp-btn" data-a="alertas">🔔 Alertas <span class="bd" id="bsPanAlN">…</span></button><button class="bsp-btn" data-a="copiar">📄 Copiar</button><button class="bsp-btn d" data-a="pdf">⬇ PDF gerencial</button></div></div>' +
      '<div class="bsp-nota" id="bsPanNota" style="display:none"></div>' +
      '<div class="bsp-k" id="bsPanK" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))"><div class="bsp-load">Cargando datos desde Supabase…</div></div>' +
      '<div class="bsp-g">' +
        '<div class="bsp-c s7 alta"><div class="h"><b>Alertas de vencimiento</b><span id="bsPanAlSub"></span></div><div class="bsp-tabs" id="bsPanTabs"></div><div id="bsPanAl" style="overflow:auto"></div></div>' +
        '<div class="bsp-c s5 alta"><div class="h"><b>Tendencia mensual · 12 meses</b><span>casos registrados</span></div><div class="b" id="bsPanT"></div></div>' +
        '<div class="bsp-c s3"><div class="h"><b>Distribución por módulo</b><span id="bsPanPer1"></span></div><div class="b" id="bsPanD1"></div></div>' +
        '<div class="bsp-c s3"><div class="h"><b>Casos por empresa</b><span id="bsPanPer2"></span></div><div class="b" id="bsPanD2"></div></div>' +
        '<div class="bsp-c s6" id="bsPanFuerza"><div class="h"><b>Casos por tipo de contrato y antigüedad</b><span>del trabajador · fuente Google (padrón)</span></div><div id="bsPanFuerzaIn"></div></div>' +
        '<div class="bsp-c s12"><div class="h"><b>Últimos registros</b><span>12 más recientes · todos los módulos</span></div><div class="bsp-tl" id="bsPanMov"></div></div>' +
      '</div><div class="bsp-ft"><span id="bsPanFu"></span><span id="bsPanAc"></span></div>' +
      '<div class="bsp-ov" id="bsPanOv"></div><aside class="bsp-dr" id="bsPanDr"><div class="h"><div><small>Panel gerencial</small><b>Todas las alertas</b></div><button class="x">✕</button></div><div class="bd" id="bsPanDrB"></div></aside>';
    viejo.parentNode.insertBefore(root, viejo);
    root.querySelector('select[data-f="empresa"]').onchange = function () { S.F.empresa = this.value; render(); };
    root.querySelectorAll('[data-f="tipo"] button').forEach(function (b) { b.onclick = function () { S.F.tipo = b.getAttribute('data-v'); S.F.ref = ''; root.querySelectorAll('[data-f="tipo"] button').forEach(function (x) { x.classList.toggle('on', x === b); }); llenarRef(); render(); }; });
    root.querySelector('select[data-f="ref"]').onchange = function () { S.F.ref = this.value; render(); };
    root.querySelector('[data-a="alertas"]').onclick = abrirDr; root.querySelector('#bsPanDr .x').onclick = cerrarDr; root.querySelector('#bsPanOv').onclick = cerrarDr;
    root.querySelector('[data-a="copiar"]').onclick = copiar; root.querySelector('[data-a="pdf"]').onclick = pdf;
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') cerrarDr(); });
    /* recolocar el bloque de contrato/antigüedad de la vista anterior (lo sigue llenando Google) */
    var fz = document.getElementById('fuerzaPanel'); if (fz) { var inn = document.getElementById('bsPanFuerzaIn'); inn.appendChild(fz); fz.style.display = ''; fz.style.margin = '0'; fz.style.boxShadow = 'none'; fz.style.border = '0'; fz.style.padding = '0'; var h3 = fz.querySelector('h3'); if (h3) h3.style.display = 'none'; new MutationObserver(function () { if (fz.style.display === 'none') fz.style.display = ''; }).observe(fz, { attributes: true, attributeFilter: ['style'] }); }
    llenarRef();
    return root;
  }
  function llenarRef() {
    var sel = document.querySelector('#bsPanel select[data-f="ref"]'), h = new Date(), y = h.getFullYear(), m = h.getMonth(), ops = [];
    if (S.F.tipo === 'mes') for (var i = 0; i < 12; i++) { var d = new Date(y, m - i, 1); ops.push([Rg.ymd(d).slice(0, 7), MESES[d.getMonth()] + ' ' + d.getFullYear()]); }
    else if (S.F.tipo === 'tri') for (var j = 0; j < 8; j++) { var q = Math.floor(m / 3) + 1 - j, yq = y; while (q <= 0) { q += 4; yq--; } ops.push([yq + '-' + q, q + 'T ' + yq]); }
    else if (S.F.tipo === 'anio') for (var k = 0; k < 4; k++) ops.push([String(y - k), String(y - k)]);
    sel.style.display = ops.length ? '' : 'none';
    sel.innerHTML = ops.map(function (o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join('');
    if (ops.length) { sel.value = S.F.ref || ops[0][0]; S.F.ref = sel.value; }
  }
  function abrirDr() { document.getElementById('bsPanOv').classList.add('on'); document.getElementById('bsPanDr').classList.add('on'); }
  function cerrarDr() { document.getElementById('bsPanOv').classList.remove('on'); document.getElementById('bsPanDr').classList.remove('on'); }

  /* ── datos ─────────────────────────────────────────────────────────── */
  async function cargar(fresco) {
    var mods = MODS.filter(function (m) { return m !== 'hostigamiento' || BSDatos.puede('hostigamiento'); });
    var D = await BSDatos.cargar({ modulos: mods, fresco: !!fresco }); S.D = D;
    S.alertas = Rg.alertasDe(D);
    var nota = document.getElementById('bsPanNota');
    if (D.faltantes.length) { nota.style.display = ''; nota.textContent = '⚠️ No se pudieron cargar: ' + D.faltantes.join(', ') + '. Los demás módulos sí se muestran.'; } else nota.style.display = 'none';
    await G.libs(); render();
  }

  /* ── render ────────────────────────────────────────────────────────── */
  function render() {
    if (!S.D) return; var D = S.D, P = periodo(), tot = 0, totPrev = 0;
    document.getElementById('bsPanPer1').textContent = P.txt; document.getElementById('bsPanPer2').textContent = P.txt;
    /* KPIs */
    var K = MODS.map(function (mod) {
      var puede = mod !== 'hostigamiento' || BSDatos.puede('hostigamiento');
      if (!puede) return { mod: mod, l: TIT[mod], v: '🔒', d: 'Sin permiso para este módulo', c: MC[mod], lk: true };
      if (!D[mod]) return { mod: mod, l: TIT[mod], v: '—', d: 'no disponible', c: MC[mod], lk: true };
      var it = filtrados(mod, P.a, P.b), pv = filtrados(mod, P.pa, P.pb), al = S.alertas.filter(function (a) { return a.modulo === mod && (!S.F.empresa || a.empresa === S.F.empresa); }), rojos = al.filter(function (a) { return a.estado === 'rojo'; }).length, amb = al.length - rojos;
      if (mod !== 'documentos') { tot += it.length; totPrev += pv.length; }
      var badge = rojos ? '<i>' + n0(rojos) + ' vencido' + (rojos === 1 ? '' : 's') + '</i>' : amb ? '<i class="a">' + n0(amb) + ' por vencer</i>' : '';
      var d = variacion(it.length, pv.length) + ' vs periodo anterior';
      if (mod === 'quejas') { var ce = it.filter(Rg.R.quejas.cerrado).length; d += ' · ' + pct(ce, it.length) + ' % cerrados'; }
      if (mod === 'accidentes') { var ab = it.filter(function (c) { return !Rg.R.accidentes.cerrado(c); }).length; d += ' · ' + n0(ab) + ' abiertos'; }
      if (mod === 'hostigamiento') { var re = it.filter(Rg.R.hostigamiento.cerrado).length; d = n0(re) + ' resueltas · ' + n0(it.length - re) + ' en curso · ' + variacion(it.length, pv.length); }
      if (mod === 'subsidios') { var mt = 0, rec = 0, pen = 0; it.forEach(function (s) { var m = Rg.montoSub(s); mt += m; var c = Rg.catSub(s); if (c === 'Recuperado') rec += m; else if (c === 'Pendiente') pen += m; }); return { mod: mod, l: TIT[mod], v: soles(mt), d: n0(it.length) + ' subsidios · <b>' + pct(rec, mt) + ' %</b> recuperado · ' + soles(pen) + ' por cobrar', c: MC[mod], badge: badge }; }
      if (mod === 'descansos') { var vig = D.descansos.filter(function (x) { return !Rg.R.descansos.cerrado(x); }).length, dd = 0; it.forEach(function (x) { dd += Rg.num(x.dias); }); d = n0(vig) + ' vigentes · ' + n0(dd) + ' días en el periodo · ' + variacion(it.length, pv.length); }
      if (mod === 'documentos') { var kb = 0; it.forEach(function (x) { kb += Rg.num(x.tamano_kb); }); d = (kb / 1024).toFixed(1) + ' MB subidos en el periodo · ' + n0(D.documentos.length) + ' en total'; }
      return { mod: mod, l: TIT[mod], v: n0(it.length), d: d, c: MC[mod], badge: badge };
    });
    document.getElementById('bsPanK').innerHTML = K.map(function (k) { return '<div class="bsp-kc' + (k.lk ? ' lk' : '') + '" style="--c:' + k.c + ';cursor:pointer" title="Abrir ' + esc(k.l) + '" onclick="location.href=\'' + PAG[k.mod] + '\'"><div class="l">' + esc(k.l) + (k.badge || '') + '</div><div class="v">' + k.v + '</div><div class="d">' + k.d + '</div></div>'; }).join('');
    S.K = K;
    /* alertas */
    var AL = S.alertas.filter(function (a) { return !S.F.empresa || a.empresa === S.F.empresa; }); var rojos = AL.filter(function (a) { return a.estado === 'rojo'; }).length;
    document.getElementById('bsPanAlN').textContent = n0(AL.length); document.getElementById('bsPanAlSub').textContent = n0(AL.length) + ' · ' + n0(rojos) + ' vencidas · ' + n0(AL.length - rojos) + ' por vencer';
    var porMod = {}; AL.forEach(function (a) { porMod[a.modulo] = (porMod[a.modulo] || 0) + 1; });
    var tabs = [['', 'Todas', AL.length]].concat(Object.keys(porMod).sort(function (a, b) { return porMod[b] - porMod[a]; }).map(function (m) { return [m, Rg.R[m].titulo, porMod[m]]; }));
    document.getElementById('bsPanTabs').innerHTML = tabs.map(function (t) { return '<button data-t="' + t[0] + '" class="' + (S.tab === t[0] ? 'on' : '') + '">' + esc(t[1]) + ' <i>' + n0(t[2]) + '</i></button>'; }).join('');
    document.querySelectorAll('#bsPanTabs button').forEach(function (b) { b.onclick = function () { S.tab = b.getAttribute('data-t'); render(); }; });
    var lista = AL.filter(function (a) { return !S.tab || a.modulo === S.tab; });
    var fila = function (a) { return '<tr><td><span class="tag" style="background:' + a.color + '22;color:' + a.color + '">' + esc(a.titulo) + '</span></td><td>' + esc(a.descripcion) + '</td><td>' + esc(a.empresa) + '</td><td style="white-space:nowrap">' + esc(a.limite ? a.limite.slice(8) + '/' + a.limite.slice(5, 7) + '/' + a.limite.slice(0, 4) : '—') + '</td><td><span class="tag ' + (a.estado === 'rojo' ? 'r' : 'a') + '">' + esc(a.estado === 'rojo' ? (a.dias !== null ? n0(a.dias) + ' días' : 'vencida') : (a.motivo || 'por vencer')) + '</span></td><td>' + esc(a.responsable || '—') + '</td><td><a class="bsp-btn sm" href="' + a.pagina + '">Abrir</a></td></tr>'; };
    var cab = '<table><thead><tr><th>Módulo</th><th>Registro</th><th>Empresa</th><th>Límite</th><th>Atraso</th><th>Responsable</th><th></th></tr></thead><tbody>';
    document.getElementById('bsPanAl').innerHTML = lista.length ? cab + lista.slice(0, 8).map(fila).join('') + '</tbody></table>' + (lista.length > 8 ? '<div style="font-size:11px;color:#2563eb;font-weight:600;margin-top:6px;cursor:pointer" id="bsPanVerTodas">Ver las ' + n0(lista.length) + ' alertas en el panel lateral →</div>' : '') : '<div class="bsp-load">Sin alertas 🎉</div>';
    var vt = document.getElementById('bsPanVerTodas'); if (vt) vt.onclick = abrirDr;
    document.getElementById('bsPanDrB').innerHTML = lista.length ? cab + lista.map(fila).join('') + '</tbody></table>' : '<div class="bsp-load">Sin alertas</div>';
    /* gráficos */
    Object.keys(S.charts).forEach(function (k) { try { S.charts[k].destroy(); } catch (e) {} }); S.charts = {};
    if (window.Chart) {
      var h = new Date(), meses = []; for (var i = 11; i >= 0; i--) { var d = new Date(h.getFullYear(), h.getMonth() - i, 1); meses.push(Rg.ymd(d).slice(0, 7)); }
      var series = MODS.filter(function (m) { return m !== 'documentos' && D[m]; }).map(function (m) { return { label: TIT[m], color: MC[m], data: meses.map(function (ym) { return D[m].filter(function (o) { if (S.F.empresa && Rg.emp(o.empresa) !== S.F.empresa) return false; return fechaDe(m, o).slice(0, 7) === ym; }).length; }) }; });
      S.charts.t = G.lineas(document.getElementById('bsPanT'), { labels: meses.map(function (ym) { return MESES[+ym.slice(5, 7) - 1] + (ym.slice(5, 7) === '01' ? ' ' + ym.slice(2, 4) : ''); }), series: series });
      var dm = MODS.filter(function (m) { return m !== 'documentos' && D[m]; }), dv = dm.map(function (m) { return filtrados(m, P.a, P.b).length; });
      S.charts.d1 = G.dona(document.getElementById('bsPanD1'), { labels: dm.map(function (m) { return TIT[m]; }), data: dv, colores: dm.map(function (m) { return MC[m]; }), unidad: 'casos' });
      var pe = {}; dm.forEach(function (m) { filtrados(m, P.a, P.b).forEach(function (o) { var e = Rg.emp(o.empresa); pe[e] = (pe[e] || 0) + 1; }); }); var ek = Object.keys(pe).sort();
      S.charts.d2 = G.dona(document.getElementById('bsPanD2'), { labels: ek, data: ek.map(function (e) { return pe[e]; }), colores: ek.map(function (e) { return { RAPEL: C.NAVY, VERFRUT: C.RED, BOMAREA: C.TEAL }[e] || C.GRY; }), unidad: 'casos' });
    }
    /* últimos registros */
    var mov = []; MODS.forEach(function (m) { (D[m] || []).forEach(function (o) { var f = Rg.ymd(o.updated_at) || Rg.ymd(o.created_at) || fechaDe(m, o); if (!f) return; mov.push({ f: f, m: m, u: Rg.txt(o.updated_by) || Rg.txt(o.created_by) || '—', d: m === 'documentos' ? Rg.txt(o.nombre_archivo) + ' · ' + Rg.txt(o.modulo) + ' #' + Rg.txt(o.id_caso) : Rg.R[m].desc(o) + (o.empresa ? ' · ' + Rg.emp(o.empresa) : ''), acc: Rg.ymd(o.updated_at) && Rg.ymd(o.updated_at) !== Rg.ymd(o.created_at) ? 'ACTUALIZADO' : 'REGISTRADO' }); }); });
    mov.sort(function (a, b) { return b.f.localeCompare(a.f); });
    document.getElementById('bsPanMov').innerHTML = mov.slice(0, 12).map(function (x) { return '<div><span class="t">' + esc(x.f.slice(8) + '/' + x.f.slice(5, 7) + '/' + x.f.slice(0, 4)) + '</span><span class="u">' + esc(x.u) + '</span><span class="tag ' + (x.acc === 'ACTUALIZADO' ? 'a' : 'ok') + '">' + x.acc + '</span><span class="tag" style="background:' + MC[x.m] + '22;color:' + MC[x.m] + '">' + esc(TIT[x.m]) + '</span><span>' + esc(x.d) + '</span></div>'; }).join('') || '<div>Sin registros</div>';
    /* pie */
    var nreg = MODS.reduce(function (a, m) { return a + ((D[m] || []).length); }, 0), nanu = MODS.reduce(function (a, m) { return a + (D[m + '_anulados'] || 0); }, 0);
    document.getElementById('bsPanFu').innerHTML = 'Fuente: <b>' + esc(D.origen) + '</b> · ' + n0(nreg) + ' registros válidos (' + n0(nanu) + ' anulados excluidos) · Personal: <b>' + n0(D.padron.total) + '</b> (' + esc(D.padron.fuente) + ')' + (D.deCache ? ' · caché 5 min' : '');
    document.getElementById('bsPanAc').textContent = 'Periodo: ' + P.txt + ' · Actualizado: ' + new Date(D.t).toLocaleString('es-PE');
  }

  function copiar() {
    var P = periodo(), L = ['📊 PANEL GERENCIAL · BIENESTAR SOCIAL', 'Periodo: ' + P.txt + (S.F.empresa ? ' · ' + S.F.empresa : ' · todas las empresas'), ''];
    (S.K || []).forEach(function (k) { L.push('• ' + k.l + ': ' + k.v + ' — ' + String(k.d || '').replace(/<[^>]+>/g, '')); });
    L.push('', 'Alertas: ' + n0(S.alertas.length), 'Fuente: ' + (S.D && S.D.origen) + ' · ' + new Date().toLocaleString('es-PE'));
    var t = L.join('\n'); (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { if (window.showToast) showToast('Resumen copiado'); else alert('Resumen copiado'); }, function () { window.prompt('Copia el resumen:', t); });
    BSDatos.evento('EXPORTAR', 'Panel', 'Resumen copiado · ' + P.txt);
  }
  function pdf() {
    var P = periodo();
    if (window.BSPdfGerencial && BSPdfGerencial.exportar) {
      var graficos = []; document.querySelectorAll('#bsPanel .bsp-c').forEach(function (c) { var t = c.querySelector('.h b') ? c.querySelector('.h b').textContent : '', cv = c.querySelector('canvas'); if (cv && cv.offsetParent) graficos.push({ titulo: t, canvas: cv }); });
      var tablas = []; var ta = document.querySelector('#bsPanDrB table'); if (ta) tablas.push({ titulo: 'Alertas de vencimiento', table: ta });
      BSPdfGerencial.exportar({ titulo: 'Panel gerencial · Bienestar Social', subtitulo: 'Fuente: ' + (S.D && S.D.origen) + ' · ' + new Date().toLocaleString('es-PE'), filtros: [['Empresa', S.F.empresa || 'Todas'], ['Periodo', P.txt]], kpis: (S.K || []).map(function (k) { return [k.l, k.v, String(k.d || '').replace(/<[^>]+>/g, '')]; }), graficos: graficos, tablas: tablas, notas: [], archivo: 'Panel_gerencial_Bienestar' });
    } else window.print();
    BSDatos.evento('EXPORTAR', 'Panel', 'PDF gerencial · ' + P.txt);
  }

  function iniciar() { if (!montar()) return; cargar(false); console.log('[_BS_PANEL_PRO_V1] listo'); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
