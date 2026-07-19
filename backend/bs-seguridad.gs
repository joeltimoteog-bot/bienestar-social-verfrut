/* =========================================================================
 * BS-SEGURIDAD · Tokens de sesión + validación de permisos en el servidor
 * Bienestar Social · Unifrutti
 * -------------------------------------------------------------------------
 * PROBLEMA QUE RESUELVE:
 * La URL del WebApp es pública. Sin esto, cualquiera que la conozca puede
 * hacer POST directo a bs_listarHostigamiento (u otra acción) y leer datos
 * confidenciales sin pasar por el login. Con esto, TODA acción exige un
 * token emitido por bs_login, y las acciones de cada módulo exigen además
 * el permiso correspondiente del usuario.
 *
 * INSTALACIÓN (3 pasos):
 *
 * 1. Crea un archivo nuevo en el editor de Apps Script llamado
 *    "bs-seguridad" y pega TODO este código.
 *
 * 2. En doPost(e), JUSTO DESPUÉS de parsear params y ANTES del switch:
 *
 *      var _acceso = bs_validarAcceso(params);
 *      if (!_acceso.ok) {
 *        return ContentService.createTextOutput(JSON.stringify(_acceso))
 *          .setMimeType(ContentService.MimeType.JSON);
 *      }
 *
 * 3. En bs_login, cuando el usuario y contraseña son correctos y ya tienes
 *    armado el objeto del usuario (el que va en { ok:true, user: ... }),
 *    agrega UNA línea antes de devolverlo:
 *
 *      objetoUsuario.token = bs_emitirToken(objetoUsuario);
 *
 *    (objetoUsuario debe tener .usuario, .rol y .permisos)
 *
 * Luego: Implementar → Administrar implementaciones → ✏️ → Nueva versión.
 *
 * NOTA: al desplegar, los usuarios con sesión abierta verán "Sesión
 * expirada" una sola vez y deberán volver a iniciar sesión (su sesión
 * antigua no tiene token). Es esperado.
 * ========================================================================= */

var BS_SEG = {
  TTL_HORAS: 12,            // duración del token (horas)
  EXENTAS: ['bs_login'],    // acciones que NO requieren token
  // Acciones que además del token exigen el permiso del módulo:
  PERMISOS: {
    quejas: ['bs_crearQueja', 'bs_listarQuejas', 'bs_actualizarQueja',
             'bs_listarSeguimientosQueja', 'bs_crearSeguimientoQueja'],
    accidentes: ['bs_crearAccidente', 'bs_listarAccidentes', 'bs_actualizarAccidente',
                 'bs_listarSeguimientos', 'bs_crearSeguimiento',
                 'bs_listarTodoHistorialAccidentes', 'bs_listarTodosSeguimientos',
                 'bs_importarAccidentes'],
    hostigamiento: ['bs_crearHostigamiento', 'bs_listarHostigamiento', 'bs_actualizarHostigamiento'],
    subsidios: ['bs_crearSubsidio', 'bs_listarSubsidios', 'bs_actualizarSubsidio', 'bs_importarSubsidios']
  }
  // Cualquier otra acción bs_* (dashboard, alertas, documentos, rendiciones,
  // sugerencias, estadísticas, etc.) exige token válido, sin permiso extra.
};

/* ---------- EMITIR TOKEN (llamar desde bs_login) ---------- */
function bs_emitirToken(u) {
  var token = Utilities.getUuid() + Utilities.getUuid().slice(0, 8);
  var expira = Date.now() + BS_SEG.TTL_HORAS * 3600 * 1000;
  var data = {
    usuario: (u && u.usuario) || '',
    rol: (u && u.rol) || '',
    permisos: (u && u.permisos) || {},
    expira: expira
  };
  // Cache (rápido, máx 6 h) + hoja (respaldo hasta que expire)
  try {
    CacheService.getScriptCache().put('bs_tok_' + token, JSON.stringify(data),
      Math.min(21600, Math.floor(BS_SEG.TTL_HORAS * 3600)));
  } catch (e) {}
  var sh = _bsSheetTokens_();
  sh.appendRow([token, data.usuario, data.rol, JSON.stringify(data.permisos), new Date(), new Date(expira)]);
  _bsPurgarTokens_(sh);
  return token;
}

/* ---------- VALIDAR ACCESO (llamar desde doPost) ---------- */
function bs_validarAcceso(params) {
  try {
    var action = params && params.action;
    if (!action) return { ok: false, code: 400, message: 'Acción no especificada.' };
    if (BS_SEG.EXENTAS.indexOf(action) >= 0) return { ok: true };

    var token = params.token;
    if (!token) return _bsNoAutorizado_();

    var s = _bsBuscarToken_(String(token));
    if (!s || !s.expira || Date.now() > s.expira) return _bsNoAutorizado_();

    // Permiso por módulo (los admins pasan todo)
    var rol = String(s.rol || '').toLowerCase();
    if (rol.indexOf('admin') < 0 && action === 'bs_anularRegistro') {
      var modAnu = String(params.modulo || '').toLowerCase();
      if (BS_SEG.PERMISOS[modAnu] && (!s.permisos || !s.permisos[modAnu])) {
        return { ok: false, code: 403, message: 'No tienes permiso para el módulo "' + modAnu + '".' };
      }
    }
    if (rol.indexOf('admin') < 0) {
      for (var mod in BS_SEG.PERMISOS) {
        if (BS_SEG.PERMISOS[mod].indexOf(action) >= 0) {
          if (!s.permisos || !s.permisos[mod]) {
            return { ok: false, code: 403, message: 'No tienes permiso para el módulo "' + mod + '".' };
          }
          break;
        }
      }
    }
    params._sesion = s; // disponible para las acciones (quién es el usuario real)
    return { ok: true };
  } catch (e) {
    return { ok: false, code: 500, message: 'Error validando la sesión: ' + e.message };
  }
}

function _bsNoAutorizado_() {
  return { ok: false, code: 401, message: 'Sesión inválida o expirada. Vuelve a iniciar sesión.' };
}

/* ---------- helpers ---------- */
function _bsBuscarToken_(token) {
  // 1) cache
  try {
    var c = CacheService.getScriptCache().get('bs_tok_' + token);
    if (c) return JSON.parse(c);
  } catch (e) {}
  // 2) hoja
  var sh = _bsSheetTokens_();
  var last = sh.getLastRow();
  if (last < 2) return null;
  var vals = sh.getRange(2, 1, last - 1, 6).getValues();
  for (var i = vals.length - 1; i >= 0; i--) {
    if (String(vals[i][0]) === token) {
      var s = {
        usuario: vals[i][1],
        rol: vals[i][2],
        permisos: {},
        expira: vals[i][5] ? new Date(vals[i][5]).getTime() : 0
      };
      try { s.permisos = JSON.parse(vals[i][3] || '{}'); } catch (e) {}
      // re-cachear para las siguientes llamadas
      try {
        var restante = Math.floor((s.expira - Date.now()) / 1000);
        if (restante > 30) {
          CacheService.getScriptCache().put('bs_tok_' + token, JSON.stringify(s), Math.min(21600, restante));
        }
      } catch (e2) {}
      return s;
    }
  }
  return null;
}

function _bsSheetTokens_() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName('BS_Tokens');
  if (!sh) {
    sh = ss.insertSheet('BS_Tokens');
    sh.appendRow(['token', 'usuario', 'rol', 'permisos', 'creado', 'expira']);
    sh.getRange(1, 1, 1, 6).setFontWeight('bold');
    sh.hideSheet(); // hoja interna, no estorba
  }
  return sh;
}

// Limpia tokens vencidos cuando la hoja crece (se llama al emitir)
function _bsPurgarTokens_(sh) {
  try {
    var last = sh.getLastRow();
    if (last < 300) return;
    var vals = sh.getRange(2, 6, last - 1, 1).getValues();
    var ahora = Date.now();
    for (var i = vals.length - 1; i >= 0; i--) {
      var exp = vals[i][0] ? new Date(vals[i][0]).getTime() : 0;
      if (exp && exp < ahora) sh.deleteRow(i + 2);
    }
  } catch (e) {}
}
