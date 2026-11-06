/* bs-ficha-azure-2.js — _BS_FICHA_AZURE_V2 (01-nov-2026)
   Ficha del Trabajador: respuesta inmediata desde Azure mientras Google arma el historial.
   1) Al abrir una ficha, muestra en < 1 s los datos del padrón (Azure /trabajadores/buscar) con un aviso
      "armando historial…"; cuando el servidor de Bienestar (Google) responde, la ficha completa reemplaza la vista.
   2) Agrega la sección "Atenciones RR.LL. (Azure)" (/atenciones/by-dni?completo=1) debajo de las alertas.
   3) Caché en memoria de 5 min del historial de Google por DNI: reabrir la misma ficha es inmediato.
   Solo lectura. Si Azure no responde, todo sigue como antes. Se apoya en bs-ficha-azure.js (V1). */
(function () {
  'use strict';
  if (window._BS_FICHA_AZURE_V2) return; window._BS_FICHA_AZURE_V2 = true;
  var AZ = 'https://exdjzbfinppzatjyimxn.supabase.co/functions/v1/api/';
  var CACHE_MS = 5 * 60 * 1000, cache = {};
  var previo = window.api; if (typeof previo !== 'function') return;

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function token() { try { return (JSON.parse(localStorage.getItem('bienestarSocialAuth') || '{}') || {}).rl_token || ''; } catch (e) { return ''; } }
  function fecha(v) { if (!v) return '—'; var d = new Date(v); if (isNaN(d)) return esc(String(v).slice(0, 10)); return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear(); }
  async function azGet(path, ms) {
    var tk = token(); if (!tk) return null;
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null, reloj = setTimeout(function () { try { ctl && ctl.abort(); } catch (e) {} }, ms || 6000);
    try {
      var r = await fetch(AZ + path, { headers: { Authorization: 'Bearer ' + tk }, signal: ctl ? ctl.signal : undefined });
      clearTimeout(reloj); if (!r.ok) return null; var j = await r.json(); return j && j.success !== false ? j : null;
    } catch (e) { clearTimeout(reloj); return null; }
  }
  function nombreDe(t) { return String(t.nombre_completo || [t.ap_paterno, t.ap_materno, t.nombres].filter(Boolean).join(' ') || '').trim().toUpperCase(); }
  function empDe(t) { return String(t.empresa_origen || t.empresa || '').toUpperCase().replace(/\s*S\.?A\.?C\.?\s*$/, '').trim(); }

  /* ---- 1) vista previa inmediata ---- */
  function vistaPrevia(dni, t) {
    var est = $('estado'); if (!est || !est.querySelector('.bs-spinner')) return;   /* solo si aún está el spinner de "Armando la ficha…" */
    var meta = t ? [['Empresa', empDe(t)], ['Cargo', t.oficio || t.cargo], ['Sector', t.zona_labor || t.fundo], ['Régimen', t.tipo_regimen], ['Ingreso', t.fecha_inicio ? fecha(t.fecha_inicio) : ''], ['Término', t.fecha_termino ? fecha(t.fecha_termino) : '']] : [];
    est.innerHTML = '<div class="bs-card" style="padding:16px 18px;margin-bottom:12px">' +
      '<div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap"><div style="width:48px;height:48px;border-radius:50%;background:#0f2748;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700">' + (t ? esc(nombreDe(t).split(/\s+/).slice(0, 2).map(function (x) { return x.charAt(0); }).join('')) : '?') + '</div>' +
      '<div style="flex:1;min-width:200px"><div style="font-weight:700;font-size:1.05rem;color:#0f2748">' + esc(t ? nombreDe(t) : 'DNI ' + dni + ' (no está en el padrón de Azure)') + '</div>' +
      '<div class="bs-text-sm bs-text-muted" style="display:flex;gap:12px;flex-wrap:wrap;margin-top:4px"><span>DNI: <b>' + esc(dni) + '</b></span>' + meta.filter(function (m) { return m[1]; }).map(function (m) { return '<span>' + esc(m[0]) + ': <b>' + esc(m[1]) + '</b></span>'; }).join('') + '</div></div>' +
      '<span class="fi-chip sin_fecha" title="Datos del padrón leídos de la base central (Supabase)">☁️ Base central</span></div>' +
      '<div style="display:flex;gap:10px;align-items:center;margin-top:12px" class="bs-text-sm bs-text-muted"><div class="bs-spinner bs-spinner-dark" style="width:16px;height:16px"></div>Armando el historial (casos, subsidios, descansos) desde el servidor de Bienestar…</div></div>';
  }

  /* ---- 2) sección Atenciones RR.LL. ---- */
  function estadoChip(est) {
    var e = String(est || '').toUpperCase();
    if (e.indexOf('FINALIZ') >= 0) return '<span class="fi-chip" style="background:#dcfce7;color:#166534">Finalizado · regularizado</span>';
    if (e.indexOf('PROCESO') >= 0) return '<span class="fi-chip prox">En proceso · pendiente</span>';
    return '<span class="fi-chip sin_fecha">' + esc(est || '—') + '</span>';
  }
  function seccionAtenciones(dni) {
    var ancla = $('fAlertas'); if (!ancla) return;
    var box = $('fAzureAt'); if (!box) { box = document.createElement('div'); box.id = 'fAzureAt'; box.style.margin = '12px 0'; ancla.parentNode.insertBefore(box, ancla.nextSibling); }
    box.innerHTML = '<div class="bs-text-sm bs-text-muted">☁️ Consultando atenciones de RR.LL. en la base central…</div>';
    azGet('atenciones/by-dni?dni=' + encodeURIComponent(dni) + '&dias=1095&completo=1', 8000).then(function (j) {
      if (!j) { box.innerHTML = '<div class="bs-text-sm bs-text-muted">☁️ Atenciones RR.LL.: la base central no respondió (sin sesión o sin conexión).</div>'; return; }
      var lista = [].concat(j.en_proceso || [], j.finalizadas_recientes || []).sort(function (a, b) { return new Date(b.fecha_atencion) - new Date(a.fecha_atencion); });
      var enProc = (j.en_proceso || []).length;
      var h = '<div class="bs-card" style="padding:14px 16px"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px"><b style="color:#0f2748">☁️ Atenciones RR.LL. (base central) · últimos 3 años</b>' +
        '<span class="bs-text-sm">' + lista.length + ' registro(s) · ' + (enProc ? '<b style="color:#b45309">' + enProc + ' en proceso</b>' : '<b style="color:#15803d">todas finalizadas</b>') + '</span></div>';
      if (!lista.length) h += '<div class="bs-text-sm bs-text-muted">Sin atenciones registradas en RR.LL. para este DNI.</div>';
      else {
        /* _FICHA_PANTALLA_V1 (06-nov): mismo formato que Descansos -> 5 columnas con salto de linea, todo visible sin desplazar */
        if (!$('fiAtCss')) { var st = document.createElement('style'); st.id = 'fiAtCss';
          st.textContent = '.bs-table.fi-at{table-layout:fixed;width:100%;font-size:.85rem}.bs-table.fi-at tbody td{white-space:normal!important;max-width:none!important;overflow:visible!important;overflow-wrap:anywhere;line-height:1.35;vertical-align:top}' +
            '.bs-table.fi-at th:last-child,.bs-table.fi-at tbody td:last-child{right:auto;box-shadow:none;white-space:normal;text-align:left;width:auto}.bs-table.fi-at tbody td:last-child{position:static}' +
            '.fi-at .fi-chip{white-space:normal;display:inline-block;max-width:100%}.fi-at small{color:#64748b}.fi-at td:first-child small{white-space:nowrap}' +
            '.fi-at th:nth-child(1){width:12%}.fi-at th:nth-child(2){width:32%}.fi-at th:nth-child(3){width:17%}.fi-at th:nth-child(4){width:17%}.fi-at th:nth-child(5){width:22%}';
          document.head.appendChild(st); }
        h += '<div><table class="bs-table fi-at"><thead><tr><th>N° / Fecha</th><th>Documento y vigencia</th><th>Estado</th><th>Supervisor</th><th>Observaciones</th></tr></thead><tbody>' +
          lista.slice(0, 25).map(function (a) {
            var vig = a.fecha_inicio_doc || a.fecha_termino_doc ? fecha(a.fecha_inicio_doc) + ' → ' + fecha(a.fecha_termino_doc) : 'sin vigencia';
            return '<tr><td><b>' + esc(a.nro || a.id || '') + '</b><br><small>' + fecha(a.fecha_atencion) + '</small></td><td>' + esc(a.detalle_documento || '—') + '<br><small>Vigencia: ' + vig + '</small></td><td>' + estadoChip(a.estado) + '</td>' +
              '<td>' + esc(a.supervisor || '—') + (a.responsable_recepcion ? '<br><small>Recepción: ' + esc(a.responsable_recepcion) + '</small>' : '') + '</td><td>' + (esc(a.observaciones || '') || '<small>—</small>') + '</td></tr>';
          }).join('') + '</tbody></table></div>';
        if (lista.length > 25) h += '<div class="bs-text-sm bs-text-muted" style="margin-top:6px">Mostrando 25 de ' + lista.length + '. Para el detalle completo: Descansos Médicos → Consulta RR.LL.</div>';
      }
      box.innerHTML = h + '</div>';
    });
  }

  /* ---- envoltorio de api() ---- */
  window.api = async function (accion, payload) {
    if (accion !== 'bs_fichaTrabajador') return previo.apply(this, arguments);
    var dni = String((payload || {}).dni || '').trim();
    var ok8 = /^\d{8}$/.test(dni);
    /* 3) caché 5 min */
    var c = cache[dni];
    if (c && Date.now() - c.t < CACHE_MS) { setTimeout(function () { seccionAtenciones(dni); }, 0); return c.r; }
    /* 0) _BS_AZURE_V1: ficha completa desde Azure (bs/ficha). Si Azure ya tiene las hojas cargadas, no se llama a Google. */
    var tIni = Date.now();
    if (ok8 && localStorage.getItem('bs_ficha_azure') !== 'off') {
      try {
        var u = {}; try { u = JSON.parse(localStorage.getItem('bienestarSocialAuth') || '{}') || {}; } catch (e) {}
        var fz = await azGet('bs/ficha?dni=' + encodeURIComponent(dni) + '&permisos=' + encodeURIComponent(JSON.stringify(u.permisos || {})), 8000);
        var cg = fz && fz.cargadas || {};
        if (fz && fz.ok && cg.accidentes && cg.subsidios && cg.hostigamiento) {
          try { console.log('[ficha] Azure respondió en ' + (Date.now() - tIni) + ' ms', fz._ms || ''); } catch (e) {}
          cache[dni] = { t: Date.now(), r: fz }; setTimeout(function () { seccionAtenciones(dni); }, 0);
          return fz;
        }
        try { console.log('[ficha] Azure sin tablas de Bienestar cargadas; se usa Google', cg); } catch (e) {}
      } catch (e) {}
    }
    /* 1) vista previa: Azure en paralelo con Google; se pinta solo si Google aún no respondió */
    var pendiente = true, args = Array.prototype.slice.call(arguments);
    if (ok8) {
      /* Azure primero (≈0.3 s): pinta la vista previa y entrega el padrón a Google para que no recorra el libro del padrón */
      var j = await azGet('trabajadores/buscar?dni=' + encodeURIComponent(dni), 4000);
      var t = j && j.trabajadores && j.trabajadores[0] || null;
      vistaPrevia(dni, t);
      if (t) args[1] = Object.assign({}, payload, { padron_azure: { dni: dni, nombre: nombreDe(t), empresa: empDe(t), sexo: String(t.sexo || ''), cargo: String(t.oficio || t.cargo || ''), regimen: String(t.tipo_regimen || ''), zona: String(t.zona_labor || t.fundo || ''), ruta: String(t.ruta || ''), codigo: String(t.codigo_trab || t.cod || ''), fecha_inicio: t.fecha_inicio || '', fecha_termino: t.fecha_termino || '' } });
    }
    var res;
    try { res = await previo.apply(this, args); } finally { pendiente = false; }
    try { console.log('[ficha] Google respondió en ' + (Date.now() - tIni) + ' ms', res && res._ms ? res._ms : '', res && res.cache ? '(caché GAS)' : ''); } catch (e) {}
    if (res && res.ok) { cache[dni] = { t: Date.now(), r: res }; if (ok8) setTimeout(function () { seccionAtenciones(dni); }, 0); }
    return res;
  };
})();
