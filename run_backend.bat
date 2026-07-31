@echo off
echo Starting FastAPI Backend...
cd /d "%~dp0backend"
call "%~dp0.venv\Scripts\activate.bat"
python run.py
pause
