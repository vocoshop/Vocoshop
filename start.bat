@echo off
echo Demarrage du serveur...
start "VocoServer" cmd /k "cd /d %~dp0vocoserver && npm run dev"

echo Demarrage du frontend...
start "VocoShop" cmd /k "cd /d %~dp0vocoshop && npx expo start"

echo Les deux projets sont maintenant lancés!
echo - Serveur: http://localhost:3000
echo - Frontend: http://localhost:8081
pause