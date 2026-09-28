@echo off
cd /d "%~dp0"
echo ==== %date% %time% ==== > docker-up.local.log
docker version >> docker-up.local.log 2>&1
docker compose --env-file .env.docker.local config --quiet >> docker-up.local.log 2>&1
if errorlevel 1 (echo CONFIG FAILED >> docker-up.local.log & exit /b 1)
docker compose --env-file .env.docker.local up -d --build >> docker-up.local.log 2>&1
echo EXIT %errorlevel% >> docker-up.local.log
docker compose --env-file .env.docker.local ps >> docker-up.local.log 2>&1
echo DONE >> docker-up.local.log
