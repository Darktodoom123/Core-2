'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { configureAndroidSdk } = require('./android-sdk.cjs');

configureAndroidSdk();

const androidRoot = path.resolve(__dirname, '../android');
const gradleWrapper = path.join(androidRoot, 'gradlew.bat');
const result = spawnSync(gradleWrapper, process.argv.slice(2), {
    cwd: androidRoot,
    env: process.env,
    shell: process.platform === 'win32',
    stdio: 'inherit',
});

if (result.error) {
    throw result.error;
}

process.exitCode = result.status ?? 1;
