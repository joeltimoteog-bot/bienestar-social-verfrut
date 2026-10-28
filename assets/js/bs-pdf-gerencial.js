/* ═══════════════════════════════════════════════════════════════════════════
   bs-pdf-gerencial.js — _BS_PDF_GERENCIAL_V1 (28-oct-2026)
   PDF GERENCIAL de los dashboards de Bienestar (A4 horizontal, ordenado):
   encabezado · filtros aplicados · indicadores · graficos (2 por fila, los anchos a toda la fila)
   · tablas · notas · pie con numeracion. Toma lo que esta en pantalla (mismos filtros).
   · Dashboards de Hallazgos, Accidentes y Subsidios: agrega el boton "📄 Exportar PDF".
   · Panel / Dashboard y Estadisticas: su boton PDF ya no imprime la pagina, arma este PDF.
   Si algo falla, avisa y no toca nada mas. Solo lectura de la pantalla.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.BSPdfGerencial) return;
  var NAVY = [10, 28, 77], ROJO = [220, 38, 38], TX = [15, 23, 42], GRIS = [100, 116, 139], LINEA = [226, 232, 240], SUAVE = [248, 250, 252];
  var CDN = ['https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'];

  function cargar(src) { return new Promise(function (ok, mal) { var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = function () { mal(new Error('No se pudo cargar ' + src)); }; document.head.appendChild(s); }); }
  async function asegurarLibs() {
    if (!(window.jspdf && window.jspdf.jsPDF)) await cargar(CDN[0]);
    var p = new window.jspdf.jsPDF(); if (typeof p.autoTable !== 'function') await cargar(CDN[1]);
  }
  function limpio(t) { return String(t == null ? '' : t).replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}️‍]/gu, '').replace(/≤/g, 'hasta ').replace(/≥/g, 'mín. ').replace(/[^\x00-\xFF•–—]/g, '').replace(/\s+/g, ' ').trim(); }
  function txt(el) { return el ? limpio(el.innerText || el.textContent) : ''; }
  function visible(el) { return !!(el && el.offsetParent !== null && el.getBoundingClientRect().width > 0); }
  /* _BS_PDF_ETIQUETAS_V1 (28-oct-2026): en el PDF cada barra / punto / porcion lleva su valor
     (S/ con 2 decimales si el grafico es de montos; entero si es de cantidades). Si el grafico ya muestra
     sus etiquetas en pantalla (plugin datalabels activo), no se duplican. Solo se dibuja sobre la copia del PDF. */
  function esMonto(ch) {
    try {
      var sc = ch.options && ch.options.scales || {}, ks = Object.keys(sc);
      for (var i = 0; i < ks.length; i++) { var cb = sc[ks[i]] && sc[ks[i]].ticks && sc[ks[i]].ticks.callback; if (typeof cb === 'function' && /S\/|\$/.test(String(cb.call({ getLabelForValue: function (v) { return v; } }, 1000, 0, [])))) return true; }
      var tt = ch.options && ch.options.plugins && ch.options.plugins.tooltip && ch.options.plugins.tooltip.callbacks && ch.options.plugins.tooltip.callbacks.label;
      if (typeof tt === 'function') { var r = tt.call({}, { raw: 1000, parsed: { y: 1000, x: 1000 }, formattedValue: '1000', dataset: ch.data.datasets[0] || {}, label: '', chart: ch }); if (/S\/|\$/.test(String(r))) return true; }
    } catch (e) {}
    return false;
  }
  function yaEtiquetado(ch, i) {
    try { var dl = ch.options.plugins && ch.options.plugins.datalabels; if (!dl) return false; var ds = ch.data.datasets[i] || {}; var d2 = ds.datalabels;
      var disp = d2 && d2.display !== undefined ? d2.display : dl.display; if (disp === false) return false;
      return !!(ch.config.plugins || []).some(function (p) { return p && p.id === 'datalabels'; }) || !!(window.Chart && Chart.registry && Chart.registry.plugins.get && Chart.registry.plugins.get('datalabels')); } catch (e) { return false; }
  }
  function etiquetar(canvas, ctx2, forzar) {
    var Ch = window.Chart; if (!Ch || !Ch.getChart) return;
    var ch = Ch.getChart(canvas); if (!ch) return;
    var tipo = ch.config.type, dpr = ch.currentDevicePixelRatio || (canvas.width / (canvas.clientWidth || canvas.width)) || 1;
    var monto = esMonto(ch), horiz = ch.options && ch.options.indexAxis === 'y';
    var stack = !!(ch.options && ch.options.scales && ((ch.options.scales.x && ch.options.scales.x.stacked) || (ch.options.scales.y && ch.options.scales.y.stacked)));
    var fmt = function (v) { v = Number(v) || 0; return monto ? 'S/ ' + v.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : (Math.round(v) === v ? v.toLocaleString('es-PE') : v.toLocaleString('es-PE', { maximumFractionDigits: 1 })); };
    var redondo = tipo === 'doughnut' || tipo === 'pie' || tipo === 'polarArea';
    /* _BS_PDF_ETIQ_GRUPO_V3: barras agrupadas (varias empresas por mes) -> valor vertical dentro de la barra; linea TOTAL encima del punto en su color */
    var nBarras = ch.data.datasets.filter(function (d, j) { var m = ch.getDatasetMeta(j); return ch.isDatasetVisible(j) && (m.type || d.type || tipo) === 'bar'; }).length;
    var esLinea = function (ds, meta) { return (meta.type || ds.type || tipo) === 'line'; };
    ctx2.save(); ctx2.scale(dpr, dpr); ctx2.textAlign = 'center'; ctx2.textBaseline = 'bottom'; ctx2.lineJoin = 'round';
    ch.data.datasets.forEach(function (ds, i) {
      if (!ch.isDatasetVisible(i) || (!forzar && yaEtiquetado(ch, i))) return;
      var meta = ch.getDatasetMeta(i), tot = 0;
      if (redondo) (ds.data || []).forEach(function (v, k) { if (ch.getDataVisibility ? ch.getDataVisibility(k) : true) tot += Number(v) || 0; });
      (meta.data || []).forEach(function (el, k) {
        var raw = ds.data[k], v = raw && typeof raw === 'object' ? (horiz ? raw.x : raw.y) : raw; v = Number(v);
        if (!v || !isFinite(v) || (ch.getDataVisibility && !ch.getDataVisibility(k))) return;
        var t = fmt(v), x, y, size = 10.5;
        if (redondo) { var pos = el.tooltipPosition(); x = pos.x; y = pos.y + 5; if (tot && v / tot < 0.04) return; t = t + ' (' + Math.round(v / tot * 100) + '%)'; size = 10; }
        else if (esLinea(ds, meta)) { x = el.x; y = el.y - 7;
          ctx2.font = '700 ' + size + 'px Inter, Segoe UI, Arial, sans-serif';
          /* puntos muy juntos: monto sin centimos y etiquetas alternadas en dos alturas para que no se encimen */
          var paso = meta.data.length > 1 ? Math.abs(meta.data[1].x - meta.data[0].x) : 999;
          if (ctx2.measureText(t).width > paso - 4) { if (monto) t = 'S/ ' + Math.round(v).toLocaleString('es-PE'); if (ctx2.measureText(t).width > paso - 4 && k % 2) y -= size + 3; }
          if (y - size < 1) y = el.y + size + 6; ctx2.strokeStyle = 'rgba(255,255,255,.97)'; ctx2.lineWidth = 4; ctx2.strokeText(t, x, y);
          ctx2.fillStyle = (typeof ds.borderColor === 'string' ? ds.borderColor : '#0f172a'); ctx2.fillText(t, x, y); return; }
        else if (!horiz && !stack && nBarras > 1) {
          ctx2.font = '700 ' + (size - 1) + 'px Inter, Segoe UI, Arial, sans-serif';
          var tw2 = ctx2.measureText(t).width, alto = Math.abs(el.base - el.y), cabe = alto > tw2 + 8;
          if (el.width && tw2 < el.width - 2 && alto > size + 6) { ctx2.textAlign = 'center'; ctx2.textBaseline = 'top'; ctx2.fillStyle = '#ffffff'; ctx2.fillText(t, el.x, el.y + 3); ctx2.textBaseline = 'bottom'; return; }
          ctx2.save(); ctx2.translate(el.x, cabe ? el.y + 5 : el.y - 4); ctx2.rotate(-Math.PI / 2); ctx2.textBaseline = 'middle'; ctx2.textAlign = cabe ? 'right' : 'left';
          if (cabe) { ctx2.fillStyle = '#ffffff'; ctx2.fillText(t, 0, 0); } else { ctx2.strokeStyle = 'rgba(255,255,255,.95)'; ctx2.lineWidth = 3; ctx2.strokeText(t, 0, 0); ctx2.fillStyle = '#0f172a'; ctx2.fillText(t, 0, 0); }
          ctx2.restore(); return; }
        else if (horiz) { ctx2.textAlign = stack ? 'center' : 'left'; x = stack ? (el.x + el.base) / 2 : el.x + 4; y = el.y + 5; }
        else { x = el.x; y = stack ? (el.y + el.base) / 2 + 5 : el.y - 3; }
        ctx2.font = '700 ' + size + 'px Inter, Segoe UI, Arial, sans-serif';
        /* _BS_PDF_ETIQ_BORDE_V2: si la etiqueta se saldria del lienzo (barra al tope), va dentro de la barra en blanco */
        var dentro = false, cw = canvas.width / dpr, tw = ctx2.measureText(t).width;
        if (!redondo && !stack && !horiz && y - size < 1) { y = Math.max(el.y + size + 3, size + 2); dentro = !(meta.type === 'line' || ds.type === 'line' || tipo === 'line'); }
        if (!redondo && !stack && horiz && x + tw > cw - 2) { ctx2.textAlign = 'right'; x = el.x - 4; dentro = true; }
        if (dentro) { ctx2.strokeStyle = 'rgba(15,23,42,.55)'; ctx2.lineWidth = 2.5; ctx2.strokeText(t, x, y); ctx2.fillStyle = '#ffffff'; ctx2.fillText(t, x, y); }
        else { ctx2.strokeStyle = 'rgba(255,255,255,.95)'; ctx2.lineWidth = 3.5; ctx2.strokeText(t, x, y);
        ctx2.fillStyle = '#0f172a'; ctx2.fillText(t, x, y); }
        ctx2.textAlign = 'center';
      });
    });
    ctx2.restore();
  }
  function imagen(canvas) {
    var w = canvas.width, h = canvas.height; if (!w || !h) return null;
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var x = c.getContext('2d'); x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h); x.drawImage(canvas, 0, 0);
    /* _BS_PDF_ETIQ_GRUPO_V3: en barras/lineas (no apiladas) las etiquetas de pantalla se encimaban; para el PDF se
       apagan un instante, se copia el grafico limpio y se rotulan ordenadas. La pantalla vuelve a quedar igual. */
    var ch = null, dl = null, antes, forzar = false;
    try {
      ch = window.Chart && Chart.getChart && Chart.getChart(canvas);
      var o = ch && ch.options, sc = o && o.scales || {}, apil = !!((sc.x && sc.x.stacked) || (sc.y && sc.y.stacked));
      var t0 = ch && ch.config.type, cart = t0 === 'bar' || t0 === 'line';
      dl = o && o.plugins && o.plugins.datalabels;
      if (ch && cart && !apil && dl && yaEtiquetado(ch, 0)) { antes = dl.display; dl.display = false; ch.update('none'); forzar = true;
        x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h); x.drawImage(canvas, 0, 0); }
    } catch (e) { forzar = false; }
    try { etiquetar(canvas, x, forzar); } catch (e) { console.warn('[_BS_PDF_ETIQUETAS_V1]', e && e.message); }
    if (forzar) { try { dl.display = antes; if (antes === undefined) delete dl.display; ch.update('none'); } catch (e) {} }
    return { src: c.toDataURL('image/png'), r: w / h };
  }
  function usuario() { try { var u = JSON.parse(localStorage.getItem('bienestarSocialAuth') || '{}'); return u.nombre || u.usuario || ''; } catch (e) { return ''; } }

  /* ── motor ── */
  async function exportar(D) {
    await asegurarLibs();
    var doc = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    var W = 297, H = 210, MG = 12, bW = W - 2 * MG, y = 0;
    var nueva = function () { doc.addPage(); y = 14; };
    var salto = function (need) { if (y + need > H - 14) nueva(); };
    /* cabecera */
    doc.setFillColor.apply(doc, NAVY); doc.rect(0, 0, W, 26, 'F'); doc.setFillColor.apply(doc, ROJO); doc.rect(0, 26, W, 1, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.text('BIENESTAR SOCIAL  ·  UNIFRUTTI PERÚ  ·  RELACIONES LABORALES', MG, 8.5);
    doc.setFontSize(15); doc.text(limpio(D.titulo || 'Dashboard'), MG, 17);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(203, 213, 225); if (D.subtitulo) doc.text(limpio(D.subtitulo), MG, 22.5);
    doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255); doc.setFontSize(8.5);
    var hoy = new Date(); doc.text('Emitido: ' + hoy.toLocaleDateString('es-PE') + ' ' + hoy.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }), W - MG, 12, { align: 'right' });
    var u = usuario(); if (u) { doc.setFont('helvetica', 'normal'); doc.text('Por: ' + limpio(u), W - MG, 18, { align: 'right' }); }
    y = 33;
    /* ── bloques reutilizables ── */
    function rgbDe(c, def) {   /* "rgb(22, 163, 74)" o "#16a34a" -> [r,g,b] */
      var m = String(c || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/); if (m) return [+m[1], +m[2], +m[3]];
      m = String(c || '').match(/^#([0-9a-f]{6})$/i); if (m) { var n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
      return def || NAVY;
    }
    function dibujarKpis(lista, grande) {
      var K = (lista || []).filter(function (k) { return k[1] !== '' && k[1] != null; }); if (!K.length) return;
      var porFila = Math.min(K.length, 5), gap = 4, cw = (bW - gap * (porFila - 1)) / porFila, ch = grande ? 22 : 18;
      K.forEach(function (k, n) {
        var col = n % porFila; if (col === 0 && n) y += ch + gap; if (col === 0) salto(ch + 2);
        var x = MG + col * (cw + gap), color = rgbDe(k[3], NAVY);
        doc.setDrawColor.apply(doc, LINEA); doc.setFillColor(grande ? 255 : 248, grande ? 255 : 250, grande ? 255 : 252); doc.roundedRect(x, y, cw, ch, 2.5, 2.5, 'FD');
        doc.setFillColor.apply(doc, color); doc.rect(x, y + 3, 1.3, ch - 6, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(grande ? 16 : 13.5); doc.setTextColor.apply(doc, k[3] ? color : TX);
        doc.text(doc.splitTextToSize(limpio(k[1]), cw - 8)[0], x + 5, y + (grande ? 9.5 : 8));
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.4); doc.setTextColor.apply(doc, GRIS);
        doc.text(doc.splitTextToSize(limpio(k[0]).toUpperCase(), cw - 8)[0], x + 5, y + (grande ? 14.5 : 12.8));
        if (k[2]) { doc.setFont('helvetica', 'bold'); doc.setFontSize(7.2); doc.setTextColor.apply(doc, color); doc.text(doc.splitTextToSize(limpio(k[2]), cw - 8)[0], x + 5, y + (grande ? 19 : 16.3)); }
      });
      y += ch + 5;
    }
    function dibujarBarras(lista) {
      (lista || []).forEach(function (b) {
        var P = (b.partes || []).filter(function (x) { return x.pct > 0; }); if (!P.length) return;
        salto(20);
        doc.setDrawColor.apply(doc, LINEA); doc.setFillColor(255, 255, 255); doc.roundedRect(MG, y, bW, 17, 2.5, 2.5, 'FD');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor.apply(doc, NAVY); doc.text(limpio(b.titulo || '').toUpperCase(), MG + 4, y + 5.5);
        var x = MG + 4, w = bW - 8, tot = P.reduce(function (s, x2) { return s + x2.pct; }, 0) || 1;
        P.forEach(function (p, n) { var ww = w * p.pct / tot; doc.setFillColor.apply(doc, rgbDe(p.color)); doc.roundedRect(x, y + 7.5, Math.max(ww - (n < P.length - 1 ? 0.6 : 0), 1), 3, 1.5, 1.5, 'F'); x += ww; });
        var lx = MG + 4; doc.setFontSize(7.4);
        P.forEach(function (p) { doc.setFillColor.apply(doc, rgbDe(p.color)); doc.rect(lx, y + 12.6, 2.2, 2.2, 'F'); doc.setFont('helvetica', 'normal'); doc.setTextColor.apply(doc, TX); var t = limpio(p.label); doc.text(t, lx + 3.4, y + 14.4); lx += doc.getTextWidth(t) + 12; });
        y += 21;
      });
    }
    function dibujarFiltros() {
      var F = (D.filtros || []).filter(function (f) { return f[1]; }); if (!F.length) return;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
      var linea = F.map(function (f) { return f[0] + ': ' + f[1]; }).join('     ·     ');
      var ls = doc.splitTextToSize('Filtros aplicados  —  ' + limpio(linea), bW - 8);
      salto(4.6 * ls.length + 6);
      doc.setFillColor(238, 242, 255); doc.roundedRect(MG, y, bW, 4.6 * ls.length + 3, 2, 2, 'F');
      doc.setTextColor(30, 58, 138); ls.forEach(function (l, n) { doc.text(l, MG + 4, y + 4.5 + n * 4.6); }); y += 4.6 * ls.length + 7;
    }
    /* tabla a la izquierda y grafico a la derecha, en la misma fila (como en pantalla) */
    function dibujarMixto(lista) {
      (lista || []).forEach(function (m) {
        var im = m.grafico && imagen(m.grafico.canvas); if (!m.tabla || !m.tabla.table) return;
        var wL = bW * 0.5 - 2.5, wR = bW - wL - 5, alto = 78;
        salto(alto + 2);
        var y0 = y;
        doc.setDrawColor.apply(doc, LINEA); doc.setFillColor(255, 255, 255); doc.roundedRect(MG, y0, wL, alto, 2.5, 2.5, 'FD'); doc.roundedRect(MG + wL + 5, y0, wR, alto, 2.5, 2.5, 'FD');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor.apply(doc, NAVY);
        doc.text(limpio(m.tabla.titulo || 'Resumen'), MG + 4, y0 + 6.3);
        doc.autoTable({ html: m.tabla.table, startY: y0 + 10, margin: { left: MG + 3, right: W - MG - wL + 3 }, tableWidth: wL - 6, theme: 'grid', useCss: false,
          headStyles: { fillColor: NAVY, textColor: 255, fontSize: 7.6 }, styles: { fontSize: 7.8, cellPadding: 1.8, textColor: TX, lineColor: LINEA },
          alternateRowStyles: { fillColor: SUAVE },
          didParseCell: function (h) { h.cell.text = (h.cell.text || []).map(limpio); if (h.column.index > 0) h.cell.styles.halign = 'right';
            if (h.section === 'body' && /^TOTAL/i.test(String(h.row.raw && h.row.raw[0] && (h.row.raw[0].content || h.row.raw[0].innerText || '')))) h.cell.styles.fontStyle = 'bold'; } });
        if (im) {
          doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor.apply(doc, NAVY); doc.text(limpio(m.grafico.titulo || ''), MG + wL + 9, y0 + 6.3);
          var cw2 = wR - 8, ch2 = alto - 14, wi = Math.min(cw2, ch2 * im.r), hi = wi / im.r; if (hi > ch2) { hi = ch2; wi = hi * im.r; }
          doc.addImage(im.src, 'PNG', MG + wL + 5 + (wR - wi) / 2, y0 + 10, wi, hi, undefined, 'FAST');
        }
        y = Math.max(y0 + alto, (doc.lastAutoTable && doc.lastAutoTable.finalY) || 0) + 5;
      });
    }
    /* orden: tarjetas -> barras -> filtros -> indicadores -> tabla+grafico -> graficos -> tablas -> notas */
    dibujarKpis(D.tarjetas, true);
    dibujarBarras(D.barras);
    dibujarFiltros();
    dibujarKpis(D.kpis, false);
    dibujarMixto(D.mixto);
    /* tablas (antes o despues de los graficos segun D.tablasPrimero) */
    function pintarTablas() {
    (D.tablas || []).forEach(function (t) {
      if (!t.table || !t.table.rows || t.table.rows.length < 2) return;
      salto(22); doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor.apply(doc, NAVY); doc.text(limpio(t.titulo || 'Detalle'), MG, y + 4); y += 7;
      doc.autoTable({ html: t.table, startY: y, margin: { left: MG, right: MG }, theme: 'grid', useCss: false,
        headStyles: { fillColor: NAVY, textColor: 255, fontSize: 7.8 }, styles: { fontSize: 7.5, cellPadding: 1.6, textColor: TX, lineColor: LINEA, overflow: 'linebreak' },
        alternateRowStyles: { fillColor: SUAVE }, didParseCell: function (h) { h.cell.text = (h.cell.text || []).map(limpio); } });
      y = doc.lastAutoTable.finalY + 6;
    });
    }
    if (D.tablasPrimero) pintarTablas();
    /* graficos: filas de 3 (redondos/cuadrados), de 2 (medianos) o a todo el ancho (series largas) */
    var G = (D.graficos || []).map(function (g) { var im = imagen(g.canvas); return im ? { t: limpio(g.titulo), im: im } : null; }).filter(Boolean);
    var tipo = function (g) { return g.im.r > 2.4 ? 'L' : g.im.r > 1.55 ? 'M' : 'S'; };
    var gap2 = 5, i = 0;
    while (i < G.length) {
      var t0 = tipo(G[i]), n0 = t0 === 'L' ? 1 : t0 === 'M' ? 2 : 3, fila = [G[i]];
      while (fila.length < n0 && G[i + fila.length] && tipo(G[i + fila.length]) !== 'L') fila.push(G[i + fila.length]);
      var cols = Math.max(fila.length, t0 === 'L' ? 1 : (t0 === 'M' ? 2 : 3)), wC = (bW - gap2 * (cols - 1)) / cols;
      var tope = t0 === 'L' ? 48 : t0 === 'M' ? 56 : 47;
      var hImg = Math.min(tope, fila.reduce(function (m, g) { return Math.max(m, (wC - 8) / g.im.r); }, 0)), cardH = hImg + 13;
      salto(cardH + 2);
      fila.forEach(function (g, j) {
        var x = MG + j * (wC + gap2);
        doc.setDrawColor.apply(doc, LINEA); doc.setFillColor(255, 255, 255); doc.roundedRect(x, y, wC, cardH, 2.5, 2.5, 'FD');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor.apply(doc, NAVY); doc.text(doc.splitTextToSize(g.t || 'Gráfico', wC - 8)[0], x + 4, y + 6.3);
        var wi = Math.min(wC - 8, hImg * g.im.r), hi = wi / g.im.r; if (hi > hImg) { hi = hImg; wi = hi * g.im.r; }
        doc.addImage(g.im.src, 'PNG', x + (wC - wi) / 2, y + 9.5, wi, hi, undefined, 'FAST');
      });
      y += cardH + 4; i += fila.length;
    }
    if (!D.tablasPrimero) pintarTablas();
    /* notas */
    (D.notas || []).filter(Boolean).forEach(function (n) {
      doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor.apply(doc, GRIS);
      doc.splitTextToSize(limpio(n), bW).forEach(function (l) { salto(5); doc.text(l, MG, y); y += 4; }); y += 2;
    });
    /* pie */
    var tp = doc.getNumberOfPages();
    for (var p = 1; p <= tp; p++) {
      doc.setPage(p); doc.setDrawColor.apply(doc, LINEA); doc.line(MG, H - 9, W - MG, H - 9);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.2); doc.setTextColor.apply(doc, GRIS);
      doc.text('Bienestar Social · Unifrutti Perú · Documento de gestión — uso interno', MG, H - 5);
      doc.text('Página ' + p + ' de ' + tp, W - MG, H - 5, { align: 'right' });
    }
    var f = (D.archivo || D.titulo || 'Dashboard').replace(/[^\w\-áéíóúñÁÉÍÓÚÑ ]+/g, '').trim().replace(/\s+/g, '_');
    doc.save(f + '_' + hoy.toISOString().slice(0, 10) + '.pdf');
  }
  async function seguro(fnDatos, btn) {
    var t0 = btn ? btn.innerHTML : '';
    try { if (btn) { btn.disabled = true; btn.innerHTML = '⏳ Generando PDF…'; } await exportar(fnDatos()); }
    catch (e) { console.error('[_BS_PDF_GERENCIAL_V1]', e); alert('No se pudo generar el PDF: ' + (e && e.message ? e.message : e) + '\nRevisa tu conexión e inténtalo de nuevo.'); }
    finally { if (btn) { btn.disabled = false; btn.innerHTML = t0; } }
  }

  /* ── 1) dashboards en ventana (Hallazgos bsdq, Accidentes bsda, Subsidios bsds) ── */
  function datosOverlay(p, ov) {
    var bar = ov.querySelector('.' + p + '-bar');
    var titulo = txt(bar && bar.querySelector('p')) || txt(bar && bar.querySelector('h1')) || 'Dashboard';
    var filtros = Array.prototype.map.call(ov.querySelectorAll('.' + p + '-grp'), function (g) {
      var on = Array.prototype.map.call(g.querySelectorAll('.on, .act, [aria-pressed="true"]'), txt).filter(Boolean);
      return [txt(g.querySelector('h4')), on.length ? on.join(', ') : 'Todos'];
    });
    var kpis = Array.prototype.map.call(ov.querySelectorAll('.' + p + '-hero .' + p + '-hc'), function (h) { return [txt(h.querySelector('.lbl')), txt(h.querySelector('.big')), txt(h.querySelector('.sub'))]; });
    var graficos = [], tablas = [];
    Array.prototype.forEach.call(ov.querySelectorAll('.' + p + '-grid .' + p + '-c'), function (c) {
      var t = txt(c.querySelector('.h')), cv = c.querySelector('canvas'), tb = c.querySelector('table');
      if (cv && visible(cv)) graficos.push({ titulo: t, canvas: cv });
      else if (tb) tablas.push({ titulo: t, table: tb });
      else { var n = txt(c.querySelector('.n, .big')); if (n) kpis.push([t, n, txt(c.querySelector('.t'))]); }
    });
    Array.prototype.forEach.call(ov.querySelectorAll('table'), function (tb) { if (!tablas.some(function (x) { return x.table === tb; }) && visible(tb)) tablas.push({ titulo: 'Detalle', table: tb }); });
    var notas = Array.prototype.map.call(ov.querySelectorAll('.' + p + '-note, .' + p + '-alert'), txt);
    return { titulo: titulo, subtitulo: 'Dashboard del indicador · ' + (txt(ov.querySelector('[id$="Upd"]')) || 'datos en vivo'), filtros: filtros, kpis: kpis, graficos: graficos, tablas: tablas, notas: notas, archivo: 'Dashboard_' + titulo };
  }
  function botonOverlay(p) {
    var ov = document.querySelector('.' + p + '-ov'); if (!ov || ov.querySelector('.bspg-btn')) return;
    var x = ov.querySelector('.' + p + '-x'); if (!x) return;
    var b = document.createElement('button'); b.type = 'button'; b.className = 'bspg-btn'; b.innerHTML = '📄 Exportar PDF';
    b.style.cssText = 'border:0;border-radius:10px;padding:8px 14px;background:#dc2626;color:#fff;font-weight:800;font-size:.78rem;cursor:pointer;box-shadow:0 4px 12px rgba(220,38,38,.3);margin-right:4px';
    b.onclick = function () { seguro(function () { return datosOverlay(p, ov); }, b); };
    x.parentNode.insertBefore(b, x);
  }
  function vigilar() { ['bsdq', 'bsda', 'bsds'].forEach(botonOverlay); }

  /* ── 2) paginas completas: Panel / Dashboard y Estadisticas ── */
  function datosPagina(titulo, raiz) {
    raiz = raiz || document.querySelector('main') || document.body;
    var filtros = [];
    Array.prototype.forEach.call(raiz.querySelectorAll('select'), function (s) { if (!visible(s) || !s.value) return; var l = s.closest('label, .bs-form-group, div'); var lab = l && l.querySelector('label'); filtros.push([txt(lab) || s.id, txt(s.options[s.selectedIndex])]); });
    Array.prototype.forEach.call(raiz.querySelectorAll('.pill.on, .chip.on, button.on, .on[data-e]'), function (b) { if (visible(b)) filtros.push(['Filtro', txt(b)]); });
    var kpis = [];
    Array.prototype.forEach.call(raiz.querySelectorAll('.kpi, .est-kpis > *, .k-card, .bskp-card'), function (k) {
      if (!visible(k)) return;
      var v = k.querySelector('.k-big, .big, .num, .val, .valor, b, strong'), lab = k.querySelector('.k-title, .lbl, .label, .t, small, span');
      var vt = txt(v), lt = txt(lab) || txt(k).replace(vt, '');
      var sub = Array.prototype.map.call(k.querySelectorAll('.pill'), function (p) { return txt(p); }).join(' · ');
      if (vt) kpis.push([lt, vt, sub]);
    });
    var graficos = [];
    Array.prototype.forEach.call(raiz.querySelectorAll('canvas'), function (cv) {
      if (!visible(cv)) return;
      var cont = cv.parentElement, t = '';
      for (var i = 0; i < 4 && cont && !t; i++) { var h = cont.querySelector('h2, h3, h4, .est-card-title, .card-t, .h'); if (h && h.compareDocumentPosition(cv) & Node.DOCUMENT_POSITION_FOLLOWING) t = txt(h); cont = cont.parentElement; }
      graficos.push({ titulo: t, canvas: cv });
    });
    var tablas = Array.prototype.filter.call(raiz.querySelectorAll('table'), visible).map(function (tb) {
      var c = tb.closest('.bs-card, .card, section, div'), h = c && c.querySelector('h2, h3, h4, .est-card-title, .card-t'); return { titulo: txt(h) || 'Detalle', table: tb };
    });
    return { titulo: titulo, subtitulo: 'Reporte gerencial', filtros: filtros, kpis: kpis, graficos: graficos, tablas: tablas, archivo: titulo };
  }
  /* ── 3) Rendiciones: el reporte en vivo (#reporteContainer) ── */
  function datosRendiciones() {
    var cont = document.getElementById('reporteContainer');
    if (!cont || !cont.innerHTML.trim()) throw new Error('No hay datos para el reporte con los filtros actuales.');
    var v = function (id) { var e = document.getElementById(id); return e ? (e.tagName === 'SELECT' ? (e.value ? txt(e.options[e.selectedIndex]) : '') : e.value) : ''; };
    var d = v('filterDesde'), h = v('filterHasta');
    var filtros = [['Año', v('filterAnio') || 'Todos'], ['Empresa', v('filterEmpresa') || 'Todas'], ['Responsable', v('filterResponsable') || 'Todos'],
      ['Estado', v('filterEstado') || 'Todos'], ['Categoría', v('filterCategoria') || 'Todas'], ['Periodo', (d || h) ? (d || '…') + ' a ' + (h || '…') : '']];
    /* tarjetas superiores (#kpiRendiciones) y barra "Monto por estado de deposito" */
    var COL = [null, [22, 163, 74], [217, 119, 6], [37, 99, 235]];
    var tarjetas = Array.prototype.map.call(document.querySelectorAll('#kpiRendiciones .bskp-card'), function (c, n) {
      var col = COL[n] ? 'rgb(' + COL[n].join(',') + ')' : '';
      return [txt(c.querySelector('.bskp-lbl')), txt(c.querySelector('.bskp-val')), txt(c.querySelector('.bskp-sub')), col];
    });
    var barras = Array.prototype.map.call(document.querySelectorAll('#kpiRendiciones .bskp-dist'), function (b) {
      var segs = b.querySelectorAll('.bskp-bar > i'), leg = b.querySelectorAll('.bskp-leg > span');
      return { titulo: txt(b.querySelector('.t')), partes: Array.prototype.map.call(segs, function (sg, n) {
        return { pct: parseFloat(sg.style.width) || 0, color: sg.style.background || sg.style.backgroundColor, label: txt(leg[n]) }; }) };
    });
    /* indicadores del reporte (con descuadre en rojo) */
    var kpis = [], fila = cont.firstElementChild;
    if (fila) Array.prototype.forEach.call(fila.querySelectorAll('.bs-card'), function (c) { var ds = c.children; if (ds.length >= 2) kpis.push([txt(ds[0]), txt(ds[1]), '', getComputedStyle(ds[1]).color]); });
    /* tabla + primer grafico lado a lado; el resto de graficos en filas */
    var tabla = cont.querySelector('table'), cvs = Array.prototype.slice.call(cont.querySelectorAll('canvas'));
    var tit = function (el) { var card = el && el.closest('.bs-card'); return txt(card && card.querySelector('.bs-text-sm')); };
    var mixto = tabla ? [{ tabla: { titulo: tit(tabla) || 'Resumen por empresa y categoría', table: tabla }, grafico: cvs[0] ? { titulo: tit(cvs[0]), canvas: cvs[0] } : null }] : [];
    var graficos = cvs.slice(tabla ? 1 : 0).map(function (cv) { return { titulo: tit(cv), canvas: cv }; });
    return { titulo: 'Reporte de Rendiciones', subtitulo: 'Rendiciones de gastos · Bienestar Social', tarjetas: tarjetas, barras: barras, filtros: filtros, kpis: kpis,
      mixto: mixto, graficos: graficos, tablas: [], archivo: 'Reporte_Rendiciones' };
  }
  function enganchePaginas() {
    var path = location.pathname;
    if (/\/panel\.html$/.test(path) && !window._bspgPanel) { window._bspgPanel = true;
      window.exportarPDF = function () { var b = document.querySelector('[onclick*="exportarPDF"]'); seguro(function () { return datosPagina('Panel de Bienestar Social'); }, b); }; }
    if (/rendiciones\.html$/.test(path)) {   /* el boton "📄 Reporte PDF" lo crea la pagina: se le cambia la accion */
      var bR = document.getElementById('btnPDF');
      if (bR && !bR._bspg) { bR._bspg = true; bR.onclick = function () { seguro(datosRendiciones, bR); }; }
    }
    if (/estadisticas\.html$/.test(path) && !window._bspgEst) { window._bspgEst = true;
      window.exportPDF = function () { var b = document.querySelector('[onclick*="exportPDF"]'); seguro(function () { return datosPagina('Estadísticas de Bienestar Social'); }, b); }; }
  }

  window.BSPdfGerencial = { exportar: exportar, datosOverlay: datosOverlay, datosPagina: datosPagina };
  function iniciar() {
    vigilar(); enganchePaginas(); setTimeout(enganchePaginas, 1500);
    if (window.MutationObserver) new MutationObserver(function () { vigilar(); }).observe(document.body, { childList: true, subtree: false });
    setInterval(vigilar, 1500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
  window.addEventListener('load', enganchePaginas);
})();
