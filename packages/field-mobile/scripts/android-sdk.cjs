'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function configureAndroidSdk() {
    const candidateSdks = [
        process.env.ANDROID_SDK_ROOT,
        process.env.ANDROID_HOME,
        process.env.LOCALAPPDATA
            ? path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk')
            : null,
        path.join(os.homedir(), 'AppData', 'Local', 'Android', 'Sdk'),
        path.resolve(__dirname, '../../../.android-sdk'),
        path.join(os.homedir(), 'Android', 'Sdk'),
        path.join(os.homedir(), 'Library', 'Android', 'sdk'),
    ].filter(Boolean);

    let androidSdk = null;

    for (const candidate of candidateSdks) {
        if (
            fs.existsSync(candidate) &&
            (fs.existsSync(path.join(candidate, 'platform-tools')) ||
                fs.existsSync(path.join(candidate, 'emulator')))
        ) {
            androidSdk = path.resolve(candidate);
            break;
        }
    }

    if (!androidSdk) {
        for (const candidate of candidateSdks) {
            if (fs.existsSync(candidate)) {
                androidSdk = path.resolve(candidate);
                break;
            }
        }
    }

    if (!androidSdk) {
        throw new Error(
            'Android SDK not found. Set ANDROID_SDK_ROOT or ANDROID_HOME to a supported installed SDK.',
        );
    }

    const pathKey =
        Object.keys(process.env).find((key) => key.toLowerCase() === 'path') ??
        'PATH';

    process.env.ANDROID_HOME = androidSdk;
    process.env.ANDROID_SDK_ROOT = androidSdk;

    const userAvdHome = path.join(os.homedir(), '.android', 'avd');
    const sdkAvdHome = path.join(androidSdk, 'avd');

    if (!process.env.ANDROID_AVD_HOME) {
        process.env.ANDROID_AVD_HOME = fs.existsSync(userAvdHome)
            ? userAvdHome
            : sdkAvdHome;
    }

    if (!fs.existsSync(process.env.ANDROID_AVD_HOME)) {
        try {
            fs.mkdirSync(process.env.ANDROID_AVD_HOME, { recursive: true });
        } catch {
            // Best effort directory creation
        }
    }

    process.env.SKIP_JDK_VERSION_CHECK = '1';

    if (!process.env.JAVA_HOME) {
        const candidateJdks = [
            'C:\\Program Files\\Android\\Android Studio\\jbr',
        ];

        for (const candidate of candidateJdks) {
            if (fs.existsSync(candidate)) {
                process.env.JAVA_HOME = candidate;
                break;
            }
        }
    }

    const additionalPaths = [
        path.join(androidSdk, 'platform-tools'),
        path.join(androidSdk, 'emulator'),
        path.join(androidSdk, 'cmdline-tools', 'latest', 'bin'),
    ];

    if (process.env.JAVA_HOME) {
        additionalPaths.unshift(path.join(process.env.JAVA_HOME, 'bin'));
    }

    process.env[pathKey] = [
        ...additionalPaths,
        process.env[pathKey] ?? '',
    ].join(path.delimiter);

    return androidSdk;
}

module.exports = { configureAndroidSdk };
