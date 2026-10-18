/* =========================================================================
 * BS-IMPORTAR-ACCIDENTES · Backend Apps Script — Bienestar Social · Unifrutti
 * -------------------------------------------------------------------------
 * INSTALACIÓN:
 * 1. Archivo nuevo "bs-importar-accidentes" en el editor de Apps Script.
 * 2. En el switch de doPost agrega:
 *
 *      case 'bs_importarAccidentes':
 *        result = bs_importarAccidentes(params);
 *        break;
 *
 * 3. En bs-seguridad, agrega 'bs_importarAccidentes' a la lista de
 *    accidentes en BS_SEG.PERMISOS (o pega la versión actualizada).
 * 4. Nueva versión → Implementar.
 *
 * Hace UPSERT en BS_Accidentes_Casos: si una fila coincide con un caso
 * existente (mismo DNI + día del accidente) actualiza solo los campos con
 * valor; si no existe, lo agrega con id nuevo. Nunca borra.
 * ========================================================================= */

function bs_importarAccidentes(d) {
  try {
    if (!d || !d.filas || !d.filas.length) return { ok: false, message: 'No llegaron filas para importar.' };
    if (d.filas.length > 200) return { ok: false, message: 'Máximo 200 filas por lote.' };

    var lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      var ss = SpreadsheetApp.getActive();
      var sh = ss.getSheetByName('BS_Accidentes_Casos');
      if (!sh) return { ok: false, message: 'No existe la hoja BS_Accidentes_Casos.' };

      var lastCol = sh.getLastColumn();
      var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
      var idx = {};
      headers.forEach(function (h, i) { idx[String(h).trim()] = i; });
      if (idx['id'] === undefined) return { ok: false, message: 'La hoja no tiene columna "id" en la fila 1.' };

      var lastRow = sh.getLastRow();
      var data = lastRow > 1 ? sh.getRange(2, 1, lastRow - 1, lastCol).getValues() : [];

      // normaliza cualquier fecha a 'yyyy-MM-dd' para comparar
      function fechaYMD(v) {
        if (v === null || v === undefined || v === '') return '';
        if (Object.prototype.toString.call(v) === '[object Date]') {
          return Utilities.formatDate(v, 'America/Lima', 'yyyy-MM-dd');
        }
        var s = String(v).trim();
        var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (m) return m[1] + '-' + ('0' + (+m[2])).slice(-2) + '-' + ('0' + (+m[3])).slice(-2);
        m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (m) return m[3] + '-' + ('0' + (+m[2])).slice(-2) + '-' + ('0' + (+m[1])).slice(-2);
        return s;
      }
      function claveDe(get) {
        var dni = String(get('dni') || '').trim();
        var fec = fechaYMD(get('dia_accidente'));
        if (!dni || !fec) return '';
        return dni + '|' + fec;
      }

      var mapa = {}, maxId = 0;
      data.forEach(function (r, i) {
        var id = parseInt(r[idx['id']], 10);
        if (!isNaN(id) && id > maxId) maxId = id;
        var g = function (c) { return idx[c] === undefined ? '' : r[idx[c]]; };
        var k = claveDe(g);
        if (k && mapa[k] === undefined) mapa[k] = i;
      });

      var creados = 0, actualizados = 0, errores = [];
      var ahora = new Date();
      var usuario = d.usuario || 'importacion';
      var soloAgregar = (d.modo === 'solo_agregar');

      d.filas.forEach(function (f, n) {
        try {
          var g = function (c) { return f[c] === undefined || f[c] === null ? '' : f[c]; };
          var k = claveDe(g);
          if (!soloAgregar && k && mapa[k] !== undefined) {
            var rowN = mapa[k] + 2;
            var rowVals = sh.getRange(rowN, 1, 1, lastCol).getValues()[0];
            for (var c in f) {
              if (c === 'id' || idx[c] === undefined) continue;
              var v = f[c];
              if (v === '' || v === null || v === undefined) continue;
              rowVals[idx[c]] = v;
            }
            if (idx['updated_at'] !== undefined) rowVals[idx['updated_at']] = ahora;
            sh.getRange(rowN, 1, 1, lastCol).setValues([rowVals]);
            actualizados++;
          } else {
            maxId++;
            var nueva = [];
            for (var i2 = 0; i2 < lastCol; i2++) nueva.push('');
            nueva[idx['id']] = maxId;
            for (var c2 in f) { if (c2 !== 'id' && idx[c2] !== undefined) nueva[idx[c2]] = f[c2]; }
            if (idx['numero_atenciones'] !== undefined && nueva[idx['numero_atenciones']] === '') nueva[idx['numero_atenciones']] = 0;
            if (idx['estado_caso'] !== undefined && nueva[idx['estado_caso']] === '') nueva[idx['estado_caso']] = 'Activo';
            if (idx['created_by'] !== undefined) nueva[idx['created_by']] = usuario;
            if (idx['created_at'] !== undefined) nueva[idx['created_at']] = ahora;
            if (idx['updated_at'] !== undefined) nueva[idx['updated_at']] = ahora;
            sh.appendRow(nueva);
            data.push(nueva);
            if (k) mapa[k] = data.length - 1;
            creados++;
          }
        } catch (e) { errores.push('Fila ' + (n + 1) + ': ' + e.message); }
      });

      return { ok: true, creados: creados, actualizados: actualizados, errores: errores };
    } finally { lock.releaseLock(); }
  } catch (e) {
    return { ok: false, message: 'Error al importar: ' + e.message };
  }
}
