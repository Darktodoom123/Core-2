/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

const packageRoot = path.resolve(process.cwd(), 'node_modules', 'image-size');
// Windows child-process startup can consume more than 500 ms even when the
// parser returns immediately. Keep the strict parser bound on CI/Linux while
// allowing a bounded startup margin on the supported local Windows runner.
const timeoutMs = process.platform === 'win32' ? 2000 : 500;

function box(size, type, payload = []) {
    return [
        (size >>> 24) & 0xff,
        (size >>> 16) & 0xff,
        (size >>> 8) & 0xff,
        size & 0xff,
        ...Buffer.from(type),
        ...payload,
    ];
}

const malformedFixtures = {
    icnsZeroEntry: Uint8Array.from([
        ...Buffer.from('icns'),
        0, 0, 0, 16,
        ...Buffer.from('is32'),
        0, 0, 0, 0,
    ]),
    jxlZeroPartial: Uint8Array.from([
        ...box(16, 'JXL '),
        ...box(16, 'ftyp', [...Buffer.from('jxl '), 0, 0, 0, 0]),
        ...box(0, 'jxlp'),
    ]),
    heifZeroMeta: Uint8Array.from([
        ...box(16, 'ftyp', [...Buffer.from('heic'), 0, 0, 0, 0]),
        ...box(0, 'meta'),
    ]),
};

function assertReturns(name, input) {
    return new Promise((resolve, reject) => {
        const child = spawn(
            process.execPath,
            [
                '-e',
                "const imageSize = require(process.argv[1]); try { imageSize(Buffer.from(process.argv[2], 'base64')); process.stdout.write('returned'); } catch (error) { process.stdout.write('error:' + error.message); }",
                packageRoot,
                Buffer.from(input).toString('base64'),
            ],
            { stdio: ['ignore', 'pipe', 'pipe'] },
        );
        const timer = setTimeout(() => {
            child.kill();
            reject(new Error(`${name} exceeded ${timeoutMs}ms`));
        }, timeoutMs);
        child.on('error', reject);
        child.on('close', () => {
            clearTimeout(timer);
            resolve();
        });
    });
}

async function main() {
    for (const [name, input] of Object.entries(malformedFixtures)) {
        await assertReturns(name, input);
    }

    const imageSize = require(packageRoot);
    const result = imageSize(path.resolve('packages/field-mobile/assets/icon.png'));
    assert.ok(result.width > 0 && result.height > 0, 'mobile icon dimensions must resolve');

    const version = require(path.join(packageRoot, 'package.json')).version;
    assert.match(version, /^2\.0\.3-core2\./, 'the in-tree fork must remain explicitly versioned');
    console.log(`image-size hardening fixtures passed (${version})`);
}

main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
