/* Bienestar Social · modulos/expediente.html · _BS_GESTION_SOCIAL_V6 (15-nov-2026)
   Expediente de auditoría: arma en un clic el paquete de evidencia por periodo y empresa con TODO lo que ya está en Supabase
   (módulos clásicos + Gestión Social + cumplimiento legal). Salida: resumen en pantalla, Excel (una hoja por módulo) e impresión.
   No tiene tabla propia: solo lee. Permiso: estadisticas (gerencia / administración). */
(function () {
  'use strict';
  var session = localStorage.getItem('bienestarSocialAuth'); if (!session) { location.href = '../index.html'; return; }
  var user; try { user = JSON.parse(session); } catch (e) { location.href = '../index.html'; return; }
  var esAdmin = /admin|geren/i.test(user.rol || '') || user.esAdminRL === true || ['jtimoteo'].indexOf((user.usuario || '').toLowerCase()) >= 0;
  var $ = function (id) { return document.getElementById(id); };
  $('userName').textContent = user.nombre || user.usuario;
  var ymd = function (v) { if (!v) return ''; var m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[1] + '-' + m[2] + '-' + m[3] : ''; };
  var fecha = function (v) { var y = ymd(v); return y ? y.split('-').reverse().join('/') : ''; };
  var anulado = function (r) { return String(r.anulado || '').trim() !== ''; };
  var hoy = function () { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  /* fuentes: acción del wrapper, campo de fecha para el periodo, columnas del Excel, resumen */
  var FUENTES = [
    { id: 'quejas', nombre: 'Quejas y reclamos', ley: 'RIT · plazo interno 15 dh', accion: 'bs_listarQuejas', permiso: 'quejas', fecha: 'fecha_recepcion', cols: ['id', 'fecha_recepcion', 'empresa', 'sector', 'categoria', 'detalle', 'resultado', 'accion_correctiva', 'created_by'], resumen: function (L) { var c = L.filter(function (r) { return /resuelt|cerrad/i.test(r.resultado || ''); }).length; return c + ' resueltas de ' + L.length; } },
    { id: 'accidentes', nombre: 'Accidentes de trabajo', ley: 'Ley 29783 · notificación MTPE', accion: 'bs_listarAccidentes', permiso: 'accidentes', fecha: 'dia_accidente', cols: ['id', 'dia_accidente', 'empresa', 'fundo', 'nombre', 'tipo_accidente', 'parte_cuerpo', 'estado_caso', 'created_by'], resumen: function (L) { return L.filter(function (r) { return /mortal|grave/i.test((r.tipo_accidente || '') + (r.estatus_accidente || '')); }).length + ' graves/mortales · ' + L.filter(function (r) { return /cerrad/i.test(r.estado_caso || ''); }).length + ' cerrados'; } },
    { id: 'hostigamiento', nombre: 'Hostigamiento sexual (casos)', ley: 'Ley 27942', accion: 'bs_listarHostigamiento', permiso: 'hostigamiento', fecha: 'fecha_denuncia', cols: ['id', 'fecha_denuncia', 'empresa', 'sede', 'fundo', 'medida_proteccion', 'decision', 'status'], confidencial: true, resumen: function (L) { return L.filter(function (r) { return r.medida_proteccion; }).length + ' con medidas de protección'; } },
    { id: 'descansos', nombre: 'Descansos médicos', ley: 'Ley 26790 · canje CITT 30 d', accion: 'bs_listarDescansos', permiso: 'descansos', fecha: 'fecha_inicio', cols: ['id', 'dni', 'nombre', 'empresa', 'tipo', 'fecha_inicio', 'fecha_fin', 'dias', 'citt_estado', 'estado'], resumen: function (L) { return L.filter(function (r) { return r.citt_estado === 'Pendiente de canje'; }).length + ' CITT pendientes de canje'; } },
    { id: 'subsidios', nombre: 'Subsidios EsSalud', ley: 'Ley 26790', accion: 'bs_listarSubsidios', permiso: 'subsidios', fecha: 'inicio', cols: ['id', 'dni', 'nombre', 'empresa', 'tipo', 'inicio', 'fin', 'dias', 'monto_total', 'estado_general'], resumen: function (L) { return L.filter(function (r) { return /cobrado|recuperado/i.test(r.estado_general || ''); }).length + ' recuperados'; } },
    { id: 'gs_casos', nombre: 'Casos sociales', ley: 'Gestión Social', accion: 'bs_listarGsCasos', permiso: 'gestion_social', fecha: 'fecha_deteccion', cols: ['codigo', 'fecha_deteccion', 'empresa', 'fundo', 'tipo', 'prioridad', 'origen', 'accion_inmediata', 'derivacion', 'estado', 'numero_seguimientos', 'fecha_cierre'], reservado: true, resumen: function (L) { return L.filter(function (r) { return r.estado === 'Cerrado'; }).length + ' cerrados · ' + L.filter(function (r) { return r.prioridad === 'Alta'; }).length + ' prioridad alta'; } },
    { id: 'gestantes', nombre: 'Gestantes y lactancia', ley: 'Leyes 28048 · 26644 · 27240', accion: 'bs_listarGestantes', permiso: 'gs_gestantes', fecha: 'fecha_comunicacion', cols: ['codigo', 'fecha_comunicacion', 'empresa', 'fundo', 'fecha_probable_parto', 'descanso_pre_inicio', 'descanso_post_fin', 'lactancia_hasta', 'riesgo_puesto', 'reubicada', 'subsidio_tramitado', 'estado'], reservado: true, resumen: function (L) { var r = L.filter(function (x) { return String(x.riesgo_puesto).toUpperCase() === 'SI'; }); return r.length + ' en puesto de riesgo · ' + r.filter(function (x) { return String(x.reubicada).toUpperCase() === 'SI'; }).length + ' reubicadas'; } },
    { id: 'canal', nombre: 'Canal anónimo QR', ley: 'Mecanismo de queja (SMETA 4 pilares)', accion: 'bs_listarCanal', permiso: 'gs_canal', fecha: 'fecha', cols: ['codigo', 'fecha', 'empresa', 'fundo', 'categoria', 'estado', 'fecha_atencion', 'derivado_a'], resumen: function (L) { return L.filter(function (r) { return r.estado !== 'Nuevo'; }).length + ' atendidos de ' + L.length; } },
    { id: 'visitas', nombre: 'Condiciones en campo', ley: 'Ley 29783 · D.S. 005-2012-TR', accion: 'bs_listarVisitas', permiso: 'gs_condiciones', fecha: 'fecha', cols: ['codigo', 'fecha', 'empresa', 'fundo', 'visitante', 'puntaje', 'items_ok', 'items_obs', 'estado', 'fecha_compromiso'], resumen: function (L) { var p = L.length ? Math.round(L.reduce(function (s, r) { return s + (Number(r.puntaje) || 0); }, 0) / L.length * 10) / 10 : 0; return 'puntaje promedio ' + p + ' · ' + L.filter(function (r) { return Number(r.puntaje) < 70; }).length + ' en rojo'; } },
    { id: 'consentimientos', nombre: 'Consentimientos de datos', ley: 'Ley 29733', clave: 'bs_gs_consentimientos', permiso: 'gs_datos', fecha: 'fecha', cols: ['codigo', 'fecha', 'dni', 'nombre', 'empresa', 'medio', 'version_texto', 'firmado', 'revocado'], resumen: function (L) { return L.filter(function (r) { return String(r.firmado).toUpperCase() === 'SI' && String(r.revocado).toUpperCase() !== 'SI'; }).length + ' vigentes'; } },
    { id: 'comite', nombre: 'Comité de hostigamiento', ley: 'Ley 27942 · D.S. 014-2019-MIMP', clave: 'bs_gs_comite', permiso: 'gs_comite', fecha: 'fecha', cols: ['codigo', 'fecha', 'tipo', 'empresa', 'asistentes', 'vigencia_hasta', 'documento', 'estado'], resumen: function (L) { return L.filter(function (r) { return /capacitaci/i.test(r.tipo); }).length + ' capacitaciones · ' + L.filter(function (r) { return /conformaci|renovaci/i.test(r.tipo); }).length + ' conformaciones'; } },
    { id: 'adolescentes', nombre: 'Adolescentes autorizados', ley: 'CNA · D.S. 003-2010-MIMDES', clave: 'bs_gs_adolescentes', permiso: 'gs_adolescentes', fecha: 'fecha_ingreso', cols: ['codigo', 'dni', 'nombre', 'edad', 'empresa', 'fundo', 'cargo', 'autorizacion_mtpe', 'vigencia_autorizacion', 'horas_semana', 'labor_permitida', 'estudia', 'estado'], sinPeriodo: true, resumen: function (L) { return L.filter(function (r) { return r.estado !== 'Cesado'; }).length + ' activos'; } },
    { id: 'lactarios', nombre: 'Lactarios', ley: 'Ley 29896', clave: 'bs_gs_lactarios', permiso: 'gs_lactario', fecha: 'fecha_implementacion', cols: ['codigo', 'empresa', 'sede', 'fundo', 'mujeres_edad_fertil', 'fecha_implementacion', 'refrigeradora', 'lavabo', 'privacidad', 'mobiliario', 'comunicado_mimp', 'estado'], sinPeriodo: true, resumen: function (L) { return L.filter(function (r) { return r.estado === 'Operativo'; }).length + ' operativos de ' + L.length; } },
    { id: 'discapacidad', nombre: 'Discapacidad (cuota 3 %)', ley: 'Ley 29973', clave: 'bs_gs_discapacidad', permiso: 'gs_discapacidad', fecha: 'created_at', cols: ['codigo', 'dni', 'nombre', 'empresa', 'tipo_discapacidad', 'certificado_conadis', 'vigencia_certificado', 'ajustes', 'estado'], sinPeriodo: true, reservado: true, resumen: function (L) { return L.filter(function (r) { return r.estado !== 'Cesado'; }).length + ' activos con CONADIS'; } },   /* _BS_TODOS_MODULOS_V1: faltaba esta coma (el archivo no cargaba desde que se agrego Lactancia) */
    { id: 'lactancia', nombre: 'Lactancia (acumulación de horas)', ley: 'Ley 27240 · 27591 · 28731', clave: 'bs_gs_lactancia', permiso: 'gs_lactancia', fecha: 'created_at', cols: ['codigo', 'dni', 'nombre', 'empresa', 'fecha_parto', 'fecha_retorno', 'fecha_fin', 'acuerdo_firmado', 'estado'] },
  ];
  var RES = {};
  function puede(p) { return esAdmin || (user.permisos && user.permisos[p]); }
  async function generar() {
    var emp = $('fEmpresa').value, d1 = $('fDesde').value, d2 = $('fHasta').value, out = $('resultado');
    if (!d1 || !d2) { appAlert('Indica el periodo (desde / hasta).'); return; }
    $('btnGen').disabled = true; out.innerHTML = '<div class="bs-text-center" style="padding:2rem"><div class="bs-spinner bs-spinner-dark" style="margin:0 auto"></div><div class="bs-text-sm bs-text-muted" style="margin-top:.5rem">Leyendo ' + FUENTES.length + ' módulos de Supabase…</div></div>';
    RES = {};
    await Promise.all(FUENTES.map(async function (f) {
      if (!puede(f.permiso)) { RES[f.id] = { sin: true }; return; }
      try {
        var r = f.clave ? await api('bs_gsListar', { clave: f.clave }) : await api(f.accion, {});
        var items = (r && r.ok && r.items) ? r.items.filter(function (x) { return !anulado(x); }) : [];
        var L = items.filter(function (x) { if (emp && String(x.empresa || '').toUpperCase() !== emp) return false; if (f.sinPeriodo) return true; var y = ymd(x[f.fecha]); return !y || (y >= d1 && y <= d2); });
        RES[f.id] = { ok: !!(r && r.ok), items: L, total: items.length, err: r && !r.ok ? (r.message || 'error') : '' };
      } catch (e) { RES[f.id] = { ok: false, items: [], err: e.message }; }
    }));
    $('btnGen').disabled = false; $('btnXls').disabled = false; $('btnPrint').disabled = false;
    var tot = 0;
    out.innerHTML = '<div class="gs-doc" id="docExp" style="max-width:none"><h2>EXPEDIENTE DE EVIDENCIA · BIENESTAR SOCIAL</h2><div style="text-align:center;font-size:.85rem;color:#64748b;margin-bottom:1rem">Unifrutti Perú · ' + (emp || 'RAPEL y VERFRUT') + ' · periodo ' + fecha(d1) + ' – ' + fecha(d2) + ' · generado ' + fecha(hoy()) + ' por ' + esc(user.nombre || user.usuario) + ' · fuente: Supabase</div>' +
      '<table class="bs-table" style="width:100%"><thead><tr><th>Módulo</th><th>Base legal</th><th>Registros en el periodo</th><th>Resumen</th></tr></thead><tbody>' +
      FUENTES.map(function (f) { var R = RES[f.id]; if (R.sin) return '<tr><td><b>' + f.nombre + '</b></td><td class="bs-text-sm">' + f.ley + '</td><td colspan="2" class="bs-text-muted">sin permiso para este módulo</td></tr>'; tot += R.items.length; return '<tr><td><b>' + f.nombre + '</b>' + (f.reservado || f.confidencial ? ' <span class="gs-pill ambar">reservado</span>' : '') + '</td><td class="bs-text-sm">' + f.ley + '</td><td><b>' + R.items.length + '</b>' + (f.sinPeriodo ? ' <span class="bs-text-xs bs-text-muted">(vigentes)</span>' : ' <span class="bs-text-xs bs-text-muted">de ' + R.total + '</span>') + (R.err ? '<br><span style="color:#b91c1c" class="bs-text-xs">' + esc(R.err) + '</span>' : '') + '</td><td class="bs-text-sm">' + (R.ok ? f.resumen(R.items) : '—') + '</td></tr>'; }).join('') +
      '</tbody></table><p class="bs-text-xs bs-text-muted" style="margin-top:1rem">Total de evidencias en el periodo: <b>' + tot + '</b>. Cada registro conserva usuario, fecha y hora de creación y de cambios en la tabla de auditoría inmutable (bs_auditoria). Los módulos marcados como reservados contienen datos sensibles (Ley 29733): entregar a auditoría solo con el consentimiento o en forma agregada.</p></div>';
  }
  function excel() {
    if (typeof XLSX === 'undefined') { appAlert('La librería de Excel no cargó. Recarga la página.'); return; }
    var wb = XLSX.utils.book_new(), emp = $('fEmpresa').value, d1 = $('fDesde').value, d2 = $('fHasta').value;
    var resumen = [['EXPEDIENTE DE EVIDENCIA · BIENESTAR SOCIAL · Unifrutti Perú'], ['Empresa', emp || 'RAPEL y VERFRUT'], ['Periodo', fecha(d1) + ' – ' + fecha(d2)], ['Generado', fecha(hoy()) + ' por ' + (user.nombre || user.usuario)], ['Fuente', 'Supabase (tablas bs_*)'], [], ['Módulo', 'Base legal', 'Registros', 'Resumen']];
    FUENTES.forEach(function (f) { var R = RES[f.id]; if (!R || R.sin) return; resumen.push([f.nombre, f.ley, R.items.length, f.resumen(R.items)]); });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumen), 'Resumen');
    FUENTES.forEach(function (f) { var R = RES[f.id]; if (!R || R.sin || !R.items.length) return; var rows = R.items.map(function (x) { var o = {}; f.cols.forEach(function (c) { var v = x[c]; o[c] = /fecha|inicio|fin$|vigencia|hasta|_at$|dia_/.test(c) && ymd(v) ? fecha(v) : (v == null ? '' : v); }); return o; }); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), f.nombre.slice(0, 31).replace(/[\\\/\?\*\[\]:]/g, ' ')); });
    XLSX.writeFile(wb, 'Expediente_Bienestar_' + (emp || 'TODAS') + '_' + d1 + '_' + d2 + '.xlsx');
  }
  (function () { var d = new Date(); $('fHasta').value = hoy(); $('fDesde').value = d.getFullYear() + '-01-01'; })();
  window.generar = generar; window.excel = excel;
  /* _BS_TODOS_MODULOS_V1 (24-nov-2026): casilla propia 'Bienestar: Expediente de auditoria'; si aun no viene, vale la de Estadisticas como antes */
  var puedeExp = esAdmin || !!(user.permisos && (user.permisos.expediente !== undefined ? user.permisos.expediente === true : user.permisos.estadisticas));
  if (!puedeExp) { $('resultado').innerHTML = '<div class="bs-alert bs-alert-danger"><strong>Sin acceso.</strong> El expediente de auditoría requiere el permiso <b>Bienestar: Expediente de auditoría</b> en "Acceso a Módulos" del Sistema RR.LL.</div>'; $('btnGen').disabled = true; }
})();
