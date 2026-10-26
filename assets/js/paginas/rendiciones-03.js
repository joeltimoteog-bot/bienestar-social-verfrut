/* Bienestar Social · modulos/rendiciones.html · bloque 3 (antes en la linea 844) · extraido el 26-oct-2026 sin cambios (_BS_MODULAR_V1) */
  (function(){
    function _resumenFiltros(){
      var parts = ['Año: ' + (document.getElementById('filterAnio').value || 'Todos')];
      var emp  = document.getElementById('filterEmpresa').value;       if (emp)  parts.push('Empresa: ' + emp);
      var resp = document.getElementById('filterResponsable').value;   if (resp) parts.push('Responsable: ' + resp);
      var est  = document.getElementById('filterEstado').value;        if (est)  parts.push('Estado: ' + est);
      var catEl= document.getElementById('filterCategoria');           if (catEl && catEl.value) parts.push('Categoría: ' + catEl.options[catEl.selectedIndex].text);
      var d    = document.getElementById('filterDesde').value, h = document.getElementById('filterHasta').value;
      if (d || h) parts.push('Periodo: ' + (d || '…') + ' a ' + (h || '…'));
      return parts.join('   ·   ');
    }
    async function emitirPDF(){
      if (typeof window.jspdf === 'undefined' || typeof html2canvas === 'undefined'){
        appAlert('Las librerías de PDF se están cargando, intenta de nuevo en unos segundos.'); return;
      }
      var cont = document.getElementById('reporteContainer');
      if (!cont || !cont.innerHTML.trim()){ appAlert('No hay datos para el reporte con los filtros actuales.'); return; }
      var btn = document.getElementById('btnPDF'); var txt = btn.textContent; btn.textContent = 'Generando...'; btn.disabled = true;
      try {
        var canvas = await html2canvas(cont, { scale: 2, backgroundColor: '#ffffff', logging: false });
        var img = canvas.toDataURL('image/png');
        var jsPDF = window.jspdf.jsPDF;
        var pdf = new jsPDF('p', 'mm', 'a4');
        var pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight(), m = 10;
        pdf.setFontSize(14); pdf.setTextColor(0,51,160);
        pdf.text('Reporte de Rendiciones — Bienestar Social', m, 14);
        pdf.setFontSize(8); pdf.setTextColor(90);
        pdf.text(_resumenFiltros(), m, 20, { maxWidth: pw - m*2 });
        pdf.text('Generado: ' + new Date().toLocaleString('es-PE'), m, 25);
        var y = 30, imgW = pw - m*2, imgH = canvas.height * imgW / canvas.width;
        var maxH = ph - y - m;
        if (imgH > maxH){ imgH = maxH; imgW = canvas.width * imgH / canvas.height; }
        pdf.addImage(img, 'PNG', m, y, imgW, imgH);
        pdf.save('Reporte_Rendiciones_' + new Date().toISOString().slice(0,10) + '.pdf');
      } catch(e){ appAlert('No se pudo generar el PDF: ' + e.message); }
      finally { btn.textContent = txt; btn.disabled = false; }
    }
    var btn = document.createElement('button');
    btn.id = 'btnPDF';
    btn.textContent = '\uD83D\uDCC4 Reporte PDF';
    btn.onclick = emitirPDF;
    btn.style.cssText = 'position:fixed;right:18px;bottom:64px;z-index:9999;background:#0a2463;color:#fff;border:none;padding:11px 16px;border-radius:10px;cursor:pointer;font:600 14px Segoe UI,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.25)';
    function poner(){ document.body.appendChild(btn); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', poner); else poner();
  })();
  