/* Bienestar Social · modulos/auditoria.html · bloque 1 (antes en la linea 112) · extraido el 26-oct-2026 sin cambios (_BS_MODULAR_V1) */
    const BS_API_URL = 'https://script.google.com/macros/s/AKfycbyJIUtdpApEc35Jj4ZNP-3ONqGe64J1VhaRvkt87vVUNTgSagrOgOS0T99eIt0-w3Yi/exec';

    // ===== AUTH (solo administradores) =====
    const session = localStorage.getItem('bienestarSocialAuth');
    if (!session) window.location.href = '../index.html';
    let user;
    try {
      user = JSON.parse(session);
      if (!user || !user.usuario) throw new Error();
    } catch(e) { window.location.href = '../index.html'; }
    const ADMINS = ['jtimoteo','ovilela'];
    const esAdmin = ADMINS.indexOf((user.usuario || '').toLowerCase()) >= 0 || /admin|geren/i.test(user.rol || '');
    if (!esAdmin) {
      appAlert('Solo administradores pueden ver la auditoría.');
      window.location.href = '../portal.html';
    }
    document.getElementById('userName').textContent = user.nombre || user.usuario;

    // api(): compartida en assets/js/bs-core.js

    // esc(): compartida en assets/js/bs-core.js

    let _AUD = [];
    let _ordCol = 'fecha', _ordAsc = false;   // orden por defecto: fecha descendente

    // 'dd/MM/yyyy HH:mm' -> Date (para ordenar y filtrar por rango)
    function fechaDe(x) {
      var m = String(x.fecha || '').match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
      if (!m) return null;
      return new Date(+m[3], +m[2]-1, +m[1], +m[4], +m[5]);
    }

    async function cargarAuditoria() {
      const cont = document.getElementById('tablaContainer');
      cont.innerHTML = '<div class="bs-text-center" style="padding:2rem"><div class="bs-spinner bs-spinner-dark" style="margin:0 auto"></div></div>';
      try {
        const res = await api('bs_listarAuditoria', {});
        if (!res.ok) {
          // Diagnóstico: distinguir "acción no instalada" de otros errores
          cont.innerHTML =
            '<div class="bs-alert bs-alert-danger"><strong>El servidor respondió con error:</strong> ' + esc(res.message || 'desconocido') + '</div>' +
            '<div class="bs-card bs-text-sm"><strong>🔧 Posible causa:</strong> la acción <code>bs_listarAuditoria</code> no está instalada en el Apps Script.<br>' +
            'En el editor de Apps Script, dentro del <code>switch</code> de <code>doPost</code>, agrega:<br>' +
            '<code>case \'bs_listarAuditoria\': result = bs_listarAuditoria(params); break;</code><br>' +
            'y luego <b>Implementar → Administrar implementaciones → Nueva versión</b>.</div>';
          return;
        }
        _AUD = res.items || [];
        renderKpis();
        renderAuditoria();
        var lbl = document.getElementById('audActualizado');
        if (lbl) lbl.textContent = 'Actualizado: ' + new Date().toLocaleTimeString('es-PE');
      } catch(err) {
        cont.innerHTML = '<div class="bs-alert bs-alert-danger">Error: ' + esc(err.message) + '</div>';
      }
    }

    function renderKpis() {
      var box = document.getElementById('audKpis');
      if (!box) return;
      if (!_AUD.length) { box.style.display = 'none'; return; }
      var hoy = new Date(); hoy.setHours(0,0,0,0);
      var hace7 = new Date(hoy.getTime() - 6*86400000);
      var nHoy = 0, n7 = 0, porUsr = {};
      _AUD.forEach(function(x){
        var d = fechaDe(x);
        if (d) {
          if (d >= hoy) nHoy++;
          if (d >= hace7) n7++;
        }
        var u = String(x.usuario || '—');
        porUsr[u] = (porUsr[u] || 0) + 1;
      });
      var top = Object.keys(porUsr).sort(function(a,b){ return porUsr[b]-porUsr[a]; })[0] || '—';
      function kpi(icono, val, lbl) {
        return '<div class="bs-card bs-text-center" style="padding:.9rem .6rem;">' +
          '<div style="font-size:1.15rem;">' + icono + '</div>' +
          '<div style="font-size:1.35rem;font-weight:700;">' + esc(val) + '</div>' +
          '<div class="bs-text-xs bs-text-muted">' + esc(lbl) + '</div></div>';
      }
      box.innerHTML =
        kpi('📅', nHoy, 'Movimientos hoy') +
        kpi('🗓️', n7, 'Últimos 7 días') +
        kpi('📚', _AUD.length, 'Total cargado (máx. 500)') +
        kpi('👤', top, 'Usuario más activo');
      box.style.display = '';
    }

    function badgeAccion(a) {
      const m = { CREAR:'bs-badge-success', ACTUALIZAR:'bs-badge-info', IMPORTAR:'bs-badge-primary', ANULAR:'bs-badge-danger', RESTAURAR:'bs-badge-warning', ELIMINAR:'bs-badge-danger' };
      return m[a] || 'bs-badge';
    }

    function ordenarPor(col) {
      if (_ordCol === col) _ordAsc = !_ordAsc;
      else { _ordCol = col; _ordAsc = (col !== 'fecha'); }
      renderAuditoria();
    }

    function renderAuditoria() {
      const cont = document.getElementById('tablaContainer');
      const fm = document.getElementById('fModulo').value.toLowerCase();
      const fa = document.getElementById('fAccion').value;
      const fu = document.getElementById('fUsuario').value.toLowerCase().trim();
      const ft = document.getElementById('fTexto').value.toLowerCase().trim();
      const fd = document.getElementById('fDesde').value;
      const fh = document.getElementById('fHasta').value;
      let items = _AUD.slice();
      if (fm) items = items.filter(function(x){ return String(x.modulo||'').toLowerCase().indexOf(fm) >= 0; });
      if (fa) items = items.filter(function(x){ return String(x.accion||'').toUpperCase() === fa; });
      if (fu) items = items.filter(function(x){ return String(x.usuario||'').toLowerCase().indexOf(fu) >= 0; });
      if (ft) items = items.filter(function(x){ return (String(x.registro_id||'') + ' ' + String(x.detalle||'')).toLowerCase().indexOf(ft) >= 0; });
      if (fd) { var dD = new Date(fd + 'T00:00:00'); items = items.filter(function(x){ var d = fechaDe(x); return d && d >= dD; }); }
      if (fh) { var dH = new Date(fh + 'T23:59:59'); items = items.filter(function(x){ var d = fechaDe(x); return d && d <= dH; }); }

      // Orden
      items.sort(function(a, b){
        var va, vb;
        if (_ordCol === 'fecha') { va = fechaDe(a) || 0; vb = fechaDe(b) || 0; }
        else { va = String(a[_ordCol] || '').toLowerCase(); vb = String(b[_ordCol] || '').toLowerCase(); }
        if (va < vb) return _ordAsc ? -1 : 1;
        if (va > vb) return _ordAsc ? 1 : -1;
        return 0;
      });

      if (!_AUD.length) {
        cont.innerHTML =
          '<div class="bs-card bs-text-center"><p style="font-size:2rem;margin:.2rem 0;">🗒️</p>' +
          '<p class="bs-text-muted"><strong>La hoja BS_Auditoria está vacía todavía.</strong></p>' +
          '<p class="bs-text-sm bs-text-muted" style="max-width:520px;margin:0 auto;">Los movimientos se registran automáticamente cuando alguien crea, actualiza, importa o anula registros. ' +
          'Si ya hubo movimientos y aquí no aparece nada, falta el <b>gancho de auditoría</b> en el Apps Script: después del <code>switch</code> de <code>doPost</code> agrega ' +
          '<code>try { if (result &amp;&amp; result.ok) bs_auditoriaAuto(params, result); } catch(eAud) {}</code> y publica una <b>nueva versión</b>. ' +
          'Sin ese gancho solo se registran anulaciones y restauraciones.</p></div>';
        return;
      }
      if (!items.length) { cont.innerHTML = '<div class="bs-card bs-text-center"><p class="bs-text-muted">No hay movimientos con esos filtros.</p></div>'; return; }

      window.__BS_EXPORT_DATA__ = items;
      var flecha = function(c){ return _ordCol === c ? (_ordAsc ? ' ▲' : ' ▼') : ''; };
      var th = function(c, t){ return '<th style="cursor:pointer;user-select:none;" onclick="ordenarPor(\'' + c + '\')" title="Ordenar">' + t + flecha(c) + '</th>'; };
      let html = '<div class="bs-table-wrap"><table class="bs-table">';
      html += '<thead><tr>' + th('fecha','Fecha') + th('usuario','Usuario') + th('accion','Acción') + th('modulo','Módulo') + '<th>Registro</th><th>Detalle</th></tr></thead><tbody>';
      items.forEach(function(x) {
        html += '<tr>' +
          '<td style="white-space:nowrap;">' + esc(x.fecha || '-') + '</td>' +
          '<td><strong>' + esc(x.usuario || '-') + '</strong></td>' +
          '<td><span class="bs-badge ' + badgeAccion(String(x.accion||'').toUpperCase()) + '">' + esc(x.accion || '-') + '</span></td>' +
          '<td>' + esc(x.modulo || '-') + '</td>' +
          '<td>' + (x.registro_id !== '' && x.registro_id !== null && x.registro_id !== undefined ? '<strong>#' + esc(x.registro_id) + '</strong>' : '-') + '</td>' +
          '<td class="bs-text-sm">' + esc(x.detalle || '') + '</td>' +
        '</tr>';
      });
      html += '</tbody></table></div>';
      html += '<p class="bs-text-xs bs-text-muted" style="margin-top:.5rem;">Mostrando ' + items.length + ' de ' + _AUD.length + ' movimientos (últimos 500) · <span id="audActualizado"></span></p>';
      cont.innerHTML = html;
    }

    // Refresco automático cada 2 minutos
    setInterval(function(){ cargarAuditoria(); }, 120000);

    // logout(): compartida en assets/js/bs-core.js

    cargarAuditoria();
  