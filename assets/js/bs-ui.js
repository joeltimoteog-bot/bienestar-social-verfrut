/* =========================================================================
 * BS-UI · Movimiento sutil y profesional
 * Bienestar Social · Unifrutti Group
 * -------------------------------------------------------------------------
 * Acompaña a bs-theme-pro.css. Hace tres cosas y nada más:
 *   1) Entrada escalonada de tarjetas, KPIs y tablas al aparecer en pantalla.
 *   2) Contadores que suben hasta su valor (respeta S/, %, miles y decimales).
 *   3) Barra de progreso fina durante las llamadas al backend.
 * Respeta "prefers-reduced-motion" y no toca ninguna lógica del sistema.
 *
 * USO: <script src="../assets/js/bs-ui.js"></script>  (al final del <head>)
 * ========================================================================= */
(function () {
  'use strict';

  var REDUCIR = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SEL = '.bs-card, .bs-kpi, .bs-hero, .bs-module-card, .bs-table-wrap, .bs-alert';

  /* ---------------- 1. Entrada escalonada ---------------- */
  var io = null;
  function prepararEntrada(raiz) {
    if (REDUCIR || !window.IntersectionObserver) return;
    if (!io) {
      io = new IntersectionObserver(function (entradas) {
        entradas.forEach(function (e) {
          if (!e.isIntersecting) return;
          var el = e.target;
          io.unobserve(el);
          var i = parseInt(el.getAttribute('data-bsp-i') || '0', 10);
          el.style.animationDelay = Math.min(i * 55, 420) + 'ms';
          el.classList.add('bsp-anim');
          el.style.visibility = '';
        });
      }, { rootMargin: '0px 0px -40px 0px', threshold: .04 });
    }
    var nodos = (raiz || document).querySelectorAll(SEL);
    var n = 0;
    Array.prototype.forEach.call(nodos, function (el) {
      if (el.hasAttribute('data-bsp-listo')) return;
      el.setAttribute('data-bsp-listo', '1');
      el.setAttribute('data-bsp-i', n++);
      el.style.visibility = 'hidden';
      io.observe(el);
      // Red de seguridad: si el observer no dispara, el elemento se ve igual
      setTimeout(function () { if (el.style.visibility === 'hidden') { el.style.visibility = ''; el.classList.add('bsp-anim'); } }, 1200);
    });
  }

  /* ---------------- 2. Contadores ---------------- */
  /* Descompone "S/ 1,234.50" o "87 %" en prefijo + número + sufijo */
  function partes(t) {
    var m = String(t).match(/^(\D*?)([\d.,]+)(.*)$/);
    if (!m) return null;
    var crudo = m[2];
    var decimales = 0;
    var normal = crudo;
    // es/PE: el punto separa miles y la coma decimales solo si hay 1-2 dígitos al final
    if (/,\d{1,2}$/.test(crudo)) { normal = crudo.replace(/\./g, '').replace(',', '.'); }
    else { normal = crudo.replace(/,/g, ''); }
    var num = parseFloat(normal);
    if (isNaN(num)) return null;
    var pd = normal.indexOf('.');
    if (pd >= 0) decimales = Math.min(2, normal.length - pd - 1);
    return { pre: m[1], num: num, suf: m[3], dec: decimales };
  }
  function formatear(n, dec) {
    return n.toLocaleString('es-PE', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }
  function contar(el) {
    /* __bspRun evita que el propio repintado del contador se detecte como
       cambio del DOM y reinicie la cuenta en bucle */
    if (REDUCIR || el.__bspRun || el.getAttribute('data-bsp-cont') === el.textContent) return;
    var p = partes(el.textContent);
    if (!p || p.num === 0 || Math.abs(p.num) > 1e12) return;
    var destino = p.num, ini = performance.now(), dur = Math.min(1100, 380 + Math.abs(destino) * 3);
    el.__bspRun = true;
    function paso(t) {
      var k = Math.min(1, (t - ini) / dur);
      var e = 1 - Math.pow(1 - k, 3);           // easeOutCubic
      el.textContent = p.pre + formatear(destino * e, p.dec) + p.suf;
      if (k < 1) { requestAnimationFrame(paso); return; }
      el.textContent = p.pre + formatear(destino, p.dec) + p.suf;
      el.setAttribute('data-bsp-cont', el.textContent);
      el.__bspRun = false;
    }
    requestAnimationFrame(paso);
  }
  function contarEn(raiz) {
    var nodos = (raiz || document).querySelectorAll('.bs-kpi .v, .rec-kpi .v, [data-bsp-contar]');
    Array.prototype.forEach.call(nodos, contar);
  }

  /* ---------------- 3. Barra de progreso de red ---------------- */
  var barra, activas = 0, tOcultar;
  function crearBarra() {
    if (barra) return barra;
    barra = document.createElement('div');
    barra.id = 'bspBarra';
    barra.style.cssText = 'position:fixed;top:0;left:0;height:3px;width:0;z-index:99999;' +
      'background:linear-gradient(90deg,#dc2626,#f05252);box-shadow:0 0 10px rgba(220,38,38,.6);' +
      'transition:width .3s ease,opacity .3s ease;opacity:0;pointer-events:none;';
    document.body.appendChild(barra);
    return barra;
  }
  function subir() {
    if (REDUCIR) return;
    activas++;
    var b = crearBarra();
    clearTimeout(tOcultar);
    b.style.opacity = '1';
    b.style.width = Math.min(88, 24 + activas * 14) + '%';
  }
  function bajar() {
    if (REDUCIR || !barra) return;
    activas = Math.max(0, activas - 1);
    if (activas > 0) return;
    barra.style.width = '100%';
    tOcultar = setTimeout(function () { barra.style.opacity = '0'; barra.style.width = '0'; }, 320);
  }
  function engancharFetch() {
    if (!window.fetch || window.__bspFetch) return;
    window.__bspFetch = true;
    var original = window.fetch;
    window.fetch = function () {
      subir();
      return original.apply(this, arguments).then(
        function (r) { bajar(); return r; },
        function (e) { bajar(); throw e; }
      );
    };
  }

  /* ---------------- arranque ---------------- */
  function iniciar() {
    engancharFetch();
    prepararEntrada(document);
    contarEn(document);

    /* El sistema pinta tablas y KPIs de forma asíncrona: se vigila el DOM */
    if (window.MutationObserver) {
      var pendiente = null;
      new MutationObserver(function (muts) {
        var hay = false;
        muts.forEach(function (m) { if (m.addedNodes && m.addedNodes.length) hay = true; });
        if (!hay) return;
        clearTimeout(pendiente);
        pendiente = setTimeout(function () { prepararEntrada(document); contarEn(document); }, 120);
      }).observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();

  window.BSUi = { animar: prepararEntrada, contar: contarEn };
})();
