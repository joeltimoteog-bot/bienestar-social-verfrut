/* ═══════════════════════════════════════════════════════════════════════════
   bs-sede.js — _BS_SEDE_PANTALLA_V1 (23-nov-2026, decision de Joel: "nadie de Olmos debe ver lo de Piura")
   PROBLEMA: el servidor (Supabase) ya separa Piura y Olmos, pero varias pantallas de Bienestar, cuando el servidor
   no devuelve nada, VUELVEN A PREGUNTAR A GOOGLE (hoja antigua), y Google no conoce las sedes: un usuario de Olmos
   podia buscar y abrir la ficha de personal de Piura.
   QUE HACE (solo para el usuario cuya sede es OLMOS; a Piura y a quien ve las dos sedes no les cambia nada):
     1) Cierra las consultas y los guardados que van a Google. Responde, sin llamar a Google:
        "No cuenta con acceso a la información de la sede Piura."
        Siguen pasando: iniciar sesion, la llave de Supabase, los permisos, la bitacora de accesos y los correos de aviso.
     2) Muestra ese mismo aviso cuando el servidor dice que el trabajador buscado es de la otra sede.
     3) Cambia los filtros y listas de empresa (RAPEL / VERFRUT) por las empresas de Olmos, que son sus sectores:
        BOMAREA, PIRONA, MOSQUETA, HEFEI, LEFKADA.
   COMO SABE LA SEDE: la dice el servidor (bs/permisos -> sede: OLMOS | PIURA | TODO), con la sesion del RR.LL.
     Se recuerda en la sesion de Bienestar (por usuario) y se vuelve a preguntar en cada pagina.
     Si el servidor no responde y no hay recuerdo: usuario cuya empresa es de Olmos -> cerrado; los demas, como antes.
   · v2 (_BS_SEDE_ETIQUETA_V1, 23-nov, pedido de Joel): el encabezado dice "Sede Olmos" junto al usuario (y "Ambas sedes" a quien
     ve las dos), y los textos fijos "RAPEL y VERFRUT" / "RAPEL / VERFRUT" de las tarjetas pasan a "sede Olmos" para el usuario de Olmos.
   LIMITE: es un cierre de PANTALLA. El cierre dentro de Google (Apps Script de Bienestar) es un cambio aparte.
   Se carga justo despues de modal-system.js, antes de todo lo demas.
   Apagar (no sirve para un usuario de Olmos): localStorage.bs_sede_pantalla = 'off'.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._BS_SEDE_PANTALLA_V1) return; window._BS_SEDE_PANTALLA_V1 = true;

  var SB = 'https://exdjzbfinppzatjyimxn.supabase.co/functions/v1/api/bs/permisos?forceFunctionRegion=sa-east-1';
  var CLAVE = 'bienestarSocialAuth';
  var MSG = 'No cuenta con acceso a la información de la sede Piura.';
  var EMPRESAS_OLMOS = ['BOMAREA', 'PIRONA', 'MOSQUETA', 'HEFEI', 'LEFKADA'];
  var RECUERDO_MS = 12 * 3600 * 1000, ESPERA_MS = 4000;
  /* acciones de Google que NO se cierran: sesion, llave, permisos, bitacora y correos de aviso */
  var LIBRES = /^bs_(login|sbToken|permisosUsuario|registrarEvento|notificar)/;
  /* acciones que el usuario hace a proposito: al cerrarlas se muestra el aviso en pantalla (las demas, en silencio) */
  var VISIBLES = /^bs_(ficha|crear|actualizar|anular|restaurar|eliminar|importar|subir|ver|cierre|generar|gs(Crear|Actualizar))/;

  var fOrig = window.fetch;
  if (typeof fOrig !== 'function') return;

  function leer(k, ses) { try { return JSON.parse((ses ? sessionStorage : localStorage).getItem(k) || 'null'); } catch (e) { return null; } }
  function sesionBS() { return leer(CLAVE) || null; }
  function rlToken() { try { return sessionStorage.getItem('rl_token') || ''; } catch (e) { return ''; } }
  function rlUser() { var u = leer('user', true); if (u && u.usuario) return u; var s = leer('rl_session'); return (s && s.user && s.user.usuario) ? s.user : null; }
  function min(v) { return String(v || '').trim().toLowerCase(); }
  /* usuario de ESTA pestaña: el de la sesion del RR.LL. si la hay (igual que bs-sesion-rl.js); si no, el de Bienestar */
  function usuarioActual() { var ru = rlUser(); if (rlToken() && ru) return min(ru.usuario); var s = sesionBS(); return min(s && s.usuario); }
  function tokenActual() { var t = rlToken(); if (t) return t; var s = sesionBS(); return (s && s.rl_token) || ''; }
  function esDeOlmos(emp) { var e = String(emp || '').toUpperCase(); if (e.indexOf('OLMOS') >= 0) return true; for (var i = 0; i < EMPRESAS_OLMOS.length; i++) if (e.indexOf(EMPRESAS_OLMOS[i]) >= 0) return true; return false; }
  function apagado() { try { return localStorage.getItem('bs_sede_pantalla') === 'off'; } catch (e) { return false; } }

  /* recuerdo de la sede, guardado en la sesion de Bienestar y valido solo para el mismo usuario */
  function recuerdo() {
    var s = sesionBS(), u = usuarioActual();
    if (!s || !u || !s.sede || min(s.sedeDe) !== u) return '';
    if (!(Date.now() - Number(s.sedeEn || 0) < RECUERDO_MS)) return '';
    return String(s.sede);
  }
  function recordar(sede, usuario) {
    try {
      var s = sesionBS(); if (!s || min(s.usuario) !== usuario) return;   /* la sesion de Bienestar aun no es de este usuario: no se toca */
      if (s.sede === sede && min(s.sedeDe) === usuario && Date.now() - Number(s.sedeEn || 0) < 60000) return;
      s.sede = sede; s.sedeDe = usuario; s.sedeEn = Date.now(); localStorage.setItem(CLAVE, JSON.stringify(s));
    } catch (e) {}
  }
  /* pista local cuando el servidor no responde: la empresa con la que se inicio sesion */
  function pista() {
    var ru = rlUser(); if (rlToken() && ru) return esDeOlmos(ru.empresa) ? 'OLMOS' : '';
    var s = sesionBS(); return (s && esDeOlmos(s.empresa)) ? 'OLMOS' : '';
  }

  var sedeSesion = '';   /* lo que respondio el servidor en esta pagina */
  var consulta = null, consultaDe = '', falloEn = 0;
  function consultar() {
    var u = usuarioActual(), t = tokenActual();
    if (consulta && consultaDe === u) return consulta;
    if (!u || !t) return Promise.resolve('');
    if (Date.now() - falloEn < 30000) return Promise.resolve('');   /* el servidor acaba de fallar: no se hace esperar otra vez */
    consultaDe = u;
    consulta = fOrig.call(window, SB, { headers: { Authorization: 'Bearer ' + t } })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j || !j.success || typeof j.sede !== 'string' || !j.sede) return '';
        if (j.usuario && min(j.usuario) !== u) return '';
        sedeSesion = j.sede; recordar(j.sede, u);
        if (j.sede === 'OLMOS') alSaberOlmos(); else if (j.sede === 'TODO') alSaberTodo();
        if (j.sede !== 'TODO') { try { if (sessionStorage.getItem('bs_sede_vista')) { sessionStorage.removeItem('bs_sede_vista'); } } catch (e) {} }   /* _BS_SEDE_VISTA_V1 */
        return j.sede;
      })
      .catch(function () { consulta = null; falloEn = Date.now(); return ''; });
    return consulta;
  }
  function espera(ms) { return new Promise(function (ok) { setTimeout(function () { ok(''); }, ms); }); }
  /* sede para decidir: OLMOS se cierra de inmediato; PIURA/TODO recordado pasa de inmediato; sin dato se espera al servidor */
  function decidir() {
    if (sedeSesion && consultaDe === usuarioActual()) return Promise.resolve(sedeSesion);
    var r = recuerdo();
    if (r === 'OLMOS') { consultar(); return Promise.resolve('OLMOS'); }
    if (r) { consultar(); return Promise.resolve(r); }
    return Promise.race([consultar(), espera(ESPERA_MS)]).then(function (s) { return s || pista(); });
  }

  /* ── aviso en pantalla (propio, no depende de otros archivos) ── */
  var ultimoAviso = 0;
  function avisar(msg) {
    try {
      if (Date.now() - ultimoAviso < 2500) return; ultimoAviso = Date.now();
      var d = document.getElementById('bsSedeAviso');
      if (!d) {
        d = document.createElement('div'); d.id = 'bsSedeAviso'; d.setAttribute('role', 'alert');
        d.style.cssText = 'position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:2147483000;max-width:92vw;background:#991b1b;color:#fff;' +
          'padding:12px 18px;border-radius:10px;font:600 14px/1.35 system-ui,Segoe UI,Arial,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.25);text-align:center;';
        (document.body || document.documentElement).appendChild(d);
      }
      d.textContent = '🔒 ' + (msg || MSG); d.style.display = 'block';
      clearTimeout(avisar._t); avisar._t = setTimeout(function () { d.style.display = 'none'; }, 6000);
    } catch (e) {}
  }
  window.bsSedeAviso = avisar;

  function respuestaCerrada(accion) {
    if (VISIBLES.test(accion) || !accion) avisar(MSG);
    try { console.info('[_BS_SEDE_PANTALLA_V1] consulta a Google cerrada para la sede Olmos: ' + (accion || '(sin accion)')); } catch (e) {}
    var cuerpo = { ok: false, success: false, code: 403, otra_sede: true, sede: 'OLMOS', accion: accion, message: MSG, error: MSG, items: [], data: [] };
    return new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  function accionDe(u, init) {
    try { if (init && typeof init.body === 'string' && init.body.indexOf('"action"') >= 0) { var b = JSON.parse(init.body); if (b && b.action) return String(b.action); } } catch (e) {}
    try { var m = String(u).match(/[?&]action=([^&#]+)/); if (m) return decodeURIComponent(m[1]); } catch (e) {}
    return '';
  }

  /* _BS_SEDE_VISTA_V1 (24-nov-2026, maqueta aprobada por Joel): quien ve las dos sedes elige la sede al ingresar a Bienestar.
     La eleccion vive en la pestaña (sessionStorage.bs_sede_vista = PIURA | OLMOS; vacio = Ambas) y viaja al servidor en la
     cabecera x-rl-sede (la misma del Sistema RR.LL.): el servidor la obedece SOLO si el usuario de verdad ve las dos sedes.
     El Panel y los indicadores del portal se piden siempre generales. Los modulos siguen saliendo segun "Acceso a Modulos". */
  function vistaBS() { try { var v = String(sessionStorage.getItem('bs_sede_vista') || '').toUpperCase(); return (v === 'PIURA' || v === 'OLMOS') ? v : ''; } catch (e) { return ''; } }
  function siempreGeneral(u) { try { return /\/api\/bs\/(dashboard|permisos)(\?|$)/.test(u) || /\/panel\.html$/i.test(location.pathname); } catch (e) { return false; } }
  function conCabecera(init, v) {
    var i2 = Object.assign({}, init || {}), h = i2.headers;
    if (typeof Headers !== 'undefined' && h instanceof Headers) { h = new Headers(h); h.set('x-rl-sede', v); }
    else if (Array.isArray(h)) { h = h.concat([['x-rl-sede', v]]); }
    else { h = Object.assign({}, h || {}, { 'x-rl-sede': v }); }
    i2.headers = h; return i2;
  }

  var envuelto = function (input, init) {
    var u = '';
    try { u = typeof input === 'string' ? input : ((input && input.url) || ''); } catch (e) { u = ''; }
    try {
      var vv = vistaBS();
      if (vv && typeof input === 'string' && u.indexOf('/functions/v1/api/') >= 0 && !siempreGeneral(u)) { init = conCabecera(init, vv); arguments[1] = init; if (arguments.length < 2) return envuelto.call(this, input, init); }
    } catch (e) {}
    try {
      if (u.indexOf('script.google.com/macros/') >= 0) {
        var accion = accionDe(u, init);
        if (!LIBRES.test(accion)) {
          var self = this, args = arguments;
          if (apagado() && (sedeSesion || recuerdo() || pista()) !== 'OLMOS') return fOrig.apply(this, arguments);   /* interruptor: no vale para Olmos */
          return decidir().then(function (sede) {
            if (sede === 'OLMOS') return respuestaCerrada(accion);
            return fOrig.apply(self, args);
          });
        }
      } else if (u.indexOf('/functions/v1/api/trabajadores/buscar') >= 0) {
        /* el servidor ya filtra por sede: aqui solo se muestra su aviso */
        return fOrig.apply(this, arguments).then(function (r) {
          try { r.clone().json().then(function (j) { if (j && j.otra_sede) avisar(j.aviso_sede || j.mensaje || MSG); }).catch(function () {}); } catch (e) {}
          return r;
        });
      }
    } catch (e) {}
    return fOrig.apply(this, arguments);
  };
  envuelto._bsSede = true;
  window.fetch = envuelto;

  /* ── 3) empresas de Olmos en filtros y listas (solo usuario de Olmos) ── */
  function esRV(v) { var s = String(v || '').trim().toUpperCase(); return s === 'RAPEL' || s === 'VERFRUT'; }
  function adaptar() {
    try {
      /* pastillas del portal (filtro de alertas) */
      var emp = document.getElementById('emp');
      if (emp && !emp._bsSede) {
        var pills = emp.querySelectorAll('.pill'), tieneRV = false;
        for (var i = 0; i < pills.length; i++) if (esRV(pills[i].getAttribute('data-e'))) tieneRV = true;
        if (tieneRV) {
          emp._bsSede = true;
          for (var k = pills.length - 1; k >= 0; k--) { if (esRV(pills[k].getAttribute('data-e'))) pills[k].parentNode.removeChild(pills[k]); else if (!pills[k].getAttribute('data-e')) pills[k].textContent = 'Olmos · todas'; }
          EMPRESAS_OLMOS.forEach(function (e) { var b = document.createElement('button'); b.className = 'pill'; b.setAttribute('data-e', e); b.textContent = e; emp.appendChild(b); });
          var lbl = emp.querySelector('.lbl'); if (lbl) lbl.textContent = 'Sede Olmos';
        }
      }
      /* listas desplegables que ofrecen RAPEL / VERFRUT */
      var sels = document.querySelectorAll('select');
      for (var s = 0; s < sels.length; s++) {
        var sel = sels[s], ops = sel.options, hayRV = false, ya = {};
        for (var o = 0; o < ops.length; o++) { if (esRV(ops[o].value)) hayRV = true; ya[String(ops[o].value).trim().toUpperCase()] = 1; }
        if (!hayRV) continue;
        var eraRV = esRV(sel.value);
        for (var q = ops.length - 1; q >= 0; q--) if (esRV(ops[q].value)) sel.remove(q);
        EMPRESAS_OLMOS.forEach(function (e) { if (!ya[e]) { var op = document.createElement('option'); op.value = e; op.textContent = e; sel.appendChild(op); } });
        if (eraRV) { sel.selectedIndex = 0; try { sel.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {} }
      }
      textos(); etiqueta('Sede Olmos', '#ffedd5', '#9a3412', '#fdba74');
    } catch (e) {}
  }
  /* textos fijos de las tarjetas ("Gestión de subsidios RAPEL y VERFRUT…") */
  function textos() {
    try {
      if (!document.body || typeof document.createTreeWalker !== 'function') return;
      var w = document.createTreeWalker(document.body, 4 /* solo texto */, null, false), n, cambiar = [];
      while ((n = w.nextNode())) {
        var v = n.nodeValue; if (!v || v.indexOf('VERFRUT') < 0) continue;
        var p = n.parentNode, tag = p && p.nodeName; if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA' || tag === 'OPTION') continue;
        cambiar.push(n);
      }
      cambiar.forEach(function (x) {
        var v = x.nodeValue, r = v.replace(/RAPEL\s+y\s+VERFRUT/g, 'de la sede Olmos').replace(/RAPEL\s*\/\s*VERFRUT/g, 'Sede Olmos');
        if (r !== v) x.nodeValue = r;
      });
    } catch (e) {}
  }
  /* etiqueta de sede junto al nombre del usuario (id="userName" en todas las paginas) y junto a la fecha del portal */
  function etiqueta(texto, fondo, color, borde) {
    try {
      ['userName', 'proFecha'].forEach(function (id) {
        var el = document.getElementById(id); if (!el || !el.parentNode) return;
        var cid = 'bsSedeEtq_' + id, c = document.getElementById(cid);
        if (!c) {
          c = document.createElement('span'); c.id = cid;
          c.style.cssText = 'display:inline-block;margin-left:8px;padding:2px 9px;border-radius:999px;font:700 11px/1.4 system-ui,Segoe UI,Arial,sans-serif;letter-spacing:.3px;vertical-align:middle;white-space:nowrap;' +
            'background:' + fondo + ';color:' + color + ';border:1px solid ' + borde + ';';
          el.parentNode.insertBefore(c, el.nextSibling);
        }
        if (c.textContent !== texto) c.textContent = texto;
      });
    } catch (e) {}
  }
  var olmosListo = false;
  function alSaberOlmos() {
    if (olmosListo) return; olmosListo = true;
    try { document.documentElement.setAttribute('data-bs-sede', 'OLMOS'); } catch (e) {}
    var pasar = function () {
      adaptar(); [300, 1000, 2500, 5000].forEach(function (ms) { setTimeout(adaptar, ms); });
      /* las tarjetas y listas se vuelven a dibujar (indicadores cada 3 min, formularios): se repasa tras cada cambio, con pausa */
      try { var t = 0; new MutationObserver(function () { clearTimeout(t); t = setTimeout(adaptar, 250); }).observe(document.body, { childList: true, subtree: true }); } catch (e) {}
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pasar); else pasar();
  }
  /* cuadro "Seleccione la sede de trabajo": en el portal, una vez por ingreso (se recuerda por la sesion); tambien al tocar la etiqueta */
  function preguntarSedeBS(aPedido) {
    try {
      var off = false; try { off = localStorage.getItem('bs_sede_pregunta') === 'off'; } catch (e0) {}
      if (document.getElementById('bsSedePregOv')) return;
      var m = String(tokenActual() || '').slice(-24);
      if (!aPedido) { if (off || !m) return; var ya = ''; try { ya = sessionStorage.getItem('bs_sede_preg') || ''; } catch (e1) {} if (ya === m) return; }
      var actual = vistaBS(), elegida = actual;
      var OPC = [['PIURA', 'Sede Piura', 'RAPEL · VERFRUT'], ['OLMOS', 'Sede Olmos', 'Bomarea · Pirona · Mosqueta · Hefei · Lefkada'], ['', 'Ambas sedes', 'Vista general: Piura y Olmos']];
      var ov = document.createElement('div'); ov.id = 'bsSedePregOv'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-labelledby', 'bsSedePregT');
      ov.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:rgba(15,27,51,.62);display:flex;align-items:center;justify-content:center;padding:16px;font-family:system-ui,Segoe UI,Arial,sans-serif';
      var card = document.createElement('div');
      card.style.cssText = 'width:min(580px,100%);max-height:calc(100vh - 32px);overflow:auto;box-sizing:border-box;background:#fff;border:1px solid #D9DFEA;border-top:5px solid #C8102E;border-radius:10px;padding:32px 40px 26px;box-shadow:0 18px 48px rgba(15,27,51,.28);color:#0F1B33;text-align:left';
      card.innerHTML =
        '<div style="display:flex;align-items:center;gap:14px"><img src="/bienestar-social-verfrut/images/logo-unifrutti-hd.png" alt="Unifrutti" style="width:48px;height:48px;object-fit:contain;border:1px solid #E6EAF2;border-radius:8px;background:#fff" onerror="this.style.display=\'none\'">' +
        '<div><div style="font-size:11px;letter-spacing:2.2px;font-weight:700;color:#C8102E;text-transform:uppercase">Bienestar Social</div><div style="font-size:12px;color:#5B6B86;margin-top:2px">Unifrutti Perú · Piura · Olmos</div></div></div>' +
        '<h2 id="bsSedePregT" style="margin:22px 0 6px;font-size:24px;font-weight:700;letter-spacing:.2px;color:#0F1B33">Seleccione la sede de trabajo</h2>' +
        '<p style="margin:0 0 18px;font-size:14px;line-height:1.5;color:#3D4A63">Su usuario tiene alcance general. Indique con qué sede desea trabajar en esta sesión.</p>' +
        '<div id="bsSedePregOps" style="display:flex;flex-direction:column;gap:10px"></div>' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-top:20px;padding-top:16px;border-top:1px solid #E6EAF2">' +
        '<div style="font-size:12px;line-height:1.45;color:#5B6B86;max-width:300px">El Panel se muestra siempre de forma general. Podrá cambiar de sede tocando la etiqueta de sede junto a su nombre.</div>' +
        '<button type="button" id="bsSedePregOk" style="min-height:46px;padding:0 30px;border:0;border-radius:8px;background:#0F1B33;color:#fff;font-size:14px;font-weight:700;letter-spacing:1px;text-transform:uppercase;cursor:pointer">Continuar</button></div>';
      ov.appendChild(card);
      var ops = card.querySelector('#bsSedePregOps');
      function pintar() {
        Array.prototype.forEach.call(ops.children, function (b) {
          var on = b.getAttribute('data-v') === elegida;
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
          b.style.background = on ? '#F3F6FC' : '#fff'; b.style.border = on ? '2px solid #0F1B33' : '1px solid #C9D1E0';
          b.firstChild.style.border = on ? '6px solid #C8102E' : '2px solid #8A97AE';
        });
      }
      OPC.forEach(function (o) {
        var b = document.createElement('button'); b.type = 'button'; b.setAttribute('data-v', o[0]);
        b.style.cssText = 'display:flex;align-items:center;gap:14px;width:100%;min-height:62px;text-align:left;padding:11px 16px;border-radius:8px;color:#0F1B33;cursor:pointer;font-family:inherit';
        var aro = document.createElement('span'); aro.style.cssText = 'width:18px;height:18px;border-radius:50%;box-sizing:border-box;background:#fff;flex:0 0 auto';
        var tx = document.createElement('span'); tx.style.cssText = 'display:flex;flex-direction:column;gap:2px';
        var t1 = document.createElement('span'); t1.style.cssText = 'font-size:16px;font-weight:700'; t1.textContent = o[1];
        var t2 = document.createElement('span'); t2.style.cssText = 'font-size:12.5px;color:#4A5872'; t2.textContent = o[2];
        tx.appendChild(t1); tx.appendChild(t2); b.appendChild(aro); b.appendChild(tx);
        b.addEventListener('click', function () { elegida = o[0]; pintar(); });
        ops.appendChild(b);
      });
      pintar();
      card.querySelector('#bsSedePregOk').addEventListener('click', function () {
        try { if (m) sessionStorage.setItem('bs_sede_preg', m); } catch (e2) {}
        if (elegida !== actual) { try { if (elegida) sessionStorage.setItem('bs_sede_vista', elegida); else sessionStorage.removeItem('bs_sede_vista'); } catch (e3) {} try { location.reload(); } catch (e4) {} return; }
        ov.remove();
      });
      document.body.appendChild(ov);
      try { card.querySelector('#bsSedePregOk').focus(); } catch (e5) {}
    } catch (e) { try { console.warn('[_BS_SEDE_VISTA_V1]', e.message); } catch (e9) {} }
  }
  var todoListo = false;
  function alSaberTodo() {
    if (todoListo || olmosListo) return; todoListo = true;
    var poner = function () {
      var v = vistaBS();
      if (v === 'OLMOS') etiqueta('Sede Olmos', '#ffedd5', '#9a3412', '#fdba74'); else if (v === 'PIURA') etiqueta('Sede Piura', '#e0f2fe', '#075985', '#bae6fd'); else etiqueta('Ambas sedes', '#e0f2fe', '#075985', '#bae6fd');
      ['userName', 'proFecha'].forEach(function (id) { var c = document.getElementById('bsSedeEtq_' + id); if (c && !c._bsCambio) { c._bsCambio = true; c.style.cursor = 'pointer'; c.title = 'Cambiar de sede'; c.setAttribute('role', 'button'); c.tabIndex = 0; c.addEventListener('click', function () { preguntarSedeBS(true); }); c.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); preguntarSedeBS(true); } }); } });
    };
    var pasar = function () { poner(); [300, 1000, 2500, 5000].forEach(function (ms) { setTimeout(poner, ms); }); if (/\/portal\.html$/i.test(location.pathname)) preguntarSedeBS(false); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pasar); else pasar();
  }

  window.bsSede = function () { return sedeSesion || recuerdo() || pista() || ''; };
  if (recuerdo() === 'OLMOS' || pista() === 'OLMOS') alSaberOlmos(); else if (recuerdo() === 'TODO') alSaberTodo();
  consultar();   /* pregunta al servidor en cada pagina; si aun no hay sesion, se pregunta con la primera consulta */
})();
