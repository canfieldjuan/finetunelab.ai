@echo off
REM Quick start script for training server
cd /d "%~dp0"
call trainer_venv\Scripts\activate.bat
python -m uvicorn training_server:app --host 0.0.0.0 --port 8000 --reload
