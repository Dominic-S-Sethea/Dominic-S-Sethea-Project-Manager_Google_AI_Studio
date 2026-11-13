# Project Manager - Dev Launcher
# Right-click -> "Run with PowerShell" or double-click if .ps1 associated

Write-Host "========================================" -ForegroundColor Green
Write-Host "  Project Manager - Auto Launcher" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

Write-Host "Starting Backend (port 3003)..." -ForegroundColor Cyan
$backend = Start-Process cmd -ArgumentList "/k", "cd /d '$PSScriptRootackend' && npm run dev" -PassThru

Start-Sleep 3

Write-Host "Starting Frontend (port 5173)..." -ForegroundColor Cyan
$frontend = Start-Process cmd -ArgumentList "/k", "cd /d '$PSScriptRootrontend' && npx vite --port 5173 --host 0.0.0.0" -PassThru

Start-Sleep 5

Write-Host "Opening browser..." -ForegroundColor Cyan
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Both servers running!" -ForegroundColor Green
Write-Host "  Backend:  http://localhost:3003" -ForegroundColor Gray
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor Gray
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Press any key to stop servers and exit..." -ForegroundColor Yellow

$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Cleanup
Stop-Process -Id $backend.Id -Force -ErrorAction SilentlyContinue
Stop-Process -Id $frontend.Id -Force -ErrorAction SilentlyContinue
Write-Host "Servers stopped." -ForegroundColor Red
