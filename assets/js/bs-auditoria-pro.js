/* ═══════════════════════════════════════════════════════════════════════════
   _BS_AUDITORIA_PRO_V1 (07-nov-2026) — Bienestar Social · Registro de auditoría
   · Lee el registro COMPLETO desde Supabase (bs/tabla?clave=bs_auditoria, solo administradores). Si no está disponible,
     cae a bs_listarAuditoria de Google (que entrega solo los últimos 500 eventos) y lo avisa.
   · KPIs del periodo, filtros (rango, módulo, acción, usuario, texto), actividad diaria, eventos por módulo,
     tabla paginada y ordenable, trazabilidad por registro, exportación CSV y Informe PDF con folio y hash SHA-256.
   · Cada exportación queda registrada (bs_registrarEvento, si el Apps Script lo tiene instalado).
   Capa aditiva sobre modulos/auditoria.html: oculta la vista anterior; quitar el <script> la devuelve.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._BS_AUDITORIA_PRO_V1) return; window._BS_AUDITORIA_PRO_V1 = true;
  var G = window.BSGraf, Rg = window.BSReglas, esc = G.esc, n0 = G.n0;
  var S = { todos: [], vista: [], F: { desde: '', hasta: '', modulo: '', accion: '', usuario: '', q: '' }, pag: 1, ord: { col: 'fecha', asc: false }, charts: {}, origen: '', completo: false, traza: null };
  var POR_PAG = 25;
  var ACC_CLASE = function (a) { a = String(a || '').toUpperCase(); return /CREAR|REGISTR|SUBIR|IMPORT/.test(a) ? 'ok' : /ANUL|ELIMIN|BORR/.test(a) ? 'r' : /RESTAUR|CERR|FINALIZ/.test(a) ? 'z' : /ACTUALIZ|EDIT|SEGUIM|MODIF/.test(a) ? 'a' : /EXPORT|IMPRIM|DESCARG|VER\b|ACCESO/.test(a) ? 'p' : 'n'; };

  function fechaN(v) {   /* 'dd/MM/yyyy HH:mm' (Google) o 'YYYY-MM-DD HH:mm' (Supabase) -> 'YYYY-MM-DD HH:mm' */
    var s = String(v || '').trim(), m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
    if (m) return m[3] + '-' + m[2] + '-' + m[1] + ' ' + (m[4] || '00') + ':' + (m[5] || '00');
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/); if (m) return m[1] + '-' + m[2] + '-' + m[3] + ' ' + (m[4] || '00') + ':' + (m[5] || '00');
    var d = new Date(s); return isNaN(d) ? '' : Rg.ymd(d) + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }
  function fmtF(f) { return f ? f.slice(8, 10) + '/' + f.slice(5, 7) + '/' + f.slice(0, 4) + ' ' + f.slice(11, 16) : ''; }
  function normalizar(items) {
    return items.map(function (x, i) { return { i: i, fecha: fechaN(x.fecha), usuario: Rg.txt(x.usuario).toLowerCase(), accion: Rg.up(x.accion), modulo: Rg.txt(x.modulo), registro: Rg.txt(x.registro_id), detalle: Rg.txt(x.detalle) }; })
      .filter(function (x) { return x.fecha; });
  }

  /* ── shell ─────────────────────────────────────────────────────────── */
  function montar() {
    var main = document.querySelector('main.bs-main') || document.querySelector('main'); if (!main) return null;
    var hero = main.querySelector('.bs-hero');
    /* ocultar la vista anterior (filtros, kpis, tabla) sin borrarla */
    ['#audKpis', '#tablaContainer'].forEach(function (s) { var e = main.querySelector(s); if (e) e.style.display = 'none'; });
    /* _BS_AUD_FIX_V2 (07-nov): la pagina anterior (auditoria-01.js) volvia a mostrar sus 4 KPIs al terminar su carga y
       pintaba su tabla en #tablaContainer oculto: indicadores duplicados. Se fija con CSS !important y se redirigen sus
       funciones globales a esta vista, asi el boton/filtros antiguos (si quedara alguno) actuan sobre la vista nueva. */
    if (!document.getElementById('bsAudFixCss')) { var st = document.createElement('style'); st.id = 'bsAudFixCss'; st.textContent = 'body.bsp-pagina #audKpis,body.bsc.bsp-pagina #bscDr #audKpis[data-bsc-kpi],body.bsp-pagina #tablaContainer,body.bsp-pagina main.bs-main>.bs-card:not(#bsAud),body.bsp-pagina .bsc-filtros{display:none!important}.bsp-ocupado{position:relative}.bsp-ocupado::after{content:"";position:absolute;inset:0;background:rgba(255,255,255,.55);border-radius:10px}.bsp-prog{height:3px;background:linear-gradient(90deg,#0f2748,#2563eb,#0f2748);background-size:200% 100%;animation:bspProg .9s linear infinite;border-radius:2px;margin:-4px 0 8px;display:none}.bsp-prog.on{display:block}@keyframes bspProg{to{background-position:-200% 0}}.bsp-chip{display:inline-flex;align-items:center;gap:6px;background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;border-radius:999px;padding:2px 10px;font-size:11px;font-weight:700;margin-left:8px}'; document.head.appendChild(st); }
    window.cargarAuditoria = function () { cargar(true); }; window.renderAuditoria = function () { render(); };
    var cards = main.querySelectorAll(':scope > .bs-card'); Array.prototype.forEach.call(cards, function (c) { if (!c.closest('#bsAud')) c.style.display = 'none'; });
    document.body.classList.add('bsp-pagina');
    var root = document.createElement('div'); root.id = 'bsAud'; root.className = 'bsp';
    var h = new Date(), hasta = Rg.ymd(h), d0 = new Date(h.getTime() - 29 * 86400e3), desde = Rg.ymd(d0);
    S.F.desde = desde; S.F.hasta = hasta;
    root.innerHTML =
      '<div class="bsp-hd" style="--c:#334155"><div><div class="cr">Portal › Auditoría del sistema</div><h1>Registro de auditoría</h1></div>' +
      '<div class="bsp-f"><input type="date" data-f="desde" value="' + desde + '" title="Desde"><input type="date" data-f="hasta" value="' + hasta + '" title="Hasta">' +
      '<select data-f="modulo"><option value="">Módulo: Todos</option></select><select data-f="accion"><option value="">Acción: Todas</option></select><select data-f="usuario"><option value="">Usuario: Todos</option></select>' +
      '<input type="search" data-f="q" placeholder="🔍 ID, DNI, detalle…" style="width:200px"><button class="bsp-btn" data-a="limpiar">Limpiar</button></div>' +
      '<div class="bsp-acts"><button class="bsp-btn" data-a="refrescar">↻ Actualizar</button><button class="bsp-btn" data-a="csv">📊 CSV</button><button class="bsp-btn d" data-a="pdf">⬇ Informe de auditoría PDF</button></div></div>' +
      '<div class="bsp-prog" id="bsAudProg"></div>' +
      '<div class="bsp-nota" id="bsAudNota" style="display:none"></div>' +
      '<div class="bsp-k" id="bsAudK"></div>' +
      '<div class="bsp-g">' +
        '<div class="bsp-c s8 baja"><div class="h"><b>Actividad diaria</b><span id="bsAudSubA"></span></div><div class="b" id="bsAudA"></div></div>' +
        '<div class="bsp-c s4 baja"><div class="h"><b>Eventos por módulo</b><span>periodo</span></div><div class="b" id="bsAudM"></div></div>' +
        '<div class="bsp-c s12"><div class="h"><b>Eventos</b><span id="bsAudSubT"></span></div><div id="bsAudT"></div><div class="bsp-pag" id="bsAudP"></div></div>' +
        '<div class="bsp-c s12" id="bsAudTraza" style="display:none;border-left:4px solid #334155"></div>' +
      '</div>' +
      '<div class="bsp-ft"><span id="bsAudFu"></span><span id="bsAudAc"></span></div>';
    if (hero && hero.parentNode === main) main.insertBefore(root, hero.nextSibling); else main.insertBefore(root, main.firstChild);
    root.querySelectorAll('[data-f]').forEach(function (el) { el.addEventListener(el.tagName === 'INPUT' && el.type === 'search' ? 'input' : 'change', function () { S.F[el.getAttribute('data-f')] = el.value; S.pag = 1; filtrarConAviso(); }); });
    root.querySelector('[data-a="limpiar"]').onclick = function () { S.F = { desde: '', hasta: '', modulo: '', accion: '', usuario: '', q: '' }; root.querySelectorAll('[data-f]').forEach(function (el) { el.value = ''; }); S.pag = 1; filtrarConAviso(); };
    root.querySelector('[data-a="refrescar"]').onclick = function () { cargar(true); };
    root.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target && e.target.getAttribute('data-f')) { S.F[e.target.getAttribute('data-f')] = e.target.value; S.pag = 1; filtrarConAviso(); } });
    root.querySelector('[data-a="csv"]').onclick = csv;
    root.querySelector('[data-a="pdf"]').onclick = pdf;
    return root;
  }

  /* ── datos ─────────────────────────────────────────────────────────── */
  var _tmrF = null;
  function ocupado(on, txt) {
    var b = document.querySelector('#bsAud [data-a="refrescar"]'), p = document.getElementById('bsAudProg');
    if (b) { b.disabled = !!on; b.textContent = on ? (txt || '⏳ Actualizando…') : '↻ Actualizar'; }
    if (p) p.classList.toggle('on', !!on);
    ['bsAudK', 'bsAudA', 'bsAudM', 'bsAudT'].forEach(function (id) { var e = document.getElementById(id); if (e) e.classList.toggle('bsp-ocupado', !!on); });
  }
  function filtrarConAviso() {   /* el filtro es en memoria (instantaneo); se muestra la barra un instante para que se vea que respondio */
    ocupado(true, '⏳ Filtrando…'); clearTimeout(_tmrF);
    _tmrF = setTimeout(function () { try { render(); } finally { ocupado(false); } }, 60);
  }
  async function cargar(fresco) {
    var t0 = Date.now(), nota = document.getElementById('bsAudNota'); document.getElementById('bsAudT').innerHTML = '<div class="bsp-load">Cargando el registro de auditoría…</div>';
    ocupado(true, fresco ? '⏳ Actualizando…' : '⏳ Cargando…');
    var D;
    try { D = await BSDatos.cargar({ modulos: ['auditoria'], fresco: true }); }
    catch (e) { ocupado(false); nota.style.display = ''; nota.className = 'bsp-nota err'; nota.textContent = 'No se pudo cargar la auditoría: ' + (e && e.message || e); document.getElementById('bsAudT').innerHTML = ''; return; }
    if (D.prohibidos.indexOf('auditoria') >= 0) ocupado(false);
    if (D.prohibidos.indexOf('auditoria') >= 0) { nota.style.display = ''; nota.className = 'bsp-nota err'; nota.textContent = 'Solo administradores pueden ver la auditoría.'; document.getElementById('bsAudT').innerHTML = ''; return; }
    S.todos = normalizar(D.auditoria || []).sort(function (a, b) { return b.fecha.localeCompare(a.fecha); }); S.origen = D.origen; S.completo = D.origen === 'Supabase' && D.faltantes.indexOf('auditoria') < 0;
    S.todos.sort(function (a, b) { return b.fecha.localeCompare(a.fecha); });
    if (!S.completo) { nota.style.display = ''; nota.className = 'bsp-nota'; nota.innerHTML = '⚠️ La copia completa en Supabase aún no está disponible: se muestran los <b>últimos 500 eventos</b> desde Google. Ejecuta <b>bsSupabaseSubirTodo()</b> en el Apps Script (con la hoja BS_Auditoria en la lista) para tener el histórico íntegro.'; }
    else nota.style.display = 'none';
    /* selects */
    var sel = function (k, vals, pref) { var s = document.querySelector('#bsAud select[data-f="' + k + '"]'); var cur = s.value; s.innerHTML = s.options[0].outerHTML + vals.map(function (v) { return '<option value="' + esc(v) + '">' + esc(pref + v) + '</option>'; }).join(''); s.value = vals.indexOf(cur) >= 0 ? cur : ''; };
    var uniq = function (f) { var o = {}; S.todos.forEach(function (x) { if (x[f]) o[x[f]] = 1; }); return Object.keys(o).sort(); };
    sel('modulo', uniq('modulo'), 'Módulo: '); sel('accion', uniq('accion'), 'Acción: '); sel('usuario', uniq('usuario'), 'Usuario: ');
    document.getElementById('bsAudFu').innerHTML = 'Fuente: <b>' + esc(S.completo ? 'Supabase (copia íntegra de BS_Auditoria)' : 'Google Sheets (últimos 500)') + '</b> · ' + n0(S.todos.length) + ' eventos · solo lectura · cargado en ' + (Date.now() - t0) + ' ms';
    await G.libs(); render(); ocupado(false);
  }

  function filtrar() {
    var F = S.F, q = F.q.toLowerCase();
    return S.todos.filter(function (x) {
      if (F.desde && x.fecha.slice(0, 10) < F.desde) return false; if (F.hasta && x.fecha.slice(0, 10) > F.hasta) return false;
      if (F.modulo && x.modulo !== F.modulo) return false; if (F.accion && x.accion !== F.accion) return false; if (F.usuario && x.usuario !== F.usuario) return false;
      if (q && (x.registro + ' ' + x.detalle + ' ' + x.usuario + ' ' + x.modulo).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }

  /* ── render ────────────────────────────────────────────────────────── */
  function render() {
    var V = filtrar(); S.vista = V;
    var c = S.ord.col, asc = S.ord.asc; V.sort(function (a, b) { var r = String(a[c]).localeCompare(String(b[c])); return asc ? r : -r; });
    /* KPIs */
    var usuarios = {}, cre = 0, mod = 0, anu = 0, res = 0, otros = 0, fuera = 0, reg = {};
    V.forEach(function (x) { usuarios[x.usuario] = 1; var k = ACC_CLASE(x.accion); if (k === 'ok') cre++; else if (k === 'a') mod++; else if (k === 'r') anu++; else if (/RESTAUR/.test(x.accion)) res++; else otros++; var hh = +x.fecha.slice(11, 13); if (hh < 6 || hh >= 21) fuera++; if (x.registro) reg[x.modulo + '|' + x.registro] = 1; });
    var primero = S.todos.length ? S.todos[S.todos.length - 1].fecha.slice(0, 10) : '', ultimo = S.todos.length ? S.todos[0].fecha : '';
    var K = [
      { l: 'Eventos en el periodo', v: n0(V.length), d: 'de <b class="n">' + n0(S.todos.length) + '</b> ' + (S.completo ? 'históricos · desde ' + fmtF(primero + ' 00:00').slice(0, 10) : 'disponibles (últimos 500)'), c: '#334155' },
      { l: 'Usuarios que operaron', v: n0(Object.keys(usuarios).length), d: (fuera ? '<b class="m">' + n0(fuera) + '</b>' : '<b>0</b>') + ' eventos fuera de horario (21:00–06:00)', c: '#2563eb' },
      { l: 'Creaciones', v: n0(cre), d: G.pct(cre, V.length) + ' % de los eventos', c: '#16a34a' },
      { l: 'Modificaciones', v: n0(mod), d: G.pct(mod, V.length) + ' % · ' + (Object.keys(reg).length ? (V.length / Object.keys(reg).length).toFixed(1) : '0') + ' eventos por registro', c: '#d97706' },
      { l: 'Anulaciones', v: n0(anu), d: '<b class="n">' + n0(res) + '</b> restauradas · ' + (anu ? G.pct(V.filter(function (x) { return ACC_CLASE(x.accion) === 'r' && x.detalle; }).length, anu) : 100) + ' % con motivo', c: '#dc2626' },
      { l: 'Integridad del registro', v: S.completo ? '✓ Íntegro' : '⚠ Parcial', d: S.completo ? 'solo inserción (append-only) · último evento ' + fmtF(ultimo) : 'copia completa pendiente en Supabase', c: S.completo ? '#0f766e' : '#d97706' }
    ];
    document.getElementById('bsAudK').innerHTML = K.map(function (k) { return '<div class="bsp-kc" style="--c:' + k.c + '"><div class="l">' + esc(k.l) + '</div><div class="v">' + esc(k.v) + '</div><div class="d">' + k.d + '</div></div>'; }).join('');
    /* gráficos */
    Object.keys(S.charts).forEach(function (k) { try { S.charts[k].destroy(); } catch (e) {} }); S.charts = {};
    if (window.Chart) {
      var dias = {}; V.forEach(function (x) { var d = x.fecha.slice(0, 10); dias[d] = (dias[d] || 0) + 1; });
      var ks = Object.keys(dias).sort(); if (ks.length > 45) ks = ks.slice(-45);
      document.getElementById('bsAudSubA').textContent = 'eventos por día · ' + (ks.length > 45 ? 'últimos 45 días' : ks.length + ' días');
      S.charts.a = G.barras(document.getElementById('bsAudA'), { labels: ks.map(function (d) { return d.slice(8, 10) + '/' + d.slice(5, 7); }), series: [{ label: 'Eventos', color: '#334155', data: ks.map(function (d) { return dias[d]; }) }] });
      var pm = {}; V.forEach(function (x) { var m = x.modulo || '(sin módulo)'; pm[m] = (pm[m] || 0) + 1; }); var mk = Object.keys(pm).sort(function (a, b) { return pm[b] - pm[a]; }).slice(0, 8);
      S.charts.m = G.barras(document.getElementById('bsAudM'), { labels: mk, series: [{ label: 'Eventos', color: '#0f2748', data: mk.map(function (k) { return pm[k]; }) }] }, true);
    }
    /* tabla */
    var tot = V.length, pags = Math.max(1, Math.ceil(tot / POR_PAG)); if (S.pag > pags) S.pag = pags;
    var ini = (S.pag - 1) * POR_PAG, fila = V.slice(ini, ini + POR_PAG);
    var th = function (col, lbl) { return '<th class="ord ' + (S.ord.col === col ? (S.ord.asc ? 'asc' : 'desc') : '') + '" data-col="' + col + '">' + lbl + '</th>'; };
    var nf = ['modulo', 'accion', 'usuario', 'q'].filter(function (k) { return S.F[k]; }).length + ((S.F.desde || S.F.hasta) ? 1 : 0);
    document.getElementById('bsAudSubT').innerHTML = esc(n0(tot) + ' · orden: ' + S.ord.col + (S.ord.asc ? ' ↑' : ' ↓') + ' · ' + POR_PAG + ' por página') + (nf ? '<span class="bsp-chip">🔎 ' + nf + ' filtro' + (nf > 1 ? 's' : '') + ' activo' + (nf > 1 ? 's' : '') + '</span>' : '');
    document.getElementById('bsAudT').innerHTML = tot ? '<div style="overflow:auto"><table><thead><tr>' + th('fecha', 'Fecha y hora') + th('usuario', 'Usuario') + th('accion', 'Acción') + th('modulo', 'Módulo') + th('registro', 'Registro') + '<th>Detalle</th><th></th></tr></thead><tbody>' +
      fila.map(function (x) { return '<tr><td style="white-space:nowrap">' + esc(fmtF(x.fecha)) + '</td><td><b>' + esc(x.usuario) + '</b></td><td><span class="tag ' + ACC_CLASE(x.accion) + '">' + esc(x.accion) + '</span></td><td>' + esc(x.modulo) + '</td><td style="white-space:nowrap">' + esc(x.registro || '—') + '</td><td>' + esc(x.detalle) + '</td><td>' + (x.registro ? '<button class="bsp-btn sm" data-tr="' + esc(x.modulo) + '|' + esc(x.registro) + '">Trazar</button>' : '') + '</td></tr>'; }).join('') + '</tbody></table></div>'
      : '<div class="bsp-load">Sin eventos con los filtros actuales.' + (S.todos.length ? '<br><span style="font-weight:500;font-size:12px">Los datos disponibles van del <b>' + fmtF(S.todos[S.todos.length - 1].fecha).slice(0, 10) + '</b> al <b>' + fmtF(S.todos[0].fecha).slice(0, 10) + '</b>' + (S.completo ? '' : ' (últimos 500 eventos desde Google; el histórico completo aparecerá al sincronizar con Supabase)') + '. Revisa el rango de fechas o pulsa <b>Limpiar</b>.</span>' : '') + '</div>';
    document.getElementById('bsAudP').innerHTML = tot ? '<span>' + n0(ini + 1) + '–' + n0(Math.min(ini + POR_PAG, tot)) + ' de ' + n0(tot) + '</span><button class="bsp-btn sm" data-p="-1" ' + (S.pag <= 1 ? 'disabled' : '') + '>← Anterior</button><span>' + S.pag + ' / ' + pags + '</span><button class="bsp-btn sm" data-p="1" ' + (S.pag >= pags ? 'disabled' : '') + '>Siguiente →</button>' : '';
    document.querySelectorAll('#bsAudT th.ord').forEach(function (t) { t.onclick = function () { var col = t.getAttribute('data-col'); if (S.ord.col === col) S.ord.asc = !S.ord.asc; else { S.ord.col = col; S.ord.asc = col !== 'fecha'; } render(); }; });
    document.querySelectorAll('#bsAudP [data-p]').forEach(function (b) { b.onclick = function () { S.pag += +b.getAttribute('data-p'); render(); }; });
    document.querySelectorAll('#bsAudT [data-tr]').forEach(function (b) { b.onclick = function () { trazar(b.getAttribute('data-tr')); }; });
    document.getElementById('bsAudAc').textContent = 'Periodo: ' + (S.F.desde ? fmtF(S.F.desde + ' 00:00').slice(0, 10) : 'inicio') + ' → ' + (S.F.hasta ? fmtF(S.F.hasta + ' 00:00').slice(0, 10) : 'hoy') + ' · Generado: ' + new Date().toLocaleString('es-PE') + ' · ' + esc(BSDatos.sesion().usuario || '');
    if (S.traza) trazar(S.traza, true);
  }
  function trazar(key, silencio) {
    S.traza = key; var p = key.split('|'), mod = p[0], reg = p.slice(1).join('|');
    var ev = S.todos.filter(function (x) { return x.modulo === mod && x.registro === reg; }).sort(function (a, b) { return a.fecha.localeCompare(b.fecha); });
    var c = document.getElementById('bsAudTraza'); c.style.display = '';
    c.innerHTML = '<div class="h"><b>Trazabilidad · ' + esc(mod) + ' · ' + esc(reg) + '</b><span>' + ev.length + ' eventos' + (ev.length ? ' · creado ' + fmtF(ev[0].fecha) + ' por ' + esc(ev[0].usuario) : '') + ' &nbsp; <button class="bsp-btn sm" id="bsAudTrazaX">✕ cerrar</button></span></div><div class="bsp-tl">' +
      (ev.length ? ev.map(function (x) { return '<div><span class="t">' + esc(fmtF(x.fecha)) + '</span><span class="u">' + esc(x.usuario) + '</span><span class="tag ' + ACC_CLASE(x.accion) + '">' + esc(x.accion) + '</span><span>' + esc(x.detalle || '—') + '</span></div>'; }).join('') : '<div>Sin eventos para este registro.</div>') + '</div>';
    document.getElementById('bsAudTrazaX').onclick = function () { S.traza = null; c.style.display = 'none'; };
    if (!silencio) c.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ── exportar ──────────────────────────────────────────────────────── */
  async function hashDe(V) {
    try { var txt = V.map(function (x) { return [x.fecha, x.usuario, x.accion, x.modulo, x.registro, x.detalle].join('|'); }).join('\n'); var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt)); return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); } catch (e) { return ''; }
  }
  function folio(h) { var d = new Date(); return 'AUD-' + Rg.ymd(d).replace(/-/g, '') + '-' + ('0' + d.getHours()).slice(-2) + ('0' + d.getMinutes()).slice(-2) + '-' + (h || '').slice(0, 8).toUpperCase(); }
  async function csv() {
    var V = S.vista, h = await hashDe(V), f = folio(h);
    var lineas = ['Fecha y hora,Usuario,Acción,Módulo,Registro,Detalle'].concat(V.map(function (x) { return [fmtF(x.fecha), x.usuario, x.accion, x.modulo, x.registro, x.detalle].map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(','); }));
    lineas.push('', '"Informe de auditoría ' + f + ' · ' + V.length + ' eventos · SHA-256 ' + h + ' · fuente ' + (S.completo ? 'Supabase' : 'Google (últimos 500)') + ' · generado ' + new Date().toLocaleString('es-PE') + ' por ' + (BSDatos.sesion().usuario || '') + '"');
    var blob = new Blob(['﻿' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8' }), a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = f + '.csv'; a.click();
    BSDatos.evento('EXPORTAR', 'Auditoría', 'CSV ' + f + ' · ' + V.length + ' eventos');
  }
  async function pdf() {
    var V = S.vista.slice(0, 3000), h = await hashDe(S.vista), f = folio(h), u = BSDatos.sesion();
    var k = Array.prototype.map.call(document.querySelectorAll('#bsAudK .bsp-kc'), function (c) { return '<div class="k"><div class="l">' + c.querySelector('.l').textContent + '</div><div class="v">' + c.querySelector('.v').textContent + '</div><div class="d">' + c.querySelector('.d').textContent + '</div></div>'; }).join('');
    var filtros = [['Periodo', (S.F.desde || 'inicio') + ' → ' + (S.F.hasta || 'hoy')], ['Módulo', S.F.modulo || 'Todos'], ['Acción', S.F.accion || 'Todas'], ['Usuario', S.F.usuario || 'Todos'], ['Búsqueda', S.F.q || '—']];
    var html = '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>' + f + '</title><style>' +
      '@page{size:A4 landscape;margin:12mm}body{font-family:Inter,Arial,sans-serif;color:#0f172a;font-size:10.5px;margin:0}' +
      '.cab{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0f2748;padding-bottom:8px;margin-bottom:10px}.cab h1{margin:0;font-size:17px}.cab .s{color:#64748b;font-size:10px}.cab .fo{text-align:right;font-size:10px}.cab .fo b{font-size:13px;display:block}' +
      '.k{display:inline-block;border:1px solid #e2e8f0;border-radius:6px;padding:6px 10px;margin:0 6px 8px 0;min-width:140px;vertical-align:top}.k .l{font-size:8px;letter-spacing:.08em;text-transform:uppercase;color:#64748b;font-weight:700}.k .v{font-size:15px;font-weight:800}.k .d{font-size:9px;color:#64748b}' +
      'table{width:100%;border-collapse:collapse;margin-top:8px}th{font-size:8.5px;text-transform:uppercase;letter-spacing:.06em;text-align:left;background:#f1f5f9;padding:4px 6px;border-bottom:1px solid #cbd5e1}td{padding:3px 6px;border-bottom:1px solid #eef2f7;vertical-align:top}tr{break-inside:avoid}' +
      '.ft{margin-top:12px;border-top:1px solid #cbd5e1;padding-top:6px;font-size:9px;color:#475569;display:flex;justify-content:space-between}.hash{font-family:monospace;font-size:8.5px;word-break:break-all}.f{font-size:9.5px;color:#334155;margin-bottom:6px}' +
      '</style></head><body>' +
      '<div class="cab"><div><h1>Informe de auditoría · Sistema de Bienestar Social</h1><div class="s">Unifrutti · RAPEL S.A.C. · VERFRUT S.A.C. · Registro de solo inserción (append-only) · Fuente: ' + (S.completo ? 'Supabase (copia íntegra)' : 'Google Sheets (últimos 500 eventos)') + '</div></div><div class="fo"><b>Folio ' + f + '</b>Generado ' + new Date().toLocaleString('es-PE') + '<br>por ' + esc(u.nombre || u.usuario || '') + '</div></div>' +
      '<div class="f"><b>Filtros:</b> ' + filtros.map(function (x) { return x[0] + ': ' + esc(x[1]); }).join(' · ') + ' &nbsp;·&nbsp; <b>' + n0(S.vista.length) + ' eventos</b>' + (S.vista.length > V.length ? ' (se imprimen los primeros ' + n0(V.length) + ')' : '') + '</div>' + k +
      '<table><thead><tr><th>#</th><th>Fecha y hora</th><th>Usuario</th><th>Acción</th><th>Módulo</th><th>Registro</th><th>Detalle</th></tr></thead><tbody>' +
      V.map(function (x, i) { return '<tr><td>' + (i + 1) + '</td><td>' + esc(fmtF(x.fecha)) + '</td><td>' + esc(x.usuario) + '</td><td>' + esc(x.accion) + '</td><td>' + esc(x.modulo) + '</td><td>' + esc(x.registro || '—') + '</td><td>' + esc(x.detalle) + '</td></tr>'; }).join('') + '</tbody></table>' +
      '<div class="ft"><div>Verificación de integridad · SHA-256 de los ' + n0(S.vista.length) + ' eventos listados:<div class="hash">' + h + '</div></div><div>' + f + '</div></div>' +
      '<script>window.onload=function(){setTimeout(function(){window.print();},300);};<\/script></body></html>';
    var w = window.open('', '_blank'); if (!w) { alert('El navegador bloqueó la ventana del informe. Permite ventanas emergentes para este sitio.'); return; }
    w.document.open(); w.document.write(html); w.document.close();
    BSDatos.evento('EXPORTAR', 'Auditoría', 'PDF ' + f + ' · ' + S.vista.length + ' eventos');
  }

  function iniciar() { if (!montar()) return; cargar(false); console.log('[_BS_AUDITORIA_PRO_V1 + _BS_AUD_FIX_V2] listo'); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
