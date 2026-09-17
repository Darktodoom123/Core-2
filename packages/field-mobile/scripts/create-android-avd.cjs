'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { configureAndroidSdk } = require('./android-sdk.cjs');

const androidSdk = configureAndroidSdk();
const avdName =
    process.env.CORE2_AVD_NAME ?? process.env.ANDROID_AVD ?? 'core2_api_36';
const avdPath = path.join(process.env.ANDROID_AVD_HOME, `${avdName}.avd`);
const avdIniPath = path.join(process.env.ANDROID_AVD_HOME, `${avdName}.ini`);

if (fs.existsSync(avdPath) || fs.existsSync(avdIniPath)) {
    process.exitCode = 0;
} else {
    const javaVersionResult = spawnSync('java', ['-version'], {
        encoding: 'utf8',
        env: process.env,
    });
    const javaVersionOutput = `${javaVersionResult.stdout ?? ''}\n${javaVersionResult.stderr ?? ''}`;
    const javaMajor = Number(
        javaVersionOutput.match(/version "(?:1\.)?(\d+)/)?.[1] ?? 0,
    );

    if (javaVersionResult.status !== 0 || javaMajor < 17) {
        throw new Error('Android AVD creation requires Java 17 or newer.');
    }

    const apiLevel = avdName.match(/api_(\d+)/)?.[1] ?? '36';
    const avdPackage =
        process.env.CORE2_AVD_PACKAGE ??
        `system-images;android-${apiLevel};google_apis;x86_64`;

    const avdManager = path.join(
        androidSdk,
        'cmdline-tools',
        'latest',
        'bin',
        process.platform === 'win32' ? 'avdmanager.bat' : 'avdmanager',
    );
    const result = spawnSync(
        avdManager,
        [
            'create',
            'avd',
            '--force',
            '--name',
            avdName,
            '--package',
            avdPackage,
            '--device',
            process.env.CORE2_AVD_DEVICE ?? 'pixel_8',
        ],
        {
            env: {
                ...process.env,
                // The bundled Windows batch parser treats Java 23 as "23"
                // instead of "230"; Java was validated explicitly above.
                SKIP_JDK_VERSION_CHECK: '1',
            },
            input: 'no\n',
            shell: process.platform === 'win32',
            stdio: ['pipe', 'inherit', 'inherit'],
        },
    );

    if (result.error) {
        throw result.error;
    }

    if (result.status !== 0 || !fs.existsSync(avdPath)) {
        throw new Error(`Failed to create Android virtual device ${avdName}.`);
    }

    process.exitCode = 0;
}
