/* Bienestar Social · modulos/accidentes.html · bloque 2 (antes en la linea 1138) · extraido el 26-oct-2026 sin cambios (_BS_MODULAR_V1) */
(function(){
  // Opcional: si la pagina tiene varias tablas, fuerza la correcta:
  //   window.EXPORT_TABLE_SELECTOR = '#idDeTuTabla';
  function tablaPrincipal(){
    if (window.EXPORT_TABLE_SELECTOR){ var s=document.querySelector(window.EXPORT_TABLE_SELECTOR); if(s) return s; }
    var tablas = Array.prototype.slice.call(document.querySelectorAll('table'));
    if(!tablas.length) return null;
    tablas.sort(function(a,b){ return b.querySelectorAll('tbody tr').length - a.querySelectorAll('tbody tr').length; });
    return tablas[0];
  }
  function _aoaDe(arr, orden){
    var headers = [];
    (orden || window.__BS_EXPORT_ORDER || []).forEach(function(k){ if (headers.indexOf(k) < 0) headers.push(k); });
    arr.forEach(function(row){ Object.keys(row).forEach(function(k){ if(headers.indexOf(k)<0) headers.push(k); }); });
    // solo columnas presentes en los datos o en el orden canónico con algún valor
    var aoa = [headers];
    arr.forEach(function(row){ aoa.push(headers.map(function(h){
        var v = row[h];
        if (v === null || v === undefined) return '';
        if (window.bsFechaDMY && /^\d{4}-\d{1,2}-\d{1,2}(T|$)/.test(String(v))) { var f = bsFechaDMY(v); if (f !== '-') return f; }
        return v;
      })); });
    return XLSX.utils.aoa_to_sheet(aoa);
  }
  async function _traerSeguimientos(casos){
    // 1) Robusto: una sola llamada al backend (con respaldo caso por caso)
    if (typeof api === 'function'){
      try {
        var rt = await api('bs_listarTodosSeguimientos', {});
        if (rt && rt.ok && Array.isArray(rt.items)){
          var byId = {};
          casos.forEach(function(c){ byId[String(c.id)] = c; });
          return rt.items.map(function(sg){
            var cc = byId[String(sg.id_caso)] || {};
            var fila = { dni_caso: cc.dni || '', nombre_caso: cc.nombre || '' };
            for (var k in sg){ if (Object.prototype.hasOwnProperty.call(sg,k)) fila[k]=sg[k]; }
            return fila;
          });
        }
      } catch(e){}
    }
    var out = [];
    var LOTE = 4;
    for (var i=0; i<casos.length; i+=LOTE){
      var grupo = casos.slice(i, i+LOTE);
      var res = await Promise.all(grupo.map(function(c){
        return api('bs_listarSeguimientos', { id_caso: c.id }).then(function(r){
          return ((r && r.items) || []).map(function(sg){
            var fila = { id_caso: c.id, dni_caso: c.dni, nombre_caso: c.nombre };
            for (var k in sg){ if (Object.prototype.hasOwnProperty.call(sg,k)) fila[k]=sg[k]; }
            return fila;
          });
        }).catch(function(){ return []; });
      }));
      res.forEach(function(a){ out = out.concat(a); });
    }
    return out;
  }
  async function exportar(){
    if (typeof XLSX === 'undefined'){ appAlert('La libreria de Excel se esta cargando, intenta de nuevo en unos segundos.'); return; }
    if (btn.disabled) return;
    var oldTxt = btn.textContent;
    btn.disabled = true; btn.style.opacity = '.6'; btn.textContent = 'Generando...';
    try {
      var wb = XLSX.utils.book_new();
      var data = window.__BS_EXPORT_DATA__;
      var ws;
      if (Array.isArray(data) && data.length){
        ws = _aoaDe(data);
      } else {
        var tabla = tablaPrincipal();
        if(!tabla || !tabla.querySelectorAll('tbody tr').length){ appAlert('No hay datos para exportar.'); return; }
        ws = XLSX.utils.table_to_sheet(tabla, {raw:true});
      }
      XLSX.utils.book_append_sheet(wb, ws, 'Datos');
      if (Array.isArray(data) && data.length && typeof api === 'function'){
        var segs = await _traerSeguimientos(data);
        if (segs.length){ XLSX.utils.book_append_sheet(wb, _aoaDe(segs), 'Seguimientos'); }
      }
      if (typeof api === 'function'){
        try {
          var rh = await api('bs_listarTodoHistorialAccidentes', {});
          var hist = (rh && rh.items) || [];
          if (hist.length){ XLSX.utils.book_append_sheet(wb, _aoaDe(hist), 'Historial'); }
        } catch(e){}
      }
      var nombre = (document.title || 'Bienestar').replace(/[^\w\-]+/g,'_').slice(0,40);
      XLSX.writeFile(wb, nombre + '_' + new Date().toISOString().slice(0,10) + '.xlsx');
    } catch(err){
      appAlert('Ocurrio un error al exportar: ' + (err && err.message ? err.message : err));
    } finally {
      btn.disabled = false; btn.style.opacity = '1'; btn.textContent = oldTxt;
    }
  }
  var btn = document.createElement('button');
  btn.textContent = '\u2B07\uFE0F Exportar Excel';
  btn.onclick = exportar;
  btn.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:9999;background:#0a2463;color:#fff;border:none;padding:11px 16px;border-radius:10px;cursor:pointer;font:600 14px Segoe UI,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.25)';
  function poner(){ document.body.appendChild(btn); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', poner); else poner();
})();
