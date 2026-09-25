'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { configureAndroidSdk } = require('./android-sdk.cjs');

configureAndroidSdk();

const detoxPackage = require.resolve('detox/package.json');
const detoxCli = path.join(path.dirname(detoxPackage), 'local-cli', 'cli.js');
const detoxRuntime = path.resolve(__dirname, '../.detox-runtime');
const detoxArguments = [
    detoxCli,
    'test',
    '--configuration',
    'android.emulator.debug',
];

if (process.env.DETOX_TEST_PATH) {
    detoxArguments.push(process.env.DETOX_TEST_PATH);
}

const result = spawnSync(process.execPath, detoxArguments, {
    cwd: path.resolve(__dirname, '..'),
    env: {
        ...process.env,
        LOCALAPPDATA: path.join(detoxRuntime, 'local'),
        APPDATA: path.join(detoxRuntime, 'roaming'),
    },
    stdio: 'inherit',
});

if (result.error) {
    throw result.error;
}

const exitCode = result.status ?? 1;

if (process.env.DETOX_EXIT_CODE_FILE) {
    fs.writeFileSync(process.env.DETOX_EXIT_CODE_FILE, `${exitCode}\n`, {
        encoding: 'utf8',
        flag: 'wx',
    });
}

process.exitCode = exitCode;
