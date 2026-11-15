/* Bienestar Social · modulos/adolescentes.html · _BS_GESTION_SOCIAL_V6 (15-nov-2026)
   Adolescentes autorizados (14–17 años) — Código de los Niños y Adolescentes (Ley 27337) art. 48–68 · D.S. 003-2010-MIMDES (trabajos peligrosos)
   · Convenio OIT 138/182. Reglas: autorización del MTPE (régimen dependiente), edad mínima 14 (agrícola no industrial 15 con excepción),
   jornada 15–17 años máx. 6 h/día y 36 h/semana (12–14: 4 h/día, 24 h/sem), sin trabajo nocturno, sin labores peligrosas (agroquímicos, carga, maquinaria),
   examen médico gratuito, continuidad escolar. Tabla: bs_gs_adolescentes. Permiso: gs_adolescentes. */
window.GS_CFG = {
  permiso: 'gs_adolescentes', clave: 'bs_gs_adolescentes', titulo: 'Adolescentes autorizados', etiqueta: 'Registro', tituloNuevo: 'Registrar adolescente',
  buscarEn: ['codigo', 'dni', 'nombre', 'fundo', 'autorizacion_mtpe', 'apoderado'],
  campos: [
    { seccion: '1 · ADOLESCENTE' },
    { id: 'dni', label: 'DNI', tipo: 'dni', req: true },
    { id: 'nombre', label: 'Nombre completo', req: true, span: 2, upper: true },
    { id: 'fecha_nacimiento', label: 'Fecha de nacimiento', tipo: 'date', req: true, hint: 'La edad la calcula el sistema.' },
    { id: 'empresa', label: 'Empresa', tipo: 'select', opciones: ['RAPEL', 'VERFRUT', 'OLMOS'], vacio: '—', req: true },
    { id: 'sede', label: 'Sede', tipo: 'select', opciones: ['PIURA', 'OLMOS'], defecto: 'PIURA' },
    { id: 'fundo', label: 'Fundo / sector', lista: 'dlFundos' },
    { id: 'cargo', label: 'Labor asignada', req: true, placeholder: 'Ej.: selección en sombra, empaque liviano' },
    { id: 'fecha_ingreso', label: 'Fecha de ingreso', tipo: 'date', req: true },
    { seccion: '2 · AUTORIZACIÓN Y CONDICIONES' },
    { id: 'autorizacion_mtpe', label: 'N.° de autorización MTPE', req: true, placeholder: 'Registro de adolescente trabajador' },
    { id: 'fecha_autorizacion', label: 'Fecha de autorización', tipo: 'date', req: true },
    { id: 'vigencia_autorizacion', label: 'Vigente hasta', tipo: 'date', req: true },
    { id: 'horario', label: 'Horario', placeholder: 'Ej.: 7:00–13:00 L–S', req: true },
    { id: 'horas_semana', label: 'Horas por semana', tipo: 'number', min: 0, max: 48, req: true, hint: 'Máx. 36 h (15–17 años) · 24 h (12–14). Nunca de noche.' },
    { id: 'labor_permitida', label: 'Labor NO peligrosa (sin agroquímicos, carga ni maquinaria)', tipo: 'si_no', defecto: 'SI' },
    { id: 'examen_medico', label: 'Examen médico (fecha)', tipo: 'date', hint: 'Gratuito, previo al ingreso y anual.' },
    { id: 'estudia', label: '¿Estudia?', tipo: 'si_no', defecto: 'SI' },
    { id: 'centro_estudios', label: 'Centro de estudios / turno' },
    { seccion: '3 · APODERADO Y ESTADO' },
    { id: 'apoderado', label: 'Padre / madre / apoderado', req: true },
    { id: 'contacto_apoderado', label: 'Contacto del apoderado' },
    { id: 'estado', label: 'Estado', tipo: 'select', opciones: ['Activo', 'Cesado'], defecto: 'Activo' },
    { id: 'fecha_cese', label: 'Fecha de cese', tipo: 'date', hint: 'Se completa sola al marcar Cesado.' },
    { id: 'observaciones', label: 'Observaciones', tipo: 'textarea', span: 2 }
  ],
  columnas: [
    { label: 'Código', render: function (r, U) { return '<b>' + U.esc(r.codigo) + '</b>'; } },
    { label: 'Adolescente', render: function (r, U) { return '<b>' + U.esc(r.nombre) + '</b><br><span class="bs-text-xs bs-text-muted">DNI ' + U.esc(r.dni) + ' · ' + edadTxt(r, U) + '</span>'; } },
    { label: 'Empresa · fundo', render: function (r, U) { return U.esc(r.empresa) + '<br><span class="bs-text-xs bs-text-muted">' + U.esc(r.fundo || '') + (r.cargo ? ' · ' + U.esc(r.cargo) : '') + '</span>'; } },
    { label: 'Autorización MTPE', render: function (r, U) { var v = U.ymd(r.vigencia_autorizacion), d = U.dias(U.hoy(), v); return U.esc(r.autorizacion_mtpe || '—') + '<br>' + (!v ? U.pill('sin vigencia', 'rojo') : d < 0 ? U.pill('vencida ' + U.fecha(v), 'rojo') : d <= 30 ? U.pill('vence en ' + d + ' d', 'ambar') : U.pill('hasta ' + U.fecha(v), 'ok')); } },
    { label: 'Jornada', render: function (r, U) { var h = U.num(r.horas_semana), lim = limite(r, U); return U.esc(r.horario || '') + '<br>' + (h > lim ? U.pill(h + ' h/sem > ' + lim, 'rojo') : U.pill(h + ' h/sem', 'ok')); } },
    { label: 'Labor segura', render: function (r, U) { return U.sn(r.labor_permitida); } },
    { label: 'Estudia', render: function (r, U) { return U.sn(r.estudia); } },
    { label: 'Estado', render: function (r, U) { return U.pill(r.estado || 'Activo', r.estado === 'Cesado' ? 'gris' : 'azul'); } }
  ],
  kpis: function (V, U) {
    var act = V.filter(function (r) { return r.estado !== 'Cesado'; }), prob = act.filter(function (r) { return problemas(r, U).length; }).length, sinAut = act.filter(function (r) { var v = U.ymd(r.vigencia_autorizacion); return !v || v < U.hoy(); }).length, may = act.filter(function (r) { return U.num(r.edad) >= 18; }).length;
    return [{ l: 'Adolescentes activos', v: act.length, s: V.length + ' registrados en total', c: '#0a2463' }, { l: 'Con observaciones', v: prob, s: 'incumplen alguna condición legal', c: prob ? '#b91c1c' : '#166534' }, { l: 'Autorización vencida / sin', v: sinAut, s: 'no pueden trabajar hasta regularizar', c: sinAut ? '#b91c1c' : '#166534' }, { l: 'Ya cumplieron 18', v: may, s: 'pasar a contrato de adulto', c: may ? '#b45309' : '#166534' }];
  },
  alertas: function (V, U) { var A = []; V.filter(function (r) { return r.estado !== 'Cesado'; }).forEach(function (r) { problemas(r, U).forEach(function (p) { A.push({ n: p.n, t: p.t, r: r }); }); }); return A; },
  validar: function (d, U) {
    var fn = U.ymd(d.fecha_nacimiento); if (!fn) return 'Indica la fecha de nacimiento.';
    var edad = Math.floor(U.dias(fn, d.fecha_ingreso || U.hoy()) / 365.25);
    if (edad < 14) return 'Tiene ' + edad + ' años al ingreso: la edad mínima para trabajar es 14 (CNA art. 51). No se puede registrar.';
    if (edad >= 18) return 'Tiene ' + edad + ' años: es mayor de edad, no corresponde a este registro.';
    if (U.num(d.horas_semana) > (edad >= 15 ? 36 : 24)) return 'Las horas semanales superan el máximo legal (' + (edad >= 15 ? 36 : 24) + ' h). Corrige el horario antes de registrar.';
    if (d.labor_permitida !== 'SI') return 'No se puede registrar una labor peligrosa para un adolescente (D.S. 003-2010-MIMDES). Cambia la labor asignada.';
    if (/noche|nocturn|19:|20:|21:|22:|23:/i.test(d.horario)) return 'El horario parece nocturno: prohibido para adolescentes (CNA art. 57).';
    return null;
  },
  detalle: function (x, U) { return [['Adolescente', U.esc(x.nombre) + ' · DNI ' + U.esc(x.dni) + ' · ' + edadTxt(x, U) + ' (nac. ' + U.fecha(x.fecha_nacimiento) + ')'], ['Empresa · fundo · labor', U.esc(x.empresa) + ' · ' + U.esc(x.fundo || '') + ' · ' + U.esc(x.cargo || '')], ['Ingreso', U.fecha(x.fecha_ingreso)], ['Autorización MTPE', U.esc(x.autorizacion_mtpe || '—') + ' · ' + U.fecha(x.fecha_autorizacion) + ' → ' + U.fecha(x.vigencia_autorizacion)], ['Horario', U.esc(x.horario || '') + ' · ' + U.num(x.horas_semana) + ' h/semana (máx. ' + limite(x, U) + ')'], ['Labor no peligrosa', U.sn(x.labor_permitida)], ['Examen médico', U.fecha(x.examen_medico)], ['Estudia', U.sn(x.estudia) + (x.centro_estudios ? ' · ' + U.esc(x.centro_estudios) : '')], ['Apoderado', U.esc(x.apoderado || '') + (x.contacto_apoderado ? ' · ' + U.esc(x.contacto_apoderado) : '')], ['Estado', U.esc(x.estado || '') + (U.ymd(x.fecha_cese) ? ' · cese ' + U.fecha(x.fecha_cese) : '')], ['Observaciones', U.esc(x.observaciones || '')]]; },
  cabeceraDetalle: function (x, U) { var P = problemas(x, U); return P.length ? '<div style="display:flex;flex-direction:column;gap:.4rem;margin-bottom:.8rem">' + P.map(function (p) { return '<div class="gs-alert ' + p.n + '"><span class="bs-text-sm">' + p.t + '</span></div>'; }).join('') + '</div>' : '<div class="gs-alert info" style="margin-bottom:.8rem"><span class="bs-text-sm">Cumple todas las condiciones registradas.</span></div>'; }
};
function edadTxt(r, U) { return (r.edad != null && r.edad !== '' ? U.num(r.edad) : '?') + ' años'; }
function limite(r, U) { return U.num(r.edad) >= 15 ? 36 : 24; }
function problemas(r, U) {
  var P = [], v = U.ymd(r.vigencia_autorizacion), h = U.hoy();
  if (U.num(r.edad) >= 18) P.push({ n: 'ambar', t: 'Cumplió 18 años: cerrar este registro y pasarlo a contrato de adulto' });
  if (!r.autorizacion_mtpe || !v) P.push({ n: 'rojo', t: 'Sin autorización del MTPE registrada (CNA art. 50): no puede trabajar' });
  else if (v < h) P.push({ n: 'rojo', t: 'Autorización MTPE vencida el ' + U.fecha(v) });
  else if (U.dias(h, v) <= 30) P.push({ n: 'ambar', t: 'Autorización MTPE vence en ' + U.dias(h, v) + ' días' });
  if (U.num(r.horas_semana) > limite(r, U)) P.push({ n: 'rojo', t: 'Jornada de ' + U.num(r.horas_semana) + ' h/sem supera el máximo legal de ' + limite(r, U) + ' h' });
  if (!U.si(r.labor_permitida)) P.push({ n: 'rojo', t: 'Labor marcada como peligrosa (D.S. 003-2010-MIMDES)' });
  if (!U.ymd(r.examen_medico)) P.push({ n: 'ambar', t: 'Sin examen médico registrado (CNA art. 55)' }); else if (U.dias(r.examen_medico) > 365) P.push({ n: 'ambar', t: 'Examen médico con más de un año' });
  if (!U.si(r.estudia)) P.push({ n: 'ambar', t: 'No estudia: el trabajo no debe impedir la escolaridad (CNA art. 61); documentar' });
  return P;
}
