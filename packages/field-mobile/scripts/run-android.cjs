'use strict';

const { configureAndroidSdk } = require('./android-sdk.cjs');

configureAndroidSdk();

const features = new Set(
    (process.env.ANDROID_EMULATOR_FEATURES ?? '')
        .split(',')
        .map((feature) => feature.trim())
        .filter(Boolean),
);

features.add('-Vulkan');
process.env.ANDROID_EMULATOR_FEATURES = [...features].join(',');

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
