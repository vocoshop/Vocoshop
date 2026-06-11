$pidFile = "$PSScriptRoot\.server-pids.json"
if (Test-Path $pidFile) {
  $pids = Get-Content $pidFile | ConvertFrom-Json
  if ($pids.backend.pid) { Stop-Process -Id $pids.backend.pid -Force -ErrorAction SilentlyContinue; Write-Host "⛔ Backend arrêté" -ForegroundColor Red }
  if ($pids.frontend.pid) { Stop-Process -Id $pids.frontend.pid -Force -ErrorAction SilentlyContinue; Write-Host "⛔ Frontend arrêté" -ForegroundColor Red }
  Remove-Item $pidFile
} else {
  Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
  Write-Host "⛔ Tous les processus Node arrêtés" -ForegroundColor Red
}
pause
