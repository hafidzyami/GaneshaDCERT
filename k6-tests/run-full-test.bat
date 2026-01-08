@echo off
REM Run full K6 performance test locally

echo ========================================
echo K6 Full Performance Test (~7 minutes)
echo ========================================
echo.

REM Check if k6 is installed
where k6 >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: K6 is not installed!
    echo.
    echo Please install K6:
    echo   choco install k6
    echo   OR
    echo   scoop install k6
    echo.
    pause
    exit /b 1
)

echo K6 Version:
k6 version
echo.

REM Check if backend is running
echo Checking if backend is running on port 3069...
curl -s http://localhost:3069/api/v1/schemas >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo WARNING: Backend is not responding on port 3069
    echo Please make sure the backend is running!
    echo.
    pause
)

echo.
echo Starting full performance test...
echo This will take approximately 7 minutes.
echo.
echo Scenarios:
echo   1. Light load (0-2m): 5 VUs
echo   2. Medium load DB (2-4m): 20 VUs
echo   3. Medium load BC (4-6m): 10 VUs
echo   4. Spike test (6-7m): 50 VUs spike
echo.

REM Run K6 test locally
k6 run schema-performance-test.js

echo.
echo ========================================
echo Test completed!
echo.
echo View results:
echo   - HTML: results\summary.html
echo   - JSON: results\summary.json
echo ========================================
echo.

REM Open HTML report if exists
if exist results\summary.html (
    echo Opening HTML report...
    start results\summary.html
)

pause
