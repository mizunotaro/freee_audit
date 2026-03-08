@echo off
REM Run quick tests for R Statistical Analysis Service

cd /d "%~dp0"

echo Running R Service Quick Tests...
echo.

Rscript test_quick.R

if %errorlevel% neq 0 (
    echo.
    echo Tests failed. Please check the error messages above.
    pause
    exit /b 1
)

echo.
pause
