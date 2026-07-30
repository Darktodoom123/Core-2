'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { configureAndroidSdk } = require('./android-sdk.cjs');

const androidSdk = configureAndroidSdk();
const avdName = 'core2_api_36';
const avdPath = path.join(process.env.ANDROID_AVD_HOME, `${avdName}.avd`);

if (fs.existsSync(avdPath)) {
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

    const avdManager = path.join(
        androidSdk,
        'cmdline-tools',
        'latest',
        'bin',
        'avdmanager.bat',
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
            'system-images;android-36;google_apis;x86_64',
            '--device',
            'pixel_tablet',
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
