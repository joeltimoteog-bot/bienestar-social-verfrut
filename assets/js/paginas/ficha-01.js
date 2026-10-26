/* Bienestar Social · modulos/ficha.html · bloque 1 (antes en la linea 150) · extraido el 26-oct-2026 sin cambios (_BS_MODULAR_V1) */
    const BS_API_URL = 'https://script.google.com/macros/s/AKfycbyJIUtdpApEc35Jj4ZNP-3ONqGe64J1VhaRvkt87vVUNTgSagrOgOS0T99eIt0-w3Yi/exec';

    // ===== AUTH =====
    const session = localStorage.getItem('bienestarSocialAuth');
    if (!session) window.location.href = '../index.html';
    let user;
    try { user = JSON.parse(session); if (!user || !user.usuario) throw new Error(); }
    catch (e) { window.location.href = '../index.html'; }
    document.getElementById('userName').textContent = user.nombre || user.usuario;

    // api(): compartida en assets/js/bs-core.js

    // esc(): compartida en assets/js/bs-core.js
    function fecha(v) { return v ? (window.bsFechaDMY ? bsFechaDMY(v) : v) : '—'; }
    function soles(n) { return 'S/ ' + (Number(n) || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
    function badgeEstado(e) {
      var s = String(e || '').toLowerCase();
      if (/cerrad|finaliz|cobrad|recuper|resuelt/.test(s)) return 'bs-badge-success';
      if (/no recuper|rechaz|anulad/.test(s)) return 'bs-badge-danger';
      if (/proceso|seguim|pendien|abiert|investig/.test(s)) return 'bs-badge-warning';
      return 'bs-badge-info';
    }

    // ===== BUSCADOR =====
    var $q = document.getElementById('q'), $sugg = document.getElementById('sugg'), _tmr = null, _sel = -1, _cands = [];
    $q.addEventListener('input', function () {
      clearTimeout(_tmr);
      var v = $q.value.trim();
      if (v.length < 3 || v === _abriendo) { cerrarSugg(); return; }
      _abriendo = '';
      _tmr = setTimeout(function () { buscar(v); }, 260);
    });
    $q.addEventListener('keydown', function (e) {
      var items = $sugg.querySelectorAll('button');
      if (e.key === 'ArrowDown' && items.length) { e.preventDefault(); _sel = Math.min(_sel + 1, items.length - 1); marcar(items); }
      else if (e.key === 'ArrowUp' && items.length) { e.preventDefault(); _sel = Math.max(_sel - 1, 0); marcar(items); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        if (_sel >= 0 && _cands[_sel]) abrir(_cands[_sel].dni);
        else if (/^\d{8}$/.test($q.value.trim())) abrir($q.value.trim());
      } else if (e.key === 'Escape') cerrarSugg();
    });
    document.addEventListener('keydown', function (e) { if (e.key === '/' && document.activeElement !== $q) { e.preventDefault(); $q.focus(); $q.select(); } });
    document.addEventListener('click', function (e) { if (!e.target.closest('.fi-search')) cerrarSugg(); });
    function marcar(items) { items.forEach(function (b, i) { b.classList.toggle('on', i === _sel); }); if (items[_sel]) items[_sel].scrollIntoView({ block: 'nearest' }); }
    function cerrarSugg() { $sugg.style.display = 'none'; $sugg.innerHTML = ''; _sel = -1; _cands = []; }

    async function buscar(v) {
      try {
        var r = await api('bs_fichaBuscar', { q: v });
        if (!r.ok) { cerrarSugg(); return; }
        if ($q.value.trim() === _abriendo) { cerrarSugg(); return; }
        _cands = r.items || []; _sel = -1;
        if (!_cands.length) { $sugg.innerHTML = '<button disabled><small>Sin coincidencias en el padrón</small></button>'; $sugg.style.display = 'block'; return; }
        $sugg.innerHTML = _cands.map(function (c) {
          return '<button type="button" data-dni="' + esc(c.dni) + '"><b>' + esc(c.dni) + '</b><span style="flex:1;min-width:0;">' + esc(c.nombre) + '<br><small>' + esc(c.cargo || '') + (c.zona ? ' · ' + esc(c.zona) : '') + '</small></span><span class="bs-badge ' + (c.empresa === 'RAPEL' ? 'bs-badge-primary' : 'bs-badge-info') + '">' + esc(c.empresa) + '</span></button>';
        }).join('');
        $sugg.querySelectorAll('button[data-dni]').forEach(function (b) { b.addEventListener('click', function () { abrir(b.dataset.dni); }); });
        $sugg.style.display = 'block';
      } catch (e) { cerrarSugg(); }
    }

    // ===== FICHA =====
    var _F = null;
    var _abriendo = '';
    async function abrir(dni) {
      clearTimeout(_tmr); _abriendo = dni; cerrarSugg();
      $q.value = dni;
      var est = document.getElementById('estado');
      document.getElementById('ficha').hidden = true;
      est.innerHTML = '<div class="bs-text-center" style="padding:2rem"><div class="bs-spinner bs-spinner-dark" style="margin:0 auto"></div><p class="bs-text-muted bs-text-sm">Armando la ficha…</p></div>';
      try {
        var r = await api('bs_fichaTrabajador', { dni: dni });
        if (!r.ok) {
          est.innerHTML = '<div class="bs-alert bs-alert-danger"><strong>No se pudo abrir la ficha:</strong> ' + esc(r.message || 'error desconocido') +
            (/no definid|not defined|unknown action|acción/i.test(r.message || '') ? '<br><span class="bs-text-sm">🔧 Verifica que <code>bs-ficha.gs</code> esté instalado y los dos <code>case</code> agregados en <code>doPost</code>.</span>' : '') + '</div>';
          return;
        }
        _F = r; est.innerHTML = '';
        try { history.replaceState(null, '', '?dni=' + dni); } catch (e) {}
        render();
      } catch (err) {
        est.innerHTML = '<div class="bs-alert bs-alert-danger">Error: ' + esc(err.message) + '</div>';
      }
    }

    function render() {
      var F = _F, p = F.padron, c = F.contrato;
      document.getElementById('ficha').hidden = false;
      document.getElementById('btnImprimir').disabled = false;

      // Cabecera
      var nombre = p ? p.nombre : 'DNI ' + F.dni + ' (no está en el padrón)';
      document.getElementById('fNombre').textContent = nombre;
      document.getElementById('fAvatar').textContent = p ? (p.nombre || '?').trim().split(/\s+/).slice(0, 2).map(function (x) { return x.charAt(0); }).join('') : '?';
      var meta = [['DNI', F.dni]];
      if (p) meta.push(['Empresa', p.empresa], ['Cargo', p.cargo], ['Sector', p.zona], ['Régimen', p.regimen], ['Ingreso', fecha(p.fecha_inicio)], ['Término', p.fecha_termino ? fecha(p.fecha_termino) : '—'], ['Código', p.codigo]);
      document.getElementById('fMeta').innerHTML = meta.filter(function (m) { return m[1]; }).map(function (m) { return '<span>' + esc(m[0]) + ': <b>' + esc(m[1]) + '</b></span>'; }).join('');
      var chips = '';
      if (c) {
        chips += '<span class="fi-chip ' + esc(c.tipo) + '">📄 ' + esc(c.etiqueta) + (c.antiguedadTexto ? ' · ' + esc(c.antiguedadTexto) : '') + '</span>';
        if (c.proximoIndeterminado) chips += '<span class="fi-chip prox">⏳ Próximo a indeterminado · ' + fecha(c.fechaIndeterminado) + '</span>';
        if (c.porVencerDias !== null && c.porVencerDias >= 0 && c.porVencerDias <= 30) chips += '<span class="fi-chip prox">⚠️ Contrato vence en ' + c.porVencerDias + ' día(s)</span>';
      }
      if (F.cache) chips += '<span class="fi-chip sin_fecha" title="Datos en caché del servidor (10 min)">⚡ caché</span>';
      document.getElementById('fChips').innerHTML = chips;

      // Alertas
      var al = F.alertas || [];
      document.getElementById('fAlertas').innerHTML = al.length ? al.map(function (a) {
        return '<div class="fi-alert ' + esc(a.nivel) + '"><span>' + (a.nivel === 'rojo' ? '🔴' : '🟡') + '</span><div style="flex:1;min-width:0;"><b>' + esc(a.titulo) + '</b><div class="bs-text-sm bs-text-muted">' + esc(a.detalle || '') + '</div></div><span class="bs-badge">' + esc(a.modulo) + '</span></div>';
      }).join('') : '<div class="fi-alert"><span>🟢</span><div>Sin alertas activas para este trabajador.</div></div>';

      // KPIs
      var k = F.kpis || {}, perm = F.permisos || {};
      var kp = [];
      if (perm.accidentes) kp.push(['Accidentes', k.accidentes_total || 0, (k.accidentes_abiertos || 0) + ' en seguimiento']);
      if (perm.subsidios) {
        kp.push(['Subsidios', k.subsidios_total || 0, (k.subsidios_dias || 0) + ' días subsidiados']);
        kp.push(['Por cobrar', soles(k.subsidios_por_cobrar), 'cobrado ' + soles(k.subsidios_cobrado)]);
      }
      if (perm.descansos) kp.push(['Descanso médico ' + new Date().getFullYear(), (k.descansos_dias_anio || 0) + ' / ' + (k.descansos_umbral || 20) + ' d', (k.descansos_total || 0) + ' descanso(s) registrados']);
      if (perm.hostigamiento) kp.push(['Casos de hostigamiento', k.hostigamiento_total || 0, 'ambas sedes']);
      kp.push(['Documentos', k.documentos || 0, 'adjuntos en sus casos']);
      document.getElementById('fKpis').innerHTML = kp.map(function (x) {
        return '<div class="bs-card fi-kpi"><div class="l">' + esc(x[0]) + '</div><div class="v">' + esc(x[1]) + '</div><div class="s">' + esc(x[2]) + '</div></div>';
      }).join('');

      // Pestañas
      document.getElementById('nAcc').textContent = (F.accidentes || []).length;
      document.getElementById('nSub').textContent = (F.subsidios || []).length;
      document.getElementById('nDm').textContent = (F.descansos || []).length;
      document.getElementById('tabDm').hidden = !perm.descansos;
      document.getElementById('nHos').textContent = (F.hostigamiento || []).length;
      document.getElementById('nDoc').textContent = (F.documentos || []).length;
      document.getElementById('nTl').textContent = (F.timeline || []).length;
      document.getElementById('tabHos').hidden = !perm.hostigamiento;

      document.getElementById('p-acc').innerHTML = !perm.accidentes ? sinPermiso('Accidentes') : tabla(F.accidentes, [
        ['#', function (a) { return '<a href="accidentes.html?id=' + esc(a.id) + '"><b>#' + esc(a.id) + '</b></a>'; }],
        ['Fecha', function (a) { return fecha(a.dia_accidente); }],
        ['Tipo', function (a) { return esc(a.tipo_accidente); }],
        ['Parte del cuerpo', function (a) { return esc(a.parte_cuerpo); }],
        ['Diagnóstico', function (a) { return esc(a.diagnostico); }],
        ['Descanso', function (a) { return esc(a.descanso_medico || '—'); }],
        ['Restricción hasta', function (a) { return a.fecha_fin_restriccion ? fecha(a.fecha_fin_restriccion) + ' (' + a.dias_restriccion + ' d)' : '—'; }],
        ['Estado', function (a) { return '<span class="bs-badge ' + badgeEstado(a.estado_caso) + '">' + esc(a.estado_caso || '—') + '</span>'; }]
      ], 'Sin accidentes registrados.');

      document.getElementById('p-sub').innerHTML = !perm.subsidios ? sinPermiso('Subsidios') : tabla(F.subsidios, [
        ['#', function (s) { return '<a href="subsidios.html?id=' + esc(s.id) + '"><b>#' + esc(s.id) + '</b></a>'; }],
        ['Periodo', function (s) { return esc(s.anio) + (s.mes ? '-' + esc(s.mes) : ''); }],
        ['Contingencia', function (s) { return esc(s.contingencia || s.tipo); }],
        ['Inicio', function (s) { return fecha(s.inicio); }],
        ['Término', function (s) { return fecha(s.termino); }],
        ['Días', function (s) { return esc(s.dias); }],
        ['Monto', function (s) { return '<b>' + soles(s.monto) + '</b>'; }],
        ['Expediente', function (s) { return esc(s.expediente || '—'); }],
        ['Estado', function (s) { return '<span class="bs-badge ' + badgeEstado(s.categoria === 'cobrado' ? 'cobrado' : s.categoria === 'no_recuperable' ? 'no recuperable' : 'pendiente') + '">' + esc(s.estado_general || s.categoria.replace('_', ' ')) + '</span>'; }]
      ], 'Sin subsidios registrados.');

      document.getElementById('p-dm').innerHTML = !perm.descansos ? sinPermiso('Descansos Médicos') : tabla(F.descansos, [
        ['#', function (d) { return '<a href="descansos.html"><b>#' + esc(d.id) + '</b></a>'; }],
        ['Tipo', function (d) { return esc(d.tipo); }],
        ['Inicio', function (d) { return fecha(d.fecha_inicio); }],
        ['Fin', function (d) { return fecha(d.fecha_fin); }],
        ['Días', function (d) { return '<b>' + esc(d.dias) + '</b>'; }],
        ['Diagnóstico', function (d) { return esc(d.diagnostico || '') + (d.cie10 ? ' <span class="bs-badge">' + esc(d.cie10) + '</span>' : ''); }],
        ['CITT', function (d) { return d.citt_estado === 'Canjeado' ? '<span class="bs-badge bs-badge-success">' + esc(d.citt_numero || 'Canjeado') + '</span>' : d.citt_estado === 'Pendiente de canje' ? '<span class="bs-badge bs-badge-warning">Pendiente</span>' : '<span class="bs-badge">' + esc(d.citt_estado || 'N/A') + '</span>'; }],
        ['Subsidio', function (d) { return d.id_subsidio ? '<a href="subsidios.html?id=' + esc(d.id_subsidio) + '"><b>#' + esc(d.id_subsidio) + '</b></a>' : '—'; }],
        ['Estado', function (d) { return '<span class="bs-badge ' + (d.estado === 'Activo' ? 'bs-badge-warning' : 'bs-badge-success') + '">' + esc(d.estado || '—') + '</span>'; }]
      ], 'Sin descansos médicos registrados.');

      document.getElementById('p-hos').innerHTML = !perm.hostigamiento ? sinPermiso('Hostigamiento') : tabla(F.hostigamiento, [
        ['Código', function (h) { return '<a href="hostigamiento.html"><b>' + esc(h.codigo) + '</b></a>'; }],
        ['Sede', function (h) { return esc(h.sede); }],
        ['Fecha', function (h) { return fecha(h.fecha_denuncia); }],
        ['Rol en el caso', function (h) { return '<span class="bs-badge ' + (h.rol === 'denunciado' ? 'bs-badge-danger' : 'bs-badge-info') + '">' + esc(h.rol) + '</span>'; }],
        ['Otra parte', function (h) { return '<span class="nm">' + esc(h.otra_parte) + '</span>'; }],
        ['Medida de protección', function (h) { return esc(h.medida_proteccion || '—'); }],
        ['Estado', function (h) { return '<span class="bs-badge ' + badgeEstado(h.status) + '">' + esc(h.status || '—') + '</span>'; }],
        ['Decisión', function (h) { return esc(h.decision || '—'); }]
      ], 'Sin casos de hostigamiento.') + (perm.hostigamiento ? '<p class="bs-text-xs bs-text-muted" style="margin:.6rem 0 0;">🔒 Los nombres de la otra parte se muestran enmascarados (Ley 29733).</p>' : '');

      document.getElementById('p-doc').innerHTML = tabla(F.documentos, [
        ['Módulo', function (d) { return esc(d.modulo); }],
        ['Caso', function (d) { return '#' + esc(d.caso_id); }],
        ['Archivo', function (d) { return (window.bsmVerEvid ? '<a href="#" onclick="bsmVerEvid(' + esc(d.id) + ', this);return false;">' : '') + esc(d.nombre) + (window.bsmVerEvid ? '</a>' : ''); }],
        ['Tipo', function (d) { return esc(d.tipo || ''); }],
        ['Tamaño', function (d) { return d.tamano_kb ? esc(d.tamano_kb) + ' KB' : ''; }],
        ['Fecha', function (d) { return fecha(d.fecha); }]
      ], 'Sin documentos adjuntos en sus casos.');

      var col = { accidentes: '#dc2626', subsidios: '#0891b2', hostigamiento: '#7c3aed', descansos: '#be185d' };
      document.getElementById('p-tl').innerHTML = (F.timeline || []).length
        ? '<ul class="fi-tl">' + F.timeline.map(function (t) {
            return '<li style="--c:' + (col[t.modulo] || '#0033A0') + ';"><div class="f">' + fecha(t.fecha) + ' · ' + esc(t.modulo) + '</div><b>' + esc(t.titulo) + '</b>' + (t.detalle ? '<div class="bs-text-sm bs-text-muted">' + esc(t.detalle) + '</div>' : '') + '</li>';
          }).join('') + '</ul>'
        : '<div class="fi-empty">Sin eventos registrados.</div>';

      document.getElementById('fPie').textContent = 'Ficha generada el ' + new Date().toLocaleString('es-PE') + ' por ' + (user.nombre || user.usuario) + '. Datos de solo lectura; para editar, abre el registro en su módulo.';
      aplicarDiscreto();
      mostrarTab('acc');
    }

    function tabla(rows, cols, vacio) {
      if (!rows || !rows.length) return '<div class="fi-empty">' + esc(vacio) + '</div>';
      var h = '<div class="bs-table-wrap"><table class="bs-table"><thead><tr>' + cols.map(function (c) { return '<th>' + esc(c[0]) + '</th>'; }).join('') + '</tr></thead><tbody>';
      rows.forEach(function (r) { h += '<tr>' + cols.map(function (c) { return '<td>' + c[1](r) + '</td>'; }).join('') + '</tr>'; });
      return h + '</tbody></table></div>';
    }
    function sinPermiso(m) { return '<div class="fi-empty">🔒 No tienes permiso para ver el módulo ' + esc(m) + '.</div>'; }

    document.getElementById('tabs').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-t]'); if (b) mostrarTab(b.dataset.t);
    });
    function mostrarTab(t) {
      document.querySelectorAll('#tabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.t === t); });
      ['acc', 'sub', 'dm', 'hos', 'doc', 'tl'].forEach(function (k) { document.getElementById('p-' + k).hidden = k !== t; });
    }

    // Modo discreto: enmascara nombres en pantalla (no cambia los datos)
    var _disc = false;
    try { _disc = localStorage.getItem('bs_ficha_discreto') === '1'; } catch (e) {}
    function toggleDiscreto() { _disc = !_disc; try { localStorage.setItem('bs_ficha_discreto', _disc ? '1' : '0'); } catch (e) {} aplicarDiscreto(); }
    function aplicarDiscreto() {
      document.querySelectorAll('.nm').forEach(function (n) { n.classList.toggle('fi-mask', _disc); });
      document.getElementById('btnDiscreto').classList.toggle('bs-btn-primary', _disc);
    }
    aplicarDiscreto();

    // logout(): compartida en assets/js/bs-core.js

    // Deep link: ficha.html?dni=12345678
    (function () {
      var m = location.search.match(/[?&]dni=(\d{8})/);
      if (m) abrir(m[1]); else $q.focus();
    })();
  