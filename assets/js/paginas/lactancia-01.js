/* Bienestar Social · modulos/lactancia.html · _BS_LACTANCIA_V1 (16-nov-2026)
   Permiso de lactancia ACUMULADO — Ley 27240 (mod. Leyes 27591 y 28731): 1 hora diaria (2 si parto múltiple) desde el retorno
   hasta que el hijo cumple 1 año. La empresa la acumula en días de descanso con acuerdo escrito de la trabajadora.
   Jornadas por temporada en bs_gs_lactancia_horarios (editables aquí). Motor compartido con el servidor: assets/js/bs-lactancia-motor.js.
   Tablas: bs_gs_lactancia · bs_gs_lactancia_horarios. Permiso: gs_lactancia. Aprueban: Joel y quien tenga el módulo. */
var LAC = { horarios: [], feriados: ['2026-01-01', '2026-04-02', '2026-04-03', '2026-05-01', '2026-06-07', '2026-06-29', '2026-07-23', '2026-07-28', '2026-07-29', '2026-08-06', '2026-08-30', '2026-10-08', '2026-11-01', '2026-12-08', '2026-12-09', '2026-12-25',
  '2027-01-01', '2027-03-25', '2027-03-26', '2027-05-01', '2027-06-07', '2027-06-29', '2027-07-23', '2027-07-28', '2027-07-29', '2027-08-06', '2027-08-30', '2027-10-08', '2027-11-01', '2027-12-08', '2027-12-09', '2027-12-25'], calc: {} };
function calcDe(r, U) { var k = String(r.id) + '|' + (r.updated_at || '') + '|' + U.hoy(); if (!LAC.calc[k]) LAC.calc[k] = BSLactancia.calcular(r, { horarios: LAC.horarios, feriados: LAC.feriados, hoy: U.hoy() }); return LAC.calc[k]; }
function fmtH(h) { return (Math.round(h * 100) / 100) + ' h'; }
function desc(r) { return BSLactancia.lista(r.descansos); }
window.GS_CFG = {
  permiso: 'gs_lactancia', clave: 'bs_gs_lactancia', titulo: 'Lactancia · acumulación de horas', etiqueta: 'Registro', tituloNuevo: 'Registrar madre en lactancia',
  buscarEn: ['codigo', 'dni', 'nombre', 'fundo', 'supervisor'],
  campos: [
    { seccion: '1 · TRABAJADORA' },
    { id: 'dni', label: 'DNI', tipo: 'dni', req: true },
    { id: 'nombre', label: 'Nombre completo', req: true, span: 2, upper: true },
    { id: 'empresa', label: 'Empresa', tipo: 'select', opciones: ['RAPEL', 'VERFRUT', 'OLMOS'], vacio: '—', req: true },
    { id: 'sede', label: 'Sede', tipo: 'select', opciones: ['PIURA', 'OLMOS'], defecto: 'PIURA' },
    { id: 'fundo', label: 'Fundo / sector', lista: 'dlFundos' },
    { id: 'cargo', label: 'Cargo / labor' },
    { id: 'supervisor', label: 'Supervisor responsable', hint: 'Recibe el aviso del descanso.' },
    { seccion: '2 · LACTANCIA' },
    { id: 'fecha_parto', label: 'Fecha de parto', tipo: 'date', req: true, hint: 'El permiso dura hasta el día anterior al primer cumpleaños.' },
    { id: 'parto_multiple', label: 'Parto múltiple (2 h diarias)', tipo: 'si_no', defecto: 'NO' },
    { id: 'fecha_retorno', label: 'Fecha de retorno al trabajo', tipo: 'date', req: true, hint: 'Desde aquí acumula 1 h por día laborable.' },
    { id: 'acuerdo_firmado', label: 'Acuerdo escrito de acumulación firmado', tipo: 'si_no', defecto: 'NO', hint: 'Obligatorio para acumular en días (la ley la da por hora diaria).' },
    { id: 'fecha_acuerdo', label: 'Fecha del acuerdo', tipo: 'date' },
    { id: 'estado', label: 'Estado', tipo: 'select', opciones: ['Activa', 'Cerrada'], defecto: 'Activa' },
    { id: 'observaciones', label: 'Observaciones', tipo: 'textarea', span: 2 }
  ],
  columnas: [
    { label: 'Código', render: function (r, U) { return '<b>' + U.esc(r.codigo) + '</b>'; } },
    { label: 'Trabajadora', render: function (r, U) { return '<b>' + U.esc(r.nombre) + '</b><br><span class="bs-text-xs bs-text-muted">DNI ' + U.esc(r.dni) + ' · ' + U.esc(r.empresa) + (r.fundo ? ' · ' + U.esc(r.fundo) : '') + '</span>'; } },
    { label: 'Lactancia', render: function (r, U) { var C = calcDe(r, U); return 'Parto ' + U.fecha(r.fecha_parto) + (U.si(r.parto_multiple) ? ' · <b>múltiple</b>' : '') + '<br><span class="bs-text-xs bs-text-muted">Retorno ' + U.fecha(r.fecha_retorno) + ' · hasta ' + U.fecha(C.fin) + (C.diasRestantes != null && C.diasRestantes >= 0 ? ' (' + C.diasRestantes + ' d)' : '') + '</span>'; } },
    { label: 'Saldo', render: function (r, U) { var C = calcDe(r, U); if (C.errores.length) return U.pill('revisar', 'rojo'); return '<b>' + fmtH(C.saldo) + '</b><br><span class="bs-text-xs bs-text-muted">' + C.diasDisponibles + ' día(s) · tomados ' + C.diasTomados + '</span>'; } },
    { label: 'Próximo descanso', render: function (r, U) { var C = calcDe(r, U); if (!C.proximo) return '<span class="bs-text-muted">—</span>'; return '<b>' + U.fecha(C.proximo.fecha) + '</b> ' + U.pill(C.proximo.estado === 'propuesto' ? 'por programar' : C.proximo.estado, C.proximo.estado === 'propuesto' ? 'ambar' : 'azul'); } },
    { label: 'Acuerdo', render: function (r, U) { return U.sn(r.acuerdo_firmado); } },
    { label: 'Estado', render: function (r, U) { var C = calcDe(r, U); var al = C.alertas.filter(function (a) { return a.n === 'rojo'; }).length; return U.pill(r.estado || 'Activa', r.estado === 'Cerrada' ? 'gris' : (al ? 'rojo' : 'azul')); } }
  ],
  kpis: function (V, U) {
    var act = V.filter(function (r) { return r.estado !== 'Cerrada'; }), prox = 0, sinAc = 0, horas = 0;
    act.forEach(function (r) { var C = calcDe(r, U); horas += C.saldo; if (C.alertas.some(function (a) { return a.tipo === 'proximo' || a.tipo === 'hoy'; })) prox++; if (!U.si(r.acuerdo_firmado)) sinAc++; });
    return [{ l: 'Madres en lactancia', v: act.length, s: V.length + ' registradas en total', c: '#0a2463' }, { l: 'Descansos esta semana', v: prox, s: 'les corresponde en ≤ 3 días hábiles', c: prox ? '#b45309' : '#166534' },
      { l: 'Horas acumuladas', v: Math.round(horas * 10) / 10, s: 'saldo total por descansar', c: '#9d174d' }, { l: 'Sin acuerdo firmado', v: sinAc, s: 'no se puede acumular sin acuerdo', c: sinAc ? '#b91c1c' : '#166534' }];
  },
  alertas: function (V, U) { var A = []; V.filter(function (r) { return r.estado !== 'Cerrada'; }).forEach(function (r) { var C = calcDe(r, U); C.alertas.forEach(function (a) { A.push({ n: a.n, t: a.t, r: r }); }); if (!U.si(r.acuerdo_firmado)) A.push({ n: 'ambar', t: 'Falta el acuerdo escrito de acumulación firmado por la trabajadora', r: r }); }); return A; },
  validar: function (d, U) {
    if (!U.ymd(d.fecha_parto)) return 'Indica la fecha de parto.';
    if (!U.ymd(d.fecha_retorno)) return 'Indica la fecha de retorno al trabajo.';
    if (d.fecha_retorno < d.fecha_parto) return 'El retorno no puede ser antes del parto.';
    var fin = BSLactancia.sumaDias(BSLactancia.sumaAnios(U.ymd(d.fecha_parto), 1), -1);
    if (d.fecha_retorno > fin) return 'El retorno (' + U.fecha(d.fecha_retorno) + ') es posterior al fin de la lactancia (' + U.fecha(fin) + '): ya no corresponde el permiso.';
    return null;
  },
  detalle: function (x, U) {
    var C = calcDe(x, U);
    return [['Trabajadora', U.esc(x.nombre) + ' · DNI ' + U.esc(x.dni) + ' · ' + U.esc(x.empresa) + (x.fundo ? ' · ' + U.esc(x.fundo) : '') + (x.cargo ? ' · ' + U.esc(x.cargo) : '')],
      ['Supervisor', U.esc(x.supervisor || '—')],
      ['Parto · retorno · fin', U.fecha(x.fecha_parto) + (U.si(x.parto_multiple) ? ' (múltiple: 2 h/día)' : ' (1 h/día)') + ' · retorno ' + U.fecha(x.fecha_retorno) + ' · fin ' + U.fecha(C.fin) + (C.diasRestantes != null ? ' (' + C.diasRestantes + ' días)' : '')],
      ['Acuerdo escrito', U.sn(x.acuerdo_firmado) + (U.ymd(x.fecha_acuerdo) ? ' · ' + U.fecha(x.fecha_acuerdo) : '')],
      ['Horas', 'ganadas <b>' + fmtH(C.horasGanadas) + '</b> · descansadas <b>' + fmtH(C.horasDescansadas) + '</b> · <b style="color:#9d174d">saldo ' + fmtH(C.saldo) + '</b> (' + C.diasDisponibles + ' día(s) de ' + fmtH(C.jornadaProxima) + ')'],
      ['Descansos', C.descansos.length ? C.descansos.map(function (d) { return U.fecha(d.fecha) + ' ' + U.pill(d.vencido ? 'no registrado' : d.estado, d.vencido ? 'rojo' : (/tomad/i.test(d.estado) ? 'ok' : 'azul')) + (d.horas ? ' ' + fmtH(d.horas) : '') + (d.nota ? ' · ' + U.esc(d.nota) : ''); }).join('<br>') : '—'],
      ['Proyección', C.proyeccion.length ? C.proyeccion.slice(0, 8).map(function (p) { return U.fecha(p.fecha) + ' (' + fmtH(p.horas) + ')'; }).join(' · ') + (C.proyeccion.length > 8 ? ' …' : '') : '—'],
      ['Ausencias', BSLactancia.lista(x.ausencias).length ? BSLactancia.lista(x.ausencias).map(function (a) { return U.fecha(a.desde) + '→' + U.fecha(a.hasta || a.desde) + (a.motivo ? ' ' + U.esc(a.motivo) : ''); }).join('<br>') : '—'],
      ['Estado', U.esc(x.estado || 'Activa') + (U.ymd(x.fecha_cierre) ? ' · cierre ' + U.fecha(x.fecha_cierre) : '')],
      ['Observaciones', U.esc(x.observaciones || '')]];
  },
  cabeceraDetalle: function (x, U) { var C = calcDe(x, U), P = C.alertas; return (C.errores.length ? '<div class="gs-alert rojo">' + C.errores.map(U.esc).join('<br>') + '</div>' : '') + (P.length ? '<div style="display:flex;flex-direction:column;gap:.4rem;margin-bottom:.8rem">' + P.map(function (p) { return '<div class="gs-alert ' + p.n + '">' + U.esc(p.t) + '</div>'; }).join('') + '</div>' : ''); },
  accionesDetalle: function (x, U) {
    if (x.estado === 'Cerrada') return '';
    var C = calcDe(x, U), prox = C.proximo;
    return '<button type="button" class="bs-btn bs-btn-outline" onclick="lacProgramar(' + U.num(x.id) + ')">📅 Programar descanso</button>' +
      '<button type="button" class="bs-btn bs-btn-outline" onclick="lacTomado(' + U.num(x.id) + ')">✅ Registrar tomado</button>' +
      '<button type="button" class="bs-btn bs-btn-outline" onclick="lacAusencia(' + U.num(x.id) + ')">🚫 Ausencia</button>' +
      '<button type="button" class="bs-btn bs-btn-gs" onclick="lacConstancia(' + U.num(x.id) + ')">🖨️ Constancia</button>';
  },
  extras: [
    { id: 'calendario', render: function (V, U) {
      var act = V.filter(function (r) { return r.estado !== 'Cerrada'; }); if (!act.length) return '<div class="bs-text-muted" style="padding:1rem">Sin madres en lactancia activas.</div>';
      var filas = [];
      act.forEach(function (r) { var C = calcDe(r, U); C.descansos.filter(function (d) { return d.fecha >= U.hoy() || d.vencido; }).forEach(function (d) { filas.push({ f: d.fecha, r: r, t: d.vencido ? 'no registrado' : d.estado, h: d.horas }); }); C.proyeccion.slice(0, 6).forEach(function (p) { filas.push({ f: p.fecha, r: r, t: 'propuesto', h: p.horas }); }); });
      filas.sort(function (a, b) { return a.f < b.f ? -1 : 1; });
      return '<div class="bs-text-sm bs-text-muted" style="margin:.4rem 0 .8rem">Próximos descansos por acumulación (programados y propuestos por el sistema) · hoy ' + U.fecha(U.hoy()) + '</div><table class="bs-table"><thead><tr><th>Fecha</th><th>Trabajadora</th><th>Empresa · fundo</th><th>Supervisor</th><th>Horas</th><th>Estado</th><th></th></tr></thead><tbody>' +
        filas.slice(0, 120).map(function (x) { return '<tr><td><b>' + U.fecha(x.f) + '</b></td><td>' + U.esc(x.r.nombre) + '<br><span class="bs-text-xs bs-text-muted">' + U.esc(x.r.codigo) + '</span></td><td>' + U.esc(x.r.empresa) + ' · ' + U.esc(x.r.fundo || '') + '</td><td>' + U.esc(x.r.supervisor || '') + '</td><td>' + fmtH(x.h) + '</td><td>' + U.pill(x.t, x.t === 'propuesto' ? 'ambar' : x.t === 'no registrado' ? 'rojo' : /tomad/i.test(x.t) ? 'ok' : 'azul') + '</td><td><button class="bs-btn bs-btn-outline bs-btn-sm" onclick="verCaso(' + U.num(x.r.id) + ')">Ver</button></td></tr>'; }).join('') + '</tbody></table>';
    } },
    { id: 'horarios', render: function (V, U) {
      var H = LAC.horarios.length ? LAC.horarios : BSLactancia.HORARIOS_DEFECTO;
      return '<div class="bs-text-sm bs-text-muted" style="margin:.4rem 0 .8rem">Jornadas por temporada: definen cuántas horas vale un día de descanso. Pueden mantenerse o cambiar; los cambios aplican desde la fecha de vigencia que indiques.</div><table class="bs-table"><thead><tr><th>Nombre</th><th>Meses</th><th>Vigencia</th><th>L–V (h)</th><th>Sábado (h)</th><th>Detalle</th><th>Activo</th><th></th></tr></thead><tbody>' +
        H.map(function (h) { return '<tr><td><b>' + U.esc(h.nombre) + '</b></td><td>' + U.esc(h.meses || 'todos') + '</td><td>' + (U.ymd(h.desde_fecha) || U.ymd(h.hasta_fecha) ? U.fecha(h.desde_fecha) + ' → ' + U.fecha(h.hasta_fecha) : 'permanente') + '</td><td>' + U.num(h.lv_horas) + '</td><td>' + (U.num(h.sab_horas) || '—') + '</td><td>' + U.esc(h.detalle || '') + '</td><td>' + U.sn(h.activo === undefined ? 'SI' : h.activo) + '</td><td>' + (h.id ? '<button class="bs-btn bs-btn-outline bs-btn-sm" onclick="lacHorarioEditar(' + U.num(h.id) + ')">Editar</button>' : '<span class="bs-text-xs bs-text-muted">valores por defecto</span>') + '</td></tr>'; }).join('') +
        '</tbody></table><div style="margin-top:.8rem"><button class="bs-btn bs-btn-outline" onclick="lacHorarioNuevo()">＋ Nuevo horario</button></div>';
    } }
  ],
  alCargar: async function (DATA, U) {
    try { var r = await bsAccionSupabase('bs_gsListar', { clave: 'bs_gs_lactancia_horarios' }); LAC.horarios = (r && r.ok ? (r.items || []) : []).filter(function (h) { return !U.anulado(h); }); } catch (e) { LAC.horarios = []; }
    LAC.calc = {};
    var n = document.getElementById('nCalendario'); if (n) { var c = 0; DATA.forEach(function (r) { if (r.estado !== 'Cerrada' && !U.anulado(r)) { var C = calcDe(r, U); c += C.descansos.filter(function (d) { return d.fecha >= U.hoy(); }).length + Math.min(1, C.proyeccion.length); } }); n.textContent = c ? '(' + c + ')' : ''; }
  }
};
/* ── acciones ── */
function lacReg(id) { return (window.GS_DATA ? GS_DATA() : []).find(function (r) { return Number(r.id) === Number(id); }); }
async function lacGuardarDescansos(x, lista, msg) { await gsActualizar(x.id, { descansos: JSON.stringify(lista) }, msg); }
window.lacProgramar = async function (id) {
  var x = lacReg(id); if (!x) return; var U = GS_U, C = calcDe(x, U);
  var sug = C.proximo ? C.proximo.fecha : U.hoy();
  var f = await appPrompt('Fecha del descanso por lactancia (aaaa-mm-dd).\nSaldo: ' + fmtH(C.saldo) + ' · propuesto por el sistema: ' + U.fecha(sug), sug); if (!f) return;
  f = U.ymd(f); if (!f) return appAlert('Fecha inválida.');
  var J = BSLactancia.jornada(f, { horarios: LAC.horarios, feriados: LAC.feriados, ausencias: BSLactancia.lista(x.ausencias) });
  if (J.h <= 0) return appAlert('El ' + U.fecha(f) + ' no es día laborable para ella (' + (J.motivo || 'sin jornada') + ').');
  var L = desc(x); if (L.some(function (d) { return d.fecha === f && !/anulad/i.test(d.estado || ''); })) return appAlert('Ya hay un descanso en esa fecha.');
  var saldoAl = C.bitacora.filter(function (b) { return b.fecha < f; }).pop(); var s = saldoAl ? saldoAl.saldo : C.saldo;
  if (s + 1e-9 < J.h && !(await appConfirm('A esa fecha el saldo proyectado es ' + fmtH(s) + ' y el día vale ' + fmtH(J.h) + ' (quedaría en negativo). ¿Programar igual?'))) return;
  L.push({ fecha: f, estado: 'programado', horas: J.h, nota: 'Programado' });
  await lacGuardarDescansos(x, L, 'Descanso programado para el ' + U.fecha(f) + '. El supervisor lo verá en Alertas.');
};
window.lacTomado = async function (id) {
  var x = lacReg(id); if (!x) return; var U = GS_U, L = desc(x);
  var pend = L.filter(function (d) { return !/tomad|anulad/i.test(d.estado || ''); }).map(function (d) { return d.fecha; }).sort();
  var f = await appPrompt('Fecha del descanso tomado (aaaa-mm-dd)' + (pend.length ? '\nProgramados pendientes: ' + pend.map(U.fecha).join(', ') : ''), pend[0] || U.hoy()); if (!f) return;
  f = U.ymd(f); if (!f) return appAlert('Fecha inválida.');
  var J = BSLactancia.jornada(f, { horarios: LAC.horarios, feriados: LAC.feriados, ausencias: [] });
  var i = L.findIndex(function (d) { return d.fecha === f && !/anulad/i.test(d.estado || ''); });
  if (i >= 0) { L[i].estado = 'tomado'; L[i].horas = L[i].horas || J.h; L[i].nota = (L[i].nota ? L[i].nota + ' · ' : '') + 'Tomado'; } else L.push({ fecha: f, estado: 'tomado', horas: J.h || 0, nota: 'Registrado como tomado' });
  await lacGuardarDescansos(x, L, 'Descanso del ' + U.fecha(f) + ' registrado como tomado.');
};
window.lacAusencia = async function (id) {
  var x = lacReg(id); if (!x) return; var U = GS_U;
  var d = await appPrompt('Ausencia (vacaciones, descanso médico, permiso): fecha de inicio (aaaa-mm-dd). Esos días no generan horas.', U.hoy()); if (!d) return; d = U.ymd(d); if (!d) return appAlert('Fecha inválida.');
  var h = await appPrompt('Fecha de fin (aaaa-mm-dd)', d); if (!h) return; h = U.ymd(h); if (!h || h < d) return appAlert('Fecha de fin inválida.');
  var m = await appPrompt('Motivo', 'Vacaciones'); if (m === null) return;
  var A = BSLactancia.lista(x.ausencias); A.push({ desde: d, hasta: h, motivo: m || '' });
  await gsActualizar(x.id, { ausencias: JSON.stringify(A) }, 'Ausencia registrada: no genera horas del ' + U.fecha(d) + ' al ' + U.fecha(h) + '.');
};
window.lacConstancia = function (id) {
  var x = lacReg(id); if (!x) return; var U = GS_U, C = calcDe(x, U), E = (window.GS_EMPRESAS || {})[x.empresa] || {};
  var filas = C.descansos.filter(function (d) { return !d.vencido; }).map(function (d) { return '<tr><td>' + U.fecha(d.fecha) + '</td><td>' + fmtH(d.horas) + '</td><td>' + U.esc(d.estado) + '</td><td>' + U.esc(d.registrado_por || '') + '</td><td style="height:34px"></td></tr>'; }).join('');
  var w = window.open('', '_blank'); if (!w) return appAlert('Permite las ventanas emergentes para imprimir.');
  w.document.write('<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Constancia de permiso de lactancia</title><style>body{font-family:Arial,sans-serif;color:#111;margin:36px;font-size:12.5px}h1{font-size:16px;text-align:center;margin:18px 0 4px;letter-spacing:.5px}h2{font-size:13px;margin:16px 0 6px;border-bottom:1px solid #999;padding-bottom:3px}.memb{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #C8102E;padding-bottom:8px}.memb b{font-size:15px}table{width:100%;border-collapse:collapse;margin-top:6px}th,td{border:1px solid #777;padding:5px 6px;font-size:11.5px}th{background:#f1f1f1}.firmas{display:flex;justify-content:space-around;margin-top:60px;text-align:center}.firmas div{width:40%;border-top:1px solid #333;padding-top:6px;font-size:11px}.nota{font-size:10.5px;color:#444;margin-top:14px}</style></head><body>' +
    '<div class="memb"><div><b>' + U.esc(E.razon || x.empresa) + '</b><br><span>' + U.esc(E.ruc ? 'RUC ' + E.ruc : '') + (E.domicilio ? ' · ' + U.esc(E.domicilio) : '') + '</span></div><div style="text-align:right">Gestión Humana · Bienestar Social<br>' + U.esc(x.codigo) + '</div></div>' +
    '<h1>CONSTANCIA DE PERMISO POR LACTANCIA MATERNA ACUMULADO</h1><p style="text-align:center;margin:0 0 12px">Ley N.° 27240, modificada por las Leyes N.° 27591 y N.° 28731</p>' +
    '<p>La trabajadora <b>' + U.esc(x.nombre) + '</b>, DNI <b>' + U.esc(x.dni) + '</b>' + (x.cargo ? ', ' + U.esc(x.cargo) : '') + (x.fundo ? ' (' + U.esc(x.fundo) + ')' : '') + ', madre de hijo(a) nacido(a) el <b>' + U.fecha(x.fecha_parto) + '</b>' + (U.si(x.parto_multiple) ? ' (parto múltiple: dos horas diarias)' : '') + ', retornó a sus labores el <b>' + U.fecha(x.fecha_retorno) + '</b> y goza del permiso de lactancia hasta el <b>' + U.fecha(C.fin) + '</b>.</p>' +
    '<p>' + (U.si(x.acuerdo_firmado) ? 'Conforme al acuerdo escrito suscrito' + (U.ymd(x.fecha_acuerdo) ? ' el ' + U.fecha(x.fecha_acuerdo) : '') + ', la hora diaria de lactancia se acumula y se otorga en días completos de descanso, según la jornada vigente de la temporada.' : '<b>Pendiente de suscribir el acuerdo escrito de acumulación.</b>') + '</p>' +
    '<h2>Resumen al ' + U.fecha(U.hoy()) + '</h2><table><tr><th>Horas generadas</th><th>Horas descansadas</th><th>Saldo</th><th>Días tomados</th><th>Próximo descanso</th></tr><tr><td>' + fmtH(C.horasGanadas) + '</td><td>' + fmtH(C.horasDescansadas) + '</td><td><b>' + fmtH(C.saldo) + '</b></td><td>' + C.diasTomados + '</td><td>' + (C.proximo ? U.fecha(C.proximo.fecha) + ' (' + C.proximo.estado + ')' : '—') + '</td></tr></table>' +
    '<h2>Descansos otorgados</h2><table><tr><th>Fecha</th><th>Horas</th><th>Estado</th><th>Registró</th><th>Firma de la trabajadora</th></tr>' + (filas || '<tr><td colspan="5">Sin descansos registrados.</td></tr>') + '</table>' +
    '<div class="firmas"><div>Trabajadora<br>' + U.esc(x.nombre) + '<br>DNI ' + U.esc(x.dni) + '</div><div>Gestión Humana / Bienestar Social<br>' + U.esc(E.razon || x.empresa) + '</div></div>' +
    '<p class="nota">Documento generado por el Sistema de Bienestar Social el ' + new Date().toLocaleString('es-PE') + '. Los descansos se calculan con la jornada vigente de cada temporada (alta: L–V 9.6 h; baja: L–V 8.45 h, sábado 5.75 h) y con los días efectivamente laborados.</p>' +
    '<script>window.onload=function(){window.print();}<\/script></body></html>');
  w.document.close();
};
/* ── horarios (configuración) ── */
async function lacHorarioForm(h) {
  var U = GS_U, nombre = await appPrompt('Nombre del horario', h.nombre || 'Temporada'); if (nombre === null) return null;
  var meses = await appPrompt('Meses en que rige (ej. 6-12 o 1-5; vacío = todo el año)', h.meses || ''); if (meses === null) return null;
  var lv = await appPrompt('Horas efectivas de lunes a viernes (ej. 9.6)', String(h.lv_horas != null ? h.lv_horas : '9.6')); if (lv === null) return null;
  var sab = await appPrompt('Horas efectivas del sábado (0 si no se trabaja)', String(h.sab_horas != null ? h.sab_horas : '0')); if (sab === null) return null;
  var desde = await appPrompt('Vigente desde (aaaa-mm-dd, vacío = permanente)', U.ymd(h.desde_fecha) || ''); if (desde === null) return null;
  var hasta = await appPrompt('Vigente hasta (aaaa-mm-dd, vacío = sin fin)', U.ymd(h.hasta_fecha) || ''); if (hasta === null) return null;
  var det = await appPrompt('Detalle (horario de entrada y salida)', h.detalle || ''); if (det === null) return null;
  var act = await appConfirm('¿Horario activo?');
  return { nombre: nombre, meses: meses, lv_horas: Number(String(lv).replace(',', '.')), sab_horas: Number(String(sab).replace(',', '.')), desde_fecha: desde, hasta_fecha: hasta, detalle: det, activo: act ? 'SI' : 'NO' };
}
window.lacHorarioNuevo = async function () { var d = await lacHorarioForm({}); if (!d) return; var r = await bsAccionSupabase('bs_gsCrear', { clave: 'bs_gs_lactancia_horarios', datos: d }); appAlert(r.message || (r.ok ? 'Horario creado.' : 'No se pudo crear.')); if (r.ok) cargar(); };
window.lacHorarioEditar = async function (id) { var h = LAC.horarios.find(function (x) { return Number(x.id) === Number(id); }); if (!h) return; var d = await lacHorarioForm(h); if (!d) return; var r = await bsAccionSupabase('bs_gsActualizar', { clave: 'bs_gs_lactancia_horarios', id: id, datos: d }); appAlert(r.message || (r.ok ? 'Horario actualizado.' : 'No se pudo actualizar.')); if (r.ok) cargar(); };
