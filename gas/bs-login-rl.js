/* ═══════════════════════════════════════════════════════════════════════════
   _BS_LOGIN_RL_V1 (20-oct-2026) — ingreso a Bienestar con la contraseña del Sistema RR.LL.
   ---------------------------------------------------------------------------
   ANTES: bs_login solo comparaba con la clave propia de la hoja Usuarios de Bienestar.
          Cuando el usuario cambiaba su contraseña en el RR.LL. (seguridad 18-oct), aquí
          seguía valiendo la antigua y no podía entrar.
   AHORA: si la clave propia no coincide pero llega 'rl_token' (el login firmado del RR.LL.),
          se le pregunta a Azure (auth/sso, accion 'sesion') si el token es auténtico y de
          ESE mismo usuario. Si lo es, entra con los permisos de SIEMPRE (hoja Usuarios de
          Bienestar, fila activa). Quien no está en esa hoja sigue sin acceso.
   No cambia nada de lo que ya funciona: bs_login se prueba primero, igual que antes.
   Para desactivar: borrar este archivo (doPost lo usa solo si existe).
   ═══════════════════════════════════════════════════════════════════════════ */
var BS_RL_SSO_URL = 'https://rl-fn-verfrut.azurewebsites.net/api/auth/sso';

function bs_loginConRL_(usuario, rlToken) {
  var NO = { ok: false, message: 'Usuario o contrasena incorrectos' };
  try {
    var u = String(usuario || '').toLowerCase().trim(), tk = String(rlToken || '').trim();
    if (!u || !tk || tk.split('.').length !== 3) return NO;
    var r = UrlFetchApp.fetch(BS_RL_SSO_URL, {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify({ accion: 'sesion', token: tk }), muteHttpExceptions: true
    });
    var j = null; try { j = JSON.parse(r.getContentText()); } catch (eJ) {}
    if (r.getResponseCode() !== 200 || !j || !j.success || !j.user ||
        String(j.user.usuario || '').toLowerCase().trim() !== u) return NO;

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BS_CONFIG.HOJA_USUARIOS);
    if (!sheet) return { ok: false, message: 'Hoja Usuarios no existe' };
    var data = sheet.getDataRange().getValues();
    var headers = data[0].map(function (h) { return String(h).trim(); });
    function gv(row, col) { var i = headers.indexOf(col); return i >= 0 ? row[i] : undefined; }
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (String(gv(row, 'usuario') || '').toLowerCase().trim() === u && gv(row, 'activo') === true) {
        return {
          ok: true,
          via: 'rrll',
          user: {
            usuario: gv(row, 'usuario'),
            nombre: gv(row, 'nombre'),
            rol: gv(row, 'rol'),
            email: gv(row, 'email'),
            permisos: {
              quejas:        gv(row, 'mod_quejas') === true,
              accidentes:    gv(row, 'mod_accidentes') === true,
              hostigamiento: gv(row, 'mod_hostigamiento') === true,
              subsidios:     gv(row, 'mod_subsidios') === true,
              rendiciones:   gv(row, 'mod_rendiciones') === true,
              panel:         gv(row, 'mod_panel') === true,
              estadisticas:  gv(row, 'mod_estadisticas') === true,
              descansos:     gv(row, 'mod_descansos') === true
            },
            loginAt: new Date().toISOString()
          }
        };
      }
    }
    return { ok: false, message: 'Tu usuario no tiene acceso a Bienestar Social. Solicítalo al administrador.' };
  } catch (e) {
    try { console.warn('[_BS_LOGIN_RL_V1] ' + e.message); } catch (e2) {}
    return NO;
  }
}

/* _BS_AZURE_SESION_V1 (25-oct-2026): con las mismas credenciales, pide a Azure (auth/login de RR.LL.) una sesion firmada.
   Solo se usa para que Bienestar pueda consultar Azure (trabajadores). Si falla, devuelve '' y Bienestar sigue igual. */
function bs_rlTokenPorClave_(usuario, password) {
  try {
    var u = String(usuario || '').toLowerCase().trim(), p = String(password || '');
    if (!u || !p) return '';
    var r = UrlFetchApp.fetch(BS_RL_SSO_URL.replace(/\/auth\/sso$/, '/auth/login'), {
      method: 'post', contentType: 'application/json', payload: JSON.stringify({ usuario: u, password: p }), muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) return '';
    var j = JSON.parse(r.getContentText());
    return (j && j.success && j.token) ? String(j.token) : '';
  } catch (e) { return ''; }
}
