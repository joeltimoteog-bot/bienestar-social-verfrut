/* =========================================================================
 * BS-MEJORAS · Mejoras compartidas para los módulos de Bienestar Social
 * Unifrutti Group · RAPEL S.A.C. / VERFRUT S.A.C.
 * -------------------------------------------------------------------------
 * Se auto-instala con: <script src="../assets/js/bs-mejoras.js"></script>
 * Incluye:
 *  1) Loader de puntos saltarines (reemplaza spinners circulares)
 *  2) Banner de alertas de atraso del módulo actual + envío de reporte
 *  3) Tablas: búsqueda, orden por columna, paginación y contador
 *  4) Validación suave de DNI y coherencia de fechas
 *  5) Autoguardado de borrador de formularios (24 h)
 * ========================================================================= */
(function () {
  'use strict';

  var API_URL = window.BS_API_URL ||
    'https://script.google.com/macros/s/AKfycbyJIUtdpApEc35Jj4ZNP-3ONqGe64J1VhaRvkt87vVUNTgSagrOgOS0T99eIt0-w3Yi/exec';

  var user = null;
  try { user = JSON.parse(localStorage.getItem('bienestarSocialAuth') || 'null'); } catch (e) {}

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function debounce(fn, ms) { var t; return function () { clearTimeout(t); var a = arguments, s = this; t = setTimeout(function () { fn.apply(s, a); }, ms); }; }

  /* ---------- estilos compartidos ---------- */
  function injectCss() {
    if (document.getElementById('bsMejorasCss')) return;
    var st = document.createElement('style');
    st.id = 'bsMejorasCss';
    st.textContent =
      '.bsm-dots{display:inline-flex;align-items:center;gap:5px;}' +
      '.bsm-dots i{width:9px;height:9px;border-radius:50%;background:#0033A0;animation:bsmB .9s ease-in-out infinite;}' +
      '.bsm-dots i:nth-child(2){background:#E2231A;animation-delay:.15s;}' +
      '.bsm-dots i:nth-child(3){background:#2A5BD7;animation-delay:.3s;}' +
      '.bsm-dots.light i{background:rgba(255,255,255,.95)!important;}' +
      '.bsm-dots.lg i{width:13px;height:13px;}' +
      '@keyframes bsmB{0%,60%,100%{transform:translateY(0);opacity:.55}30%{transform:translateY(-8px);opacity:1}}' +
      /* banner atrasos */
      '#bsmAtrasos{display:none;background:#fff;border:1px solid #fecaca;border-left:6px solid #dc2626;border-radius:12px;padding:12px 16px;margin:0 0 14px;box-shadow:0 4px 14px rgba(220,38,38,.10);font-family:Inter,system-ui,sans-serif;}' +
      '#bsmAtrasos.ambar{border-color:#fde68a;border-left-color:#d97706;}' +
      '#bsmAtrasos .h{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-weight:800;font-size:.88rem;color:#b91c1c;margin-bottom:6px;}' +
      '#bsmAtrasos.ambar .h{color:#b45309;}' +
      '#bsmAtrasos .it{font-size:.79rem;color:#475569;padding:3px 0;border-bottom:1px dashed #f1e0e0;display:flex;gap:8px;}' +
      '#bsmAtrasos .it:last-of-type{border-bottom:none;}' +
      '#bsmAtrasos .it .d{font-weight:800;white-space:nowrap;margin-left:auto;}' +
      '#bsmAtrasos .it .d.rojo{color:#b91c1c}#bsmAtrasos .it .d.ambar{color:#b45309}' +
      '#bsmAtrasos .acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:9px;}' +
      '#bsmAtrasos .acts button{border:none;border-radius:8px;padding:6px 12px;font-size:.74rem;font-weight:700;cursor:pointer;font-family:inherit;}' +
      '#bsmAtrasos .b-wsp{background:#25d366;color:#fff}#bsmAtrasos .b-mail{background:#0a3d91;color:#fff}#bsmAtrasos .b-copy{background:#e2e8f0;color:#334155}' +
      /* toolbar de tabla */
      '.bsm-tb{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:0 0 9px;font-family:Inter,system-ui,sans-serif;}' +
      '.bsm-tb input,.bsm-tb select{padding:7px 11px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:.82rem;font-family:inherit;outline:none;background:#fff;}' +
      '.bsm-tb input:focus,.bsm-tb select:focus{border-color:#0033A0;}' +
      '.bsm-tb input{min-width:200px;flex:1;max-width:320px;}' +
      '.bsm-tb .cnt{font-size:.76rem;font-weight:700;color:#64748b;margin-left:auto;}' +
      '.bsm-pag{display:flex;gap:6px;align-items:center;justify-content:flex-end;margin:8px 0 0;font-family:Inter,system-ui,sans-serif;font-size:.78rem;color:#64748b;}' +
      '.bsm-pag button{border:1.5px solid #e2e8f0;background:#fff;border-radius:7px;padding:4px 10px;cursor:pointer;font-weight:700;font-size:.76rem;color:#334155;}' +
      '.bsm-pag button:disabled{opacity:.4;cursor:not-allowed;}' +
      'th.bsm-sortable{cursor:pointer;user-select:none;white-space:nowrap;}' +
      'th.bsm-sortable .arr{opacity:.45;font-size:.7em;margin-left:3px;}' +
      /* validación + borrador */
      '.bsm-warn{border-color:#d69e2e!important;background:#fffaf0!important;}' +
      '.bsm-warn-msg{font-size:.72rem;color:#b45309;font-weight:600;margin-top:3px;font-family:Inter,system-ui,sans-serif;}' +
      '#bsmDraft{display:flex;gap:10px;align-items:center;flex-wrap:wrap;background:#ebf8ff;border:1px solid #90cdf4;border-radius:10px;padding:9px 14px;margin:0 0 12px;font-size:.8rem;color:#2a4365;font-family:Inter,system-ui,sans-serif;}' +
      '#bsmDraft button{border:none;border-radius:7px;padding:5px 11px;font-size:.74rem;font-weight:700;cursor:pointer;font-family:inherit;}' +
      '#bsmDraft .b-r{background:#0a3d91;color:#fff}#bsmDraft .b-d{background:#e2e8f0;color:#334155}';
    document.head.appendChild(st);
  }

  /* ============ 1) LOADER: spinner -> puntos ============ */
  function dotsEl(light, big) {
    var d = document.createElement('span');
    d.className = 'bsm-dots' + (light ? ' light' : '') + (big ? ' lg' : '');
    d.innerHTML = '<i></i><i></i><i></i>';
    return d;
  }
  function swapSpinner(sp) {
    if (!sp || sp._bsmDone) return;
    sp._bsmDone = true;
    var light = !!sp.closest('button') || !sp.classList.contains('bs-spinner-dark');
    var big = !!sp.closest('.bs-loader-overlay') || (sp.offsetWidth || 0) > 28;
    var d = dotsEl(light && !sp.closest('.bs-loader-overlay'), big);
    // conservar visibilidad controlada por bs-hidden
    if (sp.classList.contains('bs-hidden')) d.classList.add('bs-hidden');
    d.id = sp.id || '';
    sp.replaceWith(d);
  }
  function initLoader() {
    document.querySelectorAll('.bs-spinner').forEach(swapSpinner);
    new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        m.addedNodes.forEach(function (n) {
          if (n.nodeType !== 1) return;
          if (n.classList && n.classList.contains('bs-spinner')) swapSpinner(n);
          if (n.querySelectorAll) n.querySelectorAll('.bs-spinner').forEach(swapSpinner);
        });
      });
    }).observe(document.body, { childList: true, subtree: true });
  }

  /* ============ 2) ALERTAS DE ATRASO DEL MÓDULO ============ */
  var MOD_KEY = (function () {
    var f = (location.pathname.split('/').pop() || '').toLowerCase();
    if (f.indexOf('queja') >= 0) return 'queja';
    if (f.indexOf('accidente') >= 0) return 'accidente';
    if (f.indexOf('hostigamiento') >= 0) return 'hostigamiento';
    if (f.indexOf('subsidio') >= 0) return 'subsidio';
    if (f.indexOf('rendicion') >= 0) return 'rendici';
    return null;
  })();
  var ATR = [];

  function initAtrasos() {
    if (!MOD_KEY || !user) return;
    fetch(API_URL, {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'bs_alertas', permisos: user.permisos || {} })
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (!d || !d.ok) return;
      ATR = (d.alertas || []).filter(function (a) {
        return (a.estado === 'rojo' || a.estado === 'ambar') &&
          String(a.modulo || '').toLowerCase().indexOf(MOD_KEY) >= 0;
      });
      renderAtrasos();
    }).catch(function () {});
  }

  function renderAtrasos() {
    if (!ATR.length) return;
    var rojos = ATR.filter(function (a) { return a.estado === 'rojo'; }).length;
    var box = document.createElement('div');
    box.id = 'bsmAtrasos';
    if (!rojos) box.className = 'ambar';
    var items = ATR.slice(0, 6).map(function (a) {
      var dr = Number(a.diasRestantes || 0);
      var txt = dr < 0 ? Math.abs(dr) + 'd de atraso' : (dr === 0 ? 'vence HOY' : 'vence en ' + dr + 'd');
      return '<div class="it"><span>' + esc(a.descripcion) +
        (a.fechaLimite ? ' · límite: ' + esc(a.fechaLimite) : '') + '</span>' +
        '<span class="d ' + a.estado + '">' + txt + '</span></div>';
    }).join('');
    var extra = ATR.length > 6 ? '<div class="it"><span>… y ' + (ATR.length - 6) + ' más (ver Panel)</span></div>' : '';
    box.innerHTML =
      '<div class="h">' + (rojos ? '🚨 ' + rojos + ' caso(s) vencido(s) en este módulo' : '⏳ Casos por vencer en este módulo') +
      (ATR.length - rojos > 0 ? ' · ' + (ATR.length - rojos) + ' por vencer' : '') + '</div>' +
      items + extra +
      '<div class="acts">' +
      '<button class="b-wsp">📱 WhatsApp</button>' +
      '<button class="b-mail">✉️ Correo</button>' +
      '<button class="b-copy">📋 Copiar reporte</button></div>';
    box.querySelector('.b-wsp').onclick = function () { enviarReporte('whatsapp'); };
    box.querySelector('.b-mail').onclick = function () { enviarReporte('correo'); };
    box.querySelector('.b-copy').onclick = function () { enviarReporte('copiar'); };
    var host = document.querySelector('main') || document.querySelector('.bs-main') || document.body;
    var saludo = document.getElementById('bsSaludoBar');
    if (saludo && saludo.parentNode === host) host.insertBefore(box, saludo.nextSibling);
    else host.insertBefore(box, host.firstChild);
    box.style.display = 'block';
  }

  function textoReporte() {
    var hoy = new Date().toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    var L = ['🚨 *REPORTE DE ATRASOS · ' + document.title.split('·')[0].trim().toUpperCase() + '*',
      '📅 ' + hoy.charAt(0).toUpperCase() + hoy.slice(1),
      '👤 Generado por: ' + (user.nombre || user.usuario), ''];
    ATR.forEach(function (a, i) {
      var dr = Number(a.diasRestantes || 0);
      L.push((i + 1) + '. ' + (a.estado === 'rojo' ? '⛔' : '⏳') + ' ' + a.descripcion +
        (a.fechaLimite ? ' — límite ' + a.fechaLimite : '') +
        ' (' + (dr < 0 ? Math.abs(dr) + ' días de atraso' : dr === 0 ? 'vence HOY' : 'vence en ' + dr + ' días') + ')' +
        (a.empresa ? ' · ' + a.empresa : ''));
    });
    L.push('', '— Sistema de Bienestar Social · RR.LL. · Unifrutti Group');
    return L.join('\n');
  }

  function enviarReporte(medio) {
    var txt = textoReporte();
    if (medio === 'whatsapp') window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank');
    else if (medio === 'correo') location.href = 'mailto:?subject=' + encodeURIComponent('🚨 Reporte de Atrasos · ' + document.title) + '&body=' + encodeURIComponent(txt.replace(/\*/g, ''));
    else (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(txt) : Promise.reject())
      .then(function () { alert('📋 Reporte copiado al portapapeles.'); })
      .catch(function () { window.prompt('Copia el reporte:', txt); });
  }

  /* ============ 3) TABLAS: búsqueda + orden + paginación ============ */
  var PAGE_SIZE = 15;

  function enhanceTable(table) {
    if (table._bsmT || !table.tHead || !table.tBodies.length) return;
    var tbody = table.tBodies[0];
    if (tbody.rows.length < 2) return; // esperar datos
    table._bsmT = { page: 1, q: '', sortCol: -1, sortAsc: true };

    var wrap = table.closest('.bs-table-wrap') || table;

    // toolbar
    var tb = document.createElement('div');
    tb.className = 'bsm-tb';
    tb.innerHTML = '<input type="search" placeholder="🔍 Buscar en la tabla (nombre, DNI, sector...)">' +
      '<span class="cnt"></span>';
    wrap.parentNode.insertBefore(tb, wrap);
    var inp = tb.querySelector('input');
    inp.addEventListener('input', debounce(function () {
      table._bsmT.q = inp.value.trim().toLowerCase();
      table._bsmT.page = 1;
      apply(table);
    }, 200));

    // paginación
    var pag = document.createElement('div');
    pag.className = 'bsm-pag';
    pag.innerHTML = '<button class="pv">← Anterior</button><span class="pi"></span><button class="nx">Siguiente →</button>';
    wrap.parentNode.insertBefore(pag, wrap.nextSibling);
    pag.querySelector('.pv').onclick = function () { table._bsmT.page--; apply(table); };
    pag.querySelector('.nx').onclick = function () { table._bsmT.page++; apply(table); };
    table._bsmPag = pag; table._bsmCnt = tb.querySelector('.cnt');

    // orden por columna
    Array.prototype.forEach.call(table.tHead.rows[0].cells, function (th, i) {
      if (/acci|opci/i.test(th.textContent)) return; // no ordenar columna de acciones
      th.classList.add('bsm-sortable');
      var arr = document.createElement('span'); arr.className = 'arr'; arr.textContent = '↕'; th.appendChild(arr);
      th.addEventListener('click', function () {
        var s = table._bsmT;
        if (s.sortCol === i) s.sortAsc = !s.sortAsc; else { s.sortCol = i; s.sortAsc = true; }
        table.tHead.querySelectorAll('.arr').forEach(function (a) { a.textContent = '↕'; });
        arr.textContent = s.sortAsc ? '▲' : '▼';
        sortRows(table); apply(table);
      });
    });

    apply(table);

    // re-aplicar cuando el módulo repinta la tabla
    new MutationObserver(debounce(function () {
      if (table._bsmLock) return;
      table._bsmT.page = 1;
      if (table._bsmT.sortCol >= 0) sortRows(table);
      apply(table);
    }, 250)).observe(tbody, { childList: true });
  }

  function cellVal(row, i) {
    var c = row.cells[i]; if (!c) return '';
    var t = c.textContent.trim();
    var n = t.replace(/[S\/,%\s]/g, '').replace(',', '.');
    return (n !== '' && !isNaN(n)) ? Number(n) : t.toLowerCase();
  }

  function sortRows(table) {
    var s = table._bsmT, tbody = table.tBodies[0];
    if (s.sortCol < 0) return;
    table._bsmLock = true;
    var rows = Array.prototype.slice.call(tbody.rows);
    rows.sort(function (a, b) {
      var va = cellVal(a, s.sortCol), vb = cellVal(b, s.sortCol);
      if (typeof va === 'number' && typeof vb === 'number') return s.sortAsc ? va - vb : vb - va;
      return s.sortAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
    rows.forEach(function (r) { tbody.appendChild(r); });
    setTimeout(function () { table._bsmLock = false; }, 300);
  }

  function apply(table) {
    var s = table._bsmT, tbody = table.tBodies[0];
    var rows = Array.prototype.slice.call(tbody.rows);
    var vis = rows.filter(function (r) {
      var ok = !s.q || r.textContent.toLowerCase().indexOf(s.q) >= 0;
      r._bsmVis = ok;
      return ok;
    });
    var pages = Math.max(1, Math.ceil(vis.length / PAGE_SIZE));
    if (s.page > pages) s.page = pages;
    if (s.page < 1) s.page = 1;
    var start = (s.page - 1) * PAGE_SIZE, shown = 0;
    var idx = 0;
    rows.forEach(function (r) {
      if (!r._bsmVis) { r.style.display = 'none'; return; }
      var inPage = idx >= start && idx < start + PAGE_SIZE;
      r.style.display = inPage ? '' : 'none';
      if (inPage) shown++;
      idx++;
    });
    if (table._bsmCnt) table._bsmCnt.textContent = 'Mostrando ' + shown + ' de ' + vis.length + (vis.length !== rows.length ? ' (filtrado de ' + rows.length + ')' : '');
    var pag = table._bsmPag;
    if (pag) {
      pag.style.display = pages > 1 ? '' : 'none';
      pag.querySelector('.pi').textContent = 'Página ' + s.page + ' de ' + pages;
      pag.querySelector('.pv').disabled = s.page <= 1;
      pag.querySelector('.nx').disabled = s.page >= pages;
    }
  }

  function initTables() {
    var scan = debounce(function () {
      document.querySelectorAll('table.bs-table').forEach(enhanceTable);
    }, 400);
    scan();
    new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  }

  /* ============ 4) VALIDACIÓN SUAVE (DNI + fechas) ============ */
  function warn(el, msg) {
    el.classList.add('bsm-warn');
    var m = el.parentNode.querySelector('.bsm-warn-msg');
    if (!m) { m = document.createElement('div'); m.className = 'bsm-warn-msg'; el.parentNode.appendChild(m); }
    m.textContent = msg;
  }
  function unwarn(el) {
    el.classList.remove('bsm-warn');
    var m = el.parentNode.querySelector('.bsm-warn-msg');
    if (m) m.remove();
  }
  function initValidacion() {
    document.body.addEventListener('blur', function (e) {
      var el = e.target;
      if (!el || el.tagName !== 'INPUT') return;
      var hint = ((el.id || '') + ' ' + (el.name || '') + ' ' + (el.placeholder || '')).toLowerCase();
      if (hint.indexOf('dni') >= 0) {
        var v = el.value.trim();
        if (v && /^\d+$/.test(v) && v.length !== 8) warn(el, '⚠ Un DNI tiene 8 dígitos (tiene ' + v.length + '). Si es C.E. ignora este aviso.');
        else unwarn(el);
      }
      if (el.type === 'date' && el.value) {
        var form = el.closest('form') || document;
        var ini = null, fin = null;
        form.querySelectorAll('input[type="date"]').forEach(function (d) {
          var h = ((d.id || '') + (d.name || '')).toLowerCase();
          if (/inicio|ingreso|recepcion|denuncia|accidente/.test(h)) ini = ini || d;
          if (/fin|termino|reincorporo|levantamiento/.test(h)) fin = fin || d;
        });
        if (ini && fin && ini.value && fin.value && fin.value < ini.value) warn(fin, '⚠ La fecha fin/término es anterior a la de inicio.');
        else if (fin) unwarn(fin);
      }
    }, true);
  }

  /* ============ 5) AUTOGUARDADO DE BORRADOR ============ */
  var DRAFT_KEY = 'bsDraft:' + location.pathname.split('/').pop();
  function draftFields() {
    return Array.prototype.filter.call(document.querySelectorAll('input[id], select[id], textarea[id]'), function (el) {
      return el.type !== 'password' && el.type !== 'file' && el.type !== 'search' && !el.readOnly;
    });
  }
  function saveDraft() {
    var data = {};
    var any = false;
    draftFields().forEach(function (el) {
      var v = (el.type === 'checkbox' || el.type === 'radio') ? el.checked : el.value;
      if (v && v !== false) { data[el.id] = v; any = true; }
    });
    try {
      if (any) localStorage.setItem(DRAFT_KEY, JSON.stringify({ t: Date.now(), data: data }));
    } catch (e) {}
  }
  function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch (e) {} var b = document.getElementById('bsmDraft'); if (b) b.remove(); }
  function initDraft() {
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch (e) {}
    if (saved && saved.data && Date.now() - saved.t < 86400000) {
      var mins = Math.round((Date.now() - saved.t) / 60000);
      var ago = mins < 60 ? 'hace ' + mins + ' min' : 'hace ' + Math.round(mins / 60) + ' h';
      var bar = document.createElement('div');
      bar.id = 'bsmDraft';
      bar.innerHTML = '📝 Hay un <b>borrador guardado</b> de este formulario (' + ago + ').' +
        ' <button class="b-r">Restaurar</button><button class="b-d">Descartar</button>';
      bar.querySelector('.b-r').onclick = function () {
        Object.keys(saved.data).forEach(function (id) {
          var el = document.getElementById(id);
          if (!el) return;
          if (el.type === 'checkbox' || el.type === 'radio') el.checked = !!saved.data[id];
          else el.value = saved.data[id];
          try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
        });
        bar.remove();
      };
      bar.querySelector('.b-d').onclick = clearDraft;
      var host = document.querySelector('main') || document.querySelector('.bs-main') || document.body;
      host.insertBefore(bar, host.firstChild);
    }
    document.body.addEventListener('input', debounce(saveDraft, 800), true);
    // limpiar borrador al guardar/registrar con éxito (clic en botón de guardar)
    document.body.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (b && /guardar|registrar|crear|enviar/i.test(b.textContent || '')) setTimeout(clearDraft, 4000);
    }, true);
  }

  /* ---------- init ---------- */
  function init() {
    if (!user) return; // sin sesión no hace nada
    injectCss();
    initLoader();
    initAtrasos();
    initTables();
    initValidacion();
    initDraft();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
