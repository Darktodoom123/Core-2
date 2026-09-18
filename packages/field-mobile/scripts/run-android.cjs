'use strict';

const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { configureAndroidSdk } = require('./android-sdk.cjs');

process.chdir(path.resolve(__dirname, '..'));

const androidSdk = configureAndroidSdk();

function sleepMs(ms) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function getAdbPath() {
    return path.join(
        androidSdk,
        'platform-tools',
        process.platform === 'win32' ? 'adb.exe' : 'adb',
    );
}

function getAttachedDevices() {
    try {
        const adb = getAdbPath();
        const res = spawnSync(adb, ['devices'], {
            encoding: 'utf8',
            env: process.env,
        });

        if (res.status !== 0) {
            return [];
        }

        const lines = res.stdout
            .split(/\r?\n/)
            .filter(
                (line) => line.trim() && !line.startsWith('List of devices'),
            );

        const devices = [];

        for (const line of lines) {
            const [serial, state] = line.trim().split(/\s+/);

            if (serial && state) {
                devices.push({ serial, state });
            }
        }

        return devices;
    } catch {
        return [];
    }
}

function isBootCompleted(serial) {
    try {
        const adb = getAdbPath();
        const args = serial
            ? ['-s', serial, 'shell', 'getprop', 'sys.boot_completed']
            : ['shell', 'getprop', 'sys.boot_completed'];
        const res = spawnSync(adb, args, {
            encoding: 'utf8',
            env: process.env,
            timeout: 5000,
        });

        return res.status === 0 && (res.stdout ?? '').trim() === '1';
    } catch {
        return false;
    }
}

function setupPortForwarding(serial) {
    try {
        const adb = getAdbPath();
        const serialArgs = serial ? ['-s', serial] : [];
        spawnSync(adb, [...serialArgs, 'reverse', 'tcp:8000', 'tcp:8000'], {
            env: process.env,
        });
        spawnSync(adb, [...serialArgs, 'reverse', 'tcp:8081', 'tcp:8081'], {
            env: process.env,
        });
    } catch {
        // Best effort port reverse
    }
}

function ensureAvdExists(avdName) {
    const avdHome = process.env.ANDROID_AVD_HOME;

    if (!avdHome) {
        return;
    }

    const avdDir = path.join(avdHome, `${avdName}.avd`);
    const avdIni = path.join(avdHome, `${avdName}.ini`);

    if (fs.existsSync(avdDir) || fs.existsSync(avdIni)) {
        return;
    }

    console.log(`AVD "${avdName}" not found. Creating it now...`);
    const createScript = path.join(__dirname, 'create-android-avd.cjs');
    const result = spawnSync(process.execPath, [createScript], {
        stdio: 'inherit',
        env: process.env,
    });

    if (result.status !== 0) {
        throw new Error(`Failed to create AVD "${avdName}".`);
    }
}

function isEmulatorProcessRunning() {
    try {
        if (process.platform === 'win32') {
            const check = spawnSync('tasklist', ['/NH'], {
                encoding: 'utf8',
                timeout: 5000,
            });
            const stdout = check.stdout ?? '';

            return (
                stdout.includes('qemu-system-x86_64.exe') ||
                stdout.includes('qemu-system-aarch64.exe') ||
                stdout.includes('emulator.exe')
            );
        }

        const check = spawnSync('pgrep', ['-f', 'qemu-system|emulator'], {
            encoding: 'utf8',
            timeout: 5000,
        });

        return check.status === 0 && (check.stdout ?? '').trim().length > 0;
    } catch {
        return false;
    }
}

function gracefullyStopEmulator(serial) {
    try {
        const adb = getAdbPath();
        const serialArgs = serial ? ['-s', serial] : [];
        spawnSync(adb, [...serialArgs, 'emu', 'kill'], {
            env: process.env,
            timeout: 5000,
        });

        const deadline = Date.now() + 10000;

        while (Date.now() < deadline) {
            const currentDevices = getAttachedDevices();
            const stillAttached = serial
                ? currentDevices.some((d) => d.serial === serial)
                : currentDevices.length > 0;

            if (!stillAttached && !isEmulatorProcessRunning()) {
                break;
            }

            sleepMs(500);
        }
    } catch {
        // Best effort graceful stop
    }
}

function launchEmulatorWin32(emulatorExe, avdName, gpuMode, logPath) {
    const psScript = path.join(__dirname, 'launch-emulator.ps1');

    if (!fs.existsSync(psScript)) {
        return false;
    }

    try {
        const result = spawnSync(
            'powershell.exe',
            [
                '-NoProfile',
                '-ExecutionPolicy',
                'Bypass',
                '-File',
                psScript,
                '-EmulatorExe',
                emulatorExe,
                '-AvdName',
                avdName,
                '-GpuMode',
                gpuMode,
                '-LogPath',
                logPath,
                '-Desktop',
                'WinSta0\\Default',
            ],
            {
                encoding: 'utf8',
                env: process.env,
                timeout: 10000,
            },
        );

        if (result.status === 0) {
            try {
                const match = (result.stdout ?? '').match(/\{[\s\S]*\}/);

                if (match) {
                    const data = JSON.parse(match[0]);

                    return Boolean(data.success);
                }

                return true;
            } catch {
                return true;
            }
        }
    } catch {
        // Fall back to direct spawn
    }

    return false;
}

function checkEmulatorWindowVisible(avdName, targetPid) {
    if (process.platform !== 'win32') {
        return null;
    }

    try {
        const psScript = path.join(__dirname, 'launch-emulator.ps1');
        const args = [
            '-NoProfile',
            '-ExecutionPolicy',
            'Bypass',
            '-File',
            psScript,
            '-AvdName',
            avdName,
            '-Desktop',
            'WinSta0\\Default',
            '-CheckVisible',
        ];

        if (targetPid) {
            args.push('-TargetPid', String(targetPid));
        }

        const res = spawnSync('powershell.exe', args, {
            encoding: 'utf8',
            env: process.env,
            timeout: 10000,
        });

        if (res.status === 0) {
            const match = (res.stdout ?? '').match(/\{[\s\S]*\}/);

            if (match) {
                const parsed = JSON.parse(match[0]);

                return parsed.visible === true ? parsed : false;
            }
        }
    } catch {
        // Best effort check
    }

    return null;
}

function ensureEmulatorRunning() {
    const avdName =
        process.env.CORE2_AVD_NAME ?? process.env.ANDROID_AVD ?? 'core2_api_36';

    const initialDevices = getAttachedDevices();
    const readyDevice = initialDevices.find(
        (d) => d.state === 'device' && isBootCompleted(d.serial),
    );

    if (readyDevice) {
        setupPortForwarding(readyDevice.serial);

        const winInfo = checkEmulatorWindowVisible(avdName);

        if (winInfo && winInfo.visible) {
            console.log(
                `Android emulator (${readyDevice.serial}) is already booted and visible on desktop (${winInfo.title}, ${winInfo.width}x${winInfo.height} at ${winInfo.x},${winInfo.y}).`,
            );

            return;
        } else if (winInfo === false) {
            const allowHeadless = Boolean(
                process.env.CI || process.env.CORE2_EMULATOR_HEADLESS,
            );

            if (allowHeadless) {
                console.log(
                    `Android emulator (${readyDevice.serial}) is running headless (CI/CORE2_EMULATOR_HEADLESS mode).`,
                );

                return;
            }

            console.warn(
                `Notice: Android emulator (${readyDevice.serial}) is running without a visible desktop window. Gracefully stopping it to relaunch with a visible window...`,
            );
            gracefullyStopEmulator(readyDevice.serial);

            // Re-fetch attached devices after killing it so we don't use stale state
            initialDevices.length = 0;
            initialDevices.push(...getAttachedDevices());
        } else {
            return;
        }
    }

    let targetSerial = initialDevices[0]?.serial ?? null;
    const processAlreadyRunning = isEmulatorProcessRunning();
    const logPath = path.resolve(__dirname, '..', '.emulator.log');
    const gpuMode = process.env.CORE2_EMULATOR_GPU ?? 'auto';

    if (initialDevices.length === 0 && !processAlreadyRunning) {
        ensureAvdExists(avdName);

        const emulator = path.join(
            androidSdk,
            'emulator',
            process.platform === 'win32' ? 'emulator.exe' : 'emulator',
        );

        console.log(
            `Starting Android emulator (${avdName}, gpu: ${gpuMode})...`,
        );
        console.log(`Emulator logs streaming to: ${logPath}`);

        let started = false;

        if (process.platform === 'win32') {
            started = launchEmulatorWin32(emulator, avdName, gpuMode, logPath);
        }

        if (!started) {
            const logFd = fs.openSync(logPath, 'a');
            const emuProc = spawn(
                emulator,
                ['-avd', avdName, '-gpu', gpuMode, '-no-snapshot', '-no-audio'],
                {
                    detached: true,
                    stdio: ['ignore', logFd, logFd],
                    env: process.env,
                },
            );
            emuProc.on('error', (err) => {
                console.error(
                    `Failed to start Android emulator: ${err.message}`,
                );
            });
            emuProc.unref();
        }
    } else if (initialDevices.length > 0) {
        console.log(
            `Android device (${targetSerial ?? initialDevices[0].serial}, state: ${initialDevices[0].state}) detected. Waiting for boot completion...`,
        );
    } else {
        console.log(
            'Emulator process detected. Waiting for ADB connection and boot completion...',
        );
    }

    const deadline = Date.now() + 180000;
    let booted = false;

    while (Date.now() < deadline) {
        if (!targetSerial) {
            const currentDevices = getAttachedDevices();

            if (currentDevices.length > 0) {
                targetSerial = currentDevices[0].serial;
            }
        }

        if (targetSerial && isBootCompleted(targetSerial)) {
            booted = true;
            break;
        }

        sleepMs(2000);
    }

    if (booted) {
        console.log('Android emulator booted successfully.');
        const adb = getAdbPath();
        const serialArgs = targetSerial ? ['-s', targetSerial] : [];
        spawnSync(
            adb,
            [...serialArgs, 'shell', 'input', 'keyevent', 'KEYCODE_WAKEUP'],
            {
                env: process.env,
            },
        );
        spawnSync(adb, [...serialArgs, 'shell', 'wm', 'dismiss-keyguard'], {
            env: process.env,
        });

        const winInfo = checkEmulatorWindowVisible(avdName);

        if (winInfo && winInfo.visible) {
            console.log(
                `Verified: Emulator window is visible on desktop (${winInfo.title}, ${winInfo.width}x${winInfo.height} at ${winInfo.x},${winInfo.y}).`,
            );
        } else if (winInfo === false) {
            console.warn(
                'Notice: Emulator booted but visible window was not detected on WinSta0\\Default desktop.',
            );
        }
    } else {
        console.warn(
            'Warning: Emulator boot wait timed out; continuing with Expo CLI...',
        );
    }

    setupPortForwarding(targetSerial);
}

ensureEmulatorRunning();

process.argv.splice(2, 0, 'run:android');

function resolveExpoCli() {
    try {
        return require.resolve('@expo/cli');
    } catch {
        return require.resolve('@expo/cli', {
            paths: [require.resolve('expo')],
        });
    }
}

require(resolveExpoCli());
