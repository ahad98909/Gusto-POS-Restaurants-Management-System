@echo off
echo Starting React/Vite Frontend...
cd /d "%~dp0frontend"
set PATH=%PATH%;%~dp0.node-env
cmd /c npm run dev
pause
