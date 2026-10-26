/* Bienestar Social · modulos/estadisticas.html · bloque 1 (antes en la linea 152) · extraido el 26-oct-2026 sin cambios (_BS_MODULAR_V1) */
    const BS_API_URL = 'https://script.google.com/macros/s/AKfycbyJIUtdpApEc35Jj4ZNP-3ONqGe64J1VhaRvkt87vVUNTgSagrOgOS0T99eIt0-w3Yi/exec';

    // ===== AUTH (solo admin / gerencia) =====
    const session = localStorage.getItem('bienestarSocialAuth');
    if (!session) window.location.href = '../index.html';
    let user;
    try {
      user = JSON.parse(session);
      if (!user || !user.usuario) throw new Error();
    } catch(e) {
      window.location.href = '../index.html';
    }
    const ADMINS = ['jtimoteo','ovilela','jchavez'];
    const isAdmin = ADMINS.indexOf((user.usuario || '').toLowerCase()) >= 0 || /admin|geren/i.test(user.rol || '');
    const _tieneFlagEst = !!(user.permisos && (user.permisos.estadisticas === true || user.permisos.mod_estadisticas === true));
    if (!isAdmin && !_tieneFlagEst) {
      appAlert('Esta sección es solo para administración / gerencia.');
      window.location.href = '../portal.html';
    }
    document.getElementById('userName').textContent = user.nombre || user.usuario;

    // logout(): compartida en assets/js/bs-core.js

    // ===== API HELPER =====
    // api(): compartida en assets/js/bs-core.js

    // ===== CONFIG VISUAL =====
    const MOD_COLOR = { Quejas:'#f59e0b', Accidentes:'#dc2626', Hostigamiento:'#7c3aed', Subsidios:'#06b6d4', Sugerencias:'#0a2463' };
    const CUMP = {
      a_tiempo:     { label:'Cerrado a tiempo',      color:'#16a34a' },
      abierto_plazo:{ label:'Abierto en plazo',      color:'#0891b2' },
      fuera:        { label:'Cerrado fuera de plazo', color:'#d97706' },
      vencido:      { label:'Abierto vencido',       color:'#dc2626' }
    };
    function semColor(pct){ return pct >= 85 ? '#16a34a' : pct >= 60 ? '#d97706' : '#dc2626'; }

    let DATA = null;
    let userDropdownReady = false;
    const charts = {};
    function mkChart(id, cfg){
      const el = document.getElementById(id);
      if (!el) return;
      if (charts[id]) charts[id].destroy();
      charts[id] = new Chart(el.getContext('2d'), cfg);
    }

    // ===== CARGA =====
    const _CACHE_KEY_EST = 'bs_cache_estadisticas_v1';

    function _pintarEst(res){
      DATA = res;
      if (!userDropdownReady) { poblarUsuarios(res.usuariosDisponibles || []); userDropdownReady = true; }
      document.getElementById('genStamp').textContent = res.generado ? ('· Generado: ' + res.generado) : '';
      document.getElementById('loading').style.display = 'none';
      document.getElementById('contenido').style.display = 'block';
      renderKPIs(); renderCharts(); renderEstados(); renderRanking(); renderVencidos();
    }

    async function cargar(){
      const filtros = {
        modulo:  document.getElementById('fModulo').value,
        usuario: document.getElementById('fUsuario').value,
        empresa: document.getElementById('fEmpresa').value,
        desde:   document.getElementById('fDesde').value,
        hasta:   document.getElementById('fHasta').value
      };
      const fkey = JSON.stringify(filtros);

      // 1) Pinta AL INSTANTE desde caché si coinciden los filtros
      let pintado = false;
      try {
        const c = JSON.parse(localStorage.getItem(_CACHE_KEY_EST) || 'null');
        if (c && c.fkey === fkey && c.res) { _pintarEst(c.res); pintado = true; }
      } catch(e) {}
      if (!pintado) {
        document.getElementById('loading').style.display = 'block';
        document.getElementById('contenido').style.display = 'none';
      }

      // 2) Refresca desde el servidor en segundo plano
      try {
        const res = await api('bs_estadisticasEmpresariales', filtros);
        document.getElementById('loading').style.display = 'none';
        if (!res.ok) {
          if (!pintado) {
            document.getElementById('contenido').style.display = 'block';
            document.getElementById('contenido').innerHTML = '<div class="bs-alert bs-alert-danger">Error: ' + (res.message || 'sin detalle') + '</div>';
          }
          return;
        }
        try { localStorage.setItem(_CACHE_KEY_EST, JSON.stringify({ fkey: fkey, res: res, t: Date.now() })); } catch(e) {}
        _pintarEst(res);
      } catch(err) {
        if (!pintado) {
          document.getElementById('loading').style.display = 'none';
          document.getElementById('contenido').style.display = 'block';
          document.getElementById('contenido').innerHTML = '<div class="bs-alert bs-alert-danger">Error de conexión: ' + err.message + '</div>';
        }
      }
    }

    function poblarUsuarios(list){
      const sel = document.getElementById('fUsuario');
      list.forEach(function(u){ const o = document.createElement('option'); o.value = u; o.textContent = u; sel.appendChild(o); });
    }

    function limpiar(){
      document.getElementById('fModulo').value = 'Todos';
      document.getElementById('fUsuario').value = 'Todos';
      document.getElementById('fEmpresa').value = 'Todas';
      document.getElementById('fDesde').value = '';
      document.getElementById('fHasta').value = '';
      cargar();
    }

    // ===== RENDER =====
    function renderKPIs(){
      const g = DATA.cumplimiento.global;
      const cards = [
        ['Total casos', DATA.general, '#0a2463'],
        ['% Cumplimiento', g.pct_cumplimiento + '%', semColor(g.pct_cumplimiento)],
        ['% Cierre', g.pct_cierre + '%', '#0891b2'],
        ['Vencidos abiertos', g.vencido, g.vencido > 0 ? '#dc2626' : '#16a34a'],
        ['Tiempo prom. cierre', g.tiempo_prom_cierre + ' d', '#7c3aed']
      ];
      document.getElementById('kpis').innerHTML = cards.map(function(c){
        return '<div class="bs-card" style="text-align:center;padding:1rem;">' +
               '<div style="font-size:.72rem;color:#64748b;text-transform:uppercase;letter-spacing:.04em;">' + c[0] + '</div>' +
               '<div style="font-size:1.7rem;font-weight:800;color:' + c[2] + ';margin-top:.2rem;">' + c[1] + '</div></div>';
      }).join('');
    }

    function renderCharts(){
      const MODS = Object.keys(DATA.totales);
      const colors = MODS.map(function(m){ return MOD_COLOR[m] || '#64748b'; });
      const opt0 = { responsive:true, maintainAspectRatio:false };

      mkChart('chTotales', {
        type:'bar',
        data:{ labels:MODS, datasets:[{ label:'Casos', data:MODS.map(function(m){ return DATA.totales[m] || 0; }), backgroundColor:colors }] },
        options:Object.assign({}, opt0, { plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:true, ticks:{ precision:0 } } } })
      });

      const keys = ['a_tiempo','abierto_plazo','fuera','vencido'];
      const dsCump = keys.map(function(k){
        return { label:CUMP[k].label, data:MODS.map(function(m){ return (DATA.cumplimiento.porModulo[m] || {})[k] || 0; }), backgroundColor:CUMP[k].color };
      });
      mkChart('chCump', {
        type:'bar',
        data:{ labels:MODS, datasets:dsCump },
        options:Object.assign({}, opt0, { plugins:{ legend:{ position:'bottom' } }, scales:{ x:{ stacked:true }, y:{ stacked:true, beginAtZero:true, ticks:{ precision:0 } } } })
      });

      mkChart('chEmpresa', {
        type:'bar',
        data:{ labels:MODS, datasets:[
          { label:'RAPEL',   data:MODS.map(function(m){ return (DATA.porEmpresa.RAPEL || {})[m] || 0; }),   backgroundColor:'#0a2463' },
          { label:'VERFRUT', data:MODS.map(function(m){ return (DATA.porEmpresa.VERFRUT || {})[m] || 0; }), backgroundColor:'#dc2626' }
        ] },
        options:Object.assign({}, opt0, { plugins:{ legend:{ position:'bottom' } }, scales:{ y:{ beginAtZero:true, ticks:{ precision:0 } } } })
      });

      const t = DATA.tendencia;
      mkChart('chTend', {
        type:'line',
        data:{ labels:t.labels, datasets:Object.keys(t.series).map(function(m){
          return { label:m, data:t.series[m], borderColor:MOD_COLOR[m] || '#64748b', backgroundColor:'transparent', tension:.3 };
        }) },
        options:Object.assign({}, opt0, { plugins:{ legend:{ position:'bottom' } }, scales:{ y:{ beginAtZero:true, ticks:{ precision:0 } } } })
      });
    }

    function renderEstados(){
      const MODS = Object.keys(DATA.estados);
      let h = '';
      MODS.forEach(function(m){
        const es = DATA.estados[m] || {};
        const keys = Object.keys(es);
        const rows = keys.length
          ? keys.map(function(k){ return '<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #f1f5f9;"><span>' + k + '</span><strong>' + es[k] + '</strong></div>'; }).join('')
          : '<div style="color:#94a3b8;">Sin datos</div>';
        h += '<div class="bs-card" style="padding:.8rem 1rem;"><div style="font-weight:700;color:' + (MOD_COLOR[m] || '#0a2463') + ';margin-bottom:.4rem;">' + m + '</div>' + rows + '</div>';
      });
      document.getElementById('estados').innerHTML = h || '<p class="bs-text-muted">Sin datos.</p>';
    }

    function renderRanking(){
      const arr = DATA.cumplimiento.porUsuario || [];
      if (!arr.length) { document.getElementById('rankingUsuarios').innerHTML = '<p class="bs-text-muted">Sin datos.</p>'; return; }
      let h = '<div class="bs-table-wrap"><table class="bs-table"><thead><tr><th>Usuario</th><th>Total</th><th>A tiempo</th><th>Fuera</th><th>Abierto en plazo</th><th>Vencido</th><th>% Cumplimiento</th><th>Tiempo prom.</th></tr></thead><tbody>';
      arr.forEach(function(u){
        const col = semColor(u.pct_cumplimiento);
        h += '<tr><td><strong>' + u.usuario + '</strong></td><td>' + u.total + '</td><td>' + u.a_tiempo + '</td><td>' + u.fuera + '</td><td>' + u.abierto_plazo + '</td><td>' + u.vencido + '</td>' +
             '<td><span style="background:' + col + '20;color:' + col + ';border:1px solid ' + col + '55;padding:2px 10px;border-radius:999px;font-weight:700;">' + u.pct_cumplimiento + '%</span></td>' +
             '<td>' + u.tiempo_prom_cierre + ' d</td></tr>';
      });
      h += '</tbody></table></div>';
      document.getElementById('rankingUsuarios').innerHTML = h;
    }

    function renderVencidos(){
      const arr = DATA.cumplimiento.vencidosAbiertos || [];
      if (!arr.length) { document.getElementById('vencidos').innerHTML = '<p class="bs-text-muted">🎉 No hay casos vencidos abiertos.</p>'; return; }
      let h = '<div class="bs-table-wrap"><table class="bs-table"><thead><tr><th>Módulo</th><th>ID</th><th>Usuario</th><th>Empresa</th><th>Inicio</th><th>Límite</th><th>Días vencido</th></tr></thead><tbody>';
      arr.forEach(function(x){
        h += '<tr><td>' + x.modulo + '</td><td>#' + x.id + '</td><td>' + x.usuario + '</td><td>' + (x.empresa || '') + '</td><td>' + (x.fecha_inicio || '') + '</td><td>' + (x.limite || '') + '</td>' +
             '<td><span style="color:#dc2626;font-weight:700;">' + x.dias_vencido + '</span></td></tr>';
      });
      h += '</tbody></table></div>';
      document.getElementById('vencidos').innerHTML = h;
    }

    // ===== EXPORT =====
    function exportExcel(){
      if (!DATA) { appAlert('Primero carga los datos.'); return; }
      const wb = XLSX.utils.book_new();
      const MODS = Object.keys(DATA.totales);

      const resumen = [['Modulo','Total','% Cierre','% Cumplimiento','Vencidos abiertos','Tiempo prom. cierre (d)']];
      MODS.forEach(function(m){ const c = DATA.cumplimiento.porModulo[m] || {}; resumen.push([m, DATA.totales[m] || 0, c.pct_cierre || 0, c.pct_cumplimiento || 0, c.vencido || 0, c.tiempo_prom_cierre || 0]); });
      const g = DATA.cumplimiento.global;
      resumen.push(['TOTAL', DATA.general, g.pct_cierre, g.pct_cumplimiento, g.vencido, g.tiempo_prom_cierre]);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumen), 'Resumen');

      const us = [['Usuario','Total','A tiempo','Fuera de plazo','Abierto en plazo','Vencido','% Cumplimiento','Tiempo prom (d)']];
      (DATA.cumplimiento.porUsuario || []).forEach(function(u){ us.push([u.usuario, u.total, u.a_tiempo, u.fuera, u.abierto_plazo, u.vencido, u.pct_cumplimiento, u.tiempo_prom_cierre]); });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(us), 'Cumplimiento usuarios');

      const v = [['Modulo','ID','Usuario','Empresa','Inicio','Limite','Dias vencido']];
      (DATA.cumplimiento.vencidosAbiertos || []).forEach(function(x){ v.push([x.modulo, x.id, x.usuario, x.empresa, x.fecha_inicio, x.limite, x.dias_vencido]); });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(v), 'Vencidos abiertos');

      const e = [['Modulo','Estado','Cantidad']];
      MODS.forEach(function(m){ const es = DATA.estados[m] || {}; Object.keys(es).forEach(function(k){ e.push([m, k, es[k]]); }); });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(e), 'Por estado');

      const stamp = (DATA.generado || '').replace(/[^0-9]/g, '').slice(0, 8);
      XLSX.writeFile(wb, 'Estadisticas_Bienestar_' + stamp + '.xlsx');
    }

    function exportPDF(){ window.print(); }

    // ===== INIT =====
    cargar();

    // ===== AUTO-ACTUALIZACIÓN (cada 90 s + al volver a la pestaña) =====
    (function(){
      var INTERVALO_MS = 90000;
      setInterval(function(){ if (!document.hidden) cargar(); }, INTERVALO_MS);
      document.addEventListener('visibilitychange', function(){ if (!document.hidden) cargar(); });
    })();
  