/* Bienestar Social · modulos/hostigamiento.html · bloque 1 (antes en la linea 247) · extraido el 26-oct-2026 sin cambios (_BS_MODULAR_V1) */
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
    if (!user.permisos || !user.permisos.hostigamiento) {
      appAlert('No tienes permiso para acceder a este módulo');
      window.location.href = '../portal.html';
    }
    document.getElementById('userName').textContent = user.nombre || user.usuario;

    // ===== API HELPER =====
    // api(): compartida en assets/js/bs-core.js

    // ===== Helper: enmascarar =====
    function mask(txt, mode) {
      if (!txt) return '-';
      if (!mode) return txt;
      // Mostrar solo primeras 2 letras + asteriscos
      if (txt.length <= 3) return '***';
      return txt.substring(0, 2) + '***';
    }
    function maskDni(dni, mode) {
      if (!dni) return '-';
      if (!mode) return dni;
      return '****' + String(dni).slice(-2);
    }
    // esc(): compartida en assets/js/bs-core.js

    // ===== LISTAR =====
    let _CACHE_H = [];

    async function cargar() {
      const filtros = {
        sede: document.getElementById('filterSede').value,
        empresa: document.getElementById('filterEmpresa').value,
        status: document.getElementById('filterStatus').value,
        fundo: document.getElementById('filterFundo').value
      ,
        _verAnulados: !!(document.getElementById('verAnulados')||{}).checked
      };
      const privacyMode = document.getElementById('togglePrivacy').checked;
      const cont = document.getElementById('tablaContainer');
      // Caché local: pinta al instante la última vista con estos filtros
      const _fkey = JSON.stringify([filtros, privacyMode]);
      let _pintado = false;
      try {
        const _c = JSON.parse(sessionStorage.getItem('bs_cache_hostigamiento_v5') || 'null');
        if (_c && _c.fkey === _fkey && _c.html) {
          cont.innerHTML = _c.html;
          _CACHE_H = _c.items || [];
          _pintado = true;
        }
      } catch(e) {}
      if (!_pintado) cont.innerHTML = '<div class="bs-text-center" style="padding:2rem"><div class="bs-spinner bs-spinner-dark" style="margin:0 auto"></div></div>';

      try {
        const res = await api('bs_listarHostigamiento', { filtros: filtros });
        if (!res.ok) {
          if (!_pintado) cont.innerHTML = '<div class="bs-alert bs-alert-danger">Error: ' + res.message + '</div>';
          return;
        }
        var _cn = function(a){ return JSON.stringify((a||[]).map(function(x){ return JSON.stringify(x); }).sort()); };
        var _prevH = _CACHE_H;
        _CACHE_H = res.items || [];
        BSFiltroFecha.refrescar(_CACHE_H);
        res.items = (res.items || []).filter(BSFiltroFecha.pasa);
        if (!(document.getElementById('verAnulados')||{}).checked) res.items = res.items.filter(function(x){ return !x.anulado; });
        pintarKpisHost(res.items);
        _CACHE_H = res.items;
        var _sameH = _pintado && _cn(_CACHE_H) === _cn(_prevH);
        if (_sameH) return;
        if (res.items.length === 0) {
          cont.innerHTML = '<div class="bs-card bs-text-center"><p class="bs-text-muted">No hay denuncias registradas con esos filtros.</p></div>';
          return;
        }

        let html = '<div class="bs-table-wrap"><table class="bs-table">';
        html += '<thead><tr><th>Código</th><th>Sede</th><th>Fecha</th><th>Denunciante</th><th>Denunciado</th><th>Fundo</th><th>Empresa</th><th>Estado</th><th></th></tr></thead><tbody>';
        window.__BS_EXPORT_DATA__ = res.items || [];
        res.items.forEach(function(d, _i) {
          const fecha = bsFechaDMY(d.fecha_denuncia);
          const _sede = String(d.sede || 'PIURA').toUpperCase();
          const denunciante = mask(d.denunciante_nombre, privacyMode);
          const denunciado = mask(d.denunciado_nombre, privacyMode);
          const statusBadge = d.status === 'Resuelto' ? 'bs-badge-success'
            : d.status === 'Archivado' || d.status === 'Sin lugar' ? 'bs-badge-info'
            : d.status === 'Medidas dictadas' ? 'bs-badge-primary'
            : 'bs-badge-warning';
          html += '<tr' + (d.anulado ? ' style="opacity:.6;background:#fdf3f3;"' : '') + '>' +
            '<td><strong>' + esc(d.codigo || ('#' + d.id)) + '</strong></td>' +
            '<td><span class="bs-badge ' + (_sede === 'OLMOS' ? 'bs-badge-warning' : 'bs-badge-primary') + '">' + esc(_sede) + '</span></td>' +
            '<td>' + fecha + '</td>' +
            '<td>' + esc(denunciante) + '</td>' +
            '<td>' + esc(denunciado) + '</td>' +
            '<td>' + esc(d.fundo || '-') + '</td>' +
            '<td>' + esc(d.empresa || '-') + '</td>' +
            '<td><span class="bs-badge ' + statusBadge + '">' + esc(d.status || '-') + '</span></td>' +
            '<td style="white-space:nowrap;"><button class="bs-btn bs-btn-sm bs-btn-outline" onclick="editarIdx(' + _i + ')">Ver / Editar</button> ' +
            (d.anulado
              ? '<button class="bs-btn bs-btn-sm bs-btn-ghost" title="Restaurar registro" style="color:#15803d;font-weight:800;" onclick="bsRestaurar(' + d.id + ',\'' + _sede + '\')">↩</button>'
              : '<button class="bs-btn bs-btn-sm bs-btn-ghost" title="Anular registro" style="color:#991b1b;font-weight:800;" onclick="bsAnular(' + d.id + ',\'' + _sede + '\')">✖</button>') +
            '</td>' +
          '</tr>';
        });
        html += '</tbody></table></div>';
        if (privacyMode) {
          html += '<p class="bs-text-xs bs-text-muted bs-mt" style="text-align:right;">🔐 Modo discreto activo. Los nombres están parcialmente ocultos.</p>';
        }
        cont.innerHTML = html;
        try { sessionStorage.setItem('bs_cache_hostigamiento_v5', JSON.stringify({ fkey: _fkey, html: html, items: res.items, t: Date.now() })); } catch(e) {}
      } catch(err) {
        cont.innerHTML = '<div class="bs-alert bs-alert-danger">Error: ' + err.message + '</div>';
      }
    }

    // ===== MODAL =====

    async function bsRestaurar(id, sede) {
      if (!id) return;
      sede = String(sede || 'PIURA').toUpperCase();
      if (!(await appConfirm('¿Restaurar el registro #' + id + ' de ' + sede + '? Volverá a la vista normal.'))) return;
      try {
        const res = await api('bs_restaurarRegistro', { usuario: user.usuario, modulo: 'hostigamiento', sede: sede, id: parseInt(id) });
        if (res.ok) { appAlert('Registro #' + id + ' restaurado.'); cargar(); }
        else appAlert('Error: ' + (res.message || 'No se pudo restaurar.'));
      } catch (e) { appAlert('Error: ' + e.message); }
    }
    async function bsAnular(id, sede) {
      if (!id) return appAlert('Este registro no tiene ID; numéralo en la hoja para poder anularlo.');
      sede = String(sede || 'PIURA').toUpperCase();
      if (!(await appConfirm('¿Anular el registro #' + id + ' de ' + sede + '? No se elimina: queda marcado como ANULADO y sale de la vista.'))) return;
      var motivo = window.prompt('Motivo de la anulación (obligatorio):') || '';
      if (!motivo.trim()) return appAlert('Debes indicar un motivo para anular.');
      try {
        const res = await api('bs_anularRegistro', { usuario: user.usuario, modulo: 'hostigamiento', sede: sede, id: parseInt(id), motivo: motivo.trim() });
        if (res.ok) { appAlert('Registro #' + id + ' anulado.'); cargar(); }
        else appAlert('Error: ' + (res.message || 'No se pudo anular.'));
      } catch (e) { appAlert('Error: ' + e.message); }
    }

    function pintarKpisHost(items) {
      items = items || [];
      var inv = 0, med = 0, res_ = 0, arch = 0, otros = 0;
      items.forEach(function(d) {
        var e = String(d.status || '').toLowerCase();
        if (e.indexOf('investig') >= 0) inv++;
        else if (e.indexOf('medida') >= 0) med++;
        else if (e.indexOf('resuel') >= 0) res_++;
        else if (e.indexOf('archiv') >= 0 || e.indexOf('sin lugar') >= 0) arch++;
        else otros++;
      });
      var T = items.length;
      var nPiura = 0, nOlmos = 0;
      items.forEach(function(d) {
        if (String(d.sede || 'PIURA').toUpperCase() === 'OLMOS') nOlmos++; else nPiura++;
      });
      var pct = function(n){ return T ? Math.round(n*100/T) + '% del total' : ''; };
      bsKpisPro('kpiHostigamiento', {
        total: T,
        cards: [
          { ico:'🔒', val:T, lbl:'Denuncias (según filtros)', color:'var(--bs-mod-hostigamiento)', sub: inv + ' en investigación' },
          { ico:'🌴', val:nPiura, lbl:'Sede Piura', color:'#1e3a8a', sub: pct(nPiura) },
          { ico:'🌵', val:nOlmos, lbl:'Sede Olmos', color:'#d97706', sub: pct(nOlmos) },
          { ico:'✅', val:res_, lbl:'Resueltas', color:'#16a34a', sub: pct(res_) }
        ],
        dist: { label: 'Composición por estado de la denuncia', segs: [
          { lbl:'En investigación', v:inv, color:'#dc2626' },
          { lbl:'Medidas dictadas', v:med, color:'#f59e0b' },
          { lbl:'Resuelto', v:res_, color:'#16a34a' },
          { lbl:'Archivado / Sin lugar', v:arch, color:'#2563eb' },
          { lbl:'Otros', v:otros, color:'#64748b' }
        ]}
      });
    }
    const ALL_FIELDS = ['sede','fecha_denuncia','denunciante_dni','denunciante_nombre','denunciante_puesto','medida_proteccion','denunciado_dni','denunciado_nombre','denunciado_puesto','fundo','decision','status','observaciones','empresa'];
    window.__BS_EXPORT_ORDER = ['codigo','id'].concat(ALL_FIELDS).concat(['created_by','created_at','updated_at','anulado']);
    const DATE_FIELDS = ['fecha_denuncia'];

    // ===== NAVEGACION INTELIGENTE =====
    const FORM_ORDER = ['sede','fecha_denuncia','empresa','fundo','denunciante_dni','denunciante_nombre','denunciante_puesto','medida_proteccion','denunciado_dni','denunciado_nombre','denunciado_puesto','status','decision','observaciones'];

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
      // Selects: auto-avance al cambiar
      ['sede','empresa','status'].forEach(function(id){
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
      document.getElementById('formTitle').textContent = 'Nueva Denuncia';
      document.getElementById('denunciaId').value = '';
      ALL_FIELDS.forEach(function(f) {
        const el = document.getElementById(f);
        if (el) el.value = '';
      });
      const hoy = new Date().toISOString().split('T')[0];
      document.getElementById('fecha_denuncia').value = hoy;
      document.getElementById('status').value = 'En investigación';
      var _s = document.getElementById('sede');
      _s.disabled = false;
      _s.value = document.getElementById('filterSede').value || '';
      document.getElementById('sedeHelp').textContent = 'Define en qué expediente se registra. Cada sede lleva su propio correlativo y no se puede cambiar después.';
      document.getElementById('formAlert').innerHTML = '';
      document.getElementById('formModal').classList.add('bs-active');
      if (!_s.value) { try { _s.focus(); } catch(e) {} }
    }

    function closeModal() {
      document.getElementById('formModal').classList.remove('bs-active');
    }

    // Edita por POSICION en la tabla: los ids se repiten entre Piura y Olmos
    function editarIdx(i) {
      const d = _CACHE_H[i];
      if (!d) return appAlert('No encontrado');
      abrirEdicionHost(d);
    }
    async function editar(id, sede) {
      const S = String(sede || '').toUpperCase();
      let d = _CACHE_H.find(function(x) {
        return parseInt(x.id) === parseInt(id) && (!S || String(x.sede || 'PIURA').toUpperCase() === S);
      });
      if (!d) {
        const res = await api('bs_listarHostigamiento', {});
        if (!res.ok) return appAlert('Error: ' + res.message);
        d = (res.items || []).find(function(x) {
          return parseInt(x.id) === parseInt(id) && (!S || String(x.sede || 'PIURA').toUpperCase() === S);
        });
      }
      if (!d) return appAlert('No encontrado');
      abrirEdicionHost(d);
    }
    function abrirEdicionHost(d) {
      document.getElementById('formTitle').textContent = 'Denuncia ' + (d.codigo || ('#' + d.id));
      document.getElementById('denunciaId').value = d.id;
      ALL_FIELDS.forEach(function(f) {
        const el = document.getElementById(f);
        if (el) {
          let v = d[f];
          if (v === null || v === undefined) v = '';
          if (DATE_FIELDS.indexOf(f) >= 0 && v) {
            v = bsFechaYMD(v);
          }
          el.value = v;
        }
      });
      // La sede identifica la hoja donde vive el registro: no se puede mover
      const _s = document.getElementById('sede');
      _s.value = String(d.sede || 'PIURA').toUpperCase();
      _s.disabled = true;
      document.getElementById('sedeHelp').textContent = 'La sede no se puede cambiar: el expediente ya está numerado en ' + _s.value + '.';
      document.getElementById('formAlert').innerHTML = '';
      document.getElementById('formModal').classList.add('bs-active');
    }

    async function submitForm() {
      const datos = {};
      ALL_FIELDS.forEach(function(f) {
        datos[f] = document.getElementById(f).value;
      });
      // La sede identifica la hoja destino: siempre viaja, aunque el select esté bloqueado
      datos.sede = String(document.getElementById('sede').value || 'PIURA').toUpperCase();

      const REQUIRED_FIELDS = ['sede','fecha_denuncia','empresa','denunciante_nombre'];
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
        const id = document.getElementById('denunciaId').value;
        const action = id ? 'bs_actualizarHostigamiento' : 'bs_crearHostigamiento';
        const payload = id
          ? { usuario: user.usuario, id: parseInt(id), datos: datos }
          : { usuario: user.usuario, datos: datos };

        const res = await api(action, payload);
        if (res.ok) {
          closeModal();
          cargar();
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

    // ===== BÚSQUEDA DNI EN AZURE (denunciante y denunciado) =====
    function setupBusquedaDNI() {
      // Denunciante: autocompleta nombre, puesto y empresa
      const dEl = document.getElementById('denunciante_dni');
      if (dEl) {
        dEl.addEventListener('input', async function(e) {
          // DNI (8 digitos) o Carnet de Extranjeria (alfanumerico)
          e.target.value = e.target.value.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
          const v = e.target.value;
          if (/^[0-9]{8}$/.test(v)) {
            dEl.style.borderColor = '#7c3aed';
            const t = await bsBuscarTrabajador(v);
            if (t) {
              document.getElementById('denunciante_nombre').value = t.nombre_completo || '';
              if (t.oficio) document.getElementById('denunciante_puesto').value = t.oficio;
              if (t.empresa) document.getElementById('empresa').value = t.empresa;
              dEl.style.borderColor = '#10b981';
              focusNext('denunciante_dni');
            } else { dEl.style.borderColor = '#ef4444'; }
            setTimeout(function() { dEl.style.borderColor = ''; }, 2500);
          }
        });
      }
      // Denunciado: autocompleta nombre y puesto (no toca empresa)
      const aEl = document.getElementById('denunciado_dni');
      if (aEl) {
        aEl.addEventListener('input', async function(e) {
          // DNI (8 digitos) o Carnet de Extranjeria (alfanumerico)
          e.target.value = e.target.value.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
          const v = e.target.value;
          if (/^[0-9]{8}$/.test(v)) {
            aEl.style.borderColor = '#7c3aed';
            const t = await bsBuscarTrabajador(v);
            if (t) {
              document.getElementById('denunciado_nombre').value = t.nombre_completo || '';
              if (t.oficio) document.getElementById('denunciado_puesto').value = t.oficio;
              aEl.style.borderColor = '#10b981';
              focusNext('denunciado_dni');
            } else { aEl.style.borderColor = '#ef4444'; }
            setTimeout(function() { aEl.style.borderColor = ''; }, 2500);
          }
        });
      }
    }

    // ===== INIT =====
    BSFiltroFecha.init({ campoFecha: 'fecha_denuncia', color: 'var(--bs-mod-hostigamiento)', onChange: cargar });
    setupBusquedaDNI();
    setupAutoTab();
    cargar();

    // ===== AUTO-ACTUALIZACIÓN (cada 60 s + al volver a la pestaña) =====
    (function(){
      var INTERVALO_MS = 60000;
      setInterval(function(){
        if (!document.hidden && !document.getElementById('formModal').classList.contains('bs-active')) cargar();
      }, INTERVALO_MS);
      document.addEventListener('visibilitychange', function(){
        if (!document.hidden) cargar();
      });
    })();
  