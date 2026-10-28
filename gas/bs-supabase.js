/*************************************************************************
 * _BS_SUPABASE_V1 (28-oct-2026) — COPIA RÁPIDA DE LECTURA EN SUPABASE
 *
 * Google Sheets sigue siendo la BASE OFICIAL: todo se guarda ahí primero.
 * Supabase solo guarda una copia para que las listas abran rápido.
 *   - Al guardar/editar/eliminar en un módulo copiado, se actualiza la copia.
 *   - Cada noche (bs_sbResyncTodo) se compara todo y se corrige.
 *   - Si Supabase falla o no está configurado, el navegador lee de Sheets.
 *   - HOSTIGAMIENTO NUNCA se copia (datos muy sensibles).
 *
 * CONFIGURACIÓN — Propiedades del script (nunca en el código ni en GitHub):
 *   SB_URL       https://xxxx.supabase.co
 *   SB_SECRET    llave secreta (sb_secret_...)     -> solo el servidor, para escribir
 *   SB_PUBLICA   llave publicable (sb_publishable_...) -> la usa el navegador
 *   SB_JWT_PRIV  llave privada RSA (PEM, BEGIN PRIVATE KEY) importada en Supabase
 *   SB_JWT_KID   identificador (kid) de esa llave
 * Si falta cualquiera, todo queda APAGADO y el sistema funciona como antes.
 *
 * PASOS UNA SOLA VEZ (editor de Apps Script):
 *   1) Run -> bs_sbResyncTodo      (llena la copia por primera vez)
 *   2) Run -> bs_sbInstalarNoche   (programa la revisión de cada noche, 2 a. m.)
 *************************************************************************/

/* Por modulo: como listar, que acciones tocan UN registro (y de donde sale su id),
   cuales lo borran y cuales tocan MUCHOS (copia completa del modulo). */
var BS_SB_MODULOS = {
  rendiciones: {
    listar: function () { return bs_listarRendiciones({}); },
    uno: { bs_crearRendicion: 'r.id', bs_actualizarRendicion: 'p.id' },
    borra: { bs_eliminarRendicion: 'p.id' },
    todos: []
  },
  quejas: {      /* _BS_SUPABASE_3MOD_V1 */
    listar: function () { return bs_listarQuejas({}); },
    uno: { bs_crearQueja: 'r.id', bs_actualizarQueja: 'p.id', bs_crearSeguimientoQueja: 'p.id_queja' },
    borra: {},
    todos: ['bs_cierreMasivoQuejas']
  },
  accidentes: {
    listar: function () { return bs_listarAccidentes({}); },
    uno: { bs_crearAccidente: 'r.id', bs_actualizarAccidente: 'p.id', bs_crearSeguimiento: 'p.id_caso' },
    borra: {},
    todos: ['bs_importarAccidentes']
  },
  subsidios: {
    listar: function () { return bs_listarSubsidios({}); },
    uno: { bs_crearSubsidio: 'r.id', bs_actualizarSubsidio: 'p.id', bs_generarSubsidioDesdeDM: 'r.id_subsidio' },
    borra: {},
    todos: ['bs_importarSubsidios']
  }
};
var BS_SB_PROHIBIDOS = ['hostigamiento'];

function _bsSbCfg_() {
  try {
    var p = PropertiesService.getScriptProperties().getProperties();
    if (!p.SB_URL || !p.SB_SECRET) return null;
    p.SB_URL = String(p.SB_URL).replace(/\/+$/, '');
    return p;
  } catch (e) { return null; }
}

function _bsSbPedir_(cfg, metodo, ruta, cuerpo, prefer) {
  var op = { method: metodo, muteHttpExceptions: true, headers: { apikey: cfg.SB_SECRET } };
  if (prefer) op.headers.Prefer = prefer;
  if (cuerpo !== undefined) { op.contentType = 'application/json'; op.payload = JSON.stringify(cuerpo); }
  var r = UrlFetchApp.fetch(cfg.SB_URL + '/rest/v1/' + ruta, op);
  var c = r.getResponseCode();
  if (c >= 300) throw new Error('Supabase ' + c + ': ' + String(r.getContentText()).slice(0, 300));
  var t = r.getContentText();
  return t ? JSON.parse(t) : null;
}

function _bsSbUpsert_(cfg, modulo, items) {
  var ahora = new Date().toISOString();
  for (var i = 0; i < items.length; i += 500) {
    var lote = items.slice(i, i + 500).map(function (it) {
      return { modulo: modulo, id: String(it.id), datos: it, actualizado: ahora };
    });
    _bsSbPedir_(cfg, 'post', 'bs_registros?on_conflict=modulo,id', lote, 'resolution=merge-duplicates,return=minimal');
  }
}

function _bsSbBorrar_(cfg, modulo, ids) {
  for (var i = 0; i < ids.length; i += 200) {
    var lista = ids.slice(i, i + 200).map(function (x) { return '"' + String(x).replace(/"/g, '') + '"'; }).join(',');
    _bsSbPedir_(cfg, 'delete', 'bs_registros?modulo=eq.' + modulo + '&id=in.(' + encodeURIComponent(lista) + ')', undefined, 'return=minimal');
  }
}

/* Copia completa de un módulo: sube todo y borra lo que ya no está en la hoja. */
function _bsSbResyncModulo_(cfg, modulo) {
  if (BS_SB_PROHIBIDOS.indexOf(modulo) >= 0 || !BS_SB_MODULOS[modulo]) throw new Error('Módulo no permitido: ' + modulo);
  var res = BS_SB_MODULOS[modulo].listar();
  if (!res || !res.ok) throw new Error('No se pudo leer la hoja de ' + modulo + ': ' + (res && res.message));
  var items = res.items || [];
  _bsSbUpsert_(cfg, modulo, items);
  var enHoja = {}; items.forEach(function (it) { enHoja[String(it.id)] = 1; });
  var enSb = [], desde = 0, pag;
  do {
    pag = _bsSbPedir_(cfg, 'get', 'bs_registros?select=id&modulo=eq.' + modulo + '&order=id&offset=' + desde + '&limit=1000') || [];
    pag.forEach(function (f) { enSb.push(f.id); }); desde += 1000;
  } while (pag.length === 1000);
  var sobran = enSb.filter(function (id) { return !enHoja[id]; });
  if (sobran.length) _bsSbBorrar_(cfg, modulo, sobran);
  PropertiesService.getScriptProperties().setProperty('SB_LISTO_' + modulo, JSON.stringify({ n: items.length, t: Date.now() }));
  return modulo + ': ' + items.length + ' copiados, ' + sobran.length + ' borrados';
}

/* Run manual (primera vez) y cada noche por el activador. */
function bs_sbResyncTodo() {
  var cfg = _bsSbCfg_();
  if (!cfg) { Logger.log('Supabase no configurado: faltan SB_URL / SB_SECRET.'); return 'no configurado'; }
  var out = [];
  Object.keys(BS_SB_MODULOS).forEach(function (m) {
    try { out.push(_bsSbResyncModulo_(cfg, m)); } catch (e) { out.push(m + ': ERROR ' + e.message); }
  });
  Logger.log(out.join(' | '));
  return out.join(' | ');
}

function bs_sbInstalarNoche() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'bs_sbResyncTodo') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('bs_sbResyncTodo').timeBased().everyDays(1).atHour(2).create();
  Logger.log('Revisión nocturna programada (2 a. m.).');
  return 'ok';
}

/* Llamado desde doPost después de cada acción: actualiza la copia de lo que se tocó. */
function bs_sbTrasEscritura_(action, params, result) {
  if (!result || !result.ok || result.simulado) return;
  var cfg = _bsSbCfg_(); if (!cfg) return;
  action = String(action); params = params || {};
  var dato = function (ruta) { var o = ruta.charAt(0) === 'r' ? result : params; return o[ruta.slice(2)]; };
  Object.keys(BS_SB_MODULOS).forEach(function (m) {
    var M = BS_SB_MODULOS[m], id = null, borrar = false, todo = false;
    if (M.uno[action]) id = dato(M.uno[action]);
    else if (M.borra[action]) { id = dato(M.borra[action]); borrar = true; }
    else if (M.todos.indexOf(action) >= 0) todo = true;
    else if ((action === 'bs_anularRegistro' || action === 'bs_restaurarRegistro') && String(params.modulo || '').toLowerCase() === m) id = params.id;
    else return;
    try {
      if (todo) { _bsSbResyncModulo_(cfg, m); return; }
      if (id === null || id === undefined || id === '') return;
      if (borrar) { _bsSbBorrar_(cfg, m, [id]); return; }
      var res = M.listar();
      var it = (res && res.items || []).filter(function (x) { return String(x.id) === String(id); })[0];
      if (it) _bsSbUpsert_(cfg, m, [it]);
    } catch (e) {
      /* Si falla, el modulo queda como no listo: el navegador lee de Sheets hasta la proxima copia completa. */
      try { PropertiesService.getScriptProperties().deleteProperty('SB_LISTO_' + m); } catch (e2) {}
      console.warn('[_BS_SUPABASE_V1] ' + m + ': ' + e.message);
    }
  });
}

/* Pase de lectura para el navegador (válido 1 hora, solo para los módulos que el usuario puede ver). */
function bs_sbToken_(params) {
  var cfg = _bsSbCfg_();
  if (!cfg || !cfg.SB_PUBLICA || !cfg.SB_JWT_PRIV || !cfg.SB_JWT_KID) return { ok: false, apagado: true };
  var s = params._sesion || {};
  var rol = String(s.rol || '').toLowerCase();
  var props = PropertiesService.getScriptProperties();
  var mods = Object.keys(BS_SB_MODULOS).filter(function (m) {
    if (BS_SB_PROHIBIDOS.indexOf(m) >= 0) return false;
    if (!props.getProperty('SB_LISTO_' + m)) return false;
    if (rol.indexOf('admin') >= 0) return true;
    var conPermiso = BS_SEG && BS_SEG.PERMISOS && BS_SEG.PERMISOS[m];
    return !conPermiso || !!(s.permisos && s.permisos[m]);
  });
  var ahora = Math.floor(Date.now() / 1000), exp = ahora + 3600;
  var b64 = function (o) { return Utilities.base64EncodeWebSafe(typeof o === 'string' ? o : JSON.stringify(o)).replace(/=+$/, ''); };
  var cab = b64({ alg: 'RS256', typ: 'JWT', kid: cfg.SB_JWT_KID });
  var cuerpo = b64({ role: 'authenticated', aud: 'authenticated', sub: String(s.usuario || 'bs'), iat: ahora, exp: exp, bs_mods: mods });
  var pem = String(cfg.SB_JWT_PRIV).replace(/\\n/g, '\n');
  var firma = Utilities.base64EncodeWebSafe(Utilities.computeRsaSha256Signature(cab + '.' + cuerpo, pem)).replace(/=+$/, '');
  return { ok: true, url: cfg.SB_URL, publica: cfg.SB_PUBLICA, token: cab + '.' + cuerpo + '.' + firma, exp: exp, mods: mods };
}
