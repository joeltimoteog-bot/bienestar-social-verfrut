/* Bienestar Social · modulos/quejas.html · bloque 4 (antes en la linea 1205) · extraido el 26-oct-2026 sin cambios (_BS_MODULAR_V1) */
(function () {
  var ADM = ['jtimoteo', 'ovilela'];
  var es = /admin|geren/i.test(user.rol || '') || ADM.indexOf(String(user.usuario || '').toLowerCase()) >= 0;
  if (es) document.getElementById('btnCierreMasivo').style.display = '';
})();
function abrirCierreMasivo() {
  var y = new Date().getFullYear();
  document.getElementById('cmFecha').value = y + '-01-01';
  document.getElementById('cmMotivo').value = '';
  document.getElementById('cmPreview').textContent = '—';
  document.getElementById('cmBtn').disabled = true;
  document.getElementById('modalCierre').classList.add('bs-active');
}
async function previsualizarCierre() {
  var f = document.getElementById('cmFecha').value; if (!f) { appAlert('Indica la fecha de corte.'); return; }
  var pv = document.getElementById('cmPreview'); pv.textContent = 'Calculando…';
  try {
    var r = await api('bs_cierreMasivoQuejas', { usuario: user.usuario, fecha_corte: f, simular: true });
    if (!r.ok) { pv.textContent = r.message || 'Error'; return; }
    pv.innerHTML = r.total + ' hallazgo(s)' + (r.total ? ' <span class="bs-text-xs bs-text-muted">(' + Object.keys(r.porEmpresa).map(function (k) { return k + ': ' + r.porEmpresa[k]; }).join(' · ') + ')</span>' : '');
    document.getElementById('cmBtn').disabled = !r.total;
  } catch (e) { pv.textContent = e.message; }
}
async function ejecutarCierreMasivo(ev) {
  ev.preventDefault();
  var f = document.getElementById('cmFecha').value, m = document.getElementById('cmMotivo').value.trim(), n = document.getElementById('cmPreview').textContent;
  if (!(await appConfirm('Se cerrarán ' + n + ' anteriores a ' + f + '.\n\nEsta acción queda registrada en Auditoría y no se puede deshacer en bloque. ¿Continuar?'))) return;
  var b = document.getElementById('cmBtn'); b.disabled = true; b.textContent = 'Cerrando…';
  try {
    var r = await api('bs_cierreMasivoQuejas', { usuario: user.usuario, fecha_corte: f, motivo: m });
    appAlert(r.message || (r.ok ? 'Listo.' : 'No se pudo completar.'));
    if (r.ok) { document.getElementById('modalCierre').classList.remove('bs-active'); try { sessionStorage.clear(); } catch (e) {} cargarQuejas(); }
  } catch (e) { appAlert('Error: ' + e.message); }
  finally { b.textContent = 'Cerrar hallazgos'; }
}
