/* Bienestar Social · modulos/subsidios.html · bloque 1 (antes en la linea 367) · extraido el 26-oct-2026 sin cambios (_BS_MODULAR_V1) */
    const BS_API_URL = 'https://script.google.com/macros/s/AKfycbyJIUtdpApEc35Jj4ZNP-3ONqGe64J1VhaRvkt87vVUNTgSagrOgOS0T99eIt0-w3Yi/exec';

    // ===== VALIDACION OBLIGATORIA (global) =====
    function bsValidarRequeridos(ids) {
      for (let i = 0; i < ids.length; i++) {
        const el = document.getElementById(ids[i]);
        if (!el) continue;
        const v = el.value;
        if (v === undefined || v === null || String(v).trim() === '') {
          let lbl = ids[i];
          const grp = el.closest ? el.closest('.bs-form-group') : null;
          if (grp) {
            const labelEl = grp.querySelector('.bs-label');
            if (labelEl) lbl = labelEl.textContent.replace(/\s+/g,' ').replace(/\s*\*\s*$/,'').trim();
          }
          return { ok: false, id: ids[i], label: lbl };
        }
      }
      return { ok: true };
    }


    // ===== AUTH =====
    const session = localStorage.getItem('bienestarSocialAuth');
    if (!session) window.location.href = '../index.html';
    let user;
    try {
      user = JSON.parse(session);
      if (!user || !user.usuario) throw new Error();
    } catch(e) {
      window.location.href = '../index.html';
    }
    if (!user.permisos || !user.permisos.subsidios) {
      appAlert('No tienes permiso para acceder a este módulo');
      window.location.href = '../portal.html';
    }
    document.getElementById('userName').textContent = user.nombre || user.usuario;

    // ===== API HELPER =====
    // api(): compartida en assets/js/bs-core.js

    // esc(): compartida en assets/js/bs-core.js

    // ===== FORMATO MONEDA =====
    // Acepta números o textos como "S/ 457.10" o "1,234.50"
    function numMoney(v) {
      if (v === '' || v === null || v === undefined) return 0;
      var n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
      return isNaN(n) ? 0 : n;
    }
    function fmtMoney(n) {
      var v = numMoney(n);
      return v ? 'S/ ' + v.toFixed(2) : '-';
    }

    // ===== LISTAR =====
    // ===== CACHÉ LOCAL (carga instantánea + refresco en segundo plano) =====
    let _CACHE_S = [];
    const _CACHE_KEY_S = 'bs_cache_subsidios_v1';

    async function cargarSubsidios() {
      const cont = document.getElementById('tablaContainer');
      let pintado = false;
      try {
        const c = JSON.parse(localStorage.getItem(_CACHE_KEY_S) || 'null');
        if (c && Array.isArray(c.items) && c.items.length) { _CACHE_S = c.items; poblarFiltrosSub(); renderSubsidios(); pintado = true; }
      } catch(e) {}
      if (!pintado) cont.innerHTML = '<div class="bs-text-center" style="padding:2rem"><div class="bs-spinner bs-spinner-dark" style="margin:0 auto"></div></div>';

      try {
        const res = await api('bs_listarSubsidios', {});
        if (!res.ok) {
          if (!pintado) cont.innerHTML = '<div class="bs-alert bs-alert-danger">Error: ' + res.message + '</div>';
          return;
        }
        var nuevos = res.items || [];
        // ANTI-PARPADEO: solo re-pintar si los datos realmente cambiaron
        var _canon = function(a){ return JSON.stringify((a||[]).map(function(x){ return JSON.stringify(x); }).sort()); };
        var sinCambios = pintado && _canon(nuevos) === _canon(_CACHE_S);
        _CACHE_S = nuevos;
        try { localStorage.setItem(_CACHE_KEY_S, JSON.stringify({ items: _CACHE_S, t: Date.now() })); } catch(e) {}
        poblarFiltrosSub();
        if (!sinCambios) renderSubsidios();
      } catch(err) {
        if (!pintado) cont.innerHTML = '<div class="bs-alert bs-alert-danger">Error de conexión: ' + err.message + '</div>';
      }
    }

    // Completa los filtros con los valores REALES de la base (sin perder la selección)
    function poblarFiltrosSub() {
      function llenar(selId, valores) {
        const sel = document.getElementById(selId);
        if (!sel) return;
        const actual = sel.value;
        const existentes = Array.prototype.map.call(sel.options, function(o){ return o.value.toUpperCase(); });
        valores.forEach(function(v) {
          if (v && existentes.indexOf(String(v).toUpperCase()) < 0) {
            const o = document.createElement('option');
            o.value = v; o.textContent = v;
            sel.appendChild(o);
            existentes.push(String(v).toUpperCase());
          }
        });
        sel.value = actual;
      }
      function unicos(campo) {
        const s = {};
        _CACHE_S.forEach(function(it){ const v = String(it[campo] == null ? '' : it[campo]).trim(); if (v) s[v] = 1; });
        return Object.keys(s).sort();
      }
      llenar('filterTipo', unicos('tipo'));
      llenar('filterAnio', unicos('anio'));
      llenar('filterEstado', unicos('estado_general'));
    }

    // ===== RESUMEN DE RECUPERACIÓN POR AÑO =====
    function montoSub(s) {
      var v = numMoney(s.monto_total);
      if (!v) v = numMoney(s.pago_empresa) + numMoney(s.recuperado_essalud);
      if (!v) v = numMoney(s.reembolso_por_mes);
      if (!v) v = numMoney(s.calculo_por_dia) * (parseInt(s.dias) || 0);
      return v;
    }
    function catEstadoSub(s) {
      var e = String(s.estado_general || '').trim().toUpperCase();
      if (e === 'COBRADO' || e === 'RECUPERADO') return 'rec';
      if (e === 'NO RECUPERABLE') return 'nor';
      return 'pen'; // por cobrar / pendiente / en proceso / pagado / otros
    }
    function renderResumenSub() {
      var box = document.getElementById('resumenAnual');
      if (!box) return;
      var fEmp = document.getElementById('filterEmpresa').value;
      var fTipo = document.getElementById('filterTipo').value;
      var U = function(v){ return String(v == null ? '' : v).trim().toUpperCase(); };
      var items = _CACHE_S.slice();
      if (fEmp)  items = items.filter(function(x){ return U(x.empresa) === U(fEmp); });
      if (fTipo) items = items.filter(function(x){ return U(x.tipo) === U(fTipo); });
      if (!items.length) { box.style.display = 'none'; return; }

      var porAnio = {}, tot = { rec:0, pen:0, nor:0, n:0 };
      items.forEach(function(x){
        var a = String(x.anio || 'Sin año');
        if (!porAnio[a]) porAnio[a] = { rec:0, pen:0, nor:0, n:0 };
        var c = catEstadoSub(x), m = montoSub(x);
        porAnio[a][c] += m; porAnio[a].n++;
        tot[c] += m; tot.n++;
      });

      var F = function(n){ return 'S/ ' + (n||0).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2}); };
      document.getElementById('recKpis').innerHTML =
        '<div class="rec-kpi verde"><div class="v">' + F(tot.rec) + '</div><div class="l">✅ Recuperado (Cobrado)</div></div>' +
        '<div class="rec-kpi azul"><div class="v">' + F(tot.pen) + '</div><div class="l">⏳ Por Cobrar</div></div>' +
        '<div class="rec-kpi ambar"><div class="v">' + F(tot.nor) + '</div><div class="l">⚠ No Recuperable</div></div>' +
        '<div class="rec-kpi gris"><div class="v">' + tot.n + '</div><div class="l">📋 Casos totales</div></div>';

      // desglose por empresa (solo si no hay filtro de empresa y existen varias)
      var porEmp = {};
      items.forEach(function(x){
        var em = U(x.empresa) || 'SIN EMPRESA';
        if (!porEmp[em]) porEmp[em] = { rec:0, pen:0, nor:0, n:0 };
        var c2 = catEstadoSub(x), m2 = montoSub(x);
        porEmp[em][c2] += m2; porEmp[em].n++;
      });
      var emps = Object.keys(porEmp).sort();
      var htmlEmp = '';
      if (!fEmp && emps.length > 1) {
        htmlEmp = emps.map(function(em){
          var d = porEmp[em];
          var base = d.rec + d.pen;
          var pct = base ? Math.round(d.rec * 100 / base) : 0;
          return '<div class="rec-year" style="background:' + (em==='RAPEL' ? '#fdf0e0' : '#f0f5ff') + ';border-radius:9px;padding:9px 12px;border-bottom:none;margin-bottom:6px;">' +
            '<span class="yr" style="min-width:82px;">🏢 ' + esc(em) + '</span>' +
            '<span class="dt"><b>' + F(d.rec) + '</b> recuperado · <span class="pc">' + F(d.pen) + '</span> por cobrar · <span class="nr">' + F(d.nor) + '</span> no recup. · ' + d.n + ' casos</span>' +
            '<span class="rec-bar"><i style="width:' + pct + '%"></i></span>' +
            '<span class="rec-pct">' + pct + '% recup.</span>' +
          '</div>';
        }).join('') + '<div style="height:6px;"></div>';
      }

      var anios = Object.keys(porAnio).sort().reverse();
      document.getElementById('recAnios').innerHTML = htmlEmp + anios.map(function(a){
        var d = porAnio[a];
        var base = d.rec + d.pen;
        var pct = base ? Math.round(d.rec * 100 / base) : 0;
        return '<div class="rec-year">' +
          '<span class="yr">' + esc(a) + '</span>' +
          '<span class="dt"><b>' + F(d.rec) + '</b> recuperado · <span class="pc">' + F(d.pen) + '</span> por cobrar · <span class="nr">' + F(d.nor) + '</span> no recup. · ' + d.n + ' casos</span>' +
          '<span class="rec-bar"><i style="width:' + pct + '%"></i></span>' +
          '<span class="rec-pct">' + pct + '% recup.</span>' +
        '</div>';
      }).join('');
      box.style.display = 'block';
    }

    // Render con filtros EN CLIENTE (instantáneo)
    function renderSubsidios() {
      renderResumenSub();
      const cont = document.getElementById('tablaContainer');
      const fEmp = document.getElementById('filterEmpresa').value;
      const fTipo = document.getElementById('filterTipo').value;
      const fAnio = document.getElementById('filterAnio').value;
      const fEst = document.getElementById('filterEstado').value;
      let items = (document.getElementById('verAnulados')||{}).checked ? _CACHE_S.slice() : _CACHE_S.slice().filter(function(x){ return !x.anulado; });
      const U = function(v){ return String(v == null ? '' : v).trim().toUpperCase(); };
      if (fEmp)  items = items.filter(function(s){ return U(s.empresa) === U(fEmp); });
      if (fTipo) items = items.filter(function(s){ return U(s.tipo) === U(fTipo); });
      if (fAnio) items = items.filter(function(s){ return String(s.anio) === String(fAnio); });
      if (fEst)  items = items.filter(function(s){ return U(s.estado_general) === U(fEst); });

      if (items.length === 0) {
        cont.innerHTML = '<div class="bs-card bs-text-center"><p class="bs-text-muted">No hay subsidios registrados con esos filtros.</p></div>';
        return;
      }

      {
        const res = { items: items };
        // ── SEMÁFORO DE PLAZOS: subsidios PENDIENTES por antigüedad del período ──
        var _semC = { rojo: 0, ambar: 0, verde: 0 };
        res.items.forEach(function(s){ var x=_semaforoSub(s); if(x.n) _semC[x.n]++; });
        var _semStrip = (_semC.rojo||_semC.ambar||_semC.verde) ?
          '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:0 0 10px;font-size:12.5px;font-weight:800">' +
          (_semC.rojo ? '<span style="background:#fee2e2;color:#b91c1c;padding:4px 12px;border-radius:999px">🔴 '+_semC.rojo+' pendiente(s) hace &gt;2 meses</span>' : '') +
          (_semC.ambar ? '<span style="background:#fef3c7;color:#b45309;padding:4px 12px;border-radius:999px">🟡 '+_semC.ambar+' de 1–2 meses</span>' : '') +
          (_semC.verde ? '<span style="background:#dcfce7;color:#15803d;padding:4px 12px;border-radius:999px">🟢 '+_semC.verde+' del mes actual</span>' : '') +
          '</div>' : '';
        let html = _semStrip + '<div class="bs-table-wrap"><table class="bs-table">';
        html += '<thead><tr><th>ID</th><th>Año-Mes</th><th>Trabajador</th><th>DNI</th><th>Empresa</th><th>Tipo</th><th>Días</th><th>Monto Total</th><th>Estado</th><th></th></tr></thead><tbody>';
        window.__BS_EXPORT_DATA__ = res.items || [];
        window.__VIS_SUBS = res.items || [];
        res.items.forEach(function(s, _i) {
          const trabajador = [s.apellido_paterno, s.apellido_materno, s.nombres].filter(Boolean).join(' ') || '-';
          const periodo = (s.anio || '-') + (s.mes ? ' ' + s.mes : '');
          const _dni = s.numero || s.dni || s.DNI || '-';
          var _monto = numMoney(s.monto_total);
          if (!_monto) _monto = numMoney(s.pago_empresa) + numMoney(s.recuperado_essalud);
          if (!_monto) _monto = numMoney(s.calculo_por_dia) * (parseInt(s.dias) || 0);
          const eg = String(s.estado_general || '').trim().toUpperCase();
          const estadoBadge = (eg === 'PAGADO' || eg === 'RECUPERADO' || eg === 'COBRADO') ? 'bs-badge-success'
            : eg === 'PENDIENTE' ? 'bs-badge-danger'
            : eg === 'NO RECUPERABLE' ? 'bs-badge-warning'
            : 'bs-badge-info';
          html += '<tr' + (s.anulado ? ' style="opacity:.6;background:#fdf3f3;"' : '') + '>' +
            '<td><strong>#' + s.id + '</strong></td>' +
            '<td>' + esc(periodo) + '</td>' +
            '<td>' + esc(trabajador) + '</td>' +
            '<td>' + esc(_dni) + '</td>' +
            '<td>' + esc(s.empresa || '-') + '</td>' +
            '<td>' + esc(/^\d+$/.test(String(s.tipo)) ? (s.descripcion || s.tipo) : (s.tipo || '-')) + '</td>' +
            '<td style="text-align: right;">' + (s.dias || 0) + '</td>' +
            '<td style="text-align: right;"><strong>' + fmtMoney(_monto) + '</strong></td>' +
            '<td><span class="bs-badge ' + estadoBadge + '">' + esc(s.estado_general || '-') + '</span>' + (_semaforoSub(s).chip || '') + '</td>' +
            '<td style="white-space:nowrap;"><button class="bs-btn bs-btn-sm bs-btn-outline" onclick="editarIdx(' + _i + ')">Editar</button> ' +
            (s.anulado
              ? '<button class="bs-btn bs-btn-sm bs-btn-ghost" title="Restaurar registro" style="color:#15803d;font-weight:800;" onclick="bsRestaurar(' + (s.id || 0) + ')">↩</button>'
              : '<button class="bs-btn bs-btn-sm bs-btn-ghost" title="Anular registro" style="color:#991b1b;font-weight:800;" onclick="bsAnular(' + (s.id || 0) + ')">✖</button>') +
            '</td>' +
          '</tr>';
        });
        html += '</tbody></table></div>';
        cont.innerHTML = html;
      }
    }

    // ===== SEMÁFORO DE PLAZOS (subsidios PENDIENTES por antigüedad del período) =====
    function _semMesNum(m) {
      m = String(m || '').toLowerCase().trim();
      var map = { enero:1, febrero:2, marzo:3, abril:4, mayo:5, junio:6, julio:7,
                  agosto:8, septiembre:9, setiembre:9, octubre:10, noviembre:11, diciembre:12 };
      if (map[m]) return map[m];
      var n = parseInt(m, 10);
      return (n >= 1 && n <= 12) ? n : null;
    }
    function _semSubChip(bg, col, txt) {
      return '<br><span style="display:inline-block;margin-top:3px;background:'+bg+';color:'+col+';font-size:10.5px;font-weight:800;padding:2px 8px;border-radius:999px;white-space:nowrap">'+txt+'</span>';
    }
    function _semaforoSub(s) {
      if (s.anulado) return {};
      var eg = String(s.estado_general || '').trim().toUpperCase();
      if (eg !== 'PENDIENTE') return {};
      var a = parseInt(s.anio, 10), m = _semMesNum(s.mes);
      if (!a || !m) return {};
      var h = new Date();
      var meses = (h.getFullYear() - a) * 12 + (h.getMonth() + 1 - m);
      if (meses <= 0) return { n:'verde', chip:_semSubChip('#dcfce7','#15803d','🟢 del mes') };
      if (meses <= 2) return { n:'ambar', chip:_semSubChip('#fef3c7','#b45309','🟡 hace '+meses+' mes'+(meses>1?'es':'')) };
      return { n:'rojo', chip:_semSubChip('#fee2e2','#b91c1c','🔴 hace '+meses+' meses') };
    }

    // ===== MODAL =====

    async function bsRestaurar(id) {
      if (!id) return;
      if (!(await appConfirm('¿Restaurar el registro #' + id + '? Volverá a la vista normal.'))) return;
      try {
        const res = await api('bs_restaurarRegistro', { usuario: user.usuario, modulo: 'subsidios', id: parseInt(id) });
        if (res.ok) { appAlert('Registro #' + id + ' restaurado.'); renderSubsidios(); }
        else appAlert('Error: ' + (res.message || 'No se pudo restaurar.'));
      } catch (e) { appAlert('Error: ' + e.message); }
    }
    async function bsAnular(id) {
      if (!id) return appAlert('Este registro no tiene ID; numéralo en la hoja para poder anularlo.');
      if (!(await appConfirm('¿Anular el registro #' + id + '? No se elimina: queda marcado como ANULADO y sale de la vista.'))) return;
      var motivo = window.prompt('Motivo de la anulación (obligatorio):') || '';
      if (!motivo.trim()) return appAlert('Debes indicar un motivo para anular.');
      try {
        const res = await api('bs_anularRegistro', { usuario: user.usuario, modulo: 'subsidios', id: parseInt(id), motivo: motivo.trim() });
        if (res.ok) { appAlert('Registro #' + id + ' anulado.'); cargarSubsidios(); }
        else appAlert('Error: ' + (res.message || 'No se pudo anular.'));
      } catch (e) { appAlert('Error: ' + e.message); }
    }

    const ALL_FIELDS = ['anio','mes','tipo','numero','apellido_paterno','apellido_materno','nombres','estado','dias','calculo_por_dia','pago_empresa','reembolso_por_mes','recuperado_essalud','monto_total','periodo','expediente','inicio','termino','observaciones','diferencias','estado_general','empresa'];
    window.__BS_EXPORT_ORDER = ['id'].concat(ALL_FIELDS).concat(['created_by','created_at','updated_at','anulado']);
    const DATE_FIELDS = ['inicio','termino'];

    // ===== NAVEGACION INTELIGENTE =====
    const FORM_ORDER = ['numero','empresa','expediente','apellido_paterno','apellido_materno','nombres','anio','mes','tipo','periodo','inicio','termino','dias','total_remun_12m','meses_computados','calculo_por_dia','reembolso_por_mes','pago_empresa','recuperado_essalud','monto_total','diferencias','estado','estado_general','observaciones'];

    // Salta al PROXIMO campo vacio + editable + visible + habilitado. Omite llenos/readonly/disabled/ocultos.
    function focusNext(currentId) {
      const idx = FORM_ORDER.indexOf(currentId);
      if (idx < 0) return;
      for (let i = idx + 1; i < FORM_ORDER.length; i++) {
        const el = document.getElementById(FORM_ORDER[i]);
        if (!el) continue;
        if (el.readOnly || el.disabled) continue;
        if (el.offsetParent === null) continue;
        const v = el.value;
        if (v !== undefined && v !== null && String(v).trim() !== '') continue;
        el.focus();
        if (typeof el.select === 'function' && el.tagName === 'INPUT') { try { el.select(); } catch(e){} }
        return;
      }
      const btn = document.getElementById('btnSubmit');
      if (btn && !btn.disabled) btn.focus();
    }

    function setupAutoTab() {
      // Selects: auto-avance al elegir
      ['empresa','mes','tipo','estado_general'].forEach(function(id){
        const el = document.getElementById(id);
        if (el && el.tagName === 'SELECT') el.addEventListener('change', function(){ if (el.value) focusNext(id); });
      });
      // Inputs/textareas: Tab (sin Shift) y Enter (no en textarea) -> focusNext
      FORM_ORDER.forEach(function(id){
        const el = document.getElementById(id);
        if (!el) return;
        const tag = el.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') return;
        el.addEventListener('keydown', function(ev){
          if (ev.key === 'Tab' && !ev.shiftKey) { ev.preventDefault(); focusNext(id); }
          else if (ev.key === 'Enter' && tag !== 'TEXTAREA') { ev.preventDefault(); focusNext(id); }
        });
      });
    }

    function openModal() {
      window.__EDIT_SIN_ID = false;
      document.getElementById('formTitle').textContent = 'Nuevo Subsidio';
      document.getElementById('subsidioId').value = '';
      ALL_FIELDS.forEach(function(f) {
        const el = document.getElementById(f);
        if (el) el.value = '';
      });
      document.getElementById('total_remun_12m').value = '';
      document.getElementById('meses_computados').value = '12';
      document.getElementById('anio').value = new Date().getFullYear();
      document.getElementById('estado_general').value = 'En proceso';
      document.getElementById('formAlert').innerHTML = '';
      document.getElementById('formModal').classList.add('bs-active');
    }

    function closeModal() {
      document.getElementById('formModal').classList.remove('bs-active');
    }

    function editarIdx(i) {
      const s = (window.__VIS_SUBS || [])[i];
      if (!s) return appAlert('Subsidio no encontrado');
      abrirEdicionSub(s);
    }
    async function editar(id) {
      let s = _CACHE_S.find(function(x) { return String(x.id) === String(id); });
      if (!s) {
        const res = await api('bs_listarSubsidios', {});
        if (!res.ok) return appAlert('Error: ' + res.message);
        s = (res.items || []).find(function(x) { return String(x.id) === String(id); });
      }
      if (!s) return appAlert('Subsidio no encontrado');
      abrirEdicionSub(s);
    }
    function abrirEdicionSub(s) {
      window.__EDIT_SIN_ID = !s.id;
      document.getElementById('formTitle').textContent = s.id ? ('Editar Subsidio #' + s.id) : 'Editar Subsidio (importado sin ID)';
      document.getElementById('subsidioId').value = s.id || '';
      ALL_FIELDS.forEach(function(f) {
        const el = document.getElementById(f);
        if (el) {
          let v = s[f];
          if (v === null || v === undefined) v = '';
          if (DATE_FIELDS.indexOf(f) >= 0 && v) {
            v = bsFechaYMD(v);
          }
          el.value = v;
        }
      });
      // Auxiliares de cálculo (no persistidos): el diario ya viene en calculo_por_dia
      var _t12 = document.getElementById('total_remun_12m'); if (_t12) _t12.value = '';
      var _mc = document.getElementById('meses_computados'); if (_mc) _mc.value = '12';
      document.getElementById('formAlert').innerHTML = '';
      document.getElementById('formModal').classList.add('bs-active');
    }

    async function submitForm() {
      if (window.__EDIT_SIN_ID) {
        document.getElementById('formAlert').innerHTML = '<div class="bs-alert bs-alert-warning">⚠ Este registro fue importado <strong>sin ID</strong> (columna A vacía en la hoja BS_Subsidios). Numera la columna ID en la hoja para poder editarlo desde aquí.</div>';
        return;
      }
      const datos = {};
      ALL_FIELDS.forEach(function(f) {
        datos[f] = document.getElementById(f).value;
      });

      const REQUIRED_FIELDS = ['anio','tipo','empresa','dias'];
      const _req = bsValidarRequeridos(REQUIRED_FIELDS);
      if (!_req.ok) {
        document.getElementById('formAlert').innerHTML = '<div class="bs-alert bs-alert-danger">Falta completar: <strong>' + _req.label + '</strong></div>';
        const _e = document.getElementById(_req.id);
        if (_e && _e.offsetParent !== null) { try { _e.focus(); } catch(x){} }
        return;
      }

      const btn = document.getElementById('btnSubmit');
      btn.disabled = true;
      btn.textContent = 'Guardando...';

      try {
        const id = document.getElementById('subsidioId').value;
        const action = id ? 'bs_actualizarSubsidio' : 'bs_crearSubsidio';
        const payload = id
          ? { usuario: user.usuario, id: parseInt(id), datos: datos }
          : { usuario: user.usuario, datos: datos };

        const res = await api(action, payload);
        if (res.ok) {
          closeModal();
          cargarSubsidios();
        } else {
          document.getElementById('formAlert').innerHTML = '<div class="bs-alert bs-alert-danger">Error: ' + res.message + '</div>';
        }
      } catch(err) {
        document.getElementById('formAlert').innerHTML = '<div class="bs-alert bs-alert-danger">Error: ' + err.message + '</div>';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Guardar';
      }
    }

    // ===== LOGOUT =====
    // logout(): compartida en assets/js/bs-core.js

    // ===== BÚSQUEDA DNI EN AZURE (autocompletar) =====
    function setupBusquedaDNI() {
      const el = document.getElementById('numero');
      if (!el) return;
      el.addEventListener('input', async function(e) {
        const v = e.target.value.replace(/[^0-9]/g, '');
        if (v.length === 8) {
          el.style.borderColor = '#0891b2'; // buscando
          const t = await bsBuscarTrabajador(v);
          if (t) {
            if (t.ap_paterno) document.getElementById('apellido_paterno').value = t.ap_paterno;
            if (t.ap_materno) document.getElementById('apellido_materno').value = t.ap_materno;
            if (t.nombres) document.getElementById('nombres').value = t.nombres;
            if (t.empresa) document.getElementById('empresa').value = t.empresa;
            el.style.borderColor = '#10b981'; // verde = encontrado
          } else {
            el.style.borderColor = '#ef4444'; // rojo = no encontrado
          }
          setTimeout(function() { el.style.borderColor = ''; }, 2500);
        }
      });
    }

    // ===== CÁLCULO AUTOMÁTICO DE SUBSIDIO (ESSALUD Perú) =====
    const SUBSIDIO_DIAS_EMPRESA = 20; // primeros 20 días los paga la empresa (incapacidad temporal)

    function recalcularDias() {
      const ini = document.getElementById('inicio').value;
      const fin = document.getElementById('termino').value;
      if (ini && fin) {
        const d = _diasIncl(ini, fin);
        if (d >= 0) document.getElementById('dias').value = d + 1; // inclusivo
      }
    }

    function _diasIncl(ini, fin){
      if(!ini || !fin) return '';
      var a = new Date(ini), b = new Date(fin);
      if(isNaN(a.getTime()) || isNaN(b.getTime())) return '';
      var d = Math.round((b - a)/86400000) + 1;
      return d > 0 ? d : '';
    }
    function calcularSubsidio() {
      // 1) Subsidio diario (método EsSalud): total remun. computables 12 meses ÷ 360.
      //    Si hay menos de 12 meses computados, el divisor es meses × 30.
      const total12 = parseFloat(document.getElementById('total_remun_12m').value) || 0;
      let meses = parseInt(document.getElementById('meses_computados').value) || 12;
      if (meses < 1) meses = 1;
      if (meses > 12) meses = 12;
      const divisor = (meses >= 12) ? 360 : (meses * 30);
      if (total12 > 0) {
        document.getElementById('calculo_por_dia').value = +(total12 / divisor).toFixed(2);
      }
      const cpd = parseFloat(document.getElementById('calculo_por_dia').value) || 0;
      const dias = parseInt(document.getElementById('dias').value) || 0;
      const tipo = document.getElementById('tipo').value;

      if (!cpd || !dias) return; // sin base no calcula

      const montoTotal = +(cpd * dias).toFixed(2);
      let pagoEmpresa = 0, recuperado = 0;

      if (tipo === 'Maternidad') {
        recuperado = montoTotal;          // ESSALUD cubre todo
        pagoEmpresa = 0;
      } else if (tipo === 'Lactancia' || tipo === 'Sepelio') {
        return;                            // montos fijos, no por días
      } else {
        // Incapacidad Temporal (default): 20 días empresa, resto ESSALUD
        const diasEmpresa = Math.min(SUBSIDIO_DIAS_EMPRESA, dias);
        const diasEssalud = Math.max(0, dias - SUBSIDIO_DIAS_EMPRESA);
        pagoEmpresa = +(cpd * diasEmpresa).toFixed(2);
        recuperado = +(cpd * diasEssalud).toFixed(2);
      }

      document.getElementById('monto_total').value = montoTotal;
      document.getElementById('pago_empresa').value = pagoEmpresa;
      document.getElementById('recuperado_essalud').value = recuperado;
      document.getElementById('reembolso_por_mes').value = recuperado; // = recuperado ESSALUD
      document.getElementById('diferencias').value = +(montoTotal - recuperado).toFixed(2);
    }

    function setupCalculoSubsidio() {
      // fechas: recalcular días y luego montos
      ['inicio','termino'].forEach(function(id) {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', function() { recalcularDias(); calcularSubsidio(); });
      });
      // entradas que recalculan en tiempo real (mientras escribes)
      ['total_remun_12m','meses_computados','calculo_por_dia','dias'].forEach(function(id) {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', calcularSubsidio);
      });
      // tipo cambia la regla
      const t = document.getElementById('tipo');
      if (t) t.addEventListener('change', calcularSubsidio);
    }

    // ===== IMPORTAR EXCEL =====
    var _IMP_FILAS = [];      // filas listas para enviar
    var _IMP_ERRORES = [];    // filas con problemas

    // Sinónimos de encabezados (normalizados: minúsculas, sin acentos ni símbolos)
    var IMP_SINONIMOS = {
      anio: ['anio','ano','year'],
      mes: ['mes','month'],
      tipo: ['tipo','tiposubsidio','tipodesubsidio'],
      numero: ['numero','dni','documento','nrodocumento','ndocumento','numerodni','nrodni','doc','dnice'],
      apellido_paterno: ['apellidopaterno','appaterno','paterno'],
      apellido_materno: ['apellidomaterno','apmaterno','materno'],
      nombres: ['nombres','nombre','trabajador','nombrecompleto','apellidosynombres'],
      descripcion: ['descripcion'],
      estado: ['estado','estadodocumento','estadodoc'],
      dias: ['dias','ndias','totaldias','diassubsidio','diassubsidiados'],
      calculo_por_dia: ['calculopordia','subsidiodiario','calculodia','pordia','montodiario'],
      pago_empresa: ['pagoempresa','pagoemp'],
      reembolso_por_mes: ['reembolsopormes','reembolso','reembolsomes'],
      recuperado_essalud: ['recuperadoessalud','essalud','recuperado','montoessalud'],
      monto_total: ['montototal','total','monto','importetotal'],
      periodo: ['periodo'],
      expediente: ['expediente','expedienteessalud','nexpediente','nroexpediente'],
      inicio: ['inicio','fechainicio','fechainicial','desde','fechadeinicio'],
      termino: ['termino','fechatermino','fechafin','fin','hasta','fechadetermino'],
      observaciones: ['observaciones','observacion','obs'],
      diferencias: ['diferencias','diferencia'],
      tipo_pago_planilla: ['tipopagoplanilla','pagoplanilla','tipopago'],
      estado_general: ['estadogeneral','estadogral','situacion'],
      empresa: ['empresa','razonsocial','compania']
    };
    function _impNorm(s) {
      return String(s == null ? '' : s).toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // quita acentos
        .replace(/ñ/g, 'n').replace(/[^a-z0-9]/g, '');
    }
    function _impCampo(header) {
      var h = _impNorm(header);
      if (!h) return null;
      for (var campo in IMP_SINONIMOS) {
        if (IMP_SINONIMOS[campo].indexOf(h) >= 0) return campo;
      }
      return null;
    }
    // Convierte serial de Excel o texto a 'YYYY-MM-DD'
    function _impFecha(v) {
      if (v === null || v === undefined || v === '') return '';
      if (typeof v === 'number' && isFinite(v) && v > 20000 && v < 60000) {
        var d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
        return d.getUTCFullYear() + '-' + ('0'+(d.getUTCMonth()+1)).slice(-2) + '-' + ('0'+d.getUTCDate()).slice(-2);
      }
      return bsFechaYMD(v);
    }
    function _impEmpresa(v) {
      var s = String(v || '').toUpperCase();
      if (s.indexOf('RAPEL') >= 0) return 'RAPEL';
      if (s.indexOf('VERFRUT') >= 0) return 'VERFRUT';
      return String(v || '').trim();
    }

    function openImportModal() {
      _IMP_FILAS = []; _IMP_ERRORES = [];
      document.getElementById('importFile').value = '';
      document.getElementById('importResumen').innerHTML = '';
      document.getElementById('importPreview').innerHTML = '';
      document.getElementById('importAlert').innerHTML = '';
      document.getElementById('btnImport').disabled = true;
      document.getElementById('importModal').classList.add('bs-active');
    }
    function closeImportModal() { document.getElementById('importModal').classList.remove('bs-active'); }

    function leerArchivoImport(input) {
      var file = input.files && input.files[0];
      if (!file) return;
      if (typeof XLSX === 'undefined') { document.getElementById('importAlert').innerHTML = '<div class="bs-alert bs-alert-danger">La librería de Excel aún se está cargando. Intenta de nuevo en unos segundos.</div>'; return; }
      var reader = new FileReader();
      reader.onload = function (e) {
        try {
          var wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
          var ws = wb.Sheets[wb.SheetNames[0]];
          var aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
          procesarImport(aoa);
        } catch (err) {
          document.getElementById('importAlert').innerHTML = '<div class="bs-alert bs-alert-danger">No se pudo leer el archivo: ' + esc(err.message) + '</div>';
        }
      };
      reader.readAsArrayBuffer(file);
    }

    function procesarImport(aoa) {
      _IMP_FILAS = []; _IMP_ERRORES = [];
      document.getElementById('importAlert').innerHTML = '';
      if (!aoa || aoa.length < 2) {
        document.getElementById('importAlert').innerHTML = '<div class="bs-alert bs-alert-danger">El archivo no tiene datos (se necesita fila de títulos + al menos 1 fila).</div>';
        return;
      }
      // Buscar la fila de encabezados dentro de las primeras 5 filas (por si hay título arriba)
      var hIdx = 0, mejorMapeo = null, mejorCount = 0;
      for (var i = 0; i < Math.min(5, aoa.length); i++) {
        var mapeo = (aoa[i] || []).map(_impCampo);
        var count = mapeo.filter(Boolean).length;
        if (count > mejorCount) { mejorCount = count; mejorMapeo = mapeo; hIdx = i; }
      }
      if (!mejorMapeo || mejorCount < 3) {
        document.getElementById('importAlert').innerHTML = '<div class="bs-alert bs-alert-danger">No se reconocieron los títulos de columna. Revisa que la primera fila tenga encabezados como AÑO, TIPO, DNI, EMPRESA, DÍAS…</div>';
        return;
      }
      var FECHAS = ['inicio', 'termino'];
      for (var r = hIdx + 1; r < aoa.length; r++) {
        var row = aoa[r] || [];
        var vacia = row.every(function (c) { return c === '' || c === null || c === undefined; });
        if (vacia) continue;
        var f = {};
        for (var c = 0; c < mejorMapeo.length; c++) {
          var campo = mejorMapeo[c];
          if (!campo) continue;
          var v = row[c];
          if (v === null || v === undefined) v = '';
          if (FECHAS.indexOf(campo) >= 0) v = _impFecha(v);
          else if (campo === 'empresa') v = _impEmpresa(v);
          else if (typeof v === 'string') v = v.trim();
          f[campo] = v;
        }
        // Año: si falta, derivarlo de la fecha de inicio
        if (!f.anio && f.inicio) f.anio = String(f.inicio).slice(0, 4);
        // Validación mínima (los mismos requeridos del formulario)
        var faltan = [];
        if (!f.anio) faltan.push('año');
        if (!f.tipo) faltan.push('tipo');
        if (!f.empresa) faltan.push('empresa');
        if (f.dias === '' || f.dias === null || f.dias === undefined) faltan.push('días');
        if (faltan.length) _IMP_ERRORES.push({ fila: r + 1, faltan: faltan, f: f });
        else _IMP_FILAS.push(f);
      }
      // Resumen + vista previa
      var camposDetectados = [];
      mejorMapeo.forEach(function (m) { if (m && camposDetectados.indexOf(m) < 0) camposDetectados.push(m); });
      var res = '<div class="bs-alert ' + (_IMP_FILAS.length ? 'bs-alert-success' : 'bs-alert-danger') + '">' +
        '✅ <strong>' + _IMP_FILAS.length + '</strong> filas listas para cargar' +
        (_IMP_ERRORES.length ? ' · ⚠️ <strong>' + _IMP_ERRORES.length + '</strong> filas con datos faltantes (no se cargarán)' : '') +
        '<br><span class="bs-text-xs bs-text-muted">Columnas reconocidas: ' + esc(camposDetectados.join(', ')) + '</span></div>';
      if (_IMP_ERRORES.length) {
        res += '<div class="bs-text-xs bs-text-muted" style="margin-bottom:.5rem;">' +
          _IMP_ERRORES.slice(0, 5).map(function (e2) { return 'Fila ' + e2.fila + ': falta ' + e2.faltan.join(', '); }).join(' · ') +
          (_IMP_ERRORES.length > 5 ? ' · …' : '') + '</div>';
      }
      document.getElementById('importResumen').innerHTML = res;
      var prev = _IMP_FILAS.slice(0, 15);
      var cols = ['anio','mes','tipo','numero','apellido_paterno','apellido_materno','nombres','empresa','dias','inicio','termino','monto_total','estado_general'];
      var html = '<div class="bs-table-wrap"><table class="bs-table"><thead><tr>' +
        cols.map(function (c) { return '<th>' + c.replace(/_/g, ' ') + '</th>'; }).join('') + '</tr></thead><tbody>';
      prev.forEach(function (f) {
        html += '<tr>' + cols.map(function (c) { return '<td>' + esc(f[c] === undefined ? '' : f[c]) + '</td>'; }).join('') + '</tr>';
      });
      html += '</tbody></table></div>';
      if (_IMP_FILAS.length > 15) html += '<p class="bs-text-xs bs-text-muted">… y ' + (_IMP_FILAS.length - 15) + ' filas más.</p>';
      document.getElementById('importPreview').innerHTML = _IMP_FILAS.length ? html : '';
      document.getElementById('btnImport').disabled = _IMP_FILAS.length === 0;
    }

    async function subirImport() {
      if (!_IMP_FILAS.length) return;
      var btn = document.getElementById('btnImport');
      btn.disabled = true;
      var LOTE = 100, tot = { creados: 0, actualizados: 0, errores: [] };
      try {
        for (var i = 0; i < _IMP_FILAS.length; i += LOTE) {
          btn.textContent = 'Cargando ' + Math.min(i + LOTE, _IMP_FILAS.length) + ' / ' + _IMP_FILAS.length + '…';
          var res = await api('bs_importarSubsidios', { usuario: user.usuario, modo: 'upsert', filas: _IMP_FILAS.slice(i, i + LOTE) });
          if (!res.ok) throw new Error(res.message || 'Error en el servidor. ¿Está instalada la acción bs_importarSubsidios en el Apps Script?');
          tot.creados += res.creados || 0;
          tot.actualizados += res.actualizados || 0;
          if (res.errores && res.errores.length) tot.errores = tot.errores.concat(res.errores);
        }
        document.getElementById('importAlert').innerHTML = '<div class="bs-alert bs-alert-success">✅ Importación completa: <strong>' +
          tot.creados + '</strong> nuevos · <strong>' + tot.actualizados + '</strong> actualizados' +
          (tot.errores.length ? ' · ⚠️ ' + tot.errores.length + ' con error: ' + esc(tot.errores.slice(0, 3).join(' · ')) : '') + '</div>';
        cargarSubsidios();
      } catch (err) {
        document.getElementById('importAlert').innerHTML = '<div class="bs-alert bs-alert-danger">Error: ' + esc(err.message) + '</div>';
        btn.disabled = false;
      } finally {
        btn.textContent = 'Cargar a la base';
      }
    }

    // ===== INIT =====
    setupBusquedaDNI();
    setupCalculoSubsidio();
    setupAutoTab();
    cargarSubsidios();

    // ===== AUTO-ACTUALIZACIÓN (cada 60 s + al volver a la pestaña) =====
    (function(){
      var INTERVALO_MS = 60000;
      setInterval(function(){
        if (!document.hidden && !document.getElementById('formModal').classList.contains('bs-active')) cargarSubsidios();
      }, INTERVALO_MS);
      document.addEventListener('visibilitychange', function(){
        if (!document.hidden) cargarSubsidios();
      });
    })();
  