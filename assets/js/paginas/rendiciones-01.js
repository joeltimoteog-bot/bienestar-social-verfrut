/* Bienestar Social · modulos/rendiciones.html · bloque 1 (antes en la linea 241) · extraido el 26-oct-2026 sin cambios (_BS_MODULAR_V1) */
    const BS_API_URL = 'https://script.google.com/macros/s/AKfycbyJIUtdpApEc35Jj4ZNP-3ONqGe64J1VhaRvkt87vVUNTgSagrOgOS0T99eIt0-w3Yi/exec';

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
    const BS_ADMINS = ['jtimoteo','ovilela','jchavez'];
    const _esAdmin = BS_ADMINS.indexOf(String(user.usuario || '').toLowerCase()) >= 0 || /admin|geren/i.test(String(user.rol || ''));
    if (!_esAdmin && (!user.permisos || !user.permisos.rendiciones)) {
      appAlert('No tienes permiso para acceder a este módulo');
      window.location.href = '../portal.html';
    }
    document.getElementById('userName').textContent = user.nombre || user.usuario;

    // ===== API HELPER =====
    // api(): compartida en assets/js/bs-core.js

    // esc(): compartida en assets/js/bs-core.js

    // ===== FORMATO MONEDA =====
    function fmtMoney(n) {
      if (n === '' || n === null || n === undefined || isNaN(parseFloat(n))) return 'S/ 0.00';
      return 'S/ ' + parseFloat(n).toFixed(2);
    }
    function _fechaInput(v) {
      if (!v) return '';
      try { return (window.bsFechaYMD ? bsFechaYMD(v) : new Date(v).toISOString().split('T')[0]); } catch(e) { return ''; }
    }
    function _fechaCorta(v) {
      if (!v) return '-';
      /* _REND_FECHAS_V1 (28-oct-2026): la fecha se lee del TEXTO (como el PDF y el Excel). Antes se pasaba
         a hora de Lima y una fecha guardada como 27/10 00:00 UTC se mostraba 26/10. */
      try { if (window.bsFechaDMY) return bsFechaDMY(v); } catch(e) {}
      try {
        const d = new Date(v);
        return ('0'+d.getUTCDate()).slice(-2)+'/'+('0'+(d.getUTCMonth()+1)).slice(-2)+'/'+d.getUTCFullYear();
      } catch(e) { return '-'; }
    }
    // Semana ISO a partir de una fecha (YYYY-MM-DD)
    function _isoWeek(str) {
      if (!str) return '';
      const ymd = window.bsFechaYMD ? bsFechaYMD(str) : String(str).slice(0, 10);   /* _REND_FECHAS_V1: sin cambio de zona */
      const pz = String(ymd || '').split('-');
      if (pz.length !== 3) return '';
      const date = new Date(Date.UTC(+pz[0], +pz[1] - 1, +pz[2]));
      if (isNaN(date.getTime())) return '';
      const dayNum = (date.getUTCDay() + 6) % 7;
      date.setUTCDate(date.getUTCDate() - dayNum + 3);
      const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
      return 1 + Math.round(((date - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
    }

    // ===== ESTADO LOCAL =====
    let _CACHE = [];
    let _chart = null;
    let _chartMontoMes = null, _chartCantMes = null;  // _MENSUAL_V1

    // ===== LISTAR (todo desde servidor + caché; filtros 100% en cliente) =====
    const _CACHE_KEY_R = 'bs_cache_rendiciones_v1';

    async function cargarRendiciones() {
      const cont = document.getElementById('tablaContainer');
      let pintado = false;
      try {
        const c = JSON.parse(localStorage.getItem(_CACHE_KEY_R) || 'null');
        if (c && Array.isArray(c.items) && c.items.length) { _CACHE = c.items; _poblarResponsables(_CACHE); render(); pintado = true; }
      } catch(e) {}
      if (!pintado) cont.innerHTML = '<div class="bs-text-center" style="padding:2rem"><div class="bs-spinner bs-spinner-dark" style="margin:0 auto"></div></div>';
      try {
        const res = await api('bs_listarRendiciones', {});
        if (!res.ok) {
          if (!pintado) {
            cont.innerHTML = '<div class="bs-alert bs-alert-warning">No se pudieron cargar las rendiciones. Es posible que el backend (GAS) aún no esté desplegado.<br><small>' + (res.message || '') + '</small></div>';
            document.getElementById('reporteContainer').innerHTML = '';
          }
          return;
        }
        var _cn = function(a){ return JSON.stringify((a||[]).map(function(x){ return JSON.stringify(x); }).sort()); };
        var _nr = res.items || [];
        var _same = pintado && _cn(_nr) === _cn(_CACHE);
        _CACHE = _nr;
        try { localStorage.setItem(_CACHE_KEY_R, JSON.stringify({ items: _CACHE, t: Date.now() })); } catch(e) {}
        _poblarResponsables(_CACHE);
        if (!_same) render();
      } catch(err) {
        if (!pintado) cont.innerHTML = '<div class="bs-alert bs-alert-danger">Error de conexión: ' + err.message + '</div>';
      }
    }

    // ===== RENDER (filtros locales: categoría / búsqueda / rango fechas) =====
    function pintarKpisRend(items) {
      items = items || [];
      var dep = 0, pen = 0, mDep = 0, mPen = 0, mTot = 0;
      items.forEach(function(r) {
        var mt = parseFloat(r.monto_total) || 0;
        mTot += mt;
        if (String(r.estado).toUpperCase() === 'DEPOSITADO') { dep++; mDep += mt; }
        else { pen++; mPen += mt; }
      });
      var T = items.length;
      var F = function(n){ return 'S/ ' + (n||0).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2}); };
      bsKpisPro('kpiRendiciones', {
        total: T,
        cards: [
          { ico:'📑', val:T, lbl:'Rendiciones (según filtros)', color:'var(--bs-mod-rend, #0f766e)', sub: F(mTot) + ' en total' },
          { ico:'🏦', val:dep, lbl:'Depositadas', color:'#16a34a', sub: F(mDep) },
          { ico:'⏳', val:pen, lbl:'Pendientes de depósito', color:'#f59e0b', sub: F(mPen) },
          { ico:'💵', val:F(mTot), lbl:'Monto total', color:'#2563eb', sub: T ? F(mTot / T) + ' promedio' : '' }
        ],
        dist: { label: 'Monto por estado de depósito', segs: [
          { lbl:'Depositado', v: Math.round(mDep), color:'#16a34a' },
          { lbl:'Pendiente', v: Math.round(mPen), color:'#f59e0b' }
        ]}
      });
    }

    function render() {
      const cont = document.getElementById('tablaContainer');
      const catField = document.getElementById('filterCategoria').value;
      const q = (document.getElementById('filterBuscar').value || '').trim().toLowerCase();
      const desde = document.getElementById('filterDesde').value;
      const hasta = document.getElementById('filterHasta').value;
      const dDesde = desde ? new Date(desde) : null;
      const dHasta = hasta ? new Date(hasta) : null;

      const fAnio = document.getElementById('filterAnio').value;
      const fEmp = document.getElementById('filterEmpresa').value;
      const fResp = document.getElementById('filterResponsable').value;
      const fEst = document.getElementById('filterEstado').value;
      let items = _CACHE.slice();
      if (fAnio) items = items.filter(function(r){ return String(r.anio) === String(fAnio); });
      if (fEmp)  items = items.filter(function(r){ return r.empresa === fEmp; });
      if (fResp) items = items.filter(function(r){ return r.responsable === fResp; });
      if (fEst)  items = items.filter(function(r){ return String(r.estado).toUpperCase() === fEst.toUpperCase(); });
      if (catField) items = items.filter(function(r){ return (parseFloat(r[catField]) || 0) > 0; });
      if (q) items = items.filter(function(r){ return String(r.rendicion || '').toLowerCase().indexOf(q) >= 0; });
      if (dDesde || dHasta) items = items.filter(function(r){
        if (!r.fecha) return false;
        const f = window.bsFechaYMD ? bsFechaYMD(r.fecha) : String(r.fecha).slice(0, 10);   /* _REND_FECHAS_V1: compara el dia, no la hora */
        if (!f) return false;
        if (desde && f < desde) return false;
        if (hasta && f > hasta) return false;
        return true;
      });

      window.__BS_EXPORT_DATA__ = items;
      renderReporte(items);

      pintarKpisRend(items);
      if (items.length === 0) {
        cont.innerHTML = '<div class="bs-card bs-text-center"><p class="bs-text-muted">No hay rendiciones con esos filtros.</p></div>';
        return;
      }

      let html = '<div class="bs-table-wrap"><table class="bs-table">';
      html += '<thead><tr><th>ID</th><th>Fecha</th><th>Sem</th><th>N° Rend.</th><th>Empresa</th>' +
              '<th>Reclut.</th><th>RR.LL.</th><th>Capac.</th><th>Bienestar</th><th>Total</th>' +
              '<th>Responsable</th><th>Estado</th><th></th></tr></thead><tbody>';
      items.forEach(function(r) {
        const dep = String(r.estado).toUpperCase() === 'DEPOSITADO';
        const badge = dep ? 'bs-badge-success' : 'bs-badge-warning';
        const rec = parseFloat(r.monto_reclutamiento)||0, rll = parseFloat(r.monto_relaciones_laborales)||0,
              cap = parseFloat(r.monto_capacitaciones)||0, bien = parseFloat(r.monto_bienestar)||0;
        const mt = parseFloat(r.monto_total)||0;
        const descuadre = Math.abs(mt - (rec+rll+cap+bien)) > 0.01;
        const flag = descuadre ? '<span title="El total no coincide con la suma de categorías (suma: ' + fmtMoney(rec+rll+cap+bien) + ')" style="cursor:help;">🚩 </span>' : '';
        const rowStyle = descuadre ? ' style="background:#fef2f2;"' : '';
        html += '<tr' + rowStyle + '>' +
          '<td><strong>#' + r.id + '</strong></td>' +
          '<td>' + _fechaCorta(r.fecha) + '</td>' +
          '<td style="text-align:center;">' + esc(r.semana || '-') + '</td>' +
          '<td>' + esc(r.rendicion || '-') + '</td>' +
          '<td>' + esc(r.empresa || '-') + '</td>' +
          '<td style="text-align:right;">' + fmtMoney(r.monto_reclutamiento) + '</td>' +
          '<td style="text-align:right;">' + fmtMoney(r.monto_relaciones_laborales) + '</td>' +
          '<td style="text-align:right;">' + fmtMoney(r.monto_capacitaciones) + '</td>' +
          '<td style="text-align:right;">' + fmtMoney(r.monto_bienestar) + '</td>' +
          '<td style="text-align:right;">' + flag + '<strong>' + fmtMoney(r.monto_total) + '</strong></td>' +
          '<td>' + esc(r.responsable || '-') + '</td>' +
          '<td><span class="bs-badge ' + badge + '">' + esc(r.estado || '-') + '</span></td>' +
          '<td style="white-space:nowrap;">' +
            (!dep ? '<button class="bs-btn bs-btn-sm" style="background:#16a34a;color:#fff;" title="Marcar como depositado" onclick="marcarDepositado(' + r.id + ')">✓ Depositar</button> ' : '') +
            '<button class="bs-btn bs-btn-sm bs-btn-outline" onclick="editar(' + r.id + ')">Editar</button>' +
            (_esAdmin ? '<button class="bs-btn bs-btn-sm bs-btn-outline" style="margin-left:.3rem;border-color:#dc2626;color:#dc2626;" onclick="eliminar(' + r.id + ')">Eliminar</button>' : '') +
          '</td>' +
        '</tr>';
      });
      html += '</tbody></table></div>';
      cont.innerHTML = html;
    }

    // Marcar como depositado rápido (sin abrir el modal)
    async function marcarDepositado(id) {
      const hoy = new Date().toISOString().slice(0,10);
      const f = await appPrompt('Fecha de depósito (YYYY-MM-DD):', hoy);
      if (!f) return;
      try {
        const res = await api('bs_actualizarRendicion', { usuario: user.usuario, id: parseInt(id), datos: { estado: 'DEPOSITADO', fecha_deposito: f } });
        if (res.ok) cargarRendiciones();
        else appAlert('Error: ' + (res.message || 'No se pudo actualizar'));
      } catch(err) { appAlert('Error de conexión: ' + err.message); }
    }

    function _poblarResponsables(items) {
      const sel = document.getElementById('filterResponsable');
      const actual = sel.value;
      const set = {};
      items.forEach(function(r){ if (r.responsable) set[r.responsable] = true; });
      const nombres = Object.keys(set).sort();
      sel.innerHTML = '<option value="">Todos</option>' + nombres.map(function(n){ return '<option value="'+n+'">'+n+'</option>'; }).join('');
      if (actual) sel.value = actual;
    }

    // ===== REPORTE EN VIVO (KPIs + resumen + gráfico) =====
    function renderReporte(items) {
      const cont = document.getElementById('reporteContainer');
      if (_chart) { _chart.destroy(); _chart = null; }
      if (_chartMontoMes) { _chartMontoMes.destroy(); _chartMontoMes = null; }  // _MENSUAL_V1
      if (_chartCantMes)  { _chartCantMes.destroy();  _chartCantMes = null; }   // _MENSUAL_V1
      if (!items.length) { cont.innerHTML = ''; return; }
      let total = 0, depositado = 0, pendiente = 0, flagged = 0;
      const cat = { rec:0, rll:0, cap:0, bien:0 };
      const empMap = { RAPEL:{total:0,rec:0,rll:0,cap:0,bien:0}, VERFRUT:{total:0,rec:0,rll:0,cap:0,bien:0} };
      // _MENSUAL_V1: mapeo por mes (0-11) × empresa para monto y cantidad
      const monthMap = {
        RAPEL:   { monto: new Array(12).fill(0), count: new Array(12).fill(0) },
        VERFRUT: { monto: new Array(12).fill(0), count: new Array(12).fill(0) },
        TOTAL:   { monto: new Array(12).fill(0), count: new Array(12).fill(0) }
      };
      items.forEach(function(r){
        const rec = parseFloat(r.monto_reclutamiento)||0, rll = parseFloat(r.monto_relaciones_laborales)||0,
              cap = parseFloat(r.monto_capacitaciones)||0, bien = parseFloat(r.monto_bienestar)||0;
        const mt = parseFloat(r.monto_total) || 0;
        total += mt;
        if (Math.abs(mt - (rec+rll+cap+bien)) > 0.01) flagged++;
        if (String(r.estado).toUpperCase() === 'DEPOSITADO') depositado += mt; else pendiente += mt;
        cat.rec+=rec; cat.rll+=rll; cat.cap+=cap; cat.bien+=bien;
        const e = (String(r.empresa).toUpperCase().indexOf('VERFRUT')>=0) ? 'VERFRUT' : (String(r.empresa).toUpperCase().indexOf('RAPEL')>=0 ? 'RAPEL' : null);
        if (e) { empMap[e].total+=mt; empMap[e].rec+=rec; empMap[e].rll+=rll; empMap[e].cap+=cap; empMap[e].bien+=bien; }
        // _MENSUAL_V1: extraer mes de r.fecha (YYYY-MM-DD)
        if (r.fecha) {
          const fechaStr = String(r.fecha);
          const partes = fechaStr.indexOf('T') >= 0 ? fechaStr.split('T')[0].split('-') : fechaStr.split('-');
          if (partes.length >= 2) {
            const mes = parseInt(partes[1], 10) - 1;
            if (mes >= 0 && mes <= 11) {
              if (e) { monthMap[e].monto[mes] += mt; monthMap[e].count[mes] += 1; }
              monthMap.TOTAL.monto[mes] += mt;
              monthMap.TOTAL.count[mes] += 1;
            }
          }
        }
      });

      function kpi(label, val, color) {
        return '<div class="bs-card" style="flex:1;min-width:150px;margin:0;border-left:4px solid '+color+';">' +
          '<div class="bs-text-xs bs-text-subtle" style="text-transform:uppercase;letter-spacing:.04em;">'+label+'</div>' +
          '<div style="font-size:1.35rem;font-weight:700;color:'+color+';">'+val+'</div></div>';
      }
      function filaEmp(nombre, o) {
        return '<tr><td><strong>'+nombre+'</strong></td>' +
          '<td style="text-align:right;">'+fmtMoney(o.rec)+'</td>' +
          '<td style="text-align:right;">'+fmtMoney(o.rll)+'</td>' +
          '<td style="text-align:right;">'+fmtMoney(o.cap)+'</td>' +
          '<td style="text-align:right;">'+fmtMoney(o.bien)+'</td>' +
          '<td style="text-align:right;"><strong>'+fmtMoney(o.total)+'</strong></td></tr>';
      }

      cont.innerHTML =
        '<div class="bs-flex bs-gap" style="flex-wrap:wrap;margin-bottom:.8rem;">' +
          kpi('Rendiciones', items.length, '#0a2463') +
          kpi('Monto total', fmtMoney(total), 'var(--bs-mod-rend)') +
          kpi('Depositado', fmtMoney(depositado), '#16a34a') +
          kpi('Pendiente', fmtMoney(pendiente), '#d97706') +
          (flagged > 0 ? kpi('Con descuadre 🚩', flagged, '#dc2626') : '') +
        '</div>' +
        '<div class="bs-grid bs-gap" style="grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); align-items:stretch;">' +
          '<div class="bs-card" style="margin:0;">' +
            '<div class="bs-text-sm" style="font-weight:700;color:var(--bs-mod-rend);margin-bottom:.5rem;">Resumen por empresa y categoría</div>' +
            '<div class="bs-table-wrap"><table class="bs-table"><thead><tr>' +
            '<th>Empresa</th><th style="text-align:right;">Reclut.</th><th style="text-align:right;">RR.LL.</th>' +
            '<th style="text-align:right;">Capac.</th><th style="text-align:right;">Bienestar</th><th style="text-align:right;">Total</th>' +
            '</tr></thead><tbody>' +
            filaEmp('RAPEL', empMap.RAPEL) + filaEmp('VERFRUT', empMap.VERFRUT) +
            '<tr style="border-top:2px solid #cbd5e1;"><td><strong>TOTAL</strong></td>' +
              '<td style="text-align:right;"><strong>'+fmtMoney(cat.rec)+'</strong></td>' +
              '<td style="text-align:right;"><strong>'+fmtMoney(cat.rll)+'</strong></td>' +
              '<td style="text-align:right;"><strong>'+fmtMoney(cat.cap)+'</strong></td>' +
              '<td style="text-align:right;"><strong>'+fmtMoney(cat.bien)+'</strong></td>' +
              '<td style="text-align:right;"><strong>'+fmtMoney(total)+'</strong></td></tr>' +
            '</tbody></table></div>' +
          '</div>' +
          '<div class="bs-card" style="margin:0;">' +
            '<div class="bs-text-sm" style="font-weight:700;color:var(--bs-mod-rend);margin-bottom:.5rem;">Gasto por categoría y empresa</div>' +
            '<div style="position:relative;height:260px;"><canvas id="rendChart"></canvas></div>' +
          '</div>' +
        '</div>' +
        // _MENSUAL_V1: 2 gráficos mensuales (monto + cantidad)
        '<div class="bs-grid bs-gap" style="grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); align-items:stretch; margin-top:1rem;">' +
          '<div class="bs-card" style="margin:0;">' +
            '<div class="bs-text-sm" style="font-weight:700;color:var(--bs-mod-rend);margin-bottom:.5rem;">Monto mensual (S/) por empresa</div>' +
            '<div style="position:relative;height:280px;"><canvas id="rendChartMontoMes"></canvas></div>' +
          '</div>' +
          '<div class="bs-card" style="margin:0;">' +
            '<div class="bs-text-sm" style="font-weight:700;color:var(--bs-mod-rend);margin-bottom:.5rem;">Cantidad de rendiciones por mes</div>' +
            '<div style="position:relative;height:280px;"><canvas id="rendChartCantMes"></canvas></div>' +
          '</div>' +
        '</div>';

      renderChart(empMap);
      renderChartMensual(monthMap);  // _MENSUAL_V1
    }

    // _MENSUAL_V1: gráficos mensuales (monto + cantidad) con barras RAPEL/VERFRUT + línea TOTAL
    function renderChartMensual(monthMap) {
      var MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

      // Gráfico A: Monto mensual
      var canvasMonto = document.getElementById('rendChartMontoMes');
      if (canvasMonto && typeof Chart !== 'undefined') {
        _chartMontoMes = new Chart(canvasMonto.getContext('2d'), {
          type: 'bar',
          data: {
            labels: MESES,
            datasets: [
              { type:'bar',  label:'RAPEL',   data: monthMap.RAPEL.monto,   backgroundColor:'#0a2463', order:2 },
              { type:'bar',  label:'VERFRUT', data: monthMap.VERFRUT.monto, backgroundColor:'#059669', order:2 },
              { type:'line', label:'TOTAL',   data: monthMap.TOTAL.monto,   borderColor:'#dc2626', backgroundColor:'#dc2626', borderWidth:2, tension:0.3, pointRadius:4, pointHoverRadius:6, fill:false, order:1 }
            ]
          },
          options: {
            responsive:true, maintainAspectRatio:false,
            layout: { padding: { top: 20 } },
            plugins: {
              legend: { position:'bottom' },
              tooltip: { callbacks: { label: function(ctx){ return ctx.dataset.label + ': S/ ' + (ctx.parsed.y||0).toLocaleString('es-PE', {minimumFractionDigits:2, maximumFractionDigits:2}); } } },
              datalabels: {
                anchor: 'end',
                align: 'top',
                offset: 4,
                formatter: function(value) {
                  if (!value || value === 0) return '';
                  return 'S/ ' + value.toLocaleString('es-PE', {minimumFractionDigits:2, maximumFractionDigits:2});
                },
                font: { weight: 'bold', size: 11 },
                color: function(ctx) {
                  return ctx.dataset.type === 'line' ? '#b91c1c' : (ctx.datasetIndex === 0 ? '#1e3a8a' : '#047857');
                },
                backgroundColor: function(ctx) {
                  return 'rgba(255, 255, 255, 0.85)';
                },
                borderRadius: 4,
                padding: { top: 2, bottom: 2, left: 4, right: 4 }
              }
            },
            scales: { y:{ beginAtZero:true, ticks:{ callback:function(v){ return 'S/ ' + v; } }, suggestedMax: function(ctx){ var max = 0; ctx.chart.data.datasets.forEach(function(ds){ ds.data.forEach(function(v){ if(v>max) max=v; }); }); return max * 1.25; } } }
          },
          plugins: [ChartDataLabels]
        });
      }

      // Gráfico B: Cantidad mensual
      var canvasCant = document.getElementById('rendChartCantMes');
      if (canvasCant && typeof Chart !== 'undefined') {
        _chartCantMes = new Chart(canvasCant.getContext('2d'), {
          type: 'bar',
          data: {
            labels: MESES,
            datasets: [
              { type:'bar',  label:'RAPEL',   data: monthMap.RAPEL.count,   backgroundColor:'#0a2463', order:2 },
              { type:'bar',  label:'VERFRUT', data: monthMap.VERFRUT.count, backgroundColor:'#059669', order:2 },
              { type:'line', label:'TOTAL',   data: monthMap.TOTAL.count,   borderColor:'#dc2626', backgroundColor:'#dc2626', borderWidth:2, tension:0.3, pointRadius:4, pointHoverRadius:6, fill:false, order:1 }
            ]
          },
          options: {
            responsive:true, maintainAspectRatio:false,
            layout: { padding: { top: 20 } },
            plugins: {
              legend: { position:'bottom' },
              datalabels: {
                anchor: 'end',
                align: 'top',
                offset: 4,
                formatter: function(value) {
                  if (!value || value === 0) return '';
                  return value;
                },
                font: { weight: 'bold', size: 12 },
                color: function(ctx) {
                  return ctx.dataset.type === 'line' ? '#b91c1c' : (ctx.datasetIndex === 0 ? '#1e3a8a' : '#047857');
                },
                backgroundColor: function(ctx) {
                  return 'rgba(255, 255, 255, 0.85)';
                },
                borderRadius: 4,
                padding: { top: 2, bottom: 2, left: 5, right: 5 }
              }
            },
            scales: { y:{ beginAtZero:true, ticks:{ precision:0, stepSize:1 }, suggestedMax: function(ctx){ var max = 0; ctx.chart.data.datasets.forEach(function(ds){ ds.data.forEach(function(v){ if(v>max) max=v; }); }); return max + Math.max(1, Math.ceil(max*0.25)); } } }
          },
          plugins: [ChartDataLabels]
        });
      }
    }

    function renderChart(empMap) {
      var canvas = document.getElementById('rendChart');
      if (!canvas || typeof Chart === 'undefined') return;
      _chart = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: ['Reclutamiento','RR.LL.','Capacitaciones','Bienestar'],
          datasets: [
            { label:'RAPEL',   data:[empMap.RAPEL.rec, empMap.RAPEL.rll, empMap.RAPEL.cap, empMap.RAPEL.bien], backgroundColor:'#0a2463' },
            { label:'VERFRUT', data:[empMap.VERFRUT.rec, empMap.VERFRUT.rll, empMap.VERFRUT.cap, empMap.VERFRUT.bien], backgroundColor:'#059669' }
          ]
        },
        options: {
          responsive:true, maintainAspectRatio:false,
          plugins:{ legend:{ position:'bottom' } },
          scales:{ y:{ beginAtZero:true, ticks:{ callback:function(v){ return 'S/ ' + v; } } } }
        }
      });
    }

    // ===== MODAL =====
    const ALL_FIELDS = ['empresa','rendicion','fecha','semana','responsable','estado','fecha_deposito',
                        'monto_reclutamiento','monto_relaciones_laborales','monto_capacitaciones','monto_bienestar','monto_total','observaciones'];
    window.__BS_EXPORT_ORDER = ['id'].concat(ALL_FIELDS).concat(['created_by','created_at','updated_at','anulado']);
    const DATE_FIELDS = ['fecha','fecha_deposito'];

    function openModal() {
      document.getElementById('formTitle').textContent = 'Nueva Rendición';
      document.getElementById('rendicionId').value = '';
      document.getElementById('anio').value = '';
      ALL_FIELDS.forEach(function(f){
        const el = document.getElementById(f);
        if (!el) return;
        if (['monto_reclutamiento','monto_relaciones_laborales','monto_capacitaciones','monto_bienestar','monto_total'].indexOf(f) >= 0) el.value = '0';
        else el.value = '';
      });
      document.getElementById('estado').value = 'NO DEPOSITADO';
      toggleDeposito();
      document.getElementById('formAlert').innerHTML = '';
      document.getElementById('formModal').classList.add('bs-active');
    }

    function closeModal() {
      document.getElementById('formModal').classList.remove('bs-active');
    }

    async function eliminar(id) {
      if (!_esAdmin) return;
      if (!await appConfirm('¿Eliminar la rendición #' + id + '?\n\nEsta acción no se puede deshacer.')) return;
      try {
        const res = await api('bs_eliminarRendicion', { usuario: user.usuario, id: parseInt(id) });
        if (res.ok) cargarRendiciones();
        else appAlert('Error: ' + (res.message || 'No se pudo eliminar'));
      } catch(err) {
        appAlert('Error de conexión: ' + err.message);
      }
    }

    async function editar(id) {
      const res = await api('bs_listarRendiciones', {});
      if (!res.ok) return appAlert('Error: ' + res.message);
      const r = (res.items || []).find(function(x){ return parseInt(x.id) === parseInt(id); });
      if (!r) return appAlert('Rendición no encontrada');

      document.getElementById('formTitle').textContent = 'Editar Rendición #' + r.id;
      document.getElementById('rendicionId').value = r.id;
      document.getElementById('anio').value = r.anio || '';
      ALL_FIELDS.forEach(function(f){
        const el = document.getElementById(f);
        if (!el) return;
        let v = r[f];
        if (DATE_FIELDS.indexOf(f) >= 0) v = _fechaInput(v);
        el.value = (v === null || v === undefined) ? '' : v;
      });
      if (!document.getElementById('estado').value) document.getElementById('estado').value = 'NO DEPOSITADO';
      toggleDeposito();
      document.getElementById('formAlert').innerHTML = '';
      document.getElementById('formModal').classList.add('bs-active');
    }

    async function submitForm() {
      const datos = {};
      ALL_FIELDS.forEach(function(f){ datos[f] = document.getElementById(f).value; });

      // Año derivado de la fecha (para reporte/búsqueda por año)
      datos.anio = datos.fecha ? new Date(datos.fecha).getFullYear() : (new Date().getFullYear());

      // Validación mínima
      if (!datos.empresa || !datos.rendicion || !datos.fecha) {
        document.getElementById('formAlert').innerHTML = '<div class="bs-alert bs-alert-danger">Completa: <strong>Empresa, N° Rendición y Fecha</strong></div>';
        return;
      }

      const btn = document.getElementById('btnSubmit');
      btn.disabled = true; btn.textContent = 'Guardando...';
      try {
        const id = document.getElementById('rendicionId').value;
        const action = id ? 'bs_actualizarRendicion' : 'bs_crearRendicion';
        const payload = id
          ? { usuario: user.usuario, id: parseInt(id), datos: datos }
          : { usuario: user.usuario, datos: datos };
        const res = await api(action, payload);
        if (res.ok) { closeModal(); cargarRendiciones(); }
        else document.getElementById('formAlert').innerHTML = '<div class="bs-alert bs-alert-danger">Error: ' + res.message + '</div>';
      } catch(err) {
        document.getElementById('formAlert').innerHTML = '<div class="bs-alert bs-alert-danger">Error: ' + err.message + '</div>';
      } finally {
        btn.disabled = false; btn.textContent = 'Guardar';
      }
    }

    // ===== AUTOMATISMOS DEL FORMULARIO =====
    function recalcTotal() {
      const suma = ['monto_reclutamiento','monto_relaciones_laborales','monto_capacitaciones','monto_bienestar']
        .reduce(function(a, id){ return a + (parseFloat(document.getElementById(id).value) || 0); }, 0);
      document.getElementById('monto_total').value = +suma.toFixed(2);
    }
    function toggleDeposito() {
      const dep = document.getElementById('estado').value === 'DEPOSITADO';
      document.getElementById('wrapFechaDeposito').style.display = dep ? '' : 'none';
    }
    function onFechaChange() {
      const f = document.getElementById('fecha').value;
      if (!f) return;
      const w = _isoWeek(f);
      if (w) document.getElementById('semana').value = w;
      document.getElementById('anio').value = new Date(f).getFullYear();
    }
    function setupForm() {
      ['monto_reclutamiento','monto_relaciones_laborales','monto_capacitaciones','monto_bienestar'].forEach(function(id){
        document.getElementById(id).addEventListener('input', recalcTotal);
      });
      document.getElementById('estado').addEventListener('change', toggleDeposito);
      document.getElementById('fecha').addEventListener('change', onFechaChange);
    }

    // ===== LOGOUT =====
    // logout(): compartida en assets/js/bs-core.js

    // ===== INIT =====
    setupForm();
    cargarRendiciones();

    // ===== AUTO-ACTUALIZACIÓN (cada 60 s + al volver a la pestaña) =====
    (function(){
      var INTERVALO_MS = 60000;
      setInterval(function(){
        if (!document.hidden && !document.getElementById('formModal').classList.contains('bs-active')) cargarRendiciones();
      }, INTERVALO_MS);
      document.addEventListener('visibilitychange', function(){
        if (!document.hidden) cargarRendiciones();
      });
    })();

  