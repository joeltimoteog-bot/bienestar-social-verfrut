/* =========================================================================
 * BS-IMPORTAR-SUBSIDIOS · Backend Apps Script — Bienestar Social · Unifrutti
 * -------------------------------------------------------------------------
 * INSTALACIÓN (una sola vez):
 * 1. Abre script.google.com → tu proyecto de Bienestar Social.
 * 2. Crea un archivo nuevo (+ → Secuencia de comandos) llamado
 *    "bs-importar-subsidios" y pega TODO este código.
 * 3. En tu función doPost(e), dentro del switch de acciones, agrega:
 *
 *      case 'bs_importarSubsidios':
 *        result = bs_importarSubsidios(params);
 *        break;
 *
 * 4. Implementar → Administrar implementaciones → ✏️ → Nueva versión →
 *    Implementar. (NUNCA "Nueva implementación": conserva la URL fija.)
 *
 * QUÉ HACE:
 * Recibe { usuario, modo, filas:[{anio, mes, tipo, numero, ...}] } desde el
 * botón "📥 Importar Excel" del módulo Subsidios y hace UPSERT en la hoja
 * BS_Subsidios:
 *  - Si la fila coincide con un registro existente (mismo EXPEDIENTE, o
 *    mismo DNI + año + tipo + periodo) → ACTUALIZA solo los campos que
 *    vienen con valor (no pisa con vacíos).
 *  - Si no existe → AGREGA con id correlativo nuevo.
 *  - Nunca borra registros.
 * Lee los nombres de columna de la fila 1 de la hoja, así que funciona
 * aunque cambies el orden de las columnas.
 * ========================================================================= */

function bs_importarSubsidios(d) {
  try {
    if (!d || !d.filas || !d.filas.length) {
      return { ok: false, message: 'No llegaron filas para importar.' };
    }
    if (d.filas.length > 200) {
      return { ok: false, message: 'Máximo 200 filas por lote (el frontend envía lotes de 100).' };
    }

    var lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      var ss = SpreadsheetApp.getActive();
      var sh = ss.getSheetByName('BS_Subsidios');
      if (!sh) return { ok: false, message: 'No existe la hoja BS_Subsidios.' };

      var lastCol = sh.getLastColumn();
      var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
      var idx = {};
      headers.forEach(function (h, i) { idx[String(h).trim()] = i; });
      if (idx['id'] === undefined) {
        return { ok: false, message: 'La hoja BS_Subsidios no tiene columna "id" en la fila 1.' };
      }

      var lastRow = sh.getLastRow();
      var data = lastRow > 1 ? sh.getRange(2, 1, lastRow - 1, lastCol).getValues() : [];

      // ---- clave de coincidencia (upsert) ----
      function claveDe(get) {
        var exp = String(get('expediente') || '').trim().toUpperCase();
        if (exp) return 'EXP:' + exp;
        return 'K:' + [
          String(get('numero') || '').trim(),
          String(get('anio') || '').trim(),
          String(get('tipo') || '').trim().toUpperCase(),
          String(get('periodo') || '').trim().toUpperCase()
        ].join('|');
      }

      var mapa = {};   // clave → índice de fila en `data`
      var maxId = 0;
      data.forEach(function (r, i) {
        var id = parseInt(r[idx['id']], 10);
        if (!isNaN(id) && id > maxId) maxId = id;
        var g = function (c) { return idx[c] === undefined ? '' : r[idx[c]]; };
        var k = claveDe(g);
        if (k !== 'K:|||' && mapa[k] === undefined) mapa[k] = i;
      });

      var creados = 0, actualizados = 0, errores = [];
      var ahora = new Date();
      var usuario = d.usuario || 'importacion';
      var soloAgregar = (d.modo === 'solo_agregar');

      d.filas.forEach(function (f, n) {
        try {
          var g = function (c) { return f[c] === undefined || f[c] === null ? '' : f[c]; };
          var k = claveDe(g);

          if (!soloAgregar && mapa[k] !== undefined) {
            // ---- ACTUALIZAR (solo campos con valor) ----
            var rowN = mapa[k] + 2; // +2: encabezado + base 1
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
            // ---- CREAR ----
            maxId++;
            var nueva = [];
            for (var i2 = 0; i2 < lastCol; i2++) nueva.push('');
            nueva[idx['id']] = maxId;
            for (var c2 in f) {
              if (c2 === 'id' || idx[c2] === undefined) continue;
              nueva[idx[c2]] = f[c2];
            }
            if (idx['created_by'] !== undefined) nueva[idx['created_by']] = usuario;
            if (idx['created_at'] !== undefined) nueva[idx['created_at']] = ahora;
            if (idx['updated_at'] !== undefined) nueva[idx['updated_at']] = ahora;
            sh.appendRow(nueva);
            // registrar en el mapa para no duplicar dentro del mismo lote
            data.push(nueva);
            if (k !== 'K:|||') mapa[k] = data.length - 1;
            creados++;
          }
        } catch (e) {
          errores.push('Fila ' + (n + 1) + ': ' + e.message);
        }
      });

      return { ok: true, creados: creados, actualizados: actualizados, errores: errores };
    } finally {
      lock.releaseLock();
    }
  } catch (e) {
    return { ok: false, message: 'Error al importar: ' + e.message };
  }
}
