# ============================================================
#  add-export.ps1
#  Inserta el boton "Exportar Excel" antes de </body> en los
#  4 modulos de Bienestar Social.
#  - Crea respaldo .bak de cada archivo antes de modificar.
#  - Es idempotente: si el archivo ya tiene el boton, lo omite.
# ============================================================

$repo = "C:\bienestar-social-verfrut\modulos"
$archivos = @("quejas.html","accidentes.html","hostigamiento.html","subsidios.html")

# --- Bloque a insertar (here-string literal: no se expande nada) ---
$snippet = @'
<!-- === BS-EXPORT-EXCEL : Exportar a Excel (reutilizable) === -->
<script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
<script>
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
  function exportar(){
    if (typeof XLSX === 'undefined'){ alert('La libreria de Excel se esta cargando, intenta de nuevo en unos segundos.'); return; }
    var tabla = tablaPrincipal();
    if(!tabla || !tabla.querySelectorAll('tbody tr').length){ alert('No hay datos en la tabla para exportar.'); return; }
    var wb = XLSX.utils.book_new();
    var ws = XLSX.utils.table_to_sheet(tabla, {raw:true});
    XLSX.utils.book_append_sheet(wb, ws, 'Datos');
    var nombre = (document.title || 'Bienestar').replace(/[^\w\-]+/g,'_').slice(0,40);
    XLSX.writeFile(wb, nombre + '_' + new Date().toISOString().slice(0,10) + '.xlsx');
  }
  var btn = document.createElement('button');
  btn.textContent = '\u2B07\uFE0F Exportar Excel';
  btn.onclick = exportar;
  btn.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:9999;background:#0033A0;color:#fff;border:none;padding:11px 16px;border-radius:10px;cursor:pointer;font:600 14px Segoe UI,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.25)';
  function poner(){ document.body.appendChild(btn); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', poner); else poner();
})();
</script>
'@

$utf8 = New-Object System.Text.UTF8Encoding $false   # UTF-8 sin BOM

foreach ($a in $archivos) {
  $f = Join-Path $repo $a
  if (-not (Test-Path $f)) { Write-Host "[X] No existe: $f" -ForegroundColor Red; continue }

  $c = [System.IO.File]::ReadAllText($f)

  if ($c -match 'BS-EXPORT-EXCEL') {
    Write-Host "[=] Ya tiene el boton, omito: $a" -ForegroundColor Yellow
    continue
  }

  # Busca la ULTIMA aparicion de </body> (sin importar mayus/minus)
  $m = [regex]::Match($c, '</body>', ([System.Text.RegularExpressions.RegexOptions]'IgnoreCase, RightToLeft'))
  if (-not $m.Success) {
    Write-Host "[X] No encontre </body> en: $a (revisalo a mano)" -ForegroundColor Red
    continue
  }

  Copy-Item $f "$f.bak" -Force
  $new = $c.Substring(0, $m.Index) + $snippet + "`r`n" + $c.Substring($m.Index)
  [System.IO.File]::WriteAllText($f, $new, $utf8)
  Write-Host "[OK] Boton agregado: $a   (respaldo: $a.bak)" -ForegroundColor Green
}

Write-Host "`nListo. Revisa los mensajes de arriba." -ForegroundColor Cyan
