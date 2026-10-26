/* Bienestar Social · modulos/sugerencias.html · bloque 1 (antes en la linea 184) · extraido el 26-oct-2026 sin cambios (_BS_MODULAR_V1) */
    const BS_API_URL = 'https://script.google.com/macros/s/AKfycbyJIUtdpApEc35Jj4ZNP-3ONqGe64J1VhaRvkt87vVUNTgSagrOgOS0T99eIt0-w3Yi/exec';

    // ===== VALIDACION OBLIGATORIA =====
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
    document.getElementById('userName').textContent = user.nombre || user.usuario;
    const isAdmin = /admin/i.test(user.rol || '');

    // ===== API =====
    // api(): compartida en assets/js/bs-core.js

    // logout(): compartida en assets/js/bs-core.js

    // ===== Helpers =====
    // esc(): compartida en assets/js/bs-core.js
    function fechaCorta(iso) {
      return bsFechaDMY(iso);
    }
    function badgeEstado(e) {
      const map = {
        'Recibida':      '#0891b2',
        'En revisión':   '#d97706',
        'En desarrollo': '#7c3aed',
        'Finalizada':    '#16a34a',
        'Descartada':    '#64748b'
      };
      const col = map[e] || '#64748b';
      return '<span style="background:'+col+'20;color:'+col+';border:1px solid '+col+'55;padding:2px 10px;border-radius:999px;font-size:0.78rem;font-weight:600;white-space:nowrap;">'+esc(e||'-')+'</span>';
    }
    function badgePrioridad(p) {
      const map = { 'Alta':'#dc2626', 'Media':'#d97706', 'Baja':'#16a34a' };
      const col = map[p] || '#64748b';
      return '<span style="color:'+col+';font-weight:600;">'+esc(p||'-')+'</span>';
    }

    // ===== Carga / render =====
    let cache = [];
    async function cargar() {
      const cont = document.getElementById('tablaContainer');
      const filtros = {
        estado: document.getElementById('filterEstado').value,
        modulo: document.getElementById('filterModulo').value
      };
      if (!isAdmin) filtros.usuario = user.usuario; // usuario normal: solo las suyas
      // Caché local: pinta al instante la última vista con estos filtros
      const _fkey = JSON.stringify(filtros);
      let _pintado = false;
      try {
        const _c = JSON.parse(localStorage.getItem('bs_cache_sugerencias_v1') || 'null');
        if (_c && _c.fkey === _fkey && Array.isArray(_c.items)) { cache = _c.items; render(); _pintado = true; }
      } catch(e) {}
      if (!_pintado) cont.innerHTML = '<div class="bs-text-center" style="padding:2rem;"><div class="bs-spinner bs-spinner-dark" style="margin:0 auto;"></div></div>';
      try {
        const r = await api('bs_listarSugerencias', { filtros: filtros });
        if (!(r && r.ok)) { if (!_pintado) cont.innerHTML = '<div class="bs-alert bs-alert-danger">Error al cargar: ' + esc((r && r.message) || 'sin detalle') + '</div>'; return; }
        cache = r.items || [];
        try { localStorage.setItem('bs_cache_sugerencias_v1', JSON.stringify({ fkey: _fkey, items: cache, t: Date.now() })); } catch(e) {}
        render();
      } catch(e) {
        if (!_pintado) cont.innerHTML = '<div class="bs-alert bs-alert-danger">Error al cargar: ' + esc(e.message) + '</div>';
      }
    }

    function render() {
      const cont = document.getElementById('tablaContainer');
      if (!cache.length) {
        cont.innerHTML = '<div class="bs-card bs-text-center" style="padding:2.5rem;color:#64748b;">No hay sugerencias todavía. ¡Sé el primero en proponer una mejora! 💡</div>';
        return;
      }
      let filas = '';
      window.__BS_EXPORT_DATA__ = cache;
      cache.forEach(function(s) {
        const btnFin = (s.estado !== 'Finalizada')
          ? '<button class="bs-btn" title="Marcar como finalizada" style="padding:4px 10px;font-size:0.82rem;background:#16a34a;color:#fff;margin-right:4px;" onclick="finalizarRapido('+s.id+')">✓</button>'
          : '';
        const accion = isAdmin
          ? '<button class="bs-btn bs-btn-ghost" style="padding:4px 12px;font-size:0.82rem;margin-right:4px;" onclick="gestionar('+s.id+')">Gestionar</button>' +
            btnFin +
            '<button class="bs-btn" title="Eliminar" style="padding:4px 10px;font-size:0.82rem;background:#dc2626;color:#fff;" onclick="eliminar('+s.id+')">🗑</button>'
          : (s.respuesta_admin ? '<span class="bs-text-sm" style="color:#16a34a;">Con respuesta</span>' : '<span class="bs-text-sm" style="color:#94a3b8;">—</span>');
        filas +=
          '<tr>' +
            '<td style="font-weight:600;">#'+s.id+'</td>' +
            '<td>'+fechaCorta(s.fecha)+'</td>' +
            (isAdmin ? '<td>'+esc(s.nombre_usuario || s.usuario)+'</td>' : '') +
            '<td style="font-weight:500;">'+esc(s.titulo)+'</td>' +
            '<td>'+esc(s.modulo)+'</td>' +
            '<td>'+badgePrioridad(s.prioridad)+'</td>' +
            '<td>'+badgeEstado(s.estado)+'</td>' +
            '<td style="text-align:right;">'+accion+'</td>' +
          '</tr>';
      });
      const thUsuario = isAdmin ? '<th>Usuario</th>' : '';
      cont.innerHTML =
        '<div class="bs-card" style="padding:0;overflow-x:auto;">' +
        '<table class="bs-table" style="width:100%;">' +
        '<thead><tr>' +
          '<th>ID</th><th>Fecha</th>'+thUsuario+'<th>Título</th><th>Módulo</th><th>Prioridad</th><th>Estado</th><th style="text-align:right;">Acción</th>' +
        '</tr></thead><tbody>' + filas + '</tbody></table></div>';
    }

    // ===== Modal nueva sugerencia =====
    function openModal() {
      document.getElementById('titulo').value = '';
      document.getElementById('modulo').value = '';
      document.getElementById('prioridad').value = 'Media';
      document.getElementById('descripcion').value = '';
      document.getElementById('formAlert').innerHTML = '';
      document.getElementById('formModal').classList.add('bs-active');
    }
    function closeModal() {
      document.getElementById('formModal').classList.remove('bs-active');
    }

    async function submitForm() {
      const REQUIRED_FIELDS = ['titulo','modulo','descripcion'];
      const _req = bsValidarRequeridos(REQUIRED_FIELDS);
      if (!_req.ok) {
        document.getElementById('formAlert').innerHTML = '<div class="bs-alert bs-alert-danger">Falta completar: <strong>' + _req.label + '</strong></div>';
        const _e = document.getElementById(_req.id);
        if (_e && _e.offsetParent !== null) { try { _e.focus(); } catch(x){} }
        return;
      }
      const btn = document.getElementById('formModal').querySelector('#btnSubmit');
      btn.disabled = true; btn.textContent = 'Enviando...';
      try {
        const datos = {
          nombre_usuario: user.nombre || user.usuario,
          titulo: document.getElementById('titulo').value.trim(),
          modulo: document.getElementById('modulo').value,
          prioridad: document.getElementById('prioridad').value,
          descripcion: document.getElementById('descripcion').value.trim()
        };
        const r = await api('bs_crearSugerencia', { usuario: user.usuario, datos: datos });
        if (r && r.ok) {
          document.getElementById('titulo').value = '';
          document.getElementById('modulo').value = '';
          document.getElementById('prioridad').value = 'Media';
          document.getElementById('descripcion').value = '';
          document.getElementById('formAlert').innerHTML = '<div class="bs-alert" style="background:#dcfce7;border:1px solid #16a34a;color:#166534;border-radius:8px;padding:0.85rem 1rem;font-weight:500;">\u2705 ¡Hola! Gracias por tu sugerencia. En el transcurso del día el administrador dará solución a tu solicitud.</div>';
          setTimeout(function(){ closeModal(); cargar(); }, 3500);
        } else {
          document.getElementById('formAlert').innerHTML = '<div class="bs-alert bs-alert-danger">' + esc((r && r.message) || 'Error al enviar') + '</div>';
        }
      } catch(e) {
        document.getElementById('formAlert').innerHTML = '<div class="bs-alert bs-alert-danger">Error: ' + esc(e.message) + '</div>';
      } finally {
        btn.disabled = false; btn.textContent = 'Enviar sugerencia';
      }
    }

    // ===== Modal gestionar (admin) =====
    function gestionar(id) {
      const s = cache.find(function(x){ return parseInt(x.id) === parseInt(id); });
      if (!s) return;
      document.getElementById('g_id').value = s.id;
      document.getElementById('g_estado').value = s.estado || 'Recibida';
      document.getElementById('g_respuesta').value = s.respuesta_admin || '';
      document.getElementById('g_detalle').innerHTML =
        '<div style="font-weight:700;color:#0a2463;margin-bottom:0.3rem;">#'+s.id+' · '+esc(s.titulo)+'</div>' +
        '<div style="color:#64748b;margin-bottom:0.5rem;font-size:0.82rem;">'+esc(s.nombre_usuario || s.usuario)+' · '+esc(s.modulo)+' · '+fechaCorta(s.fecha)+' · Prioridad: '+esc(s.prioridad)+'</div>' +
        '<div style="white-space:pre-wrap;color:#0a1c4d;">'+esc(s.descripcion)+'</div>';
      document.getElementById('gestionAlert').innerHTML = '';
      document.getElementById('gestionModal').classList.add('bs-active');
    }
    function closeGestion() {
      document.getElementById('gestionModal').classList.remove('bs-active');
    }
    async function _guardarGestion(estadoForzado) {
      const id = document.getElementById('g_id').value;
      const datos = {
        estado: estadoForzado || document.getElementById('g_estado').value,
        respuesta_admin: document.getElementById('g_respuesta').value.trim()
      };
      const r = await api('bs_actualizarSugerencia', { usuario: user.usuario, id: id, datos: datos });
      if (r && r.ok) { closeGestion(); cargar(); }
      else { document.getElementById('gestionAlert').innerHTML = '<div class="bs-alert bs-alert-danger">' + esc((r && r.message) || 'Error') + '</div>'; }
    }
    async function submitGestion() {
      const btn = document.getElementById('gestionModal').querySelector('#btnSubmit');
      btn.disabled = true; const t = btn.textContent; btn.textContent = 'Guardando...';
      try { await _guardarGestion(null); }
      catch(e) { document.getElementById('gestionAlert').innerHTML = '<div class="bs-alert bs-alert-danger">Error: ' + esc(e.message) + '</div>'; }
      finally { btn.disabled = false; btn.textContent = t; }
    }
    async function finalizar() {
      if (!await appConfirm('¿Marcar esta sugerencia como FINALIZADA?')) return;
      const btn = document.getElementById('btnFinalizar');
      btn.disabled = true; const t = btn.textContent; btn.textContent = 'Finalizando...';
      try { document.getElementById('g_estado').value = 'Finalizada'; await _guardarGestion('Finalizada'); }
      catch(e) { document.getElementById('gestionAlert').innerHTML = '<div class="bs-alert bs-alert-danger">Error: ' + esc(e.message) + '</div>'; }
      finally { btn.disabled = false; btn.textContent = t; }
    }

    // ===== Acciones rapidas (admin) =====
    async function finalizarRapido(id) {
      if (!isAdmin) return;
      if (!await appConfirm('¿Marcar esta sugerencia como FINALIZADA?')) return;
      try {
        const r = await api('bs_actualizarSugerencia', { usuario: user.usuario, id: id, datos: { estado: 'Finalizada' } });
        if (r && r.ok) cargar(); else appAlert((r && r.message) || 'No se pudo actualizar');
      } catch(e) { appAlert('Error: ' + e.message); }
    }
    async function eliminar(id) {
      if (!isAdmin) return;
      if (!await appConfirm('¿Eliminar esta sugerencia? Esta acción no se puede deshacer.')) return;
      try {
        const r = await api('bs_eliminarSugerencia', { usuario: user.usuario, id: id });
        if (r && r.ok) cargar(); else appAlert((r && r.message) || 'No se pudo eliminar');
      } catch(e) { appAlert('Error: ' + e.message); }
    }

    // ===== INIT =====
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
  