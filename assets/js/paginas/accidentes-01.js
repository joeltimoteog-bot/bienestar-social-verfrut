/* Bienestar Social · modulos/accidentes.html · bloque 1 (antes en la linea 559) · extraido el 26-oct-2026 sin cambios (_BS_MODULAR_V1) */
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


    const session = localStorage.getItem('bienestarSocialAuth');
    if (!session) window.location.href = '../index.html';
    let user;
    try { user = JSON.parse(session); if (!user || !user.usuario) throw new Error(); } catch(e) { window.location.href = '../index.html'; }
    if (!user.permisos || !user.permisos.accidentes) { appAlert('No tienes permiso para acceder a este módulo'); window.location.href = '../portal.html'; }
    document.getElementById('userName').textContent = user.nombre || user.usuario;

    // api(): compartida en assets/js/bs-core.js

    // esc(): compartida en assets/js/bs-core.js

    // ===== AUTO-TAB =====
    const FORM_ORDER = ['dni','nombre','edad','telefono','sexo','empresa','fundo','fecha_ingreso','dia_accidente','dia_reportado','parte_cuerpo','tipo_lesion','tipo_accidente','seguro','diagnostico','detalle','accidente_hora_inicio','accidente_hora_fin','centro_atencion','tipo_derivacion','especialidades','staff_medico','estatus_accidente','fecha_reincorporo','fecha_fin_restriccion','dias_restriccion','detalle_restriccion','descanso_medico','descanso_medico_inicio','descanso_medico_fin','descanso_medico_dias','formulario_con_goce','goce_inicio','goce_fin','goce_dias','estado','situacion','responsable','responsable_autorizar','estado_caso'];

    // focusNext inteligente: salta al PROXIMO campo vacio + editable + visible + habilitado.
    // Omite: llenos, readonly, disabled, ocultos (display:none o ancestro oculto).
    // Si no queda ninguno, enfoca el boton Guardar.
    function focusNext(currentId) {
      const idx = FORM_ORDER.indexOf(currentId);
      if (idx < 0) return;
      for (let i = idx + 1; i < FORM_ORDER.length; i++) {
        const el = document.getElementById(FORM_ORDER[i]);
        if (!el) continue;                          // no existe en el DOM
        if (el.readOnly || el.disabled) continue;   // bloqueado/calculado
        if (el.offsetParent === null) continue;     // oculto (display:none propio o de un ancestro)
        const v = el.value;
        if (v !== undefined && v !== null && String(v).trim() !== '') continue; // ya tiene valor
        el.focus();
        if (typeof el.select === 'function' && el.tagName === 'INPUT') { try { el.select(); } catch(e){} }
        return;
      }
      // todos llenos: enfoca el boton Guardar si existe
      const btn = document.getElementById('btnSubmit');
      if (btn && !btn.disabled) btn.focus();
    }

    function setupAutoTab() {
      const dniEl = document.getElementById('dni');
      dniEl.addEventListener('input', async function(e) {
        // permite DNI (8 digitos) o Carnet de Extranjeria (alfanumerico)
        e.target.value = e.target.value.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
        if (/^[0-9]{8}$/.test(e.target.value)) {
          await autocompletarPorDNI(e.target.value);
          focusNext('dni');
        }
      });
      ['sexo','empresa','estatus_accidente','formulario_con_goce','estado','situacion','responsable','estado_caso'].forEach(function(id) {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', function() { if (el.value) focusNext(id); });
      });
      ['fundo','parte_cuerpo','tipo_accidente','seguro','centro_atencion','especialidades'].forEach(function(id) {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', function() { if (el.value) focusNext(id); });
      });

      // A4: auto-avance al escribir + Tab/Enter en inputs y textareas (selects ya usan 'change')
      FORM_ORDER.forEach(function(id){
        const el = document.getElementById(id);
        if (!el) return;
        const tag = el.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') return;
        el.addEventListener('keydown', function(ev){
          if (ev.key === 'Tab' && !ev.shiftKey) {
            ev.preventDefault();
            focusNext(id);
          } else if (ev.key === 'Enter' && tag !== 'TEXTAREA') {
            ev.preventDefault();
            focusNext(id);
          }
        });
      });
    }

    // ===== BÚSQUEDA DNI EN AZURE (autocompletar) =====
    async function autocompletarPorDNI(dni) {
      const dniEl = document.getElementById('dni');
      dniEl.style.borderColor = '#f59e0b'; // ámbar = buscando
      const t = await bsBuscarTrabajador(dni);
      if (t) {
        document.getElementById('nombre').value = t.nombre_completo || '';
        const edad = bsCalcularEdad(t.fecha_nacimiento);
        if (edad !== '') document.getElementById('edad').value = edad;
        if (t.sexo) document.getElementById('sexo').value = t.sexo;
        if (t.empresa) document.getElementById('empresa').value = t.empresa;
        if (t.fecha_inicio) document.getElementById('fecha_ingreso').value = bsFechaInput(t.fecha_inicio);
        dniEl.style.borderColor = '#10b981'; // verde = encontrado
      } else {
        dniEl.style.borderColor = '#ef4444'; // rojo = no encontrado
      }
      setTimeout(function() { dniEl.style.borderColor = ''; }, 2500);
    }

    // ===== CÁLCULO AUTOMÁTICO DE DÍAS DE RESTRICCIÓN =====
    function _diasIncl(ini, fin){
      if(!ini || !fin) return '';
      var a = new Date(ini), b = new Date(fin);
      if(isNaN(a.getTime()) || isNaN(b.getTime())) return '';
      var d = Math.round((b - a)/86400000) + 1;
      return d > 0 ? d : '';
    }
    function setupDiasRestriccion() {
      const calc = function() {
        const ini = document.getElementById('fecha_reincorporo').value;
        const fin = document.getElementById('fecha_fin_restriccion').value;
        document.getElementById('dias_restriccion').value = _diasIncl(ini, fin);
      };
      document.getElementById('fecha_reincorporo').addEventListener('change', calc);
      document.getElementById('fecha_fin_restriccion').addEventListener('change', calc);
    }

    let casosCache = [];
    function pintarKpisAcc(items) {
      items = items || [];
      var act = 0, trat = 0, restr = 0, reinc = 0, cerr = 0, otros = 0;
      items.forEach(function(c) {
        var e = String(c.estado_caso || '').toLowerCase();
        if (e.indexOf('restric') >= 0) restr++;
        else if (e.indexOf('reincorp') >= 0) reinc++;
        else if (e.indexOf('cerrad') >= 0) cerr++;
        else if (e.indexOf('tratamiento') >= 0) trat++;
        else if (e.indexOf('activo') >= 0) act++;
        else otros++;
      });
      var T = items.length;
      var pct = function(n){ return T ? Math.round(n*100/T) + '% del total' : ''; };
      bsKpisPro('kpiAccidentes', {
        total: T,
        cards: [
          { ico:'🩺', val:T, lbl:'Casos (según filtros)', color:'var(--bs-mod-accidentes)', sub: (act+trat) + ' en curso' },
          { ico:'🔴', val:act+trat, lbl:'Activos / En tratamiento', color:'#dc2626', sub: pct(act+trat) },
          { ico:'⚠️', val:restr, lbl:'Con restricción', color:'#f59e0b', sub: pct(restr) },
          { ico:'✅', val:reinc, lbl:'Reincorporados', color:'#16a34a', sub: pct(reinc) }
        ],
        dist: { label: 'Composición por estado del caso', segs: [
          { lbl:'Activo', v:act, color:'#dc2626' },
          { lbl:'En tratamiento', v:trat, color:'#f59e0b' },
          { lbl:'Con restricción', v:restr, color:'#d97706' },
          { lbl:'Reincorporado', v:reinc, color:'#16a34a' },
          { lbl:'Cerrado', v:cerr, color:'#2563eb' },
          { lbl:'Otros', v:otros, color:'#64748b' }
        ]}
      });
    }
    async function cargar() {
      const filtros = {
        empresa: document.getElementById('filterEmpresa').value,
        estado_caso: document.getElementById('filterEstado').value,
        fundo: document.getElementById('filterFundo').value,
        dni: document.getElementById('filterDni').value,
        _verAnulados: !!(document.getElementById('verAnulados')||{}).checked
      };
      const cont = document.getElementById('tablaContainer');
      // Caché local: pinta al instante la última vista con estos filtros
      const _fkey = JSON.stringify(filtros);
      let _pintado = false;
      try {
        const _c = JSON.parse(localStorage.getItem('bs_cache_accidentes_v4') || 'null');
        if (_c && _c.fkey === _fkey && _c.html) {
          cont.innerHTML = _c.html;
          casosCache = _c.items || [];
          window.__BS_EXPORT_DATA__ = _c.items || [];
          pintarKpisAcc(casosCache);
          _pintado = true;
        }
      } catch(e) {}
      if (!_pintado) cont.innerHTML = '<div class="bs-text-center" style="padding:2rem"><div class="bs-spinner bs-spinner-dark" style="margin:0 auto"></div></div>';
      try {
        const res = await api('bs_listarAccidentes', { filtros: filtros });
        if (!res.ok) { if (!_pintado) cont.innerHTML = '<div class="bs-alert bs-alert-danger">Error: ' + res.message + '</div>'; return; }
        var _cn = function(a){ return JSON.stringify((a||[]).map(function(x){ return JSON.stringify(x); }).sort()); };
        BSFiltroFecha.refrescar(res.items);
        res.items = res.items.filter(BSFiltroFecha.pasa);
        if (!(document.getElementById('verAnulados')||{}).checked) res.items = res.items.filter(function(x){ return !x.anulado; });
        var _sameA = _pintado && _cn(res.items) === _cn(casosCache);
        casosCache = res.items;
        pintarKpisAcc(casosCache);
        if (_sameA) return;
        if (res.items.length === 0) {
          cont.innerHTML = '<div class="bs-card bs-text-center"><p class="bs-text-muted">No hay casos registrados con esos filtros.</p></div>';
          return;
        }
        let html = '<div class="bs-table-wrap"><table class="bs-table">';
        html += '<thead><tr><th>ID</th><th>DNI</th><th>Trabajador</th><th>Sector</th><th>Empresa</th><th>Fecha accidente</th><th>Parte cuerpo</th><th>Tipo</th><th># Atenc.</th><th>Estado caso</th><th>Acciones</th></tr></thead><tbody>';
        window.__BS_EXPORT_DATA__ = res.items || [];
        res.items.forEach(function(c) {
          const fecha = bsFechaDMY(c.dia_accidente);
          const estadoBadge = c.estado_caso === 'Cerrado' || c.estado_caso === 'Reincorporado' ? 'bs-badge-success'
            : c.estado_caso === 'Con restricción' ? 'bs-badge-warning' : 'bs-badge-info';
          const tipoBadge = c.tipo_accidente === 'Grave' || c.tipo_accidente === 'Mortal' ? 'bs-badge-danger'
            : c.tipo_accidente === 'Incapacitante' ? 'bs-badge-warning' : 'bs-badge';
          html += '<tr' + (c.anulado ? ' style="opacity:.6;background:#fdf3f3;"' : '') + '>' +
            '<td><strong>#' + c.id + '</strong></td>' +
            '<td>' + esc(c.dni || '-') + '</td>' +
            '<td>' + esc(c.nombre || '-') + '</td>' +
            '<td>' + esc(c.fundo || '-') + '</td>' +
            '<td>' + esc(c.empresa || '-') + '</td>' +
            '<td>' + fecha + '</td>' +
            '<td>' + esc(c.parte_cuerpo || '-') + '</td>' +
            '<td><span class="bs-badge ' + tipoBadge + '">' + esc(c.tipo_accidente || '-') + '</span></td>' +
            '<td style="text-align:center;"><strong>' + (c.numero_atenciones || 0) + '</strong></td>' +
            '<td><span class="bs-badge ' + estadoBadge + '">' + esc(c.estado_caso || '-') + '</span></td>' +
            '<td style="white-space: nowrap;">' +
              '<button class="bs-btn bs-btn-sm bs-btn-outline" onclick="editarCaso(' + c.id + ')" style="margin-right: 4px;">Editar</button>' +
              '<button class="bs-btn bs-btn-sm" style="background: var(--bs-mod-accidentes); color: white;" onclick="verSeguimientos(' + c.id + ')">Seguim.</button>' +
              (c.anulado
              ? '<button class="bs-btn bs-btn-sm bs-btn-ghost" title="Restaurar registro" style="color:#15803d;font-weight:800;" onclick="bsRestaurar(' + c.id + ')">↩</button>'
              : '<button class="bs-btn bs-btn-sm bs-btn-ghost" title="Anular registro" style="color:#991b1b;font-weight:800;" onclick="bsAnular(' + c.id + ')">✖</button>') +
            '</td>' +
          '</tr>';
        });
        html += '</tbody></table></div>';
        cont.innerHTML = html;
        try { localStorage.setItem('bs_cache_accidentes_v4', JSON.stringify({ fkey: _fkey, html: html, items: res.items, t: Date.now() })); } catch(e) {}
      } catch(err) {
        cont.innerHTML = '<div class="bs-alert bs-alert-danger">Error: ' + err.message + '</div>';
      }
    }


    async function bsRestaurar(id) {
      if (!id) return;
      if (!(await appConfirm('¿Restaurar el registro #' + id + '? Volverá a la vista normal.'))) return;
      try {
        const res = await api('bs_restaurarRegistro', { usuario: user.usuario, modulo: 'accidentes', id: parseInt(id) });
        if (res.ok) { appAlert('Registro #' + id + ' restaurado.'); cargar(); }
        else appAlert('Error: ' + (res.message || 'No se pudo restaurar.'));
      } catch (e) { appAlert('Error: ' + e.message); }
    }
    async function bsAnular(id) {
      if (!id) return appAlert('Este registro no tiene ID; numéralo en la hoja para poder anularlo.');
      if (!(await appConfirm('¿Anular el registro #' + id + '? No se elimina: queda marcado como ANULADO y sale de la vista.'))) return;
      var motivo = window.prompt('Motivo de la anulación (obligatorio):') || '';
      if (!motivo.trim()) return appAlert('Debes indicar un motivo para anular.');
      try {
        const res = await api('bs_anularRegistro', { usuario: user.usuario, modulo: 'accidentes', id: parseInt(id), motivo: motivo.trim() });
        if (res.ok) { appAlert('Registro #' + id + ' anulado.'); cargar(); }
        else appAlert('Error: ' + (res.message || 'No se pudo anular.'));
      } catch (e) { appAlert('Error: ' + e.message); }
    }

    const ALL_FIELDS = ['dni','nombre','edad','telefono','fundo','sexo','fecha_ingreso','dia_accidente','dia_reportado','parte_cuerpo','tipo_lesion','diagnostico','tipo_accidente','seguro','detalle','estatus_accidente','centro_atencion','tipo_derivacion','especialidades','staff_medico','estado','situacion','fecha_reincorporo','fecha_fin_restriccion','dias_restriccion','detalle_restriccion','responsable','descanso_medico','formulario_con_goce','responsable_autorizar','numero_atenciones','estado_caso','empresa','descanso_medico_inicio','descanso_medico_fin','descanso_medico_dias','goce_inicio','goce_fin','goce_dias','accidente_hora_inicio','accidente_hora_fin'];
    window.__BS_EXPORT_ORDER = ['id'].concat(ALL_FIELDS).concat(['created_by','created_at','updated_at','anulado']);
    const DATE_FIELDS = ['fecha_ingreso','dia_accidente','dia_reportado','fecha_reincorporo','fecha_fin_restriccion','descanso_medico_inicio','descanso_medico_fin','goce_inicio','goce_fin'];

    function openModalCaso() {
      document.getElementById('formTitle').textContent = 'Nuevo Caso';
      document.getElementById('casoId').value = '';
      ALL_FIELDS.forEach(function(f) { const el = document.getElementById(f); if (el) el.value = ''; });
      const hoy = new Date().toISOString().split('T')[0];
      document.getElementById('fecha_ingreso').value = hoy;
      document.getElementById('dia_accidente').value = hoy;
      document.getElementById('dia_reportado').value = hoy;
      document.getElementById('estado_caso').value = 'Activo';
      document.getElementById('numero_atenciones').value = 0;
      toggleDescanso(); toggleGoce(); toggleHoras();
      document.getElementById('formAlert').innerHTML = '';
      document.getElementById('formModalCaso').classList.add('bs-active');
      setTimeout(function() { document.getElementById('dni').focus(); }, 100);
    }
    function closeModalCaso() { document.getElementById('formModalCaso').classList.remove('bs-active'); }

    async function editarCaso(id) {
      const c = casosCache.find(function(x) { return parseInt(x.id) === parseInt(id); });
      if (!c) return appAlert('Caso no encontrado');
      document.getElementById('formTitle').textContent = 'Caso #' + c.id + ' · ' + (c.nombre || '');
      document.getElementById('casoId').value = c.id;
      ALL_FIELDS.forEach(function(f) {
        const el = document.getElementById(f);
        if (el) {
          let v = c[f];
          if (v === null || v === undefined) v = '';
          if (DATE_FIELDS.indexOf(f) >= 0 && v) {
            v = bsFechaYMD(v);
          }
          el.value = v;
        }
      });
      toggleDescanso(); toggleGoce(); toggleHoras();
      document.getElementById('formAlert').innerHTML = '';
      document.getElementById('formModalCaso').classList.add('bs-active');
    }

    async function submitCaso() {
      const datos = {};
      ALL_FIELDS.forEach(function(f) { datos[f] = document.getElementById(f).value; });
      const REQUIRED_FIELDS = ['dni','nombre','empresa','dia_accidente'];
      const _req = bsValidarRequeridos(REQUIRED_FIELDS);
      if (!_req.ok) {
        document.getElementById('formAlert').innerHTML = '<div class="bs-alert bs-alert-danger">Falta completar: <strong>' + _req.label + '</strong></div>';
        const _e = document.getElementById(_req.id);
        if (_e && _e.offsetParent !== null) { try { _e.focus(); } catch(x){} }
        return;
      }
      const btn = document.getElementById('btnSubmit');
      btn.disabled = true; btn.textContent = 'Guardando...';
      try {
        const id = document.getElementById('casoId').value;
        const action = id ? 'bs_actualizarAccidente' : 'bs_crearAccidente';
        const payload = id ? { usuario: user.usuario, id: parseInt(id), datos: datos } : { usuario: user.usuario, datos: datos };
        const res = await api(action, payload);
        if (res.ok) { closeModalCaso(); cargar(); }
        else { document.getElementById('formAlert').innerHTML = '<div class="bs-alert bs-alert-danger">Error: ' + res.message + '</div>'; }
      } catch(err) {
        document.getElementById('formAlert').innerHTML = '<div class="bs-alert bs-alert-danger">Error: ' + err.message + '</div>';
      } finally { btn.disabled = false; btn.textContent = 'Guardar'; }
    }

    let casoActualId = null;
    async function verSeguimientos(id) {
      casoActualId = id;
      const c = casosCache.find(function(x) { return parseInt(x.id) === parseInt(id); });
      if (!c) return appAlert('Caso no encontrado');
      document.getElementById('segTitle').textContent = 'Seguimientos · Caso #' + c.id;
      document.getElementById('casoResumen').innerHTML =
        '<div class="bs-flex bs-justify-between bs-items-center" style="flex-wrap: wrap;">' +
          '<div><strong>' + (c.nombre || '-') + '</strong> · DNI: ' + (c.dni || '-') + '<br>' +
          '<small class="bs-text-muted">' + (c.empresa || '-') + ' · ' + (c.fundo || '-') + ' · ' + (c.parte_cuerpo || '-') + '</small></div>' +
          '<div><span class="bs-badge bs-badge-primary"># Atenciones: ' + (c.numero_atenciones || 0) + '</span></div>' +
        '</div>';
      const hoy = new Date().toISOString().split('T')[0];
      document.getElementById('seg_fecha').value = hoy;
      document.getElementById('seg_detalle').value = '';
      document.getElementById('segAlert').innerHTML = '';
      document.getElementById('seguimientosModal').classList.add('bs-active');
      await cargarSeguimientos(id);
    }
    function closeModalSeg() { document.getElementById('seguimientosModal').classList.remove('bs-active'); casoActualId = null; }

    async function cargarSeguimientos(id) {
      const cont = document.getElementById('listaSeguimientos');
      cont.innerHTML = '<div class="bs-text-center"><div class="bs-spinner bs-spinner-dark" style="margin:0 auto"></div></div>';
      try {
        const res = await api('bs_listarSeguimientos', { id_caso: id });
        if (!res.ok) { cont.innerHTML = '<div class="bs-alert bs-alert-danger">Error: ' + res.message + '</div>'; return; }
        if (res.items.length === 0) { cont.innerHTML = '<p class="bs-text-muted bs-text-sm">No hay seguimientos registrados aún. Agrega el primero abajo ⬇️</p>'; return; }
        let html = '';
        res.items.forEach(function(s) {
          const fecha = bsFechaDMY(s.fecha_seguimiento);
          html += '<div style="padding: 0.85rem; border-left: 3px solid var(--bs-mod-accidentes); background: var(--bs-surface-alt); margin-bottom: 0.5rem; border-radius: 0 var(--bs-radius-sm) var(--bs-radius-sm) 0;">' +
            '<div class="bs-flex bs-justify-between bs-items-center"><strong>Seguimiento #' + s.numero_seguimiento + '</strong>' +
            '<span class="bs-text-xs bs-text-muted">' + fecha + '</span></div>' +
            '<p class="bs-text-sm" style="margin: 0.4rem 0 0; white-space: pre-wrap;">' + esc(s.detalle || '-') + '</p>' +
            '<p class="bs-text-xs bs-text-subtle" style="margin: 0.3rem 0 0;">por ' + esc(s.created_by || '-') + '</p></div>';
        });
        cont.innerHTML = html;
      } catch(err) { cont.innerHTML = '<div class="bs-alert bs-alert-danger">Error: ' + err.message + '</div>'; }
    }

    async function submitSeguimiento() {
      if (!casoActualId) return;
      const datos = { fecha_seguimiento: document.getElementById('seg_fecha').value, detalle: document.getElementById('seg_detalle').value };
      if (!datos.fecha_seguimiento || !datos.detalle) { document.getElementById('segAlert').innerHTML = '<div class="bs-alert bs-alert-danger">Completa fecha y detalle</div>'; return; }
      const btn = document.getElementById('btnSeg');
      btn.disabled = true; btn.textContent = 'Agregando...';
      try {
        const res = await api('bs_crearSeguimiento', { usuario: user.usuario, id_caso: casoActualId, datos: datos });
        if (res.ok) {
          document.getElementById('seg_detalle').value = '';
          document.getElementById('segAlert').innerHTML = '<div class="bs-alert bs-alert-success">' + res.message + '</div>';
          await cargarSeguimientos(casoActualId);
          await cargar();
        } else {
          document.getElementById('segAlert').innerHTML = '<div class="bs-alert bs-alert-danger">Error: ' + res.message + '</div>';
        }
      } catch(err) {
        document.getElementById('segAlert').innerHTML = '<div class="bs-alert bs-alert-danger">Error: ' + err.message + '</div>';
      } finally { btn.disabled = false; btn.textContent = '+ Agregar Seguimiento'; }
    }

    // logout(): compartida en assets/js/bs-core.js

    // ===== A2: visibilidad y calculos de campos auto-revelados =====
    function toggleDescanso() {
      const t = (document.getElementById('descanso_medico').value || '').trim().length > 0;
      document.getElementById('descansoGroup').style.display = t ? '' : 'none';
      if (!t) { ['descanso_medico_inicio','descanso_medico_fin','descanso_medico_dias'].forEach(function(id){ const e=document.getElementById(id); if(e) e.value=''; }); }
    }
    function toggleGoce() {
      const t = document.getElementById('formulario_con_goce').value === 'Sí';
      document.getElementById('goceGroup').style.display = t ? '' : 'none';
      if (!t) { ['goce_inicio','goce_fin','goce_dias'].forEach(function(id){ const e=document.getElementById(id); if(e) e.value=''; }); }
    }
    function toggleHoras() {
      const t = (document.getElementById('detalle').value || '').trim().length > 0;
      document.getElementById('horasGroup').style.display = t ? '' : 'none';
      if (!t) { ['accidente_hora_inicio','accidente_hora_fin'].forEach(function(id){ const e=document.getElementById(id); if(e) e.value=''; }); }
    }
    function setupA2() {
      document.getElementById('descanso_medico').addEventListener('input', toggleDescanso);
      const calcD = function(){ document.getElementById('descanso_medico_dias').value = _diasIncl(document.getElementById('descanso_medico_inicio').value, document.getElementById('descanso_medico_fin').value); };
      document.getElementById('descanso_medico_inicio').addEventListener('change', calcD);
      document.getElementById('descanso_medico_fin').addEventListener('change', calcD);
      document.getElementById('formulario_con_goce').addEventListener('change', toggleGoce);
      const calcG = function(){ document.getElementById('goce_dias').value = _diasIncl(document.getElementById('goce_inicio').value, document.getElementById('goce_fin').value); };
      document.getElementById('goce_inicio').addEventListener('change', calcG);
      document.getElementById('goce_fin').addEventListener('change', calcG);
      document.getElementById('detalle').addEventListener('input', toggleHoras);
    }

    setupAutoTab();
    setupDiasRestriccion();
    setupA2();
    BSFiltroFecha.init({ campoFecha: 'dia_accidente', color: 'var(--bs-mod-accidentes)', onChange: cargar });
    cargar();


    // ===== IMPORTAR EXCEL (ACCIDENTES) =====
    var _IMPA_FILAS = [], _IMPA_ERRORES = [];
    var IMPA_SINONIMOS = {
      dni: ['dni','documento','nrodocumento','numerodni','nrodni','doc','dnice','ce'],
      nombre: ['nombre','nombres','trabajador','nombrecompleto','apellidosynombres','colaborador'],
      edad: ['edad'],
      telefono: ['telefono','celular','fono','movil'],
      fundo: ['fundo','sector','sectorarea','area','zona','sede'],
      sexo: ['sexo','genero'],
      fecha_ingreso: ['fechaingreso','fechadeingreso','ingreso','fechainiciodeperiodo'],
      dia_accidente: ['diaaccidente','diadelaccidente','fechaaccidente','fechadelaccidente','fechaaccid'],
      dia_reportado: ['diareportado','fechareportado','fechadereporte','diareporte','fechareporte'],
      parte_cuerpo: ['partecuerpo','partedelcuerpo','partecuerpoafectada','partedelcuerpoafectada'],
      tipo_lesion: ['tipolesion','tipodelesion','lesion'],
      diagnostico: ['diagnostico','dx'],
      tipo_accidente: ['tipoaccidente','tipodeaccidente'],
      seguro: ['seguro','tiposeguro'],
      detalle: ['detalle','descripcion','detalledelaccidente'],
      estatus_accidente: ['estatusaccidente','estatus','estatusdelaccidente'],
      centro_atencion: ['centroatencion','centrodeatencion','clinica','hospital','centromedico'],
      tipo_derivacion: ['tipoderivacion','derivacion'],
      especialidades: ['especialidades','especialidad'],
      staff_medico: ['staffmedico','medico','doctor'],
      estado: ['estado'],
      situacion: ['situacion'],
      fecha_reincorporo: ['fechareincorporo','reincorporo','fechadereincorporacion','fechareincorporacion'],
      fecha_fin_restriccion: ['fechafinrestriccion','finrestriccion','fechafinderestriccion'],
      dias_restriccion: ['diasrestriccion','diasderestriccion'],
      detalle_restriccion: ['detallerestriccion','detallederestriccion'],
      responsable: ['responsable'],
      descanso_medico: ['descansomedico','dm'],
      formulario_con_goce: ['formulariocongoce','congoce','formulariogoce'],
      responsable_autorizar: ['responsableautorizar','responsabledeautorizar'],
      numero_atenciones: ['numeroatenciones','atenciones','natenciones','natencion'],
      estado_caso: ['estadocaso','estadodelcaso'],
      empresa: ['empresa','razonsocial','compania'],
      descanso_medico_inicio: ['descansomedicoinicio','dminicio','iniciodescanso'],
      descanso_medico_fin: ['descansomedicofin','dmfin','findescanso'],
      descanso_medico_dias: ['descansomedicodias','dmdias','diasdescanso'],
      goce_inicio: ['goceinicio','iniciogoce'],
      goce_fin: ['gocefin','fingoce'],
      goce_dias: ['gocedias','diasgoce']
    };
    var IMPA_FECHAS = ['fecha_ingreso','dia_accidente','dia_reportado','fecha_reincorporo','fecha_fin_restriccion','descanso_medico_inicio','descanso_medico_fin','goce_inicio','goce_fin'];
    function _impaNorm(x){ return String(x==null?'':x).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ñ/g,'n').replace(/[^a-z0-9]/g,''); }
    function _impaCampo(h){ h=_impaNorm(h); if(!h) return null; for (var c in IMPA_SINONIMOS){ if (IMPA_SINONIMOS[c].indexOf(h)>=0) return c; } return null; }
    function _impaFecha(v){
      if (v===null||v===undefined||v==='') return '';
      if (typeof v==='number' && isFinite(v) && v>20000 && v<60000){
        var d=new Date(Date.UTC(1899,11,30)+Math.round(v)*86400000);
        return d.getUTCFullYear()+'-'+('0'+(d.getUTCMonth()+1)).slice(-2)+'-'+('0'+d.getUTCDate()).slice(-2);
      }
      return bsFechaYMD(v);
    }
    function _impaEmpresa(v){ var t=String(v||'').toUpperCase(); if(t.indexOf('RAPEL')>=0) return 'RAPEL'; if(t.indexOf('VERFRUT')>=0) return 'VERFRUT'; return String(v||'').trim(); }
    function openImportModalAcc(){
      _IMPA_FILAS=[]; _IMPA_ERRORES=[];
      document.getElementById('importFileAcc').value='';
      document.getElementById('importResumenAcc').innerHTML='';
      document.getElementById('importPreviewAcc').innerHTML='';
      document.getElementById('importAlertAcc').innerHTML='';
      document.getElementById('btnImportAcc').disabled=true;
      document.getElementById('importModalAcc').classList.add('bs-active');
    }
    function closeImportModalAcc(){ document.getElementById('importModalAcc').classList.remove('bs-active'); }
    function leerArchivoImportAcc(input){
      var file=input.files&&input.files[0]; if(!file) return;
      if (typeof XLSX==='undefined'){ document.getElementById('importAlertAcc').innerHTML='<div class="bs-alert bs-alert-danger">La librería de Excel aún se está cargando. Intenta de nuevo en unos segundos.</div>'; return; }
      var reader=new FileReader();
      reader.onload=function(e){
        try{
          var wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'});
          var aoa=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,raw:true,defval:''});
          procesarImportAcc(aoa);
        }catch(err){ document.getElementById('importAlertAcc').innerHTML='<div class="bs-alert bs-alert-danger">No se pudo leer el archivo: '+esc(err.message)+'</div>'; }
      };
      reader.readAsArrayBuffer(file);
    }
    function procesarImportAcc(aoa){
      _IMPA_FILAS=[]; _IMPA_ERRORES=[];
      document.getElementById('importAlertAcc').innerHTML='';
      if(!aoa||aoa.length<2){ document.getElementById('importAlertAcc').innerHTML='<div class="bs-alert bs-alert-danger">El archivo no tiene datos.</div>'; return; }
      var hIdx=0, mejor=null, mc=0;
      for (var i=0;i<Math.min(6,aoa.length);i++){ var mp=(aoa[i]||[]).map(_impaCampo); var c=mp.filter(Boolean).length; if(c>mc){mc=c;mejor=mp;hIdx=i;} }
      if(!mejor||mc<3){ document.getElementById('importAlertAcc').innerHTML='<div class="bs-alert bs-alert-danger">No se reconocieron los títulos. Revisa que existan encabezados como DNI, NOMBRE, EMPRESA, DÍA DEL ACCIDENTE…</div>'; return; }
      for (var r=hIdx+1;r<aoa.length;r++){
        var row=aoa[r]||[];
        if(row.every(function(x){return x===''||x===null||x===undefined;})) continue;
        var f={};
        for (var k=0;k<mejor.length;k++){
          var campo=mejor[k]; if(!campo) continue;
          var v=row[k]; if(v===null||v===undefined) v='';
          if (IMPA_FECHAS.indexOf(campo)>=0) v=_impaFecha(v);
          else if (campo==='empresa') v=_impaEmpresa(v);
          else if (typeof v==='string') v=v.trim();
          f[campo]=v;
        }
        var faltan=[];
        if(!f.dni) faltan.push('DNI');
        if(!f.nombre) faltan.push('nombre');
        if(!f.empresa) faltan.push('empresa');
        if(!f.dia_accidente) faltan.push('día del accidente');
        if(faltan.length) _IMPA_ERRORES.push({fila:r+1,faltan:faltan});
        else _IMPA_FILAS.push(f);
      }
      var detect=[]; mejor.forEach(function(m){ if(m&&detect.indexOf(m)<0) detect.push(m); });
      var res='<div class="bs-alert '+(_IMPA_FILAS.length?'bs-alert-success':'bs-alert-danger')+'">✅ <strong>'+_IMPA_FILAS.length+'</strong> filas listas'+(_IMPA_ERRORES.length?' · ⚠️ <strong>'+_IMPA_ERRORES.length+'</strong> con datos faltantes (no se cargarán)':'')+'<br><span class="bs-text-xs bs-text-muted">Columnas reconocidas: '+esc(detect.join(', '))+'</span></div>';
      if(_IMPA_ERRORES.length){ res+='<div class="bs-text-xs bs-text-muted" style="margin-bottom:.5rem;">'+_IMPA_ERRORES.slice(0,5).map(function(e2){return 'Fila '+e2.fila+': falta '+e2.faltan.join(', ');}).join(' · ')+(_IMPA_ERRORES.length>5?' · …':'')+'</div>'; }
      document.getElementById('importResumenAcc').innerHTML=res;
      var cols=['dni','nombre','fundo','empresa','dia_accidente','parte_cuerpo','tipo_lesion','tipo_accidente','estado_caso'];
      var html='<div class="bs-table-wrap"><table class="bs-table"><thead><tr>'+cols.map(function(c){return '<th>'+c.replace(/_/g,' ')+'</th>';}).join('')+'</tr></thead><tbody>';
      _IMPA_FILAS.slice(0,15).forEach(function(f){ html+='<tr>'+cols.map(function(c){return '<td>'+esc(f[c]===undefined?'':f[c])+'</td>';}).join('')+'</tr>'; });
      html+='</tbody></table></div>';
      if(_IMPA_FILAS.length>15) html+='<p class="bs-text-xs bs-text-muted">… y '+(_IMPA_FILAS.length-15)+' filas más.</p>';
      document.getElementById('importPreviewAcc').innerHTML=_IMPA_FILAS.length?html:'';
      document.getElementById('btnImportAcc').disabled=_IMPA_FILAS.length===0;
    }
    async function subirImportAcc(){
      if(!_IMPA_FILAS.length) return;
      var btn=document.getElementById('btnImportAcc'); btn.disabled=true;
      var LOTE=100, tot={creados:0,actualizados:0,errores:[]};
      try{
        for (var i=0;i<_IMPA_FILAS.length;i+=LOTE){
          btn.textContent='Cargando '+Math.min(i+LOTE,_IMPA_FILAS.length)+' / '+_IMPA_FILAS.length+'…';
          var res=await api('bs_importarAccidentes',{usuario:user.usuario,modo:'upsert',filas:_IMPA_FILAS.slice(i,i+LOTE)});
          if(!res.ok) throw new Error(res.message||'¿Está instalada la acción bs_importarAccidentes en el Apps Script?');
          tot.creados+=res.creados||0; tot.actualizados+=res.actualizados||0;
          if(res.errores&&res.errores.length) tot.errores=tot.errores.concat(res.errores);
        }
        document.getElementById('importAlertAcc').innerHTML='<div class="bs-alert bs-alert-success">✅ Importación completa: <strong>'+tot.creados+'</strong> nuevos · <strong>'+tot.actualizados+'</strong> actualizados'+(tot.errores.length?' · ⚠️ '+tot.errores.length+' con error: '+esc(tot.errores.slice(0,3).join(' · ')):'')+'</div>';
        cargar();
      }catch(err){
        document.getElementById('importAlertAcc').innerHTML='<div class="bs-alert bs-alert-danger">Error: '+esc(err.message)+'</div>';
        btn.disabled=false;
      }finally{ btn.textContent='Cargar a la base'; }
    }

    // ===== AUTO-ACTUALIZACIÓN (cada 60 s + al volver a la pestaña) =====
    (function(){
      var INTERVALO_MS = 60000;
      setInterval(function(){
        if (!document.hidden && !document.getElementById('formModalCaso').classList.contains('bs-active')) cargar();
      }, INTERVALO_MS);
      document.addEventListener('visibilitychange', function(){
        if (!document.hidden) cargar();
      });
    })();
  