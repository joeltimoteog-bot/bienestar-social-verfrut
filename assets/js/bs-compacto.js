/* ═══════════════════════════════════════════════════════════════════════════
   _BS_COMPACTO_V1 (07-nov-2026) — Bienestar Social · estructura compacta de los módulos
   Qué hace (solo presentación; no toca datos ni Supabase):
     1) Cabecera de una línea (el CSS oculta la descripción) + botones "📊 Indicadores" y "🔔 Alertas".
     2) Los contenedores de indicadores (#kpiXxx, #kpis, #audKpis, #resumenAnual…) y los resúmenes
        (.bsm-res, #reporteContainer) se MUEVEN a un panel lateral. Conservan su id, así que el módulo
        sigue pintando en ellos como siempre.
     3) El filtro de periodo (Año/Mes, BSFiltroFecha) se muestra como dos selects dentro de la fila de
        filtros; sigue llamando a BSFiltroFecha._set, que es la misma función que usaban los botones.
     4) "Ver anulados" pasa al final de la fila de filtros.
   Reversible: quitar el <script> y el <link>. Interruptor: window._BS_COMPACTO_V1.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._BS_COMPACTO_V1) return; window._BS_COMPACTO_V1 = true;
  if (/(estadisticas|ficha)\.html$/i.test(location.pathname)) { document.documentElement.classList.add('bsc-solo-cabecera'); }

  var KPI_SEL = ['#kpiAccidentes', '#kpiHostigamiento', '#kpiQuejas', '#kpiRendiciones', '#kpis', '#audKpis', '#resumenAnual'];
  var RES_SEL = ['.bsm-res', '#reporteContainer'];
  var soloCabecera = /(estadisticas|ficha)\.html$/i.test(location.pathname);
  var dr = null, ov = null, secInd = null, secRes = null, btnInd = null, btnAl = null, obs = null, periodoCtl = null;

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function hero() { return $('.bs-hero') || $('.qx-hero'); }
  function heroActs() {
    var h = hero(); if (!h) return null;
    var btn = $('.bs-btn', h); if (!btn) return null;
    if (btn.parentNode !== h) return btn.parentNode;
    /* botones sueltos directamente en la cabecera (Rendiciones, Auditoría, Sugerencias): se agrupan al final */
    var w = $('.bsc-acts', h);
    if (!w) {
      w = document.createElement('div'); w.className = 'bsc-acts'; w.style.cssText = 'display:flex;gap:.5rem;flex-wrap:wrap;margin-left:auto';
      $$(':scope > .bs-btn', h).forEach(function (b) { w.appendChild(b); });
      h.appendChild(w);
    }
    return w;
  }
  function modColor() { var h = hero(); return h ? (h.style.getPropertyValue('--mod') || '') : ''; }
  function titulo() { var h = hero(); var t = h && $('h1', h); return t ? t.textContent.trim() : document.title; }

  /* ── panel lateral ───────────────────────────────────────────────────── */
  function crearPanel() {
    if (dr) return;
    ov = document.createElement('div'); ov.id = 'bscOv';
    dr = document.createElement('aside'); dr.id = 'bscDr'; dr.setAttribute('role', 'dialog'); dr.setAttribute('aria-label', 'Indicadores');
    if (modColor()) dr.style.setProperty('--mod', modColor());
    dr.innerHTML =
      '<div class="h"><div class="ic">📊</div><div><small>' + esc(titulo()) + '</small><b>Indicadores y resumen</b></div><button class="x" type="button" title="Cerrar (Esc)">✕</button></div>' +
      '<div class="tabs"><button type="button" data-t="ind" class="on">Indicadores</button><button type="button" data-t="res">Resumen empresa / año</button></div>' +
      '<div class="bd"><section data-s="ind" class="on"></section><section data-s="res"></section></div>' +
      '<div class="ft"></div>';
    document.body.appendChild(ov); document.body.appendChild(dr);
    secInd = $('section[data-s="ind"]', dr); secRes = $('section[data-s="res"]', dr);
    $('.x', dr).onclick = cerrar; ov.onclick = cerrar;
    $$('.tabs button', dr).forEach(function (b) { b.onclick = function () { tab(b.getAttribute('data-t')); }; });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && document.body.classList.contains('bsc-open')) cerrar(); });
    /* pie: Estadísticas (si el módulo tiene su dashboard) y cerrar */
    var ft = $('.ft', dr);
    var bEst = $$('.bs-btn', hero()).filter(function (b) { return /estad/i.test(b.textContent); })[0];
    if (bEst) { var e2 = document.createElement('button'); e2.type = 'button'; e2.className = 'bsc-btn'; e2.textContent = '📈 Estadísticas completas'; e2.onclick = function () { cerrar(); bEst.click(); }; ft.appendChild(e2); }
    var c = document.createElement('button'); c.type = 'button'; c.className = 'bsc-btn cerrar'; c.textContent = 'Cerrar'; c.onclick = cerrar; ft.appendChild(c);
  }
  function tab(t) {
    $$('.tabs button', dr).forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-t') === t); });
    $$('.bd>section', dr).forEach(function (s) { s.classList.toggle('on', s.getAttribute('data-s') === t); });
  }
  function abrir(t) { crearPanel(); refrescarVacios(); if (t) tab(t); document.body.classList.add('bsc-open'); }
  function cerrar() { document.body.classList.remove('bsc-open'); }

  function moverBloques() {
    crearPanel();
    KPI_SEL.forEach(function (s) { $$(s).forEach(function (el) { if (el.closest('#bscDr')) return; el.setAttribute('data-bsc-kpi', '1'); secInd.appendChild(el); }); });
    RES_SEL.forEach(function (s) { $$(s).forEach(function (el) { if (el.closest('#bscDr')) return; el.setAttribute('data-bsc-res', '1'); secRes.appendChild(el); }); });
    refrescarVacios();
  }
  function tieneContenido(sec) {
    return $$('[data-bsc-kpi],[data-bsc-res]', sec).some(function (el) { return el.textContent.trim() !== '' || el.querySelector('canvas,svg,img'); });
  }
  function refrescarVacios() {
    if (!dr) return;
    [secInd, secRes].forEach(function (sec) {
      var v = $('.vacio', sec);
      if (tieneContenido(sec)) { if (v) v.remove(); }
      else if (!v) { v = document.createElement('div'); v.className = 'vacio'; v.textContent = 'Sin datos para mostrar con los filtros actuales.'; sec.appendChild(v); }
    });
    /* pestaña Resumen solo si el módulo tiene resumen */
    var bRes = $('.tabs button[data-t="res"]', dr);
    var hayRes = $$('[data-bsc-res]', secRes).length > 0;
    if (bRes) bRes.hidden = !hayRes;
  }

  /* ── botones en la cabecera ─────────────────────────────────────────── */
  function botones() {
    var acts = heroActs(); if (!acts) return;
    if (!btnInd && !soloCabecera) {
      btnInd = document.createElement('button'); btnInd.type = 'button'; btnInd.className = 'bsc-btn'; btnInd.id = 'bscBtnInd';
      var yaHay = $$('.bs-btn', hero()).some(function (b) { return /indicador/i.test(b.textContent); });
      btnInd.innerHTML = yaHay ? '📊 Resumen' : '📊 Indicadores'; btnInd.onclick = function () { abrir('ind'); };
      acts.insertBefore(btnInd, acts.firstChild);
    }
    var atr = $('#bsmAtrasos');
    if (atr && !btnAl) {
      btnAl = document.createElement('button'); btnAl.type = 'button'; btnAl.className = 'bsc-btn al'; btnAl.id = 'bscBtnAl';
      btnAl.onclick = function () { var v = $('#bsmAtrasos .b-ver'); if (v) v.click(); };
      acts.insertBefore(btnAl, btnInd ? btnInd.nextSibling : acts.firstChild);
    }
    if (btnAl && atr) {
      var m = ($('#bsmAtrasos .b-ver') || {}).textContent || ''; var n = (m.match(/\((\d+)\)/) || [])[1] || '';
      btnAl.classList.toggle('amb', atr.classList.contains('ambar'));
      btnAl.innerHTML = '🔔 Alertas' + (n ? ' <span class="bd">' + esc(n) + '</span>' : '');
    }
  }

  /* ── filtros en una fila ─────────────────────────────────────────────── */
  function cardFiltros() {
    var h = hero(); if (!h) return null;
    var el = h.nextElementSibling, n = 0;
    while (el && n < 12) {
      if (el.classList && el.classList.contains('bs-card') && el.querySelector('.bs-form-group') && !el.querySelector('table') && el.id !== 'bsFiltroFecha' && el.id !== 'resumenAnual') return el;
      el = el.nextElementSibling; n++;
    }
    return null;
  }
  function filtros() {
    var card = cardFiltros(); if (!card || card.getAttribute('data-bsc')) return;
    card.setAttribute('data-bsc', '1'); card.classList.add('bsc-filtros');
    var grid = card.querySelector('.bs-grid') || card;
    /* periodo (Año/Mes) */
    var ff = $('#bsFiltroFecha');
    if (ff && window.BSFiltroFecha && typeof BSFiltroFecha._set === 'function') {
      ff.classList.remove('bs-card', 'bs-mb'); ff.classList.add('bsc-periodo');
      grid.appendChild(ff);
      periodoCtl = ff; pintarPeriodo();
      new MutationObserver(function () { pintarPeriodo(); }).observe(ff, { childList: true });
    }
    /* "Ver anulados" */
    var chk = $('#verAnulados');
    if (chk) {
      var orig = chk.parentNode; orig.classList.add('bsc-anul-orig');
      var w = document.createElement('div'); w.className = 'bs-form-group bsc-anul';
      w.appendChild(chk); var lab = $('label[for="verAnulados"]', orig); if (lab) { lab.className = 'bs-text-xs bs-text-muted bs-cursor-pointer'; w.appendChild(lab); }
      grid.appendChild(w);
    }
  }
  var pintando = false;
  function pintarPeriodo() {
    if (!periodoCtl || pintando) return;
    if (periodoCtl.getAttribute('data-bsc-ok') === '1' && periodoCtl.querySelector('select')) return;
    /* leer los botones que pinta BSFiltroFecha (años disponibles y selección) */
    var bots = $$('button', periodoCtl); if (!bots.length) return;
    var anios = [], aniSel = '', mesSel = '';
    bots.forEach(function (b) {
      var oc = b.getAttribute('onclick') || ''; var m = oc.match(/_set\('(anio|mes)','([^']*)'\)/); if (!m) return;
      var activo = /background:\s*(?!#fff)/i.test(b.getAttribute('style') || '') && !/background:\s*#fff/i.test(b.getAttribute('style') || '');
      if (m[1] === 'anio') { if (m[2]) anios.push(m[2]); if (activo) aniSel = m[2]; }
      else if (activo) mesSel = m[2];
    });
    try { if (BSFiltroFecha.estado) { aniSel = BSFiltroFecha.estado.anio || ''; mesSel = BSFiltroFecha.estado.mes || ''; } } catch (e) {}
    var MES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    var h = '<div class="bs-form-group"><label class="bs-label">Año</label><select class="bs-select" data-k="anio"><option value="">Todos</option>';
    anios.forEach(function (a) { h += '<option value="' + esc(a) + '"' + (String(a) === String(aniSel) ? ' selected' : '') + '>' + esc(a) + '</option>'; });
    h += '</select></div><div class="bs-form-group"><label class="bs-label">Mes</label><select class="bs-select" data-k="mes"><option value="">Todo el año</option>';
    MES.forEach(function (n, i) { var mm = ('0' + (i + 1)).slice(-2); h += '<option value="' + mm + '"' + (mm === mesSel ? ' selected' : '') + '>' + n + '</option>'; });
    h += '</select></div>';
    pintando = true;
    periodoCtl.innerHTML = h; periodoCtl.setAttribute('data-bsc-ok', '1');
    $$('select', periodoCtl).forEach(function (s) { s.onchange = function () { periodoCtl.setAttribute('data-bsc-ok', '0'); BSFiltroFecha._set(s.getAttribute('data-k'), s.value); }; });
    pintando = false;
  }

  /* ── arranque y vigilancia (los módulos pintan bloques después de cargar datos) ── */
  var tmr = null;
  function pasada() {
    try {
      document.body.classList.add('bsc');
      domarPill();
      botones();
      if (!soloCabecera) { filtros(); moverBloques(); }
    } catch (e) { console.warn('[_BS_COMPACTO_V1] pasada:', e); }
  }
  function programar() { clearTimeout(tmr); tmr = setTimeout(pasada, 80); }
  function iniciar() {
    pasada();
    if (window.MutationObserver) {
      obs = new MutationObserver(function (ms) {
        for (var i = 0; i < ms.length; i++) { var t = ms[i].target; if (t && t.closest && t.closest('#bscDr')) { refrescarVacios(); continue; } programar(); break; }
      });
      obs.observe(document.body, { childList: true, subtree: true });
    }
    console.log('[_BS_COMPACTO_V1] listo' + (soloCabecera ? ' (solo cabecera)' : ''));
  }
  /* _BSC_PILL_V1 (07-nov): la pastilla "Hay información nueva" de bs-mejoras.js tapaba la cabecera. Se convierte en un chip
     pequeño abajo al centro, con ✕, por debajo de los paneles, y se oculta sola a los 25 s. Sigue recargando al tocarla. */
  function domarPill() {
    $$('body > button').forEach(function (b) {
      if (b.getAttribute('data-bsc-pill') || !/informaci[oó]n nueva/i.test(b.textContent || '')) return;
      b.setAttribute('data-bsc-pill', '1'); b.className = 'bsc-pill';
      b.style.cssText = ''; b.innerHTML = '🔄 Hay datos nuevos · <u>actualizar</u>';
      var x = document.createElement('span'); x.className = 'x'; x.textContent = '✕'; x.title = 'Cerrar';
      x.onclick = function (e) { e.stopPropagation(); b.remove(); }; b.appendChild(x);
      setTimeout(function () { if (b.parentNode) b.classList.add('ir'); setTimeout(function () { if (b.parentNode) b.remove(); }, 400); }, 25000);
    });
  }
  /* _BSC_AUD_ACCESO_V1 (07-nov): el ingreso al módulo de Hostigamiento (confidencial) queda en la auditoría, una vez por sesión */
  try { if (/hostigamiento\.html$/i.test(location.pathname) && typeof window.api === 'function' && !sessionStorage.getItem('bsc_acc_h')) { sessionStorage.setItem('bsc_acc_h', '1'); window.api('bs_registrarEvento', { accion: 'ACCESO', modulo: 'Hostigamiento', detalle: 'ingreso al módulo' }).catch(function () {}); } } catch (e) {}
  window.bscAbrir = abrir; window.bscCerrar = cerrar;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
