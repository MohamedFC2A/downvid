@echo off
echo ========================================
echo   Starting GlassLoad AI
echo ========================================
echo.

echo [1/2] Starting Backend Server...
start "DOWNVID Backend" cmd /k "cd /d %~dp0backend && .\venv\Scripts\activate && python main.py"

echo [2/2] Waiting 3 seconds...
timeout /t 3 /nobreak > nul

echo [2/2] Starting Frontend Server...
start "GlassLoad Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ========================================
echo   Both servers are starting!
echo   Backend: http://localhost:8000
echo   Frontend: http://localhost:3000
echo ========================================
echo.
echo Press any key to exit this window...
pause > nul
