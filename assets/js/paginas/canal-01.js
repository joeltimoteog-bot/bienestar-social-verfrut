/* Bienestar Social · modulos/canal.html · _BS_GESTION_SOCIAL_V3 (15-nov-2026)
   Bandeja del canal anónimo (QR) + generador de afiches. Supabase vía bs-guardar-supabase.js:
   bs_listarCanal, bs_actualizarCanal, bs_anularRegistro / bs_restaurarRegistro (modulo 'gestion_social', clave 'bs_gs_canal'). */
(function () {
  'use strict';
  var session = localStorage.getItem('bienestarSocialAuth');
  if (!session) { window.location.href = '../index.html'; return; }
  var user; try { user = JSON.parse(session); if (!user || !user.usuario) throw new Error(); } catch (e) { window.location.href = '../index.html'; return; }
  var esAdmin = /admin|geren/i.test(user.rol || '') || user.esAdminRL === true || ['jtimoteo'].indexOf((user.usuario || '').toLowerCase()) >= 0;
  document.getElementById('userName').textContent = user.nombre || user.usuario;
  async function verificarAcceso() {
    if (esAdmin || (user.permisos && user.permisos.gestion_social)) return true;
    var rl = null; try { rl = window.bsPermisosRL ? await window.bsPermisosRL() : null; } catch (e) { rl = null; }
    if (rl && rl.ok && (rl.esAdmin || (rl.permisos && rl.permisos.gestion_social))) { user.permisos = Object.assign({}, user.permisos || {}, rl.permisos || {}); if (rl.esAdmin) { user.esAdminRL = true; esAdmin = true; } try { localStorage.setItem('bienestarSocialAuth', JSON.stringify(user)); } catch (e) {} return true; }
    return false;
  }

  var PUBLICO = 'https://sistemarrll.com/bienestar-social-verfrut/publico/canal.html';
  var CATS = ['Queja', 'Sugerencia', 'Reconocimiento', 'Seguridad / salud en el trabajo', 'Trato / discriminación', 'Pago / horas', 'Transporte / comedor / SS.HH.', 'Hostigamiento (se deriva al comité)', 'Otro'];
  var DATA = [], TAB = 'lista';
  var $ = function (id) { return document.getElementById(id); };
  var hoy = function () { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  var ymd = function (v) { if (!v) return ''; var m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[1] + '-' + m[2] + '-' + m[3] : ''; };
  var fecha = function (v) { var y = ymd(v); return y ? y.split('-').reverse().join('/') : '—'; };
  var dias = function (a, b) { a = ymd(a); b = ymd(b || hoy()); if (!a || !b) return 0; return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000); };
  var anulado = function (r) { return String(r.anulado || '').trim() !== ''; };
  var pend = function (r) { return !anulado(r) && (r.estado === 'Nuevo' || r.estado === 'En revisión'); };
  var pill = function (e) { return '<span class="gs-pill ' + String(e || 'Nuevo').toLowerCase().replace(/[^a-z]/g, '') + '">' + esc(e || 'Nuevo') + '</span>'; };
  var sel = $('fCat'); CATS.forEach(function (c) { sel.add(new Option(c, c)); });

  async function cargar() {
    var cont = $('p-lista'); cont.innerHTML = '<div class="bs-text-center" style="padding:2rem"><div class="bs-spinner bs-spinner-dark" style="margin:0 auto"></div></div>';
    try {
      var r = await api('bs_listarCanal', {});
      if (!r || !r.ok) { cont.innerHTML = '<div class="bs-alert bs-alert-danger"><strong>No se pudo leer de Supabase:</strong> ' + esc((r && r.message) || 'sin respuesta') + '</div>'; return; }
      DATA = r.items || [];
      var fundos = {}; DATA.forEach(function (x) { if (x.fundo) fundos[String(x.fundo).trim()] = 1; });
      var s = $('fFundo'), cur = s.value; s.innerHTML = '<option value="">Todos</option>' + Object.keys(fundos).sort().map(function (f) { return '<option>' + esc(f) + '</option>'; }).join(''); s.value = cur;
      render(); renderResumen();
    } catch (e) { cont.innerHTML = '<div class="bs-alert bs-alert-danger">Error: ' + esc(e.message) + '</div>'; }
  }
  function filtrados() {
    var fE = $('fEmpresa').value, fF = $('fFundo').value, fC = $('fCat').value, fS = $('fEstado').value, q = ($('fTexto').value || '').toLowerCase().trim(), verAn = $('fAnulados').checked;
    return DATA.filter(function (r) {
      if (!verAn && anulado(r)) return false;
      if (fS === '' ? !(r.estado === 'Nuevo' || r.estado === 'En revisión') : (fS !== 'todos' && r.estado !== fS)) return false;
      if (fE && r.empresa !== fE) return false; if (fF && String(r.fundo || '').trim() !== fF) return false; if (fC && r.categoria !== fC) return false;
      if (q && [r.codigo, r.mensaje, r.fundo, r.respuesta].join(' ').toLowerCase().indexOf(q) < 0) return false;
      return true;
    }).sort(function (a, b) { return Number(b.id) - Number(a.id); });
  }
  function kpis() {
    var V = DATA.filter(function (r) { return !anulado(r); }), nuevos = V.filter(function (r) { return r.estado === 'Nuevo'; }), pendientes = V.filter(pend);
    var viejos = pendientes.filter(function (r) { return dias(r.fecha) > 7; }).length, mes = hoy().slice(0, 7), delMes = V.filter(function (r) { return ymd(r.fecha).slice(0, 7) === mes; }).length;
    var at = V.filter(function (r) { return ymd(r.fecha_atencion) && r.estado !== 'Nuevo'; }), prom = at.length ? Math.round(at.reduce(function (s, r) { return s + dias(r.fecha, r.fecha_atencion); }, 0) / at.length * 10) / 10 : 0;
    var card = function (l, v, s, c) { return '<div class="bs-card gs-kpi"><div class="l">' + l + '</div><div class="v" style="color:' + c + '">' + v + '</div><div class="s">' + s + '</div></div>'; };
    $('kpis').innerHTML = card('Sin leer', nuevos.length, 'mensajes nuevos', nuevos.length ? '#b91c1c' : '#166534') + card('Pendientes', pendientes.length, viejos + ' con más de 7 días', viejos ? '#b45309' : '#0f766e') + card('Recibidos este mes', delMes, V.length + ' en total', '#0a2463') + card('Días hasta atender', prom, 'promedio de respuesta', prom > 7 ? '#b45309' : '#166534');
  }
  function render() {
    var L = filtrados(); kpis(); $('nLista').textContent = '(' + L.length + ')';
    var cont = $('p-lista');
    if (!L.length) { cont.innerHTML = '<div class="bs-text-center bs-text-muted" style="padding:2rem">No hay mensajes con estos filtros.</div>'; window.__BS_EXPORT_DATA__ = []; return; }
    window.__BS_EXPORT_DATA__ = L.map(function (r) { return { Codigo: r.codigo, Fecha: fecha(r.fecha), Empresa: r.empresa, Lugar: r.fundo, Categoria: r.categoria, Mensaje: r.mensaje, Contacto: r.contacto, Estado: r.estado, AtendidoPor: r.atendido_por, FechaAtencion: fecha(r.fecha_atencion), Respuesta: r.respuesta, DerivadoA: r.derivado_a }; });
    cont.innerHTML = '<div style="display:flex;flex-direction:column;gap:.6rem">' + L.map(function (r) {
      var an = anulado(r);
      return '<div class="gs-msg ' + (r.estado === 'Nuevo' && !an ? 'nuevo' : '') + '"' + (an ? ' style="opacity:.55"' : '') + '><div>' +
        '<div class="bs-flex" style="gap:.5rem;flex-wrap:wrap;align-items:center"><b>' + esc(r.codigo) + '</b>' + (an ? '<span class="gs-pill anulado">ANULADO</span>' : pill(r.estado)) + '<span class="gs-pill" style="background:#f1f5f9;color:#334155">' + esc(r.categoria) + '</span></div>' +
        '<div class="meta">' + fecha(r.fecha) + ' · hace ' + dias(r.fecha) + ' d · ' + esc(r.empresa) + (r.fundo ? ' · ' + esc(r.fundo) : '') + ' · ' + esc(r.sede || '') + (r.contacto ? ' · 📞 ' + esc(r.contacto) : '') + '</div>' +
        '<div class="txt">' + esc(r.mensaje) + '</div>' +
        (r.respuesta ? '<div class="bs-text-sm" style="background:#f0fdfa;border-radius:8px;padding:.4rem .6rem"><b>Atención:</b> ' + esc(r.respuesta) + ' <span class="bs-text-muted">· ' + esc(r.atendido_por || '') + ' · ' + fecha(r.fecha_atencion) + (r.derivado_a ? ' · derivado a ' + esc(r.derivado_a) : '') + '</span></div>' : '') +
        '</div><div style="display:flex;flex-direction:column;gap:.35rem;align-items:flex-end">' +
        (an ? (esAdmin ? '<button class="bs-btn bs-btn-outline bs-btn-sm" onclick="restaurar(' + Number(r.id) + ')">Restaurar</button>' : '') : '<button class="bs-btn bs-btn-gs bs-btn-sm" onclick="atender(' + Number(r.id) + ')">' + (pend(r) ? 'Atender' : 'Ver / editar') + '</button>' + (pend(r) ? '<button class="bs-btn bs-btn-outline bs-btn-sm" onclick="derivar(' + Number(r.id) + ')">→ Caso social</button>' : '') + '<button class="bs-btn bs-btn-outline bs-btn-sm" title="Eliminar (se puede restaurar)" onclick="gsEliminar(' + Number(r.id) + ",'bs_gs_canal','el mensaje " + esc(r.codigo) + "')\">🗑 Eliminar</button>") +
        '</div></div>';
    }).join('') + '</div>';
  }
  function renderResumen() {
    var V = DATA.filter(function (r) { return !anulado(r); }), M = {};
    V.forEach(function (r) { var k = r.empresa + ' · ' + (r.fundo || '(sin lugar)'); var m = M[k] || (M[k] = { total: 0, pend: 0, cats: {} }); m.total++; if (pend(r)) m.pend++; m.cats[r.categoria] = (m.cats[r.categoria] || 0) + 1; });
    var ks = Object.keys(M).sort(function (a, b) { return M[b].total - M[a].total; });
    $('p-resumen').innerHTML = ks.length ? '<div class="bs-table-wrap"><table class="bs-table"><thead><tr><th>Lugar</th><th>Mensajes</th><th>Pendientes</th><th>Categoría más frecuente</th></tr></thead><tbody>' + ks.map(function (k) { var m = M[k], top = Object.keys(m.cats).sort(function (a, b) { return m.cats[b] - m.cats[a]; })[0]; return '<tr><td><b>' + esc(k) + '</b></td><td>' + m.total + '</td><td>' + (m.pend ? '<b style="color:#b91c1c">' + m.pend + '</b>' : '0') + '</td><td>' + esc(top) + ' (' + m.cats[top] + ')</td></tr>'; }).join('') + '</tbody></table></div>'
      : '<div class="bs-text-center bs-text-muted" style="padding:2rem">Todavía no hay mensajes.</div>';
  }

  /* ===== ATENDER ===== */
  function atender(id) {
    var x = DATA.find(function (r) { return Number(r.id) === Number(id); }); if (!x) return;
    $('atTitle').textContent = x.codigo + ' · ' + x.categoria;
    $('atBody').innerHTML = '<div class="bs-text-sm bs-text-muted">' + fecha(x.fecha) + ' · ' + esc(x.empresa) + ' · ' + esc(x.fundo || '') + (x.contacto ? ' · contacto: ' + esc(x.contacto) : '') + '</div><div class="gs-msg" style="margin:.6rem 0;grid-template-columns:1fr"><div class="txt">' + esc(x.mensaje) + '</div></div>' +
      '<form onsubmit="return window.guardarAt(event,' + Number(x.id) + ')"><div class="bs-grid bs-grid-2 bs-gap">' +
      '<div class="bs-form-group"><label class="bs-label">Estado</label><select class="bs-select" id="atEstado"><option' + (x.estado === 'En revisión' ? ' selected' : '') + '>En revisión</option><option' + (x.estado === 'Atendido' ? ' selected' : '') + '>Atendido</option><option' + (x.estado === 'Derivado' ? ' selected' : '') + '>Derivado</option><option' + (x.estado === 'Descartado' ? ' selected' : '') + '>Descartado</option></select></div>' +
      '<div class="bs-form-group"><label class="bs-label">Derivado a (código o área)</label><input class="bs-input" id="atDeriv" value="' + esc(x.derivado_a || '') + '" placeholder="GS-2026-0003, Comité de hostigamiento, SST…"></div>' +
      '<div class="bs-form-group" style="grid-column: span 2;"><label class="bs-label">Qué se hizo / respuesta *</label><textarea class="bs-textarea" id="atResp" rows="3" required>' + esc(x.respuesta || '') + '</textarea></div></div>' +
      '<div class="bs-flex bs-justify-between" style="gap:.5rem;flex-wrap:wrap;margin-top:.6rem"><button type="button" class="bs-btn bs-btn-outline" onclick="window.anularMsg(' + Number(x.id) + ')">Anular</button><div class="bs-flex" style="gap:.5rem"><button type="button" class="bs-btn bs-btn-outline" onclick="cerrarAt()">Cancelar</button><button type="submit" class="bs-btn bs-btn-gs" id="atBtn">💾 Guardar</button></div></div></form>';
    $('modalAt').classList.add('bs-active');
  }
  function cerrarAt() { $('modalAt').classList.remove('bs-active'); }
  window.guardarAt = async function (ev, id) {
    ev.preventDefault(); var b = $('atBtn'); b.disabled = true;
    try {
      var r = await api('bs_actualizarCanal', { id: id, datos: { estado: $('atEstado').value, respuesta: $('atResp').value.trim(), derivado_a: $('atDeriv').value.trim(), atendido_por: user.nombre || user.usuario } });
      if (!r || !r.ok) { appAlert((r && r.message) || 'No se pudo guardar.'); return; }
      cerrarAt(); appAlert(r.message || 'Guardado.'); cargar();
    } catch (e) { appAlert('Error: ' + e.message); } finally { b.disabled = false; }
    return false;
  };
  /* derivar: abre Casos sociales con el texto precargado; al guardar el caso, gestion-social-01.js marca este mensaje como Derivado */
  function derivar(id) { var x = DATA.find(function (r) { return Number(r.id) === Number(id); }); if (!x) return; location.href = 'gestion-social.html?canal=' + encodeURIComponent(x.id) + '&cq=' + encodeURIComponent(x.codigo) + '&e=' + encodeURIComponent(x.empresa || '') + '&f=' + encodeURIComponent(x.fundo || '') + '&s=' + encodeURIComponent(x.sede || '') + '&t=' + encodeURIComponent('[' + x.codigo + ' · ' + x.categoria + '] ' + x.mensaje); }
  window.anularMsg = async function (id) {
    var motivo = await appPrompt('Motivo de anulación (p. ej. duplicado, prueba, contenido ofensivo):'); if (!motivo) return;
    try { var r = await api('bs_anularRegistro', { modulo: 'gestion_social', clave: 'bs_gs_canal', id: id, motivo: motivo }); appAlert(r.message || ''); if (r.ok) { cerrarAt(); cargar(); } } catch (e) { appAlert('Error: ' + e.message); }
  };
  async function restaurar(id) { if (!(await appConfirm('¿Restaurar el mensaje #' + id + '?'))) return; try { var r = await api('bs_restaurarRegistro', { modulo: 'gestion_social', clave: 'bs_gs_canal', id: id, motivo: 'Restaurado desde el módulo' }); appAlert(r.message || ''); if (r.ok) cargar(); } catch (e) { appAlert('Error: ' + e.message); } }

  /* ===== QR ===== */
  function urlQr() { return PUBLICO + '?e=' + encodeURIComponent($('qEmpresa').value) + '&f=' + encodeURIComponent($('qFundo').value.trim()) + '&s=' + encodeURIComponent($('qSede').value); }
  function qr() {
    var u = urlQr(); $('qLugar').textContent = $('qEmpresa').value + ($('qFundo').value.trim() ? ' · ' + $('qFundo').value.trim() : '') + ' · ' + $('qSede').value; $('qUrl').textContent = u;
    if (typeof window.qrcode !== 'function') { console.warn('[canal] librería QR no cargó'); return; }
    var q = qrcode(0, 'M'); q.addData(u); q.make(); var n = q.getModuleCount(), cell = Math.max(2, Math.floor(260 / n)), c = $('qCanvas'), ctx = c.getContext('2d');
    c.width = c.height = n * cell + cell * 2; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.fillStyle = '#0a2463'; ctx.translate(cell, cell); q.renderTo2dContext(ctx, cell); ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  function copiarUrl() { var u = urlQr(); (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(function () { appAlert('Enlace copiado.'); }, function () { appAlert(u); }); }
  function irTab(t) { var b = document.querySelector('#tabs button[data-t="' + t + '"]'); if (b) b.click(); }

  /* _BS_ELIMINAR_V1 (15-nov-2026, pedido de Joel): botón Eliminar en cada fila. En Supabase "eliminar" = anular con motivo
     (queda quién/cuándo/por qué, sale de las pantallas y el administrador puede restaurarlo con "Ver anulados"). */
  window.gsEliminar = async function (id, clave, etiqueta) {
    var motivo = await appPrompt('¿Eliminar ' + etiqueta + '? Indica el motivo (p. ej. registro equivocado, duplicado):'); if (!motivo) return;
    try { var r = await api('bs_anularRegistro', { modulo: 'gestion_social', clave: clave, id: id, motivo: motivo }); appAlert(r.message || (r.ok ? 'Eliminado.' : 'No se pudo eliminar.')); if (r.ok) { try { cerrarDet(); } catch (e) {} try { cerrarAt(); } catch (e) {} cargar(); } }
    catch (e) { appAlert('Error: ' + e.message); }
  };
  document.querySelectorAll('#tabs button').forEach(function (b) { b.onclick = function () { TAB = b.getAttribute('data-t'); document.querySelectorAll('#tabs button').forEach(function (x) { x.classList.toggle('on', x === b); }); ['lista', 'resumen', 'qr'].forEach(function (t) { $('p-' + t).hidden = t !== TAB; }); if (TAB === 'qr') qr(); }; });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') cerrarAt(); });
  window.cargar = cargar; window.render = render; window.atender = atender; window.cerrarAt = cerrarAt; window.derivar = derivar; window.restaurar = restaurar; window.qr = qr; window.copiarUrl = copiarUrl; window.irTab = irTab;
  verificarAcceso().then(function (ok) {
    if (ok) { cargar(); return; }
    $('p-lista').innerHTML = '<div class="bs-alert bs-alert-danger"><strong>Sin acceso a Gestión Social.</strong> Pide al administrador que active <b>Bienestar → Gestión Social</b> para tu usuario en "Acceso a Módulos" del Sistema RR.LL. y vuelve a ingresar.</div>';
    document.querySelectorAll('.bs-btn-gs').forEach(function (b) { b.disabled = true; });
  });
})();
