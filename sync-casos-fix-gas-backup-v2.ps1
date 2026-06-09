# ============================================================
#  Sincronizar backup local de codigo.gs con el fix de Casos (v2)
#  v2: literales ASCII-only para evitar la trampa de PS 5.1 que
#      lee los .ps1 como ANSI y rompe los acentos del script.
# ============================================================
$ErrorActionPreference = 'Stop'
$path = 'C:\sistema-rl-verfrut\backend\gas\codigo.gs'

# --- Backup ---
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
Copy-Item $path "$path.$stamp.bak" -Force
Write-Host "Backup: codigo.gs.$stamp.bak" -ForegroundColor Yellow

# --- Detectar BOM ---
$rawBytes = [System.IO.File]::ReadAllBytes($path)
$hasBom = ($rawBytes.Length -ge 3 -and $rawBytes[0] -eq 0xEF -and $rawBytes[1] -eq 0xBB -and $rawBytes[2] -eq 0xBF)
$enc = New-Object System.Text.UTF8Encoding($hasBom)

# --- Leer UTF-8 EXPLICITO ---
$c = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)

# --- Sanity checks ASCII-only ---
$eth = [char]0x00F0   # firma de mojibake (codepoint, no depende del encoding del .ps1)
if ($c.Contains($eth))                          { Write-Host "ABORTADO: mojibake detectado al leer." -ForegroundColor Red; return }
if (-not $c.Contains("function saveCaso(d)"))   { Write-Host "ABORTADO: no se hallo 'function saveCaso(d)' en el archivo." -ForegroundColor Red; return }
if (-not $c.Contains("function updateCaso(d)")) { Write-Host "ABORTADO: no se hallo 'function updateCaso(d)' en el archivo." -ForegroundColor Red; return }

# --- EDIT 1: saveCaso ---
$a1 = "        d.estado || '',"
$b1 = "        d.estado_caso || d.estado_plazo || d.estado || '',"
if ($c.Contains("d.estado_caso || d.estado_plazo || d.estado || ''")) {
  Write-Host "EDIT 1 ya aplicado, saltando." -ForegroundColor Yellow
} else {
  $n1 = ([regex]::Matches($c, [regex]::Escape($a1))).Count
  if ($n1 -eq 0) { Write-Host "ABORTADO: ancla EDIT 1 no encontrada." -ForegroundColor Red; return }
  if ($n1 -gt 1) { Write-Host "ABORTADO: ancla EDIT 1 ambigua ($n1 ocurrencias)." -ForegroundColor Red; return }
  $c = $c.Replace($a1, $b1)
  Write-Host "EDIT 1 aplicado (saveCaso)" -ForegroundColor Green
}

# --- EDIT 2: updateCaso ---
$nl = "`r`n"
$a2 = "if (d.estado         !== undefined) ws.getRange(r, 16).setValue(d.estado);"
$b2 = "if (d.estado_caso !== undefined) ws.getRange(r, 16).setValue(d.estado_caso);" + $nl +
      "          else if (d.estado_plazo !== undefined) ws.getRange(r, 16).setValue(d.estado_plazo);" + $nl +
      "          else if (d.estado !== undefined) ws.getRange(r, 16).setValue(d.estado);"
if ($c.Contains("d.estado_caso !== undefined) ws.getRange(r, 16)")) {
  Write-Host "EDIT 2 ya aplicado, saltando." -ForegroundColor Yellow
} else {
  $n2 = ([regex]::Matches($c, [regex]::Escape($a2))).Count
  if ($n2 -eq 0) { Write-Host "ABORTADO: ancla EDIT 2 no encontrada." -ForegroundColor Red; return }
  if ($n2 -gt 1) { Write-Host "ABORTADO: ancla EDIT 2 ambigua ($n2 ocurrencias)." -ForegroundColor Red; return }
  $c = $c.Replace($a2, $b2)
  Write-Host "EDIT 2 aplicado (updateCaso)" -ForegroundColor Green
}

# --- Escribir UTF-8 (preservando BOM si lo tenia) ---
[System.IO.File]::WriteAllText($path, $c, $enc)

# --- Verificacion de integridad ---
$v = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
$ok = $true
Write-Host ""
Write-Host "=== VERIFICACION DE INTEGRIDAD ===" -ForegroundColor Cyan
if ($v.Contains($eth))                          { Write-Host "  [X] Mojibake - CORRUPTO" -ForegroundColor Red; $ok = $false } else { Write-Host "  [OK] Sin mojibake" -ForegroundColor Green }
if ($v.Contains("function saveCaso(d)") -and $v.Contains("function updateCaso(d)")) { Write-Host "  [OK] Estructura intacta" -ForegroundColor Green } else { Write-Host "  [X] Estructura rota" -ForegroundColor Red; $ok = $false }
if ($v.Contains("d.estado_caso || d.estado_plazo || d.estado || ''")) { Write-Host "  [OK] EDIT 1 presente" -ForegroundColor Green } else { Write-Host "  [X] EDIT 1 ausente" -ForegroundColor Red; $ok = $false }
if ($v.Contains("d.estado_caso !== undefined) ws.getRange(r, 16)"))   { Write-Host "  [OK] EDIT 2 presente" -ForegroundColor Green } else { Write-Host "  [X] EDIT 2 ausente" -ForegroundColor Red; $ok = $false }

Write-Host ""
if ($ok) {
  Write-Host "INTEGRIDAD OK. Subir con:" -ForegroundColor Green
  Write-Host "   cd C:\sistema-rl-verfrut" -ForegroundColor White
  Write-Host "   git add backend/gas/codigo.gs" -ForegroundColor White
  Write-Host '   git commit -m "fix(casos): updateCaso/saveCaso aceptan estado_caso (alias de estado)"' -ForegroundColor White
  Write-Host "   git push origin main" -ForegroundColor White
} else {
  Write-Host "FALLO LA VERIFICACION. NO SUBAS. Restaura con:" -ForegroundColor Red
  Write-Host ("   Copy-Item `"" + $path + "." + $stamp + ".bak`" `"" + $path + "`" -Force") -ForegroundColor White
}
