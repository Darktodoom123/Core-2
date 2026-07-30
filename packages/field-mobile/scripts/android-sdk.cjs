'use strict';

const fs = require('node:fs');
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
    process.env.ANDROID_AVD_HOME =
        process.env.ANDROID_AVD_HOME ?? path.join(androidSdk, 'avd');
    process.env[pathKey] = [
        path.join(androidSdk, 'platform-tools'),
        path.join(androidSdk, 'emulator'),
        process.env[pathKey] ?? '',
    ].join(path.delimiter);

    return androidSdk;
}

module.exports = { configureAndroidSdk };
