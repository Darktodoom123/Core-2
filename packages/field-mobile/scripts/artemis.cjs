'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { configureAndroidSdk } = require('./android-sdk.cjs');

const root = path.resolve(__dirname, '../../..');
const local = path.join(root, '.artemis');
const runtime = path.join(local, 'runtime');
const revision = '371aa6df56880643da57b30da936e9812fb0ec66';
const repository = 'https://github.com/google/artemis.git';
const [command = 'help', ...args] = process.argv.slice(2);
const env = {
    ...process.env,
    UV_CACHE_DIR: path.join(local, 'uv-cache'),
    UV_PYTHON_INSTALL_DIR: path.join(local, 'python'),
    UV_PYTHON_PREFERENCE: 'only-managed',
    PYTHONIOENCODING: 'utf-8',
    ARTEMIS_APP_DIR: runtime,
    ARTEMIS_TRACES_DIR: path.join(local, 'traces'),
    ARTEMIS_DAEMON_PORT: process.env.ARTEMIS_DAEMON_PORT || '8001',
};

function run(executable, parameters, cwd = runtime, capture = false) {
    const result = spawnSync(executable, parameters, {
        cwd,
        env,
        encoding: 'utf8',
        stdio: capture ? 'pipe' : 'inherit',
        shell: false,
    });

    if (result.error) {
        throw new Error(`${executable}: ${result.error.message}`);
    }

    if (result.status !== 0) {
        throw new Error(
            `${executable} failed (${result.status}). ${capture ? result.stderr : ''}`,
        );
    }

    return result.stdout?.trim();
}

function verifyRuntime() {
    if (!fs.existsSync(path.join(runtime, '.git'))) {
        throw new Error('Run npm run mobile:artemis:setup first.');
    }

    if (run('git', ['rev-parse', 'HEAD'], runtime, true) !== revision) {
        throw new Error(
            'Artemis checkout differs from the pinned revision; review it before running.',
        );
    }
}

function configureDevicePath() {
    configureAndroidSdk();
    Object.assign(env, process.env);
    // Prefer the installed Python dependency over potentially broken Windows aliases.
    const binaries = path.join(
        runtime,
        '.venv/Lib/site-packages/imageio_ffmpeg/binaries',
    );

    if (
        process.platform === 'win32' &&
        !env.ARTEMIS_FFMPEG_PATH &&
        fs.existsSync(binaries)
    ) {
        const executable = fs
            .readdirSync(binaries)
            .find((name) => name.endsWith('.exe'));

        if (executable) {
            env.ARTEMIS_FFMPEG_PATH = path.join(binaries, executable);
        }
    }
}

function main() {
    if (command === 'setup') {
        fs.mkdirSync(local, { recursive: true });

        if (!fs.existsSync(runtime)) {
            run('git', ['init', runtime], root);
            run('git', ['remote', 'add', 'origin', repository]);
            const gitOptions =
                process.platform === 'win32'
                    ? ['-c', 'http.sslBackend=openssl']
                    : [];
            run('git', [
                ...gitOptions,
                'fetch',
                '--depth',
                '1',
                'origin',
                revision,
            ]);
            run('git', ['checkout', '--detach', revision]);
        }

        verifyRuntime();
        run('uv', ['sync', '--frozen', '--no-dev', '--python', '3.12']);

        if (!fs.existsSync(path.join(runtime, '.env'))) {
            fs.copyFileSync(
                path.join(runtime, '.env.example'),
                path.join(runtime, '.env'),
            );
        }

        console.log(
            'Installed pinned Artemis. Configure .artemis/runtime/.env, then run mobile:artemis:doctor.',
        );

        return;
    }

    if (command === 'help') {
        console.log(
            'Artemis: setup | doctor | smoke <device-serial> | run <device-serial> <prompt-file> | mcp | cli <args>',
        );

        return;
    }

    verifyRuntime();
    configureDevicePath();

    if (command === 'mcp') {
        run('uv', ['run', '--no-sync', 'python', '-m', 'mcp_server']);

        return;
    }

    if (command === 'doctor' || command === 'cli') {
        run('uv', [
            'run',
            '--no-sync',
            'artemis',
            ...(command === 'doctor' ? ['doctor'] : args),
        ]);

        return;
    }

    if (command !== 'smoke' && command !== 'run') {
        throw new Error(`Unknown command: ${command}`);
    }

    const serial = args[0];

    if (!serial || (command === 'run' && !args[1])) {
        throw new Error(
            'Specify the test device serial and, for run, a prompt file.',
        );
    }

    const devices = run('adb', ['devices'], root, true);
    const connected = devices.split(/\r?\n/).some((line) => {
        const [id, state] = line.trim().split(/\s+/);

        return id === serial && state === 'device';
    });

    if (!connected) {
        throw new Error(
            `Selected device ${serial} is not connected and authorized. Check adb devices.`,
        );
    }

    const installed = run(
        'adb',
        ['-s', serial, 'shell', 'pm', 'path', 'com.core2.fieldmobile'],
        root,
        true,
    );

    if (!installed.startsWith('package:')) {
        throw new Error(
            'Install the Core-2 development APK on the selected device first.',
        );
    }

    const promptPath =
        command === 'smoke'
            ? path.join(__dirname, '../testing/artemis/smoke.md')
            : path.resolve(root, args[1]);
    const prompt = fs.readFileSync(promptPath, 'utf8');
    const tracePath = path.join(
        local,
        'traces',
        new Date().toISOString().replace(/[:.]/g, '-'),
    );
    fs.mkdirSync(tracePath, { recursive: true });
    run('uv', [
        'run',
        '--no-sync',
        'artemis',
        'run',
        prompt,
        '--profile',
        'pro',
        '--verification-level',
        'strict',
        '--device-serial',
        serial,
        '--locked-app',
        'com.core2.fieldmobile',
        '--standalone',
        '--test-name',
        `core2-${command}`,
        '--traces-path',
        tracePath,
    ]);
    console.log(
        `Execution ended. Review evidence in ${tracePath}; CLI completion alone is not a test pass.`,
    );
}

try {
    main();
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
