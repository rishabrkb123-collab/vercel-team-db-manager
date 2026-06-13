@echo off
setlocal enabledelayedexpansion

title DB Manager - Setup
echo.
echo  ================================
echo   DB Manager - First Time Setup
echo  ================================
echo.

:: Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Node.js is not installed.
    echo  Download it from: https://nodejs.org
    echo  Install the LTS version, then run this file again.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VER=%%i
echo  [OK] Node.js found: %NODE_VER%

:: Check if npm is installed
npm --version >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] npm not found. Reinstall Node.js from https://nodejs.org
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('npm --version') do set NPM_VER=%%i
echo  [OK] npm found: v%NPM_VER%
echo.

:: Check if package.json exists
if not exist "package.json" (
    echo  [ERROR] package.json not found.
    echo  Make sure you are running this file from inside your project folder.
    echo.
    pause
    exit /b 1
)

echo  [OK] package.json found
echo.

:: Install all dependencies from package.json
echo  [1/5] Installing project dependencies...
npm install
if errorlevel 1 (
    echo.
    echo  [ERROR] npm install failed.
    pause
    exit /b 1
)
echo  [OK] Dependencies installed
echo.

:: Ensure Postgres client is installed
echo  [2/5] Checking pg (Postgres client)...
npm install pg
if errorlevel 1 (
    echo  [ERROR] Failed to install pg
    pause
    exit /b 1
)
echo  [OK] pg installed
echo.

:: Ensure TypeScript types for pg
echo  [3/5] Checking TypeScript types for pg...
npm install --save-dev @types/pg
if errorlevel 1 (
    echo  [ERROR] Failed to install @types/pg
    pause
    exit /b 1
)
echo  [OK] @types/pg installed
echo.

:: Ensure Next.js, React, and React DOM are installed
echo  [4/5] Checking Next.js and React...
npm install next react react-dom
if errorlevel 1 (
    echo  [ERROR] Failed to install Next.js / React
    pause
    exit /b 1
)
echo  [OK] Next.js and React installed
echo.

:: Ensure Tailwind CSS and PostCSS are installed
echo  [5/5] Checking Tailwind CSS...
npm install --save-dev tailwindcss postcss autoprefixer
if errorlevel 1 (
    echo  [ERROR] Failed to install Tailwind CSS
    pause
    exit /b 1
)
echo  [OK] Tailwind CSS installed
echo.

:: Check if .env.local exists, if not create a template
if not exist ".env.local" (
    echo  [INFO] .env.local not found. Creating template...
    echo DATABASE_URL=postgresql://your_user:your_password@your_host/your_db?sslmode=require > .env.local
    echo.
    echo  ================================
    echo   ACTION REQUIRED
    echo  ================================
    echo  .env.local has been created.
    echo  Open it and replace the DATABASE_URL
    echo  with your actual Neon connection string.
    echo  ================================
    echo.
) else (
    echo  [OK] .env.local already exists
    echo.
)

:: Done
echo  ================================
echo   Setup Complete
echo  ================================
echo  All packages installed successfully.
echo  Run start.bat to launch the project.
echo  ================================
echo.
pause
endlocal
