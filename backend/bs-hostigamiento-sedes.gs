/*************************************************************************
 * BS-HOSTIGAMIENTO-SEDES · Piura y Olmos en hojas separadas
 * Bienestar Social · Unifrutti Group
 * ----------------------------------------------------------------------
 * QUÉ HACE
 *   - Cada sede vive en su propia hoja:
 *       PIURA -> BS_Hostigamiento          (la que ya tienes)
 *       OLMOS -> BS_Hostigamiento_Olmos    (se crea sola)
 *   - Cada sede lleva su propio correlativo: PIU-001, PIU-002 / OLM-001...
 *   - bs_listarHostigamiento devuelve las DOS hojas unidas, cada registro
 *     con su campo `sede` y su `codigo`, para poder comparar Piura vs Olmos.
 *
 * PASOS (en este orden)
 *   1) BORRA las funciones duplicadas: en tu proyecto hay DOS copias de
 *      bs_crearHostigamiento, bs_listarHostigamiento y bs_actualizarHostigamiento.
 *      Elimina AMBAS copias de las tres — este bloque las reemplaza.
 *   2) Pega este bloque al final del código.
 *   3) Aplica el parche de 2 líneas en bs_anularRegistro y bs_restaurarRegistro
 *      (ver el comentario PARCHE al final de este archivo).
 *   4) Run -> bs_setupHostigamientoSedes   (una sola vez; mira el Log)
 *   5) Implementar -> ✏️ -> Nueva versión.
 *************************************************************************/

var BS_HOSTIG_HOJAS   = { PIURA: 'BS_Hostigamiento', OLMOS: 'BS_Hostigamiento_Olmos' };
var BS_HOSTIG_PREFIJO = { PIURA: 'PIU', OLMOS: 'OLM' };
var BS_HOSTIG_HEADERS = ['id','fecha_denuncia','denunciante_dni','denunciante_nombre','denunciante_puesto',
                         'medida_proteccion','denunciado_dni','denunciado_nombre','denunciado_puesto',
                         'sede','fundo','decision','status','observaciones','empresa',
                         'created_by','created_at','updated_at'];

/* ---------- helpers ---------- */
function bs_hostigSede_(v) {
  return String(v || '').trim().toUpperCase().indexOf('OLM') >= 0 ? 'OLMOS' : 'PIURA';
}
function bs_hostigCodigo_(sede, id) {
  return BS_HOSTIG_PREFIJO[bs_hostigSede_(sede)] + '-' + ('000' + (parseInt(id, 10) || 0)).slice(-3);
}
function bs_hostigHoja_(sede) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var nombre = BS_HOSTIG_HOJAS[bs_hostigSede_(sede)];
  var sh = ss.getSheetByName(nombre);
  if (!sh) {
    sh = ss.insertSheet(nombre);
    sh.appendRow(BS_HOSTIG_HEADERS);
    sh.getRange(1, 1, 1, BS_HOSTIG_HEADERS.length)
      .setFontWeight('bold').setBackground('#0a2540').setFontColor('#ffffff').setHorizontalAlignment('center');
    sh.setFrozenRows(1);
  }
  return sh;
}
function bs_hostigHeaders_(sh) {
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
}
/* Asegura que la hoja tenga una columna; la crea al final si falta */
function bs_hostigAsegurarCol_(sh, nombre) {
  var headers = bs_hostigHeaders_(sh);
  if (headers.indexOf(nombre) >= 0) return headers;
  var c = sh.getLastColumn() + 1;
  sh.getRange(1, c).setValue(nombre)
    .setFontWeight('bold').setBackground('#0a2540').setFontColor('#ffffff').setHorizontalAlignment('center');
  return bs_hostigHeaders_(sh);
}

/* ---------- MIGRACIÓN (ejecutar una sola vez) ---------- */
function bs_setupHostigamientoSedes() {
  var shP = bs_hostigHoja_('PIURA');
  var shO = bs_hostigHoja_('OLMOS');   // la crea si no existe

  // 1) columna sede en Piura + backfill de los registros históricos
  var headers = bs_hostigAsegurarCol_(shP, 'sede');
  bs_hostigAsegurarCol_(shP, 'observaciones');
  headers = bs_hostigHeaders_(shP);
  var iSede = headers.indexOf('sede');
  var lastRow = shP.getLastRow(), backfill = 0;
  if (lastRow > 1) {
    var rango = shP.getRange(2, iSede + 1, lastRow - 1, 1);
    var vals = rango.getValues();
    for (var i = 0; i < vals.length; i++) {
      if (!String(vals[i][0] || '').trim()) { vals[i][0] = 'PIURA'; backfill++; }
    }
    rango.setValues(vals);
  }

  // 2) la hoja de Olmos con las mismas columnas que Piura
  var hP = bs_hostigHeaders_(shP);
  var hO = bs_hostigHeaders_(shO);
  hP.forEach(function (h) { if (h && hO.indexOf(h) < 0) bs_hostigAsegurarCol_(shO, h); });

  var msg = 'Hoja Olmos lista (' + BS_HOSTIG_HOJAS.OLMOS + ') · ' +
            backfill + ' registro(s) de Piura etiquetados con sede=PIURA';
  Logger.log(msg);
  return msg;
}

/* ---------- CREAR ---------- */
function bs_crearHostigamiento(usuario, datos) {
  try {
    datos = datos || {};
    var sede = bs_hostigSede_(datos.sede);
    var sh = bs_hostigHoja_(sede);
    bs_hostigAsegurarCol_(sh, 'sede');
    var headers = bs_hostigHeaders_(sh);

    // correlativo INDEPENDIENTE por hoja
    var id = 1, lastRow = sh.getLastRow(), iId = headers.indexOf('id');
    if (lastRow > 1 && iId >= 0) {
      var ids = sh.getRange(2, iId + 1, lastRow - 1, 1).getValues();
      for (var i = 0; i < ids.length; i++) {
        var n = parseInt(ids[i][0], 10);
        if (n && n >= id) id = n + 1;
      }
    }

    var now = new Date();
    var v = {
      id: id,
      fecha_denuncia: datos.fecha_denuncia ? new Date(datos.fecha_denuncia) : now,
      denunciante_dni: datos.denunciante_dni || '',
      denunciante_nombre: datos.denunciante_nombre || '',
      denunciante_puesto: datos.denunciante_puesto || '',
      medida_proteccion: datos.medida_proteccion || '',
      denunciado_dni: datos.denunciado_dni || '',
      denunciado_nombre: datos.denunciado_nombre || '',
      denunciado_puesto: datos.denunciado_puesto || '',
      sede: sede,
      fundo: datos.fundo || '',
      decision: datos.decision || '',
      status: datos.status || 'En investigación',
      observaciones: datos.observaciones || '',
      empresa: datos.empresa || '',
      created_by: usuario, created_at: now, updated_at: now
    };
    sh.appendRow(headers.map(function (h) { return v[h] !== undefined ? v[h] : ''; }));

    return { ok: true, id: id, sede: sede, codigo: bs_hostigCodigo_(sede, id),
             message: 'Denuncia ' + bs_hostigCodigo_(sede, id) + ' registrada en ' + sede };
  } catch (err) { return { ok: false, message: err.message }; }
}

/* ---------- LISTAR (une las dos sedes) ---------- */
function bs_listarHostigamiento(filtros) {
  try {
    var items = [];
    ['PIURA', 'OLMOS'].forEach(function (sede) {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sh = ss.getSheetByName(BS_HOSTIG_HOJAS[sede]);
      if (!sh) return;
      var lastRow = sh.getLastRow();
      if (lastRow <= 1) return;
      var data = sh.getRange(1, 1, lastRow, sh.getLastColumn()).getValues();
      var headers = data[0].map(function (h) { return String(h).trim(); });
      for (var r = 1; r < data.length; r++) {
        var obj = {};
        for (var c = 0; c < headers.length; c++) {
          if (!headers[c]) continue;
          var val = data[r][c];
          if (val instanceof Date) val = val.toISOString();
          obj[headers[c]] = val;
        }
        if (!obj.id && obj.id !== 0) continue;
        obj.sede = bs_hostigSede_(obj.sede || sede);
        obj.codigo = bs_hostigCodigo_(obj.sede, obj.id);
        obj.uid = obj.sede + '-' + obj.id;          // clave única entre hojas
        items.push(obj);
      }
    });

    if (filtros) {
      if (filtros.sede)    items = items.filter(function (i) { return i.sede === bs_hostigSede_(filtros.sede); });
      if (filtros.empresa) items = items.filter(function (i) { return i.empresa === filtros.empresa; });
      if (filtros.status)  items = items.filter(function (i) { return i.status === filtros.status; });
      if (filtros.fundo)   items = items.filter(function (i) {
        return String(i.fundo || '').toLowerCase().indexOf(String(filtros.fundo).toLowerCase()) >= 0;
      });
    }

    items.sort(function (a, b) {
      var fa = String(a.fecha_denuncia || ''), fb = String(b.fecha_denuncia || '');
      if (fa !== fb) return fa < fb ? 1 : -1;
      return (b.id || 0) - (a.id || 0);
    });
    return { ok: true, items: items, total: items.length };
  } catch (err) { return { ok: false, message: err.message }; }
}

/* ---------- ACTUALIZAR (la sede NO se puede cambiar) ---------- */
function bs_actualizarHostigamiento(usuario, id, datos) {
  try {
    datos = datos || {};
    var sede = bs_hostigSede_(datos.sede);
    var sh = bs_hostigHoja_(sede);
    var lastRow = sh.getLastRow();
    if (lastRow < 2) return { ok: false, message: 'La hoja de ' + sede + ' no tiene registros.' };

    var headers = bs_hostigHeaders_(sh);
    var iId = headers.indexOf('id');
    if (iId < 0) return { ok: false, message: 'La hoja no tiene columna "id".' };

    var ids = sh.getRange(2, iId + 1, lastRow - 1, 1).getValues();
    var fila = -1;
    for (var i = 0; i < ids.length; i++) {
      if (parseInt(ids[i][0], 10) === parseInt(id, 10)) { fila = i + 2; break; }
    }
    if (fila < 0) return { ok: false, message: 'Denuncia #' + id + ' no encontrada en ' + sede + '.' };

    var updatables = ['fecha_denuncia','denunciante_dni','denunciante_nombre','denunciante_puesto',
                      'medida_proteccion','denunciado_dni','denunciado_nombre','denunciado_puesto',
                      'fundo','decision','status','observaciones','empresa'];
    updatables.forEach(function (f) {
      if (datos[f] === undefined) return;
      var c = headers.indexOf(f);
      if (c < 0) return;
      var val = datos[f];
      if (f === 'fecha_denuncia' && val) val = new Date(val);
      sh.getRange(fila, c + 1).setValue(val);
    });
    var cUpd = headers.indexOf('updated_at');
    if (cUpd >= 0) sh.getRange(fila, cUpd + 1).setValue(new Date());

    return { ok: true, message: 'Denuncia ' + bs_hostigCodigo_(sede, id) + ' actualizada' };
  } catch (err) { return { ok: false, message: err.message }; }
}

/*************************************************************************
 * PARCHE en bs_anularRegistro y bs_restaurarRegistro
 * ----------------------------------------------------------------------
 * En AMBAS funciones, justo DESPUÉS de esta línea:
 *
 *     var nombreHoja = BS_AUD_HOJAS[String(d.modulo).toLowerCase()];
 *
 * agrega esta línea:
 *
 *     if (String(d.modulo).toLowerCase() === 'hostigamiento' && bs_hostigSede_(d.sede) === 'OLMOS') nombreHoja = BS_HOSTIG_HOJAS.OLMOS;
 *
 * Así anular/restaurar de Olmos apunta a su hoja, y el control de permisos
 * del módulo "hostigamiento" se sigue aplicando igual.
 *************************************************************************/
