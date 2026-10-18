/* =========================================================================
 * BS-CORE · Funciones compartidas por todos los módulos
 * Bienestar Social · Unifrutti Group
 * -------------------------------------------------------------------------
 * Antes, api(), esc() y logout() estaban copiadas en cada módulo (10 veces).
 * Ahora viven aquí: un arreglo se hace una sola vez y aplica a todo el sistema.
 *
 * USO: <script src="../assets/js/bs-core.js"></script> en el <head>, después
 *      de modal-system.js y bs-mejoras.js. Cada módulo sigue declarando su
 *      BS_API_URL; estas funciones la leen al momento de llamarlas.
 * ========================================================================= */
(function () {
  'use strict';
  if (window.__BS_CORE__) return; window.__BS_CORE__ = true;

  function urlApi() {
    try { if (typeof BS_API_URL === 'string' && BS_API_URL) return BS_API_URL; } catch (e) {}
    return window.BS_API_URL || 'https://script.google.com/macros/s/AKfycbyJIUtdpApEc35Jj4ZNP-3ONqGe64J1VhaRvkt87vVUNTgSagrOgOS0T99eIt0-w3Yi/exec';
  }

  /* ---- Llamada al backend (token automático, manejo de 401 y errores legibles) ---- */
  window.api = async function api(action, payload) {
    var res;
    try {
      res = await fetch(urlApi(), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(Object.assign({ action: action, token: (window.bsToken ? bsToken() : '') }, payload || {}))
      });
    } catch (e) {
      throw new Error('Sin conexión con el servidor. Verifica tu internet e intenta de nuevo.');
    }
    if (!res.ok) throw new Error('El servidor respondió con error ' + res.status + '. Intenta de nuevo.');
    var j;
    try { j = await res.json(); } catch (e) { throw new Error('Respuesta inválida del servidor. Intenta de nuevo en unos segundos.'); }
    if (window.bsSesionInvalida && bsSesionInvalida(j)) throw new Error('Sesión expirada. Vuelve a iniciar sesión.');
    return j;
  };

  /* ---- Escape HTML ---- */
  window.esc = function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  /* ---- Cerrar sesión (limpia sesión y cachés) ---- */
  window.logout = async function logout() {
    var ok = window.appConfirm ? await appConfirm('¿Cerrar sesión?') : window.confirm('¿Cerrar sesión?');
    if (!ok) return;
    try {
      localStorage.removeItem('bienestarSocialAuth');
      Object.keys(localStorage).forEach(function (k) { if (k.indexOf('bs_cache_') === 0) localStorage.removeItem(k); });
      Object.keys(sessionStorage).forEach(function (k) { if (k.indexOf('bs_cache_') === 0) sessionStorage.removeItem(k); });
    } catch (e) {}
    window.location.href = (location.pathname.indexOf('/modulos/') >= 0 ? '../' : '') + 'index.html';
  };

  /* ---- Utilidades de formato (disponibles para módulos nuevos) ---- */
  window.bsSoles = function (n) { return 'S/ ' + (Number(n) || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  window.bsFecha = function (v) { return v ? (window.bsFechaDMY ? bsFechaDMY(v) : v) : '—'; };
  window.bsEsAdmin = function (u) { u = u || {}; return /admin|geren/i.test(u.rol || '') || ['jtimoteo', 'ovilela'].indexOf(String(u.usuario || '').toLowerCase()) >= 0; };
})();
