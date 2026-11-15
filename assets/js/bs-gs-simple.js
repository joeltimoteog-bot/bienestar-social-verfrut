/* Bienestar Social · bs-gs-simple.js · _BS_GESTION_SOCIAL_V6 (15-nov-2026)
   Motor común de los módulos de cumplimiento legal (consentimientos, comité, adolescentes, lactarios, discapacidad).
   Cada página define window.GS_CFG y este motor dibuja lista, filtros, KPIs, alertas, formulario, detalle, eliminar/restaurar.
   Todo va a Supabase por bs-guardar-supabase.js (acciones genéricas bs_gsListar / bs_gsCrear / bs_gsActualizar y
   bs_anularRegistro / bs_restaurarRegistro con modulo + clave). La búsqueda por DNI usa trabajadores.js (Supabase). */
(function () {
  'use strict';
  var C = window.GS_CFG; if (!C) return;
  var session = localStorage.getItem('bienestarSocialAuth');
  if (!session) { window.location.href = '../index.html'; return; }
  var user; try { user = JSON.parse(session); if (!user || !user.usuario) throw new Error(); } catch (e) { window.location.href = '../index.html'; return; }
  var esAdmin = /admin|geren/i.test(user.rol || '') || user.esAdminRL === true || ['jtimoteo'].indexOf((user.usuario || '').toLowerCase()) >= 0;
  var $ = function (id) { return document.getElementById(id); };
  if ($('userName')) $('userName').textContent = user.nombre || user.usuario;
  async function verificarAcceso() {
    if (esAdmin || (user.permisos && user.permisos[C.permiso])) return true;
    var rl = null; try { rl = window.bsPermisosRL ? await window.bsPermisosRL() : null; } catch (e) { rl = null; }
    if (rl && rl.ok && (rl.esAdmin || (rl.permisos && rl.permisos[C.permiso]))) { user.permisos = Object.assign({}, user.permisos || {}, rl.permisos || {}); if (rl.esAdmin) { user.esAdminRL = true; esAdmin = true; } try { localStorage.setItem('bienestarSocialAuth', JSON.stringify(user)); } catch (e) {} return true; }
    return false;
  }

  /* ---- utilidades expuestas a la configuración ---- */
  var U = window.GS_U = {
    hoy: function () { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); },
    ymd: function (v) { if (!v) return ''; var m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[1] + '-' + m[2] + '-' + m[3] : ''; },
    fecha: function (v) { var y = U.ymd(v); return y ? y.split('-').reverse().join('/') : '—'; },
    dias: function (a, b) { a = U.ymd(a); b = U.ymd(b || U.hoy()); if (!a || !b) return 0; return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000); },
    num: function (v) { var n = Number(v); return isNaN(n) ? 0 : n; },
    si: function (v) { return String(v || '').toUpperCase() === 'SI'; },
    anulado: function (r) { return String(r.anulado || '').trim() !== ''; },
    pill: function (t, cls) { return '<span class="gs-pill ' + (cls || '') + '">' + esc(t) + '</span>'; },
    sn: function (v) { return U.si(v) ? '<span class="gs-pill ok">Sí</span>' : '<span class="gs-pill no">No</span>'; },
    card: function (l, v, s, c) { return '<div class="bs-card gs-kpi"><div class="l">' + l + '</div><div class="v" style="color:' + (c || '#0a2463') + '">' + v + '</div><div class="s">' + (s || '') + '</div></div>'; },
    esc: function (s) { return esc(s); }
  };
  var DATA = [], TAB = 'lista';
  var CAMPOS = C.campos.filter(function (f) { return f.id; });

  /* ---- carga y filtros ---- */
  async function cargar() {
    var cont = $('p-lista'); cont.innerHTML = '<div class="bs-text-center" style="padding:2rem"><div class="bs-spinner bs-spinner-dark" style="margin:0 auto"></div></div>';
    try {
      var r = await api('bs_gsListar', { clave: C.clave });
      if (!r || !r.ok) { cont.innerHTML = '<div class="bs-alert bs-alert-danger"><strong>No se pudo leer de Supabase:</strong> ' + esc((r && r.message) || 'sin respuesta') + '</div>'; return; }
      DATA = (r.items || []).slice().sort(function (a, b) { return U.num(b.id) - U.num(a.id); });
      if (C.alCargar) { try { await C.alCargar(DATA, U); } catch (e) { console.warn(e); } }
      var fundos = {}; DATA.forEach(function (x) { if (x.fundo) fundos[String(x.fundo).trim()] = 1; });
      if ($('fFundo')) { var s = $('fFundo'), cur = s.value; s.innerHTML = '<option value="">Todos</option>' + Object.keys(fundos).sort().map(function (f) { return '<option>' + esc(f) + '</option>'; }).join(''); s.value = cur; }
      if ($('dlFundos')) $('dlFundos').innerHTML = Object.keys(fundos).sort().map(function (f) { return '<option value="' + esc(f) + '">'; }).join('');
      render();
    } catch (e) { cont.innerHTML = '<div class="bs-alert bs-alert-danger">Error: ' + esc(e.message) + '</div>'; }
  }
  function filtrados() {
    var fE = $('fEmpresa') ? $('fEmpresa').value : '', fF = $('fFundo') ? $('fFundo').value : '', fS = $('fEstado') ? $('fEstado').value : '', q = $('fTexto') ? ($('fTexto').value || '').toLowerCase().trim() : '', verAn = $('fAnulados') && $('fAnulados').checked;
    return DATA.filter(function (r) {
      if (!verAn && U.anulado(r)) return false;
      if (fE && String(r.empresa || '').toUpperCase() !== fE) return false;
      if (fF && String(r.fundo || '').trim() !== fF) return false;
      if (fS && (C.filtroEstado ? !C.filtroEstado(r, fS, U) : r.estado !== fS)) return false;
      if (q) { var h = (C.buscarEn || ['codigo', 'dni', 'nombre', 'fundo', 'responsable']).map(function (k) { return r[k]; }).join(' ').toLowerCase(); if (h.indexOf(q) < 0) return false; }
      return true;
    });
  }
  function render() {
    var L = filtrados(), V = DATA.filter(function (r) { return !U.anulado(r); });
    if ($('kpis') && C.kpis) $('kpis').innerHTML = C.kpis(V, U).map(function (k) { return U.card(k.l, k.v, k.s, k.c); }).join('');
    $('nLista').textContent = '(' + L.length + ')';
    var cont = $('p-lista');
    window.__BS_EXPORT_DATA__ = L.map(function (r) { var o = {}; CAMPOS.forEach(function (f) { o[f.label || f.id] = /^fecha|_at$|vigencia|fecha_/.test(f.id) ? U.fecha(r[f.id]) : (r[f.id] == null ? '' : r[f.id]); }); o.Codigo = r.codigo; o.Estado = r.estado; return o; });
    if (!L.length) { cont.innerHTML = '<div class="bs-text-center bs-text-muted" style="padding:2rem">' + (C.vacio || 'No hay registros con estos filtros.') + '</div>'; }
    else cont.innerHTML = '<div class="bs-table-wrap"><table class="bs-table"><thead><tr>' + C.columnas.map(function (c) { return '<th>' + c.label + '</th>'; }).join('') + '<th></th></tr></thead><tbody>' +
      L.map(function (r) {
        var an = U.anulado(r);
        return '<tr' + (an ? ' style="opacity:.55"' : '') + '>' + C.columnas.map(function (c) { return '<td>' + c.render(r, U) + '</td>'; }).join('') +
          '<td style="white-space:nowrap"><button class="bs-btn bs-btn-outline bs-btn-sm" onclick="verCaso(' + U.num(r.id) + ')">Ver</button> ' +
          (an ? (esAdmin ? '<button class="bs-btn bs-btn-outline bs-btn-sm" onclick="restaurar(' + U.num(r.id) + ')">Restaurar</button>' : '')
            : '<button class="bs-btn bs-btn-outline bs-btn-sm" onclick="editar(' + U.num(r.id) + ')">Editar</button> <button class="bs-btn bs-btn-outline bs-btn-sm" title="Eliminar (se puede restaurar)" onclick="gsEliminar(' + U.num(r.id) + ')">🗑</button>') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    if ($('p-alertas') && C.alertas) {
      var A = C.alertas(V, U), peso = { rojo: 0, ambar: 1, info: 2 }; A.sort(function (x, y) { return peso[x.n] - peso[y.n]; });
      $('nAlertas').textContent = A.length ? '(' + A.length + ')' : '';
      $('p-alertas').innerHTML = A.length ? '<div style="display:flex;flex-direction:column;gap:.5rem">' + A.map(function (a) { return '<div class="gs-alert ' + a.n + '"><div style="flex:1"><div><b>' + esc(a.r.codigo || '') + '</b>' + (a.r.nombre ? ' · ' + esc(a.r.nombre) : '') + (a.r.empresa ? ' · ' + esc(a.r.empresa) : '') + (a.r.fundo ? ' · ' + esc(a.r.fundo) : '') + '</div><div class="bs-text-sm">' + a.t + '</div></div><button class="bs-btn bs-btn-outline bs-btn-sm" onclick="verCaso(' + U.num(a.r.id) + ')">Ver</button></div>'; }).join('') + '</div>' : '<div class="bs-text-center bs-text-muted" style="padding:2rem">Sin alertas.</div>';
    }
    if (C.extras) C.extras.forEach(function (x) { if ($('p-' + x.id)) { try { $('p-' + x.id).innerHTML = x.render(V, U); } catch (e) { $('p-' + x.id).innerHTML = '<div class="bs-alert bs-alert-danger">' + esc(e.message) + '</div>'; } } });
  }

  /* ---- formulario generado desde C.campos ---- */
  function campoHtml(f) {
    var span = f.span ? ' style="grid-column: span ' + f.span + ';"' : '', req = f.req ? ' required' : '', lab = '<label class="bs-label">' + esc(f.label) + (f.req ? ' *' : '') + '</label>', hint = f.hint ? '<div class="bs-text-xs bs-text-muted">' + f.hint + '</div>' : '', ctl;
    if (f.tipo === 'select' || f.tipo === 'si_no') { var ops = f.tipo === 'si_no' ? ['NO', 'SI'] : (f.opciones || []); ctl = '<select class="bs-select" id="' + f.id + '"' + req + (f.onchange ? ' onchange="' + f.onchange + '"' : '') + '>' + (f.vacio !== undefined ? '<option value="">' + esc(f.vacio) + '</option>' : '') + ops.map(function (o) { return '<option value="' + esc(o) + '">' + esc(o === 'SI' ? 'Sí' : o === 'NO' ? 'No' : o) + '</option>'; }).join('') + '</select>'; }
    else if (f.tipo === 'textarea') ctl = '<textarea class="bs-textarea" id="' + f.id + '" rows="' + (f.rows || 2) + '"' + req + (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : '') + '></textarea>';
    else if (f.tipo === 'dni') ctl = '<input class="bs-input" id="' + f.id + '" maxlength="8" inputmode="numeric"' + req + ' oninput="if(this.value.length===8) autocompletar(this.value)">';
    else ctl = '<input type="' + (f.tipo || 'text') + '" class="bs-input" id="' + f.id + '"' + req + (f.min !== undefined ? ' min="' + f.min + '"' : '') + (f.max !== undefined ? ' max="' + f.max + '"' : '') + (f.lista ? ' list="' + f.lista + '"' : '') + (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : '') + (f.onchange ? ' onchange="' + f.onchange + '"' : '') + (f.upper ? ' style="text-transform:uppercase"' : '') + '>';
    return '<div class="bs-form-group"' + span + '>' + lab + ctl + hint + '</div>';
  }
  function pintarForm() {
    var html = '', abierto = false;
    C.campos.forEach(function (f) {
      if (f.seccion) { if (abierto) html += '</div>'; html += '<div class="gs-sec">' + esc(f.seccion) + '</div><div class="bs-grid bs-grid-3 bs-gap">'; abierto = true; return; }
      html += campoHtml(f);
    });
    if (abierto) html += '</div>';
    $('formCampos').innerHTML = html + '<datalist id="dlFundos"></datalist>';
  }
  function limpiar() { CAMPOS.forEach(function (f) { var el = $(f.id); if (!el) return; el.value = f.defecto !== undefined ? (typeof f.defecto === 'function' ? f.defecto(user, U) : f.defecto) : (f.tipo === 'si_no' ? 'NO' : ''); }); $('gsId').value = ''; if (C.alLimpiar) C.alLimpiar(U); }
  function abrirNuevo() { limpiar(); $('formTitle').textContent = C.tituloNuevo || 'Nuevo registro'; $('modalGS').classList.add('bs-active'); var p = CAMPOS[0]; if (p && $(p.id)) setTimeout(function () { $(p.id).focus(); }, 50); }
  function editar(id) {
    var x = DATA.find(function (r) { return U.num(r.id) === U.num(id); }); if (!x) return;
    limpiar(); $('gsId').value = x.id; $('formTitle').textContent = (C.etiqueta || 'Registro') + ' ' + (x.codigo || '#' + x.id);
    CAMPOS.forEach(function (f) { var el = $(f.id); if (!el) return; var v = x[f.id]; if (f.tipo === 'date') v = U.ymd(v); if (f.tipo === 'si_no') v = U.si(v) ? 'SI' : 'NO'; if (f.alEditar) v = f.alEditar(v, x); el.value = v == null ? '' : v; });
    if (C.alEditar) C.alEditar(x, U);
    $('modalGS').classList.add('bs-active');
  }
  function cerrarModal() { $('modalGS').classList.remove('bs-active'); }
  async function autocompletar(dni) {
    var el = $('dni'); if (!el) return; el.style.borderColor = '#f59e0b';
    var t = await bsBuscarTrabajador(dni);
    if (t) { if ($('nombre')) $('nombre').value = t.nombre_completo || ''; if ($('empresa') && t.empresa) $('empresa').value = String(t.empresa).toUpperCase(); if ($('fundo') && (t.zona_labor || t.zona)) $('fundo').value = t.zona_labor || t.zona; if ($('cargo') && (t.oficio || t.cargo)) $('cargo').value = t.oficio || t.cargo; if ($('fecha_ingreso') && t.fecha_inicio && !$('fecha_ingreso').value) $('fecha_ingreso').value = U.ymd(t.fecha_inicio); }
    else el.style.borderColor = '#ef4444';
    setTimeout(function () { el.style.borderColor = ''; }, 2500);
    if (C.alDni) C.alDni(dni, t, DATA, U);
  }
  async function guardar(ev) {
    ev.preventDefault();
    var btn = $('btnGuardar'), fin = function () { btn.disabled = false; btn.textContent = '💾 Guardar'; }; btn.disabled = true; btn.textContent = 'Guardando…';
    var d = {}; CAMPOS.forEach(function (f) { var el = $(f.id); if (el) d[f.id] = String(el.value || '').trim(); });
    if (d.nombre !== undefined) d.nombre = d.nombre.toUpperCase();
    if (d.dni !== undefined && !/^\d{8}$/.test(d.dni)) { appAlert('El DNI debe tener 8 dígitos.'); fin(); return; }
    var err = C.validar ? C.validar(d, U) : null; if (err) { appAlert(err); fin(); return; }
    try {
      var id = $('gsId').value;
      var r = id ? await api('bs_gsActualizar', { clave: C.clave, id: id, datos: d }) : await api('bs_gsCrear', { clave: C.clave, datos: d });
      if (!r || !r.ok) { appAlert((r && r.message) || 'No se pudo guardar.'); return; }
      cerrarModal(); appAlert(r.message || ((C.etiqueta || 'Registro') + (id ? ' actualizado.' : ' registrado' + (r.codigo ? ' (' + r.codigo + ').' : '.')))); cargar();
    } catch (e) { appAlert('Error: ' + e.message); } finally { fin(); }
  }
  function verCaso(id) {
    var x = DATA.find(function (r) { return U.num(r.id) === U.num(id); }); if (!x) return;
    $('detTitle').textContent = (x.codigo || '#' + x.id) + (x.nombre ? ' · ' + x.nombre : x.fundo ? ' · ' + x.fundo : '');
    var fila = function (k, v) { return '<div style="display:grid;grid-template-columns:200px 1fr;gap:.3rem .8rem;font-size:.9rem"><span class="bs-text-muted">' + k + '</span><span>' + (v === '' || v == null ? '—' : v) + '</span></div>'; };
    var filas = C.detalle ? C.detalle(x, U) : CAMPOS.map(function (f) { return [f.label, f.tipo === 'date' ? U.fecha(x[f.id]) : f.tipo === 'si_no' ? U.sn(x[f.id]) : esc(x[f.id])]; });
    $('detBody').innerHTML = (C.cabeceraDetalle ? C.cabeceraDetalle(x, U) : '') + '<div style="display:flex;flex-direction:column;gap:.3rem">' + filas.map(function (p) { return fila(p[0], p[1]); }).join('') +
      fila('Registro', esc(x.created_by || '') + ' · ' + U.fecha(x.created_at) + (x.updated_by ? ' · últ. cambio ' + esc(x.updated_by) + ' ' + U.fecha(x.updated_at) : '') + (U.anulado(x) ? ' · <b style="color:#b91c1c">ANULADO</b> ' + esc(x.anulado) : '')) + '</div>' +
      (U.anulado(x) ? '' : '<div class="bs-flex bs-justify-between" style="margin-top:1rem;gap:.5rem;flex-wrap:wrap"><button type="button" class="bs-btn bs-btn-outline" onclick="gsEliminar(' + U.num(x.id) + ')">🗑 Eliminar</button><div class="bs-flex" style="gap:.5rem">' + (C.accionesDetalle ? C.accionesDetalle(x, U) : '') + '<button type="button" class="bs-btn bs-btn-gs" onclick="cerrarDet();editar(' + U.num(x.id) + ')">✏️ Editar</button></div></div>');
    $('modalDet').classList.add('bs-active');
  }
  function cerrarDet() { $('modalDet').classList.remove('bs-active'); }
  window.gsEliminar = async function (id) {
    var x = DATA.find(function (r) { return U.num(r.id) === U.num(id); }); if (!x) return;
    var motivo = await appPrompt('¿Eliminar ' + (C.etiqueta || 'el registro').toLowerCase() + ' ' + (x.codigo || '#' + id) + '? Indica el motivo:'); if (!motivo) return;
    try { var r = await api('bs_anularRegistro', { modulo: C.permiso, clave: C.clave, id: id, motivo: motivo }); appAlert(r.message || (r.ok ? 'Eliminado.' : 'No se pudo eliminar.')); if (r.ok) { cerrarDet(); cargar(); } } catch (e) { appAlert('Error: ' + e.message); }
  };
  async function restaurar(id) { if (!(await appConfirm('¿Restaurar el registro #' + id + '?'))) return; try { var r = await api('bs_restaurarRegistro', { modulo: C.permiso, clave: C.clave, id: id, motivo: 'Restaurado desde el módulo' }); appAlert(r.message || ''); if (r.ok) cargar(); } catch (e) { appAlert('Error: ' + e.message); } }
  window.gsActualizar = async function (id, datos, msg) { try { var r = await api('bs_gsActualizar', { clave: C.clave, id: id, datos: datos }); appAlert(r.message || msg || ''); if (r.ok) { cerrarDet(); cargar(); } } catch (e) { appAlert('Error: ' + e.message); } };

  document.querySelectorAll('#tabs button').forEach(function (b) { b.onclick = function () { TAB = b.getAttribute('data-t'); document.querySelectorAll('#tabs button').forEach(function (x) { x.classList.toggle('on', x === b); }); document.querySelectorAll('[id^="p-"]').forEach(function (p) { p.hidden = p.id !== 'p-' + TAB; }); }; });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { cerrarModal(); cerrarDet(); } });
  window.cargar = cargar; window.render = render; window.abrirNuevo = abrirNuevo; window.editar = editar; window.cerrarModal = cerrarModal; window.autocompletar = autocompletar; window.guardar = guardar; window.verCaso = verCaso; window.cerrarDet = cerrarDet; window.restaurar = restaurar; window.GS_DATA = function () { return DATA; };
  pintarForm();
  verificarAcceso().then(function (ok) {
    if (ok) { cargar(); return; }
    $('p-lista').innerHTML = '<div class="bs-alert bs-alert-danger"><strong>Sin acceso a ' + esc(C.titulo) + '.</strong> Pide al administrador que active <b>Bienestar → ' + esc(C.titulo) + '</b> para tu usuario en "Acceso a Módulos" del Sistema RR.LL. y vuelve a ingresar.</div>';
    document.querySelectorAll('.bs-btn-gs').forEach(function (b) { b.disabled = true; });
  });
})();
