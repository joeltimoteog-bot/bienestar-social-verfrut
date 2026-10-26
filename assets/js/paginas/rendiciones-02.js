/* Bienestar Social · modulos/rendiciones.html · bloque 2 (antes en la linea 806) · extraido el 26-oct-2026 sin cambios (_BS_MODULAR_V1) */
  (function(){
    function exportar(){
      if (typeof XLSX === 'undefined'){ appAlert('La libreria de Excel se esta cargando, intenta de nuevo en unos segundos.'); return; }
      var wb = XLSX.utils.book_new(); var ws;
      var data = window.__BS_EXPORT_DATA__;
      if (Array.isArray(data) && data.length){
        var headers = [];
        (window.__BS_EXPORT_ORDER || []).forEach(function(k){ if (headers.indexOf(k) < 0) headers.push(k); });
        data.forEach(function(row){ Object.keys(row).forEach(function(k){ if(headers.indexOf(k)<0) headers.push(k); }); });
        var aoa = [headers];
        data.forEach(function(row){ aoa.push(headers.map(function(h){
        var v = row[h];
        if (v === null || v === undefined) return '';
        if (window.bsFechaDMY && /^\d{4}-\d{1,2}-\d{1,2}(T|$)/.test(String(v))) { var f = bsFechaDMY(v); if (f !== '-') return f; }
        return v;
      })); });
        ws = XLSX.utils.aoa_to_sheet(aoa);
      } else {
        var tabla = document.querySelector('#tablaContainer table');
        if(!tabla || !tabla.querySelectorAll('tbody tr').length){ appAlert('No hay datos para exportar.'); return; }
        ws = XLSX.utils.table_to_sheet(tabla, {raw:true});
      }
      XLSX.utils.book_append_sheet(wb, ws, 'Rendiciones');
      XLSX.writeFile(wb, 'Rendiciones_' + new Date().toISOString().slice(0,10) + '.xlsx');
    }
    var btn = document.createElement('button');
    btn.textContent = '\u2B07\uFE0F Exportar Excel';
    btn.onclick = exportar;
    btn.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:9999;background:#059669;color:#fff;border:none;padding:11px 16px;border-radius:10px;cursor:pointer;font:600 14px Segoe UI,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.25)';
    function poner(){ document.body.appendChild(btn); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', poner); else poner();
  })();
  