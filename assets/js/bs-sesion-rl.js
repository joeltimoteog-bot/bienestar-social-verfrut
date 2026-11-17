/* ═══════════════════════════════════════════════════════════════════════════
   bs-sesion-rl.js — _BS_SESION_RL_V1 (15-nov-2026) · v3 (16-nov): el intento de renovación caduca a los 3 min
   · v4 (17-nov, _BS_ESPERA_LLAVE_V1): las consultas a Google que salen SIN llave (o mientras se renueva) ESPERAN a que
     llegue la llave y salen con ella. Antes salian sin llave, Google respondia "sesion invalida", se renovaba y la
     pagina se RECARGABA (3-20 s) o, si Google tardaba, mandaba al login.
   PROBLEMA: al entrar a Bienestar desde el RR.LL., la sesion de Bienestar se pedia a Google Apps Script (bs_login),
   que tarda 3-8 s y a veces no responde; entonces el portal no encontraba sesion (o la encontraba vencida) y mandaba
   al login, aunque la persona ya habia ingresado al RR.LL. con sus permisos.
   SOLUCION (sin tocar el flujo de las paginas):
     1) Si no hay sesion de Bienestar pero SI hay sesion del RR.LL. en esta pestaña (misma web sistemarrll.com), se crea
        la sesion de Bienestar al instante con esos datos (usuario, nombre, rol, pase del RR.LL.).
     2) Los permisos reales se leen de Supabase (Acceso a Modulos del RR.LL.), en menos de 1 s.
     3) El token de Google (que todavia usan los modulos antiguos: documentos, alertas…) se pide en SEGUNDO PLANO con el
        pase del RR.LL., sin bloquear; si falla, el portal igual abre y lo reintenta mas tarde.
     4) Si Google responde "sesion invalida" (401) y hay pase del RR.LL., se renueva una vez y se recarga, en vez de
        mandar al login.
   Se carga ANTES de portal-01.js. Apagar: localStorage.bs_sesion_rl = 'off'.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  try { if (localStorage.getItem('bs_sesion_rl') === 'off') return; } catch (e) { return; }
  var GAS = 'https://script.google.com/macros/s/AKfycbyJIUtdpApEc35Jj4ZNP-3ONqGe64J1VhaRvkt87vVUNTgSagrOgOS0T99eIt0-w3Yi/exec';
  var SB = 'https://exdjzbfinppzatjyimxn.supabase.co/functions/v1/api/bs/permisos?forceFunctionRegion=sa-east-1';
  var RENOVAR_MS = 10 * 3600 * 1000;
  var CLAVE = 'bienestarSocialAuth';

  function leer(k, s) { try { return JSON.parse((s ? sessionStorage : localStorage).getItem(k) || 'null'); } catch (e) { return null; } }
  function sesionBS() { return leer(CLAVE); }
  function guardarBS(s) { try { localStorage.setItem(CLAVE, JSON.stringify(s)); } catch (e) {} }
  function rlToken() { try { return sessionStorage.getItem('rl_token') || ''; } catch (e) { return ''; } }
  function rlUser() { var u = leer('user', true); if (u && u.usuario) return u; var s = leer('rl_session'); return (s && s.user && s.user.usuario) ? s.user : null; }
  function esAdmin(u) { return /admin|geren|coordinador|jef/i.test(String((u && u.rol) || '')) || String((u && u.usuario) || '').toLowerCase() === 'jtimoteo'; }
  function edadMs(s) { var t = Date.parse((s && s.loginAt) || ''); return t ? (Date.now() - t) : Infinity; }

  try { sessionStorage.removeItem('bs_salio'); } catch (e) {}   /* _BS_AUTO_ENTRADA_V1: ya esta en el portal: la marca de 'cerro sesion' no aplica */
  /* 1) sesion provisional inmediata desde la sesion del RR.LL. (misma pestaña) */
  var tk = rlToken(), ru = rlUser(), s = sesionBS();
  var mismo = s && ru && String(s.usuario || '').toLowerCase() === String(ru.usuario || '').toLowerCase();
  if (tk && ru && (!s || !mismo)) {
    s = { usuario: ru.usuario, nombre: ru.nombre || ru.usuario, rol: ru.rol || '', sector: ru.sector || '', empresa: ru.empresa || '',
      permisos: esAdmin(ru) ? { quejas: true, accidentes: true, hostigamiento: true, subsidios: true, rendiciones: true, panel: true, estadisticas: true } : {},
      token: '', rl_token: tk, loginAt: new Date().toISOString(), source: 'rl-sesion-directa' };
    guardarBS(s);
    try { console.log('[_BS_SESION_RL_V1] sesion de Bienestar creada desde la sesion del RR.LL. (' + ru.usuario + ')'); } catch (e) {}
  } else if (s && tk && !s.rl_token) { s.rl_token = tk; guardarBS(s); }

  /* 2) permisos reales desde Supabase (Acceso a Modulos) — el portal ya los prefiere, aqui solo se completan en la sesion */
  function permisosSupabase() {
    var t = (sesionBS() || {}).rl_token || rlToken(); if (!t) return;
    fetch(SB, { headers: { Authorization: 'Bearer ' + t } }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j || !j.success) return;
      var a = sesionBS(); if (!a) return;
      var p = Object.assign({}, a.permisos || {});
      if (j.esAdmin) ['quejas', 'accidentes', 'hostigamiento', 'subsidios', 'rendiciones', 'panel', 'estadisticas'].forEach(function (k) { p[k] = true; });
      Object.keys(j.permisos || {}).forEach(function (k) { if (j.permisos[k]) p[k] = true; });
      a.permisos = p; a.permisosFuente = 'rrll'; guardarBS(a);
    }).catch(function () {});
  }

  /* 3) token de Google en segundo plano (modulos antiguos); nunca bloquea */
  var renovando = false, esperando = [];
  function avisarFin(ok) { var L = esperando; esperando = []; L.forEach(function (f) { try { f(ok); } catch (e) {} }); }
  function renovarGoogle(alTerminar) {
    var a = sesionBS(); var t = (a && a.rl_token) || rlToken(); var u = (a && a.usuario) || (ru && ru.usuario);
    if (!t || !u) { if (alTerminar) alTerminar(false); return; }
    if (alTerminar) esperando.push(alTerminar);
    if (renovando) return;   /* ya hay una renovacion en curso: se avisa a todos cuando termine */
    renovando = true;
    var ctl = (typeof AbortController === 'function') ? new AbortController() : null;
    var reloj = setTimeout(function () { if (ctl) { try { ctl.abort(); } catch (e) {} } }, 20000);
    fetch(GAS, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, signal: ctl ? ctl.signal : undefined,
      body: JSON.stringify({ action: 'bs_login', usuario: u, password: '', rl_token: t }) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        clearTimeout(reloj); renovando = false;
        if (d && d.ok && d.user && d.user.token) {
          var b = sesionBS() || {};
          b.usuario = d.user.usuario || b.usuario; b.nombre = d.user.nombre || b.nombre; b.rol = d.user.rol || b.rol;
          b.permisos = Object.assign({}, d.user.permisos || {}, b.permisosFuente === 'rrll' ? (b.permisos || {}) : {});   /* los del RR.LL. mandan */
          b.token = d.user.token; b.rl_token = t; b.loginAt = new Date().toISOString(); b.source = 'sistema-rl-verfrut';
          guardarBS(b);
          try { console.log('[_BS_SESION_RL_V1] token de Google renovado en segundo plano'); } catch (e) {}
          avisarFin(true);
        } else { try { console.warn('[_BS_SESION_RL_V1] Google no entrego token:', d && d.message); } catch (e) {} avisarFin(false); }
      })
      .catch(function (e) { clearTimeout(reloj); renovando = false; try { console.warn('[_BS_SESION_RL_V1] Google no respondio (se reintenta luego)', e && e.name); } catch (x) {} avisarFin(false); });
  }
  window.bsRenovarSesionRL = renovarGoogle;

  var ahora = sesionBS();
  if (ahora && ahora.rl_token) {
    permisosSupabase();
    if (!ahora.token || edadMs(ahora) > RENOVAR_MS) renovarGoogle();   /* v4: de inmediato, asi las consultas esperan a esta renovacion */
  }

  /* 3b) _BS_ESPERA_LLAVE_V1 (17-nov-2026): consulta a Google sin llave (o con renovacion en curso) -> esperar la llave */
  (function () {
    var fOrig = window.fetch;
    if (typeof fOrig !== 'function' || fOrig._bsEspera) return;
    var envuelto = function (input, init) {
      try {
        var u = typeof input === 'string' ? input : ((input && input.url) || '');
        if (u.indexOf(GAS) === 0 && init && typeof init.body === 'string' && init.body.indexOf('"action"') >= 0) {
          var b = JSON.parse(init.body);
          var a = sesionBS() || {};
          if (b && b.action && b.action !== 'bs_login' && (a.rl_token || rlToken()) && (renovando || (!b.token && !a.token))) {
            var self = this;
            return new Promise(function (listo) { renovarGoogle(function () { listo(); }); }).then(function () {
              var t = (sesionBS() || {}).token;
              var init2 = init;
              if (t && b.token !== t) { b.token = t; init2 = Object.assign({}, init, { body: JSON.stringify(b) }); }
              return fOrig.call(self, input, init2);
            });
          }
        }
      } catch (e) {}
      return fOrig.apply(this, arguments);
    };
    envuelto._bsEspera = true;
    window.fetch = envuelto;
  })();

  /* 4) 401 de Google con pase del RR.LL. vigente: renovar una vez y recargar, en vez de mandar al login */
  /* el intento de renovacion se recuerda solo 3 minutos (antes quedaba para siempre en la pestaña y, si un intento viejo
     habia fallado, cualquier 401 posterior mandaba al login aunque el pase del RR.LL. estuviera vigente) */
  var yaIntento = false; try { var tI = Number(sessionStorage.getItem('_bsRenov401') || 0); yaIntento = tI > 0 && (Date.now() - tI) < 180000; if (!yaIntento) sessionStorage.removeItem('_bsRenov401'); } catch (e) {}
  function salirAlLogin() {   /* lo mismo que hace bs-mejoras.js cuando no esta cargado (p. ej. portal.html) */
    try { localStorage.removeItem(CLAVE); Object.keys(localStorage).forEach(function (k) { if (k.indexOf('bs_cache_') === 0) localStorage.removeItem(k); }); Object.keys(sessionStorage).forEach(function (k) { if (k.indexOf('bs_cache_') === 0) sessionStorage.removeItem(k); }); } catch (e) {}
    location.href = (location.pathname.indexOf('/modulos/') >= 0 ? '../' : '') + 'index.html';
  }
  function envolver() {
    var orig = window.bsSesionInvalida;
    if (orig && orig._bsRl) return true;
    if (typeof orig !== 'function') orig = function (res) { if (res && res.code === 401) { salirAlLogin(); return true; } return false; };
    var fallo = false;   /* la renovacion de ESTA carga ya fallo: el siguiente 401 si manda al login */
    var nuevo = function (res) {
      if (res && res.code === 401 && !fallo && !yaIntento && ((sesionBS() || {}).rl_token || rlToken())) {
        /* varias consultas a Google fallan casi a la vez (alertas, atrasos, documentos…): TODAS esperan a la misma renovacion.
           v3: antes solo la primera esperaba y la segunda mandaba al login 300 ms despues. */
        if (!renovando && !esperando.length) { try { sessionStorage.setItem('_bsRenov401', String(Date.now())); } catch (e) {} try { console.warn('[_BS_SESION_RL_V1] Google dice sesion invalida; se renueva con el pase del RR.LL.'); } catch (e) {} }
        renovarGoogle(function (ok) { if (ok) { try { sessionStorage.removeItem('_bsRenov401'); } catch (e) {} if (!nuevo._recargado) { nuevo._recargado = true; location.reload(); } } else { fallo = true; orig(res); } });
        return true;   /* la llamada actual se detiene; la pagina se recarga con token nuevo */
      }
      return orig(res);
    };
    nuevo._bsRl = true; window.bsSesionInvalida = nuevo; return true;
  }
  envolver();   /* si bs-mejoras.js se carga despues y lo reemplaza, se vuelve a envolver */
  var n = 0, iv = setInterval(function () { if (++n > 40) clearInterval(iv); envolver(); }, 250);
})();
