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

  /* ---------- FECHAS SEGURAS (fix zona horaria Perú UTC-5) ----------
   * new Date('2024-11-04') se interpreta como medianoche UTC; al mostrarla
   * con toLocaleDateString en Lima retrocede un día (03/11/2024).
   * Estas funciones leen la fecha del TEXTO (sin conversión de zona) y solo
   * usan Date como último recurso, siempre en UTC. */
  function _pad2(n) { return ('0' + n).slice(-2); }
  window.bsFechaYMD = function (v) { // → 'YYYY-MM-DD' (para <input type=date>)
    if (v === null || v === undefined || v === '') return '';
    var s = String(v).trim();
    var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);            // ISO o ISO con hora
    if (m) return m[1] + '-' + _pad2(+m[2]) + '-' + _pad2(+m[3]);
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);              // dd/mm/yyyy
    if (m) return m[3] + '-' + _pad2(+m[2]) + '-' + _pad2(+m[1]);
    var d = new Date(s);
    if (isNaN(d.getTime())) return '';
    return d.getUTCFullYear() + '-' + _pad2(d.getUTCMonth() + 1) + '-' + _pad2(d.getUTCDate());
  };
  window.bsFechaDMY = function (v) { // → 'dd/mm/yyyy' (para mostrar en tablas)
    var ymd = window.bsFechaYMD(v);
    if (!ymd) return '-';
    var p = ymd.split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  };

  /* ---------- SESIÓN CON TOKEN (seguridad backend) ---------- */
  window.bsToken = function () {
    try {
      var u = JSON.parse(localStorage.getItem('bienestarSocialAuth') || 'null');
      return (u && u.token) || '';
    } catch (e) { return ''; }
  };
  // Si el backend responde code:401 (token inválido/expirado) → volver al login
  window.bsSesionInvalida = function (res) {
    if (res && res.code === 401) {
      try { localStorage.removeItem('bienestarSocialAuth'); } catch (e) {}
      try {
        Object.keys(localStorage).forEach(function (k) { if (k.indexOf('bs_cache_') === 0) localStorage.removeItem(k); });
        Object.keys(sessionStorage).forEach(function (k) { if (k.indexOf('bs_cache_') === 0) sessionStorage.removeItem(k); });
      } catch (e) {}
      var enModulo = location.pathname.indexOf('/modulos/') >= 0;
      location.href = enModulo ? '../index.html' : 'index.html';
      return true;
    }
    return false;
  };

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
      '#bsmDraft .b-r{background:#0a3d91;color:#fff}#bsmDraft .b-d{background:#e2e8f0;color:#334155}' +
      /* chips de estado + totales */
      '.bsm-tb .est{display:flex;gap:6px;flex-wrap:wrap;}' +
      '.bsm-chip{background:#eef2f7;border:1px solid #e2e8f0;border-radius:999px;padding:4px 10px;font-size:.72rem;font-weight:700;color:#334155;cursor:pointer;}' +
      '.bsm-chip:hover{background:#0a3d91;color:#fff;}' +
      '.bsm-chip b{color:#0a3d91;}.bsm-chip:hover b{color:#ffd7a6;}' +
      '.bsm-tot{font-size:.78rem;color:#475569;margin:8px 0 0;font-family:Inter,system-ui,sans-serif;text-align:right;}' +
      '.bsm-tot b{color:#0a3d91;}' +
      /* overlay generico (ficha / leyenda) */
      '#bsmOverlay{position:fixed;inset:0;background:rgba(10,37,64,.6);z-index:99998;display:flex;align-items:center;justify-content:center;padding:18px;}' +
      '#bsmOverlay .fbox{background:#fff;border-radius:14px;max-width:640px;width:100%;max-height:88vh;overflow:auto;box-shadow:0 20px 50px rgba(0,0,0,.3);font-family:Inter,system-ui,sans-serif;}' +
      '#bsmOverlay .fh{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid #e2e8f0;font-weight:800;color:#0a3d91;position:sticky;top:0;background:#fff;}' +
      '#bsmOverlay .fx{background:#eef2f7;border:none;width:28px;height:28px;border-radius:7px;cursor:pointer;font-size:.9rem;color:#475569;}' +
      '#bsmOverlay .fb{padding:14px 18px;}' +
      '#bsmOverlay .fi{display:flex;gap:10px;padding:6px 0;border-bottom:1px dashed #eef2f7;font-size:.85rem;}' +
      '#bsmOverlay .fk{min-width:180px;font-weight:700;color:#64748b;font-size:.74rem;text-transform:uppercase;padding-top:2px;}' +
      '#bsmOverlay .fv{flex:1;color:#1a202c;word-break:break-word;}' +
      '#bsmOverlay .gl{padding:5px 0;font-size:.85rem;color:#334155;line-height:1.5;}' +
      '#bsmOverlay .gl b{color:#0a3d91;}' +
      '#bsmLeyBtn{position:fixed;left:18px;bottom:18px;z-index:9999;width:42px;height:42px;border-radius:50%;border:none;background:#0a3d91;color:#fff;font-size:1.15rem;font-weight:800;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.25);}' +
      '#bsmLeyBtn:hover{background:#E2231A;}' +
      '#bsmWspBtn{position:fixed;left:18px;bottom:70px;z-index:9999;width:46px;height:46px;border-radius:50%;background:#25d366;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,.28);transition:transform .15s ease;}' +
      '#bsmWspBtn:hover{transform:scale(1.08);}' +
      '#bsmWspBtn svg{width:26px;height:26px;fill:#fff;}' +
      'tbody tr[data-bsm-i]{cursor:pointer;}' +
      /* evidencias en la ficha */
      '#bsmEvid{margin-top:14px;border-top:2px solid #eef2f7;padding-top:10px;}' +
      '#bsmEvid .et{font-weight:800;font-size:.8rem;color:#0a3d91;text-transform:uppercase;letter-spacing:.03em;margin-bottom:8px;}' +
      '#bsmEvid .ei{display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px dashed #eef2f7;font-size:.82rem;}' +
      '#bsmEvid .ei a{color:#0a3d91;font-weight:700;text-decoration:none;flex:1;word-break:break-all;}' +
      '#bsmEvid .ei a:hover{text-decoration:underline;}' +
      '#bsmEvid .ei .ef{font-size:.7rem;color:#94a3b8;white-space:nowrap;}' +
      '#bsmEvid .eb{margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;}' +
      '#bsmEvid .eb button{background:#0a3d91;color:#fff;border:none;border-radius:9px;padding:8px 14px;font-size:.78rem;font-weight:700;cursor:pointer;font-family:inherit;}' +
      '#bsmEvid .eb button:disabled{opacity:.5;cursor:wait;}' +
      '#bsmEvid .em2{font-size:.74rem;color:#64748b;}' +
      '#bsmEvid .em2.err{color:#b91c1c;font-weight:700;}' +
      '#bsmEvid .em2.okk{color:#15803d;font-weight:700;}' +
      /* resumen estados por año */
      '.bsm-res{background:#fff;border:1px solid #e6ebf2;border-radius:12px;padding:12px 16px;margin:0 0 12px;font-family:Inter,system-ui,sans-serif;box-shadow:0 1px 4px rgba(15,23,42,.05);}' +
      '.bsm-res .rt{font-weight:800;font-size:.82rem;color:#0a3d91;margin-bottom:6px;text-transform:uppercase;letter-spacing:.03em;}' +
      '.bsm-res .ry{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;padding:6px 0;border-bottom:1px dashed #eef2f7;font-size:.8rem;color:#475569;}' +
      '.bsm-res .ry:last-child{border-bottom:none;}' +
      '.bsm-res .ry .y{font-weight:800;color:#0a3d91;min-width:46px;font-size:.9rem;}' +
      '.bsm-res .ry .n{font-weight:700;color:#334155;}' +
      '.bsm-res .ry .m{font-weight:800;color:#15803d;}' +
      '.bsm-res .ry .e{background:#eef2f7;border-radius:999px;padding:2px 9px;font-size:.7rem;font-weight:700;color:#334155;}' +
      '.bsm-res .re{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;padding:7px 10px;border-radius:9px;background:#f0f5ff;margin-bottom:6px;font-size:.8rem;color:#475569;}' +
      '.bsm-res .re.rapel{background:#fdf0e0;}' +
      '.bsm-res .re .en{font-weight:800;color:#0a3d91;min-width:76px;}' +
      '.bsm-res .re.rapel .en{color:#b45309;}' +
      '.bsm-res .re .n{font-weight:700;}' +
      '.bsm-res .re .m{font-weight:800;color:#15803d;}' +
      '.bsm-res .ry .emp{font-size:.68rem;font-weight:700;color:#64748b;background:#f7fafc;border:1px dashed #e2e8f0;border-radius:999px;padding:2px 8px;}';
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
      body: JSON.stringify({ action: 'bs_alertas', token: window.bsToken(), permisos: user.permisos || {} })
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
  var Q_MEM = {}; // recuerda la búsqueda aunque el módulo re-pinte la tabla

  function enhanceTable(table) {
    if (table._bsmT || !table.tHead || !table.tBodies.length) return;
    var tbody = table.tBodies[0];
    if (tbody.rows.length < 2) return; // esperar datos
    bsmPrep(tbody);
    var qKey = Array.prototype.indexOf.call(document.querySelectorAll('table.bs-table'), table);
    table._bsmT = { page: 1, q: (Q_MEM[qKey] || ''), sortCol: -1, sortAsc: true, qKey: qKey };

    var wrap = table.closest('.bs-table-wrap') || table;

    // toolbar
    var tb = document.createElement('div');
    tb.className = 'bsm-tb';
    tb.innerHTML = '<input type="search" placeholder="🔍 Buscar en la tabla (nombre, DNI, sector...)">' +
      '<span class="est"></span><span class="cnt"></span>';
    wrap.parentNode.insertBefore(tb, wrap);
    if (MOD_KEY && MOD_KEY !== 'subsidio') {
      var resx = document.createElement('div');
      resx.className = 'bsm-res';
      resx.style.display = 'none';
      tb.parentNode.insertBefore(resx, tb);
      table._bsmRes = resx;
    }
    var inp = tb.querySelector('input');
    if (table._bsmT.q) inp.value = Q_MEM[qKey + '_raw'] || table._bsmT.q;
    inp.addEventListener('input', debounce(function () {
      table._bsmT.q = inp.value.trim().toLowerCase();
      Q_MEM[qKey] = table._bsmT.q;
      Q_MEM[qKey + '_raw'] = inp.value;
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
    table._bsmEst = tb.querySelector('.est');

    // totales del filtro
    var tot = document.createElement('div');
    tot.className = 'bsm-tot';
    pag.parentNode.insertBefore(tot, pag);
    table._bsmTot = tot;

    // chips de estado: clic = filtrar por ese estado
    table._bsmEst.addEventListener('click', function (e) {
      var ch = e.target.closest('.bsm-chip');
      if (!ch) return;
      inp.value = (inp.value.trim() === ch.getAttribute('data-q')) ? '' : ch.getAttribute('data-q');
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // ficha de detalle al hacer clic en la fila
    tbody.addEventListener('click', function (e) {
      if (e.target.closest('button,a,input,select,textarea')) return;
      var tr = e.target.closest('tr');
      if (!tr) return;
      var i = parseInt(tr.getAttribute('data-bsm-i'));
      var data = window.__BS_EXPORT_DATA__;
      if (!data || isNaN(i) || !data[i]) return;
      bsmFicha(data[i]);
    });

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
      bsmPrep(tbody);
      table._bsmT.page = 1;
      if (table._bsmT.sortCol >= 0) sortRows(table);
      apply(table);
    }, 120)).observe(tbody, { childList: true });
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

    // chips de conteo por estado (de lo visible)
    if (table._bsmEst) {
      var counts = {};
      vis.forEach(function (r) {
        var b = r.querySelector('.bs-badge');
        if (b) { var t = b.textContent.trim(); if (t && t !== '-') counts[t] = (counts[t] || 0) + 1; }
      });
      var ks = Object.keys(counts);
      table._bsmEst.innerHTML = ks.length > 1 ? ks.map(function (k) {
        return '<span class="bsm-chip" data-q="' + esc(k) + '" title="Clic para filtrar">' + esc(k) + ' <b>' + counts[k] + '</b></span>';
      }).join('') : '';
    }

    // totales de columnas de dinero/días (de lo filtrado)
    if (table._bsmTot) {
      var hs = table.tHead.rows[0].cells, parts = [];
      for (var hi = 0; hi < hs.length; hi++) {
        var hName = hs[hi].textContent.replace(/[↕▲▼]/g, '').trim();
        if (!/monto|pago|recuper|d[ií]as|reembolso/i.test(hName) || /%/.test(hName)) continue;
        var sum = 0, any = false;
        vis.forEach(function (r) {
          var c = r.cells[hi]; if (!c) return;
          var n = parseFloat(String(c.textContent).replace(/[^0-9.\-]/g, ''));
          if (!isNaN(n)) { sum += n; any = true; }
        });
        if (any) parts.push(esc(hName) + ': <b>' + (/d[ií]as/i.test(hName)
          ? Math.round(sum).toLocaleString('es-PE')
          : 'S/ ' + sum.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) + '</b>');
      }
      table._bsmTot.innerHTML = parts.length ? 'Σ Total del filtro — ' + parts.join(' &nbsp;·&nbsp; ') : '';
    }

    if (table._bsmRes) bsmResumen(table);
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
    }, 80);
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

  /* ============ FILAS: fechas legibles + índice para ficha ============ */
  function bsmPrep(tbody) {
    var rows = tbody.rows;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (r.getAttribute('data-bsm-i') === null) r.setAttribute('data-bsm-i', i);
      for (var j = 0; j < r.cells.length; j++) {
        var c = r.cells[j];
        if (c.children.length) continue;
        var m = c.textContent.trim().match(/^(\d{4})-(\d{2})-(\d{2})([T ].*)?$/);
        if (m) c.textContent = m[3] + '/' + m[2] + '/' + m[1];
      }
    }
  }

  /* ============ OVERLAY GENÉRICO (ficha / leyenda) ============ */
  function bsmOverlay(titulo, bodyHtml) {
    var old = document.getElementById('bsmOverlay');
    if (old) old.remove();
    var ov = document.createElement('div');
    ov.id = 'bsmOverlay';
    ov.innerHTML = '<div class="fbox"><div class="fh">' + titulo + ' <button class="fx" title="Cerrar">✕</button></div><div class="fb">' + bodyHtml + '</div></div>';
    ov.addEventListener('click', function (e) {
      if (e.target === ov || e.target.classList.contains('fx')) ov.remove();
    });
    document.body.appendChild(ov);
  }

  function bsmFicha(o) {
    var html = Object.keys(o).filter(function (k) {
      var v = o[k];
      return v !== '' && v !== null && v !== undefined;
    }).map(function (k) {
      var v = String(o[k]);
      var m = v.match(/^(\d{4})-(\d{2})-(\d{2})([T ].*)?$/);
      if (m) v = m[3] + '/' + m[2] + '/' + m[1];
      var lbl = k.replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
      return '<div class="fi"><span class="fk">' + esc(lbl) + '</span><span class="fv">' + esc(v) + '</span></div>';
    }).join('');

    // sección de evidencias (solo si el caso tiene ID y estamos en un módulo)
    var evid = '';
    if (MOD_KEY && o.id) {
      evid = '<div id="bsmEvid">' +
        '<div class="et">📎 Evidencias del caso (capturas, informes, declaraciones)</div>' +
        '<div id="bsmEvidList"><span class="em2">Cargando evidencias…</span></div>' +
        '<div class="eb">' +
          '<input type="file" id="bsmEvidFile" accept="image/*,application/pdf" multiple style="display:none;">' +
          '<button id="bsmEvidBtn" type="button">📤 Subir evidencia</button>' +
          '<span class="em2" id="bsmEvidMsg">Imagen o PDF · máx. 6 MB por archivo</span>' +
        '</div></div>';
    }

    bsmOverlay('📄 Detalle del registro', (html || '<p>Sin datos.</p>') + evid);
    if (MOD_KEY && o.id) bsmEvidInit(o.id);
  }

  /* ============ EVIDENCIAS: listar + subir a Drive vía GAS ============ */
  function bsmEvidInit(casoId) {
    var btn = document.getElementById('bsmEvidBtn');
    var inp = document.getElementById('bsmEvidFile');
    if (!btn || !inp) return;
    btn.onclick = function () { inp.click(); };
    inp.onchange = function () { bsmEvidSubir(casoId, inp.files); };
    bsmEvidCargar(casoId);
  }

  function bsmEvidCargar(casoId) {
    var list = document.getElementById('bsmEvidList');
    if (!list) return;
    fetch(API_URL, {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'bs_listarDocumentos', token: window.bsToken(), modulo: MOD_KEY, caso_id: casoId })
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (!list.isConnected) return;
      if (!d || !d.ok) { list.innerHTML = '<span class="em2 err">No se pudieron cargar (¿backend de evidencias instalado?).</span>'; return; }
      if (!d.items || !d.items.length) { list.innerHTML = '<span class="em2">Sin evidencias aún. Sube la primera con el botón de abajo.</span>'; return; }
      list.innerHTML = d.items.map(function (f) {
        var ico = /pdf/i.test(f.mime || '') ? '📄' : '🖼️';
        return '<div class="ei">' + ico + ' <a href="' + esc(f.url) + '" target="_blank" rel="noopener">' + esc(f.nombre) + '</a>' +
          '<span class="ef">' + esc(f.subido_por || '') + (f.fecha ? ' · ' + esc(f.fecha) : '') + '</span></div>';
      }).join('');
    }).catch(function () {
      if (list.isConnected) list.innerHTML = '<span class="em2 err">Error de conexión al cargar evidencias.</span>';
    });
  }

  function bsmEvidSubir(casoId, files) {
    var btn = document.getElementById('bsmEvidBtn');
    var msg = document.getElementById('bsmEvidMsg');
    if (!files || !files.length) return;
    var lista = Array.prototype.slice.call(files);
    var pend = lista.length, errores = 0;
    btn.disabled = true;

    lista.forEach(function (file) {
      if (file.size > 6 * 1024 * 1024) {
        errores++; pend--;
        msg.className = 'em2 err'; msg.textContent = '"' + file.name + '" supera 6 MB.';
        if (!pend) fin();
        return;
      }
      msg.className = 'em2'; msg.textContent = 'Subiendo ' + file.name + '…';
      var fr = new FileReader();
      fr.onload = function () {
        var b64 = String(fr.result).split(',')[1] || '';
        fetch(API_URL, {
          method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'bs_subirDocumento', token: window.bsToken(), modulo: MOD_KEY, caso_id: casoId,
            nombre: file.name, mime: file.type || 'application/octet-stream',
            base64: b64, usuario: (user && (user.nombre || user.usuario)) || ''
          })
        }).then(function (r) { return r.json(); }).then(function (d) {
          if (!d || !d.ok) errores++;
          pend--; if (!pend) fin();
        }).catch(function () { errores++; pend--; if (!pend) fin(); });
      };
      fr.onerror = function () { errores++; pend--; if (!pend) fin(); };
      fr.readAsDataURL(file);
    });

    function fin() {
      btn.disabled = false;
      var inp = document.getElementById('bsmEvidFile');
      if (inp) inp.value = '';
      if (errores) { msg.className = 'em2 err'; msg.textContent = '⚠ ' + errores + ' archivo(s) no se subieron. Revisa tamaño/formato o el backend.'; }
      else { msg.className = 'em2 okk'; msg.textContent = '✅ Evidencia(s) guardada(s) en Drive.'; }
      bsmEvidCargar(casoId);
    }
  }

  /* ============ RESUMEN "ESTADOS POR AÑO" (genérico) ============ */
  function bsmResumen(table) {
    var box = table._bsmRes;
    var data = window.__BS_EXPORT_DATA__;
    if (!box) return;
    if (!data || !data.length) { box.style.display = 'none'; return; }

    var muestra = data[0];
    var estKey = ['estado_general', 'estado_caso', 'estado', 'status', 'situacion'].filter(function (k) { return muestra[k] !== undefined; })[0];
    var fechaKeys = ['anio', 'fecha_recepcion', 'dia_accidente', 'fecha_denuncia', 'fecha', 'inicio', 'created_at'];

    function anioDe(it) {
      if (it.anio) return String(it.anio);
      for (var i = 1; i < fechaKeys.length; i++) {
        var v = it[fechaKeys[i]];
        if (!v) continue;
        var m = String(v).match(/(\d{4})/);
        if (m) return m[1];
      }
      return null;
    }
    var montoKey = ['monto_total', 'monto', 'importe'].filter(function (k) { return muestra[k] !== undefined; })[0];
    function montoDe(it) {
      if (!montoKey) return 0;
      var n = parseFloat(String(it[montoKey]).replace(/[^0-9.\-]/g, ''));
      return isNaN(n) ? 0 : n;
    }

    var tieneEmpresa = muestra.empresa !== undefined;
    var porAnio = {}, porEmp = {}, tieneAnio = false;
    data.forEach(function (it) {
      var emp = tieneEmpresa ? (String(it.empresa || '').trim().toUpperCase() || 'SIN EMPRESA') : null;
      if (emp) {
        if (!porEmp[emp]) porEmp[emp] = { n: 0, m: 0, est: {} };
        porEmp[emp].n++;
        porEmp[emp].m += montoDe(it);
        if (estKey) {
          var ee = String(it[estKey] || '').trim().toUpperCase() || 'SIN ESTADO';
          porEmp[emp].est[ee] = (porEmp[emp].est[ee] || 0) + 1;
        }
      }
      var a = anioDe(it);
      if (!a) return;
      tieneAnio = true;
      if (!porAnio[a]) porAnio[a] = { n: 0, m: 0, est: {}, emp: {} };
      porAnio[a].n++;
      porAnio[a].m += montoDe(it);
      if (emp) porAnio[a].emp[emp] = (porAnio[a].emp[emp] || 0) + 1;
      if (estKey) {
        var e = String(it[estKey] || '').trim().toUpperCase() || 'SIN ESTADO';
        porAnio[a].est[e] = (porAnio[a].est[e] || 0) + 1;
      }
    });
    if (!tieneAnio && !Object.keys(porEmp).length) { box.style.display = 'none'; return; }

    var F = function (n) { return 'S/ ' + n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };

    // bloque por empresa (solo si hay más de una)
    var emps = Object.keys(porEmp).sort();
    var htmlEmp = '';
    if (emps.length > 1) {
      htmlEmp = '<div class="rt">🏢 Resumen por empresa</div>' + emps.map(function (em) {
        var d = porEmp[em];
        var chips = Object.keys(d.est).sort().map(function (e) {
          return '<span class="e">' + esc(e) + ' ' + d.est[e] + '</span>';
        }).join(' ');
        return '<div class="re ' + (em === 'RAPEL' ? 'rapel' : '') + '"><span class="en">' + esc(em) + '</span>' +
          '<span class="n">' + d.n + ' caso' + (d.n === 1 ? '' : 's') + '</span>' +
          (montoKey && d.m ? '<span class="m">' + F(d.m) + '</span>' : '') +
          chips + '</div>';
      }).join('') + '<div style="height:8px;"></div>';
    }

    var anios = Object.keys(porAnio).sort().reverse();
    box.innerHTML = htmlEmp + '<div class="rt">📊 Resumen por año y estado</div>' + anios.map(function (a) {
      var d = porAnio[a];
      var chips = Object.keys(d.est).sort().map(function (e) {
        return '<span class="e">' + esc(e) + ' ' + d.est[e] + '</span>';
      }).join(' ');
      var empChips = Object.keys(d.emp || {}).sort().map(function (em) {
        return '<span class="emp">' + esc(em) + ' ' + d.emp[em] + '</span>';
      }).join(' ');
      return '<div class="ry"><span class="y">' + esc(a) + '</span>' +
        '<span class="n">' + d.n + ' caso' + (d.n === 1 ? '' : 's') + '</span>' +
        (montoKey && d.m ? '<span class="m">' + F(d.m) + '</span>' : '') +
        empChips + ' ' + chips + '</div>';
    }).join('');
    box.style.display = 'block';
  }

  /* ============ LEYENDA DE ESTADOS POR MÓDULO ============ */
  var GLOSARIOS = {
    subsidio: [
      ['🔵 En Proceso', 'El trámite está en gestión, aún sin presentar o en revisión.'],
      ['🔵 Por Cobrar / Pendiente', 'Ya se pagó al trabajador; falta que EsSalud reembolse a la empresa.'],
      ['🟢 Pagado', 'La empresa ya pagó el subsidio al trabajador.'],
      ['🟢 Cobrado / Recuperado', 'EsSalud ya devolvió el dinero a la empresa. Este monto suma al total RECUPERADO del año.'],
      ['🟠 No Recuperable', 'No aplica reembolso de EsSalud (fuera de plazo, no cumple requisitos, etc.).']
    ],
    queja: [
      ['🔵 En Proceso / Pendiente', 'La queja fue registrada y está en atención o esperando acción correctiva.'],
      ['🟢 Resuelta / Finalizada', 'Se aplicó la acción correctiva y el caso quedó cerrado.'],
      ['🔴 Vencida', 'Pasó el plazo de atención según el RIT sin resolverse — requiere reporte.']
    ],
    accidente: [
      ['🔵 En Seguimiento', 'El trabajador está en atención médica; se registran seguimientos periódicos.'],
      ['🟢 Cerrado / Reincorporado', 'El caso terminó: alta médica y reincorporación del trabajador.'],
      ['🟠 Con restricción', 'El trabajador se reincorporó con restricciones médicas temporales.']
    ],
    hostigamiento: [
      ['🔴 Confidencial', 'Módulo con acceso restringido (Ley 29733). No compartas capturas ni nombres.'],
      ['🔵 En investigación', 'Denuncia en proceso — medidas de protección en 3 días hábiles (Ley 27942).'],
      ['🟢 Concluido', 'Investigación cerrada con decisión emitida.']
    ],
    rendici: [
      ['🔵 Pendiente', 'Rendición registrada, falta sustento o depósito por regularizar.'],
      ['🟢 Depositado / Cerrado', 'Rendición completa con depósito confirmado.']
    ]
  };
  function initLeyenda() {
    if (!MOD_KEY || !GLOSARIOS[MOD_KEY]) return;
    var b = document.createElement('button');
    b.id = 'bsmLeyBtn';
    b.textContent = '?';
    b.title = 'Ver qué significa cada estado';
    b.onclick = function () {
      var html = GLOSARIOS[MOD_KEY].map(function (g) {
        return '<div class="gl"><b>' + g[0] + '</b> — ' + g[1] + '</div>';
      }).join('') +
      '<div class="gl" style="margin-top:8px;border-top:1px solid #eef2f7;padding-top:8px;">💡 <b>Consejos:</b> haz clic en una fila para ver la ficha completa del registro · clic en un encabezado para ordenar · usa los chips de estado para filtrar con un clic.</div>';
      bsmOverlay('❓ Guía de estados de este módulo', html);
    };
    document.body.appendChild(b);
  }

  /* ============ SOPORTE POR WHATSAPP (reportar fallas con captura) ============ */
  var BSM_WSP_SOPORTE = '51994190769'; // Joel A. Timoteo — soporte del sistema
  function initSoporte() {
    if (!BSM_WSP_SOPORTE || document.getElementById('bsmWspBtn')) return;
    var msg = '🛟 *SOPORTE · SISTEMA DE BIENESTAR SOCIAL*\n' +
      '👤 Usuario: ' + ((user && (user.nombre || user.usuario)) || '—') + '\n' +
      '📄 Página: ' + document.title + '\n' +
      '🕐 ' + new Date().toLocaleString('es-PE') + '\n\n' +
      'Hola Joel, encontré un problema en el sistema. Te adjunto la captura de pantalla:';
    var b = document.createElement('a');
    b.id = 'bsmWspBtn';
    b.href = 'https://wa.me/' + BSM_WSP_SOPORTE + '?text=' + encodeURIComponent(msg);
    b.target = '_blank';
    b.rel = 'noopener';
    b.title = '¿Algo falló? Repórtalo por WhatsApp y adjunta tu captura';
    b.innerHTML = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>';
    document.body.appendChild(b);
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
    initLeyenda();
    initSoporte();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
