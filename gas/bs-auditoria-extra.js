/* ═══════════════════════════════════════════════════════════════════════════
   bs-auditoria-extra.js — _BS_AUDITORIA_EXTRA_V1 (07-nov-2026) · Bienestar Social
   Completa el registro de auditoría (hoja BS_Auditoria) con eventos que hoy no se guardan:
     · INICIAR SESIÓN (cada login correcto)
     · ACCESO / EXPORTAR / VER que reporta el frontend (p. ej. entrar a Hostigamiento, exportar Excel/PDF)
   INSTALACIÓN (3 toques en el editor de Apps Script):
     1) Archivo nuevo "bs-auditoria-extra" con este contenido.
     2) En doPost, dentro del switch de acciones, agrega:
          case 'bs_registrarEvento': result = bs_registrarEvento(params); break;
     3) En doPost, justo después de emitir el token del login (bloque "emitir token al iniciar sesión"):
          try { if (action === 'bs_login' && result && result.ok && result.user) bs_auditarLogin_(result.user, params); } catch (eL) {}
   Nada de esto cambia datos de los módulos: solo agrega filas a BS_Auditoria (usa bs_registrarAuditoria, ya existente).
   ═══════════════════════════════════════════════════════════════════════════ */
var BS_AUD_EVENTOS_PERMITIDOS = ['ACCESO', 'EXPORTAR', 'VER', 'IMPRIMIR', 'DESCARGAR'];

/* El frontend informa un evento (no crea ni modifica datos). Requiere sesión válida. */
function bs_registrarEvento(d) {
  try {
    var ses = (d && d._sesion) || {};
    var usuario = String(ses.usuario || (d && d.usuario) || '').trim();
    if (!usuario) return { ok: false, code: 401, message: 'Sesión requerida.' };
    var accion = String((d && d.accion) || '').trim().toUpperCase();
    if (BS_AUD_EVENTOS_PERMITIDOS.indexOf(accion) < 0) return { ok: false, message: 'Evento no permitido: ' + accion };
    var modulo = String((d && d.modulo) || 'Sistema').slice(0, 60);
    var detalle = String((d && d.detalle) || '').slice(0, 500);
    bs_registrarAuditoria(usuario, accion, modulo, (d && d.registro_id) || '', detalle);
    return { ok: true };
  } catch (e) { return { ok: false, message: 'bs_registrarEvento: ' + e.message }; }
}

/* Login correcto -> fila INICIAR SESIÓN */
function bs_auditarLogin_(user, params) {
  try { bs_registrarAuditoria(String((user && user.usuario) || ''), 'INICIAR SESIÓN', 'Sistema', '', 'acceso correcto · rol ' + String((user && user.rol) || '')); } catch (e) {}
}
