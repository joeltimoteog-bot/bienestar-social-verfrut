/* =========================================================================
 * BS-SALUDO  ·  Barra compacta de saludo personalizado (1 línea)
 * Bienestar Social · Unifrutti Group
 * -------------------------------------------------------------------------
 * Muestra arriba del contenido: "👋 ¡Hola, {Nombre}! Te saluda Joel —
 * bienvenid@ al Sistema de Bienestar Social."
 * Lee al usuario de localStorage('bienestarSocialAuth'). Detecta género (~90%)
 * para Bienvenido/Bienvenida. Se auto-inserta al inicio del <main> (o del body).
 *
 * USO (1 toque por módulo):
 *   <script src="../assets/js/bs-saludo.js"></script>
 * (No requiere nada más; se inicializa solo.)
 * ========================================================================= */
(function () {
  'use strict';

  function sinTilde(s) { return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }

  function generoPorNombre(nombre) {
    var p = sinTilde(String(nombre || '').trim().split(/\s+/)[0]);
    if (!p) return 'M';
    var F = ['carmen','beatriz','isabel','raquel','ruth','ester','esther','abigail','soledad','flor','pilar','mercedes','dolores','consuelo','rosario','luz','noemi','magali','jackeline','ines','lourdes','maribel','yudith','judith','nancy','ingrid','damaris','elizabeth','janet','janeth','madeleine','katherine','katerin','yobana','yobany','miriam','mirian','fanny','deysi','deisy','maricel','yoselin','yoseline','socorro'];
    var M = ['jose','joshua','elias','isaias','tobias','matias','nicolas','andres','jesus','ismael','daniel','joel','manuel','miguel','angel','rafael','gabriel','ariel','uriel','abel','noe','ivan','adan','aldair','yeltsin','jhon','john','luca'];
    if (F.indexOf(p) >= 0) return 'F';
    if (M.indexOf(p) >= 0) return 'M';
    if (/a$/.test(p)) return 'F';
    if (/(o|or|el|an|in|on|us|er)$/.test(p)) return 'M';
    return 'M';
  }

  function primerNombre(full) {
    var f = String(full || '').trim().split(/\s+/)[0] || '';
    return f ? (f.charAt(0).toUpperCase() + f.slice(1).toLowerCase()) : '';
  }

  function init() {
    // Usuario de sesión
    var user = null;
    try { user = JSON.parse(localStorage.getItem('bienestarSocialAuth') || 'null'); } catch (e) {}
    if (!user || !(user.nombre || user.usuario)) return; // sin sesión, no molesta

    if (document.getElementById('bsSaludoBar')) return; // evitar duplicado

    var full = user.nombre || user.usuario;
    var nom = primerNombre(full);
    var bienv = generoPorNombre(full) === 'F' ? 'Bienvenida' : 'Bienvenido';

    // estilos (una vez)
    if (!document.getElementById('bsSaludoCss')) {
      var st = document.createElement('style');
      st.id = 'bsSaludoCss';
      st.textContent =
        '#bsSaludoBar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;' +
        'background:linear-gradient(120deg,#1e3a8a,#1d5fc4);color:#fff;' +
        'padding:9px 16px;border-radius:10px;margin:0 0 14px;font-family:Inter,system-ui,sans-serif;' +
        'font-size:.9rem;box-shadow:0 4px 14px rgba(10,61,145,.18);}' +
        '#bsSaludoBar .em{font-size:1.05rem;}' +
        '#bsSaludoBar b{font-weight:800;color:#ffd7a6;}' +
        '#bsSaludoBar .msg{flex:1;min-width:200px;}' +
        '#bsSaludoBar .x{background:rgba(255,255,255,.16);border:none;color:#fff;width:24px;height:24px;' +
        'border-radius:6px;cursor:pointer;font-size:.85rem;line-height:1;flex-shrink:0;}';
      document.head.appendChild(st);
    }

    var bar = document.createElement('div');
    bar.id = 'bsSaludoBar';
    bar.innerHTML =
      '<span class="em">👋</span>' +
      '<span class="msg">¡Hola, <b>' + nom + '</b>! Te saluda Joel — ' + bienv.toLowerCase() +
      ' al Sistema de Bienestar Social.</span>' +
      '<button class="x" title="Cerrar" onclick="this.parentNode.remove()">✕</button>';

    // Insertar al inicio del <main> (o del body como fallback)
    var host = document.querySelector('main') || document.querySelector('.bs-main') || document.body;
    host.insertBefore(bar, host.firstChild);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
