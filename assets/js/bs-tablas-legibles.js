/* bs-tablas-legibles.js — _BS_TABLAS_LEGIBLES_V1 (06-nov-2026)
   Marca las celdas con texto corto (montos, fechas, códigos, DNI) para que no se partan en dos líneas.
   Solo agrega una clase CSS; no toca datos. Funciona también con tablas que se dibujan después (búsquedas, filtros). */
(function () {
  'use strict';
  var MAX = 18, pend = false;
  function marcar() {
    pend = false;
    var tds = document.querySelectorAll('.bs-main .bs-table:not(.az-tabla):not(.fi-at) tbody td:not([data-lg])');
    for (var i = 0; i < tds.length; i++) {
      var td = tds[i]; td.setAttribute('data-lg', '1');
      var t = (td.textContent || '').replace(/\s+/g, ' ').trim();
      if (t.length && t.length <= MAX && !td.querySelector('.bs-badge,[class*="chip"],[class*="badge"]')) td.classList.add('t-corto');
    }
  }
  function programar() { if (!pend) { pend = true; (window.requestAnimationFrame || setTimeout)(marcar); } }
  function iniciar() { marcar(); try { new MutationObserver(programar).observe(document.body, { childList: true, subtree: true }); } catch (e) {} }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
