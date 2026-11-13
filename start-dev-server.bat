@echo off
echo Starting Project Manager Dev Server...
echo.
cd /d "%~dp0backend"
set NODE_ENV=development

where node >nul 2>&1
if %errorlevel%==0 (
    node --experimental-strip-types src/server.ts
) else (
    echo.
    echo Node.js was not found on PATH.
    echo Install Node.js 22 or newer from https://nodejs.org/ and re-run this script.
    echo.
)
pause
