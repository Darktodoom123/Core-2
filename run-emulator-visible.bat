@echo off
title Core-2 Android Emulator & Field Mobile Launcher
cls
echo ========================================================
echo   Launching Core-2 Android Emulator (Visible Window)
echo ========================================================
echo.

set "EMULATOR=%LOCALAPPDATA%\Android\Sdk\emulator\emulator.exe"
set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"

if not exist "%EMULATOR%" (
    echo [ERROR] Android emulator executable not found at:
    echo %EMULATOR%
    pause
    exit /b 1
)

:: Clear stale AVD locks if present
if exist "%USERPROFILE%\.android\avd\core2_api_36.avd\multiinstance.lock" (
    echo [INFO] Removing stale multiinstance lock...
    del /f /q "%USERPROFILE%\.android\avd\core2_api_36.avd\multiinstance.lock" >nul 2>&1
)
if exist "%USERPROFILE%\.android\avd\core2_api_36.avd\hardware-qemu.ini.lock" (
    echo [INFO] Removing stale hardware-qemu lock...
    rd /s /q "%USERPROFILE%\.android\avd\core2_api_36.avd\hardware-qemu.ini.lock" >nul 2>&1
)

:: Same rule as scripts/run-android.cjs: CORE2_EMULATOR_GPU wins, AMD-only
:: hosts fall back to SwiftShader (their Vulkan driver crashes the emulator),
:: everything else renders on the host GPU. SwiftShader draws on the CPU and
:: leaves the emulator slow enough to trip "app isn't responding".
set "GPU_MODE=%CORE2_EMULATOR_GPU%"
if not defined GPU_MODE (
    powershell -NoProfile -Command "$n = @(Get-CimInstance Win32_VideoController | ForEach-Object { $_.Name }); if (($n -match 'AMD|Radeon') -and -not ($n -match 'NVIDIA')) { exit 1 }" >nul 2>&1
    if errorlevel 1 (set "GPU_MODE=swiftshader") else (set "GPU_MODE=host")
)

echo [1/3] Starting Android emulator window (GPU: %GPU_MODE%)...
start "" "%EMULATOR%" -avd core2_api_36 -gpu %GPU_MODE% -no-snapshot -no-audio -crash-report-mode never

echo [2/3] Waiting for emulator to boot up...
"%ADB%" wait-for-device

:wait_boot
for /f "tokens=*" %%a in ('"%ADB%" shell getprop sys.boot_completed 2^>nul') do set BOOT=%%a
if not "%BOOT%"=="1" (
    <nul set /p=.
    timeout /t 2 /nobreak >nul
    goto wait_boot
)
echo.
echo [INFO] Android emulator is ready!

echo [3/3] Setting up network tunnels and launching Field Mobile...
"%ADB%" reverse tcp:8000 tcp:8000
"%ADB%" reverse tcp:8081 tcp:8081

"%ADB%" shell am start -a android.intent.action.VIEW -d "exp+core-2-field-mobile://expo-development-client/?url=http%%3A%%2F%%2F127.0.0.1%%3A8081" >nul 2>&1

echo.
echo ========================================================
echo   Field Mobile is running in your visible emulator!
echo ========================================================
timeout /t 5 >nul 2>&1
