/* ═══════════════════════════════════════════════════════════════════════════
   bs-portal-atrasos.js — _BS_ATR_PANEL_V1 (06-nov-2026) · Capa ADITIVA del portal
   "Qué necesita atención" ya no llena el inicio con cientos de tarjetas:
   - En el inicio queda un RESUMEN compacto: vencidos, por vencer, cuántos por módulo,
     el caso más antiguo y los botones de reporte.
   - "Ver detalle" abre un PANEL LATERAL con la lista completa en filas ordenadas
     (filtros, buscador y envío del reporte siguen igual).
   La campana 🔔 y el aviso flotante también abren el panel.
   No cambia datos, alertas ni el reporte. Para desactivar: quitar el <script>.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._BS_ATR_PANEL_V1) return; window._BS_ATR_PANEL_V1 = true;

  var css = [
    /* resumen en el inicio */
    '#atrResumen{display:none;background:var(--p-panel,#fff);border:1px solid var(--p-line,#dde3ef);border-radius:14px;padding:16px 18px;box-shadow:0 2px 10px rgba(15,23,42,.04)}',
    '#atrResumen.on{display:block}',
    '#atrResumen .ar-fila{display:flex;align-items:center;gap:22px;flex-wrap:wrap}',
    '#atrResumen .ar-k{display:flex;align-items:baseline;gap:8px;padding-right:22px;border-right:1px solid var(--p-line,#dde3ef)}',
    '#atrResumen .ar-k b{font-family:var(--p-display,inherit);font-size:34px;line-height:1;font-weight:700}',
    '#atrResumen .ar-k span{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--p-muted,#5b6785)}',
    '#atrResumen .ar-k.r b{color:var(--p-bad,#b91c1c)}#atrResumen .ar-k.a b{color:var(--p-warn,#b45309)}',
    '#atrResumen .ar-mods{display:flex;flex-wrap:wrap;gap:6px;flex:1;min-width:200px}',
    '#atrResumen .ar-mod{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--p-line,#dde3ef);border-radius:999px;padding:4px 6px 4px 11px;font-size:12.5px;font-weight:700;background:var(--p-bg,#f3f5fa);cursor:pointer;color:var(--p-fg,#13213f)}',
    '#atrResumen .ar-mod:hover{border-color:var(--p-primary,#0033A0)}',
    '#atrResumen .ar-mod i{font-style:normal;min-width:22px;text-align:center;padding:1px 7px;border-radius:999px;font-size:11.5px;background:var(--p-bad-soft,#fee2e2);color:var(--p-bad,#b91c1c)}',
    '#atrResumen .ar-mod i.a{background:var(--p-warn-soft,#fef3c7);color:var(--p-warn,#b45309)}',
    '#atrResumen .ar-top{margin-top:12px;font-size:13.5px;color:var(--p-muted,#5b6785)}#atrResumen .ar-top b{color:var(--p-fg,#13213f)}#atrResumen .ar-top em{font-style:normal;font-weight:700;color:var(--p-bad,#b91c1c)}',
    '#atrResumen .ar-acc{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;padding-top:14px;border-top:1px solid var(--p-line,#dde3ef)}',
    '#atrResumen .ar-acc .atr-btn.prim{background:var(--p-primary,#0033A0)}',
    /* panel lateral */
    '#atrPanel{position:fixed;inset:0;z-index:6000;display:none}#atrPanel.open{display:block}',
    '#atrPanel .atp-fondo{position:absolute;inset:0;background:rgba(10,20,45,.45);backdrop-filter:blur(2px)}',
    '#atrPanel .atp-hoja{position:absolute;top:0;right:0;height:100%;width:min(860px,100vw);background:var(--p-bg,#f3f5fa);box-shadow:-20px 0 50px rgba(0,0,0,.25);display:flex;flex-direction:column;animation:atpIn .25s cubic-bezier(.2,.9,.3,1)}',
    '@keyframes atpIn{from{transform:translateX(40px)}to{transform:none}}',
    '#atrPanel .atp-cab{display:flex;align-items:center;gap:12px;padding:16px 22px;background:var(--p-panel,#fff);border-bottom:1px solid var(--p-line,#dde3ef)}',
    '#atrPanel .atp-cab h3{margin:0;font-family:var(--p-display,inherit);font-size:22px;font-weight:700}#atrPanel .atp-cab small{color:var(--p-muted,#5b6785)}',
    '#atrPanel .atp-x{margin-left:auto;border:1px solid var(--p-line,#dde3ef);background:var(--p-panel,#fff);color:var(--p-fg,#13213f);border-radius:10px;width:38px;height:38px;font-size:16px;cursor:pointer}',
    '#atrPanel .atp-cuerpo{flex:1;overflow-y:auto;padding:16px 22px 22px}',
    '#atrPanel #proAtrasos{display:block!important}',
    '#atrPanel .atr-head h3{font-size:17px}',
    /* lista en filas tipo tabla */
    '#atrPanel .atr-list{display:block;max-height:none;overflow:visible;background:var(--p-panel,#fff);border:1px solid var(--p-line,#dde3ef);border-radius:12px}',
    '#atrPanel .atr-item{display:grid!important;grid-template-columns:150px 1fr 130px 150px;align-items:center;gap:12px;border-radius:0;border-left-width:4px;border-bottom:1px solid var(--p-line,#dde3ef);padding:10px 14px;font-size:13.5px;transform:none!important;box-shadow:none!important}',
    '#atrPanel .atr-item[style*="none"]{display:none!important}',
    '#atrPanel .atr-item:last-child{border-bottom:0}#atrPanel .atr-item:hover{background:var(--p-bg,#f3f5fa)}',
    '#atrPanel .atr-item .dias{margin:0;text-align:right}',
    '#atrPanel .atr-actions{position:sticky;bottom:-22px;background:var(--p-bg,#f3f5fa);padding:12px 0 4px;margin-top:12px}',
    '@media (max-width:700px){#atrPanel .atr-item{grid-template-columns:1fr auto}#atrPanel .atr-item .mod{grid-column:1/-1}#atrPanel .atr-item .meta{display:none}}'
  ].join('\n');
  var st = document.createElement('style'); st.id = 'atrPanelCss'; st.textContent = css; (document.head || document.documentElement).appendChild(st);

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function abrir(modulo) {
    var p = $('atrPanel'); if (!p) return;
    p.classList.add('open'); document.documentElement.style.overflow = 'hidden';
    var to = document.querySelector('.atr-toast.visible'); if (to) to.classList.remove('visible');
    if (modulo) { var b = document.querySelector('#bspMods button[data-m="' + modulo.replace(/"/g, '') + '"]'); if (b && !b.classList.contains('on')) b.click(); }
    var t = document.querySelector('#atrPanel .atp-cuerpo'); if (t) t.scrollTop = 0;
  }
  function cerrar() { var p = $('atrPanel'); if (p) p.classList.remove('open'); document.documentElement.style.overflow = ''; }

  function resumir() {
    var box = $('proAtrasos'), res = $('atrResumen'), lista = $('atrLista'); if (!box || !res || !lista) return;
    var its = Array.prototype.slice.call(lista.querySelectorAll('.atr-item'));
    if (!box.classList.contains('visible') || !its.length) { res.classList.remove('on'); return; }
    var r = 0, a = 0, mods = {};
    its.forEach(function (it) {
      var roj = it.classList.contains('rojo'); if (roj) r++; else a++;
      var m = String((it.querySelector('.mod') || {}).textContent || '').split('·')[0].trim() || 'Otros';
      mods[m] = mods[m] || { r: 0, a: 0 }; mods[m][roj ? 'r' : 'a']++;
    });
    var keys = Object.keys(mods).sort(function (x, y) { return (mods[y].r + mods[y].a) - (mods[x].r + mods[x].a); });
    var p = its[0], tx = function (sel) { var e = p.querySelector(sel); return e ? e.textContent : ''; };
    res.innerHTML = '<div class="ar-fila">'
      + '<div class="ar-k r"><b>' + r + '</b><span>vencido' + (r === 1 ? '' : 's') + '</span></div>'
      + '<div class="ar-k a"><b>' + a + '</b><span>por vencer</span></div>'
      + '<div class="ar-mods">' + keys.map(function (k) {
          return '<button type="button" class="ar-mod" data-m="' + esc(k) + '" title="Ver solo ' + esc(k) + '">' + esc(k)
            + (mods[k].r ? ' <i>' + mods[k].r + '</i>' : '') + (mods[k].a ? ' <i class="a">' + mods[k].a + '</i>' : '') + '</button>';
        }).join('') + '</div></div>'
      + '<div class="ar-top">' + (p.classList.contains('rojo') ? 'Más antiguo: ' : 'Más próximo a vencer: ') + '<b>' + esc(tx('.tx')) + '</b> · ' + esc(tx('.mod')) + (tx('.meta') ? ' · ' + esc(tx('.meta')) : '') + ' · <em>' + esc(tx('.dias')) + '</em></div>'
      + '<div class="ar-acc"><button type="button" class="atr-btn prim" id="arVer">📋 Ver detalle (' + its.length + ')</button>'
      + '<button type="button" class="atr-btn wsp" data-env="whatsapp">📱 Enviar por WhatsApp</button>'
      + '<button type="button" class="atr-btn" data-env="correo">✉️ Enviar por correo</button>'
      + '<button type="button" class="atr-btn copy" data-env="copiar">📋 Copiar reporte</button></div>';
    res.classList.add('on');
    $('arVer').onclick = function () { abrir(); };
    Array.prototype.forEach.call(res.querySelectorAll('.ar-mod'), function (b) { b.onclick = function () { abrir(b.getAttribute('data-m')); }; });
    Array.prototype.forEach.call(res.querySelectorAll('[data-env]'), function (b) { b.onclick = function () { if (typeof window.enviarReporteAtrasos === 'function') window.enviarReporteAtrasos(b.getAttribute('data-env')); }; });
  }

  function montar() {
    var box = $('proAtrasos'), sect = $('alertas'), lista = $('atrLista');
    if (!box || !sect || !lista || $('atrPanel')) return;
    var ov = document.createElement('div'); ov.id = 'atrPanel';
    ov.innerHTML = '<div class="atp-fondo"></div><aside class="atp-hoja" role="dialog" aria-label="Detalle de atrasos"><div class="atp-cab"><div><h3>🚨 Qué necesita atención</h3><small>semáforo legal · plazos en días hábiles</small></div><button type="button" class="atp-x" title="Cerrar (Esc)">✕</button></div><div class="atp-cuerpo"></div></aside>';
    document.body.appendChild(ov);
    var res = document.createElement('div'); res.id = 'atrResumen';
    box.parentNode.insertBefore(res, box);
    ov.querySelector('.atp-cuerpo').appendChild(box);
    ov.querySelector('.atp-fondo').onclick = cerrar; ov.querySelector('.atp-x').onclick = cerrar;
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') cerrar(); });
    window.irAAtrasos = function () { if ($('atrResumen') && $('atrResumen').classList.contains('on')) abrir(); else { var s = $('alertas'); if (s) s.scrollIntoView({ behavior: 'smooth', block: 'start' }); } };
    if (window.MutationObserver) {
      new MutationObserver(resumir).observe(lista, { childList: true });
      new MutationObserver(resumir).observe(box, { attributes: true, attributeFilter: ['class'] });
    }
    resumir();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else montar();
})();
