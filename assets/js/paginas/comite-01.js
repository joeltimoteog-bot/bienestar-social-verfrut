/* Bienestar Social · modulos/comite.html · _BS_GESTION_SOCIAL_V6 (15-nov-2026)
   Comité de intervención frente al hostigamiento sexual — Ley 27942 · D.S. 014-2019-MIMP: conformación paritaria (vigencia 2 años),
   actas de sesión por caso (plazos: 3 dh medidas de protección, 15 dc informe, 30 dc decisión), capacitación anual al personal y al comité.
   Configuración para bs-gs-simple.js. Tabla: bs_gs_comite. Permiso: gs_comite. Sin datos de víctimas: solo código del caso. */
var TIPOS_ACTA = ['Conformación del comité', 'Renovación del comité', 'Sesión por caso', 'Capacitación anual al personal', 'Capacitación al comité', 'Difusión de la política', 'Otra'];
window.GS_CFG = {
  permiso: 'gs_comite', clave: 'bs_gs_comite', titulo: 'Comité de hostigamiento', etiqueta: 'Acta', tituloNuevo: 'Registrar acta / capacitación',
  buscarEn: ['codigo', 'tipo', 'caso_ref', 'lugar', 'responsable', 'temas'],
  campos: [
    { seccion: '1 · ACTA' },
    { id: 'tipo', label: 'Tipo', tipo: 'select', opciones: TIPOS_ACTA, req: true, vacio: '—' },
    { id: 'fecha', label: 'Fecha', tipo: 'date', req: true, defecto: function (u, U) { return U.hoy(); } },
    { id: 'empresa', label: 'Empresa', tipo: 'select', opciones: ['RAPEL', 'VERFRUT', 'OLMOS', 'AMBAS'], vacio: '—', req: true },
    { id: 'sede', label: 'Sede', tipo: 'select', opciones: ['PIURA', 'OLMOS'], defecto: 'PIURA' },
    { id: 'lugar', label: 'Lugar', placeholder: 'Oficina, fundo, comedor…' },
    { id: 'caso_ref', label: 'Caso (código del módulo Hostigamiento)', placeholder: 'Ej.: PIU-012', hint: 'Solo el código. Nunca nombres de las partes.' },
    { seccion: '2 · PARTICIPANTES Y CONTENIDO' },
    { id: 'participantes', label: 'Miembros / participantes (nombre y cargo)', tipo: 'textarea', span: 2, placeholder: 'Para conformación: 2 titulares y 2 suplentes por empleador y por trabajadores, con paridad de género.' },
    { id: 'asistentes', label: 'N.° de asistentes', tipo: 'number', min: 0, hint: 'En capacitaciones: personas capacitadas.' },
    { id: 'temas', label: 'Temas tratados', tipo: 'textarea', span: 3 },
    { id: 'acuerdos', label: 'Acuerdos / medidas / decisiones', tipo: 'textarea', span: 3, rows: 3 },
    { seccion: '3 · PLAZOS Y EVIDENCIA' },
    { id: 'vigencia_hasta', label: 'Vigente hasta', tipo: 'date', hint: 'La calcula el sistema: conformación 2 años; capacitación 1 año.' },
    { id: 'proxima_fecha', label: 'Próxima sesión / plazo', tipo: 'date' },
    { id: 'documento', label: 'Acta firmada (enlace o ubicación del archivo)', placeholder: 'Drive, carpeta física…' },
    { id: 'responsable', label: 'Responsable', req: true, defecto: function (u) { return u.nombre || u.usuario; } },
    { id: 'estado', label: 'Estado', tipo: 'select', opciones: ['Registrada', 'Cerrada'], defecto: 'Registrada' },
    { id: 'observaciones', label: 'Observaciones', tipo: 'textarea', span: 3 }
  ],
  columnas: [
    { label: 'Código', render: function (r, U) { return '<b>' + U.esc(r.codigo) + '</b>'; } },
    { label: 'Fecha', render: function (r, U) { return U.fecha(r.fecha); } },
    { label: 'Tipo', render: function (r, U) { return U.esc(r.tipo) + (r.caso_ref ? '<br><span class="bs-text-xs bs-text-muted">caso ' + U.esc(r.caso_ref) + '</span>' : ''); } },
    { label: 'Empresa · lugar', render: function (r, U) { return U.esc(r.empresa) + (r.lugar ? '<br><span class="bs-text-xs bs-text-muted">' + U.esc(r.lugar) + '</span>' : ''); } },
    { label: 'Asistentes', render: function (r, U) { return r.asistentes ? U.num(r.asistentes) : '—'; } },
    { label: 'Vigencia', render: function (r, U) { var v = U.ymd(r.vigencia_hasta); if (!v) return '—'; var d = U.dias(U.hoy(), v); return U.fecha(v) + '<br>' + (d < 0 ? U.pill('vencida', 'rojo') : d <= 60 ? U.pill('vence en ' + d + ' d', 'ambar') : U.pill('vigente', 'ok')); } },
    { label: 'Acta', render: function (r, U) { return r.documento ? (/^https?:/.test(r.documento) ? '<a href="' + U.esc(r.documento) + '" target="_blank" rel="noopener">📎 ver</a>' : '📎 ' + U.esc(r.documento)) : '<span class="gs-pill ambar">sin archivo</span>'; } },
    { label: 'Estado', render: function (r, U) { return U.pill(r.estado || 'Registrada', r.estado === 'Cerrada' ? 'gris' : 'azul'); } }
  ],
  kpis: function (V, U) {
    var c = conformacion(V, U), cap = capacitacion(V, U, /personal/i), capC = capacitacion(V, U, /al comité/i);
    return [{ l: 'Comité', v: c ? (c.dias < 0 ? 'VENCIDO' : 'Vigente') : 'SIN CONFORMAR', s: c ? 'hasta ' + U.fecha(c.r.vigencia_hasta) : 'registra el acta de conformación', c: c && c.dias >= 0 ? '#166534' : '#b91c1c' },
      { l: 'Capacitación al personal', v: cap ? (cap.dias < 0 ? 'VENCIDA' : 'Al día') : 'SIN REGISTRO', s: cap ? 'última ' + U.fecha(cap.r.fecha) + ' · ' + U.num(cap.r.asistentes) + ' personas' : 'obligatoria cada año', c: cap && cap.dias >= 0 ? '#166534' : '#b91c1c' },
      { l: 'Capacitación al comité', v: capC ? (capC.dias < 0 ? 'VENCIDA' : 'Al día') : 'SIN REGISTRO', s: capC ? 'última ' + U.fecha(capC.r.fecha) : 'obligatoria cada año', c: capC && capC.dias >= 0 ? '#166534' : '#b45309' },
      { l: 'Sesiones por caso', v: V.filter(function (r) { return /sesi/i.test(r.tipo); }).length, s: V.filter(function (r) { return /sesi/i.test(r.tipo) && !r.documento; }).length + ' sin acta adjunta', c: '#0a2463' }];
  },
  alertas: function (V, U) {
    var A = [], c = conformacion(V, U), cap = capacitacion(V, U, /personal/i), capC = capacitacion(V, U, /al comité/i);
    if (!c) A.push({ n: 'rojo', t: 'No hay acta de conformación del comité registrada (Ley 27942: obligatorio con 20 o más trabajadores)', r: { codigo: 'Comité' } });
    else if (c.dias < 0) A.push({ n: 'rojo', t: 'El comité venció el ' + U.fecha(c.r.vigencia_hasta) + ': registra la renovación (elección de nuevos representantes)', r: c.r });
    else if (c.dias <= 60) A.push({ n: 'ambar', t: 'El comité vence en ' + c.dias + ' días (' + U.fecha(c.r.vigencia_hasta) + '): convocar elecciones', r: c.r });
    if (!cap) A.push({ n: 'rojo', t: 'No hay capacitación anual al personal registrada', r: { codigo: 'Capacitación' } }); else if (cap.dias < 0) A.push({ n: 'rojo', t: 'La capacitación anual al personal venció el ' + U.fecha(cap.r.vigencia_hasta), r: cap.r }); else if (cap.dias <= 45) A.push({ n: 'ambar', t: 'La capacitación anual vence en ' + cap.dias + ' días: programar', r: cap.r });
    if (!capC) A.push({ n: 'ambar', t: 'No hay capacitación al comité registrada (obligatoria al asumir y luego anual)', r: { codigo: 'Capacitación' } }); else if (capC.dias < 0) A.push({ n: 'ambar', t: 'La capacitación al comité venció el ' + U.fecha(capC.r.vigencia_hasta), r: capC.r });
    V.forEach(function (r) { if (!r.documento && !/capacitaci|difusi/i.test(r.tipo)) A.push({ n: 'ambar', t: 'Acta sin archivo firmado adjunto', r: r }); var p = U.ymd(r.proxima_fecha); if (p && p < U.hoy() && r.estado !== 'Cerrada') A.push({ n: 'rojo', t: 'Plazo / próxima sesión vencida el ' + U.fecha(p), r: r }); });
    return A;
  },
  detalle: function (x, U) { return [['Tipo', U.esc(x.tipo)], ['Fecha', U.fecha(x.fecha) + ' · ' + U.esc(x.empresa) + ' · ' + U.esc(x.sede || '') + (x.lugar ? ' · ' + U.esc(x.lugar) : '')], ['Caso', U.esc(x.caso_ref || '—')], ['Participantes', U.esc(x.participantes || '')], ['Asistentes', x.asistentes ? U.num(x.asistentes) : '—'], ['Temas', U.esc(x.temas || '')], ['Acuerdos', U.esc(x.acuerdos || '')], ['Vigente hasta', U.fecha(x.vigencia_hasta)], ['Próxima sesión / plazo', U.fecha(x.proxima_fecha)], ['Acta firmada', x.documento ? (/^https?:/.test(x.documento) ? '<a href="' + U.esc(x.documento) + '" target="_blank" rel="noopener">' + U.esc(x.documento) + '</a>' : U.esc(x.documento)) : '—'], ['Responsable', U.esc(x.responsable || '')], ['Estado', U.esc(x.estado || '')], ['Observaciones', U.esc(x.observaciones || '')]]; },
  extras: [{ id: 'vigencia', render: function (V, U) {
    var c = conformacion(V, U), cap = capacitacion(V, U, /personal/i), capC = capacitacion(V, U, /al comité/i), dif = ultimo(V, U, /difusi/i);
    var fila = function (req, base, est, det) { return '<tr><td><b>' + req + '</b><br><span class="bs-text-xs bs-text-muted">' + base + '</span></td><td>' + est + '</td><td class="bs-text-sm">' + det + '</td></tr>'; };
    var okv = function (o, lbl) { return !o ? U.pill('Falta', 'rojo') : o.dias < 0 ? U.pill('Vencido', 'rojo') : o.dias <= 60 ? U.pill('Por vencer', 'ambar') : U.pill('Cumple', 'ok'); };
    return '<div class="bs-table-wrap"><table class="bs-table"><thead><tr><th>Requisito</th><th>Estado</th><th>Evidencia</th></tr></thead><tbody>' +
      fila('Comité de intervención conformado y vigente (paritario, 2 años)', 'Ley 27942 art. 10 · D.S. 014-2019-MIMP art. 27–29', okv(c), c ? U.esc(c.r.codigo) + ' · ' + U.fecha(c.r.fecha) + ' → ' + U.fecha(c.r.vigencia_hasta) + (c.r.documento ? ' · acta adjunta' : ' · <b style="color:#b45309">sin acta adjunta</b>') : 'Registrar acta de conformación con miembros titulares y suplentes') +
      fila('Capacitación anual a todo el personal', 'D.S. 014-2019-MIMP art. 11 (al inicio de la relación laboral y una vez al año)', okv(cap), cap ? U.esc(cap.r.codigo) + ' · ' + U.fecha(cap.r.fecha) + ' · ' + U.num(cap.r.asistentes) + ' asistentes' : 'Registrar la capacitación con lista de asistencia') +
      fila('Capacitación especializada al comité', 'D.S. 014-2019-MIMP art. 11.2', okv(capC), capC ? U.esc(capC.r.codigo) + ' · ' + U.fecha(capC.r.fecha) : 'Registrar') +
      fila('Difusión de la política y del canal de denuncia', 'D.S. 014-2019-MIMP art. 11 y 12 (periódicos murales, charlas, QR)', dif ? U.pill('Cumple', 'ok') : U.pill('Falta', 'ambar'), dif ? U.esc(dif.codigo) + ' · ' + U.fecha(dif.fecha) : 'Registrar como tipo "Difusión de la política"') +
      '</tbody></table></div><div class="bs-text-xs bs-text-muted" style="margin-top:.6rem">Los casos y sus plazos (3 días hábiles medidas de protección · 15 días informe · 30 días decisión) se controlan en el módulo Hostigamiento y en las alertas del portal.</div>';
  } }]
};
function ultimo(V, U, re) { return V.filter(function (r) { return re.test(r.tipo) && !U.anulado(r); }).sort(function (a, b) { return U.ymd(b.fecha) < U.ymd(a.fecha) ? -1 : 1; })[0] || null; }
function conformacion(V, U) { var r = ultimo(V, U, /conformaci|renovaci/i); return r ? { r: r, dias: U.dias(U.hoy(), U.ymd(r.vigencia_hasta)) } : null; }
function capacitacion(V, U, re) { var r = V.filter(function (x) { return /capacitaci/i.test(x.tipo) && re.test(x.tipo) && !U.anulado(x); }).sort(function (a, b) { return U.ymd(b.fecha) < U.ymd(a.fecha) ? -1 : 1; })[0]; return r ? { r: r, dias: U.dias(U.hoy(), U.ymd(r.vigencia_hasta)) } : null; }

/* ═══ _BS_GESTION_SOCIAL_V6b (15-nov-2026): ACTA IMPRIMIBLE con membrete de la empresa del registro ═══
   Base: Ley 27942 (mod. Ley 30314) · D.S. 014-2019-MIMP arts. 27–29 (comité paritario, paridad de género, elección por votación,
   vigencia 2 años) y art. 11 (capacitación). BORRADOR para revisión del área Legal: el sistema no reemplaza la validación jurídica.
   Datos de membrete: completar RUC y domicilio reales en GS_EMPRESAS (no se inventan). */
window.GS_EMPRESAS = {
  RAPEL:   { razon: 'SOCIEDAD AGRÍCOLA RAPEL S.A.C.', ruc: '', domicilio: '', color: '#0a2463' },
  VERFRUT: { razon: 'VERFRUT S.A.C.', ruc: '', domicilio: '', color: '#166534' },
  OLMOS:   { razon: 'UNIFRUTTI PERÚ · SEDE OLMOS', ruc: '', domicilio: '', color: '#7c2d12' },
  AMBAS:   { razon: 'SOCIEDAD AGRÍCOLA RAPEL S.A.C. / VERFRUT S.A.C.', ruc: '', domicilio: '', color: '#0a2463' }
};
window.imprimirActa = function (id) {
  var x = window.GS_DATA().find(function (r) { return Number(r.id) === Number(id); }); if (!x) return;
  var U = window.GS_U, e = U.esc, E = window.GS_EMPRESAS[String(x.empresa || '').toUpperCase()] || window.GS_EMPRESAS.AMBAS;
  var f = U.ymd(x.fecha), d = f ? new Date(f + 'T12:00:00') : new Date(), MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre'];
  var fechaLarga = d.getDate() + ' de ' + MES[d.getMonth()] + ' de ' + d.getFullYear();
  var miembros = String(x.participantes || '').split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
  var tipo = String(x.tipo || ''), esConf = /conformaci|renovaci/i.test(tipo), esCap = /capacitaci/i.test(tipo), esSesion = /sesi/i.test(tipo);
  var titulo = esConf ? 'ACTA DE ' + (/renovaci/i.test(tipo) ? 'RENOVACIÓN' : 'INSTALACIÓN Y CONFORMACIÓN') + ' DEL COMITÉ DE INTERVENCIÓN FRENTE AL HOSTIGAMIENTO SEXUAL' : esCap ? 'CONSTANCIA DE CAPACITACIÓN EN PREVENCIÓN Y SANCIÓN DEL HOSTIGAMIENTO SEXUAL' : esSesion ? 'ACTA DE SESIÓN DEL COMITÉ DE INTERVENCIÓN FRENTE AL HOSTIGAMIENTO SEXUAL' : 'ACTA · ' + tipo.toUpperCase();
  var membrete = '<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid ' + E.color + ';padding-bottom:8px;margin-bottom:14px"><div><div style="font-weight:800;font-size:1.05rem;color:' + E.color + '">' + e(E.razon) + '</div><div style="font-size:.78rem;color:#475569">RUC ' + (E.ruc || '____________') + ' · ' + (E.domicilio || 'Domicilio: ________________________________') + '</div><div style="font-size:.78rem;color:#475569">Gestión Humana · Bienestar Social · Sede ' + e(x.sede || 'PIURA') + '</div></div><img src="../images/logo-unifrutti-hd.png" alt="Unifrutti" style="height:46px"></div>';
  var tablaMiembros = miembros.length ? '<table style="width:100%;border-collapse:collapse;font-size:.88rem;margin:.6rem 0"><thead><tr><th style="border:1px solid #94a3b8;padding:4px 6px;background:#f1f5f9">N.°</th><th style="border:1px solid #94a3b8;padding:4px 6px;background:#f1f5f9">Miembro (nombre, cargo y condición)</th><th style="border:1px solid #94a3b8;padding:4px 6px;background:#f1f5f9">Firma</th></tr></thead><tbody>' + miembros.map(function (m, i) { return '<tr><td style="border:1px solid #94a3b8;padding:4px 6px;text-align:center">' + (i + 1) + '</td><td style="border:1px solid #94a3b8;padding:4px 6px">' + e(m) + '</td><td style="border:1px solid #94a3b8;padding:14px 6px"></td></tr>'; }).join('') + '</tbody></table>' : '<p style="color:#b45309">⚠ No se registraron participantes en el acta. Edita el registro y escribe un miembro por línea (nombre · cargo · titular/suplente · representa a).</p>';
  var cuerpo;
  if (esConf) cuerpo =
    '<p>En la ciudad de ' + e(x.lugar || x.sede || 'Piura') + ', siendo el ' + fechaLarga + ', se reunieron las personas que al final suscriben, con el objeto de dejar constancia de la ' + (/renovaci/i.test(tipo) ? 'renovación' : 'instalación y conformación') + ' del <b>Comité de intervención frente al hostigamiento sexual</b> de <b>' + e(E.razon) + '</b>, en cumplimiento de la Ley N.° 27942, Ley de Prevención y Sanción del Hostigamiento Sexual, modificada por la Ley N.° 30314, y de su Reglamento aprobado por Decreto Supremo N.° 014-2019-MIMP.</p>' +
    '<h3>Considerando</h3><p>Que el artículo 27 del Reglamento dispone que los centros de trabajo con veinte (20) o más trabajadores cuentan con un Comité de intervención frente al hostigamiento sexual, integrado por representantes de los trabajadores y del empleador en igual número, garantizando la paridad de género; que los representantes de los trabajadores son elegidos por votación de estos; y que el Comité tiene por función investigar y emitir recomendaciones de sanción y otras medidas en los procedimientos de hostigamiento sexual.</p>' +
    '<h3>Acuerdos</h3><ol><li>Queda ' + (/renovaci/i.test(tipo) ? 'renovado' : 'instalado y conformado') + ' el Comité con los miembros titulares y suplentes que se detallan a continuación, con vigencia de dos (2) años contados desde la fecha de la presente acta, es decir, hasta el <b>' + U.fecha(x.vigencia_hasta) + '</b>.</li><li>Los miembros declaran conocer sus funciones, el deber de confidencialidad y de imparcialidad, y los plazos del procedimiento (medidas de protección en 3 días hábiles; informe del Comité en 15 días calendario; comunicación al Ministerio de Trabajo en los plazos de ley).</li>' + (x.acuerdos ? '<li>' + e(x.acuerdos).replace(/\n/g, '<br>') + '</li>' : '') + '</ol>' +
    '<h3>Miembros del Comité</h3>' + tablaMiembros +
    '<p>No habiendo otro punto que tratar, se da por concluida la sesión, firmando los presentes en señal de conformidad.</p>';
  else if (esCap) cuerpo =
    '<p>Se deja constancia de que el ' + fechaLarga + ', en ' + e(x.lugar || x.sede || 'Piura') + ', <b>' + e(E.razon) + '</b> realizó la capacitación <b>"' + e(tipo) + '"</b>' + (x.temas ? ' con los siguientes temas: ' + e(x.temas) : '') + ', en cumplimiento del artículo 11 del Reglamento de la Ley N.° 27942 (D.S. N.° 014-2019-MIMP), que obliga a capacitar al personal al inicio de la relación laboral y al menos una vez al año, y de manera especializada a los miembros del Comité.</p>' +
    '<p>Asistentes: <b>' + U.num(x.asistentes) + '</b> personas (lista de asistencia firmada adjunta). Responsable: ' + e(x.responsable || '') + '.' + (x.acuerdos ? '<br>Compromisos: ' + e(x.acuerdos) : '') + '</p>' + (miembros.length ? '<h3>Facilitadores / participantes destacados</h3>' + tablaMiembros : '') +
    '<p>La presente constancia es válida hasta el <b>' + U.fecha(x.vigencia_hasta) + '</b>, fecha en que corresponde la siguiente capacitación anual.</p>';
  else cuerpo =
    '<p>En ' + e(x.lugar || x.sede || 'Piura') + ', el ' + fechaLarga + ', se reunió el Comité de intervención frente al hostigamiento sexual de <b>' + e(E.razon) + '</b>' + (x.caso_ref ? ' para tratar el caso <b>' + e(x.caso_ref) + '</b> (las partes se identifican únicamente por el código del caso, en resguardo de la confidencialidad prevista en el art. 7 de la Ley N.° 27942 y la Ley N.° 29733)' : '') + '.</p>' +
    (x.temas ? '<h3>Agenda</h3><p>' + e(x.temas).replace(/\n/g, '<br>') + '</p>' : '') + '<h3>Acuerdos y medidas</h3><p>' + (x.acuerdos ? e(x.acuerdos).replace(/\n/g, '<br>') : '—') + '</p>' + (U.ymd(x.proxima_fecha) ? '<p>Próxima actuación / plazo: <b>' + U.fecha(x.proxima_fecha) + '</b>.</p>' : '') + '<h3>Asistentes</h3>' + tablaMiembros;
  var html = '<div class="gs-doc" id="docActa" style="max-width:820px">' + membrete + '<h2>' + titulo + '</h2><div style="text-align:center;font-size:.78rem;color:#64748b;margin-bottom:.8rem">Código ' + e(x.codigo) + ' · Registro del Sistema Bienestar Social</div>' + cuerpo +
    '<div class="firma" style="grid-template-columns:1fr 1fr 1fr"><div>Presidente(a) / representante del empleador</div><div>Representante de los trabajadores</div><div>Bienestar Social<br>' + e(x.responsable || '') + '</div></div>' +
    '<p style="font-size:.7rem;color:#64748b;margin-top:1.2rem">Borrador generado por el Sistema Bienestar Social para revisión del área Legal. Verificar RUC, domicilio, nombres y cargos antes de firmar. Base normativa: Ley 27942 · Ley 30314 · D.S. 014-2019-MIMP.</p></div>';
  cerrarDet();
  var cont = document.getElementById('p-acta'); if (!cont) { cont = document.createElement('div'); cont.id = 'p-acta'; document.getElementById('p-lista').parentNode.appendChild(cont); }
  document.querySelectorAll('[id^="p-"]').forEach(function (p) { p.hidden = p.id !== 'p-acta'; }); document.querySelectorAll('#tabs button').forEach(function (b) { b.classList.remove('on'); });
  cont.hidden = false; cont.innerHTML = '<div class="bs-flex bs-justify-between bs-items-center" style="margin-bottom:.8rem;flex-wrap:wrap;gap:.5rem"><span class="bs-text-sm bs-text-muted">Acta generada con los datos del registro ' + e(x.codigo) + '. Membrete: ' + e(E.razon) + '.</span><div class="bs-flex" style="gap:.5rem"><button class="bs-btn bs-btn-outline" onclick="document.querySelector(\'#tabs button[data-t=lista]\').click()">← Volver</button><button class="bs-btn bs-btn-gs" onclick="window.print()">🖨️ Imprimir / PDF</button></div></div>' + html;
  window.scrollTo(0, 0);
};
window.GS_CFG.accionesDetalle = function (x, U) { return '<button type="button" class="bs-btn bs-btn-outline" onclick="imprimirActa(' + U.num(x.id) + ')">🖨️ Acta con membrete</button>'; };
