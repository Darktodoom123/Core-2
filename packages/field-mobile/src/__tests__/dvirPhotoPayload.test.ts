import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWalkaroundPhotosPayload } from '../screens/dvir/dvir-record-builder.js';

const photo = (name: string) => ({
    uri: `file:///${name}.jpg`,
    fileName: `${name}.jpg`,
    fileSize: 100,
    base64: 'abc',
});

test('sends the cab photo as the cab angle and every defect close-up as the defect angle', () => {
    const payload = buildWalkaroundPhotosPayload({
        front: photo('front'),
        cab: photo('cab'),
        defect_1: photo('d1'),
        defect_2: photo('d2'),
    });

    assert.deepEqual(payload.map((item) => item.angle).sort(), [
        'cab',
        'defect',
        'defect',
        'front',
    ]);
    assert.ok(payload.every((item) => item.base64 === 'abc'));
});

test('sends nothing for empty slots', () => {
    assert.deepEqual(buildWalkaroundPhotosPayload({}), []);
});
