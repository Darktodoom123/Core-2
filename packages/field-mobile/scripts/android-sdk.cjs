'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function configureAndroidSdk() {
    const repositorySdk = path.resolve(__dirname, '../../../.android-sdk');
    const configuredSdk =
        process.env.ANDROID_SDK_ROOT ?? process.env.ANDROID_HOME;
    const androidSdk = configuredSdk
        ? path.resolve(configuredSdk)
        : repositorySdk;

    if (!fs.existsSync(androidSdk)) {
        throw new Error(
            `Android SDK not found at ${androidSdk}. Set ANDROID_SDK_ROOT to a supported installed SDK.`,
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
