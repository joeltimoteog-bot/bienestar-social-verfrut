/* =========================================================================
 * BS-MANTENIMIENTO · Herramientas de depuración de datos (solo administradores)
 * Bienestar Social · Unifrutti Group
 * -------------------------------------------------------------------------
 * bs_cierreMasivoQuejas { fecha_corte, motivo, simular }
 *   Cierra en bloque los hallazgos (BS_Quejas) con fecha de recepción
 *   ANTERIOR a fecha_corte que sigan abiertos (resultado distinto de
 *   Cerrado/Resuelto). No borra nada: pone resultado = "Cerrado" y anota en
 *   observaciones "Cierre masivo <fecha> por <usuario>: <motivo>".
 *   Con simular:true solo devuelve cuántos se cerrarían (vista previa).
 *   Registra una línea en BS_Auditoria con el total.
 *
 * INSTALACIÓN: case en doPost
 *   case 'bs_cierreMasivoQuejas': result = bs_cierreMasivoQuejas(params); break;
 * ========================================================================= */
function bs_cierreMasivoQuejas(p) {
  try {
    p = p || {};
    var ses = p._sesion || {};
    var rol = String(ses.rol || '').toLowerCase();
    var usuario = ses.usuario || p.usuario || '';
    var ADMINS = ['jtimoteo', 'ovilela'];
    if (rol.indexOf('admin') < 0 && ADMINS.indexOf(String(usuario).toLowerCase()) < 0) {
      return { ok: false, code: 403, message: 'Solo administradores pueden hacer cierres masivos.' };
    }
    var corte = _aFecha(p.fecha_corte);
    if (!corte) return { ok: false, message: 'Indica una fecha de corte válida.' };
    var motivo = String(p.motivo || '').trim();
    if (!p.simular && motivo.length < 5) return { ok: false, message: 'Escribe un motivo (mínimo 5 caracteres); queda en el historial.' };

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(BS_CONFIG.HOJA_QUEJAS);
    if (!sh) return { ok: false, message: 'Hoja BS_Quejas no existe' };
    var data = sh.getDataRange().getValues();
    var H = data[0].map(function (h) { return String(h).trim(); });
    var iFec = H.indexOf('fecha_recepcion'), iRes = H.indexOf('resultado'), iObs = H.indexOf('observaciones'), iUpd = H.indexOf('updated_at'), iAnu = H.indexOf('anulado'), iId = H.indexOf('id'), iEmp = H.indexOf('empresa');
    if (iFec < 0 || iRes < 0) return { ok: false, message: 'Faltan columnas fecha_recepcion / resultado.' };

    var hoy = _ymd(new Date());
    var sello = 'Cierre masivo ' + hoy + ' por ' + usuario + (motivo ? ': ' + motivo : '');
    var afectados = [], porEmp = {};
    for (var r = 1; r < data.length; r++) {
      var row = data[r];
      if (iAnu >= 0 && /^(s|si|sí|true|1)$/i.test(String(row[iAnu] || ''))) continue;
      if (/cerrad|resuelt/i.test(String(row[iRes] || ''))) continue;
      var f = _aFecha(row[iFec]); if (!f || f.getTime() >= corte.getTime()) continue;
      afectados.push(r + 1);
      var e = String(row[iEmp] || '—'); porEmp[e] = (porEmp[e] || 0) + 1;
      if (!p.simular) {
        sh.getRange(r + 1, iRes + 1).setValue('Cerrado');
        if (iObs >= 0) { var o = String(row[iObs] || '').trim(); sh.getRange(r + 1, iObs + 1).setValue(o ? o + ' | ' + sello : sello); }
        if (iUpd >= 0) sh.getRange(r + 1, iUpd + 1).setValue(new Date());
      }
    }
    if (!p.simular && afectados.length) {
      try { bs_registrarAuditoria(usuario, 'ACTUALIZAR', 'quejas', 'masivo', 'Cierre masivo de ' + afectados.length + ' hallazgos anteriores a ' + _ymd(corte) + ' · ' + motivo); } catch (e) {}
      try { CacheService.getScriptCache().removeAll(BS_DASH_CLAVES); } catch (e2) {}
    }
    return { ok: true, simulado: !!p.simular, total: afectados.length, porEmpresa: porEmp, fecha_corte: _ymd(corte),
             message: (p.simular ? 'Se cerrarían ' : 'Se cerraron ') + afectados.length + ' hallazgo(s) anteriores a ' + _ymd(corte) + '.' };
  } catch (e) { return { ok: false, message: 'Error en cierre masivo: ' + e.message }; }
}
