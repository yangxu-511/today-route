@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install the LTS version from https://nodejs.org and run this file again.
  pause
  exit /b 1
)

if not exist node_modules (
  echo First launch: installing local dependencies...
  call npm install
  if errorlevel 1 goto :failed
)

echo Building Today Route...
call npm run build
if errorlevel 1 goto :failed

echo.
echo Today Route is starting at http://localhost:4173
echo Use the Network address below for another device on the same Wi-Fi.
echo Close this window to stop the service.
call npm run preview -- --port 4173
exit /b %errorlevel%

:failed
echo Start failed. Keep this window open and review the message above.
pause
exit /b 1
