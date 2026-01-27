@echo off
echo ========================================
echo   GlassLoad AI - Backend Setup
echo ========================================
echo.

cd /d %~dp0backend

echo [1/4] Creating virtual environment...
python -m venv venv
if %errorlevel% neq 0 (
    echo ERROR: Failed to create virtual environment
    echo Make sure Python is installed and in PATH
    pause
    exit /b 1
)

echo [2/4] Activating virtual environment...
call venv\Scripts\activate.bat
if %errorlevel% neq 0 (
    echo ERROR: Failed to activate virtual environment
    pause
    exit /b 1
)

echo [3/4] Installing dependencies...
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo [4/4] Creating .env file...
if not exist .env (
    copy .env.example .env
    echo .env file created! 
    echo.
    echo IMPORTANT: Edit backend\.env and add your DeepSeek API key
    echo Example: DEEPSEEK_API_KEY=sk-your-key-here
) else (
    echo .env file already exists
)

echo.
echo ========================================
echo   Setup Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Edit backend\.env and add your DeepSeek API key
echo 2. Run: start.bat (to start both servers)
echo    OR
echo    Run: cd backend ^&^& venv\Scripts\activate ^&^& python main.py
echo.
pause
