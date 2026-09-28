import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { declineReasonText } from '../components/sheets/decline-reason';

describe('declineReasonText', () => {
    test('needs a reason, and words of their own for Other', () => {
        assert.equal(declineReasonText(null, 'note'), null);
        assert.equal(declineReasonText('Other', '  '), null);
        assert.equal(declineReasonText('Other', ' Flat tyre '), 'Flat tyre');
        assert.equal(declineReasonText('Sick leave', ''), 'Sick leave');
        assert.equal(
            declineReasonText('Hours conflict', 'at 9h'),
            'Hours conflict: at 9h',
        );
    });
});
