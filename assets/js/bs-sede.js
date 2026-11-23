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
        if (j.sede === 'OLMOS') alSaberOlmos();
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

  var envuelto = function (input, init) {
    var u = '';
    try { u = typeof input === 'string' ? input : ((input && input.url) || ''); } catch (e) { u = ''; }
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
    } catch (e) {}
  }
  var olmosListo = false;
  function alSaberOlmos() {
    if (olmosListo) return; olmosListo = true;
    try { document.documentElement.setAttribute('data-bs-sede', 'OLMOS'); } catch (e) {}
    var pasar = function () { adaptar(); [300, 1000, 2500, 5000].forEach(function (ms) { setTimeout(adaptar, ms); }); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pasar); else pasar();
  }

  window.bsSede = function () { return sedeSesion || recuerdo() || pista() || ''; };
  if (recuerdo() === 'OLMOS' || pista() === 'OLMOS') alSaberOlmos();
  consultar();   /* pregunta al servidor en cada pagina; si aun no hay sesion, se pregunta con la primera consulta */
})();
