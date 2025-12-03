@echo off
REM Run K6 test locally (not cloud)

echo ========================================
echo K6 Performance Test - Schema Comparison
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
echo Starting quick comparison test (30 seconds)...
echo.

REM Run K6 test locally (NOT cloud)
k6 run quick-comparison.js

echo.
echo ========================================
echo Test completed!
echo.
echo View results:
echo   - HTML: results\quick-comparison.html
echo   - JSON: results\quick-comparison.json
echo ========================================
echo.

REM Open HTML report if exists
if exist results\quick-comparison.html (
    echo Opening HTML report...
    start results\quick-comparison.html
)

pause
