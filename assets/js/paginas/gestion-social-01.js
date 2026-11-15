/* Bienestar Social · modulos/gestion-social.html · _BS_GESTION_SOCIAL_V1 (14-nov-2026)
   Etapa 1 del módulo "Gestión Social del Trabajador": casos sociales + seguimientos.
   Todo se lee y guarda en Supabase a través de bs-guardar-supabase.js (bs_listarGsCasos, bs_crearGsCaso,
   bs_actualizarGsCaso, bs_listarGsSeguimientos, bs_crearGsSeguimiento, bs_anularRegistro / bs_restaurarRegistro con
   modulo 'gestion_social'). No existe hoja de Google detrás: si el servidor no responde, la pantalla lo dice. */
(function () {
  'use strict';

  // ===== AUTH =====
  var session = localStorage.getItem('bienestarSocialAuth');
  if (!session) { window.location.href = '../index.html'; return; }
  var user;
  try { user = JSON.parse(session); if (!user || !user.usuario) throw new Error(); }
  catch (e) { window.location.href = '../index.html'; return; }
  var esAdmin = /admin|geren/i.test(user.rol || '') || user.esAdminRL === true || ['jtimoteo'].indexOf((user.usuario || '').toLowerCase()) >= 0;
  document.getElementById('userName').textContent = user.nombre || user.usuario;
  /* Permiso: lo decide "Acceso a Módulos" del Sistema RR.LL. (bs_gestion_social). Si la sesión guardada aún no lo trae,
     se consulta al servidor una vez antes de negar el acceso. El servidor vuelve a exigirlo en cada lectura/escritura. */
  async function verificarAcceso() {
    if (esAdmin || (user.permisos && user.permisos.gestion_social)) return true;
    var rl = null; try { rl = window.bsPermisosRL ? await window.bsPermisosRL() : null; } catch (e) { rl = null; }
    if (rl && rl.ok && (rl.esAdmin || (rl.permisos && rl.permisos.gestion_social))) {
      user.permisos = Object.assign({}, user.permisos || {}, rl.permisos || {}); if (rl.esAdmin) { user.esAdminRL = true; esAdmin = true; }
      try { localStorage.setItem('bienestarSocialAuth', JSON.stringify(user)); } catch (e) {}
      return true;
    }
    return false;
  }

  // ===== CATÁLOGOS (se definen aquí; cambiarlos no requiere tocar el servidor) =====
  var TIPOS = ['Salud familiar', 'Salud del trabajador', 'Economía / deudas', 'Vivienda', 'Educación de hijos', 'Violencia familiar (Ley 30364)', 'Duelo / fallecimiento', 'Conflicto laboral o familiar', 'Otro'];
  var ORIGENES = ['Lo reportó el supervisor', 'Lo pidió el trabajador', 'Canal de quejas / sugerencias', 'Detectado en visita de campo', 'Derivado de Hostigamiento', 'Derivado de Accidentes', 'Derivado de Descansos médicos', 'Otro'];
  var ACCIONES = ['Visita domiciliaria', 'Entrevista en el fundo', 'Derivación externa', 'Apoyo interno (préstamo, permiso, reubicación)', 'Solo seguimiento'];
  var DERIVACIONES = ['— Ninguna —', 'EsSalud', 'Centro Emergencia Mujer (MIMP)', 'Defensoría del Pueblo', 'Municipalidad', 'Comité de hostigamiento', 'Policía / Fiscalía', 'Otra institución'];
  var TIPOS_SEG = ['Visita domiciliaria', 'Entrevista', 'Llamada', 'Derivación', 'Apoyo entregado', 'Otro'];
  var CAMPOS = ['dni', 'nombre', 'empresa', 'fundo', 'cargo', 'sede', 'tipo', 'prioridad', 'fecha_deteccion', 'origen', 'descripcion', 'accion_inmediata', 'fecha_programada', 'derivacion', 'responsable', 'compromisos', 'estado', 'resultado'];
  var DATA = [], TAB = 'lista';

  var $ = function (id) { return document.getElementById(id); };
  var hoy = function () { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  var ymd = function (v) { if (!v) return ''; var s = String(v); var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[1] + '-' + m[2] + '-' + m[3] : ''; };
  var fecha = function (v) { var y = ymd(v); return y ? y.split('-').reverse().join('/') : '—'; };
  var dias = function (a, b) { a = ymd(a); b = ymd(b || hoy()); if (!a || !b) return 0; return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000); };
  var anulado = function (r) { return String(r.anulado || '').trim() !== ''; };
  var pill = function (e) { var k = String(e || '').toLowerCase(); var c = k.indexOf('cerr') >= 0 ? 'cerrado' : k.indexOf('visita') >= 0 ? 'visita' : k.indexOf('deriv') >= 0 ? 'derivado' : k.indexOf('seg') >= 0 ? 'seguimiento' : 'abierto'; return '<span class="gs-pill ' + c + '">' + esc(e || 'Abierto') + '</span>'; };
  var prio = function (p) { return '<span class="gs-pill ' + String(p || 'media').toLowerCase() + '">' + esc(p || 'Media') + '</span>'; };
  function fill(id, arr, vacio) { var s = $(id); if (!s) return; var cur = s.value; s.innerHTML = (vacio !== undefined ? '<option value="">' + esc(vacio) + '</option>' : '') + arr.map(function (x) { return '<option>' + esc(x) + '</option>'; }).join(''); if (cur) s.value = cur; }
  fill('tipo', TIPOS); fill('origen', ORIGENES); fill('accion_inmediata', ACCIONES); fill('derivacion', DERIVACIONES); fill('fTipo', TIPOS, 'Todos');
  (function () { var s = $('fAnio'); var y = new Date().getFullYear(); s.add(new Option('Todos', '')); for (var a = y + 1; a >= 2026; a--) s.add(new Option(String(a), String(a))); s.value = ''; })();

  // ===== CARGA =====
  async function cargar() {
    var cont = $('p-lista');
    cont.innerHTML = '<div class="bs-text-center" style="padding:2rem"><div class="bs-spinner bs-spinner-dark" style="margin:0 auto"></div></div>';
    try {
      var r = await api('bs_listarGsCasos', {});
      if (!r || !r.ok) { cont.innerHTML = '<div class="bs-alert bs-alert-danger"><strong>No se pudo leer de Supabase:</strong> ' + esc((r && r.message) || 'sin respuesta') + '</div>'; return; }
      DATA = r.items || [];
      var fundos = {}; DATA.forEach(function (x) { if (x.fundo) fundos[String(x.fundo).trim()] = 1; });
      fill('fFundo', Object.keys(fundos).sort(), 'Todos');
      render(); renderAlertas();
    } catch (e) { cont.innerHTML = '<div class="bs-alert bs-alert-danger">Error: ' + esc(e.message) + '</div>'; }
  }

  function filtrados() {
    var fE = $('fEmpresa').value, fF = $('fFundo').value, fT = $('fTipo').value, fS = $('fEstado').value, fP = $('fPrio').value, fA = $('fAnio').value, q = ($('fTexto').value || '').toLowerCase().trim(), verAn = $('fAnulados').checked;
    return DATA.filter(function (r) {
      if (!verAn && anulado(r)) return false;
      if (fE && String(r.empresa || '').toUpperCase() !== fE) return false;
      if (fF && String(r.fundo || '').trim() !== fF) return false;
      if (fT && r.tipo !== fT) return false;
      if (fS === 'abiertos' ? String(r.estado || '') === 'Cerrado' : (fS && r.estado !== fS)) return false;
      if (fP && r.prioridad !== fP) return false;
      if (fA && ymd(r.fecha_deteccion).slice(0, 4) !== fA) return false;
      if (q) { var h = [r.codigo, r.dni, r.nombre, r.fundo, r.responsable, r.tipo, r.descripcion].join(' ').toLowerCase(); if (h.indexOf(q) < 0) return false; }
      return true;
    }).sort(function (a, b) { return Number(b.id) - Number(a.id); });
  }

  function kpis(L) {
    var ab = L.filter(function (r) { return r.estado !== 'Cerrado' && !anulado(r); });
    var alta = ab.filter(function (r) { return r.prioridad === 'Alta'; }).length;
    var vis = ab.filter(function (r) { return r.estado === 'Visita pendiente' || (r.accion_inmediata === 'Visita domiciliaria' && !Number(r.numero_seguimientos)); }).length;
    var ven = ab.filter(function (r) { return ymd(r.fecha_programada) && ymd(r.fecha_programada) < hoy(); }).length;
    var cer = L.filter(function (r) { return r.estado === 'Cerrado' && !anulado(r); }).length;
    var card = function (l, v, s, c) { return '<div class="bs-card gs-kpi"><div class="l">' + l + '</div><div class="v" style="color:' + c + '">' + v + '</div><div class="s">' + s + '</div></div>'; };
    $('kpis').innerHTML = card('Casos abiertos', ab.length, alta + ' de prioridad alta', '#0a2463') + card('Visitas pendientes', vis, 'domiciliarias por realizar', vis ? '#b45309' : '#15803d') +
      card('Acciones vencidas', ven, 'fecha programada ya pasó', ven ? '#b91c1c' : '#15803d') + card('Cerrados', cer, 'con resultado registrado', '#15803d');
  }

  function render() {
    var L = filtrados(); kpis(L);
    $('nLista').textContent = '(' + L.length + ')';
    var cont = $('p-lista');
    if (!L.length) { cont.innerHTML = '<div class="bs-text-center bs-text-muted" style="padding:2rem">No hay casos con estos filtros. Registra el primero con <b>＋ Nuevo caso social</b>.</div>'; window.__BS_EXPORT_DATA__ = []; return; }
    window.__BS_EXPORT_DATA__ = L.map(function (r) { return { Codigo: r.codigo, Fecha: fecha(r.fecha_deteccion), DNI: r.dni, Trabajador: r.nombre, Empresa: r.empresa, Fundo: r.fundo, Tipo: r.tipo, Prioridad: r.prioridad, Origen: r.origen, Accion: r.accion_inmediata, Programada: fecha(r.fecha_programada), Derivacion: r.derivacion, Responsable: r.responsable, Estado: r.estado, Seguimientos: r.numero_seguimientos, Cierre: fecha(r.fecha_cierre), Resultado: r.resultado, Reservado: r.reservado }; });
    cont.innerHTML = '<div class="bs-table-wrap"><table class="bs-table"><thead><tr><th>Código</th><th>Trabajador</th><th>Fundo</th><th>Tipo</th><th>Prioridad</th><th>Detectado</th><th>Próxima acción</th><th>Responsable</th><th>Seg.</th><th>Estado</th><th></th></tr></thead><tbody>' +
      L.map(function (r) {
        var an = anulado(r), prog = ymd(r.fecha_programada), venc = prog && prog < hoy() && r.estado !== 'Cerrado';
        return '<tr' + (an ? ' style="opacity:.55"' : '') + '><td><b>' + esc(r.codigo || ('#' + r.id)) + '</b>' + (String(r.reservado).toUpperCase() === 'SI' ? '<br><span class="gs-res">RESERVADO</span>' : '') + '</td>' +
          '<td><b>' + esc(r.nombre) + '</b><br><span class="bs-text-xs bs-text-muted">DNI ' + esc(r.dni) + ' · ' + esc(r.empresa) + '</span></td><td>' + esc(r.fundo || '—') + '</td><td>' + esc(r.tipo) + '</td><td>' + prio(r.prioridad) + '</td>' +
          '<td>' + fecha(r.fecha_deteccion) + '<br><span class="bs-text-xs bs-text-muted">hace ' + dias(r.fecha_deteccion) + ' d</span></td>' +
          '<td>' + esc(r.accion_inmediata || '—') + (prog ? '<br><span class="bs-text-xs" style="color:' + (venc ? '#b91c1c;font-weight:700' : '#5b6785') + '">' + fecha(prog) + (venc ? ' · vencida' : '') + '</span>' : '') + '</td>' +
          '<td>' + esc(r.responsable || '—') + '</td><td style="text-align:center">' + (Number(r.numero_seguimientos) || 0) + '</td><td>' + (an ? '<span class="gs-pill anulado">ANULADO</span>' : pill(r.estado)) + '</td>' +
          '<td style="white-space:nowrap"><button class="bs-btn bs-btn-outline bs-btn-sm" onclick="verCaso(' + Number(r.id) + ')">Ver</button> ' +
          (an ? (esAdmin ? '<button class="bs-btn bs-btn-outline bs-btn-sm" onclick="restaurar(' + Number(r.id) + ')">Restaurar</button>' : '') : '<button class="bs-btn bs-btn-outline bs-btn-sm" onclick="editar(' + Number(r.id) + ')">Editar</button> <button class="bs-btn bs-btn-outline bs-btn-sm" title="Eliminar (se puede restaurar)" onclick="gsEliminar(' + Number(r.id) + ",'bs_gs_casos','el caso " + esc(r.codigo || '#' + r.id) + "')\">🗑</button>") + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function renderAlertas() {
    var L = DATA.filter(function (r) { return !anulado(r) && r.estado !== 'Cerrado'; }), A = [];
    L.forEach(function (r) {
      var prog = ymd(r.fecha_programada);
      if (prog && prog < hoy()) A.push({ n: 'rojo', t: (r.accion_inmediata || 'Acción') + ' vencida desde el ' + fecha(prog), r: r });
      if (r.prioridad === 'Alta' && dias(r.fecha_deteccion) > 2 && !Number(r.numero_seguimientos)) A.push({ n: 'rojo', t: 'Prioridad alta sin ninguna acción registrada (' + dias(r.fecha_deteccion) + ' días)', r: r });
      if (dias(r.fecha_deteccion) > 30 && r.estado !== 'Derivado') A.push({ n: 'ambar', t: 'Caso abierto hace ' + dias(r.fecha_deteccion) + ' días sin cerrar', r: r });
      if (prog && prog === hoy()) A.push({ n: 'info', t: (r.accion_inmediata || 'Acción') + ' programada para hoy', r: r });
    });
    $('nAlertas').textContent = A.length ? '(' + A.length + ')' : '';
    $('p-alertas').innerHTML = A.length ? '<div style="display:flex;flex-direction:column;gap:.5rem">' + A.map(function (a) { return '<div class="gs-alert ' + a.n + '"><div style="flex:1"><div class="nm">' + esc(a.r.codigo) + ' · ' + esc(a.r.nombre) + ' · ' + esc(a.r.fundo || '') + '</div><div class="bs-text-sm">' + esc(a.t) + '</div></div><button class="bs-btn bs-btn-outline bs-btn-sm" onclick="verCaso(' + Number(a.r.id) + ')">Ver</button></div>'; }).join('') + '</div>'
      : '<div class="bs-text-center bs-text-muted" style="padding:2rem">Sin alertas: no hay acciones vencidas ni casos de prioridad alta sin atender.</div>';
  }

  // ===== FORMULARIO =====
  function limpiar() { CAMPOS.forEach(function (f) { var el = $(f); if (el) el.value = ''; }); $('gsId').value = ''; $('reservado').checked = true; $('anteBox').style.display = 'none'; $('prioridad').value = 'Media'; $('estado').value = 'Abierto'; $('sede').value = 'PIURA'; $('derivacion').value = DERIVACIONES[0]; $('fecha_deteccion').value = hoy(); $('responsable').value = user.nombre || user.usuario; }
  function abrirNuevo() { limpiar(); $('formTitle').textContent = 'Nuevo caso social'; $('modalGS').classList.add('bs-active'); setTimeout(function () { $('dni').focus(); }, 50); }
  function editar(id) {
    var x = DATA.find(function (r) { return Number(r.id) === Number(id); }); if (!x) return;
    limpiar(); $('gsId').value = x.id; $('formTitle').textContent = 'Caso ' + (x.codigo || '#' + x.id);
    CAMPOS.forEach(function (f) { var el = $(f); if (!el) return; var v = x[f]; if (/^fecha/.test(f)) v = ymd(v); el.value = v == null ? '' : v; });
    if ($('derivacion').value === '') $('derivacion').value = DERIVACIONES[0];
    $('reservado').checked = String(x.reservado || 'SI').toUpperCase() !== 'NO';
    $('modalGS').classList.add('bs-active');
  }
  function cerrarModal() { $('modalGS').classList.remove('bs-active'); }
  async function autocompletar(dni) {
    var el = $('dni'); el.style.borderColor = '#f59e0b';
    var t = await bsBuscarTrabajador(dni);
    if (t) { $('nombre').value = t.nombre_completo || ''; if (t.empresa) $('empresa').value = String(t.empresa).toUpperCase(); if (t.zona_labor || t.zona_labores || t.zona) $('fundo').value = t.zona_labor || t.zona_labores || t.zona; if (t.oficio || t.cargo) $('cargo').value = t.oficio || t.cargo; }
    else el.style.borderColor = '#ef4444';
    setTimeout(function () { el.style.borderColor = ''; }, 2500);
    var ante = DATA.filter(function (r) { return String(r.dni) === String(dni) && !anulado(r) && String(r.id) !== $('gsId').value; });
    var box = $('anteBox');
    if (ante.length) { box.innerHTML = '<b>Antecedentes en Gestión Social:</b> ' + ante.map(function (r) { return esc(r.codigo) + ' · ' + esc(r.tipo) + ' · ' + esc(r.estado) + ' (' + fecha(r.fecha_deteccion) + ')'; }).join(' · '); box.style.display = 'block'; }
    else box.style.display = 'none';
  }
  async function guardar(ev) {
    ev.preventDefault();
    var btn = $('btnGuardar'); btn.disabled = true; btn.textContent = 'Guardando…';
    var d = {}; CAMPOS.forEach(function (f) { var el = $(f); d[f] = el ? String(el.value || '').trim() : ''; });
    d.nombre = d.nombre.toUpperCase(); d.reservado = $('reservado').checked ? 'SI' : 'NO';
    if (d.derivacion === DERIVACIONES[0]) d.derivacion = '';
    if (!/^\d{8}$/.test(d.dni)) { appAlert('El DNI debe tener 8 dígitos.'); btn.disabled = false; btn.textContent = '💾 Guardar'; return; }
    if (d.estado === 'Cerrado' && !d.resultado) { appAlert('Para cerrar el caso indica el resultado.'); btn.disabled = false; btn.textContent = '💾 Guardar'; return; }
    try {
      var id = $('gsId').value;
      var r = id ? await api('bs_actualizarGsCaso', { id: id, datos: d }) : await api('bs_crearGsCaso', { datos: d });
      if (!r || !r.ok) { appAlert((r && r.message) || 'No se pudo guardar.'); return; }
      /* _BS_GESTION_SOCIAL_V3: si el caso nació de un mensaje del canal anónimo, ese mensaje queda Derivado al código del caso */
      if (!id && CANAL.id) { try { await api('bs_actualizarCanal', { id: CANAL.id, datos: { estado: 'Derivado', derivado_a: r.codigo || ('GS #' + r.id), respuesta: 'Convertido en caso social ' + (r.codigo || '#' + r.id), atendido_por: user.nombre || user.usuario } }); } catch (e2) {} CANAL = {}; history.replaceState(null, '', location.pathname); }
      cerrarModal(); appAlert(r.message || (id ? 'Caso actualizado.' : 'Caso registrado.')); cargar();
    } catch (e) { appAlert('Error: ' + e.message); }
    finally { btn.disabled = false; btn.textContent = '💾 Guardar'; }
  }

  // ===== DETALLE + SEGUIMIENTOS =====
  async function verCaso(id) {
    var x = DATA.find(function (r) { return Number(r.id) === Number(id); }); if (!x) return;
    $('detTitle').textContent = (x.codigo || '#' + x.id) + ' · ' + (x.nombre || '');
    var b = $('detBody'); b.innerHTML = '<div class="bs-text-center" style="padding:1.5rem"><div class="bs-spinner bs-spinner-dark" style="margin:0 auto"></div></div>';
    $('modalDet').classList.add('bs-active');
    var S = [];
    try { var r = await api('bs_listarGsSeguimientos', { id_caso: x.id }); S = (r && r.items) || []; } catch (e) {}
    var fila = function (k, v) { return '<div style="display:grid;grid-template-columns:150px 1fr;gap:.3rem .8rem;font-size:.9rem"><span class="bs-text-muted">' + k + '</span><span>' + (v || '—') + '</span></div>'; };
    b.innerHTML =
      '<div class="bs-flex" style="gap:.5rem;flex-wrap:wrap;margin-bottom:.8rem">' + pill(x.estado) + prio(x.prioridad) + (String(x.reservado).toUpperCase() === 'SI' ? '<span class="gs-pill" style="background:#fef3c7;color:#92400e">RESERVADO</span>' : '') + '</div>' +
      '<div style="display:flex;flex-direction:column;gap:.3rem">' + fila('Trabajador', esc(x.nombre) + ' · DNI ' + esc(x.dni) + ' · ' + esc(x.empresa) + ' · ' + esc(x.fundo || '') + (x.cargo ? ' · ' + esc(x.cargo) : '')) + fila('Tipo', esc(x.tipo)) + fila('Detectado', fecha(x.fecha_deteccion) + ' · ' + esc(x.origen || '')) +
      fila('Descripción', esc(x.descripcion)) + fila('Acción inmediata', esc(x.accion_inmediata) + (ymd(x.fecha_programada) ? ' · ' + fecha(x.fecha_programada) : '')) + fila('Derivación', esc(x.derivacion || '—')) + fila('Responsable', esc(x.responsable)) + fila('Compromisos', esc(x.compromisos || '—')) +
      (x.estado === 'Cerrado' ? fila('Cierre', fecha(x.fecha_cierre) + ' · ' + esc(x.resultado || '')) : '') + fila('Registro', esc(x.created_by || '') + ' · ' + fecha(x.created_at) + (x.updated_by ? ' · últ. cambio ' + esc(x.updated_by) + ' ' + fecha(x.updated_at) : '')) + '</div>' +
      '<div class="gs-sec" style="margin-top:1.2rem">SEGUIMIENTOS (' + S.length + ')</div>' +
      '<div class="gs-tl">' + (S.length ? S.map(function (s) { return '<div class="it"><b>#' + esc(s.numero_seguimiento) + ' · ' + esc(s.tipo || 'Seguimiento') + '</b> · ' + fecha(s.fecha_seguimiento) + ' · <span class="bs-text-muted">' + esc(s.created_by || '') + '</span><div style="margin-top:.25rem">' + esc(s.detalle) + '</div>' + (s.acuerdos ? '<div class="bs-text-sm" style="margin-top:.2rem"><b>Acuerdos:</b> ' + esc(s.acuerdos) + '</div>' : '') + (ymd(s.proxima_fecha) ? '<div class="bs-text-sm"><b>Próxima fecha:</b> ' + fecha(s.proxima_fecha) + '</div>' : '') + (s.ubicacion ? '<div class="bs-text-xs bs-text-muted">Ubicación: ' + esc(s.ubicacion) + '</div>' : '') + '</div>'; }).join('') : '<div class="bs-text-muted bs-text-sm">Todavía no hay seguimientos.</div>') + '</div>' +
      (anulado(x) || x.estado === 'Cerrado' ? '' :
      '<form onsubmit="return window.gsSeguimiento(event,' + Number(x.id) + ')" style="margin-top:1rem;border-top:1px solid #dde3ef;padding-top:.8rem"><div class="gs-sec">NUEVO SEGUIMIENTO</div><div class="bs-grid bs-grid-3 bs-gap">' +
      '<div class="bs-form-group"><label class="bs-label">Tipo</label><select class="bs-select" id="sgTipo">' + TIPOS_SEG.map(function (t) { return '<option>' + esc(t) + '</option>'; }).join('') + '</select></div>' +
      '<div class="bs-form-group"><label class="bs-label">Fecha</label><input type="date" class="bs-input" id="sgFecha" value="' + hoy() + '"></div>' +
      '<div class="bs-form-group"><label class="bs-label">Próxima fecha</label><input type="date" class="bs-input" id="sgProx"></div>' +
      '<div class="bs-form-group" style="grid-column: span 3;"><label class="bs-label">Detalle *</label><textarea class="bs-textarea" id="sgDet" rows="2" required></textarea></div>' +
      '<div class="bs-form-group" style="grid-column: span 2;"><label class="bs-label">Acuerdos</label><input class="bs-input" id="sgAcu"></div>' +
      '<div class="bs-form-group"><label class="bs-label">Ubicación (visita)</label><input class="bs-input" id="sgUbi" placeholder="Dirección o referencia"><button type="button" class="bs-btn bs-btn-outline bs-btn-sm" style="margin-top:.3rem" onclick="window.gsUbicacion()">📍 Tomar ubicación</button></div>' +
      '</div><div class="bs-flex bs-justify-between" style="gap:.5rem;flex-wrap:wrap;margin-top:.5rem"><span class="bs-text-xs bs-text-muted">Cada seguimiento queda con usuario, fecha y hora en la auditoría.</span><div class="bs-flex" style="gap:.5rem">' +
      '<button type="button" class="bs-btn bs-btn-outline" onclick="window.gsAnular(' + Number(x.id) + ')">Anular caso</button>' + '<button type="submit" class="bs-btn bs-btn-gs" id="sgBtn">＋ Registrar seguimiento</button></div></div></form>');
  }
  function cerrarDet() { $('modalDet').classList.remove('bs-active'); }
  window.gsSeguimiento = async function (ev, id) {
    ev.preventDefault();
    var btn = $('sgBtn'); btn.disabled = true;
    var d = { tipo: $('sgTipo').value, fecha_seguimiento: $('sgFecha').value, proxima_fecha: $('sgProx').value, detalle: $('sgDet').value.trim(), acuerdos: $('sgAcu').value.trim(), ubicacion: $('sgUbi').value.trim() };
    try {
      var r = await api('bs_crearGsSeguimiento', { id_caso: id, datos: d });
      if (!r || !r.ok) { appAlert((r && r.message) || 'No se pudo registrar.'); return; }
      var x = DATA.find(function (c) { return Number(c.id) === Number(id); });
      if (x && d.tipo === 'Visita domiciliaria' && x.estado === 'Visita pendiente') { try { await api('bs_actualizarGsCaso', { id: id, datos: { estado: 'En seguimiento' } }); } catch (e) {} }
      await cargar(); verCaso(id);
    } catch (e) { appAlert('Error: ' + e.message); }
    finally { btn.disabled = false; }
    return false;
  };
  window.gsUbicacion = function () {
    if (!navigator.geolocation) { appAlert('Este dispositivo no permite tomar la ubicación.'); return; }
    navigator.geolocation.getCurrentPosition(function (p) { $('sgUbi').value = p.coords.latitude.toFixed(6) + ', ' + p.coords.longitude.toFixed(6); }, function () { appAlert('No se pudo obtener la ubicación. Escríbela a mano.'); }, { enableHighAccuracy: true, timeout: 10000 });
  };
  window.gsAnular = async function (id) {
    var x = DATA.find(function (c) { return Number(c.id) === Number(id); }); if (!x) return;
    var motivo = await appPrompt('Motivo de la anulación del caso ' + (x.codigo || '#' + id) + ':'); if (!motivo) return;
    try { var r = await api('bs_anularRegistro', { modulo: 'gestion_social', id: id, motivo: motivo }); appAlert(r.message || (r.ok ? 'Caso anulado.' : 'No se pudo anular.')); if (r.ok) { cerrarDet(); cargar(); } }
    catch (e) { appAlert('Error: ' + e.message); }
  };
  async function restaurar(id) {
    if (!(await appConfirm('¿Restaurar el caso #' + id + '?'))) return;
    try { var r = await api('bs_restaurarRegistro', { modulo: 'gestion_social', id: id, motivo: 'Restaurado desde el módulo' }); appAlert(r.message || (r.ok ? 'Caso restaurado.' : 'No se pudo restaurar.')); if (r.ok) cargar(); }
    catch (e) { appAlert('Error: ' + e.message); }
  }

  /* _BS_ELIMINAR_V1 (15-nov-2026, pedido de Joel): botón Eliminar en cada fila. En Supabase "eliminar" = anular con motivo
     (queda quién/cuándo/por qué, sale de las pantallas y el administrador puede restaurarlo con "Ver anulados"). */
  window.gsEliminar = async function (id, clave, etiqueta) {
    var motivo = await appPrompt('¿Eliminar ' + etiqueta + '? Indica el motivo (p. ej. registro equivocado, duplicado):'); if (!motivo) return;
    try { var r = await api('bs_anularRegistro', { modulo: 'gestion_social', clave: clave, id: id, motivo: motivo }); appAlert(r.message || (r.ok ? 'Eliminado.' : 'No se pudo eliminar.')); if (r.ok) { try { cerrarDet(); } catch (e) {} try { cerrarAt(); } catch (e) {} cargar(); } }
    catch (e) { appAlert('Error: ' + e.message); }
  };
  // ===== TABS Y ARRANQUE =====
  document.querySelectorAll('#tabs button').forEach(function (b) { b.onclick = function () { TAB = b.getAttribute('data-t'); document.querySelectorAll('#tabs button').forEach(function (x) { x.classList.toggle('on', x === b); }); ['lista', 'alertas'].forEach(function (t) { $('p-' + t).hidden = t !== TAB; }); }; });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { cerrarModal(); cerrarDet(); } });
  window.cargar = cargar; window.render = render; window.abrirNuevo = abrirNuevo; window.editar = editar; window.cerrarModal = cerrarModal; window.autocompletar = autocompletar; window.guardar = guardar; window.verCaso = verCaso; window.cerrarDet = cerrarDet; window.restaurar = restaurar;
  /* _BS_GESTION_SOCIAL_V3: llegada desde el canal anónimo (modulos/canal.html → "→ Caso social") */
  var QS = new URLSearchParams(location.search), CANAL = QS.get('canal') ? { id: QS.get('canal'), cq: QS.get('cq') || '' } : {};
  function abrirDesdeCanal() {
    abrirNuevo();
    $('origen').value = 'Canal de quejas / sugerencias'; $('descripcion').value = QS.get('t') || '';
    if (QS.get('e')) $('empresa').value = String(QS.get('e')).toUpperCase(); if (QS.get('f')) $('fundo').value = QS.get('f'); if (QS.get('s')) $('sede').value = String(QS.get('s')).toUpperCase();
    $('compromisos').value = 'Origen: mensaje anónimo ' + CANAL.cq + '. Identificar al trabajador solo si él lo autoriza.';
    var box = $('anteBox'); box.innerHTML = '<b>Caso derivado del canal anónimo ' + esc(CANAL.cq) + '.</b> El mensaje no trae DNI: si no se identifica al trabajador, usa DNI 00000000 y descríbelo en la descripción.'; box.style.display = 'block';
  }
  verificarAcceso().then(function (ok) {
    if (ok) { cargar().then(function () { if (CANAL.id) abrirDesdeCanal(); }); return; }
    document.getElementById('p-lista').innerHTML = '<div class="bs-alert bs-alert-danger"><strong>Sin acceso a Gestión Social.</strong> Pide al administrador que active <b>Bienestar → Gestión Social</b> para tu usuario en "Acceso a Módulos" del Sistema RR.LL. y vuelve a ingresar.</div>';
    document.querySelectorAll('.bs-btn-gs').forEach(function (b) { b.disabled = true; });
  });
})();
