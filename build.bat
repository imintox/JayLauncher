@echo off
title Build Jay Launcher installer
cd /d "%~dp0"

if not exist package.json (
  echo This file must stay inside the game-launcher folder, next to package.json.
  echo Unzip the whole zip first, then open build.bat from the unzipped folder.
  pause
  exit /b 1
)

rem --- Ask for admin automatically (needed once for the signing tools) ---
net session >nul 2>&1
if %errorlevel% neq 0 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
cd /d "%~dp0"

rem --- Node.js check ---
where node >nul 2>&1
if %errorlevel% neq 0 (
  echo Node.js is not installed. Installing it now...
  winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
  echo.
  echo Node.js installed. Close this window and double-click build.bat again.
  pause
  exit /b
)

rem --- Dependencies ---
if not exist node_modules (
  call npm install
  if errorlevel 1 goto fail
)
if not exist node_modules\electron\dist (
  call node node_modules\electron\install.js
  if errorlevel 1 goto fail
)

rem --- Build ---
call npm run dist
if errorlevel 1 goto fail

echo.
echo Done. Opening the dist folder. Share "Jay Launcher Setup" with people.
explorer dist
pause
exit /b

:fail
echo.
echo Build failed. Scroll up for the error.
pause
exit /b 1
