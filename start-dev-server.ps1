# Project Manager Dev Server Starter
$ErrorActionPreference = "Stop"
$backendPath = Join-Path $PSScriptRoot "backend"
$env:NODE_ENV = "development"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host ""
    Write-Host "Node.js was not found on PATH." -ForegroundColor Red
    Write-Host "Install Node.js 22 or newer from https://nodejs.org/ and re-run this script." -ForegroundColor Red
    Write-Host ""
    exit 1
}

Write-Host "Starting Project Manager Dev Server..." -ForegroundColor Green
Write-Host "URL: http://localhost:3000/" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

Set-Location $backendPath
node --experimental-strip-types src/server.ts
