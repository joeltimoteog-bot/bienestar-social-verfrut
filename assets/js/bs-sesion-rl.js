/* ═══════════════════════════════════════════════════════════════════════════
   bs-sesion-rl.js — _BS_SESION_RL_V1 (15-nov-2026)
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
  var renovando = false;
  function renovarGoogle(alTerminar) {
    var a = sesionBS(); var t = (a && a.rl_token) || rlToken(); var u = (a && a.usuario) || (ru && ru.usuario);
    if (!t || !u || renovando) { if (alTerminar) alTerminar(false); return; }
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
          if (alTerminar) alTerminar(true);
        } else { try { console.warn('[_BS_SESION_RL_V1] Google no entrego token:', d && d.message); } catch (e) {} if (alTerminar) alTerminar(false); }
      })
      .catch(function (e) { clearTimeout(reloj); renovando = false; try { console.warn('[_BS_SESION_RL_V1] Google no respondio (se reintenta luego)', e && e.name); } catch (x) {} if (alTerminar) alTerminar(false); });
  }
  window.bsRenovarSesionRL = renovarGoogle;

  var ahora = sesionBS();
  if (ahora && ahora.rl_token) {
    permisosSupabase();
    if (!ahora.token || edadMs(ahora) > RENOVAR_MS) setTimeout(function () { renovarGoogle(); }, 300);
  }

  /* 4) 401 de Google con pase del RR.LL. vigente: renovar una vez y recargar, en vez de mandar al login */
  var yaIntento = false; try { yaIntento = sessionStorage.getItem('_bsRenov401') === '1'; } catch (e) {}
  function envolver() {
    var orig = window.bsSesionInvalida;
    if (typeof orig !== 'function' || orig._bsRl) return !!(orig && orig._bsRl);
    var nuevo = function (res) {
      if (res && res.code === 401 && !yaIntento && ((sesionBS() || {}).rl_token || rlToken())) {
        yaIntento = true; try { sessionStorage.setItem('_bsRenov401', '1'); } catch (e) {}
        try { console.warn('[_BS_SESION_RL_V1] Google dice sesion invalida; se renueva con el pase del RR.LL.'); } catch (e) {}
        renovarGoogle(function (ok) { if (ok) { try { sessionStorage.removeItem('_bsRenov401'); } catch (e) {} location.reload(); } else { orig(res); } });
        return true;   /* la llamada actual se detiene; la pagina se recarga con token nuevo */
      }
      return orig(res);
    };
    nuevo._bsRl = true; window.bsSesionInvalida = nuevo; return true;
  }
  var n = 0, iv = setInterval(function () { if (envolver() || ++n > 40) clearInterval(iv); }, 250); envolver();
})();
