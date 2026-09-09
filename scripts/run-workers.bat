@echo off
REM Core-2 Isolated Queue Workers Runner for Windows
SET TARGET=%1
IF "%TARGET%"=="" SET TARGET=all

IF "%TARGET%"=="operational" (
    echo [core2] Starting Operational Queue Worker (default,high)...
    php artisan queue:work --queue=default,high
    goto end
)
IF "%TARGET%"=="ai" (
    echo [core2] Starting Internal AI Queue Worker (ai, timeout 120s, tries 3)...
    php artisan queue:work --queue=ai --timeout=120 --tries=3
    goto end
)
IF "%TARGET%"=="reports" (
    echo [core2] Starting Reporting Queue Worker (reports, timeout 360s, tries 2)...
    php artisan queue:work --queue=reports --timeout=360 --tries=2
    goto end
)
IF "%TARGET%"=="all" (
    echo [core2] Launching dedicated queue workers in background...
    start "Operational Worker" php artisan queue:work --queue=default,high
    start "AI Worker" php artisan queue:work --queue=ai --timeout=120 --tries=3
    start "Reporting Worker" php artisan queue:work --queue=reports --timeout=360 --tries=2
    echo [core2] Operational, AI, and Reporting workers launched in separate processes.
    goto end
)

echo Usage: %0 [operational^|ai^|reports^|all]

:end
