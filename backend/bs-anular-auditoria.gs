/* =========================================================================
 * BS-ANULAR-AUDITORIA · Backend Apps Script — Bienestar Social · Unifrutti
 * -------------------------------------------------------------------------
 * INSTALACIÓN:
 * 1. Archivo nuevo "bs-anular-auditoria" en el editor de Apps Script.
 * 2. En el switch de doPost agrega:
 *
 *      case 'bs_anularRegistro':
 *        result = bs_anularRegistro(params);
 *        break;
 *
 * 3. DESPUÉS del switch (antes de la línea de _notificarFirebase) agrega:
 *
 *      try { if (result && result.ok) bs_auditoriaAuto(params, result); } catch(eAud) {}
 *
 * 4. Nueva versión → Implementar.
 *
 * QUÉ HACE:
 * - bs_anularRegistro: marca un registro como ANULADO (columna "anulado",
 *   se crea sola al final de la hoja si no existe). NUNCA borra la fila.
 *   El frontend oculta los registros anulados; en la hoja siguen visibles.
 * - BS_Auditoria: hoja automática donde queda quién hizo qué y cuándo
 *   (crear, actualizar, importar, anular, eliminar) en todos los módulos.
 *   Útil ante inspecciones laborales.
 * ========================================================================= */

var BS_AUD_HOJAS = {
  quejas:        'BS_Quejas',
  accidentes:    'BS_Accidentes_Casos',
  hostigamiento: 'BS_Hostigamiento',
  subsidios:     'BS_Subsidios',
  sugerencias:   'BS_Sugerencias',
  rendiciones:   'BS_Rendiciones'
};

/* ---------- ANULAR (no borra: marca) ---------- */
function bs_anularRegistro(d) {
  try {
    if (!d || !d.modulo || !d.id) return { ok: false, message: 'Faltan datos (modulo, id).' };
    var motivo = String(d.motivo || '').trim();
    if (!motivo) return { ok: false, message: 'Indica el motivo de la anulación.' };

    var nombreHoja = BS_AUD_HOJAS[String(d.modulo).toLowerCase()];
    if (!nombreHoja) return { ok: false, message: 'Módulo desconocido: ' + d.modulo };

    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      var ss = SpreadsheetApp.getActive();
      var sh = ss.getSheetByName(nombreHoja);
      if (!sh) return { ok: false, message: 'No existe la hoja ' + nombreHoja + ' (ajusta BS_AUD_HOJAS).' };

      var lastCol = sh.getLastColumn();
      var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
      var colId = headers.indexOf('id');
      if (colId < 0) return { ok: false, message: 'La hoja no tiene columna "id".' };

      // columna "anulado": crearla al final si no existe
      var colAnu = headers.indexOf('anulado');
      if (colAnu < 0) {
        colAnu = lastCol; // 0-based de la nueva columna
        sh.getRange(1, lastCol + 1).setValue('anulado').setFontWeight('bold');
      }

      var lastRow = sh.getLastRow();
      if (lastRow < 2) return { ok: false, message: 'La hoja no tiene registros.' };
      var ids = sh.getRange(2, colId + 1, lastRow - 1, 1).getValues();
      var fila = -1;
      for (var i = 0; i < ids.length; i++) {
        if (String(ids[i][0]) === String(d.id)) { fila = i + 2; break; }
      }
      if (fila < 0) return { ok: false, message: 'No se encontró el registro #' + d.id + '.' };

      var yaAnulado = String(sh.getRange(fila, colAnu + 1).getValue() || '');
      if (yaAnulado) return { ok: false, message: 'El registro #' + d.id + ' ya estaba anulado (' + yaAnulado + ').' };

      var usuario = d.usuario || (d._sesion && d._sesion.usuario) || '';
      var marca = 'SI · ' + usuario + ' · ' + Utilities.formatDate(new Date(), 'America/Lima', 'dd/MM/yyyy HH:mm') + ' · ' + motivo;
      sh.getRange(fila, colAnu + 1).setValue(marca);

      var colUpd = headers.indexOf('updated_at');
      if (colUpd >= 0) sh.getRange(fila, colUpd + 1).setValue(new Date());

      bs_registrarAuditoria(usuario, 'ANULAR', d.modulo, d.id, motivo);
      return { ok: true, message: 'Registro #' + d.id + ' anulado.' };
    } finally { lock.releaseLock(); }
  } catch (e) {
    return { ok: false, message: 'Error al anular: ' + e.message };
  }
}

/* ---------- AUDITORÍA ---------- */
function _bsSheetAuditoria_() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName('BS_Auditoria');
  if (!sh) {
    sh = ss.insertSheet('BS_Auditoria');
    sh.appendRow(['fecha', 'usuario', 'accion', 'modulo', 'registro_id', 'detalle']);
    sh.getRange(1, 1, 1, 6).setFontWeight('bold');
  }
  return sh;
}

function bs_registrarAuditoria(usuario, accion, modulo, registroId, detalle) {
  try {
    _bsSheetAuditoria_().appendRow([
      new Date(),
      String(usuario || ''),
      String(accion || ''),
      String(modulo || ''),
      registroId === undefined || registroId === null ? '' : registroId,
      String(detalle || '').slice(0, 500)
    ]);
  } catch (e) { /* la auditoría nunca debe romper la operación principal */ }
}

// Registra automáticamente cualquier acción de escritura que pase por doPost
function bs_auditoriaAuto(params, result) {
  try {
    var a = String((params && params.action) || '');
    var m = a.match(/^bs_(crear|actualizar|eliminar|importar|anular)([A-Za-z]+)/);
    if (!m) return; // las lecturas (listar/dashboard) no se auditan
    if (a === 'bs_anularRegistro') return; // ya se registró con su motivo
    var accion = m[1].toUpperCase();
    var modulo = m[2].toLowerCase();
    var id = (params && params.id !== undefined && params.id !== null) ? params.id : ((result && result.id) || '');
    var detalle = '';
    if (accion === 'IMPORTAR') detalle = 'filas: ' + ((params.filas && params.filas.length) || 0) + ' · creados: ' + (result.creados || 0) + ' · actualizados: ' + (result.actualizados || 0);
    var usuario = (params && params.usuario) || (params && params._sesion && params._sesion.usuario) || '';
    bs_registrarAuditoria(usuario, accion, modulo, id, detalle);
  } catch (e) {}
}
