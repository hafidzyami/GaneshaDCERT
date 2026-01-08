@echo off
REM Run K6 test locally with cloud output

echo ========================================
echo K6 Performance Test - Cloud Output
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
echo Starting quick comparison test (30 seconds)...
echo Test will run LOCALLY, results uploaded to K6 Cloud
echo.

REM Run K6 test locally with cloud output
k6 run --out cloud quick-comparison.js

echo.
echo ========================================
echo Test completed!
echo.
echo Results:
echo   - Cloud: Check the URL above
echo   - Local HTML: results\quick-comparison.html
echo   - Local JSON: results\quick-comparison.json
echo ========================================
echo.

REM Open HTML report if exists
if exist results\quick-comparison.html (
    echo Opening local HTML report...
    start results\quick-comparison.html
)

pause
