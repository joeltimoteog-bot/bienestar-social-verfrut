/* _BS_MODULOS_PRO_V1 (27-oct-2026): los bloques de resumen (por empresa / por año) quedan PLEGADOS
   bajo un boton, para que la tabla quede a la vista. Se recuerda abierto/cerrado. Solo presentacion. */
(function () {
  'use strict';
  if (window._BS_MODULOS_PRO_V1) return; window._BS_MODULOS_PRO_V1 = true;
  var KEY = 'bsmp_res_abierto';
  function abierto() { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } }
  function plegar() {
    var res = document.querySelectorAll('.bsm-res');
    Array.prototype.forEach.call(res, function (r) {
      if (r.getAttribute('data-bsmp')) return;
      r.setAttribute('data-bsmp', '1');
      var b = document.createElement('button'); b.type = 'button'; b.className = 'bsmp-tg';
      b.innerHTML = '📊 Resumen por empresa y por año <span class="fl">▼</span>';
      var set = function (on) { r.classList.toggle('bsmp-oculto', !on); b.classList.toggle('abierto', on); };
      b.onclick = function () { var on = r.classList.contains('bsmp-oculto'); set(on); try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {} };
      r.parentNode.insertBefore(b, r);
      set(abierto());
    });
  }
  function iniciar() {
    plegar();
    if (window.MutationObserver) new MutationObserver(plegar).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
