import assert from 'node:assert/strict';
import test from 'node:test';
import { walletAssets } from '../screens/documents/document-catalog.js';

const linked = { assetCode: 'MOB-CRN-402', assetName: 'XCMG XCR55L4' };
const jobUnit = { assetCode: 'MOB-CRN-401', assetName: 'XCMG XCT25L5' };

test('a linked operator sees only the linked unit', () => {
    assert.deepEqual(walletAssets(linked, jobUnit), [linked]);
});

test('before linking, the current job unit is shown', () => {
    assert.deepEqual(walletAssets(null, jobUnit), [jobUnit]);
});

test('with no unit at all, nothing is offered', () => {
    assert.deepEqual(walletAssets(null, null), []);
    assert.deepEqual(walletAssets(null, { assetCode: '' }), []);
});
