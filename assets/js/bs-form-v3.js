/* =========================================================================
 * BS-FORM-V3 · Mejoras de experiencia en los formularios (2027)
 * Bienestar Social · Unifrutti Group
 * -------------------------------------------------------------------------
 * Capa ADITIVA. No modifica la lógica de guardado de ningún módulo. Hace:
 *   1) Marca con * las etiquetas de campos obligatorios.
 *   2) Validación en vivo (al salir del campo) con mensaje bajo el campo.
 *   3) Barra de progreso "N de M obligatorios" en la cabecera del modal.
 *   4) Enfoca el primer campo al abrir; Esc cierra; Ctrl+Enter envía.
 *   5) Mayúsculas automáticas en nombres/apellidos; solo dígitos en DNI.
 *   6) Avisa si se intenta cerrar un formulario con cambios sin guardar.
 * USO: <script src="../assets/js/bs-form-v3.js"></script> (después de modal-system.js)
 * ========================================================================= */
(function () {
  'use strict';
  if (window.__BS_FORM_V3__) return; window.__BS_FORM_V3__ = true;

  var SEL_CAMPO = 'input:not([type=hidden]):not([type=button]):not([type=submit]):not([type=checkbox]):not([type=radio]), select, textarea';
  var MSG = { valueMissing: 'Este campo es obligatorio.', typeMismatch: 'Formato no válido.', patternMismatch: 'Formato no válido.', rangeUnderflow: 'Valor demasiado bajo.', rangeOverflow: 'Valor demasiado alto.', tooShort: 'Muy corto.', tooLong: 'Muy largo.', badInput: 'Ingresa un valor válido.' };

  function grupo(el) { return el.closest('.bs-form-group') || el.parentElement; }
  function etiqueta(el) {
    var g = grupo(el); if (!g) return null;
    return g.querySelector('.bs-label, label') || (el.id ? document.querySelector('label[for="' + el.id + '"]') : null);
  }
  function mensaje(el) {
    var v = el.validity; if (!v || v.valid) return '';
    for (var k in MSG) if (v[k]) return el.dataset.msg || MSG[k];
    return el.validationMessage || 'Revisa este campo.';
  }
  function pintar(el) {
    var g = grupo(el); if (!g) return;
    var ok = el.checkValidity();
    el.classList.toggle('f3-invalid', !ok);
    el.classList.toggle('f3-valid', ok && !!el.value && el.required);
    g.classList.toggle('f3-group-invalid', !ok);
    var m = g.querySelector('.f3-msg');
    if (!ok) { if (!m) { m = document.createElement('div'); m.className = 'f3-msg'; g.appendChild(m); } m.textContent = mensaje(el); }
    else if (m) m.textContent = '';
  }
  function limpiar(el) { var g = grupo(el); el.classList.remove('f3-invalid', 'f3-valid'); if (g) g.classList.remove('f3-group-invalid'); }

  function prepararModal(modal) {
    if (modal.__f3) return; modal.__f3 = true;
    var form = modal.querySelector('form') || modal;
    var campos = function () { return Array.prototype.slice.call(form.querySelectorAll(SEL_CAMPO)).filter(function (c) { return !c.disabled && c.offsetParent !== null; }); };

    // 1) asteriscos
    form.querySelectorAll(SEL_CAMPO).forEach(function (c) {
      if (!c.required) return;
      var l = etiqueta(c); if (l && !l.querySelector('.f3-req') && !/\*/.test(l.textContent)) { var s = document.createElement('span'); s.className = 'f3-req'; s.textContent = '*'; s.title = 'Obligatorio'; l.appendChild(s); }
    });

    // 3) progreso en la cabecera
    var head = modal.querySelector('.bs-modal-header');
    var bar, cnt;
    if (head) {
      bar = document.createElement('div'); bar.className = 'f3-progress'; bar.innerHTML = '<i></i>';
      head.insertAdjacentElement('afterend', bar);
      cnt = document.createElement('span'); cnt.className = 'f3-counter';
      var close = head.querySelector('.bs-modal-close');
      if (close) head.insertBefore(cnt, close); else head.appendChild(cnt);
    }
    function progreso() {
      var req = campos().filter(function (c) { return c.required; });
      var ok = req.filter(function (c) { return c.checkValidity() && String(c.value || '').trim() !== ''; }).length;
      if (bar) bar.firstChild.style.width = (req.length ? Math.round(ok * 100 / req.length) : 100) + '%';
      if (cnt) cnt.textContent = req.length ? ok + ' de ' + req.length + ' obligatorios' : '';
    }

    // 2) validación en vivo + 5) normalizaciones
    form.addEventListener('focusout', function (e) { var c = e.target; if (c.matches && c.matches(SEL_CAMPO)) { if (c.value || c.required) pintar(c); else limpiar(c); progreso(); } });
    form.addEventListener('input', function (e) {
      var c = e.target; if (!c.matches || !c.matches(SEL_CAMPO)) return;
      modal.__f3dirty = true;
      if (/^(dni|denunciante_dni|denunciado_dni|numero)$/i.test(c.id || '') && c.type !== 'number') { var v = c.value.replace(/\D/g, '').slice(0, 8); if (v !== c.value) c.value = v; }
      if (/nombre|apellido/i.test(c.id || '') && c.tagName === 'INPUT' && c.type === 'text' && !/email|usuario/i.test(c.id)) { var p = c.selectionStart, u = c.value.toUpperCase(); if (u !== c.value) { c.value = u; try { c.setSelectionRange(p, p); } catch (x) {} } }
      if (c.classList.contains('f3-invalid') && c.checkValidity()) pintar(c);
      progreso();
    });
    form.addEventListener('change', progreso);

    // Al enviar con campos inválidos: pintar todos y llevar al primero
    form.addEventListener('submit', function (e) {
      var malos = campos().filter(function (c) { return !c.checkValidity(); });
      if (malos.length) { e.preventDefault(); e.stopImmediatePropagation(); malos.forEach(pintar); malos[0].focus(); malos[0].scrollIntoView({ behavior: 'smooth', block: 'center' }); progreso(); }
      else modal.__f3dirty = false;
    }, true);

    // 4) atajos y foco
    modal.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { var b = form.querySelector('button[type=submit], #btnSubmit, #btnGuardar'); if (b && !b.disabled) { e.preventDefault(); b.click(); } }
    });
    var foot = form.querySelector('.bs-modal-footer') || form.querySelector('.bs-flex:last-child');
    if (foot && !foot.querySelector('.f3-atajos')) { var a = document.createElement('span'); a.className = 'f3-atajos'; a.innerHTML = '<span><kbd>Ctrl</kbd>+<kbd>Enter</kbd> guardar</span><span><kbd>Esc</kbd> cerrar</span>'; foot.insertBefore(a, foot.firstChild); }

    modal.__f3progreso = progreso;
    modal.__f3reset = function () { campos().forEach(limpiar); modal.__f3dirty = false; progreso(); };
  }

  // Detecta apertura/cierre de cualquier .bs-modal-overlay (clase bs-active) sin tocar el código de los módulos
  var obs = new MutationObserver(function (muts) {
    muts.forEach(function (m) {
      var ov = m.target; if (!(ov.classList && ov.classList.contains('bs-modal-overlay'))) return;
      var modal = ov.querySelector('.bs-modal'); if (!modal) return;
      var abierto = ov.classList.contains('bs-active') || ov.classList.contains('active') || getComputedStyle(ov).display !== 'none';
      if (abierto && !ov.__f3open) {
        ov.__f3open = true; prepararModal(modal);
        setTimeout(function () { if (modal.__f3reset) modal.__f3reset(); var f = modal.querySelector(SEL_CAMPO + ':not([readonly])'); if (f && f.offsetParent !== null && document.activeElement && !modal.contains(document.activeElement)) f.focus(); }, 60);
      } else if (!abierto && ov.__f3open) { ov.__f3open = false; }
    });
  });
  function observar() { document.querySelectorAll('.bs-modal-overlay').forEach(function (ov) { obs.observe(ov, { attributes: true, attributeFilter: ['class', 'style'] }); }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observar); else observar();
  // Overlays que se creen después
  new MutationObserver(observar).observe(document.documentElement, { childList: true, subtree: true });

  // 6) aviso de cambios sin guardar al cerrar con Esc o con el botón ×
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var ov = Array.prototype.find.call(document.querySelectorAll('.bs-modal-overlay'), function (o) { return o.__f3open; });
    if (!ov) return;
    var modal = ov.querySelector('.bs-modal');
    if (modal && modal.__f3dirty && !confirmarDescartar()) { e.stopImmediatePropagation(); e.preventDefault(); return; }
    var x = modal && modal.querySelector('.bs-modal-close'); if (x) x.click();
  }, true);
  document.addEventListener('click', function (e) {
    var x = e.target.closest('.bs-modal-close'); if (!x) return;
    var modal = x.closest('.bs-modal');
    if (modal && modal.__f3dirty && !confirmarDescartar()) { e.stopImmediatePropagation(); e.preventDefault(); }
    else if (modal) modal.__f3dirty = false;
  }, true);
  function confirmarDescartar() { return window.confirm('Tienes cambios sin guardar. ¿Cerrar de todos modos?'); }
})();
