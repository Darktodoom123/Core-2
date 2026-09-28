import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { signatureSvg } from '../components/signature/signature-svg';
import { checkHandoverForm } from '../screens/rental/handover-form';

const complete = {
    hourMeter: ' 1532.4 ',
    fuelLevel: '65',
    signeeName: ' Maria Cruz ',
    signatureData: 'data:image/svg+xml;base64,PHN2Zy8+',
};

describe('checkHandoverForm', () => {
    test('passes on what the operator entered, trimmed', () => {
        assert.deepEqual(checkHandoverForm(complete), {
            ok: true,
            values: {
                hourMeter: 1532.4,
                fuelLevelPercent: 65,
                signeeName: 'Maria Cruz',
                signatureBase64: 'data:image/svg+xml;base64,PHN2Zy8+',
            },
        });
    });

    test('lists every missing or impossible entry instead of filling it in', () => {
        const result = checkHandoverForm({
            hourMeter: '',
            fuelLevel: '101',
            signeeName: '  ',
        });

        assert.equal(result.ok, false);
        assert.equal(result.ok ? 0 : result.problems.length, 4);
    });

    test('refuses a negative meter and a part percent', () => {
        assert.equal(
            checkHandoverForm({ ...complete, hourMeter: '-1' }).ok,
            false,
        );
        assert.equal(
            checkHandoverForm({ ...complete, fuelLevel: '12.5' }).ok,
            false,
        );
        assert.equal(
            checkHandoverForm({ ...complete, fuelLevel: '0' }).ok,
            true,
        );
    });
});

describe('signatureSvg', () => {
    test('draws each stroke, cropped to the ink', () => {
        const svg = signatureSvg([
            [
                { x: 20, y: 30 },
                { x: 40, y: 50 },
            ],
            [{ x: 60, y: 30 }],
        ]);

        assert.equal(
            svg,
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 36">' +
                '<g fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
                '<polyline points="8,8 28,28"/><polyline points="48,8"/></g></svg>',
        );
    });

    test('has nothing to draw without ink', () => {
        assert.equal(signatureSvg([]), null);
        assert.equal(signatureSvg([[]]), null);
    });
});
