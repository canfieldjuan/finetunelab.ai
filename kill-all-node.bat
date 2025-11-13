@echo off
echo ============================================
echo  Killing All Node.js Processes
echo ============================================
echo.

echo Step 1: Counting current node processes...
for /f %%A in ('tasklist ^| findstr "node" ^| find /c "node.exe"') do set count=%%A
echo Found %count% node.exe processes

echo.
echo Step 2: Terminating all node.exe processes...
taskkill /F /IM node.exe 2>nul
if %errorlevel% equ 0 (
    echo Success - All node processes killed
) else (
    echo No node processes found
)

echo.
echo Step 3: Verifying...
timeout /t 2 /nobreak >nul
for /f %%A in ('tasklist ^| findstr "node" ^| find /c "node.exe" 2^>nul') do set newcount=%%A
if "%newcount%"=="" set newcount=0
echo Remaining node processes: %newcount%

echo.
echo ============================================
echo  Done!
echo ============================================
echo.
echo You can now run: npm run dev
echo.
pause
