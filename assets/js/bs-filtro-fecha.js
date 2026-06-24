/* =========================================================================
 * BS-FILTRO-FECHA  ·  Barra de botones Año + Mes (reutilizable)
 * Bienestar Social · Unifrutti Group
 * ========================================================================= */
window.BSFiltroFecha = (function () {
  'use strict';

  var MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  var cfg = {
    campoFecha: 'fecha',
    campoAnio: '',
    campoMes: '',
    color: '#0033A0',
    anchorId: 'bsFiltroFecha',
    onChange: function () {}
  };

  var estado = { anio: '', mes: '' };
  var aniosDisponibles = [];

  function normMes(v) {
    if (v === null || v === undefined || v === '') return '';
    var s = String(v).trim();
    var n = parseInt(s, 10);
    if (!isNaN(n) && n >= 1 && n <= 12) return ('0' + n).slice(-2);
    var low = s.toLowerCase().slice(0, 3);
    var nombres = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    var idx = nombres.indexOf(low);
    return idx >= 0 ? ('0' + (idx + 1)).slice(-2) : '';
  }

  function parseItem(item) {
    if (!item) return null;
    if (cfg.campoAnio) {
      var ay = item[cfg.campoAnio];
      if (ay === null || ay === undefined || String(ay).trim() === '') return null;
      var yy = String(ay).trim().slice(0, 4);
      var mm = cfg.campoMes ? normMes(item[cfg.campoMes]) : '';
      return { anio: yy, mes: mm };
    }
    var v = item[cfg.campoFecha];
    if (v === null || v === undefined || v === '') return null;
    var s = String(v);
    var base = s.indexOf('T') >= 0 ? s.split('T')[0] : s;
    var p = base.split('-');
    if (p.length >= 2 && /^\d{4}$/.test(p[0])) {
      return { anio: p[0], mes: ('0' + parseInt(p[1], 10)).slice(-2) };
    }
    var d = new Date(v);
    if (isNaN(d.getTime())) return null;
    return { anio: String(d.getFullYear()), mes: ('0' + (d.getMonth() + 1)).slice(-2) };
  }

  function pasa(item) {
    if (!estado.anio && !estado.mes) return true;
    var p = parseItem(item);
    if (!p) return false;
    if (estado.anio && p.anio !== String(estado.anio)) return false;
    if (estado.mes && p.mes !== estado.mes) return false;
    return true;
  }

  function btn(label, activo, tipo, valor) {
    var c = cfg.color;
    var css = 'cursor:pointer;border:1px solid ' + (activo ? c : '#cbd5e1') + ';' +
      'background:' + (activo ? c : '#fff') + ';color:' + (activo ? '#fff' : '#334155') + ';' +
      'padding:5px 12px;border-radius:8px;font:600 13px Inter,sans-serif;line-height:1;' +
      'transition:all .12s;';
    return '<button type="button" style="' + css + '" ' +
      'onclick="BSFiltroFecha._set(\'' + tipo + '\',\'' + valor + '\')">' + label + '</button>';
  }

  function construir() {
    var cont = document.getElementById(cfg.anchorId);
    if (!cont) return;
    var html = '';
    html += '<div class="bs-text-xs bs-text-subtle" style="text-transform:uppercase;letter-spacing:.04em;margin-bottom:.4rem;">Periodo</div>';
    html += '<div style="display:flex;gap:.35rem;flex-wrap:wrap;margin-bottom:.55rem;">';
    html += btn('Todos los años', estado.anio === '', 'anio', '');
    aniosDisponibles.forEach(function (a) {
      html += btn(a, String(estado.anio) === String(a), 'anio', a);
    });
    html += '</div>';
    html += '<div style="display:flex;gap:.35rem;flex-wrap:wrap;">';
    html += btn('Todo el año', estado.mes === '', 'mes', '');
    MESES.forEach(function (nombre, i) {
      var mm = ('0' + (i + 1)).slice(-2);
      html += btn(nombre, estado.mes === mm, 'mes', mm);
    });
    html += '</div>';
    cont.innerHTML = html;
  }

  function _set(tipo, valor) {
    estado[tipo] = valor;
    construir();
    try { cfg.onChange(); } catch (e) {}
  }

  function refrescar(items) {
    var set = {};
    (items || []).forEach(function (it) {
      var p = parseItem(it);
      if (p && p.anio) set[p.anio] = true;
    });
    aniosDisponibles = Object.keys(set).sort(function (a, b) { return Number(b) - Number(a); });
    if (estado.anio && aniosDisponibles.indexOf(String(estado.anio)) < 0) estado.anio = '';
    construir();
  }

  function init(opts) {
    opts = opts || {};
    for (var k in opts) { if (opts.hasOwnProperty(k)) cfg[k] = opts[k]; }
    construir();
  }

  function reset() {
    estado.anio = '';
    estado.mes = '';
    construir();
    try { cfg.onChange(); } catch (e) {}
  }

  return {
    init: init,
    pasa: pasa,
    refrescar: refrescar,
    reset: reset,
    estado: estado,
    _set: _set
  };
})();
