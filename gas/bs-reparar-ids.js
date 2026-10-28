/*************************************************************************
 * _BS_IDS_V1 (28-oct-2026) — IDs faltantes en las hojas de Bienestar
 *
 * Problema: hay registros SIN id (pegados a mano en la hoja). El sistema no
 * puede editarlos: al "editar" uno, crea un registro nuevo y el original
 * queda igual. Además, los nuevos tomaban el id de la ÚLTIMA fila + 1, que
 * puede repetir ids si la última fila no es la de id más alto.
 *
 * 1) Run -> bs_idsSimular   : solo CUENTA, no cambia nada.
 * 2) Run -> bs_idsReparar   : por cada hoja con faltantes, primero crea una
 *    copia de respaldo "<hoja>_respaldo_ids", y luego pone id = máximo+1,
 *    +2... a las filas con datos que no tienen id (en el orden de la hoja).
 *    Solo escribe en la columna id. No mueve ni borra filas.
 *************************************************************************/

/* Siguiente id = mayor id de la columna A + 1 (usado al crear registros). */
function _bsSiguienteId_(sh) {
  var n = sh.getLastRow(); if (n < 2) return 1;
  var v = sh.getRange(2, 1, n - 1, 1).getValues(), m = 0;
  for (var i = 0; i < v.length; i++) { var x = parseInt(v[i][0], 10); if (!isNaN(x) && x > m) m = x; }
  return m + 1;
}

function _bsIdsRevisar_(escribir) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), out = [];
  var hojas = [];
  Object.keys(BS_AUD_HOJAS).forEach(function (k) { hojas.push(BS_AUD_HOJAS[k]); });
  if (typeof BS_HOSTIG_HOJAS !== 'undefined' && BS_HOSTIG_HOJAS.OLMOS) hojas.push(BS_HOSTIG_HOJAS.OLMOS);
  hojas.forEach(function (nombre) {
    var sh = ss.getSheetByName(nombre); if (!sh) return;
    var n = sh.getLastRow(), c = sh.getLastColumn(); if (n < 2) { out.push(nombre + ': vacía'); return; }
    var head = sh.getRange(1, 1, 1, c).getValues()[0].map(function (h) { return String(h).trim(); });
    if (head[0] !== 'id') { out.push(nombre + ': la columna A no es "id", no se toca'); return; }
    var data = sh.getRange(2, 1, n - 1, c).getValues(), max = 0, falt = [], vistos = {}, rep = 0;
    data.forEach(function (r, i) {
      var x = parseInt(r[0], 10);
      if (!isNaN(x)) { if (x > max) max = x; if (vistos[x]) rep++; vistos[x] = 1; return; }
      var conDatos = r.slice(1).some(function (v) { return v !== '' && v !== null; });
      if (conDatos) falt.push(i);
    });
    var linea = nombre + ': ' + falt.length + ' sin id' + (rep ? ', ' + rep + ' ids repetidos (no se tocan)' : '');
    if (escribir && falt.length) {
      var resp = nombre + '_respaldo_ids';
      if (!ss.getSheetByName(resp)) sh.copyTo(ss).setName(resp);
      var col = sh.getRange(2, 1, n - 1, 1).getValues();
      falt.forEach(function (i, k) { col[i][0] = max + 1 + k; });
      sh.getRange(2, 1, n - 1, 1).setValues(col);
      linea += ' -> asignados ' + (max + 1) + ' a ' + (max + falt.length) + ' (respaldo: ' + resp + ')';
    }
    out.push(linea);
  });
  var msg = out.join(' | ');
  Logger.log(msg);
  return msg;
}

function bs_idsSimular() { return _bsIdsRevisar_(false); }

function bs_idsReparar() {
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var r = _bsIdsRevisar_(true);
    try { CacheService.getScriptCache().removeAll(BS_DASH_CLAVES); } catch (e) {}
    try { if (typeof bs_sbResyncTodo === 'function') Logger.log('Copia Supabase: ' + bs_sbResyncTodo()); } catch (e) {}
    return r;
  } finally { lock.releaseLock(); }
}
