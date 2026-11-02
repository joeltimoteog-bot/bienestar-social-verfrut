/* Bienestar Social · modulos/descansos.html · bloque 2 · _DM_AZURE_V1 (01-nov-2026)
   Consulta por DNI contra la base de datos central (Azure SQL, tabla Atenciones de RR.LL.).
   - Lee con la sesion de RR.LL. (rl_token guardado en bienestarSocialAuth al iniciar sesion).
   - Endpoints: trabajadores/buscar?dni=  y  atenciones/by-dni?dni=&dias=1095&completo=1
   - Cruza con los registros propios de Bienestar (DATA de descansos-01.js) para el mismo DNI.
   Solo lectura: no escribe en Azure ni en Sheets. */
(function () {
  'use strict';
  var AZ = 'https://rl-fn-verfrut.azurewebsites.net/api/';
  var RX_DM = /CITT|DESCANSO|D\.?M\.?\b|LICENCIA|MATERNIDAD|INCAPACIDAD|SUBSIDIO|ESSALUD|MEDIC/i;

  function $(id) { return document.getElementById(id); }
  function esc(s) { return (window.esc ? window.esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; })); }
  function token() { try { return (JSON.parse(localStorage.getItem('bienestarSocialAuth') || '{}') || {}).rl_token || ''; } catch (e) { return ''; } }
  function fecha(v) {
    if (!v) return '—';
    var d = new Date(v); if (isNaN(d)) return esc(String(v).slice(0, 10));
    return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear();
  }
  function diasEntre(a, b) {
    var d1 = new Date(a), d2 = new Date(b); if (isNaN(d1) || isNaN(d2)) return null;
    return Math.round((d2 - d1) / 86400000) + 1;
  }
  function estadoChip(est) {
    var e = String(est || '').toUpperCase();
    if (e.indexOf('FINALIZ') >= 0) return '<span class="az-chip az-ok">Finalizado · documentación regularizada</span>';
    if (e.indexOf('PROCESO') >= 0) return '<span class="az-chip az-warn">En proceso · pendiente de cierre</span>';
    if (e.indexOf('ANUL') >= 0 || e.indexOf('CANCEL') >= 0) return '<span class="az-chip az-off">' + esc(est) + '</span>';
    return '<span class="az-chip az-off">' + esc(est || 'Sin estado') + '</span>';
  }
  function vigencia(a) {
    if (!a.fecha_termino_doc) return '';
    var fin = new Date(a.fecha_termino_doc); if (isNaN(fin)) return '';
    var hoy = new Date(); hoy.setHours(0, 0, 0, 0); fin.setHours(0, 0, 0, 0);
    var diff = Math.round((fin - hoy) / 86400000);
    if (diff >= 0) return '<span class="az-chip az-info">Vigente · termina en ' + diff + ' día' + (diff === 1 ? '' : 's') + '</span>';
    return '<span class="az-chip az-off">Documento vencido hace ' + (-diff) + ' día' + (diff === -1 ? '' : 's') + '</span>';
  }

  async function azGet(path) {
    var tk = token();
    var res = await fetch(AZ + path, { headers: tk ? { 'Authorization': 'Bearer ' + tk } : {} });
    if (res.status === 401) throw new Error('SESION');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  function filaAzure(a) {
    var dur = a.fecha_inicio_doc && a.fecha_termino_doc ? diasEntre(a.fecha_inicio_doc, a.fecha_termino_doc) : null;
    return '<tr>' +
      '<td>' + esc(a.nro || a.id) + '</td>' +
      '<td>' + fecha(a.fecha_atencion) + '</td>' +
      '<td>' + esc(a.detalle_documento || '—') + '</td>' +
      '<td>' + fecha(a.fecha_inicio_doc) + ' → ' + fecha(a.fecha_termino_doc) + (dur ? '<br><small>' + dur + ' día' + (dur === 1 ? '' : 's') + '</small>' : '') + '</td>' +
      '<td>' + estadoChip(a.estado) + ' ' + vigencia(a) + '</td>' +
      '<td>' + esc(a.empresa || '') + (a.fundo ? ' · ' + esc(a.fundo) : '') + '</td>' +
      '<td>' + esc(a.supervisor || '—') + '<br><small>Recepción: ' + esc(a.responsable_recepcion || '—') + '</small></td>' +
      '<td>' + esc(a.observaciones || '') + '</td>' +
      '</tr>';
  }

  function filaBS(x) {
    return '<tr>' +
      '<td>' + esc(x.id || '') + '</td>' +
      '<td>' + esc(x.tipo || '') + '</td>' +
      '<td>' + fecha(x.fecha_inicio) + ' → ' + fecha(x.fecha_fin) + '</td>' +
      '<td>' + esc(x.dias || '') + '</td>' +
      '<td>' + esc(x.estado || '') + '</td>' +
      '<td>' + esc(x.citt_numero || '—') + '<br><small>' + esc(x.citt_estado || '') + '</small></td>' +
      '<td>' + esc(x.id_subsidio || '—') + '</td>' +
      '</tr>';
  }

  function render(dni, trab, resp, soloDM) {
    var todas = [].concat(resp.en_proceso || [], resp.finalizadas_recientes || []);
    todas.sort(function (a, b) { return new Date(b.fecha_atencion) - new Date(a.fecha_atencion); });
    var lista = soloDM ? todas.filter(function (a) { return RX_DM.test(a.detalle_documento || ''); }) : todas;
    var enProc = lista.filter(function (a) { return /PROCESO/i.test(a.estado || ''); });
    var fin = lista.filter(function (a) { return /FINALIZ/i.test(a.estado || ''); });
    var bs = (window.DATA || []).filter(function (x) { return String(x.dni || '').trim() === dni; });

    var nombre = (trab && (trab.nombre_completo || [trab.apellido_paterno, trab.apellido_materno, trab.nombres].filter(Boolean).join(' ') || trab.nombre)) || (todas[0] && todas[0].nombre) || '';
    var emp = (trab && (trab.empresa || trab.empresa_origen)) || (todas[0] && todas[0].empresa) || '';
    var fundo = (trab && (trab.fundo || trab.sede)) || (todas[0] && todas[0].fundo) || '';

    var resumen;
    if (!lista.length) resumen = '<div class="az-res az-res-off">Sin atenciones ' + (soloDM ? 'de descanso médico ' : '') + 'registradas en RR.LL. para este DNI en los últimos 3 años.</div>';
    else if (enProc.length) resumen = '<div class="az-res az-res-warn"><b>' + enProc.length + '</b> atención' + (enProc.length === 1 ? '' : 'es') + ' EN PROCESO: el trabajador aún no cerró / no regularizó la documentación en RR.LL.</div>';
    else resumen = '<div class="az-res az-res-ok">Todas las atenciones (' + fin.length + ') están FINALIZADAS: documentación regularizada y cerrada en RR.LL.</div>';

    var h = '<div class="az-card">' +
      '<div class="az-trab"><div><b>' + esc(nombre || 'Trabajador no encontrado en padrón') + '</b><br><small>DNI ' + esc(dni) + (emp ? ' · ' + esc(emp) : '') + (fundo ? ' · ' + esc(fundo) : '') + '</small></div>' +
      '<div class="az-kpis"><span>Total <b>' + lista.length + '</b></span><span>En proceso <b class="t-warn">' + enProc.length + '</b></span><span>Finalizadas <b class="t-ok">' + fin.length + '</b></span><span>Reg. Bienestar <b>' + bs.length + '</b></span></div></div>' +
      resumen + '</div>';

    h += '<h4 class="az-h">Atenciones en RR.LL. (Azure) · ventana ' + esc(resp.ventana_dias) + ' días</h4>';
    if (lista.length) {
      h += '<div class="bs-table-wrap"><table class="bs-table az-tabla"><thead><tr><th>N°</th><th>Fecha atención</th><th>Documento</th><th>Vigencia del documento</th><th>Estado</th><th>Empresa / Fundo</th><th>Supervisor</th><th>Observaciones</th></tr></thead><tbody>' + lista.map(filaAzure).join('') + '</tbody></table></div>';
    } else h += '<p class="bs-text-muted">Sin registros.</p>';

    h += '<h4 class="az-h">Registros propios de Bienestar Social para este DNI</h4>';
    if (bs.length) {
      h += '<div class="bs-table-wrap"><table class="bs-table az-tabla"><thead><tr><th>ID</th><th>Tipo</th><th>Periodo</th><th>Días</th><th>Estado</th><th>CITT</th><th>Subsidio</th></tr></thead><tbody>' + bs.map(filaBS).join('') + '</tbody></table></div>';
    } else h += '<p class="bs-text-muted">Bienestar no tiene descansos registrados para este DNI' + (!window.DATA ? ' (lista aún no cargada)' : '') + '.</p>';

    if (bs.length && lista.length) {
      var sinCruce = bs.filter(function (x) {
        var fi = new Date(x.fecha_inicio); if (isNaN(fi)) return false;
        return !lista.some(function (a) { var ai = new Date(a.fecha_inicio_doc); return !isNaN(ai) && Math.abs(ai - fi) <= 3 * 86400000; });
      });
      if (sinCruce.length) h += '<div class="az-res az-res-warn">' + sinCruce.length + ' descanso' + (sinCruce.length === 1 ? '' : 's') + ' de Bienestar no tiene' + (sinCruce.length === 1 ? '' : 'n') + ' atención equivalente en RR.LL. (misma fecha de inicio ±3 días): revisar si el trabajador presentó el documento.</div>';
    }
    $('azOut').innerHTML = h;
  }

  async function consultar() {
    var dni = ($('azDni').value || '').replace(/\D/g, '');
    if (dni.length < 8) { $('azOut').innerHTML = '<div class="az-res az-res-warn">Ingrese un DNI válido (8 dígitos o más).</div>'; return; }
    if (!token()) { $('azOut').innerHTML = '<div class="az-res az-res-warn">Su sesión no tiene credencial de RR.LL. Cierre sesión y vuelva a ingresar para consultar Azure.</div>'; return; }
    var b = $('azBuscar'); b.disabled = true; b.textContent = 'Consultando…';
    $('azOut').innerHTML = '<div class="bs-text-muted" style="padding:1rem 0">Consultando la base de datos central…</div>';
    try {
      var rs = await Promise.all([
        azGet('trabajadores/buscar?dni=' + encodeURIComponent(dni)).catch(function () { return null; }),
        azGet('atenciones/by-dni?dni=' + encodeURIComponent(dni) + '&dias=1095&completo=1')
      ]);
      var t = rs[0]; var trab = (t && t.success && t.trabajadores && t.trabajadores[0]) || null;
      render(dni, trab, rs[1] || {}, $('azSoloDM').checked);
    } catch (e) {
      $('azOut').innerHTML = '<div class="az-res az-res-warn">' + (e.message === 'SESION' ? 'Azure rechazó la sesión (401). Cierre sesión y vuelva a ingresar.' : 'No se pudo consultar Azure: ' + esc(e.message)) + '</div>';
    } finally { b.disabled = false; b.textContent = 'Consultar'; }
  }

  function css() {
    var st = document.createElement('style'); st.id = 'dmAzureCss';
    st.textContent = '#p-azure .dm-az-head{margin:0 0 14px}#p-azure .dm-az-form{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:14px}#p-azure .dm-az-form input[type=text]{padding:.6rem .8rem;border:1px solid #cbd5e1;border-radius:8px;font:inherit;min-width:220px}#p-azure .dm-az-form label{font-size:.88rem;color:#475569;display:flex;gap:6px;align-items:center}' +
      '.az-card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;margin-bottom:14px}.az-trab{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:10px}.az-kpis{display:flex;gap:14px;flex-wrap:wrap;font-size:.85rem;color:#475569}.az-kpis b{font-size:1.1rem;color:#0f2748;margin-left:4px}.t-warn{color:#b45309!important}.t-ok{color:#15803d!important}' +
      '.az-res{padding:10px 12px;border-radius:8px;font-size:.9rem;margin-top:6px}.az-res-ok{background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0}.az-res-warn{background:#fffbeb;color:#92400e;border:1px solid #fde68a}.az-res-off{background:#f8fafc;color:#475569;border:1px solid #e2e8f0}' +
      '.az-chip{display:inline-block;padding:2px 8px;border-radius:4px;font-size:.78rem;font-weight:600;margin:2px 4px 2px 0;white-space:nowrap}.az-ok{background:#dcfce7;color:#166534}.az-warn{background:#fef3c7;color:#92400e}.az-info{background:#dbeafe;color:#1e40af}.az-off{background:#f1f5f9;color:#475569}' +
      '.az-h{margin:16px 0 8px;font-size:.95rem;color:#0f2748}.az-tabla td,.az-tabla th{font-size:.85rem;vertical-align:top}.az-tabla small{color:#64748b}';
    document.head.appendChild(st);
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!$('p-azure')) return;
    css();
    $('fAzure').addEventListener('submit', consultar);
    $('azSoloDM').addEventListener('change', function () { if (($('azDni').value || '').replace(/\D/g, '').length >= 8 && $('azOut').querySelector('.az-card')) consultar(); });
    // Permite abrir la pestaña con ?dni= desde otros módulos
    var q = new URLSearchParams(location.search).get('dni');
    if (q) { $('azDni').value = q; var tb = $('tabAzure'); if (tb) tb.click(); consultar(); }
  });
})();
