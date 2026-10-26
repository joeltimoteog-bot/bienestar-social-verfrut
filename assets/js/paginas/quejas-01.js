/* Bienestar Social · modulos/quejas.html · bloque 1 (antes en la linea 407) · extraido el 26-oct-2026 sin cambios (_BS_MODULAR_V1) */
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
    let seguimientoQActualId = null;
    try {
      user = JSON.parse(session);
      if (!user || !user.usuario) throw new Error();
    } catch(e) {
      window.location.href = '../index.html';
    }
    if (!user.permisos || !user.permisos.quejas) {
      appAlert('No tienes permiso para acceder a este módulo');
      window.location.href = '../portal.html';
    }
    document.getElementById('userName').textContent = user.nombre || user.usuario;

    // ===== API HELPER =====
    // api(): compartida en assets/js/bs-core.js

    // esc(): compartida en assets/js/bs-core.js

    // ===== LISTAR =====
    // ===== ESTADO DE SEGUIMIENTO (calculado en cliente) =====
    function _segEstado(q) {
      if ((q.seguimiento || "") !== "Sí" || !q.seguimiento_fin) return { tipo:"none", label:"—", color:"#94a3b8", dias:null };
      if (q.resultado === "Cerrado") return { tipo:"cumplido", label:"✓ Cumplido", color:"#16a34a", dias:null };
      const hoy = new Date(); hoy.setHours(0,0,0,0);
      const fin = new Date(_fechaInput(q.seguimiento_fin) + "T00:00:00");
      if (isNaN(fin.getTime())) return { tipo:"none", label:"—", color:"#94a3b8", dias:null };
      const dias = Math.round((fin - hoy) / 86400000);
      const alerta = parseInt(q.seguimiento_alerta) || 1;
      if (dias < 0) return { tipo:"vencido", label:"⚠ Vencido ("+Math.abs(dias)+"d)", color:"#dc2626", dias:dias };
      if (dias === 0) return { tipo:"porvencer", label:"⏰ Vence hoy", color:"#d97706", dias:0 };
      if (dias <= alerta) return { tipo:"porvencer", label:"⏰ Vence en "+dias+"d", color:"#d97706", dias:dias };
      return { tipo:"encurso", label:"En curso ("+dias+"d)", color:"#0891b2", dias:dias };
    }
    // Chip de clasificación con color propio (solo visual)
    function _qxClasif(c) {
      var t = String(c || '').trim();
      if (!t) return '<span class="qx-clasif qx-cl-otro">—</span>';
      var low = t.toLowerCase(), cls = 'qx-cl-otro', ico = '📌';
      if (low.indexOf('queja') >= 0) { cls = 'qx-cl-queja'; ico = '😠'; }
      else if (low.indexOf('reclamo') >= 0) { cls = 'qx-cl-reclamo'; ico = '📮'; }
      else if (low.indexOf('sugerencia') >= 0) { cls = 'qx-cl-sugerencia'; ico = '💡'; }
      return '<span class="qx-clasif ' + cls + '">' + ico + ' ' + esc(t) + '</span>';
    }
    function _segBadge(q) {
      const e = _segEstado(q);
      return '<span style="background:'+e.color+'20;color:'+e.color+';border:1px solid '+e.color+'55;padding:2px 8px;border-radius:999px;font-size:.78rem;font-weight:600;white-space:nowrap;">'+e.label+'</span>';
    }
    function _renderSegBanner(items) {
      const cont = document.getElementById("seguimientoBanner");
      if (!cont) return;
      const urg = items.filter(function(q){ const e=_segEstado(q); return e.tipo==="vencido"||e.tipo==="porvencer"; });
      if (!urg.length) { cont.innerHTML = ""; return; }
      urg.sort(function(a,b){ return (_segEstado(a).dias) - (_segEstado(b).dias); });
      const li = urg.slice(0,8).map(function(q){
        const e=_segEstado(q);
        return '<li style="margin:.15rem 0;"><strong>#'+q.id+'</strong> · '+(q.sector||q.empresa||"")+' — <span style="color:'+e.color+';font-weight:600;">'+e.label+'</span></li>';
      }).join("");
      cont.innerHTML = '<div class="bs-card" style="border-left:4px solid #d97706;background:#fffbeb;margin-bottom:1rem;"><div style="font-weight:700;color:#92400e;margin-bottom:.3rem;">⏰ Seguimientos que requieren atención ('+urg.length+')</div><ul style="margin:0;padding-left:1.2rem;color:#78350f;font-size:.9rem;">'+li+'</ul></div>';
    }

    // ===== CACHÉ LOCAL (carga instantánea + refresco en segundo plano) =====
    let _CACHE_Q = [];
    const _CACHE_KEY_Q = 'bs_cache_quejas_v1';

    async function cargarQuejas() {
      const cont = document.getElementById('tablaContainer');
      // 1) Pinta AL INSTANTE desde caché (si existe)
      let pintado = false;
      try {
        const c = JSON.parse(localStorage.getItem(_CACHE_KEY_Q) || 'null');
        if (c && Array.isArray(c.items) && c.items.length) { _CACHE_Q = c.items; renderQuejas(); pintado = true; }
      } catch(e) {}
      if (!pintado) cont.innerHTML = '<div class="bs-text-center" style="padding:2rem"><div class="bs-spinner bs-spinner-dark" style="margin:0 auto"></div></div>';

      // 2) Refresca desde el servidor en segundo plano y re-pinta
      try {
        const res = await api('bs_listarQuejas', {});
        if (!res.ok) {
          if (!pintado) cont.innerHTML = '<div class="bs-alert bs-alert-danger">Error: ' + res.message + '</div>';
          return;
        }
        var _cn = function(a){ return JSON.stringify((a||[]).map(function(x){ return JSON.stringify(x); }).sort()); };
        var _nq = res.items || [];
        var _same = pintado && _cn(_nq) === _cn(_CACHE_Q);
        _CACHE_Q = _nq;
        try { localStorage.setItem(_CACHE_KEY_Q, JSON.stringify({ items: _CACHE_Q, t: Date.now() })); } catch(e) {}
        if (!_same) renderQuejas();
      } catch(err) {
        if (!pintado) cont.innerHTML = '<div class="bs-alert bs-alert-danger">Error de conexión: ' + err.message + '</div>';
      }
    }

    // Render con filtros EN CLIENTE (instantáneo, sin llamar al servidor)
    function renderQuejas() {
      const cont = document.getElementById('tablaContainer');
      const fEmp = document.getElementById('filterEmpresa').value;
      const fCla = document.getElementById('filterClasif').value;
      const fEst = document.getElementById('filterEstado').value;
      BSFiltroFecha.refrescar(_CACHE_Q);
      let items = (document.getElementById('verAnulados')||{}).checked ? _CACHE_Q.slice() : _CACHE_Q.slice().filter(function(x){ return !x.anulado; });
      if (fEmp) items = items.filter(function(q){ return q.empresa === fEmp; });
      if (fCla) items = items.filter(function(q){ return q.clasificacion === fCla; });
      if (fEst) items = items.filter(function(q){ return q.resultado === fEst; });
      items = items.filter(BSFiltroFecha.pasa);

      pintarKpisQuejas(items);
      if (items.length === 0) {
        cont.innerHTML = '<div class="qx-vacio"><span class="e">🗂️</span><b style="color:#334155;">Sin hallazgos en esta vista</b><br><span class="bs-text-muted" style="font-size:.85rem;">Ajusta los filtros o registra uno nuevo con el botón <b>+ Nuevo Hallazgo</b>.</span></div>';
        _renderSegBanner(items);
        return;
      }

      {
        const res = { items: items };
        // ── SEMÁFORO DE PLAZOS: resumen de la vista actual ──
        var _semC = { rojo: 0, ambar: 0, verde: 0 };
        res.items.forEach(function(q){ var s=_semaforoQueja(q); if(s.n) _semC[s.n]++; });
        var _semStrip = (_semC.rojo||_semC.ambar||_semC.verde) ?
          '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:0 0 10px;font-size:12.5px;font-weight:800">' +
          (_semC.rojo ? '<span style="background:#fee2e2;color:#b91c1c;padding:4px 12px;border-radius:999px">🔴 '+_semC.rojo+' atrasada(s) &gt;14 días</span>' : '') +
          (_semC.ambar ? '<span style="background:#fef3c7;color:#b45309;padding:4px 12px;border-radius:999px">🟡 '+_semC.ambar+' por vencer (8–14 días)</span>' : '') +
          (_semC.verde ? '<span style="background:#dcfce7;color:#15803d;padding:4px 12px;border-radius:999px">🟢 '+_semC.verde+' en plazo</span>' : '') +
          '</div>' : '';
        let html = _semStrip + '<div class="bs-table-wrap"><table class="bs-table">';
        html += '<thead><tr><th>ID</th><th>Fecha</th><th>Clasif.</th><th>Empresa</th><th>Sector</th><th>Detalle</th><th>Estado</th><th>Seguimiento</th><th></th></tr></thead><tbody>';
        window.__BS_EXPORT_DATA__ = res.items || [];
        res.items.forEach(function(q) {
          const _sem = _semaforoQueja(q);
          const fecha = bsFechaDMY(q.fecha_recepcion) + (_sem.chip || '');
          const detRaw = (q.detalle || '');
          const detalleCorto = esc(detRaw.substring(0, 80)) + (detRaw.length > 80 ? '...' : '');
          const estadoBadge = q.resultado === 'Resuelto' ? 'bs-badge-success' : q.resultado === 'Cerrado' ? 'bs-badge-info' : 'bs-badge-warning';
          const _semCol = _sem.n === 'rojo' ? '#dc2626' : _sem.n === 'ambar' ? '#f59e0b' : _sem.n === 'verde' ? '#16a34a' : 'transparent';
          html += '<tr style="--qxsem:' + _semCol + ';' + (q.anulado ? 'opacity:.6;background:#fdf3f3;' : '') + '">' +
            '<td><strong>#' + q.id + '</strong></td>' +
            '<td>' + fecha + '</td>' +
            '<td>' + _qxClasif(q.clasificacion) + '</td>' +
            '<td>' + esc(q.empresa || '-') + '</td>' +
            '<td>' + esc(q.sector || '-') + '</td>' +
            '<td style="max-width: 280px;">' + detalleCorto + '</td>' +
            '<td><span class="bs-badge ' + estadoBadge + '">' + esc(q.resultado || '-') + '</span></td>' +
            '<td>' + _segBadge(q) + '</td>' +
            '<td style="white-space:nowrap;"><div style="display:flex;gap:.35rem;align-items:center;">' +
              '<button class="bs-btn bs-btn-sm bs-btn-outline" style="min-width:74px;" onclick="editar(' + q.id + ')">✏️ Editar</button>' +
              (q.anulado
              ? '<button class="bs-btn bs-btn-sm bs-btn-ghost" title="Restaurar registro" style="color:#15803d;font-weight:800;" onclick="bsRestaurar(' + q.id + ')">↩</button>'
              : '<button class="bs-btn bs-btn-sm bs-btn-ghost" title="Anular registro" style="color:#991b1b;font-weight:800;" onclick="bsAnular(' + q.id + ')">✖</button>') +
              '<button class="bs-btn bs-btn-sm" style="min-width:74px;background: var(--bs-mod-quejas); color: white;" onclick="verSeguimientosQ(' + q.id + ')">📋 Seguim.</button>' +
            '</div></td>' +
          '</tr>';
        });
        html += '</tbody></table></div>';
        cont.innerHTML = html;
        _renderSegBanner(res.items);
      }
    }

    // ===== SEMÁFORO DE PLAZOS (quejas sin resolver, por días desde la recepción) =====
    function _semDiasDesde(ymd) {
      if (!ymd) return null;
      var h = new Date();
      var hs = h.getFullYear() + '-' + ('0'+(h.getMonth()+1)).slice(-2) + '-' + ('0'+h.getDate()).slice(-2);
      var d = Math.round((new Date(hs+'T12:00:00') - new Date(ymd+'T12:00:00')) / 86400000);
      return isNaN(d) ? null : d;
    }
    function _semChip(bg, col, txt) {
      return '<br><span style="display:inline-block;margin-top:3px;background:'+bg+';color:'+col+';font-size:10.5px;font-weight:800;padding:2px 8px;border-radius:999px;white-space:nowrap">'+txt+'</span>';
    }
    function _semaforoQueja(q) {
      var r = String(q.resultado || '').toLowerCase();
      if (q.anulado || r === 'resuelto' || r === 'cerrado') return {};
      var ymd = window.bsFechaYMD ? bsFechaYMD(q.fecha_recepcion) : '';
      var d = _semDiasDesde(ymd);
      if (d === null || d < 0) return {};
      if (d <= 7)  return { n:'verde', chip:_semChip('#dcfce7','#15803d','🟢 en plazo · '+d+' d') };
      if (d <= 14) return { n:'ambar', chip:_semChip('#fef3c7','#b45309','🟡 por vencer · '+d+' d') };
      return { n:'rojo', chip:_semChip('#fee2e2','#b91c1c','🔴 atrasada · '+d+' días') };
    }

    // ===== MODAL =====
    // ===== NAVEGACION INTELIGENTE =====
    const FORM_ORDER = ['fecha_recepcion','empresa','clasificacion','canal','categoria','tipo_lugar','sector','area_texto','detalle','accion_correctiva','accion_mejora','coordinacion','resultado','observaciones','seguimiento','seguimiento_inicio','seguimiento_frecuencia','seguimiento_alerta','seguimiento_fin','seguimiento_dias'];

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
      // Selects: auto-avance al elegir. Sector NO entra porque al elegirlo se abre el panel de buzones
      // y el usuario debe quedarse para capturar las cantidades.
      ['empresa','clasificacion','canal','categoria','resultado','tipo_lugar','seguimiento','seguimiento_frecuencia','seguimiento_alerta'].forEach(function(id){
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


    async function bsRestaurar(id) {
      if (!id) return;
      if (!(await appConfirm('¿Restaurar el registro #' + id + '? Volverá a la vista normal.'))) return;
      try {
        const res = await api('bs_restaurarRegistro', { usuario: user.usuario, modulo: 'quejas', id: parseInt(id) });
        if (res.ok) { appAlert('Registro #' + id + ' restaurado.'); renderQuejas(); }
        else appAlert('Error: ' + (res.message || 'No se pudo restaurar.'));
      } catch (e) { appAlert('Error: ' + e.message); }
    }
    async function bsAnular(id) {
      if (!id) return appAlert('Este registro no tiene ID; numéralo en la hoja para poder anularlo.');
      if (!(await appConfirm('¿Anular el registro #' + id + '? No se elimina: queda marcado como ANULADO y sale de la vista.'))) return;
      var motivo = window.prompt('Motivo de la anulación (obligatorio):') || '';
      if (!motivo.trim()) return appAlert('Debes indicar un motivo para anular.');
      try {
        const res = await api('bs_anularRegistro', { usuario: user.usuario, modulo: 'quejas', id: parseInt(id), motivo: motivo.trim() });
        if (res.ok) { appAlert('Registro #' + id + ' anulado.'); cargarQuejas(); }
        else appAlert('Error: ' + (res.message || 'No se pudo anular.'));
      } catch (e) { appAlert('Error: ' + e.message); }
    }

    window.__BS_EXPORT_ORDER = ['id','fecha_recepcion','clasificacion','canal','categoria','sector','detalle','accion_correctiva','accion_mejora','coordinacion','fecha_levantamiento_ac','frecuencia_seguimiento_ac','fecha_seguimiento_am','observaciones','resultado','documentos','empresa','created_by','created_at','updated_at','anulado'];

    function pintarKpisQuejas(items) {
      items = items || [];
      var proc = 0, res_ = 0, cerr = 0, otros = 0;
      items.forEach(function(q) {
        var e = String(q.resultado || '').toLowerCase();
        if (e.indexOf('resuel') >= 0) res_++;
        else if (e.indexOf('cerrad') >= 0) cerr++;
        else if (!e || e.indexOf('proceso') >= 0 || e.indexOf('monitoreo') >= 0 || e.indexOf('pendiente') >= 0) proc++;
        else otros++;
      });
      var T = items.length;
      var pct = function(n){ return T ? Math.round(n*100/T) + '% del total' : ''; };
      bsKpisPro('kpiQuejas', {
        total: T,
        cards: [
          { ico:'📋', val:T, lbl:'Hallazgos (según filtros)', color:'var(--bs-mod-quejas)', sub: proc + ' en proceso' },
          { ico:'⏳', val:proc, lbl:'En proceso / Monitoreo', color:'#f59e0b', sub: pct(proc) },
          { ico:'✅', val:res_, lbl:'Resueltos', color:'#16a34a', sub: pct(res_) },
          { ico:'📦', val:cerr, lbl:'Cerrados', color:'#2563eb', sub: pct(cerr) }
        ],
        dist: { label: 'Composición por resultado', segs: [
          { lbl:'En proceso / Monitoreo', v:proc, color:'#f59e0b' },
          { lbl:'Resuelto', v:res_, color:'#16a34a' },
          { lbl:'Cerrado', v:cerr, color:'#2563eb' },
          { lbl:'Otros', v:otros, color:'#64748b' }
        ]}
      });
    }

    // ===== SEGUIMIENTO =====
    function _fechaInput(v) {
      return bsFechaYMD(v);
    }
    function onSeguimientoChange() {
      const v = document.getElementById("seguimiento").value;
      document.getElementById("seguimientoGroup").style.display = (v === "Sí") ? "block" : "none";
      if (v !== "Sí") {
        document.getElementById("seguimiento_frecuencia").value = "";
        document.getElementById("seguimiento_inicio").value = "";
        document.getElementById("seguimiento_fin").value = "";
        document.getElementById("seguimiento_dias").value = "";
      }
    }
    function onFrecuenciaChange() {
      const frec = document.getElementById("seguimiento_frecuencia").value;
      let ini = document.getElementById("seguimiento_inicio").value;
      if (!ini) { ini = new Date().toISOString().split("T")[0]; document.getElementById("seguimiento_inicio").value = ini; }
      const dias = frec === "Semanal" ? 7 : frec === "Quincenal" ? 15 : frec === "Mensual" ? 30 : 0;
      if (dias > 0) {
        const d = new Date(ini + "T00:00:00");
        d.setDate(d.getDate() + dias);
        document.getElementById("seguimiento_fin").value = d.toISOString().split("T")[0];
      }
      recalcSeguimiento();
    }
    function recalcSeguimiento() {
      const ini = document.getElementById("seguimiento_inicio").value;
      const fin = document.getElementById("seguimiento_fin").value;
      if (ini && fin) {
        const d1 = new Date(ini + "T00:00:00"), d2 = new Date(fin + "T00:00:00");
        const dias = Math.round((d2 - d1) / 86400000);
        document.getElementById("seguimiento_dias").value = dias >= 0 ? dias : 0;
      } else {
        document.getElementById("seguimiento_dias").value = "";
      }
    }

    function openModal() {
      document.getElementById('formTitle').textContent = 'Nuevo Hallazgo';
      document.getElementById('quejaId').value = '';
      ['fecha_recepcion','clasificacion','canal','categoria','sector','detalle','accion_correctiva','accion_mejora','coordinacion','observaciones','empresa'].forEach(function(f) {
        const el = document.getElementById(f);
        if (el) el.value = '';
      });
      const hoy = new Date().toISOString().split('T')[0];
      document.getElementById('fecha_recepcion').value = hoy;
      document.getElementById('resultado').value = 'En proceso';
      document.getElementById("tipo_lugar").value = "";
      document.getElementById("area_texto").value = "";
      document.getElementById("sectorWrap").style.display = "none";
      document.getElementById("areaWrap").style.display = "none";
      document.getElementById("seguimiento").value = "No";
      document.getElementById("seguimiento_frecuencia").value = "";
      document.getElementById("seguimiento_inicio").value = "";
      document.getElementById("seguimiento_fin").value = "";
      document.getElementById("seguimiento_dias").value = "";
      document.getElementById("seguimiento_alerta").value = "1";
      document.getElementById("seguimientoGroup").style.display = "none";
      if (!_buzonesCargado) { cargarBuzones().then(poblarSectores); }
      poblarSectores();
      _resetBuzones();
      document.getElementById('formAlert').innerHTML = '';
      document.getElementById('formModal').classList.add('bs-active');
    }

    function closeModal() {
      document.getElementById('formModal').classList.remove('bs-active');
    }

    async function editar(id) {
      // Usa la caché (instantáneo); si no está, consulta al servidor
      let q = _CACHE_Q.find(function(x) { return parseInt(x.id) === parseInt(id); });
      if (!q) {
        const res = await api('bs_listarQuejas', {});
        if (!res.ok) return appAlert('Error: ' + res.message);
        q = (res.items || []).find(function(x) { return parseInt(x.id) === parseInt(id); });
      }
      if (!q) return appAlert('Hallazgo no encontrado');

      document.getElementById('formTitle').textContent = 'Editar Hallazgo #' + q.id;
      document.getElementById('quejaId').value = q.id;
      ['fecha_recepcion','clasificacion','canal','categoria','sector','detalle','accion_correctiva','accion_mejora','coordinacion','resultado','observaciones','empresa'].forEach(function(f) {
        const el = document.getElementById(f);
        if (el) {
          let v = q[f] || '';
          if (f.indexOf('fecha_') === 0 && v) {
            v = bsFechaYMD(v);
          }
          el.value = v;
        }
      });
      // Determinar tipo: si el sector guardado es un sector conocido -> Campo; si es texto libre -> Área
      const _sec = q.sector || '';
      const _conocido = _buzones.some(function(b){ return b.sector === _sec; });
      if (_sec && !_conocido) {
        document.getElementById("tipo_lugar").value = "Área";
        onTipoLugarChange();
        document.getElementById("area_texto").value = _sec;
      } else {
        document.getElementById("tipo_lugar").value = "Campo";
        onTipoLugarChange();
        if (!_buzonesCargado) { await cargarBuzones(); }
        poblarSectores();
        document.getElementById('sector').value = _sec;
        onSectorChange();
      }
      if (q.buzones_detalle) {
        try {
          const det = JSON.parse(q.buzones_detalle);
          const inputs = document.querySelectorAll('#buzonesLista input');
          det.forEach(function(d) {
            inputs.forEach(function(inp){
              if (inp.getAttribute('data-ubicacion') === d.ubicacion ||
                  (d.numero != null && parseInt(inp.getAttribute('data-numero')) === parseInt(d.numero))) {
                inp.value = d.cantidad;
              }
            });
          });
          recalcBuzones();
        } catch(e) {}
      }
      // Restaurar seguimiento
      document.getElementById("seguimiento").value = q.seguimiento || "No";
      onSeguimientoChange();
      if ((q.seguimiento || "") === "Sí") {
        document.getElementById("seguimiento_frecuencia").value = q.seguimiento_frecuencia || "";
        document.getElementById("seguimiento_inicio").value = _fechaInput(q.seguimiento_inicio);
        document.getElementById("seguimiento_fin").value = _fechaInput(q.seguimiento_fin);
        document.getElementById("seguimiento_alerta").value = String(q.seguimiento_alerta || 1);
        recalcSeguimiento();
      }
      document.getElementById('formAlert').innerHTML = '';
      document.getElementById('formModal').classList.add('bs-active');
    }

    async function submitForm() {
      const datos = {};
      ['fecha_recepcion','clasificacion','canal','categoria','sector','detalle','accion_correctiva','accion_mejora','coordinacion','resultado','observaciones','empresa'].forEach(function(f) {
        datos[f] = document.getElementById(f).value;
      });

      // Tipo de registro: Campo (sector+buzones) o Área (texto)
      const _tipoLugar = document.getElementById("tipo_lugar").value;
      datos.tipo_lugar = _tipoLugar;
      if (_tipoLugar === "Área") {
        datos.sector = document.getElementById("area_texto").value.trim();
      }

      // Seguimiento
      datos.seguimiento = document.getElementById("seguimiento").value;
      datos.seguimiento_frecuencia = document.getElementById("seguimiento_frecuencia").value;
      datos.seguimiento_inicio = document.getElementById("seguimiento_inicio").value;
      datos.seguimiento_fin = document.getElementById("seguimiento_fin").value;
      datos.seguimiento_dias = document.getElementById("seguimiento_dias").value;
      datos.seguimiento_alerta = document.getElementById("seguimiento_alerta").value;

      const REQUIRED_FIELDS = ['fecha_recepcion','clasificacion','empresa','detalle','tipo_lugar'];
      if (_tipoLugar === 'Área') REQUIRED_FIELDS.push('area_texto');
      const _req = bsValidarRequeridos(REQUIRED_FIELDS);
      if (!_req.ok) {
        document.getElementById('formAlert').innerHTML = '<div class="bs-alert bs-alert-danger">Falta completar: <strong>' + _req.label + '</strong></div>';
        const _e = document.getElementById(_req.id);
        if (_e && _e.offsetParent !== null) { try { _e.focus(); } catch(x){} }
        return;
      }

      // buzones (Q2): calcular cantidades + resumen al guardar
      const _panelBz = document.getElementById('buzonesPanel').style.display !== 'none';
      const _bz = _leerBuzones();
      datos.cantidad_buzones = _panelBz ? _bz.cantidadBuzones : 0;
      datos.cantidad_quejas  = _panelBz ? _bz.total : 0;
      datos.buzones_detalle  = _panelBz ? JSON.stringify(_bz.detalle) : '';
      if (_panelBz && _bz.total > 0) {
        let _res = 'Resumen por buzón — ' + document.getElementById('sector').value + ':\n';
        _bz.detalle.forEach(function(d){ _res += '  • ' + d.ubicacion + ': ' + d.cantidad + '\n'; });
        _res += '\nTotal de hallazgos: ' + _bz.total + '  (sobre ' + _bz.cantidadBuzones + ' buzones)\n\n¿Guardar?';
        if (!(await appConfirm(_res))) return;
      }

      const btn = document.getElementById('btnSubmit');
      btn.disabled = true;
      btn.textContent = 'Guardando...';

      try {
        const id = document.getElementById('quejaId').value;
        const action = id ? 'bs_actualizarQueja' : 'bs_crearQueja';
        const payload = id
          ? { usuario: user.usuario, id: parseInt(id), datos: datos }
          : { usuario: user.usuario, datos: datos };

        const res = await api(action, payload);
        if (res.ok) {
          closeModal();
          cargarQuejas();
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

    // ===== BUZONES (Q2) =====
    var _buzones = [];
    var _buzonesCargado = false;

    async function cargarBuzones() {
      try {
        const res = await api('bs_listarBuzones', {});
        if (res && res.ok && res.sectores) { _buzones = res.sectores; _buzonesCargado = true; }
      } catch (e) {}
    }

    function poblarSectores() {
      const emp = document.getElementById('empresa').value;
      const sel = document.getElementById('sector');
      const actual = sel.value;
      sel.innerHTML = '<option value="">Seleccionar...</option>';
      _buzones.forEach(function(b) {
        if (!emp || b.empresa === emp) {
          const o = document.createElement('option');
          o.value = b.sector; o.textContent = b.sector;
          sel.appendChild(o);
        }
      });
      sel.value = actual;
    }

    function _buscarSector(empresa, sector) {
      for (var i = 0; i < _buzones.length; i++) {
        if (_buzones[i].sector === sector && (!empresa || _buzones[i].empresa === empresa)) return _buzones[i];
      }
      return null;
    }

    function _resetBuzones() {
      document.getElementById('buzonesPanel').style.display = 'none';
      document.getElementById('buzonesLista').innerHTML = '';
      document.getElementById('buzonesMsg').textContent = '';
      document.getElementById('buzonesResumen').textContent = '';
    }

    function onTipoLugarChange() {
      const tipo = document.getElementById("tipo_lugar").value;
      const sw = document.getElementById("sectorWrap");
      const aw = document.getElementById("areaWrap");
      if (tipo === "Campo") {
        sw.style.display = "block"; aw.style.display = "none";
        document.getElementById("area_texto").value = "";
        poblarSectores();
      } else if (tipo === "Área") {
        sw.style.display = "none"; aw.style.display = "block";
        document.getElementById("sector").value = "";
        _resetBuzones();
      } else {
        sw.style.display = "none"; aw.style.display = "none";
        document.getElementById("sector").value = "";
        _resetBuzones();
      }
    }

    function onEmpresaChange() { poblarSectores(); _resetBuzones(); }

    function onSectorChange() {
      const emp = document.getElementById('empresa').value;
      const sec = document.getElementById('sector').value;
      const panel = document.getElementById('buzonesPanel');
      const lista = document.getElementById('buzonesLista');
      const msg = document.getElementById('buzonesMsg');
      if (!sec) { _resetBuzones(); return; }
      const b = _buscarSector(emp, sec);
      if (!b) { _resetBuzones(); return; }
      msg.textContent = 'Has seleccionado ' + b.sector + ', que cuenta con ' + b.cantidad + ' ' + (b.cantidad === 1 ? 'buzón' : 'buzones') + '. Ingresa la cantidad de hallazgos por cada buzón:';
      lista.innerHTML = '';
      b.ubicaciones.forEach(function(u) {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:.6rem;';
        const lab = document.createElement('span');
        lab.style.cssText = 'flex:1;font-size:.88rem;';
        lab.textContent = '#' + u.numero + ' · ' + u.ubicacion;
        const inp = document.createElement('input');
        inp.type = 'number'; inp.min = '0'; inp.value = '0';
        inp.className = 'bs-input';
        inp.style.cssText = 'width:90px;text-align:center;';
        inp.setAttribute('data-ubicacion', u.ubicacion);
        inp.setAttribute('data-numero', u.numero);
        inp.oninput = recalcBuzones;
        inp.addEventListener("keydown", function(ev){
          if ((ev.key === "Tab" && !ev.shiftKey) || ev.key === "Enter") {
            ev.preventDefault();
            const all = Array.prototype.slice.call(document.querySelectorAll("#buzonesLista input"));
            const idx = all.indexOf(inp);
            if (idx >= 0 && idx < all.length - 1) { all[idx+1].focus(); all[idx+1].select(); }
            else { focusNext("sector"); }
          }
        });
        row.appendChild(lab); row.appendChild(inp);
        lista.appendChild(row);
      });
      panel.style.display = 'block';
      recalcBuzones();
      const _first = document.querySelector("#buzonesLista input");
      if (_first) { _first.focus(); _first.select(); }
    }

    function _leerBuzones() {
      const inputs = document.querySelectorAll('#buzonesLista input');
      let total = 0; const detalle = [];
      inputs.forEach(function(inp) {
        const c = parseInt(inp.value) || 0;
        if (c > 0) detalle.push({ ubicacion: inp.getAttribute('data-ubicacion'), numero: parseInt(inp.getAttribute('data-numero')) || 0, cantidad: c });
        total += c;
      });
      return { total: total, detalle: detalle, cantidadBuzones: inputs.length };
    }

    function recalcBuzones() {
      const r = _leerBuzones();
      document.getElementById('buzonesResumen').textContent = 'Total de hallazgos: ' + r.total + '  ·  Buzones: ' + r.cantidadBuzones;
    }

    async function verSeguimientosQ(id) {
      seguimientoQActualId = id;
      const lista = window.__BS_EXPORT_DATA__ || [];
      const q = lista.find(function(x) { return parseInt(x.id) === parseInt(id); });
      document.getElementById('segTitleQ').textContent = 'Seguimientos \u00b7 Hallazgo #' + id;
      document.getElementById('quejaResumen').innerHTML = q
        ? '<div><strong>' + esc(q.clasificacion || 'Hallazgo') + '</strong> \u00b7 ' + esc(q.empresa || '-') + ' \u00b7 ' + esc(q.sector || q.area_texto || '-') + '<br>' +
          '<small class="bs-text-muted">' + esc(String(q.detalle || '-').slice(0,160)) + '</small></div>'
        : '<small class="bs-text-muted">Hallazgo #' + id + '</small>';
      document.getElementById('segq_fecha').value = new Date().toISOString().split('T')[0];
      document.getElementById('segq_detalle').value = '';
      document.getElementById('segqAlert').innerHTML = '';
      document.getElementById('seguimientosModalQ').classList.add('bs-active');
      await cargarSeguimientosQ(id);
    }
    function closeModalSegQ() { document.getElementById('seguimientosModalQ').classList.remove('bs-active'); seguimientoQActualId = null; }

    async function cargarSeguimientosQ(id) {
      const cont = document.getElementById('listaSeguimientosQ');
      cont.innerHTML = '<div class="bs-text-center"><div class="bs-spinner bs-spinner-dark" style="margin:0 auto"></div></div>';
      try {
        const res = await api('bs_listarSeguimientosQueja', { id_queja: id });
        if (!res.ok) { cont.innerHTML = '<div class="bs-alert bs-alert-danger">Error: ' + res.message + '</div>'; return; }
        if (!res.items || res.items.length === 0) { cont.innerHTML = '<p class="bs-text-muted bs-text-sm">No hay seguimientos registrados a\u00fan. Agrega el primero abajo \u2b07\ufe0f</p>'; return; }
        let html = '';
        res.items.forEach(function(sg) {
          const fecha = bsFechaDMY(sg.fecha_seguimiento);
          html += '<div style="padding: 0.85rem; border-left: 3px solid var(--bs-mod-quejas); background: var(--bs-surface-alt); margin-bottom: 0.5rem; border-radius: 0 var(--bs-radius-sm) var(--bs-radius-sm) 0;">' +
            '<div class="bs-flex bs-justify-between bs-items-center"><strong>Seguimiento #' + sg.numero_seguimiento + '</strong>' +
            '<span class="bs-text-xs bs-text-muted">' + fecha + '</span></div>' +
            '<p class="bs-text-sm" style="margin: 0.4rem 0 0; white-space: pre-wrap;">' + esc(sg.detalle || '-') + '</p>' +
            '<p class="bs-text-xs bs-text-subtle" style="margin: 0.3rem 0 0;">por ' + esc(sg.created_by || '-') + '</p></div>';
        });
        cont.innerHTML = html;
      } catch(err) { cont.innerHTML = '<div class="bs-alert bs-alert-danger">Error: ' + err.message + '</div>'; }
    }

    async function submitSeguimientoQ() {
      if (!seguimientoQActualId) return;
      const datos = { fecha_seguimiento: document.getElementById('segq_fecha').value, detalle: document.getElementById('segq_detalle').value };
      if (!datos.fecha_seguimiento || !datos.detalle) { document.getElementById('segqAlert').innerHTML = '<div class="bs-alert bs-alert-danger">Completa fecha y detalle</div>'; return; }
      const btn = document.getElementById('btnSegQ');
      btn.disabled = true; btn.textContent = 'Agregando...';
      try {
        const res = await api('bs_crearSeguimientoQueja', { usuario: user.usuario, id_queja: seguimientoQActualId, datos: datos });
        if (res.ok) {
          document.getElementById('segq_detalle').value = '';
          document.getElementById('segqAlert').innerHTML = '<div class="bs-alert bs-alert-success">' + (res.message || 'Seguimiento agregado') + '</div>';
          await cargarSeguimientosQ(seguimientoQActualId);
          await cargarQuejas();
        } else {
          document.getElementById('segqAlert').innerHTML = '<div class="bs-alert bs-alert-danger">Error: ' + res.message + '</div>';
        }
      } catch(err) {
        document.getElementById('segqAlert').innerHTML = '<div class="bs-alert bs-alert-danger">Error: ' + err.message + '</div>';
      } finally { btn.disabled = false; btn.textContent = '+ Agregar Seguimiento'; }
    }

    // ===== LOGOUT =====
    // logout(): compartida en assets/js/bs-core.js

    // ===== INIT =====
    BSFiltroFecha.init({ campoFecha: 'fecha_recepcion', color: 'var(--bs-mod-quejas)', onChange: renderQuejas });
    cargarBuzones();
    setupAutoTab();
    cargarQuejas();

    // ===== AUTO-ACTUALIZACIÓN (cada 60 s + al volver a la pestaña) =====
    (function(){
      var INTERVALO_MS = 60000;
      setInterval(function(){
        if (!document.hidden && !document.getElementById('formModal').classList.contains('bs-active')) cargarQuejas();
      }, INTERVALO_MS);
      document.addEventListener('visibilitychange', function(){
        if (!document.hidden) cargarQuejas();
      });
    })();
  