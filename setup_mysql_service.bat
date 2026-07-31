@echo off
:: Check for Administrator privileges
net session >nul 2>&1
if %errorLevel% == 0 (
    goto :run
) else (
    goto :elevate
)

:elevate
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b

:run
    echo Running with Administrator privileges...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "$svc = Get-Service -Name *mysql* | Select-Object -First 1; if ($svc) { Write-Host 'Found MySQL service:' $svc.DisplayName; Set-Service -Name $svc.Name -StartupType Automatic; Start-Service -Name $svc.Name; Write-Host 'MySQL Service has been successfully configured to start automatically and is now running.' -ForegroundColor Green } else { Write-Host 'Could not find any service with name matching *mysql* on this system.' -ForegroundColor Red }"
    echo.
    pause
