/* =========================================================================
 * BS-DESCANSOS · Descansos Médicos (DM / CITT)
 * Bienestar Social · Unifrutti Group — RAPEL S.A.C. / VERFRUT S.A.C.
 * Autor: Joel Ángel Timoteo Gonza
 * -------------------------------------------------------------------------
 * QUÉ HACE:
 *   Registro de descansos médicos por trabajador, acumulado anual, alertas
 *   (canje de CITT, umbral de 20 días) y generación del expediente de
 *   Subsidio en BS_Subsidios cuando el acumulado supera el umbral.
 *
 * INSTALACIÓN:
 *   1. Este archivo vive en gas/bs-descansos.js (clasp push).
 *   2. En el switch de doPost agregar:
 *
 *        case 'bs_crearDescanso':           result = bs_crearDescanso(params.usuario, params.datos); break;
 *        case 'bs_listarDescansos':         result = bs_listarDescansos(params.filtros || params); break;
 *        case 'bs_actualizarDescanso':      result = bs_actualizarDescanso(params.usuario, params.id, params.datos); break;
 *        case 'bs_acumuladoDescansos':      result = bs_acumuladoDescansos(params.dni, params.anio); break;
 *        case 'bs_generarSubsidioDesdeDM':  result = bs_generarSubsidioDesdeDM(params.usuario, params.id); break;
 *        case 'bs_dashboardDescansos':      result = bs_dashboardDescansos(params.anio, params.empresa); break;
 *
 *   3. En BS_SEG.PERMISOS (bs-seguridad, dentro de Código.js) agregar:
 *        descansos: ['bs_crearDescanso','bs_listarDescansos','bs_actualizarDescanso',
 *                    'bs_acumuladoDescansos','bs_generarSubsidioDesdeDM','bs_dashboardDescansos']
 *
 *   4. En la hoja Usuarios agregar la columna mod_descansos (S/N) y en bs_login
 *      incluirla en permisos (ver _dmPermisoUsuario_ si bs_login lee columnas por nombre).
 *
 *   5. Run → bs_setupDescansos (crea la hoja BS_Descansos). Luego clasp deploy.
 *
 * REGLA (D.S. 009-97-SA / Ley 26790) — validar con planillas:
 *   Incapacidad temporal: los primeros 20 días acumulados por año calendario los
 *   paga el empleador; del día 21 en adelante subsidio EsSalud (requiere CITT).
 *   Maternidad: 98 días subsidiados sin umbral.
 * ========================================================================= */

var BS_DM = {
  HOJA: 'BS_Descansos',
  UMBRAL_DIAS: 20,                 // días a cargo del empleador por año
  UMBRAL_AMBAR: 15,                // aviso previo
  UMBRAL_INVALIDEZ: 150,           // evaluación EsSalud (riesgo de invalidez)
  PLAZO_CANJE_DIAS: 30,            // días para canjear certificado particular a CITT
  TIPOS: ['Enfermedad común', 'Accidente de trabajo', 'Accidente común', 'Maternidad'],
  ORIGENES: ['Particular', 'EsSalud'],
  CITT_ESTADOS: ['Pendiente de canje', 'Canjeado', 'Observado', 'No aplica'],
  HEADERS: ['id', 'dni', 'nombre', 'empresa', 'sector', 'tipo', 'origen', 'citt_numero', 'citt_estado',
            'fecha_inicio', 'fecha_fin', 'dias', 'diagnostico', 'cie10', 'centro', 'medico', 'observaciones',
            'id_accidente', 'id_subsidio', 'estado', 'anulado', 'created_by', 'created_at', 'updated_by', 'updated_at']
};

/* ---------- SETUP ---------- */
function bs_setupDescansos() {
  var sh = _dmSheet_(true);
  Logger.log('Hoja ' + BS_DM.HOJA + ' lista (' + (sh.getLastRow() - 1) + ' registros).');
  return 'OK';
}

function _dmSheet_(crear) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(BS_DM.HOJA);
  if (!sh && crear) {
    sh = ss.insertSheet(BS_DM.HOJA);
    sh.appendRow(BS_DM.HEADERS);
    var hr = sh.getRange(1, 1, 1, BS_DM.HEADERS.length);
    hr.setFontWeight('bold').setBackground('#0a2540').setFontColor('#ffffff').setHorizontalAlignment('center');
    sh.setFrozenRows(1);
  }
  return sh;
}

/* ---------- CREAR ---------- */
function bs_crearDescanso(usuario, d) {
  try {
    d = d || {};
    var v = _dmValidar_(d);
    if (v) return { ok: false, message: v };
    var sh = _dmSheet_(true);
    var lastRow = sh.getLastRow();
    var id = lastRow > 1 ? _bsSiguienteId_(sh) : 1;   /* _BS_IDS_V1 */
    var ini = _aFecha(d.fecha_inicio), fin = _aFecha(d.fecha_fin);
    var dias = _dmDias_(ini, fin);
    var hoy = _hoy();
    var estado = fin.getTime() >= hoy.getTime() ? 'Activo' : 'Concluido';
    var now = new Date();
    sh.appendRow([
      id, String(d.dni).trim(), String(d.nombre || '').toUpperCase(), d.empresa || '', d.sector || '',
      d.tipo || BS_DM.TIPOS[0], d.origen || BS_DM.ORIGENES[0], d.citt_numero || '',
      d.citt_estado || (d.origen === 'EsSalud' ? 'Canjeado' : 'Pendiente de canje'),
      _ymd(ini), _ymd(fin), dias, d.diagnostico || '', (d.cie10 || '').toUpperCase(), d.centro || '', d.medico || '',
      d.observaciones || '', d.id_accidente || '', '', estado, '', usuario || '', now, usuario || '', now
    ]);
    var acum = bs_acumuladoDescansos(d.dni, ini.getFullYear());
    return { ok: true, id: id, dias: dias, estado: estado, acumulado: acum.ok ? acum.total : null,
             message: 'Descanso médico registrado (' + dias + ' día(s)).' };
  } catch (e) { return { ok: false, message: 'Error al registrar: ' + e.message }; }
}

/* ---------- ACTUALIZAR ---------- */
function bs_actualizarDescanso(usuario, id, d) {
  try {
    d = d || {};
    var sh = _dmSheet_(false);
    if (!sh) return { ok: false, message: 'La hoja ' + BS_DM.HOJA + ' no existe.' };
    var fila = _dmFila_(sh, id);
    if (!fila) return { ok: false, message: 'Descanso #' + id + ' no encontrado.' };
    var H = BS_DM.HEADERS;
    var row = sh.getRange(fila, 1, 1, H.length).getValues()[0];
    var editables = ['nombre', 'empresa', 'sector', 'tipo', 'origen', 'citt_numero', 'citt_estado', 'fecha_inicio', 'fecha_fin',
                     'diagnostico', 'cie10', 'centro', 'medico', 'observaciones', 'id_accidente', 'estado'];
    editables.forEach(function (k) { if (d[k] !== undefined) row[H.indexOf(k)] = (k === 'fecha_inicio' || k === 'fecha_fin') ? _ymd(_aFecha(d[k])) : d[k]; });
    var ini = _aFecha(row[H.indexOf('fecha_inicio')]), fin = _aFecha(row[H.indexOf('fecha_fin')]);
    if (!ini || !fin || fin < ini) return { ok: false, message: 'Rango de fechas inválido.' };
    row[H.indexOf('dias')] = _dmDias_(ini, fin);
    if (d.estado === undefined) row[H.indexOf('estado')] = fin.getTime() >= _hoy().getTime() ? 'Activo' : 'Concluido';
    row[H.indexOf('updated_by')] = usuario || '';
    row[H.indexOf('updated_at')] = new Date();
    sh.getRange(fila, 1, 1, H.length).setValues([row]);
    return { ok: true, id: id, dias: row[H.indexOf('dias')], message: 'Descanso actualizado.' };
  } catch (e) { return { ok: false, message: 'Error al actualizar: ' + e.message }; }
}

/* ---------- LISTAR (+ acumulados y alertas) ---------- */
function bs_listarDescansos(f) {
  try {
    f = f || {};
    var items = _dmLeer_();
    var anio = parseInt(f.anio) || 0;
    if (f.empresa) items = items.filter(function (x) { return x.empresa === f.empresa; });
    if (f.dni) items = items.filter(function (x) { return String(x.dni) === String(f.dni); });
    if (f.tipo) items = items.filter(function (x) { return x.tipo === f.tipo; });
    if (f.estado) items = items.filter(function (x) { return x.estado === f.estado; });
    if (anio) items = items.filter(function (x) { return String(x.fecha_inicio).slice(0, 4) == anio; });
    var acum = _dmAcumulados_(_dmLeer_(), anio || _hoy().getFullYear());
    items.forEach(function (x) { var a = acum[x.dni]; x.acumulado_anual = a ? a.total : 0; x.semaforo = _dmSemaforo_(x.acumulado_anual, x.tipo); });
    items.sort(function (a, b) { return (b.id || 0) - (a.id || 0); });
    return { ok: true, items: items, total: items.length, alertas: _dmAlertas_(items, acum), umbral: BS_DM.UMBRAL_DIAS, catalogos: { tipos: BS_DM.TIPOS, origenes: BS_DM.ORIGENES, citt_estados: BS_DM.CITT_ESTADOS } };
  } catch (e) { return { ok: false, message: 'Error al listar: ' + e.message }; }
}

/* ---------- ACUMULADO POR TRABAJADOR ---------- */
function bs_acumuladoDescansos(dni, anio) {
  try {
    dni = String(dni || '').trim(); anio = parseInt(anio) || _hoy().getFullYear();
    if (!dni) return { ok: false, message: 'Falta DNI.' };
    var a = _dmAcumulados_(_dmLeer_().filter(function (x) { return String(x.dni) === dni; }), anio)[dni] || { total: 0, subsidiable: 0, porTipo: {}, items: [] };
    a.ok = true; a.dni = dni; a.anio = anio; a.umbral = BS_DM.UMBRAL_DIAS; a.semaforo = _dmSemaforo_(a.total, '');
    a.excedente = Math.max(0, a.total - BS_DM.UMBRAL_DIAS);
    return a;
  } catch (e) { return { ok: false, message: e.message }; }
}

/* ---------- GENERAR EXPEDIENTE DE SUBSIDIO ---------- */
function bs_generarSubsidioDesdeDM(usuario, id) {
  try {
    var sh = _dmSheet_(false);
    if (!sh) return { ok: false, message: 'La hoja ' + BS_DM.HOJA + ' no existe.' };
    var fila = _dmFila_(sh, id);
    if (!fila) return { ok: false, message: 'Descanso #' + id + ' no encontrado.' };
    var H = BS_DM.HEADERS;
    var row = sh.getRange(fila, 1, 1, H.length).getValues()[0];
    var dm = {}; H.forEach(function (h, i) { dm[h] = row[i]; });
    if (dm.id_subsidio) return { ok: false, message: 'Este descanso ya tiene el subsidio #' + dm.id_subsidio + '.' };
    if (dm.citt_estado !== 'Canjeado' && dm.tipo !== 'Maternidad') return { ok: false, message: 'Primero registra el CITT como "Canjeado": EsSalud solo subsidia con CITT.' };

    var anio = parseInt(String(dm.fecha_inicio).slice(0, 4)) || _hoy().getFullYear();
    var diasSub = Number(dm.dias) || 0;
    if (dm.tipo !== 'Maternidad') {
      // Días de ESTE descanso que exceden el umbral anual (contando los anteriores del año)
      var previos = _dmLeer_().filter(function (x) { return String(x.dni) === String(dm.dni) && x.id < dm.id && x.tipo !== 'Maternidad' && String(x.fecha_inicio).slice(0, 4) == anio; })
                      .reduce(function (s, x) { return s + (Number(x.dias) || 0); }, 0);
      diasSub = Math.max(0, Math.min(Number(dm.dias) || 0, previos + (Number(dm.dias) || 0) - BS_DM.UMBRAL_DIAS));
      if (diasSub <= 0) return { ok: false, message: 'Aún no supera los ' + BS_DM.UMBRAL_DIAS + ' días acumulados del año (' + (previos + (Number(dm.dias) || 0)) + '): no hay días subsidiables.' };
    }
    var partes = String(dm.nombre || '').trim().split(/\s+/);
    var nombres = partes.slice(2).join(' ') || partes.join(' ');
    var fin = _aFecha(dm.fecha_fin), ini = _aFecha(dm.fecha_inicio);
    var iniSub = dm.tipo === 'Maternidad' ? ini : new Date(fin.getTime() - (diasSub - 1) * 86400000);
    var res = bs_crearSubsidio(usuario, {
      anio: anio, mes: _dmMes_(iniSub), tipo: dm.tipo === 'Maternidad' ? 'MATERNIDAD' : 'INCAPACIDAD TEMPORAL',
      numero: dm.dni, apellido_paterno: partes[0] || '', apellido_materno: partes[1] || '', nombres: nombres,
      descripcion: (dm.tipo === 'Maternidad' ? 'Maternidad' : 'Incapacidad temporal') + ' · ' + (dm.diagnostico || '') + (dm.cie10 ? ' (' + dm.cie10 + ')' : ''),
      estado: 'Pendiente', dias: diasSub, inicio: _ymd(iniSub), termino: _ymd(fin), expediente: dm.citt_numero || '',
      observaciones: 'Generado desde Descanso Médico #' + dm.id, estado_general: 'En proceso', empresa: dm.empresa
    });
    if (!res || !res.ok) return { ok: false, message: 'No se pudo crear el subsidio: ' + ((res && res.message) || 'error') };
    sh.getRange(fila, H.indexOf('id_subsidio') + 1).setValue(res.id);
    sh.getRange(fila, H.indexOf('updated_by') + 1, 1, 2).setValues([[usuario || '', new Date()]]);
    try { bs_registrarAuditoria(usuario, 'CREAR', 'subsidios', res.id, 'Generado desde DM #' + dm.id + ' · ' + diasSub + ' días'); } catch (e2) {}
    return { ok: true, id_subsidio: res.id, dias: diasSub, message: 'Expediente de subsidio #' + res.id + ' creado con ' + diasSub + ' día(s).' };
  } catch (e) { return { ok: false, message: 'Error generando subsidio: ' + e.message }; }
}

/* ---------- DASHBOARD ---------- */
function bs_dashboardDescansos(anio, empresa) {
  try {
    anio = parseInt(anio) || _hoy().getFullYear();
    var all = _dmLeer_().filter(function (x) { return String(x.fecha_inicio).slice(0, 4) == anio && (!empresa || x.empresa === empresa); });
    var hoy = _hoy(), mesHoy = hoy.getMonth();
    var porMes = []; for (var i = 0; i < 12; i++) porMes.push({ dm: 0, dias: 0 });
    var porTipo = {}, porEmpresa = { RAPEL: 0, VERFRUT: 0 }, porSector = {}, diag = {}, canje = { Canjeado: 0, 'Pendiente de canje': 0, Observado: 0, 'No aplica': 0 };
    var activos = 0, diasMes = 0;
    all.forEach(function (x) {
      var m = parseInt(String(x.fecha_inicio).slice(5, 7)) - 1; if (m >= 0 && m < 12) { porMes[m].dm++; porMes[m].dias += Number(x.dias) || 0; if (m === mesHoy) diasMes += Number(x.dias) || 0; }
      porTipo[x.tipo] = (porTipo[x.tipo] || 0) + (Number(x.dias) || 0);
      if (porEmpresa[x.empresa] !== undefined) porEmpresa[x.empresa] += Number(x.dias) || 0;
      porSector[x.sector || '(sin sector)'] = (porSector[x.sector || '(sin sector)'] || 0) + (Number(x.dias) || 0);
      var dg = x.cie10 || x.diagnostico || '(sin diagnóstico)'; diag[dg] = (diag[dg] || 0) + 1;
      if (canje[x.citt_estado] !== undefined) canje[x.citt_estado]++;
      if (x.estado === 'Activo') activos++;
    });
    var acum = _dmAcumulados_(all, anio);
    var rojos = Object.keys(acum).filter(function (k) { return acum[k].total > BS_DM.UMBRAL_DIAS; }).map(function (k) { return { dni: k, nombre: acum[k].nombre, total: acum[k].total, empresa: acum[k].empresa }; }).sort(function (a, b) { return b.total - a.total; });
    var topDiag = Object.keys(diag).map(function (k) { return { k: k, n: diag[k] }; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 8);
    var topSector = Object.keys(porSector).map(function (k) { return { k: k, dias: porSector[k] }; }).sort(function (a, b) { return b.dias - a.dias; }).slice(0, 8);
    return { ok: true, anio: anio, kpis: { total_dm: all.length, dias_perdidos: all.reduce(function (s, x) { return s + (Number(x.dias) || 0); }, 0), activos: activos, dias_mes: diasMes, pendientes_canje: canje['Pendiente de canje'], trabajadores_rojo: rojos.length },
             porMes: porMes, porTipo: porTipo, porEmpresa: porEmpresa, topSector: topSector, topDiag: topDiag, canje: canje, rojos: rojos.slice(0, 15) };
  } catch (e) { return { ok: false, message: e.message }; }
}

/* ---------- helpers ---------- */
function _dmValidar_(d) {
  if (!/^\d{8}$/.test(String(d.dni || '').trim())) return 'DNI inválido (8 dígitos).';
  if (!d.nombre) return 'Falta el nombre del trabajador.';
  if (!d.empresa) return 'Falta la empresa.';
  var ini = _aFecha(d.fecha_inicio), fin = _aFecha(d.fecha_fin);
  if (!ini || !fin) return 'Fechas de inicio y fin obligatorias.';
  if (fin < ini) return 'La fecha fin no puede ser anterior al inicio.';
  if (_dmDias_(ini, fin) > 366) return 'Un descanso no puede superar 366 días; divídelo.';
  if (d.tipo && BS_DM.TIPOS.indexOf(d.tipo) < 0) return 'Tipo no válido.';
  return '';
}
function _dmDias_(ini, fin) { return Math.round((fin.getTime() - ini.getTime()) / 86400000) + 1; }
function _dmMes_(d) { return ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SETIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'][d.getMonth()]; }
function _dmFila_(sh, id) {
  var last = sh.getLastRow(); if (last < 2) return 0;
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return 0;
}
function _dmLeer_() {
  var sh = _dmSheet_(false); if (!sh) return [];
  var data = sh.getDataRange().getValues(); if (data.length <= 1) return [];
  var H = data[0], out = [];
  for (var i = 1; i < data.length; i++) {
    var o = {}; for (var j = 0; j < H.length; j++) { var v = data[i][j]; o[H[j]] = (v instanceof Date) ? _ymd(v) : v; }
    if (/^(s|si|sí|true|1)$/i.test(String(o.anulado || '').trim())) continue;
    out.push(o);
  }
  return out;
}
function _dmAcumulados_(items, anio) {
  var acc = {};
  items.forEach(function (x) {
    if (String(x.fecha_inicio).slice(0, 4) != anio) return;
    var k = String(x.dni);
    if (!acc[k]) acc[k] = { total: 0, maternidad: 0, porTipo: {}, nombre: x.nombre, empresa: x.empresa, items: [] };
    var d = Number(x.dias) || 0;
    if (x.tipo === 'Maternidad') acc[k].maternidad += d; else acc[k].total += d;
    acc[k].porTipo[x.tipo] = (acc[k].porTipo[x.tipo] || 0) + d;
    acc[k].items.push({ id: x.id, tipo: x.tipo, inicio: x.fecha_inicio, fin: x.fecha_fin, dias: d, citt: x.citt_estado, id_subsidio: x.id_subsidio });
  });
  Object.keys(acc).forEach(function (k) { acc[k].subsidiable = Math.max(0, acc[k].total - BS_DM.UMBRAL_DIAS); });
  return acc;
}
function _dmSemaforo_(total, tipo) {
  if (tipo === 'Maternidad') return 'azul';
  if (total > BS_DM.UMBRAL_DIAS) return 'rojo';
  if (total >= BS_DM.UMBRAL_AMBAR) return 'ambar';
  return 'verde';
}
function _dmAlertas_(items, acum) {
  var hoy = _hoy(), al = [];
  items.forEach(function (x) {
    if (x.estado === 'Activo') al.push({ nivel: 'info', id: x.id, dni: x.dni, nombre: x.nombre, titulo: 'Descanso médico vigente hasta ' + x.fecha_fin });
    if (x.citt_estado === 'Pendiente de canje') {
      var ini = _aFecha(x.fecha_inicio); var edad = ini ? Math.round((hoy.getTime() - ini.getTime()) / 86400000) : 0;
      if (edad > BS_DM.PLAZO_CANJE_DIAS) al.push({ nivel: 'rojo', id: x.id, dni: x.dni, nombre: x.nombre, titulo: 'Certificado sin canjear a CITT hace ' + edad + ' días' });
      else if (edad > BS_DM.PLAZO_CANJE_DIAS - 10) al.push({ nivel: 'ambar', id: x.id, dni: x.dni, nombre: x.nombre, titulo: 'Canje de CITT vence en ' + (BS_DM.PLAZO_CANJE_DIAS - edad) + ' días' });
    }
  });
  Object.keys(acum).forEach(function (k) {
    var a = acum[k];
    if (a.total > BS_DM.UMBRAL_DIAS) {
      var sinSub = a.items.some(function (i) { return i.tipo !== 'Maternidad' && !i.id_subsidio; });
      al.push({ nivel: sinSub ? 'rojo' : 'ambar', dni: k, nombre: a.nombre, titulo: a.total + ' días acumulados (supera ' + BS_DM.UMBRAL_DIAS + ')' + (sinSub ? ' · falta expediente de subsidio' : ' · con subsidio') });
    } else if (a.total >= BS_DM.UMBRAL_AMBAR) al.push({ nivel: 'ambar', dni: k, nombre: a.nombre, titulo: a.total + ' días acumulados, cerca del umbral' });
    if (a.total >= BS_DM.UMBRAL_INVALIDEZ) al.push({ nivel: 'rojo', dni: k, nombre: a.nombre, titulo: a.total + ' días: evaluar incapacidad prolongada con EsSalud' });
  });
  var peso = { rojo: 0, ambar: 1, info: 2 };
  al.sort(function (a, b) { return peso[a.nivel] - peso[b.nivel]; });
  return al;
}
