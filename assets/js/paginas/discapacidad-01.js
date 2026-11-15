/* Bienestar Social · modulos/discapacidad.html · _BS_GESTION_SOCIAL_V6 (15-nov-2026)
   Personas con discapacidad — Ley 29973 art. 49 (cuota de empleo: 3 % en empleadores privados con más de 50 trabajadores) y art. 50 (ajustes razonables)
   · D.S. 002-2014-MIMP · R.M. 107-2015-TR (fiscalización anual, se verifica en enero con el promedio anual de planilla).
   La cuota se calcula con el padrón vigente de Supabase (GET bs/padron). Tabla: bs_gs_discapacidad. Permiso: gs_discapacidad. Dato sensible. */
var PADRON = null;
window.GS_CFG = {
  permiso: 'gs_discapacidad', clave: 'bs_gs_discapacidad', titulo: 'Discapacidad y cuota 3 %', etiqueta: 'Registro', tituloNuevo: 'Registrar trabajador con discapacidad',
  buscarEn: ['codigo', 'dni', 'nombre', 'fundo', 'certificado_conadis', 'tipo_discapacidad'],
  alCargar: async function () {
    try { var u = JSON.parse(localStorage.getItem('bienestarSocialAuth') || '{}'); var r = await fetch((window.BS_EDGE_URL || 'https://exdjzbfinppzatjyimxn.supabase.co/functions/v1/api') + '/bs/padron', { headers: { Authorization: 'Bearer ' + (u.rl_token || '') } }); PADRON = r.ok ? await r.json() : null; } catch (e) { PADRON = null; }
  },
  campos: [
    { seccion: '1 · TRABAJADOR' },
    { id: 'dni', label: 'DNI', tipo: 'dni', req: true },
    { id: 'nombre', label: 'Nombre completo', req: true, span: 2, upper: true },
    { id: 'empresa', label: 'Empresa', tipo: 'select', opciones: ['RAPEL', 'VERFRUT', 'OLMOS'], vacio: '—', req: true },
    { id: 'fundo', label: 'Fundo / sector', lista: 'dlFundos' },
    { id: 'cargo', label: 'Cargo / labor' },
    { id: 'sede', label: 'Sede', tipo: 'select', opciones: ['PIURA', 'OLMOS'], defecto: 'PIURA' },
    { seccion: '2 · CERTIFICACIÓN (CONADIS)' },
    { id: 'tipo_discapacidad', label: 'Tipo de discapacidad', tipo: 'select', opciones: ['Física / motora', 'Visual', 'Auditiva', 'Intelectual', 'Mental / psicosocial', 'Múltiple', 'Otra'], vacio: '—', req: true },
    { id: 'grado', label: 'Grado', tipo: 'select', opciones: ['Leve', 'Moderado', 'Severo'], vacio: '—' },
    { id: 'certificado_conadis', label: 'N.° de certificado / carné CONADIS', req: true, hint: 'Solo cuentan para la cuota los inscritos en el registro del CONADIS.' },
    { id: 'vigencia_certificado', label: 'Vigencia del certificado', tipo: 'date', hint: 'Vacío si es permanente.' },
    { seccion: '3 · AJUSTES RAZONABLES (art. 50)' },
    { id: 'ajustes', label: 'Ajustes otorgados', tipo: 'textarea', span: 2, placeholder: 'Horario, puesto, herramientas, accesibilidad, transporte… Si no requiere, indicarlo.' },
    { id: 'fecha_ajustes', label: 'Fecha de los ajustes', tipo: 'date' },
    { seccion: '4 · ESTADO' },
    { id: 'estado', label: 'Estado', tipo: 'select', opciones: ['Activo', 'Cesado'], defecto: 'Activo' },
    { id: 'fecha_cese', label: 'Fecha de cese', tipo: 'date', hint: 'Se completa sola al marcar Cesado.' },
    { id: 'observaciones', label: 'Observaciones', tipo: 'textarea' }
  ],
  columnas: [
    { label: 'Código', render: function (r, U) { return '<b>' + U.esc(r.codigo) + '</b>'; } },
    { label: 'Trabajador', render: function (r, U) { return '<b>' + U.esc(r.nombre) + '</b><br><span class="bs-text-xs bs-text-muted">DNI ' + U.esc(r.dni) + ' · ' + U.esc(r.empresa) + (r.fundo ? ' · ' + U.esc(r.fundo) : '') + '</span>'; } },
    { label: 'Discapacidad', render: function (r, U) { return U.esc(r.tipo_discapacidad || '') + (r.grado ? '<br><span class="bs-text-xs bs-text-muted">' + U.esc(r.grado) + '</span>' : ''); } },
    { label: 'CONADIS', render: function (r, U) { var v = U.ymd(r.vigencia_certificado); return U.esc(r.certificado_conadis || '—') + '<br>' + (!r.certificado_conadis ? U.pill('sin certificado', 'rojo') : v && v < U.hoy() ? U.pill('vencido ' + U.fecha(v), 'rojo') : v ? U.pill('hasta ' + U.fecha(v), 'ok') : U.pill('permanente', 'ok')); } },
    { label: 'Ajustes', render: function (r, U) { return r.ajustes ? '<span class="bs-text-sm">' + U.esc(String(r.ajustes).slice(0, 60)) + (String(r.ajustes).length > 60 ? '…' : '') + '</span>' : U.pill('sin registrar', 'ambar'); } },
    { label: 'Estado', render: function (r, U) { return U.pill(r.estado || 'Activo', r.estado === 'Cesado' ? 'gris' : 'azul'); } }
  ],
  kpis: function (V, U) {
    var act = V.filter(function (r) { return r.estado !== 'Cesado' && r.certificado_conadis; }), c = cuota(act, U), tot = c.reduce(function (s, e) { return s + e.pcd; }, 0), plan = c.reduce(function (s, e) { return s + e.planilla; }, 0), falt = c.reduce(function (s, e) { return s + Math.max(0, e.faltan); }, 0);
    return [{ l: 'Trabajadores con discapacidad', v: act.length, s: 'activos con certificado CONADIS', c: '#1d4ed8' }, { l: 'Planilla vigente (Supabase)', v: plan || '—', s: PADRON ? 'padrón ' + c.map(function (e) { return e.empresa + ' ' + e.planilla; }).join(' · ') : 'no se pudo leer el padrón', c: '#0a2463' }, { l: 'Cuota global', v: plan ? (Math.round(tot / plan * 1000) / 10) + ' %' : '—', s: 'meta 3 % (Ley 29973 art. 49)', c: plan && tot / plan >= 0.03 ? '#166534' : '#b91c1c' }, { l: 'Faltan para cumplir', v: falt, s: 'contrataciones con certificado CONADIS', c: falt ? '#b91c1c' : '#166534' }];
  },
  alertas: function (V, U) {
    var A = [];
    cuota(V.filter(function (r) { return r.estado !== 'Cesado' && r.certificado_conadis; }), U).forEach(function (e) { if (e.planilla > 50 && e.faltan > 0) A.push({ n: 'rojo', t: e.empresa + ': ' + e.pcd + ' de ' + e.planilla + ' (' + e.pct + ' %) — faltan ' + e.faltan + ' para el 3 % (fiscalización SUNAFIL en enero)', r: { codigo: 'Cuota', empresa: e.empresa } }); });
    V.filter(function (r) { return r.estado !== 'Cesado'; }).forEach(function (r) { var v = U.ymd(r.vigencia_certificado); if (!r.certificado_conadis) A.push({ n: 'rojo', t: 'Sin certificado CONADIS: no cuenta para la cuota', r: r }); else if (v && v < U.hoy()) A.push({ n: 'rojo', t: 'Certificado CONADIS vencido el ' + U.fecha(v), r: r }); else if (v && U.dias(U.hoy(), v) <= 60) A.push({ n: 'ambar', t: 'Certificado CONADIS vence en ' + U.dias(U.hoy(), v) + ' días', r: r }); if (!r.ajustes) A.push({ n: 'ambar', t: 'Sin ajustes razonables documentados (art. 50): registrar aunque sea "no requiere"', r: r }); });
    return A;
  },
  detalle: function (x, U) { return [['Trabajador', U.esc(x.nombre) + ' · DNI ' + U.esc(x.dni) + ' · ' + U.esc(x.empresa) + (x.fundo ? ' · ' + U.esc(x.fundo) : '') + (x.cargo ? ' · ' + U.esc(x.cargo) : '')], ['Discapacidad', U.esc(x.tipo_discapacidad || '') + (x.grado ? ' · ' + U.esc(x.grado) : '')], ['Certificado CONADIS', U.esc(x.certificado_conadis || '—') + (U.ymd(x.vigencia_certificado) ? ' · vigente hasta ' + U.fecha(x.vigencia_certificado) : ' · permanente')], ['Ajustes razonables', U.esc(x.ajustes || '—') + (U.ymd(x.fecha_ajustes) ? ' · ' + U.fecha(x.fecha_ajustes) : '')], ['Estado', U.esc(x.estado || '') + (U.ymd(x.fecha_cese) ? ' · cese ' + U.fecha(x.fecha_cese) : '')], ['Observaciones', U.esc(x.observaciones || '')]]; },
  extras: [{ id: 'cuota', render: function (V, U) {
    var C = cuota(V.filter(function (r) { return r.estado !== 'Cesado' && r.certificado_conadis; }), U);
    return (PADRON ? '' : '<div class="bs-alert bs-alert-danger" style="margin-bottom:.8rem">No se pudo leer el padrón de Supabase; la planilla aparece en 0.</div>') +
      '<div class="bs-table-wrap"><table class="bs-table"><thead><tr><th>Empresa</th><th>Planilla vigente</th><th>Con discapacidad (CONADIS)</th><th>Cuota actual</th><th></th><th>Meta 3 %</th><th>Faltan</th><th>Obligación</th></tr></thead><tbody>' +
      C.map(function (e) { return '<tr><td><b>' + e.empresa + '</b></td><td>' + e.planilla + '</td><td>' + e.pcd + '</td><td><b>' + e.pct + ' %</b></td><td><div class="gs-barra"><i style="width:' + Math.min(100, e.pct / 3 * 100) + '%;background:' + (e.pct >= 3 ? '#16a34a' : '#dc2626') + '"></i></div></td><td>' + e.meta + '</td><td>' + (e.faltan > 0 ? '<b style="color:#b91c1c">' + e.faltan + '</b>' : '✔') + '</td><td class="bs-text-sm">' + (e.planilla > 50 ? 'Sí (más de 50 trabajadores)' : 'No aplica (≤ 50)') + '</td></tr>'; }).join('') +
      '</tbody></table></div><div class="bs-text-xs bs-text-muted" style="margin-top:.6rem;line-height:1.5">Planilla = trabajadores vigentes hoy en el padrón de Supabase. SUNAFIL calcula la cuota sobre el <b>promedio anual</b> de la planilla (R.M. 107-2015-TR): en campaña alta la meta en personas sube. Si no se alcanza la cuota, la empresa debe acreditar que convocó públicamente y no hubo postulantes idóneos, o que no hubo vacantes (art. 56 del reglamento).</div>';
  } }]
};
function cuota(act, U) {
  var emp = ['RAPEL', 'VERFRUT'], out = [];
  emp.forEach(function (e) { var plan = PADRON && PADRON.porEmpresa && PADRON.porEmpresa[e] ? U.num(PADRON.porEmpresa[e].vigentes) : 0, pcd = act.filter(function (r) { return String(r.empresa).toUpperCase() === e; }).length, meta = Math.ceil(plan * 0.03); out.push({ empresa: e, planilla: plan, pcd: pcd, pct: plan ? Math.round(pcd / plan * 1000) / 10 : 0, meta: meta, faltan: Math.max(0, meta - pcd) }); });
  return out;
}
