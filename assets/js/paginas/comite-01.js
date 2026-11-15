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
