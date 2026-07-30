'use strict';

module.exports = {
    testRunner: {
        args: {
            config: 'e2e/jest.config.cjs',
            maxWorkers: 1,
        },
        jest: {
            setupTimeout: 120000,
        },
    },
    apps: {
        'android.debug': {
            type: 'android.apk',
            binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
            testBinaryPath:
                'android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk',
            build: 'npm run e2e:build:android',
            reversePorts: [18081],
        },
    },
    devices: {
        attachedEmulator: {
            type: 'android.attached',
            device: {
                adbName: 'emulator-5554',
            },
        },
    },
    configurations: {
        'android.emulator.debug': {
            device: 'attachedEmulator',
            app: 'android.debug',
        },
    },
};
