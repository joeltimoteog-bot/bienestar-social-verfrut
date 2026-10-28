/* ═══════════════════════════════════════════════════════════════════════════
   bs-portal-pro.js — _BS_PORTAL_PRO_V1 (27-oct-2026)  · Capa ADITIVA del portal
   1) "Qué necesita atención": resumen por modulo (clic = filtrar), filtro Vencidos /
      Por vencer, buscador y vista compacta (12 primeros + "Ver todos"), para que los
      indicadores y modulos de abajo queden a la vista.
   2) Pantalla "¿Eres tú?" al entrar: rediseño moderno (mismos botones y misma logica).
   No cambia datos ni el envio del reporte. Para desactivar: quitar el <script>.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._BS_PORTAL_PRO_V1) return; window._BS_PORTAL_PRO_V1 = true;

  var css = [
    /* --- atrasos --- */
    '#bspBar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:4px 0 12px}',
    '#bspBar .seg{display:inline-flex;background:var(--p-bg,#f3f5fa);border:1px solid var(--p-line,#dde3ef);border-radius:999px;padding:3px}',
    '#bspBar .seg button{border:0;background:transparent;color:var(--p-fg,#13213f);font:inherit;font-size:12.5px;font-weight:700;padding:6px 13px;border-radius:999px;cursor:pointer}',
    '#bspBar .seg button.on{background:var(--p-panel,#fff);box-shadow:0 1px 4px rgba(15,23,42,.15)}',
    '#bspBar .seg button.on.r{color:var(--p-bad,#b91c1c)}#bspBar .seg button.on.a{color:var(--p-warn,#b45309)}',
    '#bspBar input{margin-left:auto;min-width:200px;padding:8px 12px;border:1px solid var(--p-line,#dde3ef);border-radius:10px;background:var(--p-panel,#fff);color:var(--p-fg,#13213f);font:inherit;font-size:13px}',
    '#bspMods{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}',
    '#bspMods button{display:flex;align-items:center;gap:8px;border:1px solid var(--p-line,#dde3ef);background:var(--p-panel,#fff);color:var(--p-fg,#13213f);border-radius:12px;padding:8px 12px;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer;transition:transform .15s,box-shadow .15s}',
    '#bspMods button:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(15,23,42,.1)}',
    '#bspMods button.on{border-color:#1e3a8a;box-shadow:0 0 0 2px rgba(30,58,138,.18)}',
    '#bspMods .n{min-width:22px;text-align:center;padding:2px 7px;border-radius:999px;font-size:11.5px;font-weight:800;background:var(--p-bad-soft,#fee2e2);color:var(--p-bad,#b91c1c)}',
    '#bspMods .n.a{background:var(--p-warn-soft,#fef3c7);color:var(--p-warn,#b45309)}',
    '#proAtrasos .atr-list.bsp-compacta{max-height:none}',
    '#bspMas{display:block;width:100%;margin:10px 0 2px;border:1px dashed var(--p-line,#dde3ef);background:transparent;color:#1e3a8a;font:inherit;font-weight:800;font-size:13px;padding:9px;border-radius:10px;cursor:pointer}',
    '#bspMas:hover{background:var(--p-bg,#f3f5fa)}',
    '#bspVacio{display:none;padding:14px;text-align:center;color:var(--p-muted,#5b6785);font-size:13px}',
    '.atr-item{transition:transform .15s,box-shadow .15s}.atr-item:hover{transform:translateY(-1px);box-shadow:0 6px 16px rgba(15,23,42,.08)}',
    /* --- ¿eres tú? --- */
    '#_bsIdentOv{background:radial-gradient(1200px 600px at 20% 10%,rgba(37,99,235,.55),transparent),radial-gradient(900px 500px at 90% 90%,rgba(220,38,38,.35),transparent),rgba(8,20,45,.94)!important;backdrop-filter:blur(6px)}',
    '#_bsIdentOv>.bsp-id{background:rgba(255,255,255,.97);color:#0f172a;border-radius:22px;max-width:420px;width:100%;padding:30px 28px 22px;text-align:center;box-shadow:0 30px 80px rgba(0,0,0,.45);animation:bspIn .35s cubic-bezier(.2,.9,.3,1.2)}',
    '@keyframes bspIn{from{opacity:0;transform:translateY(14px) scale(.96)}to{opacity:1;transform:none}}',
    '.bsp-id .av{width:76px;height:76px;margin:0 auto 12px;border-radius:50%;display:grid;place-items:center;font-size:28px;font-weight:800;color:#fff;background:linear-gradient(135deg,#1e3a8a,#2563eb);box-shadow:0 10px 25px rgba(37,99,235,.4);position:relative}',
    '.bsp-id .av:after{content:"";position:absolute;right:4px;bottom:4px;width:16px;height:16px;border-radius:50%;background:#22c55e;border:3px solid #fff}',
    '.bsp-id .sal{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#64748b;font-weight:800}',
    '.bsp-id .nom{font-size:20px;font-weight:800;margin:4px 0 2px;color:#0a2463;line-height:1.25}',
    '.bsp-id .sub{font-size:13px;color:#475569;margin-bottom:18px;line-height:1.45}',
    '.bsp-id .marca{display:flex;align-items:center;justify-content:center;gap:6px;font-size:11.5px;font-weight:800;color:#0a2463;margin-bottom:14px;letter-spacing:.04em}',
    '.bsp-id #_bsIdentSi{display:block;width:100%;background:linear-gradient(135deg,#16a34a,#15803d)!important;color:#fff!important;border:0!important;border-radius:12px!important;padding:13px!important;font-weight:800!important;font-size:14.5px!important;cursor:pointer;box-shadow:0 8px 20px rgba(22,163,74,.35)}',
    '.bsp-id #_bsIdentSi:hover{filter:brightness(1.06)}',
    '.bsp-id #_bsIdentNo{display:block;width:100%;margin-top:10px;background:transparent!important;color:#b91c1c!important;border:1.5px solid #fecaca!important;border-radius:12px!important;padding:10px!important;font-weight:700!important;font-size:13px!important;cursor:pointer}',
    '.bsp-id #_bsIdentNo:hover{background:#fef2f2!important}',
    '.bsp-id .pie{margin-top:14px;font-size:11px;color:#94a3b8}'
  ].join('\n');
  var st = document.createElement('style'); st.id = 'bspStyle'; st.textContent = css; (document.head || document.documentElement).appendChild(st);

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ═══ 1) ATRASOS ═══ */
  var LIMITE = 12, estado = 'todos', modulo = '', q = '', verTodo = false, pintando = false;
  function items() { var l = document.getElementById('atrLista'); return l ? Array.prototype.slice.call(l.querySelectorAll('.atr-item')) : []; }
  function modDe(it) { var m = it.querySelector('.mod'); return m ? String(m.textContent || '').split('·')[0].trim() : ''; }
  function asegurarUI() {
    var lista = document.getElementById('atrLista'); if (!lista) return null;
    if (!document.getElementById('bspBar')) {
      var bar = document.createElement('div'); bar.id = 'bspBar';
      bar.innerHTML = '<div class="seg"><button data-e="todos" class="on">Todos</button><button data-e="rojo" class="r">🔴 Vencidos</button><button data-e="ambar" class="a">🟡 Por vencer</button></div>'
        + '<input type="search" id="bspQ" placeholder="🔍 Buscar caso, módulo, trabajador…">';
      var mods = document.createElement('div'); mods.id = 'bspMods';
      lista.parentNode.insertBefore(bar, lista); lista.parentNode.insertBefore(mods, lista);
      var mas = document.createElement('button'); mas.id = 'bspMas'; mas.type = 'button';
      var vacio = document.createElement('div'); vacio.id = 'bspVacio'; vacio.textContent = 'Sin resultados con ese filtro.';
      lista.parentNode.insertBefore(vacio, lista.nextSibling); lista.parentNode.insertBefore(mas, vacio.nextSibling);
      Array.prototype.forEach.call(bar.querySelectorAll('.seg button'), function (b) {
        b.onclick = function () { estado = b.getAttribute('data-e'); verTodo = false; aplicar(); };
      });
      document.getElementById('bspQ').oninput = function (e) { q = String(e.target.value || '').toLowerCase().trim(); verTodo = false; aplicar(); };
      mas.onclick = function () { verTodo = !verTodo; aplicar(); if (!verTodo) { var s = document.getElementById('alertas'); if (s) s.scrollIntoView({ behavior: 'smooth', block: 'start' }); } };
      lista.classList.add('bsp-compacta');
    }
    return lista;
  }
  function pintarModulos(todos) {
    var cont = document.getElementById('bspMods'); if (!cont) return;
    var m = {};
    todos.forEach(function (it) { var k = modDe(it) || 'Otros'; m[k] = m[k] || { r: 0, a: 0 }; if (it.classList.contains('rojo')) m[k].r++; else m[k].a++; });
    var keys = Object.keys(m).sort(function (x, y) { return (m[y].r + m[y].a) - (m[x].r + m[x].a); });
    cont.innerHTML = keys.map(function (k) {
      return '<button type="button" data-m="' + esc(k) + '" class="' + (modulo === k ? 'on' : '') + '">' + esc(k)
        + (m[k].r ? ' <span class="n">' + m[k].r + '</span>' : '') + (m[k].a ? ' <span class="n a">' + m[k].a + '</span>' : '') + '</button>';
    }).join('') + (modulo ? '<button type="button" data-m="">✖ Quitar filtro</button>' : '');
    Array.prototype.forEach.call(cont.querySelectorAll('button'), function (b) {
      b.onclick = function () { var k = b.getAttribute('data-m'); modulo = (modulo === k) ? '' : k; verTodo = false; aplicar(); };
    });
  }
  function aplicar() {
    if (!asegurarUI()) return;
    pintando = true;
    var todos = items();
    var bar = document.getElementById('bspBar');
    Array.prototype.forEach.call(bar.querySelectorAll('.seg button'), function (b) { b.classList.toggle('on', b.getAttribute('data-e') === estado); });
    var vis = todos.filter(function (it) {
      if (estado !== 'todos' && !it.classList.contains(estado)) return false;
      if (modulo && modDe(it) !== modulo) return false;
      if (q && String(it.textContent || '').toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    todos.forEach(function (it) { it.style.display = 'none'; });
    vis.forEach(function (it, i) { it.style.display = (verTodo || i < LIMITE) ? '' : 'none'; });
    pintarModulos(todos);
    var mas = document.getElementById('bspMas'), vacio = document.getElementById('bspVacio');
    vacio.style.display = vis.length ? 'none' : 'block';
    if (vis.length > LIMITE) { mas.style.display = 'block'; mas.textContent = verTodo ? '▲ Mostrar menos' : '▼ Ver todos (' + vis.length + ') — mostrando ' + LIMITE; }
    else mas.style.display = 'none';
    setTimeout(function () { pintando = false; }, 0);
  }
  function vigilarLista() {
    var lista = document.getElementById('atrLista'); if (!lista || !window.MutationObserver) return;
    new MutationObserver(function () { if (!pintando) { verTodo = false; aplicar(); } }).observe(lista, { childList: true });
    if (lista.children.length) aplicar();
  }

  /* ═══ 2) ¿ERES TÚ? ═══ */
  function saludo() { var h = new Date().getHours(); return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'; }
  function modernizarIdent() {
    var ov = document.getElementById('_bsIdentOv'); if (!ov || ov.getAttribute('data-bsp')) return;
    var si = document.getElementById('_bsIdentSi'), no = document.getElementById('_bsIdentNo'); if (!si || !no) return;
    ov.setAttribute('data-bsp', '1');
    var txt = ov.querySelector('div > div:nth-child(2)'); var nom = '';
    try { nom = String(txt ? txt.textContent : '').replace(/^Hay una sesi[oó]n activa de/i, '').trim(); } catch (e) {}
    var p = nom.split(/\s+/).filter(Boolean); var ini = ((p[0] || '?')[0] + ((p[2] || p[1] || '')[0] || '')).toUpperCase();
    var primero = p.length ? p[0].charAt(0) + p[0].slice(1).toLowerCase() : '';
    si.textContent = '✅ Sí, soy ' + (primero || 'yo') + ' — Continuar';
    no.textContent = 'No soy yo · Cambiar de usuario';
    var card = document.createElement('div'); card.className = 'bsp-id';
    card.innerHTML = '<div class="marca">💙 BIENESTAR SOCIAL · UNIFRUTTI PERÚ</div><div class="av">' + esc(ini) + '</div>'
      + '<div class="sal">' + saludo() + '</div><div class="nom">' + esc(nom || 'Usuario') + '</div>'
      + '<div class="sub">Hay una sesión activa en este equipo.<br>Confirma que eres tú para continuar.</div>';
    card.appendChild(si); card.appendChild(no);
    var pie = document.createElement('div'); pie.className = 'pie'; pie.textContent = '🔒 Si esta computadora es compartida, elige "No soy yo" para cerrar la sesión.'; card.appendChild(pie);
    ov.innerHTML = ''; ov.appendChild(card);
    try { si.focus(); } catch (e) {}
    ov.addEventListener('keydown', function (e) { if (e.key === 'Enter') si.click(); });
  }

  function iniciar() {
    modernizarIdent(); vigilarLista();
    if (window.MutationObserver) new MutationObserver(function () { modernizarIdent(); }).observe(document.body, { childList: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
