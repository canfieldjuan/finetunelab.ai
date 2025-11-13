@echo off
echo Fixing Next.js cache permission error...
echo.

echo Step 1: Killing all Node.js processes...
taskkill /F /IM node.exe 2>nul
if %errorlevel% equ 0 (
    echo ✓ Node.js processes terminated
) else (
    echo - No Node.js processes found
)
echo.

echo Step 2: Waiting for file handles to release...
timeout /t 2 /nobreak >nul
echo.

echo Step 3: Removing .next directory...
if exist ".next" (
    rmdir /s /q ".next" 2>nul
    if %errorlevel% equ 0 (
        echo ✓ .next directory removed
    ) else (
        echo ! Could not remove .next directory (may need admin rights)
        echo   Try running this script as Administrator
    )
) else (
    echo - .next directory does not exist
)
echo.

echo Step 4: Removing node_modules/.cache...
if exist "node_modules\.cache" (
    rmdir /s /q "node_modules\.cache" 2>nul
    echo ✓ node_modules cache cleared
) else (
    echo - No node_modules cache found
)
echo.

echo Done! You can now run: npm run dev
echo.
pause
