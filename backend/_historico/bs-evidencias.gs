/* =========================================================================
 * BS-EVIDENCIAS · Backend Apps Script — Bienestar Social · Unifrutti
 * -------------------------------------------------------------------------
 * INSTALACIÓN (una sola vez):
 * 1. Abre script.google.com → tu proyecto de Bienestar Social.
 * 2. Crea un archivo nuevo (+ → Secuencia de comandos) llamado "bs-evidencias"
 *    y pega TODO este código.
 * 3. En tu función doPost(e), dentro del switch/if de acciones, agrega:
 *
 *      case 'bs_subirDocumento':   result = bs_subirDocumento(params); break;
 *      case 'bs_listarDocumentos': result = bs_listarDocumentos(params); break;
 *      case 'bs_verDocumento':     result = bs_verDocumento(params); break;
 *
 *    (usa el mismo patrón que tus demás acciones; "datos" es el body parseado
 *     y _json tu helper de respuesta ContentService)
 * 4. Implementar → Administrar implementaciones → Editar → Nueva versión → Implementar.
 *
 * Los archivos se guardan en Drive: BS_Evidencias/<MÓDULO>/CASO_<id>/
 * y se registran en la hoja "BS_Documentos" (se crea sola si no existe).
 * ========================================================================= */

var BS_EVID_ROOT = 'BS_Evidencias';
var BS_EVID_MAX_BYTES = 6 * 1024 * 1024; // 6 MB por archivo

function bs_subirDocumento(d) {
  try {
    if (!d || !d.modulo || !d.caso_id || !d.base64 || !d.nombre) {
      return { ok: false, message: 'Faltan datos (modulo, caso_id, nombre, base64).' };
    }
    var bytes = Utilities.base64Decode(d.base64);
    if (bytes.length > BS_EVID_MAX_BYTES) {
      return { ok: false, message: 'El archivo supera el máximo de 6 MB.' };
    }
    var mime = d.mime || 'application/octet-stream';
    // Solo imágenes y PDF por seguridad
    if (!/^image\/|^application\/pdf$/.test(mime)) {
      return { ok: false, message: 'Solo se permiten imágenes o PDF.' };
    }

    var root = _bsFolder_(DriveApp.getRootFolder(), BS_EVID_ROOT);
    var fMod = _bsFolder_(root, String(d.modulo).toUpperCase());
    var fCaso = _bsFolder_(fMod, 'CASO_' + d.caso_id);

    var nombre = String(d.nombre).replace(/[\\/:*?"<>|]/g, '_');
    var blob = Utilities.newBlob(bytes, mime, nombre);
    var file = fCaso.createFile(blob);
    // PRIVADO: ya no se comparte con enlace público. Se sirve vía bs_verDocumento.

    var sh = _bsSheetDocs_();
    var id = Math.max(1, sh.getLastRow()); // correlativo simple
    sh.appendRow([
      id,
      String(d.modulo).toUpperCase(),
      d.caso_id,
      nombre,
      file.getUrl(),
      mime,
      d.usuario || '',
      new Date()
    ]);

    return { ok: true, id: id, nombre: nombre, url: file.getUrl() };
  } catch (e) {
    return { ok: false, message: 'Error al guardar: ' + e.message };
  }
}

function bs_listarDocumentos(d) {
  try {
    if (!d || !d.modulo || !d.caso_id) return { ok: false, message: 'Faltan modulo y caso_id.' };
    var sh = _bsSheetDocs_();
    var last = sh.getLastRow();
    if (last < 2) return { ok: true, items: [] };
    var vals = sh.getRange(2, 1, last - 1, 8).getValues();
    var mod = String(d.modulo).toUpperCase();
    var caso = String(d.caso_id);
    var items = [];
    for (var i = 0; i < vals.length; i++) {
      var r = vals[i];
      if (String(r[1]).toUpperCase() === mod && String(r[2]) === caso) {
        items.push({
          id: r[0], modulo: r[1], caso_id: r[2], nombre: r[3],
          url: r[4], mime: r[5], subido_por: r[6],
          fecha: r[7] ? Utilities.formatDate(new Date(r[7]), 'America/Lima', 'dd/MM/yyyy HH:mm') : ''
        });
      }
    }
    return { ok: true, items: items };
  } catch (e) {
    return { ok: false, message: 'Error al listar: ' + e.message };
  }
}

/* ---------- helpers ---------- */
function _bsSheetDocs_() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName('BS_Documentos');
  if (!sh) {
    sh = ss.insertSheet('BS_Documentos');
    sh.appendRow(['id', 'modulo', 'caso_id', 'nombre', 'url', 'mime', 'subido_por', 'fecha']);
    sh.getRange(1, 1, 1, 8).setFontWeight('bold');
  }
  return sh;
}

function _bsFolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}


/* ---------- VER DOCUMENTO (privado, requiere sesión con token) ---------- */
function bs_verDocumento(d) {
  try {
    if (!d || !d.id) return { ok: false, message: 'Falta el id del documento.' };
    var sh = _bsSheetDocs_();
    var last = sh.getLastRow();
    if (last < 2) return { ok: false, message: 'No hay documentos.' };
    var vals = sh.getRange(2, 1, last - 1, 8).getValues();
    for (var i = 0; i < vals.length; i++) {
      if (String(vals[i][0]) === String(d.id)) {
        var url = String(vals[i][4] || '');
        var m = url.match(/[-\w]{25,}/);
        if (!m) return { ok: false, message: 'URL de archivo inválida.' };
        var file = DriveApp.getFileById(m[0]);
        var blob = file.getBlob();
        if (blob.getBytes().length > 8 * 1024 * 1024) return { ok: false, message: 'Archivo demasiado grande para visualizar.' };
        return { ok: true, nombre: vals[i][3], mime: blob.getContentType(), base64: Utilities.base64Encode(blob.getBytes()) };
      }
    }
    return { ok: false, message: 'Documento no encontrado.' };
  } catch (e) { return { ok: false, message: 'Error al abrir: ' + e.message }; }
}

/* ---------- UTILIDAD (ejecutar UNA VEZ desde el editor) ----------
 * Quita el enlace público de TODAS las evidencias ya subidas.
 * Ejecutar → seleccionar bs_privatizarEvidencias → Ejecutar. */
function bs_privatizarEvidencias() {
  var sh = _bsSheetDocs_();
  var last = sh.getLastRow();
  if (last < 2) { Logger.log('Sin documentos.'); return; }
  var vals = sh.getRange(2, 5, last - 1, 1).getValues(); // columna url
  var ok = 0, err = 0;
  for (var i = 0; i < vals.length; i++) {
    try {
      var m = String(vals[i][0] || '').match(/[-\w]{25,}/);
      if (!m) { err++; continue; }
      DriveApp.getFileById(m[0]).setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
      ok++;
    } catch (e) { err++; }
  }
  Logger.log('Privatizados: ' + ok + ' · Errores: ' + err);
}
