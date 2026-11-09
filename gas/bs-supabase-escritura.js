/* ═══════════════════════════════════════════════════════════════════════════
   _BS_GUARDA_SUPABASE_V1 (08-nov-2026) — Bienestar Social · puente del Apps Script con las
   escrituras directas en Supabase (paso 0 del plan "Bienestar guarda directo en Supabase").
   ---------------------------------------------------------------------------
   · Auditoría: cada evento que registra el Apps Script (bs_registrarAuditoria) también va a
     Supabase (Edge bs/auditar, clave interna). Si Supabase no responde, el evento queda en cola
     (propiedad BS_AUD_PEND) y se reenvía en el siguiente envío o con bsAuditoriaReintentar().
   · bsAuditoriaPasarASupabase(): UNA VEZ. Sube la hoja BS_Auditoria completa por última vez y
     declara a Supabase como fuente de la auditoría: desde ahí la hoja ya no la reemplaza y las
     filas de auditoría quedan inmutables (nadie puede modificarlas ni borrarlas).
   · Respaldo diario: bsRespaldoDiario() pide a la Edge (bs/respaldo) la copia de TODAS las
     tablas bs_* al bucket privado 'respaldos' (90 días). bsRespaldoInstalarTrigger() lo deja
     programado a la 01:00 (hora de Lima).
   · bsFuenteVer() / bsFuentePoner(clave, fuente): quién manda por tabla ('hoja' o 'supabase').
   Usa las mismas propiedades que bs-azure-sync.js: AZURE_API_URL (…/functions/v1/api) y
   AZURE_HOST_KEY / AZURE_API_KEY. No hay claves en este archivo.
   ═══════════════════════════════════════════════════════════════════════════ */

function _bsApiPedir_(ruta, cuerpo, metodo) {
  var cfg = _bsAzCfg_();
  var op = { method: metodo || (cuerpo ? 'post' : 'get'), headers: { 'x-functions-key': cfg.key }, muteHttpExceptions: true };
  if (cuerpo) { op.contentType = 'application/json'; op.payload = JSON.stringify(cuerpo); }
  var r = UrlFetchApp.fetch(cfg.url + '/bs/' + ruta, op), j = {};
  try { j = JSON.parse(r.getContentText()); } catch (e) { j = { ok: false, success: false, message: r.getContentText().slice(0, 300) }; }
  j.HTTP = r.getResponseCode();
  if (!(j.ok || j.success)) throw new Error('bs/' + ruta + ' HTTP ' + j.HTTP + ': ' + (j.message || j.error || ''));
  return j;
}

/* ---- auditoría → Supabase (con cola de reintento) ---- */
var BS_AUD_PEND_MAX_ = 200;
function bsAuditoriaEnviar_(usuario, accion, modulo, registroId, detalle) {
  var ev = { usuario: String(usuario || ''), accion: String(accion || ''), modulo: String(modulo || ''),
    registro_id: registroId === undefined || registroId === null ? '' : registroId, detalle: String(detalle || '').slice(0, 500), t: Date.now() };
  try {
    bsAuditoriaReintentar_(true);
    _bsApiPedir_('auditar', ev);
  } catch (e) {
    try {
      var p = PropertiesService.getScriptProperties(), cola = JSON.parse(p.getProperty('BS_AUD_PEND') || '[]');
      cola.push(ev); if (cola.length > BS_AUD_PEND_MAX_) cola = cola.slice(cola.length - BS_AUD_PEND_MAX_);
      p.setProperty('BS_AUD_PEND', JSON.stringify(cola));
    } catch (e2) {}
  }
}
function bsAuditoriaReintentar_(soloSiHay) {
  var p = PropertiesService.getScriptProperties(), cola;
  try { cola = JSON.parse(p.getProperty('BS_AUD_PEND') || '[]'); } catch (e) { cola = []; }
  if (!cola.length) return 0;
  var enviados = 0;
  while (cola.length) {
    try { _bsApiPedir_('auditar', cola[0]); cola.shift(); enviados++; }
    catch (e) { break; }
  }
  p.setProperty('BS_AUD_PEND', JSON.stringify(cola));
  return enviados;
}
function bsAuditoriaReintentar() { var n = bsAuditoriaReintentar_(false); Logger.log('Eventos de auditoría reenviados: ' + n); return n; }
function bsAuditoriaPendientes() { try { var c = JSON.parse(PropertiesService.getScriptProperties().getProperty('BS_AUD_PEND') || '[]'); Logger.log(c.length + ' pendientes'); return c.length; } catch (e) { return 0; } }

/* ---- UNA VEZ: la auditoría pasa a vivir en Supabase ---- */
function bsAuditoriaPasarASupabase() {
  var antes = bsFuenteVer_()['bs_auditoria'];
  if (antes === 'supabase') return 'bs_auditoria ya se guarda en Supabase.';
  var sub = _bsAzCargar_('bs_auditoria', true);                       /* última subida completa de la hoja */
  var r = _bsApiPedir_('fuente', { clave: 'bs_auditoria', fuente: 'supabase' });
  var n = bsAuditoriaReintentar_(false);
  var msg = 'BS_Auditoria: ' + sub + ' · fuente ahora: ' + r.fuente + (n ? ' · reenviados ' + n + ' pendientes' : '');
  Logger.log(msg); return msg;
}

/* ---- UNA VEZ por módulo: la(s) tabla(s) pasan a guardarse en Supabase ----
   1) última subida completa de cada hoja  2) fuente = supabase (desde ahí la hoja ya no la reemplaza).
   El navegador (bs-guardar-supabase.js) empieza a guardar en Supabase en cuanto la fuente cambia. */
function bsModuloPasarASupabase_(claves) {
  var out = [];
  claves.forEach(function (k) {
    var ya = bsFuenteVer_()[k] === 'supabase', sub;
    if (ya) sub = 'ya estaba en Supabase';
    else { try { sub = _bsAzCargar_(k, true); } catch (e) { if (/hoja/i.test(e.message)) sub = 'la hoja no existe todavía (tabla vacía): ' + e.message; else throw e; } }
    var r = ya ? { fuente: 'supabase' } : _bsApiPedir_('fuente', { clave: k, fuente: 'supabase' });
    out.push(k + ': ' + sub + ' → fuente ' + r.fuente);
  });
  var msg = out.join('\n'); Logger.log(msg); return msg;
}
/* Módulo 4 · Hostigamiento (PIURA + OLMOS) */
function bsHostigamientoPasarASupabase() { return bsModuloPasarASupabase_(['bs_hostigamiento', 'bs_hostigamiento_olmos']); }
function bsHostigamientoVolverAHoja() { ['bs_hostigamiento', 'bs_hostigamiento_olmos'].forEach(function (k) { bsFuentePoner(k, 'hoja'); }); return 'ok'; }
/* Módulo 3 · Subsidios */
function bsSubsidiosPasarASupabase() { return bsModuloPasarASupabase_(['bs_subsidios']); }
function bsSubsidiosVolverAHoja() { bsFuentePoner('bs_subsidios', 'hoja'); return 'ok'; }
/* bs_generarSubsidioDesdeDM (descansos) crea el subsidio donde mande la fuente: Supabase (clave interna, autor = usuario) o la hoja */
function bs_crearSubsidioDonde_(usuario, datos) {
  var enSupabase = false;
  try { enSupabase = bsFuenteVer_()['bs_subsidios'] === 'supabase'; } catch (e) { enSupabase = false; }
  if (!enSupabase) return bs_crearSubsidio(usuario, datos);
  try { var r = _bsApiPedir_('guardar', { clave: 'bs_subsidios', op: 'crear', usuario: usuario, datos: datos }); return { ok: true, id: r.id, message: 'Subsidio registrado' }; }
  catch (e) { return { ok: false, message: e.message }; }
}
/* Módulo 2 · Accidentes: casos + seguimientos. El correo "Nuevo accidente registrado" lo sigue mandando Google:
   el navegador llama a bs_notificarCasoNuevo justo después de guardar el caso en Supabase. */
function bsAccidentesPasarASupabase() { return bsModuloPasarASupabase_(['bs_accidentes_casos', 'bs_accidentes_seguim']); }
function bsAccidentesVolverAHoja() { ['bs_accidentes_casos', 'bs_accidentes_seguim'].forEach(function (k) { bsFuentePoner(k, 'hoja'); }); return 'ok'; }
function bs_notificarCasoNuevo(p) {
  try { if (p && p.datos && typeof _avisarAccidenteRegistrado === 'function') _avisarAccidenteRegistrado(p.datos); } catch (e) {}
  return { ok: true };
}
/* Módulo 1 · Hallazgos: quejas + seguimientos + buzones */
function bsHallazgosPasarASupabase() { return bsModuloPasarASupabase_(['bs_quejas', 'bs_quejas_seguim', 'bs_buzones']); }
/* marcha atrás de emergencia (la hoja vuelve a mandar; lo guardado en Supabase mientras tanto NO está en la hoja) */
function bsHallazgosVolverAHoja() { ['bs_quejas', 'bs_quejas_seguim', 'bs_buzones'].forEach(function (k) { bsFuentePoner(k, 'hoja'); }); return 'ok'; }

/* ---- fuente por tabla ---- */
function bsFuenteVer_() { var r = _bsApiPedir_('fuente'), m = {}; (r.tablas || []).forEach(function (t) { m[t.clave] = t.fuente; }); return m; }
function bsFuenteVer() { var m = bsFuenteVer_(); Logger.log(JSON.stringify(m, null, 1)); return m; }
function bsFuentePoner(clave, fuente) {
  if (!clave || !fuente) throw new Error('Uso: bsFuentePoner("bs_quejas", "supabase" | "hoja")');
  var r = _bsApiPedir_('fuente', { clave: clave, fuente: fuente });
  Logger.log(clave + ' → ' + r.fuente); return r.fuente;
}

/* ---- respaldo diario a Storage ---- */
function bsRespaldoDiario() {
  var r = _bsApiPedir_('respaldo', { dias: 90 });
  var res = 'Respaldo ' + r.dia + ' en ' + r.bucket + ': ' + Object.keys(r.tablas || {}).map(function (k) { return k + ' = ' + r.tablas[k]; }).join(' · ') + (r.borrados ? ' · podados ' + r.borrados + ' archivos antiguos' : '');
  try { bsAuditoriaReintentar_(true); } catch (e) {}
  Logger.log(res); return res;
}
function bsRespaldoInstalarTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'bsRespaldoDiario') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('bsRespaldoDiario').timeBased().atHour(1).everyDays(1).inTimezone('America/Lima').create();
  Logger.log('Respaldo diario programado: 01:00 America/Lima'); return 'ok';
}
