'use strict';

const { spawn, spawnSync } = require('node:child_process');
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

function isDeviceAttached() {
    try {
        const adb = getAdbPath();
        const res = spawnSync(adb, ['devices'], {
            encoding: 'utf8',
            env: process.env,
        });

        if (res.status !== 0) {
            return false;
        }

        const lines = res.stdout
            .split(/\r?\n/)
            .filter(
                (line) => line.trim() && !line.startsWith('List of devices'),
            );

        return lines.some((line) => /\bdevice\b/.test(line));
    } catch {
        return false;
    }
}

function setupPortForwarding() {
    try {
        const adb = getAdbPath();
        spawnSync(adb, ['reverse', 'tcp:8000', 'tcp:8000'], {
            env: process.env,
        });
        spawnSync(adb, ['reverse', 'tcp:8081', 'tcp:8081'], {
            env: process.env,
        });
    } catch {
        // Best effort port reverse
    }
}

function ensureEmulatorRunning() {
    if (isDeviceAttached()) {
        setupPortForwarding();

        return;
    }

    const emulator = path.join(
        androidSdk,
        'emulator',
        process.platform === 'win32' ? 'emulator.exe' : 'emulator',
    );
    const avdName =
        process.env.CORE2_AVD_NAME ?? process.env.ANDROID_AVD ?? 'core2_api_36';

    console.log(
        `Starting Android emulator (${avdName}) with software rendering...`,
    );
    const emuProc = spawn(
        emulator,
        [
            '-avd',
            avdName,
            '-gpu',
            'swiftshader_indirect',
            '-no-snapshot',
            '-no-audio',
        ],
        {
            detached: true,
            stdio: 'ignore',
            env: process.env,
        },
    );
    emuProc.unref();

    const adb = getAdbPath();
    const deadline = Date.now() + 180000;
    let booted = false;

    while (Date.now() < deadline) {
        const check = spawnSync(
            adb,
            ['shell', 'getprop', 'sys.boot_completed'],
            {
                encoding: 'utf8',
                env: process.env,
                timeout: 5000,
            },
        );

        if (check.status === 0 && (check.stdout ?? '').trim() === '1') {
            booted = true;
            break;
        }

        sleepMs(2000);
    }

    if (booted) {
        console.log('Android emulator booted successfully.');
        spawnSync(adb, ['shell', 'input', 'keyevent', 'KEYCODE_WAKEUP'], {
            env: process.env,
        });
        spawnSync(adb, ['shell', 'wm', 'dismiss-keyguard'], {
            env: process.env,
        });
    } else {
        console.warn(
            'Warning: Emulator boot wait timed out; continuing with Expo CLI...',
        );
    }

    setupPortForwarding();
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
