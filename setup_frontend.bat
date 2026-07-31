@echo off
echo Installing Frontend Packages...
cd /d "%~dp0frontend"
set PATH=%PATH%;%~dp0.node-env
cmd /c npm install
pause
