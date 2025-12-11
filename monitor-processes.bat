@echo off
title Node.js Process Monitor

:loop
cls
echo ============================================
echo  Node.js Process Monitor
echo ============================================
echo  Press Ctrl+C to exit
echo ============================================
echo.

echo Current Time: %time%
echo.

echo Node.js Processes:
echo ------------------
for /f %%A in ('tasklist ^| findstr "node" ^| find /c "node.exe" 2^>nul') do set count=%%A
if "%count%"=="" set count=0
echo Total Count: %count%

echo.
echo Process Details:
echo ----------------
tasklist | findstr "node"

echo.
echo ============================================
echo Refreshing in 3 seconds...
timeout /t 3 /nobreak >nul
goto loop
