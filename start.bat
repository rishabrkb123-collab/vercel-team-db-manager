@echo off
setlocal enabledelayedexpansion

title DB Manager - Starting...
echo.
echo  Starting DB Manager...
echo  ================================
echo.

:: Check if .env.local exists
if not exist ".env.local" (
    echo  [WARN] .env.local not found.
    echo  Create it with: DATABASE_URL=your_neon_connection_string
    echo.
)

:: Check if node_modules exists
if not exist "node_modules" (
    echo  [INFO] node_modules not found. Running npm install...
    echo.
    npm install
    if errorlevel 1 (
        echo.
        echo  [ERROR] npm install failed. Make sure Node.js is installed.
        pause
        exit /b 1
    )
    echo.
)

:: Find a free port starting from 3000
set PORT=3000

:find_port
netstat -ano | findstr ":%PORT% " | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
    set /a PORT+=1
    if !PORT! gtr 3020 (
        echo  [ERROR] No free port found between 3000 and 3020.
        pause
        exit /b 1
    )
    goto find_port
)

echo  [INFO] Using port !PORT!
echo.

:: Start Next.js in background and open browser after delay
echo  Starting Next.js on http://localhost:!PORT!
echo  ================================
echo.

:: Launch browser after 4 seconds in background
start "" cmd /c "timeout /t 4 /nobreak >nul && start http://localhost:!PORT!"

:: Start the dev server (this stays in foreground so you can see logs)
set PORT=!PORT!
npx next dev -p !PORT!

endlocal
