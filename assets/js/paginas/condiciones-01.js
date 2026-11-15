/* Bienestar Social · modulos/condiciones.html · _BS_GESTION_SOCIAL_V4 (15-nov-2026)
   Gestión Social, etapa 4: visitas de condiciones en campo + índice por fundo. Supabase vía bs-guardar-supabase.js:
   bs_listarVisitas, bs_crearVisita, bs_actualizarVisita, bs_anularRegistro / bs_restaurarRegistro (modulo 'gestion_social', clave 'bs_gs_visitas').
   El puntaje lo calcula el servidor con las respuestas y los PESOS de este catálogo; aquí solo se previsualiza. */
(function () {
  'use strict';
  var session = localStorage.getItem('bienestarSocialAuth');
  if (!session) { window.location.href = '../index.html'; return; }
  var user; try { user = JSON.parse(session); if (!user || !user.usuario) throw new Error(); } catch (e) { window.location.href = '../index.html'; return; }
  var esAdmin = /admin|geren/i.test(user.rol || '') || user.esAdminRL === true || ['jtimoteo'].indexOf((user.usuario || '').toLowerCase()) >= 0;
  document.getElementById('userName').textContent = user.nombre || user.usuario;
  async function verificarAcceso() {
    if (esAdmin || (user.permisos && user.permisos.gestion_social)) return true;
    var rl = null; try { rl = window.bsPermisosRL ? await window.bsPermisosRL() : null; } catch (e) { rl = null; }
    if (rl && rl.ok && (rl.esAdmin || (rl.permisos && rl.permisos.gestion_social))) { user.permisos = Object.assign({}, user.permisos || {}, rl.permisos || {}); if (rl.esAdmin) { user.esAdminRL = true; esAdmin = true; } try { localStorage.setItem('bienestarSocialAuth', JSON.stringify(user)); } catch (e) {} return true; }
    return false;
  }

  /* ===== CATÁLOGO DEL CHECKLIST (cambiar aquí; el servidor usa estos pesos al guardar) =====
     peso 2 = ítems con base directa en norma de seguridad/vida (criterio por defecto; Joel puede ajustar) */
  var ITEMS = [
    { k: 'agua', t: 'Agua potable disponible, fresca y suficiente en el frente de trabajo', b: 'Ley 29783 · D.S. 005-2012-TR · RM 375-2008-TR (hidratación)', p: 2 },
    { k: 'sshh', t: 'SS.HH. suficientes, limpios, con agua y papel, separados por sexo', b: 'D.S. 005-2012-TR · Norma A.130 / IS.010', p: 2 },
    { k: 'sombra', t: 'Área de descanso con sombra y refrigerio respetado', b: 'Ley 31110 · RM 375-2008-TR', p: 1 },
    { k: 'comedor', t: 'Comedor en condiciones higiénicas (mesas, lavado de manos, residuos)', b: 'D.S. 005-2012-TR', p: 1 },
    { k: 'epp', t: 'EPP entregado, en buen estado y en uso según la labor', b: 'Ley 29783 art. 60 · D.S. 005-2012-TR', p: 2 },
    { k: 'agroq', t: 'Agroquímicos: señalización, periodo de reingreso, lavado y almacén cerrado', b: 'D.S. 015-2005-SA · D.S. 001-2015-MINAGRI', p: 2 },
    { k: 'botiquin', t: 'Botiquín completo y plan de emergencia / persona capacitada en primeros auxilios', b: 'Ley 29783 · RM 050-2013-TR', p: 1 },
    { k: 'transporte', t: 'Transporte de personal seguro: unidades autorizadas, asientos, sin exceso', b: 'D.S. 017-2009-MTC · Ley 29783', p: 1 },
    { k: 'jornada', t: 'Jornada y pausas: no excede lo pactado, pausas registradas', b: 'D.S. 007-2002-TR · Ley 31110', p: 1 },
    { k: 'trato', t: 'Trato respetuoso, sin discriminación ni menores de edad trabajando', b: 'Ley 30364 · Ley 27942 · D.S. 003-2010-MIMDES', p: 2 },
    { k: 'gestantes', t: 'Gestantes y lactantes sin labores de riesgo y con hora de lactancia', b: 'Ley 28048 · Ley 27240', p: 1 },
    { k: 'comunicacion', t: 'Buzón QR / avisos de Bienestar visibles y supervisor conoce el canal', b: 'Política interna', p: 1 }
  ];
  var PESOS = {}; ITEMS.forEach(function (i) { PESOS[i.k] = i.p; });
  var DATA = [], TAB = 'indice';
  var $ = function (id) { return document.getElementById(id); };
  var hoy = function () { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  var ymd = function (v) { if (!v) return ''; var m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[1] + '-' + m[2] + '-' + m[3] : ''; };
  var fecha = function (v) { var y = ymd(v); return y ? y.split('-').reverse().join('/') : '—'; };
  var dias = function (a, b) { a = ymd(a); b = ymd(b || hoy()); if (!a || !b) return 0; return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000); };
  var anulado = function (r) { return String(r.anulado || '').trim() !== ''; };
  var num = function (v) { var n = Number(v); return isNaN(n) ? 0 : n; };
  var resp = function (r) { try { var o = JSON.parse(r.respuestas || '{}') || {}; delete o._pesos; return o; } catch (e) { return {}; } };
  var clase = function (p) { return p >= 85 ? 'v' : p >= 70 ? 'a' : 'r'; };
  var score = function (p) { return '<span class="gs-score ' + clase(p) + '">' + (Math.round(p * 10) / 10) + '</span>'; };
  var pill = function (e) { return '<span class="gs-pill ' + String(e || '').toLowerCase().replace(/[^a-z]/g, '') + '">' + esc(e || '') + '</span>'; };
  var col = function (p) { return p >= 85 ? '#16a34a' : p >= 70 ? '#d97706' : '#dc2626'; };
  (function () { var s = $('fAnio'); var y = new Date().getFullYear(); s.add(new Option('Todos', '')); for (var a = y + 1; a >= 2026; a--) s.add(new Option(String(a), String(a))); s.value = String(y); })();

  async function cargar() {
    $('p-indice').innerHTML = '<div class="bs-text-center" style="padding:2rem"><div class="bs-spinner bs-spinner-dark" style="margin:0 auto"></div></div>';
    try {
      var r = await api('bs_listarVisitas', {});
      if (!r || !r.ok) { $('p-indice').innerHTML = '<div class="bs-alert bs-alert-danger"><strong>No se pudo leer de Supabase:</strong> ' + esc((r && r.message) || 'sin respuesta') + '</div>'; return; }
      DATA = r.items || [];
      var fundos = {}; DATA.forEach(function (x) { if (x.fundo) fundos[String(x.fundo).trim()] = 1; });
      var ks = Object.keys(fundos).sort(), s = $('fFundo'), cur = s.value; s.innerHTML = '<option value="">Todos</option>' + ks.map(function (f) { return '<option>' + esc(f) + '</option>'; }).join(''); s.value = cur;
      $('dlFundos').innerHTML = ks.map(function (f) { return '<option value="' + esc(f) + '">'; }).join('');
      render();
    } catch (e) { $('p-indice').innerHTML = '<div class="bs-alert bs-alert-danger">Error: ' + esc(e.message) + '</div>'; }
  }
  function filtrados() {
    var fE = $('fEmpresa').value, fF = $('fFundo').value, fS = $('fEstado').value, fA = $('fAnio').value, verAn = $('fAnulados').checked;
    return DATA.filter(function (r) {
      if (!verAn && anulado(r)) return false;
      if (fE && r.empresa !== fE) return false; if (fF && String(r.fundo || '').trim() !== fF) return false; if (fS && r.estado !== fS) return false; if (fA && ymd(r.fecha).slice(0, 4) !== fA) return false;
      return true;
    }).sort(function (a, b) { return (ymd(b.fecha) + String(b.id).padStart(6, '0')) < (ymd(a.fecha) + String(a.id).padStart(6, '0')) ? -1 : 1; });
  }
  /* índice por fundo: última visita (puntaje actual), promedio del periodo, tendencia vs. visita anterior, días desde la última */
  function indice(L) {
    var M = {};
    L.filter(function (r) { return !anulado(r); }).forEach(function (r) { var k = r.empresa + ' · ' + (r.fundo || '').trim(); (M[k] = M[k] || []).push(r); });
    return Object.keys(M).map(function (k) {
      var V = M[k].sort(function (a, b) { return ymd(a.fecha) < ymd(b.fecha) ? 1 : -1; }), ult = V[0], prev = V[1];
      var prom = V.reduce(function (s, r) { return s + num(r.puntaje); }, 0) / V.length;
      var pend = V.filter(function (r) { return r.estado === 'Con pendientes'; }).length;
      return { k: k, empresa: ult.empresa, fundo: ult.fundo, n: V.length, ult: ult, actual: num(ult.puntaje), prom: Math.round(prom * 10) / 10, tend: prev ? num(ult.puntaje) - num(prev.puntaje) : null, dias: dias(ult.fecha), pend: pend };
    }).sort(function (a, b) { return a.actual - b.actual; });
  }
  function render() {
    var L = filtrados(), I = indice(L), V = L.filter(function (r) { return !anulado(r); });
    var prom = V.length ? Math.round(V.reduce(function (s, r) { return s + num(r.puntaje); }, 0) / V.length * 10) / 10 : 0;
    var rojos = I.filter(function (f) { return f.actual < 70; }).length, pend = V.filter(function (r) { return r.estado === 'Con pendientes'; }).length, venc = V.filter(function (r) { return r.estado === 'Con pendientes' && ymd(r.fecha_compromiso) && ymd(r.fecha_compromiso) < hoy(); }).length;
    var card = function (l, v, s, c) { return '<div class="bs-card gs-kpi"><div class="l">' + l + '</div><div class="v" style="color:' + c + '">' + v + '</div><div class="s">' + s + '</div></div>'; };
    $('kpis').innerHTML = card('Puntaje promedio', V.length ? prom : '—', V.length + ' visitas en el periodo', V.length ? col(prom) : '#5b6785') + card('Fundos en rojo', rojos, 'última visita < 70 puntos', rojos ? '#b91c1c' : '#166534') + card('Visitas con pendientes', pend, venc + ' con fecha límite vencida', venc ? '#b91c1c' : (pend ? '#b45309' : '#166534')) + card('Fundos visitados', I.length, 'con al menos una visita', '#0a2463');
    $('nLista').textContent = '(' + L.length + ')';
    /* índice */
    $('p-indice').innerHTML = I.length ? '<div class="bs-table-wrap"><table class="bs-table"><thead><tr><th>Fundo</th><th>Puntaje actual</th><th></th><th>Promedio</th><th>Tendencia</th><th>Última visita</th><th>Visitas</th><th>Pendientes</th></tr></thead><tbody>' + I.map(function (f) {
      return '<tr><td><b>' + esc(f.fundo) + '</b><br><span class="bs-text-xs bs-text-muted">' + esc(f.empresa) + '</span></td><td>' + score(f.actual) + '</td><td><div class="gs-bar"><i style="width:' + Math.max(2, Math.min(100, f.actual)) + '%;background:' + col(f.actual) + '"></i></div></td><td>' + f.prom + '</td>' +
        '<td>' + (f.tend === null ? '<span class="bs-text-muted">primera</span>' : f.tend > 0 ? '<span style="color:#16a34a;font-weight:700">▲ +' + (Math.round(f.tend * 10) / 10) + '</span>' : f.tend < 0 ? '<span style="color:#dc2626;font-weight:700">▼ ' + (Math.round(f.tend * 10) / 10) + '</span>' : '<span class="bs-text-muted">=</span>') + '</td>' +
        '<td>' + fecha(f.ult.fecha) + '<br><span class="bs-text-xs ' + (f.dias > 60 ? '" style="color:#b91c1c;font-weight:700' : 'bs-text-muted') + '">hace ' + f.dias + ' d</span></td><td style="text-align:center">' + f.n + '</td><td>' + (f.pend ? '<b style="color:#b45309">' + f.pend + '</b>' : '0') + ' <button class="bs-btn bs-btn-outline bs-btn-sm" onclick="verCaso(' + Number(f.ult.id) + ')">Última</button></td></tr>';
    }).join('') + '</tbody></table></div><div class="bs-text-xs bs-text-muted" style="margin-top:.5rem">Verde ≥ 85 · Ámbar 70–84 · Rojo &lt; 70. El puntaje pondera cada ítem (×2 los de seguridad/vida) y excluye los marcados N/A.</div>'
      : '<div class="bs-text-center bs-text-muted" style="padding:2rem">Todavía no hay visitas registradas. Registra la primera con <b>＋ Registrar visita</b>.</div>';
    /* lista */
    window.__BS_EXPORT_DATA__ = L.map(function (r) { var o = { Codigo: r.codigo, Fecha: fecha(r.fecha), Empresa: r.empresa, Fundo: r.fundo, Visitante: r.visitante, Personas: r.personas_presentes, Puntaje: r.puntaje, OK: r.items_ok, OBS: r.items_obs, NA: r.items_na, Estado: r.estado, Hallazgos: r.hallazgos, Compromisos: r.compromisos, Responsable: r.responsable_compromiso, FechaLimite: fecha(r.fecha_compromiso) }; var R = resp(r); ITEMS.forEach(function (i) { o[i.k] = R[i.k] || ''; }); return o; });
    $('p-lista').innerHTML = L.length ? '<div class="bs-table-wrap"><table class="bs-table"><thead><tr><th>Código</th><th>Fecha</th><th>Fundo</th><th>Visitante</th><th>Puntaje</th><th>OK / OBS / N/A</th><th>Compromiso</th><th>Estado</th><th></th></tr></thead><tbody>' + L.map(function (r) {
      var an = anulado(r), venc = r.estado === 'Con pendientes' && ymd(r.fecha_compromiso) && ymd(r.fecha_compromiso) < hoy();
      return '<tr' + (an ? ' style="opacity:.55"' : '') + '><td><b>' + esc(r.codigo) + '</b></td><td>' + fecha(r.fecha) + '</td><td><b>' + esc(r.fundo) + '</b><br><span class="bs-text-xs bs-text-muted">' + esc(r.empresa) + '</span></td><td>' + esc(r.visitante) + '</td><td>' + score(num(r.puntaje)) + '</td><td class="bs-text-sm">' + num(r.items_ok) + ' / <b style="color:#b91c1c">' + num(r.items_obs) + '</b> / ' + num(r.items_na) + '</td>' +
        '<td class="bs-text-sm">' + (ymd(r.fecha_compromiso) ? fecha(r.fecha_compromiso) + (venc ? ' <b style="color:#b91c1c">vencido</b>' : '') + '<br><span class="bs-text-xs bs-text-muted">' + esc(r.responsable_compromiso || '') + '</span>' : '—') + '</td><td>' + (an ? '<span class="gs-pill anulado">ANULADA</span>' : pill(r.estado)) + '</td>' +
        '<td style="white-space:nowrap"><button class="bs-btn bs-btn-outline bs-btn-sm" onclick="verCaso(' + Number(r.id) + ')">Ver</button> ' + (an ? (esAdmin ? '<button class="bs-btn bs-btn-outline bs-btn-sm" onclick="restaurar(' + Number(r.id) + ')">Restaurar</button>' : '') : '<button class="bs-btn bs-btn-outline bs-btn-sm" onclick="editar(' + Number(r.id) + ')">Editar</button>') + '</td></tr>';
    }).join('') + '</tbody></table></div>' : '<div class="bs-text-center bs-text-muted" style="padding:2rem">No hay visitas con estos filtros.</div>';
    /* alertas */
    var A = [];
    V.forEach(function (r) { if (r.estado === 'Con pendientes' && ymd(r.fecha_compromiso) && ymd(r.fecha_compromiso) < hoy()) A.push({ n: 'rojo', t: 'Compromiso vencido el ' + fecha(r.fecha_compromiso) + ' (' + esc(r.responsable_compromiso || 'sin responsable') + ')', r: r }); if (num(r.puntaje) < 70 && r.estado !== 'Cerrada') A.push({ n: 'rojo', t: 'Visita con puntaje ' + r.puntaje + ': ' + num(r.items_obs) + ' ítems observados', r: r }); if (r.estado === 'Con pendientes' && !ymd(r.fecha_compromiso)) A.push({ n: 'ambar', t: 'Observaciones sin fecha de compromiso', r: r }); });
    I.forEach(function (f) { if (f.dias > 60) A.push({ n: 'ambar', t: 'Fundo sin visita hace ' + f.dias + ' días', r: f.ult }); });
    var peso = { rojo: 0, ambar: 1, info: 2 }; A.sort(function (x, y) { return peso[x.n] - peso[y.n]; });
    $('nAlertas').textContent = A.length ? '(' + A.length + ')' : '';
    $('p-alertas').innerHTML = A.length ? '<div style="display:flex;flex-direction:column;gap:.5rem">' + A.map(function (a) { return '<div class="gs-alert ' + a.n + '"><div style="flex:1"><div><b>' + esc(a.r.fundo) + '</b> · ' + esc(a.r.empresa) + ' · ' + esc(a.r.codigo) + '</div><div class="bs-text-sm">' + a.t + '</div></div><button class="bs-btn bs-btn-outline bs-btn-sm" onclick="verCaso(' + Number(a.r.id) + ')">Ver</button></div>'; }).join('') + '</div>' : '<div class="bs-text-center bs-text-muted" style="padding:2rem">Sin alertas.</div>';
    /* ítems más observados */
    var C = {}; V.forEach(function (r) { var R = resp(r); ITEMS.forEach(function (i) { if (String(R[i.k]).toUpperCase() === 'OBS') C[i.k] = (C[i.k] || 0) + 1; }); });
    var ks = ITEMS.filter(function (i) { return C[i.k]; }).sort(function (a, b) { return C[b.k] - C[a.k]; });
    $('p-items').innerHTML = ks.length ? '<div class="bs-table-wrap"><table class="bs-table"><thead><tr><th>Ítem</th><th>Veces observado</th><th>% de visitas</th><th>Peso</th></tr></thead><tbody>' + ks.map(function (i) { return '<tr><td><b>' + esc(i.t) + '</b><br><span class="bs-text-xs bs-text-muted">' + esc(i.b) + '</span></td><td>' + C[i.k] + '</td><td>' + Math.round(C[i.k] / V.length * 100) + ' %</td><td>×' + i.p + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="bs-text-center bs-text-muted" style="padding:2rem">Sin ítems observados en el periodo.</div>';
  }

  /* ===== FORMULARIO ===== */
  function pintarChecklist(R) {
    R = R || {};
    $('checklist').innerHTML = ITEMS.map(function (i) {
      var v = String(R[i.k] || '').toUpperCase(), opc = function (o, lbl) { return '<label class="' + o.toLowerCase() + '"><input type="radio" name="it_' + i.k + '" value="' + o + '"' + (v === o ? ' checked' : '') + ' onchange="itemCambio()"><span>' + lbl + '</span></label>'; };
      return '<div class="gs-item ' + v.toLowerCase() + '" id="it_' + i.k + '"><div><div class="t">' + esc(i.t) + (i.p > 1 ? '<span class="peso">×' + i.p + '</span>' : '') + '</div><div class="b">' + esc(i.b) + '</div></div><div class="gs-opc">' + opc('OK', 'OK') + opc('OBS', 'OBS') + opc('NA', 'N/A') + '</div></div>';
    }).join('');
    itemCambio();
  }
  function leerChecklist() { var R = {}; ITEMS.forEach(function (i) { var el = document.querySelector('input[name="it_' + i.k + '"]:checked'); if (el) R[i.k] = el.value; }); return R; }
  function itemCambio() {
    var R = leerChecklist(), num_ = 0, den = 0, falta = 0;
    ITEMS.forEach(function (i) { var r = R[i.k], el = $('it_' + i.k); if (el) el.className = 'gs-item ' + (r ? r.toLowerCase() : ''); if (!r) { falta++; return; } if (r === 'NA') return; den += i.p; if (r === 'OK') num_ += i.p; });
    var sc = $('scorePrev'); if (falta) { sc.className = 'gs-score g'; sc.textContent = 'faltan ' + falta; } else { var p = den ? Math.round(num_ / den * 1000) / 10 : 0; sc.className = 'gs-score ' + clase(p); sc.textContent = p; }
  }
  var CAMPOS = ['fecha', 'empresa', 'sede', 'fundo', 'visitante', 'acompanantes', 'personas_presentes', 'hallazgos', 'compromisos', 'responsable_compromiso', 'fecha_compromiso', 'estado'];
  function limpiar() { CAMPOS.forEach(function (f) { var el = $(f); if (el) el.value = ''; }); $('gsId').value = ''; $('fecha').value = hoy(); $('sede').value = 'PIURA'; $('visitante').value = user.nombre || user.usuario; $('estado').value = ''; pintarChecklist({}); }
  function abrirNuevo() { limpiar(); $('formTitle').textContent = 'Registrar visita'; $('modalGS').classList.add('bs-active'); }
  function editar(id) {
    var x = DATA.find(function (r) { return Number(r.id) === Number(id); }); if (!x) return;
    limpiar(); $('gsId').value = x.id; $('formTitle').textContent = 'Visita ' + x.codigo;
    CAMPOS.forEach(function (f) { var el = $(f); if (!el) return; var v = x[f]; if (/^fecha/.test(f)) v = ymd(v); if (f === 'estado') v = v === 'Cerrada' ? 'Cerrada' : ''; el.value = v == null ? '' : v; });
    pintarChecklist(resp(x)); $('modalGS').classList.add('bs-active');
  }
  function cerrarModal() { $('modalGS').classList.remove('bs-active'); }
  async function guardar(ev) {
    ev.preventDefault();
    var btn = $('btnGuardar'), fin = function () { btn.disabled = false; btn.textContent = '💾 Guardar visita'; }; btn.disabled = true; btn.textContent = 'Guardando…';
    var R = leerChecklist(), falta = ITEMS.filter(function (i) { return !R[i.k]; });
    if (falta.length) { appAlert('Marca todos los ítems del checklist (faltan ' + falta.length + '). Usa N/A si alguno no aplica.'); fin(); return; }
    var d = {}; CAMPOS.forEach(function (f) { var el = $(f); d[f] = el ? String(el.value || '').trim() : ''; });
    d.respuestas = JSON.stringify(Object.assign({ _pesos: PESOS }, R));   /* los pesos viajan y quedan guardados con la visita */
    var obs = ITEMS.filter(function (i) { return R[i.k] === 'OBS'; }).length;
    if (obs && !d.hallazgos) { appAlert('Hay ' + obs + ' ítems observados: describe los hallazgos.'); fin(); return; }
    if (obs && !d.fecha_compromiso && d.estado !== 'Cerrada') { if (!(await appConfirm('Hay observaciones sin fecha de compromiso. ¿Guardar igual? (quedará como alerta)'))) { fin(); return; } }
    try {
      var id = $('gsId').value;
      var r = id ? await api('bs_actualizarVisita', { id: id, datos: d }) : await api('bs_crearVisita', { datos: d });
      if (!r || !r.ok) { appAlert((r && r.message) || 'No se pudo guardar.'); return; }
      cerrarModal(); appAlert(r.message || 'Visita guardada.'); cargar();
    } catch (e) { appAlert('Error: ' + e.message); } finally { fin(); }
  }
  function verCaso(id) {
    var x = DATA.find(function (r) { return Number(r.id) === Number(id); }); if (!x) return;
    var R = resp(x), fila = function (k, v) { return '<div style="display:grid;grid-template-columns:170px 1fr;gap:.3rem .8rem;font-size:.9rem"><span class="bs-text-muted">' + k + '</span><span>' + (v || '—') + '</span></div>'; };
    $('detTitle').textContent = x.codigo + ' · ' + x.fundo;
    $('detBody').innerHTML = '<div class="bs-flex bs-items-center" style="gap:.6rem;flex-wrap:wrap;margin-bottom:.8rem">' + score(num(x.puntaje)) + (anulado(x) ? '<span class="gs-pill anulado">ANULADA</span>' : pill(x.estado)) + '<span class="bs-text-sm bs-text-muted">' + fecha(x.fecha) + ' · ' + esc(x.empresa) + ' · ' + esc(x.sede || '') + ' · ' + esc(x.visitante) + (x.acompanantes ? ' con ' + esc(x.acompanantes) : '') + (num(x.personas_presentes) ? ' · ' + num(x.personas_presentes) + ' personas' : '') + '</span></div>' +
      '<div style="display:flex;flex-direction:column;gap:.3rem">' + ITEMS.map(function (i) { var v = String(R[i.k] || '').toUpperCase(); return '<div class="gs-item ' + v.toLowerCase() + '" style="padding:.4rem .7rem"><div class="t" style="font-weight:500">' + esc(i.t) + '</div><span class="gs-pill ' + (v === 'OK' ? 'registrada' : v === 'OBS' ? 'conpendientes' : 'anulado') + '">' + (v === 'NA' ? 'N/A' : v || '—') + '</span></div>'; }).join('') + '</div>' +
      '<div style="display:flex;flex-direction:column;gap:.3rem;margin-top:.9rem">' + fila('Hallazgos', esc(x.hallazgos || '—')) + fila('Compromisos', esc(x.compromisos || '—')) + fila('Responsable / fecha límite', esc(x.responsable_compromiso || '—') + (ymd(x.fecha_compromiso) ? ' · ' + fecha(x.fecha_compromiso) : '')) + (x.estado === 'Cerrada' ? fila('Cerrada', fecha(x.fecha_cierre)) : '') + fila('Registro', esc(x.created_by || '') + ' · ' + fecha(x.created_at) + (x.updated_by ? ' · últ. cambio ' + esc(x.updated_by) + ' ' + fecha(x.updated_at) : '')) + '</div>' +
      (anulado(x) ? '' : '<div class="bs-flex bs-justify-between" style="margin-top:1rem;gap:.5rem;flex-wrap:wrap"><button type="button" class="bs-btn bs-btn-outline" onclick="window.gsAnular(' + Number(x.id) + ')">Anular visita</button><div class="bs-flex" style="gap:.5rem">' + (x.estado === 'Con pendientes' ? '<button type="button" class="bs-btn bs-btn-outline" onclick="window.cerrarVisita(' + Number(x.id) + ')">✔ Pendientes levantados</button>' : '') + '<button type="button" class="bs-btn bs-btn-gs" onclick="cerrarDet();editar(' + Number(x.id) + ')">✏️ Editar</button></div></div>');
    $('modalDet').classList.add('bs-active');
  }
  function cerrarDet() { $('modalDet').classList.remove('bs-active'); }
  window.cerrarVisita = async function (id) { if (!(await appConfirm('¿Confirmas que las observaciones de esta visita ya fueron levantadas?'))) return; try { var r = await api('bs_actualizarVisita', { id: id, datos: { estado: 'Cerrada' } }); appAlert(r.message || ''); if (r.ok) { cerrarDet(); cargar(); } } catch (e) { appAlert('Error: ' + e.message); } };
  window.gsAnular = async function (id) { var motivo = await appPrompt('Motivo de la anulación:'); if (!motivo) return; try { var r = await api('bs_anularRegistro', { modulo: 'gestion_social', clave: 'bs_gs_visitas', id: id, motivo: motivo }); appAlert(r.message || ''); if (r.ok) { cerrarDet(); cargar(); } } catch (e) { appAlert('Error: ' + e.message); } };
  async function restaurar(id) { if (!(await appConfirm('¿Restaurar la visita #' + id + '?'))) return; try { var r = await api('bs_restaurarRegistro', { modulo: 'gestion_social', clave: 'bs_gs_visitas', id: id, motivo: 'Restaurado desde el módulo' }); appAlert(r.message || ''); if (r.ok) cargar(); } catch (e) { appAlert('Error: ' + e.message); } }

  document.querySelectorAll('#tabs button').forEach(function (b) { b.onclick = function () { TAB = b.getAttribute('data-t'); document.querySelectorAll('#tabs button').forEach(function (x) { x.classList.toggle('on', x === b); }); ['indice', 'lista', 'alertas', 'items'].forEach(function (t) { $('p-' + t).hidden = t !== TAB; }); }; });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { cerrarModal(); cerrarDet(); } });
  window.cargar = cargar; window.render = render; window.abrirNuevo = abrirNuevo; window.editar = editar; window.cerrarModal = cerrarModal; window.guardar = guardar; window.verCaso = verCaso; window.cerrarDet = cerrarDet; window.restaurar = restaurar; window.itemCambio = itemCambio; window.GS_ITEMS = ITEMS;
  verificarAcceso().then(function (ok) {
    if (ok) { cargar(); return; }
    $('p-indice').innerHTML = '<div class="bs-alert bs-alert-danger"><strong>Sin acceso a Gestión Social.</strong> Pide al administrador que active <b>Bienestar → Gestión Social</b> para tu usuario en "Acceso a Módulos" del Sistema RR.LL. y vuelve a ingresar.</div>';
    document.querySelectorAll('.bs-btn-gs').forEach(function (b) { b.disabled = true; });
  });
})();
