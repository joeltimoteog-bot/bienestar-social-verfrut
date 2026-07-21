/* ============================================================================
 * bs-presencia.js — Bienestar Social · Unifrutti
 * PRESENCIA EN VIVO + MENSAJES DE COORDINACIÓN RR.LL
 *
 * Se incluye una vez por página, antes de </body>:
 *   <script src="assets/js/bs-presencia.js"></script>          (portal)
 *   <script src="../assets/js/bs-presencia.js"></script>       (módulos)
 *
 * - Escribe presencia en el RTDB compartido /presencia/{usuario} con módulo
 *   "Bienestar Social · <Página>" (visible en el Monitor del administrador).
 * - Escucha /mensajes/{usuario} (sondeo cada 15 s) y muestra los avisos del
 *   admin con opción de responder. Botón flotante 💬 para iniciar conversación.
 * - Modo REST puro: funciona en cualquier red. Todo en try/catch.
 * ========================================================================== */
(function () {
  'use strict';
  if (window.__BS_PRESENCIA__) return;
  window.__BS_PRESENCIA__ = true;

  var DB = 'https://sistema-rl-verfrut-default-rtdb.firebaseio.com';

  var USER = null;
  try { USER = JSON.parse(localStorage.getItem('bienestarSocialAuth') || 'null'); } catch (e) {}
  if (!USER || !USER.usuario) return;

  var UKEY = String(USER.usuario).toLowerCase().replace(/[.#$/\[\]]/g, '_');
  var PAG = '';
  try { PAG = (location.pathname.split('/').pop() || '').replace('.html', ''); } catch (e) {}
  var MODULO = 'Bienestar Social · ' + (PAG ? PAG.charAt(0).toUpperCase() + PAG.slice(1) : 'Portal');

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ── Presencia (latido cada 20 s) ── */
  function payload(online) {
    return { usuario: USER.usuario, nombre: USER.nombre || USER.usuario, rol: USER.rol || '',
             empresa: '', modulo: MODULO, pagina: PAG || 'portal',
             online: !!online, ultimo_ping: { '.sv': 'timestamp' } };
  }
  function marcar(online) {
    try {
      fetch(DB + '/presencia/' + UKEY + '.json', { method: 'PUT', body: JSON.stringify(payload(online)) })['catch'](function () {});
    } catch (e) {}
  }
  marcar(!document.hidden);
  setInterval(function () { marcar(!document.hidden); }, 20000);
  document.addEventListener('visibilitychange', function () { marcar(!document.hidden); });
  window.addEventListener('beforeunload', function () {
    try {
      fetch(DB + '/presencia/' + UKEY + '.json', { method: 'PATCH', keepalive: true, body: JSON.stringify({ online: false }) })['catch'](function () {});
    } catch (e) {}
  });

  /* ── Historial: 1 registro de ingreso por sesión de navegador ── */
  try {
    if (!sessionStorage.getItem('_bs_hist_ok')) {
      sessionStorage.setItem('_bs_hist_ok', '1');
      fetch(DB + '/historial/' + UKEY + '.json', { method: 'POST',
        body: JSON.stringify({ ts: { '.sv': 'timestamp' }, evento: 'ingreso', pagina: PAG || 'portal', modulo: MODULO }) })['catch'](function () {});
    }
  } catch (e) {}

  /* ── Mensajes del admin: tarjetas con respuesta ── */
  var _vistos = {};
  function wrap() {
    var w = document.getElementById('_bsMsgWrap');
    if (!w) {
      w = document.createElement('div');
      w.id = '_bsMsgWrap';
      w.style.cssText = 'position:fixed;top:16px;right:16px;z-index:2147483647;display:flex;flex-direction:column;gap:10px;max-width:340px;font-family:inherit;';
      document.body.appendChild(w);
    }
    return w;
  }
  function responder(texto, cb) {
    try {
      fetch(DB + '/mensajes/' + UKEY + '.json', { method: 'POST',
        body: JSON.stringify({ texto: String(texto).slice(0, 990), de: USER.nombre || USER.usuario,
                               de_usuario: USER.usuario, ts: { '.sv': 'timestamp' }, leido: false }) })
        .then(function (r) { cb(!!(r && r.ok)); })['catch'](function () { cb(false); });
    } catch (e) { cb(false); }
  }
  function tarjetaMsg(id, m) {
    var card = document.createElement('div');
    card.style.cssText = 'background:#0f172a;color:#f1f5f9;border-left:4px solid #38bdf8;border-radius:12px;padding:14px 16px;box-shadow:0 12px 34px rgba(0,0,0,.35);font-size:13.5px;line-height:1.5;';
    card.innerHTML =
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-weight:700;color:#7dd3fc;">' +
      '<span style="font-size:16px;">📌</span><span>Mensaje de ' + esc((m && m.de) || 'Coordinación RR.LL.') + '</span></div>' +
      '<div style="margin-bottom:10px;white-space:pre-wrap;">' + esc((m && m.texto) || '') + '</div>' +
      '<textarea placeholder="Escribe tu respuesta…" style="width:100%;box-sizing:border-box;background:#1e293b;color:#f1f5f9;border:1px solid #334155;border-radius:8px;padding:8px;font-size:12.5px;font-family:inherit;min-height:52px;resize:vertical;margin-bottom:8px;"></textarea>' +
      '<div style="display:flex;gap:8px;">' +
      '<button type="button" data-a="r" style="background:#22c55e;color:#052e16;border:none;border-radius:8px;padding:6px 14px;font-weight:700;font-size:12.5px;cursor:pointer;">↩️ Responder</button>' +
      '<button type="button" data-a="ok" style="background:#38bdf8;color:#0f172a;border:none;border-radius:8px;padding:6px 14px;font-weight:700;font-size:12.5px;cursor:pointer;">Entendido</button></div>';
    var cerrar = function () {
      card.style.transition = 'opacity .3s'; card.style.opacity = '0';
      setTimeout(function () { if (card.parentNode) card.parentNode.removeChild(card); }, 300);
    };
    card.querySelector('[data-a="ok"]').addEventListener('click', cerrar);
    card.querySelector('[data-a="r"]').addEventListener('click', function () {
      var ta = card.querySelector('textarea');
      var t = ((ta && ta.value) || '').trim();
      if (!t) { if (ta) ta.focus(); return; }
      var b = this; b.disabled = true; b.textContent = 'Enviando…';
      responder(t, function (ok) {
        if (ok) { b.textContent = '✓ Enviada'; setTimeout(cerrar, 900); }
        else { b.disabled = false; b.textContent = '↩️ Responder'; }
      });
    });
    wrap().appendChild(card);
  }
  function pollMsgs() {
    try {
      fetch(DB + '/mensajes/' + UKEY + '.json?nc=' + Date.now())
        .then(function (r) { return r.json(); })
        .then(function (val) {
          if (!val) return;
          Object.keys(val).forEach(function (id) {
            var m = val[id];
            if (!m || m.leido) return;
            if (m.de_usuario && String(m.de_usuario) === String(USER.usuario)) return;
            if (_vistos[id]) return;
            _vistos[id] = true;
            tarjetaMsg(id, m);
            fetch(DB + '/mensajes/' + UKEY + '/' + id + '.json', { method: 'PATCH',
              body: JSON.stringify({ leido: true, leido_ts: { '.sv': 'timestamp' } }) })['catch'](function () {});
          });
        })['catch'](function () {});
    } catch (e) {}
  }
  pollMsgs();
  setInterval(pollMsgs, 15000);

  /* ── Botón flotante: escribir a Coordinación ── */
  try {
    if (String(USER.usuario).toLowerCase() !== 'jtimoteo' && !document.getElementById('_bsChatBtn')) {
      var b = document.createElement('button');
      b.id = '_bsChatBtn'; b.type = 'button'; b.title = 'Escribir a Coordinación RR.LL.';
      b.textContent = '💬';
      b.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:2147483000;width:46px;height:46px;border-radius:50%;border:none;background:#0ea5e9;color:#fff;font-size:20px;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.3);';
      b.addEventListener('click', function () {
        var p = document.getElementById('_bsChatPanel');
        if (p) { p.parentNode.removeChild(p); return; }
        p = document.createElement('div'); p.id = '_bsChatPanel';
        p.style.cssText = 'position:fixed;bottom:80px;right:24px;z-index:2147483001;width:280px;background:#0f172a;color:#f1f5f9;border-radius:14px;padding:14px;box-shadow:0 14px 40px rgba(0,0,0,.45);font-size:13px;font-family:inherit;';
        p.innerHTML =
          '<div style="font-weight:700;color:#7dd3fc;margin-bottom:8px;">💬 Mensaje a Coordinación RR.LL.</div>' +
          '<textarea placeholder="Escribe tu mensaje…" style="width:100%;box-sizing:border-box;background:#1e293b;color:#f1f5f9;border:1px solid #334155;border-radius:8px;padding:8px;min-height:60px;font-family:inherit;font-size:12.5px;resize:vertical;margin-bottom:8px;"></textarea>' +
          '<button type="button" style="background:#22c55e;color:#052e16;border:none;border-radius:8px;padding:7px 14px;font-weight:700;font-size:12.5px;cursor:pointer;">Enviar</button>';
        p.querySelector('button').addEventListener('click', function () {
          var ta = p.querySelector('textarea');
          var t = ((ta && ta.value) || '').trim();
          if (!t) { if (ta) ta.focus(); return; }
          var b2 = this; b2.disabled = true; b2.textContent = 'Enviando…';
          responder(t, function (ok) {
            if (ok) { b2.textContent = '✓ Enviado'; setTimeout(function () { if (p.parentNode) p.parentNode.removeChild(p); }, 900); }
            else { b2.disabled = false; b2.textContent = 'Enviar'; }
          });
        });
        document.body.appendChild(p);
      });
      document.body.appendChild(b);
    }
  } catch (e) {}
})();
