Write-Host "🚀 Démarrage des serveurs Vocoshop..." -ForegroundColor Cyan

# Backend - processus indépendant
$bp = Start-Process -FilePath "npx.cmd" -ArgumentList "ts-node-dev --respawn --transpile-only src/server.ts" -WorkingDirectory "$PSScriptRoot\vocoserver" -WindowStyle Hidden -PassThru
Write-Host "   ✅ Backend demarré (PID $($bp.Id)) - port 4000" -ForegroundColor Green
Start-Sleep 4

# Frontend - processus indépendant
$fp = Start-Process -FilePath "npx.cmd" -ArgumentList "next dev --webpack -p 3000" -WorkingDirectory "$PSScriptRoot\voco-web" -WindowStyle Hidden -PassThru
Write-Host "   ✅ Frontend démarré (PID $($fp.Id)) - port 3000" -ForegroundColor Green

Write-Host ""
Write-Host "📋 Accès :" -ForegroundColor Cyan
Write-Host "   Frontend : http://localhost:3000"
Write-Host "   Backend  : http://localhost:4000"
Write-Host ""
Write-Host "💡 Pour arrêter :" -ForegroundColor Yellow
Write-Host "   Stop-Process -Id $($bp.Id); Stop-Process -Id $($fp.Id)"
Write-Host ""

# Sauvegarde des PIDs pour arrêt facile
@{
  backend = @{ pid = $bp.Id; name = "vocoserver"; port = 4000 }
  frontend = @{ pid = $fp.Id; name = "voco-web"; port = 3000 }
} | ConvertTo-Json | Set-Content "$PSScriptRoot\.server-pids.json"

pause
