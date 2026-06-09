/* ===================================================================
   SISTEMA DE MODALES PERSONALIZADOS - Sistema RR.LL. Unifrutti
   _MODAL_SYSTEM_V1 (07-jun-2026) — Joel Timoteo Gonza

   REEMPLAZA: alert(), confirm(), prompt() nativos del navegador
   (que muestran "joeltimoteog-bot.github.io dice")

   USO:
     await appAlert("Mensaje")           // reemplaza alert()
     await appConfirm("¿Confirmas?")     // reemplaza confirm() — devuelve true/false
     await appPrompt("Ingresa DNI:")     // reemplaza prompt() — devuelve string o null

   IMPORTANTE: las funciones DEVUELVEN PROMESAS. Las funciones que
   las llamen deben ser async y usar await.

   COMPATIBILIDAD: este script intencionalmente NO sobrescribe los
   window.alert/confirm/prompt nativos para no romper código legacy.
   ====================================================================*/

(function() {
  'use strict';

  // Idempotencia: si ya está cargado, no hacer nada
  if (window.appAlert && window._MODAL_SYSTEM_LOADED) return;
  window._MODAL_SYSTEM_LOADED = true;

  // ─── ESTILOS CSS (inyectados dinámicamente) ──────────────────────
  const CSS = `
    .appmsys-overlay{position:fixed;inset:0;background:rgba(11,30,69,.6);
      backdrop-filter:blur(2px);z-index:99999;display:flex;align-items:center;
      justify-content:center;padding:16px;opacity:0;transition:opacity .15s;
      font-family:-apple-system,'Segoe UI',Roboto,sans-serif}
    .appmsys-overlay.appmsys-on{opacity:1}
    .appmsys-box{background:#fff;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.4);
      max-width:480px;width:100%;overflow:hidden;transform:translateY(-12px);
      transition:transform .2s;border:1px solid #e5e7eb}
    .appmsys-overlay.appmsys-on .appmsys-box{transform:translateY(0)}
    .appmsys-header{background:linear-gradient(135deg,#0B1E45 0%,#1e3a8a 100%);
      color:#fff;padding:14px 18px;display:flex;align-items:center;gap:10px;
      font-weight:600;font-size:14px;letter-spacing:.3px}
    .appmsys-logo{width:24px;height:24px;background:#fff;border-radius:50%;
      display:flex;align-items:center;justify-content:center;color:#0B1E45;
      font-weight:800;font-size:11px;flex-shrink:0}
    .appmsys-body{padding:22px 20px;font-size:14px;color:#1f2937;line-height:1.5;
      white-space:pre-wrap;word-break:break-word}
    .appmsys-body .appmsys-msg{margin-bottom:14px}
    .appmsys-input{width:100%;padding:10px 12px;border:2px solid #d1d5db;
      border-radius:8px;font-size:14px;font-family:inherit;outline:none;
      transition:border-color .15s;box-sizing:border-box}
    .appmsys-input:focus{border-color:#1e3a8a;box-shadow:0 0 0 3px rgba(30,58,138,.1)}
    .appmsys-actions{padding:12px 18px;background:#f9fafb;border-top:1px solid #e5e7eb;
      display:flex;gap:8px;justify-content:flex-end}
    .appmsys-btn{padding:8px 16px;border-radius:8px;font-size:13px;font-weight:600;
      border:1px solid transparent;cursor:pointer;transition:all .15s;font-family:inherit;
      min-width:90px}
    .appmsys-btn-primary{background:#1e3a8a;color:#fff;border-color:#1e3a8a}
    .appmsys-btn-primary:hover{background:#1e40af;transform:translateY(-1px);
      box-shadow:0 4px 8px rgba(30,58,138,.3)}
    .appmsys-btn-gray{background:#fff;color:#374151;border-color:#d1d5db}
    .appmsys-btn-gray:hover{background:#f3f4f6}
    .appmsys-btn-danger{background:#dc2626;color:#fff;border-color:#dc2626}
    .appmsys-btn-danger:hover{background:#b91c1c}
    .appmsys-icon{font-size:22px;flex-shrink:0;margin-top:-2px}
    @keyframes appmsysShake{
      0%,100%{transform:translateX(0)} 25%{transform:translateX(-6px)}
      75%{transform:translateX(6px)}
    }
    .appmsys-shake{animation:appmsysShake .3s}
    @media(max-width:480px){
      .appmsys-box{max-width:100%}
      .appmsys-actions{flex-direction:column-reverse}
      .appmsys-btn{width:100%}
    }
  `;
  const styleEl = document.createElement('style');
  styleEl.id = 'appmsys-styles';
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);


  // ─── HELPER: ESCAPAR HTML ────────────────────────────────────────
  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }


  // ─── HELPER: DETECTAR TIPO DE MENSAJE (icono según contenido) ────
  function _detectarIcono(msg) {
    const s = String(msg || '').toLowerCase();
    if (s.includes('error') || s.includes('fallo') || s.includes('❌')) return '❌';
    if (s.includes('eliminar') || s.includes('rechazar') || s.includes('borrar')) return '⚠️';
    if (s.includes('exitoso') || s.includes('correctamente') || s.includes('✅')) return '✅';
    if (s.includes('expirad') || s.includes('caducad')) return '⏰';
    if (s.includes('dni') || s.includes('ingresa') || s.includes('escribe')) return '✏️';
    return 'ℹ️';
  }


  // ─── CORE: CREAR MODAL ───────────────────────────────────────────
  function _crearModal(opts) {
    const overlay = document.createElement('div');
    overlay.className = 'appmsys-overlay';

    const titulo = opts.titulo || 'Sistema RR.LL. · Unifrutti';
    const icono = opts.icono || _detectarIcono(opts.mensaje);
    const inputHTML = opts.tipo === 'prompt'
      ? `<input type="text" class="appmsys-input" id="appmsys-input" 
              value="${_esc(opts.valorDefault || '')}" 
              placeholder="${_esc(opts.placeholder || '')}" autocomplete="off">`
      : '';

    let botonesHTML = '';
    if (opts.tipo === 'alert') {
      botonesHTML = `<button class="appmsys-btn appmsys-btn-primary" data-action="ok">Aceptar</button>`;
    } else if (opts.tipo === 'confirm') {
      const esDanger = /elimin|borrar|rechaz|cancel/i.test(opts.mensaje || '');
      botonesHTML = `
        <button class="appmsys-btn appmsys-btn-gray" data-action="cancel">Cancelar</button>
        <button class="appmsys-btn ${esDanger ? 'appmsys-btn-danger' : 'appmsys-btn-primary'}" data-action="ok">${esDanger ? 'Sí, continuar' : 'Aceptar'}</button>
      `;
    } else if (opts.tipo === 'prompt') {
      botonesHTML = `
        <button class="appmsys-btn appmsys-btn-gray" data-action="cancel">Cancelar</button>
        <button class="appmsys-btn appmsys-btn-primary" data-action="ok">Aceptar</button>
      `;
    }

    overlay.innerHTML = `
      <div class="appmsys-box" role="dialog" aria-modal="true">
        <div class="appmsys-header">
          <div class="appmsys-logo">RL</div>
          <span>${_esc(titulo)}</span>
        </div>
        <div class="appmsys-body">
          <div class="appmsys-msg">
            <span class="appmsys-icon">${icono}</span>
            <span style="margin-left:6px">${_esc(opts.mensaje)}</span>
          </div>
          ${inputHTML}
        </div>
        <div class="appmsys-actions">
          ${botonesHTML}
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('appmsys-on'));

    return new Promise(resolve => {
      const box = overlay.querySelector('.appmsys-box');
      const input = overlay.querySelector('#appmsys-input');
      const focusInicial = input || overlay.querySelector('[data-action="ok"]');
      setTimeout(() => focusInicial && focusInicial.focus(), 80);
      if (input) input.select();

      const cerrar = (valor) => {
        overlay.classList.remove('appmsys-on');
        setTimeout(() => {
          overlay.remove();
          document.removeEventListener('keydown', onKey);
          resolve(valor);
        }, 150);
      };

      const onKey = (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          cerrar(opts.tipo === 'confirm' ? false : null);
        } else if (e.key === 'Enter') {
          // Solo en alert y prompt; en confirm Enter = OK
          if (opts.tipo === 'prompt' && document.activeElement === input) {
            e.preventDefault();
            cerrar(input.value);
          } else if (opts.tipo === 'alert') {
            e.preventDefault();
            cerrar(true);
          } else if (opts.tipo === 'confirm' && document.activeElement.dataset.action) {
            // dejar que el botón maneje el click
          }
        }
      };
      document.addEventListener('keydown', onKey);

      overlay.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', () => {
          const action = btn.dataset.action;
          if (action === 'cancel') {
            cerrar(opts.tipo === 'confirm' ? false : null);
          } else if (action === 'ok') {
            if (opts.tipo === 'prompt') cerrar(input ? input.value : '');
            else if (opts.tipo === 'confirm') cerrar(true);
            else cerrar(true);
          }
        });
      });

      // NO cerrar al click fuera (igual que los modales del sistema)
      // overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(...); });
    });
  }


  // ─── API PÚBLICA ─────────────────────────────────────────────────

  /**
   * Muestra un mensaje informativo. Reemplaza alert().
   * @param {string} mensaje
   * @returns {Promise<true>}
   */
  window.appAlert = function(mensaje) {
    return _crearModal({ tipo: 'alert', mensaje: mensaje });
  };

  /**
   * Pide confirmación. Reemplaza confirm().
   * @param {string} mensaje
   * @returns {Promise<boolean>}
   */
  window.appConfirm = function(mensaje) {
    return _crearModal({ tipo: 'confirm', mensaje: mensaje });
  };

  /**
   * Pide texto al usuario. Reemplaza prompt().
   * @param {string} mensaje
   * @param {string} [valorDefault='']
   * @returns {Promise<string|null>} string si Aceptar, null si Cancelar
   */
  window.appPrompt = function(mensaje, valorDefault) {
    return _crearModal({
      tipo: 'prompt',
      mensaje: mensaje,
      valorDefault: valorDefault || ''
    });
  };

  console.log('✅ Sistema de modales Unifrutti cargado (appAlert, appConfirm, appPrompt)');
})();
