@echo off
echo ========================================
echo   Restarting Backend with WebSocket Support
echo ========================================
echo.

cd /d %~dp0backend

echo [1/3] Activating virtual environment...
call venv\Scripts\activate.bat
if %errorlevel% neq 0 (
    echo ERROR: Virtual environment not found!
    echo Please run setup-backend.bat first
    pause
    exit /b 1
)

echo [2/3] Installing/Updating dependencies...
pip install -r requirements.txt --quiet
if %errorlevel% neq 0 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo [3/3] Starting backend with WebSocket support...
echo.
echo ========================================
echo   Backend Starting...
echo   WebSocket endpoint: ws://localhost:8000/ws/download/
echo ========================================
echo.

python main.py
