/* Bienestar Social · modulos/gestantes.html · _BS_GESTION_SOCIAL_V2 (14-nov-2026)
   Gestión Social, etapa 2: Gestantes y lactancia. Todo en Supabase vía bs-guardar-supabase.js
   (bs_listarGestantes, bs_crearGestante, bs_actualizarGestante, bs_anularRegistro / bs_restaurarRegistro con modulo 'gestion_social').
   Las fechas legales (descanso pre/postnatal, lactancia) las calcula el SERVIDOR; aquí solo se previsualizan. */
(function () {
  'use strict';

  var session = localStorage.getItem('bienestarSocialAuth');
  if (!session) { window.location.href = '../index.html'; return; }
  var user;
  try { user = JSON.parse(session); if (!user || !user.usuario) throw new Error(); }
  catch (e) { window.location.href = '../index.html'; return; }
  var esAdmin = /admin|geren/i.test(user.rol || '') || user.esAdminRL === true || ['jtimoteo'].indexOf((user.usuario || '').toLowerCase()) >= 0;
  document.getElementById('userName').textContent = user.nombre || user.usuario;
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

  var CAMPOS = ['dni', 'nombre', 'empresa', 'fundo', 'cargo', 'sede', 'responsable', 'fecha_comunicacion', 'fecha_probable_parto', 'fecha_parto_real', 'dias_prenatal', 'dias_adicionales', 'certificado_citt', 'riesgo_puesto', 'reubicada', 'fecha_reubicacion', 'puesto_reubicada', 'subsidio_tramitado', 'lactario', 'observaciones', 'estado', 'motivo_cierre'];
  var DATA = [], TAB = 'lista';
  var $ = function (id) { return document.getElementById(id); };
  var hoy = function () { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  var ymd = function (v) { if (!v) return ''; var m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[1] + '-' + m[2] + '-' + m[3] : ''; };
  var fecha = function (v) { var y = ymd(v); return y ? y.split('-').reverse().join('/') : '—'; };
  var D = function (y) { return y ? new Date(y + 'T00:00:00') : null; };
  var dias = function (a, b) { a = ymd(a); b = ymd(b || hoy()); if (!a || !b) return 0; return Math.round((D(b) - D(a)) / 86400000); };
  var suma = function (y, n) { var d = D(y); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  var anulado = function (r) { return String(r.anulado || '').trim() !== ''; };
  var SI = function (v) { return String(v || '').toUpperCase() === 'SI'; };

  /* etapa calculada HOY con las fechas que guardó el servidor (el estado guardado es una foto del día en que se grabó) */
  function etapa(r) {
    if (anulado(r)) return 'Anulado';
    if (r.estado === 'Cerrado') return 'Cerrado';
    var h = hoy(), pi = ymd(r.descanso_pre_inicio), po = ymd(r.descanso_post_inicio), pf = ymd(r.descanso_post_fin), la = ymd(r.lactancia_hasta);
    if (!po) return 'Gestante';
    if ((pi && h < pi) || (!pi && h < po)) return 'Gestante';
    if (h < po) return 'Descanso prenatal';
    if (h <= pf) return 'Descanso postnatal';
    if (h <= la) return 'Lactancia';
    return 'Concluido';
  }
  function semanas(r) { var fpp = ymd(r.fecha_probable_parto); if (!fpp || ymd(r.fecha_parto_real)) return null; var sem = 40 - Math.round(dias(hoy(), fpp) / 7); return sem < 0 ? null : sem; }
  var pill = function (e) { var k = { 'Gestante': 'gestante', 'Descanso prenatal': 'prenatal', 'Descanso postnatal': 'postnatal', 'Lactancia': 'lactancia', 'Concluido': 'concluido', 'Cerrado': 'cerrado', 'Anulado': 'anulado' }[e] || 'gestante'; return '<span class="gs-pill ' + k + '">' + esc(e) + '</span>'; };

  async function cargar() {
    var cont = $('p-lista');
    cont.innerHTML = '<div class="bs-text-center" style="padding:2rem"><div class="bs-spinner bs-spinner-dark" style="margin:0 auto"></div></div>';
    try {
      var r = await api('bs_listarGestantes', {});
      if (!r || !r.ok) { cont.innerHTML = '<div class="bs-alert bs-alert-danger"><strong>No se pudo leer de Supabase:</strong> ' + esc((r && r.message) || 'sin respuesta') + '</div>'; return; }
      DATA = r.items || [];
      var fundos = {}; DATA.forEach(function (x) { if (x.fundo) fundos[String(x.fundo).trim()] = 1; });
      var s = $('fFundo'), cur = s.value; s.innerHTML = '<option value="">Todos</option>' + Object.keys(fundos).sort().map(function (f) { return '<option>' + esc(f) + '</option>'; }).join(''); s.value = cur;
      render(); renderAlertas(); renderCalendario();
    } catch (e) { cont.innerHTML = '<div class="bs-alert bs-alert-danger">Error: ' + esc(e.message) + '</div>'; }
  }

  function filtrados() {
    var fE = $('fEmpresa').value, fF = $('fFundo').value, fS = $('fEstado').value, q = ($('fTexto').value || '').toLowerCase().trim(), verAn = $('fAnulados').checked;
    return DATA.filter(function (r) {
      if (!verAn && anulado(r)) return false;
      var et = etapa(r);
      if (fS === '' ? (et === 'Concluido' || et === 'Cerrado') : (fS !== 'todos' && et !== fS)) return false;
      if (fE && String(r.empresa || '').toUpperCase() !== fE) return false;
      if (fF && String(r.fundo || '').trim() !== fF) return false;
      if (q) { var h = [r.codigo, r.dni, r.nombre, r.fundo, r.cargo, r.responsable].join(' ').toLowerCase(); if (h.indexOf(q) < 0) return false; }
      return true;
    }).sort(function (a, b) { return (ymd(a.fecha_probable_parto) || '9999') < (ymd(b.fecha_probable_parto) || '9999') ? -1 : 1; });
  }

  function kpis() {
    var V = DATA.filter(function (r) { return !anulado(r) && r.estado !== 'Cerrado'; }), c = {};
    V.forEach(function (r) { var e = etapa(r); c[e] = (c[e] || 0) + 1; });
    var riesgo = V.filter(function (r) { return SI(r.riesgo_puesto) && !SI(r.reubicada) && etapa(r) === 'Gestante'; }).length;
    var card = function (l, v, s, col) { return '<div class="bs-card gs-kpi"><div class="l">' + l + '</div><div class="v" style="color:' + col + '">' + v + '</div><div class="s">' + s + '</div></div>'; };
    $('kpis').innerHTML = card('Gestantes en labores', c['Gestante'] || 0, riesgo + ' en puesto de riesgo sin reubicar', riesgo ? '#b91c1c' : '#9d174d') +
      card('En descanso', (c['Descanso prenatal'] || 0) + (c['Descanso postnatal'] || 0), (c['Descanso prenatal'] || 0) + ' prenatal · ' + (c['Descanso postnatal'] || 0) + ' postnatal', '#9a3412') +
      card('En lactancia', c['Lactancia'] || 0, 'con derecho a 1 hora diaria', '#1e3a8a') +
      card('Concluidos', c['Concluido'] || 0, 'lactancia terminada', '#166534');
  }

  function render() {
    var L = filtrados(); kpis();
    $('nLista').textContent = '(' + L.length + ')';
    var cont = $('p-lista');
    if (!L.length) { cont.innerHTML = '<div class="bs-text-center bs-text-muted" style="padding:2rem">No hay registros con estos filtros.</div>'; window.__BS_EXPORT_DATA__ = []; return; }
    window.__BS_EXPORT_DATA__ = L.map(function (r) { return { Codigo: r.codigo, DNI: r.dni, Trabajadora: r.nombre, Empresa: r.empresa, Fundo: r.fundo, Cargo: r.cargo, Comunico: fecha(r.fecha_comunicacion), FPP: fecha(r.fecha_probable_parto), Parto: fecha(r.fecha_parto_real), PrenatalInicio: fecha(r.descanso_pre_inicio), PostnatalFin: fecha(r.descanso_post_fin), LactanciaHasta: fecha(r.lactancia_hasta), Riesgo: r.riesgo_puesto, Reubicada: r.reubicada, Subsidio: r.subsidio_tramitado, Etapa: etapa(r), Responsable: r.responsable }; });
    cont.innerHTML = '<div class="bs-table-wrap"><table class="bs-table"><thead><tr><th>Código</th><th>Trabajadora</th><th>Fundo · cargo</th><th>Etapa</th><th>FPP / parto</th><th>Descanso</th><th>Lactancia hasta</th><th>Riesgo</th><th></th></tr></thead><tbody>' +
      L.map(function (r) {
        var et = etapa(r), sem = semanas(r), riesgo = SI(r.riesgo_puesto);
        return '<tr' + (anulado(r) ? ' style="opacity:.55"' : '') + '><td><b>' + esc(r.codigo || ('#' + r.id)) + '</b></td>' +
          '<td><b>' + esc(r.nombre) + '</b><br><span class="bs-text-xs bs-text-muted">DNI ' + esc(r.dni) + ' · ' + esc(r.empresa) + '</span></td>' +
          '<td>' + esc(r.fundo || '—') + (r.cargo ? '<br><span class="bs-text-xs bs-text-muted">' + esc(r.cargo) + '</span>' : '') + '</td>' +
          '<td>' + pill(et) + (sem !== null && et === 'Gestante' ? '<br><span class="bs-text-xs bs-text-muted">~' + sem + ' semanas</span>' : '') + '</td>' +
          '<td>' + fecha(r.fecha_probable_parto) + (ymd(r.fecha_parto_real) ? '<br><span class="bs-text-xs" style="color:#9a3412">nació ' + fecha(r.fecha_parto_real) + '</span>' : '') + '</td>' +
          '<td class="bs-text-sm">' + (ymd(r.descanso_post_inicio) ? (ymd(r.descanso_pre_inicio) ? fecha(r.descanso_pre_inicio) : fecha(r.descanso_post_inicio)) + ' → ' + fecha(r.descanso_post_fin) + '<br><span class="bs-text-xs bs-text-muted">' + (98 + (Number(r.dias_adicionales) || 0)) + ' días</span>' : '—') + '</td>' +
          '<td>' + fecha(r.lactancia_hasta) + '</td>' +
          '<td>' + (riesgo ? (SI(r.reubicada) ? '<span class="gs-pill ok">Reubicada</span>' : '<span class="gs-pill si">Riesgo sin reubicar</span>') : '<span class="bs-text-muted">—</span>') + '</td>' +
          '<td style="white-space:nowrap"><button class="bs-btn bs-btn-outline bs-btn-sm" onclick="verCaso(' + Number(r.id) + ')">Ver</button> ' +
          (anulado(r) ? (esAdmin ? '<button class="bs-btn bs-btn-outline bs-btn-sm" onclick="restaurar(' + Number(r.id) + ')">Restaurar</button>' : '') : '<button class="bs-btn bs-btn-outline bs-btn-sm" onclick="editar(' + Number(r.id) + ')">Editar</button>') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function alertasDe(r) {
    var A = [], et = etapa(r), h = hoy();
    if (et === 'Gestante' && SI(r.riesgo_puesto) && !SI(r.reubicada)) A.push({ n: 'rojo', t: 'Puesto de riesgo sin reubicación (Ley 28048) · comunicó hace ' + dias(r.fecha_comunicacion) + ' días' });
    if (et === 'Gestante' && !ymd(r.fecha_probable_parto)) A.push({ n: 'ambar', t: 'Sin fecha probable de parto: no se pueden programar los descansos' });
    var pi = ymd(r.descanso_pre_inicio) || ymd(r.descanso_post_inicio);
    if (et === 'Gestante' && pi) { var d = dias(h, pi); if (d >= 0 && d <= 15) A.push({ n: 'ambar', t: 'El descanso inicia en ' + d + ' días (' + fecha(pi) + '): coordinar relevo y CITT' }); }
    if ((et === 'Descanso prenatal' || et === 'Descanso postnatal') && !SI(r.subsidio_tramitado)) A.push({ n: 'ambar', t: 'En descanso y el subsidio de maternidad aún no figura tramitado' });
    if (et === 'Descanso prenatal' && ymd(r.fecha_probable_parto) && h > ymd(r.fecha_probable_parto) && !ymd(r.fecha_parto_real)) A.push({ n: 'ambar', t: 'Pasó la FPP y no se registró la fecha real del parto' });
    if (et === 'Descanso postnatal') { var dr = dias(h, ymd(r.descanso_post_fin)); if (dr >= 0 && dr <= 10) A.push({ n: 'info', t: 'Retorna en ' + dr + ' días (' + fecha(r.descanso_post_fin) + '): preparar reincorporación y hora de lactancia' }); }
    if (et === 'Lactancia') { var dl = dias(h, ymd(r.lactancia_hasta)); if (dl >= 0 && dl <= 15) A.push({ n: 'info', t: 'La hora de lactancia termina en ' + dl + ' días (' + fecha(r.lactancia_hasta) + ')' }); }
    return A;
  }
  function renderAlertas() {
    var A = [];
    DATA.filter(function (r) { return !anulado(r) && r.estado !== 'Cerrado'; }).forEach(function (r) { alertasDe(r).forEach(function (a) { A.push({ a: a, r: r }); }); });
    var peso = { rojo: 0, ambar: 1, info: 2 }; A.sort(function (x, y) { return peso[x.a.n] - peso[y.a.n]; });
    $('nAlertas').textContent = A.length ? '(' + A.length + ')' : '';
    $('p-alertas').innerHTML = A.length ? '<div style="display:flex;flex-direction:column;gap:.5rem">' + A.map(function (x) { return '<div class="gs-alert ' + x.a.n + '"><div style="flex:1"><div class="nm"><b>' + esc(x.r.codigo) + '</b> · ' + esc(x.r.nombre) + ' · ' + esc(x.r.fundo || '') + '</div><div class="bs-text-sm">' + esc(x.a.t) + '</div></div><button class="bs-btn bs-btn-outline bs-btn-sm" onclick="verCaso(' + Number(x.r.id) + ')">Ver</button></div>'; }).join('') + '</div>'
      : '<div class="bs-text-center bs-text-muted" style="padding:2rem">Sin alertas.</div>';
  }
  function renderCalendario() {
    var h = hoy(), lim = suma(h, 60), E = [];
    DATA.filter(function (r) { return !anulado(r) && r.estado !== 'Cerrado'; }).forEach(function (r) {
      [['descanso_pre_inicio', 'Inicio descanso prenatal'], ['descanso_post_inicio', 'Inicio postnatal / FPP'], ['descanso_post_fin', 'Fin del descanso · retorno'], ['lactancia_hasta', 'Fin hora de lactancia']].forEach(function (p) {
        var f = ymd(r[p[0]]); if (f && f >= h && f <= lim) E.push({ f: f, t: p[1], r: r });
      });
    });
    E.sort(function (a, b) { return a.f < b.f ? -1 : 1; });
    $('nCal').textContent = E.length ? '(' + E.length + ')' : '';
    $('p-calendario').innerHTML = E.length ? '<div class="bs-table-wrap"><table class="bs-table"><thead><tr><th>Fecha</th><th>En</th><th>Evento</th><th>Trabajadora</th><th>Fundo</th></tr></thead><tbody>' + E.map(function (e) { return '<tr><td><b>' + fecha(e.f) + '</b></td><td>' + dias(h, e.f) + ' d</td><td>' + esc(e.t) + '</td><td>' + esc(e.r.nombre) + ' <span class="bs-text-xs bs-text-muted">' + esc(e.r.codigo) + '</span></td><td>' + esc(e.r.fundo || '—') + '</td></tr>'; }).join('') + '</tbody></table></div>'
      : '<div class="bs-text-center bs-text-muted" style="padding:2rem">Nada programado en los próximos 60 días.</div>';
  }

  /* ===== FORMULARIO ===== */
  function limpiar() { CAMPOS.forEach(function (f) { var el = $(f); if (el) el.value = ''; }); $('gsId').value = ''; $('sede').value = 'PIURA'; $('dias_prenatal').value = 49; $('dias_adicionales').value = '0'; ['riesgo_puesto', 'reubicada', 'subsidio_tramitado', 'lactario'].forEach(function (k) { $(k).value = 'NO'; }); $('fecha_comunicacion').value = hoy(); $('responsable').value = user.nombre || user.usuario; $('estado').value = ''; previsualizar(); }
  function abrirNuevo() { limpiar(); $('formTitle').textContent = 'Registrar gestante'; $('modalGS').classList.add('bs-active'); setTimeout(function () { $('dni').focus(); }, 50); }
  function editar(id) {
    var x = DATA.find(function (r) { return Number(r.id) === Number(id); }); if (!x) return;
    limpiar(); $('gsId').value = x.id; $('formTitle').textContent = 'Registro ' + (x.codigo || '#' + x.id);
    CAMPOS.forEach(function (f) { var el = $(f); if (!el) return; var v = x[f]; if (/^fecha/.test(f)) v = ymd(v); if (f === 'estado') v = v === 'Cerrado' ? 'Cerrado' : ''; if (f === 'dias_adicionales') v = Number(v) >= 30 ? '30' : '0'; el.value = v == null ? '' : v; });
    ['riesgo_puesto', 'reubicada', 'subsidio_tramitado', 'lactario'].forEach(function (k) { $(k).value = SI(x[k]) ? 'SI' : 'NO'; });
    previsualizar(); $('modalGS').classList.add('bs-active');
  }
  function cerrarModal() { $('modalGS').classList.remove('bs-active'); }
  /* previsualización: misma regla que el servidor (shared/bs-guardar.js NORMALIZAR.bs_gs_gestantes) */
  function previsualizar() {
    var box = $('calcBox'), fpp = $('fecha_probable_parto').value, real = $('fecha_parto_real').value, pre = Math.min(49, Math.max(0, Number($('dias_prenatal').value) || 0)), adic = Number($('dias_adicionales').value) || 0;
    if (!fpp) { box.hidden = true; return; }
    var ini = real || fpp, preI = pre ? suma(fpp, -pre) : '', preF = pre ? suma(fpp, -1) : '', postF = suma(ini, (98 - pre) + adic - 1), lac = D(ini); lac.setFullYear(lac.getFullYear() + 1);
    var lacY = lac.getFullYear() + '-' + String(lac.getMonth() + 1).padStart(2, '0') + '-' + String(lac.getDate()).padStart(2, '0');
    box.hidden = false;
    box.innerHTML = '<div><b>Prenatal</b>' + (pre ? fecha(preI) + ' → ' + fecha(preF) + ' (' + pre + ' d)' : 'Diferido al postnatal') + '</div>' +
      '<div><b>Postnatal</b>' + fecha(ini) + ' → ' + fecha(postF) + ' (' + ((98 - pre) + adic) + ' d)</div>' +
      '<div><b>Total descanso</b>' + (98 + adic) + ' días</div><div><b>Hora de lactancia hasta</b>' + fecha(lacY) + '</div>' +
      ($('riesgo_puesto').value === 'SI' && $('reubicada').value !== 'SI' ? '<div style="grid-column:1/-1;color:#b91c1c"><b>Atención</b>Puesto de riesgo sin reubicación: la Ley 28048 obliga a asignar labores sin riesgo sin afectar su remuneración.</div>' : '');
  }
  async function autocompletar(dni) {
    var el = $('dni'); el.style.borderColor = '#f59e0b';
    var t = await bsBuscarTrabajador(dni);
    if (t) { $('nombre').value = t.nombre_completo || ''; if (t.empresa) $('empresa').value = String(t.empresa).toUpperCase(); if (t.zona_labor || t.zona) $('fundo').value = t.zona_labor || t.zona; if (t.oficio || t.cargo) $('cargo').value = t.oficio || t.cargo; }
    else el.style.borderColor = '#ef4444';
    setTimeout(function () { el.style.borderColor = ''; }, 2500);
    var ante = DATA.filter(function (r) { return String(r.dni) === String(dni) && !anulado(r) && r.estado !== 'Cerrado' && String(r.id) !== $('gsId').value && etapa(r) !== 'Concluido'; });
    if (ante.length) appAlert('Esta trabajadora ya tiene un registro vigente: ' + ante.map(function (r) { return r.codigo + ' (' + etapa(r) + ')'; }).join(', ') + '. Edita ese registro en vez de crear otro.');
  }
  async function guardar(ev) {
    ev.preventDefault();
    var btn = $('btnGuardar'); btn.disabled = true; btn.textContent = 'Guardando…';
    var d = {}; CAMPOS.forEach(function (f) { var el = $(f); d[f] = el ? String(el.value || '').trim() : ''; });
    d.nombre = d.nombre.toUpperCase();
    var fin = function () { btn.disabled = false; btn.textContent = '💾 Guardar'; };
    if (!/^\d{8}$/.test(d.dni)) { appAlert('El DNI debe tener 8 dígitos.'); fin(); return; }
    if (d.estado === 'Cerrado' && !d.motivo_cierre) { appAlert('Indica el motivo de cierre.'); fin(); return; }
    if (d.riesgo_puesto === 'SI' && d.reubicada === 'SI' && !d.fecha_reubicacion) { appAlert('Indica la fecha de reubicación.'); fin(); return; }
    if (d.fecha_parto_real && d.fecha_probable_parto && Math.abs(dias(d.fecha_probable_parto, d.fecha_parto_real)) > 60) { appAlert('La fecha real del parto difiere más de 60 días de la FPP. Revisa las fechas.'); fin(); return; }
    try {
      var id = $('gsId').value;
      var r = id ? await api('bs_actualizarGestante', { id: id, datos: d }) : await api('bs_crearGestante', { datos: d });
      if (!r || !r.ok) { appAlert((r && r.message) || 'No se pudo guardar.'); return; }
      cerrarModal(); appAlert(r.message || 'Guardado.'); cargar();
    } catch (e) { appAlert('Error: ' + e.message); }
    finally { fin(); }
  }

  function verCaso(id) {
    var x = DATA.find(function (r) { return Number(r.id) === Number(id); }); if (!x) return;
    $('detTitle').textContent = (x.codigo || '#' + x.id) + ' · ' + (x.nombre || '');
    var fila = function (k, v) { return '<div style="display:grid;grid-template-columns:190px 1fr;gap:.3rem .8rem;font-size:.9rem"><span class="bs-text-muted">' + k + '</span><span>' + (v || '—') + '</span></div>'; };
    var A = alertasDe(x), et = etapa(x);
    $('detBody').innerHTML =
      '<div class="bs-flex" style="gap:.5rem;flex-wrap:wrap;margin-bottom:.8rem">' + pill(et) + (SI(x.riesgo_puesto) ? (SI(x.reubicada) ? '<span class="gs-pill ok">Reubicada</span>' : '<span class="gs-pill si">Riesgo sin reubicar</span>') : '') + (SI(x.subsidio_tramitado) ? '<span class="gs-pill ok">Subsidio tramitado</span>' : '') + '</div>' +
      (A.length ? '<div style="display:flex;flex-direction:column;gap:.4rem;margin-bottom:.8rem">' + A.map(function (a) { return '<div class="gs-alert ' + a.n + '"><span class="bs-text-sm">' + esc(a.t) + '</span></div>'; }).join('') + '</div>' : '') +
      '<div style="display:flex;flex-direction:column;gap:.3rem">' +
      fila('Trabajadora', esc(x.nombre) + ' · DNI ' + esc(x.dni) + ' · ' + esc(x.empresa) + ' · ' + esc(x.fundo || '') + (x.cargo ? ' · ' + esc(x.cargo) : '')) +
      fila('Comunicó el embarazo', fecha(x.fecha_comunicacion)) + fila('FPP / parto real', fecha(x.fecha_probable_parto) + (ymd(x.fecha_parto_real) ? ' · nació ' + fecha(x.fecha_parto_real) : '')) +
      fila('Descanso prenatal', ymd(x.descanso_pre_inicio) ? fecha(x.descanso_pre_inicio) + ' → ' + fecha(x.descanso_pre_fin) + ' (' + (Number(x.dias_prenatal) || 0) + ' d)' : (ymd(x.descanso_post_inicio) ? 'Diferido al postnatal' : '—')) +
      fila('Descanso postnatal', ymd(x.descanso_post_inicio) ? fecha(x.descanso_post_inicio) + ' → ' + fecha(x.descanso_post_fin) + ' (' + ((98 - (Number(x.dias_prenatal) || 0)) + (Number(x.dias_adicionales) || 0)) + ' d)' : '—') +
      fila('Hora de lactancia hasta', fecha(x.lactancia_hasta) + (SI(x.lactario) ? ' · usa lactario' : '')) +
      fila('Certificado / CITT', esc(x.certificado_citt || '—')) +
      fila('Riesgo del puesto', SI(x.riesgo_puesto) ? 'SÍ' + (SI(x.reubicada) ? ' · reubicada el ' + fecha(x.fecha_reubicacion) + (x.puesto_reubicada ? ' a: ' + esc(x.puesto_reubicada) : '') : ' · <b style="color:#b91c1c">sin reubicar</b>') : 'No') +
      fila('Responsable', esc(x.responsable)) + fila('Observaciones', esc(x.observaciones || '—')) +
      (x.estado === 'Cerrado' ? fila('Cierre', fecha(x.fecha_cierre) + ' · ' + esc(x.motivo_cierre || '')) : '') +
      fila('Registro', esc(x.created_by || '') + ' · ' + fecha(x.created_at) + (x.updated_by ? ' · últ. cambio ' + esc(x.updated_by) + ' ' + fecha(x.updated_at) : '')) + '</div>' +
      (anulado(x) ? '' : '<div class="bs-flex bs-justify-between" style="margin-top:1rem;gap:.5rem;flex-wrap:wrap"><button type="button" class="bs-btn bs-btn-outline" onclick="window.gsAnular(' + Number(x.id) + ')">Anular registro</button><button type="button" class="bs-btn bs-btn-gs" onclick="cerrarDet();editar(' + Number(x.id) + ')">✏️ Editar</button></div>');
    $('modalDet').classList.add('bs-active');
  }
  function cerrarDet() { $('modalDet').classList.remove('bs-active'); }
  window.gsAnular = async function (id) {
    var x = DATA.find(function (c) { return Number(c.id) === Number(id); }); if (!x) return;
    var motivo = await appPrompt('Motivo de la anulación del registro ' + (x.codigo || '#' + id) + ':'); if (!motivo) return;
    try { var r = await api('bs_anularRegistro', { modulo: 'gestion_social', clave: 'bs_gs_gestantes', id: id, motivo: motivo }); appAlert(r.message || (r.ok ? 'Registro anulado.' : 'No se pudo anular.')); if (r.ok) { cerrarDet(); cargar(); } }
    catch (e) { appAlert('Error: ' + e.message); }
  };
  async function restaurar(id) {
    if (!(await appConfirm('¿Restaurar el registro #' + id + '?'))) return;
    try { var r = await api('bs_restaurarRegistro', { modulo: 'gestion_social', clave: 'bs_gs_gestantes', id: id, motivo: 'Restaurado desde el módulo' }); appAlert(r.message || (r.ok ? 'Registro restaurado.' : 'No se pudo restaurar.')); if (r.ok) cargar(); }
    catch (e) { appAlert('Error: ' + e.message); }
  }

  document.querySelectorAll('#tabs button').forEach(function (b) { b.onclick = function () { TAB = b.getAttribute('data-t'); document.querySelectorAll('#tabs button').forEach(function (x) { x.classList.toggle('on', x === b); }); ['lista', 'alertas', 'calendario'].forEach(function (t) { $('p-' + t).hidden = t !== TAB; }); }; });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { cerrarModal(); cerrarDet(); } });
  window.cargar = cargar; window.render = render; window.abrirNuevo = abrirNuevo; window.editar = editar; window.cerrarModal = cerrarModal; window.autocompletar = autocompletar; window.guardar = guardar; window.verCaso = verCaso; window.cerrarDet = cerrarDet; window.restaurar = restaurar; window.previsualizar = previsualizar;
  verificarAcceso().then(function (ok) {
    if (ok) { cargar(); return; }
    $('p-lista').innerHTML = '<div class="bs-alert bs-alert-danger"><strong>Sin acceso a Gestión Social.</strong> Pide al administrador que active <b>Bienestar → Gestión Social</b> para tu usuario en "Acceso a Módulos" del Sistema RR.LL. y vuelve a ingresar.</div>';
    document.querySelectorAll('.bs-btn-gs').forEach(function (b) { b.disabled = true; });
  });
})();
