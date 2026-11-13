@echo off
title Project Manager - Unified Dev Server
color 0A

echo ========================================
echo   Project Manager - Instant UI/UX
echo ========================================
echo.
echo Starting unified server (Frontend + API)...
echo.

cd /d "%~dp0backend"
start "Project Manager" cmd /k "npm run dev"

timeout /t 6 /nobreak >nul

echo Opening browser...
start "" "http://localhost:3000"

echo.
echo ========================================
echo   Server running!
echo ========================================
echo   URL: http://localhost:3000
echo.
echo   Frontend + API in one place
echo   Edit code - browser auto-refreshes
echo.
echo Close this window to stop the server.
echo.

pause
