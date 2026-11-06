/* ═══════════════════════════════════════════════════════════════════════════
   bs-azure-sync.js — _BS_AZURE_V1 (01-nov-2026)
   Sube las hojas de Bienestar Social a Azure SQL (tablas BS_* vía mantenimiento/hoja, igual que
   RR.LL. sube Horas/Capacitaciones). Azure queda como base central de lectura (ficha, descansos…)
   y la hoja de Google sigue siendo la copia de respaldo y, por ahora, donde se escribe.

   Propiedades del script (Archivo → Configuración del proyecto → Propiedades):
     AZURE_API_URL   = https://exdjzbfinppzatjyimxn.supabase.co/functions/v1/api   (06-nov: antes Azure)
     AZURE_HOST_KEY  = (misma llave de funciones que usa el Apps Script de RR.LL.)

   Funciones:
     bsAzureSyncTodo(forzar)      sube todas las hojas (solo las que cambiaron, salvo forzar=true)
     bsAzureSyncProgramado()      lo llama el disparador cada 10 min
     bsAzureInstalarTrigger()     crea el disparador (ejecutar una vez)
     bsAzureEstado()              muestra en Log qué hay en Azure
     bsAzureSyncDespuesDe_(action) la llama doPost tras una escritura: sube solo las hojas tocadas
   ═══════════════════════════════════════════════════════════════════════════ */

var BS_AZ_HOJAS = {
  bs_accidentes_casos:    'BS_Accidentes_Casos',
  bs_accidentes_seguim:   'BS_Accidentes_Seguimientos',
  bs_hostigamiento:       'BS_Hostigamiento',
  bs_hostigamiento_olmos: 'BS_Hostigamiento_Olmos',
  bs_subsidios:           'BS_Subsidios',
  bs_documentos:          'BS_Documentos',
  bs_quejas:              'BS_Quejas',
  bs_quejas_seguim:       'BS_Quejas_Seguimientos',
  bs_descansos:           'BS_Descansos'
};
/* qué hojas tocan las acciones de escritura de doPost */
var BS_AZ_POR_ACCION = [
  [/accidente|seguimiento$/i,          ['bs_accidentes_casos', 'bs_accidentes_seguim']],
  [/subsidio/i,                        ['bs_subsidios']],
  [/hostig/i,                          ['bs_hostigamiento', 'bs_hostigamiento_olmos']],
  [/queja/i,                           ['bs_quejas', 'bs_quejas_seguim']],
  [/descanso/i,                        ['bs_descansos']],
  [/documento/i,                       ['bs_documentos']],
  [/anularRegistro|restaurarRegistro/i, null]   /* módulo variable: se resuelve con params.modulo */
];

function _bsAzCfg_() {
  var p = PropertiesService.getScriptProperties();
  var url = (p.getProperty('AZURE_API_URL') || '').replace(/\/+$/, ''), key = p.getProperty('AZURE_HOST_KEY') || p.getProperty('AZURE_API_KEY');
  if (!url || !key) throw new Error('Faltan AZURE_API_URL / AZURE_HOST_KEY en las propiedades del script de Bienestar');
  return { url: url, key: key };
}
function _bsAzPedir_(ruta, cuerpo) {
  var cfg = _bsAzCfg_(), op = { headers: { 'x-functions-key': cfg.key }, muteHttpExceptions: true };
  if (cuerpo) { op.method = 'post'; op.contentType = 'application/json'; op.payload = JSON.stringify(cuerpo); }
  var r = UrlFetchApp.fetch(cfg.url + '/mantenimiento/hoja/' + ruta, op), j = {};
  try { j = JSON.parse(r.getContentText()); } catch (e) { j = { success: false, error: r.getContentText().slice(0, 300) }; }
  j.HTTP = r.getResponseCode();
  if (!j.success) throw new Error(ruta + ' HTTP ' + j.HTTP + ': ' + j.error);
  return j;
}
function _bsAzCelda_(v) {
  if (v instanceof Date) return { $d: isNaN(v.getTime()) ? '' : v.toISOString(), $s: String(v) };
  return v;
}
function _bsAzLeerHoja_(clave) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BS_AZ_HOJAS[clave]);
  var v = sh ? sh.getDataRange().getValues() : [[]];
  return { encabezado: (v[0] || []).map(_bsAzCelda_), filas: v.slice(1).filter(function (r) { return r.some(function (c) { return c !== '' && c !== null; }); }).map(function (r) { return r.map(_bsAzCelda_); }), ancho: (v[0] || []).length };
}
function _bsAzCargar_(clave, forzar) {
  var leidoMs = Date.now(), h = _bsAzLeerHoja_(clave), txt = JSON.stringify(h);
  var hash = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, txt));
  var props = PropertiesService.getScriptProperties();
  if (!forzar && props.getProperty('BSAZ_HASH_' + clave) === hash) return 'sin cambios';
  var lock = LockService.getScriptLock(), mio = false;
  if (!lock.hasLock()) { lock.waitLock(60000); mio = true; }
  try {
    _bsAzPedir_(clave + '/inicio', {});
    var LOTE = 2000, otros = 0;
    for (var i = 0; i < h.filas.length; i += LOTE) otros += _bsAzPedir_(clave + '/lote', { desde: i, filas: h.filas.slice(i, i + LOTE) }).conOtros || 0;
    var f = _bsAzPedir_(clave + '/fin', { encabezado: h.encabezado, ancho: h.ancho, total: h.filas.length, leidoMs: leidoMs });
    props.setProperty('BSAZ_HASH_' + clave, hash);
    return (f.filas != null ? f.filas : h.filas.length) + ' filas' + (otros ? ' (' + otros + ' celdas fuera de tipo, guardadas tal cual)' : '');
  } finally { if (mio) lock.releaseLock(); }
}

/* --- API pública --- */
function bsAzureSyncTodo(forzar) {
  var out = {};
  Object.keys(BS_AZ_HOJAS).forEach(function (k) { try { out[k] = _bsAzCargar_(k, !!forzar); } catch (e) { out[k] = 'ERROR: ' + e.message; } });
  Logger.log(JSON.stringify(out, null, 2));
  return out;
}
function bsAzureSyncProgramado() { return bsAzureSyncTodo(false); }
function bsAzureInstalarTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'bsAzureSyncProgramado') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('bsAzureSyncProgramado').timeBased().everyMinutes(10).create();
  Logger.log('Disparador bsAzureSyncProgramado cada 10 min instalado.');
}
function bsAzureEstado() {
  var cfg = _bsAzCfg_(), out = {};
  Object.keys(BS_AZ_HOJAS).forEach(function (k) {
    try { var r = UrlFetchApp.fetch(cfg.url + '/mantenimiento/hoja/' + k + '/estado', { headers: { 'x-functions-key': cfg.key }, muteHttpExceptions: true }); out[k] = r.getContentText().slice(0, 200); }
    catch (e) { out[k] = 'ERROR ' + e.message; }
  });
  Logger.log(JSON.stringify(out, null, 2));
  return out;
}
/* tras una escritura en doPost: sube solo las hojas del módulo tocado (si falla, no afecta la respuesta al usuario) */
function bsAzureSyncDespuesDe_(action, params) {
  try {
    var claves = null;
    for (var i = 0; i < BS_AZ_POR_ACCION.length && claves === null; i++) {
      if (BS_AZ_POR_ACCION[i][0].test(action)) claves = BS_AZ_POR_ACCION[i][1] || _bsAzClavesModulo_(params && params.modulo);
    }
    if (!claves || !claves.length) return;
    claves.forEach(function (k) { try { _bsAzCargar_(k, false); } catch (e) { Logger.log('bsAzureSync ' + k + ': ' + e.message); } });
  } catch (e) { Logger.log('bsAzureSyncDespuesDe_: ' + e.message); }
}
function _bsAzClavesModulo_(modulo) {
  var m = String(modulo || '').toLowerCase();
  if (/accid/.test(m)) return ['bs_accidentes_casos', 'bs_accidentes_seguim'];
  if (/subsid/.test(m)) return ['bs_subsidios'];
  if (/hostig/.test(m)) return ['bs_hostigamiento', 'bs_hostigamiento_olmos'];
  if (/queja/.test(m)) return ['bs_quejas', 'bs_quejas_seguim'];
  if (/descan/.test(m)) return ['bs_descansos'];
  return Object.keys(BS_AZ_HOJAS);
}

/* _BS_SUPABASE_API_V1 (06-nov): subir TODAS las hojas a Supabase (sin argumentos, para el menu Ejecutar) */
function bsSupabaseSubirTodo() { return bsAzureSyncTodo(true); }
