/* Bienestar Social · portal.html · bloque 1 (antes en la linea 251) · extraido el 26-oct-2026 sin cambios (_BS_MODULAR_V1) */
    // ===== ENDPOINT BIENESTAR =====
    var BS_API_URL = 'https://script.google.com/macros/s/AKfycbyJIUtdpApEc35Jj4ZNP-3ONqGe64J1VhaRvkt87vVUNTgSagrOgOS0T99eIt0-w3Yi/exec';
    function _bsTok(){ try { var u = JSON.parse(localStorage.getItem('bienestarSocialAuth')||'null'); return (u && u.token) || ''; } catch(e){ return ''; } }
    function _bs401(j){ if (j && j.code === 401) { try { localStorage.removeItem('bienestarSocialAuth'); Object.keys(localStorage).forEach(function(k){ if (k.indexOf('bs_cache_') === 0) localStorage.removeItem(k); }); } catch(e){} location.href = 'index.html'; return true; } return false; }
    function bsApi(action, payload){
      return fetch(BS_API_URL, {
        method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'},
        body: JSON.stringify(Object.assign({action:action, token:_bsTok()}, payload||{}))
      }).then(function(r){ return r.json(); }).then(function(j){ if (_bs401(j)) throw new Error('Sesión expirada'); return j; });
    }

    // ===== AUTH CHECK =====
    const session = localStorage.getItem('bienestarSocialAuth');
    if (!session) { window.location.href = 'index.html'; }
    let user;
    try {
      user = JSON.parse(session);
      if (!user || !user.usuario) throw new Error('Sesion invalida');
    } catch (e) {
      localStorage.removeItem('bienestarSocialAuth'); try { Object.keys(localStorage).forEach(function(k){ if (k.indexOf('bs_cache_') === 0) localStorage.removeItem(k); }); Object.keys(sessionStorage).forEach(function(k){ if (k.indexOf('bs_cache_') === 0) sessionStorage.removeItem(k); }); } catch(e){}
      window.location.href = 'index.html';
    }

    // ===== TEMA (claro/oscuro, solo portal) =====
    (function(){
      var t = null; try { t = localStorage.getItem('bs_tema'); } catch(e){}
      if (t === 'dark') document.documentElement.setAttribute('data-theme','dark');
      var b = document.getElementById('btnTema');
      function pintar(){ b.textContent = document.documentElement.getAttribute('data-theme')==='dark' ? '☀️' : '🌙'; }
      b.onclick = function(){ var d = document.documentElement.getAttribute('data-theme')==='dark'; if (d) document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme','dark'); try { localStorage.setItem('bs_tema', d ? 'light' : 'dark'); } catch(e){} pintar(); };
      pintar();
    })();

    // ===== CONFIRMACIÓN DE IDENTIDAD (computadoras compartidas) =====
    (function () {
      try {
        if (sessionStorage.getItem('_bsIdentOk') === '1') return;
        var ov = document.createElement('div');
        ov.id = '_bsIdentOv';
        ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,36,64,.92);z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:20px;font-family:inherit;';
        var nom = (user.nombre || user.usuario || '').replace(/[<>"&]/g, '');
        ov.innerHTML = '<div style="background:#fff;color:#0a2463;border-radius:16px;max-width:400px;width:100%;text-align:center;padding:28px 24px;box-shadow:0 20px 60px rgba(0,0,0,.4)">' +
          '<div style="font-size:42px">👤</div>' +
          '<div style="font-size:16.5px;font-weight:800;margin-top:8px">Hay una sesión activa de<br>' + nom + '</div>' +
          '<div style="font-size:13px;color:#475569;margin-top:6px">Si esta computadora es compartida, confírmanos que eres tú.</div>' +
          '<div style="display:flex;gap:10px;margin-top:18px">' +
          '<button id="_bsIdentSi" style="flex:1;background:#16a34a;color:#fff;border:none;border-radius:10px;padding:12px;font-weight:800;font-size:13.5px;cursor:pointer">✅ Sí, soy yo</button>' +
          '<button id="_bsIdentNo" style="flex:1;background:#dc2626;color:#fff;border:none;border-radius:10px;padding:12px;font-weight:800;font-size:13.5px;cursor:pointer">No soy yo</button>' +
          '</div></div>';
        var poner = function () { document.body.appendChild(ov);
          document.getElementById('_bsIdentSi').onclick = function () { try { sessionStorage.setItem('_bsIdentOk', '1'); } catch (e) {} if (ov.parentNode) ov.parentNode.removeChild(ov); };
          document.getElementById('_bsIdentNo').onclick = function () {
            try { localStorage.removeItem('bienestarSocialAuth'); Object.keys(localStorage).forEach(function (k) { if (k.indexOf('bs_cache_') === 0) localStorage.removeItem(k); }); sessionStorage.clear(); } catch (e) {}
            window.location.href = 'index.html';
          };
        };
        if (document.body) poner(); else document.addEventListener('DOMContentLoaded', poner);
      } catch (e) {}
    })();

    // ===== UI: datos del user =====
    document.getElementById('userName').textContent = user.nombre || user.usuario;

    // ===== SALUDO PERSONALIZADO + GÉNERO (~90%) =====
    function _sinTilde(s){ return (s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase(); }
    function generoPorNombre(nombre){
      var p = _sinTilde(String(nombre||'').trim().split(/\s+/)[0]);
      if(!p) return 'M';
      var F = ['carmen','beatriz','isabel','raquel','ruth','ester','esther','abigail','soledad','flor','pilar','mercedes','dolores','consuelo','rosario','luz','noemi','magali','jackeline','ines','lourdes','maribel','yudith','judith','nancy','ingrid','damaris','elizabeth','janet','janeth','madeleine','katherine','katerin','yobana','yobany','miriam','mirian','fanny','deysi','deisy','maricel','yoselin','yoseline'];
      var M = ['jose','joshua','elias','isaias','tobias','matias','nicolas','andres','jesus','ismael','daniel','joel','manuel','miguel','angel','rafael','gabriel','ariel','uriel','abel','noe','ivan','adan','aldair','yeltsin','jhon','john','luca'];
      if(F.indexOf(p)>=0) return 'F';
      if(M.indexOf(p)>=0) return 'M';
      if(/a$/.test(p)) return 'F';
      if(/(o|or|el|an|in|on|us|er)$/.test(p)) return 'M';
      return 'M';
    }
    (function(){
      var full = user.nombre || user.usuario || '';
      var first = full.trim().split(/\s+/)[0] || full;
      first = first.charAt(0).toUpperCase()+first.slice(1).toLowerCase();
      var g = generoPorNombre(full);
      var bienv = (g==='F') ? 'Bienvenida' : 'Bienvenido';
      var h = new Date().getHours(); var sal = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
      document.getElementById('proTitulo').innerHTML = sal + ', <span class="nm" id="proNombre"></span>';
      document.getElementById('proNombre').textContent = first;
      document.getElementById('proSaludo').innerHTML = 'Te saluda Joel. '+bienv+' al <b>Sistema de Bienestar Social</b>. Estoy para apoyarte en lo que necesites.';
      try{ var f = new Date().toLocaleDateString('es-PE',{weekday:'long',year:'numeric',month:'long',day:'numeric'}); document.getElementById('proFecha').textContent = f.charAt(0).toUpperCase()+f.slice(1); }catch(e){}
    })();

    // ===== ICONOS SVG POR MÓDULO =====
    var ICONS = {
      ficha:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/><path d="M17 11l1.5 1.5L21 10"/>',
      descansos:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M12 9v6M9 12h6"/>',
      sugerencias:'<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V17h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2Z"/>',
      quejas:'<rect x="6" y="4" width="12" height="18" rx="2"/><path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1M9 10h6M9 14h6M9 18h4"/>',
      accidentes:'<path d="M12 2v6M9 5h6"/><rect x="4" y="8" width="16" height="13" rx="2"/><path d="M12 12v5M9.5 14.5h5"/>',
      hostigamiento:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3M12 15v3"/>',
      subsidios:'<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5a2.5 2 0 0 1 2.5-1.5c1.4 0 2.5.7 2.5 1.6S15.4 11 12 12s-2.5.6-2.5 1.6.9 1.6 2.5 1.6a2.5 2 0 0 0 2.5-1.5"/>',
      rendiciones:'<path d="M6 2h12v20l-2-1.5L14 22l-2-1.5L10 22l-2-1.5L6 22V2Z"/><path d="M9 7h6M9 11h6M9 15h4"/>',
      panel:'<path d="M4 20h16"/><rect x="5" y="11" width="3" height="7"/><rect x="10.5" y="7" width="3" height="11"/><rect x="16" y="4" width="3" height="14"/>',
      estadisticas:'<path d="M4 20h16M6 15l4-4 3 2 5-6"/><circle cx="6" cy="15" r="1.2"/><circle cx="10" cy="11" r="1.2"/><circle cx="13" cy="13" r="1.2"/><circle cx="18" cy="7" r="1.2"/>',
      auditoria:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'
    };
    // KPIs por módulo: [etiqueta1, etiqueta2]. Los valores se llenan con datos reales.
    var KPI_LABELS = {
      sugerencias:['Recibidas','En proceso'],
      quejas:['Casos totales','% Resueltas'],
      accidentes:['En seguimiento','Cerrados'],
      hostigamiento:['Denuncias','Confidencial'],
      subsidios:['Trámites totales','S/ Recuperado'],
      rendiciones:['Monto total','Pendientes']
    };

    // ===== MÓDULOS ===== (misma configuración; solo cambia la presentación)
    const MODULOS = [
      { id: 'ficha', permiso: null, url: 'modulos/ficha.html', title: 'Ficha del Trabajador', desc: 'Todo el historial de un trabajador por DNI: contrato, accidentes, subsidios, casos y documentos.', icon: '👤', color: '#0033A0', siempre: true },
      { id: 'sugerencias', permiso: null, url: 'modulos/sugerencias.html', title: 'Sugerencias de Mejora', desc: 'Propon mejoras del sistema y dale seguimiento.', icon: '💡', color: '#0a2463', confidencial: false, siempre: true },
      { id: 'quejas', permiso: 'quejas', url: 'modulos/quejas.html', title: 'Quejas y Sugerencias', desc: 'Registro y seguimiento de quejas, reclamos y sugerencias del personal.', icon: '📋', color: 'var(--bs-mod-quejas)' },
      { id: 'accidentes', permiso: 'accidentes', url: 'modulos/accidentes.html', title: 'Accidentes Laborales', desc: 'Reporte y seguimiento de accidentes laborales con seguimientos médicos.', icon: '🩺', color: 'var(--bs-mod-accidentes)' },
      { id: 'hostigamiento', permiso: 'hostigamiento', url: 'modulos/hostigamiento.html', title: 'Hostigamiento Sexual', desc: 'Denuncias por hostigamiento sexual. Acceso restringido (Ley 29733).', icon: '🔒', color: 'var(--bs-mod-hostigamiento)', confidencial: true },
      { id: 'descansos', permiso: 'descansos', url: 'modulos/descansos.html', title: 'Descansos Médicos', desc: 'CITT, acumulado anual por trabajador y pase automático a Subsidios.', icon: '🏥', color: '#be185d' },
      { id: 'subsidios', permiso: 'subsidios', url: 'modulos/subsidios.html', title: 'Subsidios', desc: 'Gestión de subsidios RAPEL y VERFRUT (incapacidad, maternidad, etc.).', icon: '💰', color: 'var(--bs-mod-subsidios)' },
      { id: 'rendiciones', permiso: 'rendiciones', url: 'modulos/rendiciones.html', title: 'Rendiciones', desc: 'Rendiciones de gastos RAPEL y VERFRUT por categoría y control de depósito.', icon: '📑', color: '#059669' },
      { id: 'panel', permiso: 'panel', url: 'panel.html', title: 'Panel / Dashboard', desc: 'Resumen consolidado de todos los modulos (KPIs y graficos).', icon: '📊', color: '#16a34a' },
      { id: 'estadisticas', adminOnly: true, permiso: 'estadisticas', url: 'modulos/estadisticas.html', title: 'Estadísticas Empresariales', desc: 'Indicadores y cumplimiento de todos los módulos. Solo gerencia.', icon: '📈', color: '#0a2463' },
      { id: 'auditoria', adminOnly: true, permiso: 'auditoria', url: 'modulos/auditoria.html', title: 'Auditoría', desc: 'Registro de quién hizo qué y cuándo en todos los módulos.', icon: '🕘', color: '#334155' }
    ];

    function modulosVisibles(){
      const ADMINS = ['jtimoteo','ovilela'];
      const isAdmin = ADMINS.indexOf((user.usuario || '').toLowerCase()) >= 0 || /admin|geren/i.test((user && user.rol) || '');
      return MODULOS.filter(function(m) { return !m.adminOnly || isAdmin || (m.permiso && user.permisos && user.permisos[m.permiso]); }).map(function(m){
        return Object.assign({}, m, { tienePermiso: m.adminOnly ? true : (m.siempre === true || isAdmin || (user.permisos && user.permisos[m.permiso])) });
      });
    }

    function renderModules() {
      const grid = document.getElementById('moduleGrid');
      var lista = modulosVisibles();
      const html = lista.map(function(m) {
        const offClass = m.tienePermiso ? '' : 'pro-off';
        const onclick = m.tienePermiso ? 'onclick="window.location.href=\'' + m.url + '\'"' : '';
        var badge = '';
        if (!m.tienePermiso) badge = '<span class="pro-badge lock">❌ Sin acceso</span>';
        else if (m.confidencial) badge = '<span class="pro-badge conf">🔐 Confidencial</span>';
        var svg = ICONS[m.id] || '';
        var iconHtml = svg ? '<div class="pro-ic" style="--mc:'+m.color+'"><svg viewBox="0 0 24 24">'+svg+'</svg></div>' : '<div class="pro-ic" style="--mc:'+m.color+'">'+m.icon+'</div>';
        var foot = '';
        if (m.tienePermiso && KPI_LABELS[m.id]) {
          var L = KPI_LABELS[m.id];
          foot = '<div class="pro-kpis">' +
                   '<div class="pro-kpi"><span class="kn" id="kpi_'+m.id+'_1">—</span><span class="kl">'+L[0]+'</span></div>' +
                   '<div class="pro-kpi"><span class="kn" id="kpi_'+m.id+'_2">—</span><span class="kl">'+L[1]+'</span></div>' +
                 '</div>';
        } else if (m.tienePermiso) {
          foot = '<div class="pro-open" style="--mc:'+m.color+'">Abrir →</div>';
        }
        return '<div class="pro-card ' + offClass + '" data-id="'+m.id+'" data-title="'+m.title.toLowerCase()+'" style="--mc:'+m.color+'" ' + onclick + '>' +
            '<span class="strip"></span>' + badge + iconHtml + '<h3>' + m.title + '</h3><p>' + m.desc + '</p>' + foot + '</div>';
      }).join('');
      grid.innerHTML = html;
      document.getElementById('modCount').textContent = lista.filter(function(m){ return m.tienePermiso; }).length + ' disponibles';
      // Acceso rápido en la barra lateral
      document.getElementById('sideNav').innerHTML = lista.map(function(m){
        var svg = ICONS[m.id] || '';
        return '<a class="nav'+(m.tienePermiso?'':' off')+'" '+(m.tienePermiso?'href="'+m.url+'"':'')+' style="--mc:'+m.color+'"><span class="ic">'+(svg?'<svg viewBox="0 0 24 24">'+svg+'</svg>':m.icon)+'</span>'+m.title+'</a>';
      }).join('');
      paintKPIs();
    }
    renderModules();

    // ===== BUSCADOR DE MÓDULOS (/ para enfocar, Enter abre el primero) =====
    (function(){
      var q = document.getElementById('q');
      q.addEventListener('input', function(){
        var v = q.value.toLowerCase().trim(); var first = null;
        document.querySelectorAll('.pro-card').forEach(function(c){
          var hit = v && c.dataset.title.indexOf(v) >= 0 && !c.classList.contains('pro-off');
          c.classList.toggle('hit', hit); c.style.display = (!v || c.dataset.title.indexOf(v) >= 0) ? '' : 'none';
          if (hit && !first) first = c;
        });
      });
      q.addEventListener('keydown', function(e){ if (e.key === 'Enter') { var f = document.querySelector('.pro-card.hit'); if (f) f.click(); } if (e.key === 'Escape') { q.value=''; q.dispatchEvent(new Event('input')); q.blur(); } });
      document.addEventListener('keydown', function(e){ if (e.key === '/' && document.activeElement !== q && !/input|textarea/i.test(document.activeElement.tagName)) { e.preventDefault(); q.focus(); } });
    })();

    // ===== FILTRO DE EMPRESA (afecta la lista de alertas) =====
    var EMP = '';
    document.getElementById('emp').addEventListener('click', function(e){
      var b = e.target.closest('.pill'); if (!b) return;
      document.querySelectorAll('#emp .pill').forEach(function(x){ x.classList.toggle('on', x === b); });
      EMP = b.dataset.e; renderAtrasos(ATRASOS, {});
      toast(EMP ? 'Alertas de ' + EMP : 'Alertas de ambas empresas');
    });
    var _tt; function toast(m){ var t = document.getElementById('toast'); t.textContent = m; t.classList.add('show'); clearTimeout(_tt); _tt = setTimeout(function(){ t.classList.remove('show'); }, 1400); }

    // ===== MINI-KPIs REALES + CHIPS =====
    var KPI_DATA = null;
    function fmtMonto(n){ n = Number(n)||0; return 'S/ ' + n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
    function setTxt(id,v){ var el=document.getElementById(id); if(el) el.textContent=v; }

    function paintKPIs(){
      if(!KPI_DATA) return;
      var d = KPI_DATA;
      if(d.quejas){ setTxt('kpi_quejas_1', d.quejas.total||0); setTxt('kpi_quejas_2', (d.quejas.total? Math.round((d.quejas.resueltas||0)*100/d.quejas.total):0)+'%'); }
      if(d.accidentes){ setTxt('kpi_accidentes_1', d.accidentes.enSeguimiento||0); setTxt('kpi_accidentes_2', d.accidentes.cerrados||0); }
      if(d.hostigamiento){ setTxt('kpi_hostigamiento_1', d.hostigamiento.total||0); setTxt('kpi_hostigamiento_2', '—'); }
      if(d.subsidios){ setTxt('kpi_subsidios_1', (d.subsidios.total||0).toLocaleString('es-PE')); setTxt('kpi_subsidios_2', fmtMonto(d.subsidios.recuperadoEssalud)); }
      if(d.rendiciones){ setTxt('kpi_rendiciones_1', fmtMonto(d.rendiciones.monto_total)); setTxt('kpi_rendiciones_2', d.rendiciones.pendientes||0); }
      if(d.sugerencias){ setTxt('kpi_sugerencias_1', d.sugerencias.recibidas||0); setTxt('kpi_sugerencias_2', d.sugerencias.enProceso||0); }
      var chips = [];
      if(d.accidentes) chips.push(['#dc2626', d.accidentes.enSeguimiento||0, 'accidentes activos']);
      if(d.quejas)     chips.push(['#e08e0b', d.quejas.pendientes||0, 'hallazgos pendientes']);
      if(d.rendiciones)chips.push(['#16a34a', d.rendiciones.pendientes||0, 'rendiciones pendientes']);
      if(d.subsidios)  chips.push(['#0891b2', (d.subsidios.enTramite!=null?d.subsidios.enTramite:(d.subsidios.total||0)), 'subsidios por cobrar']);
      var cw = document.getElementById('proChips');
      if(cw){ cw.innerHTML = chips.map(function(c){ return '<div class="pro-chip"><b>'+c[1]+'</b><span class="l"><span class="dot" style="background:'+c[0]+'"></span>'+c[2]+'</span></div>'; }).join(''); }
      setSync(true);
    }
    function setSync(ok){ var d=document.getElementById('syncDot'), t=document.getElementById('syncTxt'); d.style.background = ok ? 'var(--p-ok)' : 'var(--p-warn)'; t.textContent = ok ? 'Sincronizado · ' + new Date().toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'}) : 'Sin conexión'; }
    window.addEventListener('offline', function(){ setSync(false); });
    window.addEventListener('online', function(){ refrescarKPIs(); });

    function fetchKPIs(){
      var permisos = user.permisos || {};
      Promise.all([
        bsApi('bs_dashboard', { permisos: permisos }).catch(function(){ return {ok:false}; }),
        bsApi('bs_reporteRendiciones', { filtros:{} }).catch(function(){ return {ok:false}; }),
        bsApi('bs_listarSugerencias', { filtros:{} }).catch(function(){ return {ok:false}; }),
        bsApi('bs_listarSubsidios', {}).catch(function(){ return {ok:false}; })
      ]).then(function(r){
        var dash=r[0]||{}, rend=r[1]||{}, sug=r[2]||{}, subs=r[3]||{};
        KPI_DATA = { quejas: dash.quejas, accidentes: dash.accidentes, hostigamiento: dash.hostigamiento, subsidios: dash.subsidios };
        if(rend && rend.ok){ KPI_DATA.rendiciones = { monto_total: rend.monto_total||0, pendientes: (rend.pendiente&&rend.pendiente.n)||0 }; }
        if(subs && subs.ok && subs.items){
          var _num=function(v){ var n=parseFloat(String(v==null?'':v).replace(/[^0-9.\-]/g,'')); return isNaN(n)?0:n; };
          var _monto=function(x){ var v=_num(x.monto_total); if(!v) v=_num(x.pago_empresa)+_num(x.recuperado_essalud); if(!v) v=_num(x.calculo_por_dia)*(parseInt(x.dias)||0); return v; };
          var _rec=0,_tram=0;
          subs.items.forEach(function(x){ var e=String(x.estado_general||'').trim().toUpperCase(); if(e==='COBRADO'||e==='RECUPERADO') _rec+=_monto(x); else if(e!=='NO RECUPERABLE') _tram++; });
          KPI_DATA.subsidios = { total: subs.items.length, recuperadoEssalud: _rec, enTramite: _tram };
        }
        if(sug && sug.ok && sug.items){
          var rec = sug.items.length;
          var enP = sug.items.filter(function(s){ return String(s.estado||'').toLowerCase()!=='finalizada'; }).length;
          KPI_DATA.sugerencias = { recibidas: rec, enProceso: enP };
        }
        paintKPIs();
      }).catch(function(){ setSync(false); });
    }
    fetchKPIs();

    // ── REFRESCO AUTOMÁTICO ──
    var _kpiUltimo = Date.now();
    function refrescarKPIs(){ _kpiUltimo = Date.now(); try { fetchKPIs(); } catch(e) {} try { cargarAtrasos(); } catch(e) {} }
    setInterval(function(){ if(!document.hidden) refrescarKPIs(); }, 3*60*1000);
    document.addEventListener('visibilitychange', function(){ if(!document.hidden && (Date.now()-_kpiUltimo) > 20*1000) refrescarKPIs(); });
    window.addEventListener('pageshow', function(e){ if(e && e.persisted) refrescarKPIs(); });

    // ===== SINCRONIZAR PERMISOS DESDE LA HOJA USUARIOS =====
    (function(){
      bsApi('bs_permisosUsuario', { usuario: user.usuario })
      .then(function(res){
        if (res && res.ok && res.permisos) {
          user.permisos = res.permisos;
          if (!user.rol && res.rol) user.rol = res.rol;
          if (!user.nombre && res.nombre) user.nombre = res.nombre;
          try { localStorage.setItem('bienestarSocialAuth', JSON.stringify(user)); } catch(e) {}
          renderModules(); cargarAtrasos();
        }
      })
      .catch(function(e){ console.warn('[permisos] No se pudo sincronizar:', e); });
    })();

    // ===== ALERTAS DE ATRASOS (bs_alertas) + ENVÍO DE REPORTE =====
    var ATRASOS = [];
    function escHtml(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }

    function cargarAtrasos(){
      bsApi('bs_alertas', { permisos: user.permisos || {} }).then(function(d){
        if(!d || !d.ok) return;
        var al = (d.alertas || []).filter(function(a){ return a.estado==='rojo' || a.estado==='ambar'; });
        ATRASOS = al;
        renderAtrasos(al, d.resumen || {});
      }).catch(function(e){ console.warn('[atrasos] No se pudieron cargar:', e); });
    }

    function renderAtrasos(todas, resumen){
      var al = todas.filter(function(a){ return !EMP || String(a.empresa||'').toUpperCase().indexOf(EMP) >= 0; });
      var box = document.getElementById('proAtrasos'), ok = document.getElementById('atrOk');
      var bell = document.getElementById('atrBell'), bellN = document.getElementById('atrBellN');
      var navN = document.getElementById('navAlertasN');
      if(!al.length){ box.classList.remove('visible'); ok.style.display=''; bell.classList.remove('visible'); navN.style.display='none'; return; }
      ok.style.display='none';
      var rojos = al.filter(function(a){ return a.estado==='rojo'; }).length;
      var ambar = al.length - rojos;
      document.getElementById('atrTitulo').textContent = rojos>0 ? '🚨 Atrasos: requieren reporte' : '⏳ Casos por vencer';
      var cr = document.getElementById('atrChipRojo'), ca = document.getElementById('atrChipAmbar');
      cr.style.display = rojos>0 ? '' : 'none'; ca.style.display = ambar>0 ? '' : 'none';
      cr.textContent = rojos + ' vencido' + (rojos===1?'':'s'); ca.textContent = ambar + ' por vencer';
      al.sort(function(a,b){ if(a.estado!==b.estado) return a.estado==='rojo' ? -1 : 1; return (a.diasRestantes||0) - (b.diasRestantes||0); });
      document.getElementById('atrLista').innerHTML = al.map(function(a){
        var dr = Number(a.diasRestantes||0);
        var diasTxt = dr < 0 ? (Math.abs(dr)+' día'+(Math.abs(dr)===1?'':'s')+' de atraso') : (dr===0 ? 'vence HOY' : 'vence en '+dr+' día'+(dr===1?'':'s'));
        var desc = String(a.descripcion||'').replace(/\s*·\s*_+\s*$/,'').trim() + (a.id!=null&&String(a.id).trim()!==''?' #'+String(a.id).trim():'');
        return '<div class="atr-item '+a.estado+'"><span class="mod">'+escHtml(a.modulo)+(a.empresa?' · '+escHtml(a.empresa):'')+'</span><span class="tx">'+escHtml(desc)+'</span>'+(a.fechaLimite?'<span class="meta">Límite: '+escHtml(a.fechaLimite)+'</span>':'')+'<span class="dias '+a.estado+'">'+diasTxt+'</span></div>';
      }).join('');
      box.classList.add('visible');
      bell.classList.add('visible'); bellN.textContent = al.length > 99 ? '99+' : al.length; bellN.classList.toggle('ambar', rojos===0);
      navN.style.display=''; navN.textContent = al.length > 99 ? '99+' : al.length;
      mostrarToastAtrasos(rojos, ambar);
    }

    function irAAtrasos(){ var box = document.getElementById('alertas'); if(box) box.scrollIntoView({behavior:'smooth', block:'start'}); }

    function mostrarToastAtrasos(rojos, ambar){
      try { if(sessionStorage.getItem('bsToastAtrasos')) return; } catch(e){}
      var partes = [];
      if(rojos>0) partes.push('<b>'+rojos+' caso'+(rojos===1?'':'s')+' vencido'+(rojos===1?'':'s')+'</b>');
      if(ambar>0) partes.push('<b>'+ambar+' por vencer</b>');
      if(!partes.length) return;
      var t = document.createElement('div');
      t.className = 'atr-toast' + (rojos===0 ? ' ambar' : '');
      t.innerHTML = '<span class="ico">'+(rojos>0?'🚨':'⏳')+'</span><span style="flex:1;"><p class="tt">'+(rojos>0?'¡Atención! Hay atrasos pendientes':'Casos próximos a vencer')+'</p><p class="tx">Tienes '+partes.join(' y ')+'. No olvides enviar tu reporte de atrasos.</p><span class="cta">Ver alertas y enviar reporte →</span></span><button class="x" title="Cerrar">✕</button>';
      t.addEventListener('click', function(ev){ if(ev.target.classList.contains('x')){ cerrar(); return; } cerrar(); irAAtrasos(); });
      function cerrar(){ t.classList.remove('visible'); setTimeout(function(){ t.remove(); }, 450); }
      document.body.appendChild(t);
      requestAnimationFrame(function(){ requestAnimationFrame(function(){ t.classList.add('visible'); }); });
      setTimeout(cerrar, 12000);
      try { sessionStorage.setItem('bsToastAtrasos','1'); } catch(e){}
    }

    function textoReporteAtrasos(){
      var hoy = new Date().toLocaleDateString('es-PE',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
      var base = ATRASOS.filter(function(a){ return !EMP || String(a.empresa||'').toUpperCase().indexOf(EMP) >= 0; });
      var rojos = base.filter(function(a){ return a.estado==='rojo'; });
      var ambar = base.filter(function(a){ return a.estado==='ambar'; });
      var L = [];
      L.push('🚨 *REPORTE DE ATRASOS · BIENESTAR SOCIAL*' + (EMP ? ' · ' + EMP : ''));
      L.push('📅 ' + hoy.charAt(0).toUpperCase() + hoy.slice(1));
      L.push('👤 Generado por: ' + (user.nombre || user.usuario));
      L.push('');
      if(rojos.length){
        L.push('⛔ *VENCIDOS (' + rojos.length + '):*');
        rojos.forEach(function(a,i){ L.push((i+1)+'. ['+a.modulo+'] '+a.descripcion+(a.fechaLimite?' — venció '+a.fechaLimite:'')+' ('+Math.abs(a.diasRestantes||0)+' días de atraso)'+(a.empresa?' · '+a.empresa:'')); });
        L.push('');
      }
      if(ambar.length){
        L.push('⏳ *POR VENCER (' + ambar.length + '):*');
        ambar.forEach(function(a,i){ var dr = Number(a.diasRestantes||0); L.push((i+1)+'. ['+a.modulo+'] '+a.descripcion+(a.fechaLimite?' — vence '+a.fechaLimite:'')+' ('+(dr===0?'HOY':'en '+dr+' días')+')'+(a.empresa?' · '+a.empresa:'')); });
        L.push('');
      }
      L.push('— Sistema de Bienestar Social · RR.LL. · Unifrutti Group');
      return L.join('\n');
    }

    function enviarReporteAtrasos(medio){
      if(!ATRASOS.length){ (window.appAlert||alert)('No hay atrasos que reportar. ✅'); return; }
      var txt = textoReporteAtrasos();
      if(medio==='whatsapp'){ window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank'); }
      else if(medio==='correo'){ var asunto = '🚨 Reporte de Atrasos · Bienestar Social · ' + new Date().toLocaleDateString('es-PE'); window.location.href = 'mailto:?subject=' + encodeURIComponent(asunto) + '&body=' + encodeURIComponent(txt.replace(/\*/g,'')); }
      else { (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function(){ (window.appAlert||alert)('📋 Reporte copiado al portapapeles.'); }).catch(function(){ window.prompt('Copia el reporte:', txt); }); }
    }
    cargarAtrasos();

    // ===== LOGOUT =====
    async function logout() {
      if (await appConfirm('¿Cerrar sesión?')) {
        localStorage.removeItem('bienestarSocialAuth'); try { Object.keys(localStorage).forEach(function(k){ if (k.indexOf('bs_cache_') === 0) localStorage.removeItem(k); }); Object.keys(sessionStorage).forEach(function(k){ if (k.indexOf('bs_cache_') === 0) sessionStorage.removeItem(k); }); } catch(e){}
        window.location.href = 'index.html';
      }
    }
    // Cerrar menú lateral al navegar en móvil
    document.getElementById('side').addEventListener('click', function(e){ if (e.target.closest('a')) document.getElementById('side').classList.remove('open'); });
  