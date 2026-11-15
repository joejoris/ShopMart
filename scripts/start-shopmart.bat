@echo off
setlocal EnableDelayedExpansion
REM ShopMart stack starter - starts everything that is not already listening.
REM Safe to run multiple times; running services are left alone.
set ROOT=C:\projects\ecommerce
set LOGDIR=%ROOT%\.logs
if not exist "%LOGDIR%" mkdir "%LOGDIR%"

echo === ShopMart Kenya - stack starter ===

REM --- 1. MariaDB (XAMPP MySQL replacement) ---
netstat -ano | findstr ":3306" | findstr "LISTENING" >nul && (
  echo [1/5] MariaDB already running
) || (
  echo [1/5] Starting MariaDB...
  start "ShopMart-MariaDB" /MIN "C:\xampp\mysql\bin\mariadbd.exe" --defaults-file="C:\xampp\mysql\bin\my.ini" --standalone > "%LOGDIR%\mariadb.log" 2>&1
  timeout /t 8 /nobreak >nul
)

REM --- 2. API (NestJS) ---
netstat -ano | findstr ":4000" | findstr "LISTENING" >nul && (
  echo [2/5] API already running
) || (
  echo [2/5] Starting API on :4000...
  start "ShopMart-API" /MIN /D "%ROOT%\apps\api" node dist/main.js > "%LOGDIR%\api.log" 2>&1
  timeout /t 6 /nobreak >nul
)

REM --- 3. Storefront web app ---
netstat -ano | findstr ":3000" | findstr "LISTENING" >nul && (
  echo [3/5] Web already running
) || (
  echo [3/5] Starting storefront on :3000...
  start "ShopMart-Web" /MIN /D "%ROOT%\apps\web" ".\node_modules\.bin\react-router.cmd" dev > "%LOGDIR%\web.log" 2>&1
  timeout /t 10 /nobreak >nul
)

REM --- 4. Standalone admin console (separate repo: joejoris/ShopMart-Admin) ---
netstat -ano | findstr ":3001" | findstr "LISTENING" >nul && (
  echo [4/5] Admin console already running
) || (
  echo [4/5] Starting admin console on :3001...
  start "ShopMart-Admin" /MIN /D "C:\projects\shopmart-admin" node node_modules/vite/bin/vite.js > "%LOGDIR%\admin.log" 2>&1
  timeout /t 6 /nobreak >nul
)

REM --- 5. Apache reverse proxy on :80 ---
netstat -ano | findstr ":80 " | findstr "LISTENING" >nul && (
  echo [5/5] Apache already running
) || (
  echo [5/5] Starting Apache on :80...
  start "ShopMart-Apache" /MIN "C:\xampp\apache\bin\httpd.exe" > "%LOGDIR%\apache.log" 2>&1
  timeout /t 3 /nobreak >nul
)

echo.
echo === Done. ===
echo   Storefront (Apache):  http://localhost/
echo   Storefront (direct):  http://localhost:3000/
echo   API docs:             http://localhost:4000/docs
echo   Admin console:        http://localhost:3001/
echo.
echo Logs are in %LOGDIR%. Close this window anytime - services keep running.
pause
