@echo off
REM Start the R Statistical Analysis Service

cd /d "%~dp0"

echo Starting R Statistical Analysis Service...
echo Service will be available at: http://localhost:8001
echo Swagger UI: http://localhost:8001/__swagger__/
echo Press Ctrl+C to stop the service
echo.

Rscript -e "pr <- plumber::plumb('plumber.R'); pr$run(host='0.0.0.0', port=8001, swagger=TRUE)"
