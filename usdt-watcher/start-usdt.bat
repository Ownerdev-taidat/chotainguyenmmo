@echo off
title USDT Watcher - ChoTaiNguyen
echo ============================================
echo   USDT Watcher - ChoTaiNguyen
echo ============================================
echo.

cd /d "%~dp0"

echo [*] Checking node_modules...
if not exist "node_modules" (
    echo [!] node_modules not found. Running npm install...
    npm install
    npx prisma generate
    echo.
)

echo [*] Starting USDT Watcher...
echo [*] Press Ctrl+C to stop
echo.
npm start

pause
