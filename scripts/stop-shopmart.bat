@echo off
REM Stops all ShopMart services (leaves XAMPP Control Panel untouched otherwise).
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM httpd.exe >nul 2>&1
REM MariaDB: uncomment the next line if you want the database stopped too.
REM taskkill /F /IM mariadbd.exe >nul 2>&1
echo ShopMart node/apache processes stopped. MariaDB left running on purpose.
pause
