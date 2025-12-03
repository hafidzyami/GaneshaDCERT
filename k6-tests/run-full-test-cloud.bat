@echo off
REM Run full K6 performance test with cloud output

echo ========================================
echo K6 Full Performance Test - Cloud Output
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

REM Check if logged in to K6 cloud
echo Checking K6 Cloud authentication...
k6 cloud list >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo You are not logged in to K6 Cloud.
    echo.
    echo Please login first:
    echo   k6 login cloud --token YOUR_TOKEN
    echo.
    echo Or get a free account at:
    echo   https://app.k6.io/account/register
    echo.
    pause
    exit /b 1
)
echo ✓ K6 Cloud authenticated
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
echo Starting full performance test (~7 minutes)...
echo Test will run LOCALLY, results uploaded to K6 Cloud
echo.
echo Scenarios:
echo   1. Light load (0-2m): 5 VUs
echo   2. Medium load DB (2-4m): 20 VUs
echo   3. Medium load BC (4-6m): 10 VUs
echo   4. Spike test (6-7m): 50 VUs spike
echo.

REM Run K6 test locally with cloud output
k6 run --out cloud schema-performance-test.js

echo.
echo ========================================
echo Test completed!
echo.
echo Results:
echo   - Cloud: Check the URL above
echo   - Local HTML: results\summary.html
echo   - Local JSON: results\summary.json
echo ========================================
echo.

REM Open HTML report if exists
if exist results\summary.html (
    echo Opening local HTML report...
    start results\summary.html
)

pause
