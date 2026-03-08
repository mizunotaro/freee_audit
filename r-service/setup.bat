@echo off
REM R Statistical Analysis Service - Windows Setup Script
REM Run this script to set up the R environment

echo ==========================================
echo R Statistical Analysis Service Setup
echo ==========================================
echo.

REM Check if R is installed
where Rscript >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: R is not installed or not in PATH
    echo.
    echo Please install R from: https://cran.r-project.org/bin/windows/base/
    echo Recommended version: R 4.3.2 or higher
    echo.
    echo After installation, restart your terminal and run this script again.
    pause
    exit /b 1
)

REM Display R version
echo Checking R version...
Rscript --version
echo.

REM Run setup script
echo Running setup script...
echo.
cd /d "%~dp0"
Rscript setup.R

if %errorlevel% neq 0 (
    echo.
    echo Setup failed. Please check the error messages above.
    pause
    exit /b 1
)

echo.
echo ==========================================
echo Setup completed successfully!
echo ==========================================
echo.
echo To start the service:
echo   cd r-service
echo   Rscript -e "pr ^<- plumber::plumb('plumber.R'); pr$run(host='0.0.0.0', port=8001)"
echo.
echo Or run: start_service.bat
echo.

pause
