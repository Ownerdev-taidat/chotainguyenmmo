@echo off
title USDT Payment Server - ChoTaiNguyen
echo ============================================
echo   USDT Payment Server - ChoTaiNguyen
echo ============================================
echo.

cd /d "%~dp0"

echo [*] Checking node_modules...
if not exist "node_modules" (
    echo [!] node_modules not found. Running npm install...
    npm install
    echo.
)

echo [*] Starting USDT Payment Server...
echo [*] Press Ctrl+C to stop
echo.
npm start

pause
