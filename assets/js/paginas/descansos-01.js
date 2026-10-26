/* Bienestar Social · modulos/descansos.html · bloque 1 (antes en la linea 153) · extraido el 26-oct-2026 sin cambios (_BS_MODULAR_V1) */
    const BS_API_URL = 'https://script.google.com/macros/s/AKfycbyJIUtdpApEc35Jj4ZNP-3ONqGe64J1VhaRvkt87vVUNTgSagrOgOS0T99eIt0-w3Yi/exec';

    // ===== AUTH =====
    const session = localStorage.getItem('bienestarSocialAuth');
    if (!session) window.location.href = '../index.html';
    let user;
    try { user = JSON.parse(session); if (!user || !user.usuario) throw new Error(); }
    catch (e) { window.location.href = '../index.html'; }
    const esAdmin = /admin|geren/i.test(user.rol || '') || ['jtimoteo', 'ovilela'].indexOf((user.usuario || '').toLowerCase()) >= 0;
    if (!esAdmin && !(user.permisos && user.permisos.descansos)) { appAlert('No tienes acceso al módulo Descansos Médicos.'); window.location.href = '../portal.html'; }
    document.getElementById('userName').textContent = user.nombre || user.usuario;

    // api(): compartida en assets/js/bs-core.js
    // esc(): compartida en assets/js/bs-core.js)();

    async function cargar() {
      var cont = document.getElementById('p-lista');
      cont.innerHTML = '<div class="bs-text-center" style="padding:2rem"><div class="bs-spinner bs-spinner-dark" style="margin:0 auto"></div></div>';
      try {
        var r = await api('bs_listarDescansos', { anio: document.getElementById('fAnio').value });
        if (!r.ok) {
          cont.innerHTML = '<div class="bs-alert bs-alert-danger"><strong>Error:</strong> ' + esc(r.message) +
            (/not defined|no definid/i.test(r.message || '') ? '<br><span class="bs-text-sm">🔧 Falta publicar <code>bs-descansos.js</code> en Apps Script (clasp push + deploy).</span>' : '') + '</div>';
          return;
        }
        DATA = r.items || []; ALERTAS = r.alertas || []; CAT = r.catalogos || CAT; UMBRAL = r.umbral || 20;
        document.getElementById('umbralTxt').textContent = UMBRAL;
        llenarCatalogos();
        render(); renderAlertas(); cargarDash();
      } catch (e) { cont.innerHTML = '<div class="bs-alert bs-alert-danger">Error: ' + esc(e.message) + '</div>'; }
    }

    function llenarCatalogos() {
      function fill(id, arr, vacio) { var s = document.getElementById(id); var cur = s.value; s.innerHTML = (vacio !== undefined ? '<option value="">' + vacio + '</option>' : '') + arr.map(function (x) { return '<option>' + esc(x) + '</option>'; }).join(''); if (cur) s.value = cur; }
      fill('fTipo', CAT.tipos, 'Todos'); fill('fCitt', CAT.citt_estados, 'Todos');
      fill('tipo', CAT.tipos); fill('origen', CAT.origenes); fill('citt_estado', CAT.citt_estados);
    }

    function filtrados() {
      var fe = document.getElementById('fEmpresa').value, ft = document.getElementById('fTipo').value, fs = document.getElementById('fEstado').value,
          fm = document.getElementById('fSem').value, fc = document.getElementById('fCitt').value, q = document.getElementById('fTexto').value.toLowerCase().trim();
      return DATA.filter(function (x) {
        if (fe && x.empresa !== fe) return false;
        if (ft && x.tipo !== ft) return false;
        if (fs && x.estado !== fs) return false;
        if (fm && x.semaforo !== fm) return false;
        if (fc && x.citt_estado !== fc) return false;
        if (q && [x.dni, x.nombre, x.diagnostico, x.cie10, x.sector, x.citt_numero].join(' ').toLowerCase().indexOf(q) < 0) return false;
        return true;
      });
    }

    function render() {
      var items = filtrados();
      // KPIs sobre el conjunto filtrado por año/empresa
      var fe = document.getElementById('fEmpresa').value;
      var base = DATA.filter(function (x) { return !fe || x.empresa === fe; });
      var activos = base.filter(function (x) { return x.estado === 'Activo'; }).length;
      var dias = base.reduce(function (s, x) { return s + (Number(x.dias) || 0); }, 0);
      var rojos = {}; base.forEach(function (x) { if (x.semaforo === 'rojo') rojos[x.dni] = 1; });
      var canje = base.filter(function (x) { return x.citt_estado === 'Pendiente de canje'; }).length;
      var sinSub = base.filter(function (x) { return x.semaforo === 'rojo' && !x.id_subsidio && x.tipo !== 'Maternidad'; }).length;
      document.getElementById('kpis').innerHTML = [
        ['Descansos del año', base.length, activos + ' vigentes hoy'],
        ['Días perdidos', dias, 'suma de días de DM'],
        ['Trabajadores sobre umbral', Object.keys(rojos).length, sinSub + ' DM sin expediente de subsidio'],
        ['Pendientes de canje', canje, 'certificados particulares sin CITT']
      ].map(function (k) { return '<div class="bs-card dm-kpi"><div class="l">' + k[0] + '</div><div class="v">' + k[1] + '</div><div class="s">' + k[2] + '</div></div>'; }).join('');

      document.getElementById('nLista').textContent = items.length;
      document.getElementById('nAlertas').textContent = ALERTAS.length;
      var cont = document.getElementById('p-lista');
      if (!DATA.length) { cont.innerHTML = '<div class="bs-card bs-text-center" style="padding:2rem;"><p style="font-size:2rem;margin:.2rem 0;">🏥</p><p class="bs-text-muted"><strong>Aún no hay descansos médicos registrados en ' + esc(document.getElementById('fAnio').value) + '.</strong></p><p class="bs-text-sm bs-text-muted">Usa <b>＋ Nuevo descanso</b> para registrar el primero.</p></div>'; window.__BS_EXPORT_DATA__ = []; return; }
      if (!items.length) { cont.innerHTML = '<div class="bs-text-center bs-text-muted" style="padding:2rem;">No hay registros con esos filtros.</div>'; window.__BS_EXPORT_DATA__ = []; return; }
      window.__BS_EXPORT_DATA__ = items.map(function (x) { return { id: x.id, dni: x.dni, nombre: x.nombre, empresa: x.empresa, sector: x.sector, tipo: x.tipo, origen: x.origen, citt_numero: x.citt_numero, citt_estado: x.citt_estado, fecha_inicio: x.fecha_inicio, fecha_fin: x.fecha_fin, dias: x.dias, acumulado_anual: x.acumulado_anual, diagnostico: x.diagnostico, cie10: x.cie10, centro: x.centro, medico: x.medico, id_accidente: x.id_accidente, id_subsidio: x.id_subsidio, estado: x.estado, observaciones: x.observaciones }; });
      var h = '<div class="bs-table-wrap"><table class="bs-table" id="tablaDM"><thead><tr><th>#</th><th>Trabajador</th><th>Empresa</th><th>Tipo</th><th>Inicio</th><th>Fin</th><th>Días</th><th>Acum. año</th><th>CITT</th><th>Diagnóstico</th><th>Estado</th><th>Subsidio</th><th></th></tr></thead><tbody>';
      items.forEach(function (x) {
        var sem = '<span class="dm-sem ' + esc(x.semaforo) + '"><i></i>' + esc(x.acumulado_anual) + ' / ' + UMBRAL + '</span>';
        var citt = x.citt_estado === 'Canjeado' ? '<span class="bs-badge bs-badge-success">' + esc(x.citt_numero || 'Canjeado') + '</span>' : x.citt_estado === 'Pendiente de canje' ? '<span class="bs-badge bs-badge-warning">Pendiente</span>' : x.citt_estado === 'Observado' ? '<span class="bs-badge bs-badge-danger">Observado</span>' : '<span class="bs-badge">N/A</span>';
        var sub = x.id_subsidio ? '<a href="subsidios.html?id=' + esc(x.id_subsidio) + '"><b>#' + esc(x.id_subsidio) + '</b></a>'
                : (x.semaforo === 'rojo' || x.tipo === 'Maternidad') ? '<button class="bs-btn bs-btn-sm bs-btn-dm" onclick="generarSubsidio(' + esc(x.id) + ')" title="Crear expediente en Subsidios">💰 Generar</button>' : '—';
        h += '<tr><td><b>#' + esc(x.id) + '</b></td><td><a href="ficha.html?dni=' + esc(x.dni) + '" class="nm" title="Ver ficha 360°">' + esc(x.nombre) + '</a><br><span class="bs-text-xs bs-text-muted">' + esc(x.dni) + (x.sector ? ' · ' + esc(x.sector) : '') + '</span></td>' +
             '<td><span class="bs-badge ' + (x.empresa === 'RAPEL' ? 'bs-badge-primary' : 'bs-badge-info') + '">' + esc(x.empresa) + '</span></td><td>' + esc(x.tipo) + '</td><td>' + fecha(x.fecha_inicio) + '</td><td>' + fecha(x.fecha_fin) + '</td><td><b>' + esc(x.dias) + '</b></td><td>' + sem + '</td><td>' + citt + '</td>' +
             '<td class="bs-text-sm">' + esc(x.diagnostico || '') + (x.cie10 ? ' <span class="bs-badge">' + esc(x.cie10) + '</span>' : '') + '</td>' +
             '<td><span class="bs-badge ' + (x.estado === 'Activo' ? 'bs-badge-warning' : 'bs-badge-success') + '">' + esc(x.estado) + '</span></td><td>' + sub + '</td>' +
             '<td><button class="bs-btn bs-btn-sm bs-btn-outline" onclick="editar(' + esc(x.id) + ')">✏️</button></td></tr>';
      });
      h += '</tbody></table></div><p class="bs-text-xs bs-text-muted" style="margin-top:.5rem;">Mostrando ' + items.length + ' de ' + DATA.length + ' · Acumulado = días de incapacidad temporal del año (maternidad no suma al umbral).</p>';
      cont.innerHTML = h;
    }

    function renderAlertas() {
      var c = document.getElementById('p-alertas');
      if (!ALERTAS.length) { c.innerHTML = '<div class="dm-alert"><span>🟢</span>Sin alertas para el año seleccionado.</div>'; return; }
      c.innerHTML = '<div style="display:grid; gap:.5rem;">' + ALERTAS.map(function (a) {
        return '<div class="dm-alert ' + esc(a.nivel) + '"><span>' + (a.nivel === 'rojo' ? '🔴' : a.nivel === 'ambar' ? '🟡' : '🔵') + '</span><div style="flex:1;min-width:0;"><span class="nm"><a href="ficha.html?dni=' + esc(a.dni) + '">' + esc(a.nombre || a.dni) + '</a></span> · ' + esc(a.titulo) + '</div>' + (a.id ? '<button class="bs-btn bs-btn-sm bs-btn-outline" onclick="editar(' + esc(a.id) + ')">Ver #' + esc(a.id) + '</button>' : '') + '</div>';
      }).join('') + '</div>';
    }

    // ===== DASHBOARD =====
    var _charts = [];
    async function cargarDash() {
      var c = document.getElementById('p-dash');
      try {
        var r = await api('bs_dashboardDescansos', { anio: document.getElementById('fAnio').value, empresa: document.getElementById('fEmpresa').value });
        if (!r.ok) { c.innerHTML = '<div class="bs-alert bs-alert-danger">' + esc(r.message) + '</div>'; return; }
        var k = r.kpis;
        c.innerHTML = '<div class="bs-grid bs-grid-4 bs-gap bs-mb">' + [['DM en el año', k.total_dm], ['Días perdidos', k.dias_perdidos], ['Días este mes', k.dias_mes], ['En rojo', k.trabajadores_rojo]].map(function (x) { return '<div class="bs-card dm-kpi"><div class="l">' + x[0] + '</div><div class="v">' + x[1] + '</div></div>'; }).join('') + '</div>' +
          '<div class="dm-charts"><div class="bs-card"><h4 style="margin:0 0 .5rem;">DM y días por mes</h4><canvas id="cMes"></canvas></div><div class="bs-card"><h4 style="margin:0 0 .5rem;">Días por tipo</h4><canvas id="cTipo"></canvas></div><div class="bs-card"><h4 style="margin:0 0 .5rem;">Días por sector (top 8)</h4><canvas id="cSector"></canvas></div><div class="bs-card"><h4 style="margin:0 0 .5rem;">Diagnósticos más frecuentes</h4><canvas id="cDiag"></canvas></div><div class="bs-card"><h4 style="margin:0 0 .5rem;">Estado de canje CITT</h4><canvas id="cCanje"></canvas></div>' +
          '<div class="bs-card"><h4 style="margin:0 0 .5rem;">Trabajadores sobre el umbral</h4>' + (r.rojos.length ? '<div class="bs-table-wrap"><table class="bs-table"><thead><tr><th>Trabajador</th><th>Empresa</th><th>Días</th></tr></thead><tbody>' + r.rojos.map(function (x) { return '<tr><td><a href="ficha.html?dni=' + esc(x.dni) + '" class="nm">' + esc(x.nombre) + '</a></td><td>' + esc(x.empresa) + '</td><td><b>' + esc(x.total) + '</b></td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="bs-text-muted">Ninguno 🎉</p>') + '</div></div>';
        ensureChart(function () { dibujar(r); });
      } catch (e) { c.innerHTML = '<div class="bs-alert bs-alert-danger">' + esc(e.message) + '</div>'; }
    }
    function ensureChart(cb) {
      if (window.Chart) return cb();
      var s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js'; s.onload = cb; document.head.appendChild(s);
    }
    function dibujar(r) {
      _charts.forEach(function (c) { try { c.destroy(); } catch (e) {} }); _charts = [];
      var M = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'];
      var P = ['#be185d', '#0033A0', '#0891b2', '#d97706', '#15803d', '#7c3aed', '#64748b', '#E2231A'];
      function mk(id, cfg) { var el = document.getElementById(id); if (el) _charts.push(new Chart(el, cfg)); }
      mk('cMes', { type: 'bar', data: { labels: M, datasets: [{ label: 'Días', data: r.porMes.map(function (m) { return m.dias; }), backgroundColor: '#be185d' }, { label: 'DM', data: r.porMes.map(function (m) { return m.dm; }), type: 'line', borderColor: '#0033A0', yAxisID: 'y1' }] }, options: { responsive: true, scales: { y1: { position: 'right', grid: { display: false } } } } });
      var tipos = Object.keys(r.porTipo);
      mk('cTipo', { type: 'doughnut', data: { labels: tipos, datasets: [{ data: tipos.map(function (t) { return r.porTipo[t]; }), backgroundColor: P }] }, options: { responsive: true } });
      mk('cSector', { type: 'bar', data: { labels: r.topSector.map(function (s) { return s.k; }), datasets: [{ label: 'Días', data: r.topSector.map(function (s) { return s.dias; }), backgroundColor: '#0033A0' }] }, options: { indexAxis: 'y', responsive: true, plugins: { legend: { display: false } } } });
      mk('cDiag', { type: 'bar', data: { labels: r.topDiag.map(function (s) { return s.k; }), datasets: [{ label: 'Casos', data: r.topDiag.map(function (s) { return s.n; }), backgroundColor: '#0891b2' }] }, options: { indexAxis: 'y', responsive: true, plugins: { legend: { display: false } } } });
      var ck = Object.keys(r.canje);
      mk('cCanje', { type: 'pie', data: { labels: ck, datasets: [{ data: ck.map(function (k) { return r.canje[k]; }), backgroundColor: ['#15803d', '#d97706', '#b91c1c', '#64748b'] }] }, options: { responsive: true } });
    }

    // ===== TABS =====
    document.getElementById('tabs').addEventListener('click', function (e) { var b = e.target.closest('button[data-t]'); if (!b) return; document.querySelectorAll('#tabs button').forEach(function (x) { x.classList.toggle('on', x === b); }); ['lista', 'alertas', 'dash'].forEach(function (k) { document.getElementById('p-' + k).hidden = k !== b.dataset.t; }); });

    // ===== FORMULARIO =====
    var CAMPOS = ['dni', 'nombre', 'empresa', 'sector', 'tipo', 'origen', 'citt_estado', 'citt_numero', 'fecha_inicio', 'fecha_fin', 'diagnostico', 'cie10', 'centro', 'medico', 'id_accidente', 'observaciones'];
    function abrirNuevo() {
      document.getElementById('formTitle').textContent = 'Nuevo descanso médico';
      document.getElementById('dmId').value = '';
      CAMPOS.forEach(function (f) { document.getElementById(f).value = ''; });
      document.getElementById('dias').value = ''; document.getElementById('acumBox').style.display = 'none';
      document.getElementById('dni').readOnly = false;
      sugerirCitt();
      document.getElementById('modalDM').classList.add('bs-active');
      setTimeout(function () { document.getElementById('dni').focus(); }, 80);
    }
    function editar(id) {
      var x = DATA.find(function (r) { return String(r.id) === String(id); }); if (!x) return;
      document.getElementById('formTitle').textContent = 'Editar descanso #' + id;
      document.getElementById('dmId').value = id;
      CAMPOS.forEach(function (f) { document.getElementById(f).value = x[f] == null ? '' : x[f]; });
      document.getElementById('dni').readOnly = true;
      calcDias(); mostrarAcum(x.dni, true);
      document.querySelectorAll('#tabs button')[0].click();
      document.getElementById('modalDM').classList.add('bs-active');
    }
    function cerrarModal() { document.getElementById('modalDM').classList.remove('bs-active'); }
    function sugerirCitt() { var o = document.getElementById('origen').value, c = document.getElementById('citt_estado'); if (!document.getElementById('dmId').value) c.value = o === 'EsSalud' ? 'Canjeado' : 'Pendiente de canje'; }
    function calcDias() {
      var a = document.getElementById('fecha_inicio').value, b = document.getElementById('fecha_fin').value, out = document.getElementById('dias');
      if (!a || !b) { out.value = ''; return; }
      var d = Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000) + 1;
      out.value = d > 0 ? d : ''; out.style.borderColor = d > 0 ? '' : '#ef4444';
    }
    async function autocompletar(dni) {
      var el = document.getElementById('dni'); el.style.borderColor = '#f59e0b';
      var t = await bsBuscarTrabajador(dni);
      if (t) { document.getElementById('nombre').value = t.nombre_completo || ''; if (t.empresa) document.getElementById('empresa').value = t.empresa; if (t.zona_labores || t.zona) document.getElementById('sector').value = t.zona_labores || t.zona; el.style.borderColor = '#10b981'; }
      else el.style.borderColor = '#ef4444';
      setTimeout(function () { el.style.borderColor = ''; }, 2500);
      mostrarAcum(dni, false);
    }
    async function mostrarAcum(dni, incluyeActual) {
      var box = document.getElementById('acumBox'); box.style.display = 'none';
      try {
        var anio = (document.getElementById('fecha_inicio').value || '').slice(0, 4) || document.getElementById('fAnio').value;
        var r = await api('bs_acumuladoDescansos', { dni: dni, anio: anio });
        if (!r.ok) return;
        box.innerHTML = '📊 Acumulado ' + esc(r.anio) + ' de este trabajador: <b>' + esc(r.total) + ' / ' + esc(r.umbral) + ' días</b>' + (r.maternidad ? ' (+ ' + esc(r.maternidad) + ' de maternidad)' : '') +
          (r.excedente > 0 ? ' · <span style="color:#b91c1c;font-weight:600;">supera el umbral en ' + esc(r.excedente) + ' día(s): corresponde subsidio EsSalud</span>' : r.total >= 15 ? ' · <span style="color:#b45309;font-weight:600;">cerca del umbral</span>' : '') +
          (r.items && r.items.length ? '<div class="bs-text-xs bs-text-muted" style="margin-top:.3rem;">' + r.items.map(function (i) { return '#' + i.id + ' ' + fecha(i.inicio) + '→' + fecha(i.fin) + ' (' + i.dias + 'd)'; }).join(' · ') + '</div>' : '');
        box.style.display = 'block';
      } catch (e) {}
    }
    async function guardar(ev) {
      ev.preventDefault();
      var btn = document.getElementById('btnGuardar'); btn.disabled = true; btn.textContent = 'Guardando…';
      var d = {}; CAMPOS.forEach(function (f) { d[f] = document.getElementById(f).value.trim(); });
      d.nombre = d.nombre.toUpperCase(); d.cie10 = d.cie10.toUpperCase();
      try {
        var id = document.getElementById('dmId').value;
        var r = id ? await api('bs_actualizarDescanso', { id: id, datos: d }) : await api('bs_crearDescanso', { datos: d });
        if (!r.ok) { appAlert(r.message || 'No se pudo guardar.'); return; }
        cerrarModal();
        var msg = r.message + (r.acumulado != null && r.acumulado > UMBRAL ? '\n\n⚠️ Este trabajador acumula ' + r.acumulado + ' días en el año: corresponde generar el expediente de subsidio.' : '');
        appAlert(msg);
        cargar();
      } catch (e) { appAlert('Error: ' + e.message); }
      finally { btn.disabled = false; btn.textContent = '💾 Guardar'; }
    }
    async function generarSubsidio(id) {
      var x = DATA.find(function (r) { return String(r.id) === String(id); }); if (!x) return;
      if (!(await appConfirm('¿Crear el expediente de Subsidio para ' + x.nombre + ' a partir del descanso #' + id + '?\n\nSe registrarán solo los días que exceden los ' + UMBRAL + ' del año (maternidad: todos).'))) return;
      try {
        var r = await api('bs_generarSubsidioDesdeDM', { id: id });
        appAlert(r.message || (r.ok ? 'Expediente creado.' : 'No se pudo generar.'));
        if (r.ok) cargar();
      } catch (e) { appAlert('Error: ' + e.message); }
    }

    // logout(): compartida en assets/js/bs-core.js

    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') cerrarModal(); });
    window.EXPORT_TABLE_SELECTOR = '#tablaDM';
    cargar();
  