/* Bienestar Social · modulos/datos-personales.html · _BS_GESTION_SOCIAL_V6 (15-nov-2026)
   Consentimiento informado para tratamiento de datos personales y sensibles (salud) — Ley 29733 y su reglamento (D.S. 016-2024-JUS).
   Configuración para el motor bs-gs-simple.js. Tabla: bs_gs_consentimientos. Permiso: gs_datos. */
window.GS_TEXTO_CONSENTIMIENTO = {
  version: 'v1-2026',
  titulo: 'CONSENTIMIENTO INFORMADO PARA EL TRATAMIENTO DE DATOS PERSONALES',
  parrafos: [
    'En cumplimiento de la Ley N.° 29733, Ley de Protección de Datos Personales, y su Reglamento, declaro que he sido informado(a) de que {EMPRESA}, a través de su área de Bienestar Social / Gestión Humana, tratará mis datos personales, incluidos datos sensibles referidos a mi salud (descansos médicos, subsidios, condición de gestación o lactancia, discapacidad, accidentes de trabajo), con las siguientes finalidades: gestión de beneficios y subsidios ante EsSalud, seguimiento de casos sociales y de bienestar, prevención y atención de accidentes y hostigamiento, cumplimiento de obligaciones laborales y de seguridad y salud en el trabajo, y atención de auditorías sociales y fiscalizaciones de la autoridad de trabajo.',
    'Mis datos serán almacenados en el Sistema Bienestar Social de la empresa (base de datos alojada en servicios en la nube contratados por la empresa), con acceso restringido únicamente al personal autorizado de Bienestar Social, Relaciones Laborales y Gestión Humana, y se conservarán mientras dure la relación laboral y por el plazo que exija la normativa laboral y de seguridad social.',
    'Se me ha informado que puedo ejercer mis derechos de acceso, rectificación, cancelación y oposición (ARCO) presentando una solicitud escrita ante el área de Bienestar Social, y que puedo revocar este consentimiento en cualquier momento, sin que ello afecte los tratamientos realizados antes de la revocación ni los que la empresa deba realizar por obligación legal.',
    'Otorgo mi consentimiento libre, previo, expreso, inequívoco e informado para el tratamiento descrito.'
  ]
};
window.GS_CFG = {
  permiso: 'gs_datos', clave: 'bs_gs_consentimientos', titulo: 'Protección de datos', etiqueta: 'Consentimiento', tituloNuevo: 'Registrar consentimiento',
  buscarEn: ['codigo', 'dni', 'nombre', 'fundo', 'registrado_por'],
  campos: [
    { seccion: '1 · TRABAJADOR' },
    { id: 'dni', label: 'DNI', tipo: 'dni', req: true },
    { id: 'nombre', label: 'Nombre completo', req: true, span: 2, upper: true },
    { id: 'empresa', label: 'Empresa', tipo: 'select', opciones: ['RAPEL', 'VERFRUT', 'OLMOS'], vacio: '—', req: true },
    { id: 'fundo', label: 'Fundo / sector', lista: 'dlFundos' },
    { id: 'sede', label: 'Sede', tipo: 'select', opciones: ['PIURA', 'OLMOS'], defecto: 'PIURA' },
    { seccion: '2 · CONSENTIMIENTO' },
    { id: 'fecha', label: 'Fecha de firma', tipo: 'date', req: true, defecto: function (u, U) { return U.hoy(); } },
    { id: 'medio', label: 'Medio', tipo: 'select', opciones: ['Firma en formato impreso', 'Firma digital / app', 'Huella digital', 'Verbal con testigo (excepcional)'], req: true },
    { id: 'version_texto', label: 'Versión del texto', defecto: 'v1-2026', hint: 'Debe coincidir con el formato impreso (pestaña Formato).' },
    { id: 'finalidades', label: 'Finalidades (si difieren del texto estándar)', span: 3, placeholder: 'Dejar vacío si firmó el texto estándar' },
    { id: 'firmado', label: '¿Firmó?', tipo: 'si_no', defecto: 'SI' },
    { id: 'registrado_por', label: 'Registrado por', defecto: function (u) { return u.nombre || u.usuario; } },
    { id: 'observaciones', label: 'Observaciones', tipo: 'textarea', span: 3 },
    { seccion: '3 · REVOCACIÓN (solo si el trabajador la pide)' },
    { id: 'revocado', label: 'Revocado', tipo: 'si_no' },
    { id: 'fecha_revocacion', label: 'Fecha de revocación', tipo: 'date', hint: 'Se completa sola al marcar Revocado.' }
  ],
  columnas: [
    { label: 'Código', render: function (r, U) { return '<b>' + U.esc(r.codigo) + '</b>'; } },
    { label: 'Trabajador', render: function (r, U) { return '<b>' + U.esc(r.nombre) + '</b><br><span class="bs-text-xs bs-text-muted">DNI ' + U.esc(r.dni) + ' · ' + U.esc(r.empresa) + (r.fundo ? ' · ' + U.esc(r.fundo) : '') + '</span>'; } },
    { label: 'Firma', render: function (r, U) { return U.fecha(r.fecha) + '<br><span class="bs-text-xs bs-text-muted">' + U.esc(r.medio || '') + '</span>'; } },
    { label: 'Versión', render: function (r, U) { return U.esc(r.version_texto || ''); } },
    { label: 'Estado', render: function (r, U) { return U.si(r.revocado) ? U.pill('Revocado', 'rojo') : U.si(r.firmado) ? U.pill('Vigente', 'ok') : U.pill('Sin firma', 'ambar'); } },
    { label: 'Registró', render: function (r, U) { return '<span class="bs-text-sm">' + U.esc(r.registrado_por || r.created_by || '') + '</span>'; } }
  ],
  filtroEstado: function (r, fS, U) { var e = U.si(r.revocado) ? 'Revocado' : U.si(r.firmado) ? 'Vigente' : 'Sin firma'; return e === fS; },
  kpis: function (V, U) {
    var vig = V.filter(function (r) { return U.si(r.firmado) && !U.si(r.revocado); }).length, rev = V.filter(function (r) { return U.si(r.revocado); }).length, sin = V.filter(function (r) { return !U.si(r.firmado) && !U.si(r.revocado); }).length;
    var dnis = {}; V.forEach(function (r) { if (U.si(r.firmado) && !U.si(r.revocado)) dnis[r.dni] = 1; });
    return [{ l: 'Consentimientos vigentes', v: vig, s: Object.keys(dnis).length + ' trabajadores', c: '#166534' }, { l: 'Revocados', v: rev, s: 'ya no se puede tratar su data sensible', c: rev ? '#b91c1c' : '#166534' }, { l: 'Sin firma', v: sin, s: 'formatos entregados sin firmar', c: sin ? '#b45309' : '#166534' }, { l: 'Versión vigente', v: window.GS_TEXTO_CONSENTIMIENTO.version, s: 'texto del formato', c: '#0a2463' }];
  },
  alertas: function (V, U) {
    var A = [];
    V.forEach(function (r) {
      if (U.si(r.revocado)) A.push({ n: 'rojo', t: 'Consentimiento revocado el ' + U.fecha(r.fecha_revocacion) + ': no tratar datos de salud de este trabajador salvo obligación legal', r: r });
      else if (!U.si(r.firmado)) A.push({ n: 'ambar', t: 'Formato sin firma desde ' + U.fecha(r.fecha), r: r });
      else if (r.version_texto && r.version_texto !== window.GS_TEXTO_CONSENTIMIENTO.version) A.push({ n: 'info', t: 'Firmó la versión ' + U.esc(r.version_texto) + '; la vigente es ' + window.GS_TEXTO_CONSENTIMIENTO.version, r: r });
    });
    return A;
  },
  validar: function (d) { if (d.revocado === 'SI' && d.firmado !== 'SI') return 'No se puede revocar un consentimiento que no fue firmado.'; return null; },
  alDni: function (dni, t, DATA, U) { var prev = DATA.filter(function (r) { return String(r.dni) === String(dni) && !U.anulado(r) && U.si(r.firmado) && !U.si(r.revocado); }); if (prev.length) appAlert('Este trabajador ya tiene un consentimiento vigente (' + prev[0].codigo + ', ' + U.fecha(prev[0].fecha) + '). Solo registra otro si firmó una nueva versión.'); },
  detalle: function (x, U) {
    return [['Trabajador', U.esc(x.nombre) + ' · DNI ' + U.esc(x.dni) + ' · ' + U.esc(x.empresa) + (x.fundo ? ' · ' + U.esc(x.fundo) : '')], ['Fecha de firma', U.fecha(x.fecha) + ' · ' + U.esc(x.medio || '')], ['Versión del texto', U.esc(x.version_texto || '')], ['Finalidades', U.esc(x.finalidades || 'Texto estándar')], ['Firmado', U.sn(x.firmado)], ['Revocado', U.si(x.revocado) ? 'Sí · ' + U.fecha(x.fecha_revocacion) : 'No'], ['Registrado por', U.esc(x.registrado_por || '')], ['Observaciones', U.esc(x.observaciones || '')]];
  },
  accionesDetalle: function (x, U) { return '<button type="button" class="bs-btn bs-btn-outline" onclick="imprimirFormato(' + U.num(x.id) + ')">🖨️ Formato con datos</button>' + (U.si(x.revocado) ? '' : '<button type="button" class="bs-btn bs-btn-outline" onclick="revocar(' + U.num(x.id) + ')">Revocar</button>'); },
  extras: [{ id: 'formato', render: function () { return formatoHtml(null); } }]
};
function formatoHtml(x) {
  var T = window.GS_TEXTO_CONSENTIMIENTO, e = function (s) { return window.GS_U.esc(s); }, emp = x ? e(x.empresa) : '______________________';
  return '<div class="bs-flex bs-justify-between bs-items-center" style="margin-bottom:.8rem;flex-wrap:wrap;gap:.5rem"><span class="bs-text-sm bs-text-muted">Imprime este formato, haz firmar al trabajador y registra la firma arriba. Versión <b>' + T.version + '</b>.</span><button class="bs-btn bs-btn-gs" onclick="window.print()">🖨️ Imprimir</button></div>' +
    '<div class="gs-doc" id="docConsent"><h2>' + T.titulo + '</h2><div style="text-align:center;font-size:.8rem;color:#64748b;margin-bottom:1rem">Ley N.° 29733 · Reglamento D.S. 016-2024-JUS · Versión ' + T.version + '</div>' +
    '<p><b>Trabajador(a):</b> ' + (x ? e(x.nombre) : '________________________________________') + ' &nbsp; <b>DNI:</b> ' + (x ? e(x.dni) : '______________') + '<br><b>Empresa:</b> ' + emp + ' &nbsp; <b>Fundo / sede:</b> ' + (x ? e(x.fundo || x.sede || '') : '______________________') + '</p>' +
    T.parrafos.map(function (p) { return '<p>' + p.replace('{EMPRESA}', emp) + '</p>'; }).join('') +
    '<p>Piura, ____ de ______________ de 20____</p><div class="firma"><div>Firma del trabajador(a)<br>DNI ' + (x ? e(x.dni) : '______________') + '</div><div>Bienestar Social · Unifrutti Perú<br>' + (x ? e(x.registrado_por || '') : 'Nombre y firma') + '</div></div><p style="font-size:.75rem;color:#64748b;margin-top:1.2rem">Copia para el trabajador. El original se archiva en Bienestar Social y se registra en el Sistema Bienestar Social con el código ' + (x ? e(x.codigo) : 'CD-________') + '.</p></div>';
}
window.imprimirFormato = function (id) { var x = window.GS_DATA().find(function (r) { return Number(r.id) === Number(id); }); if (!x) return; cerrarDet(); document.querySelector('#tabs button[data-t="formato"]').click(); document.getElementById('p-formato').innerHTML = formatoHtml(x); };
window.revocar = async function (id) { var m = await appPrompt('Motivo de la revocación indicado por el trabajador:'); if (!m) return; window.gsActualizar(id, { revocado: 'SI', observaciones: 'Revocación: ' + m }, 'Consentimiento revocado.'); };
