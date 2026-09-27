import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildReplacementRequest,
    REPLACEMENT_REASON,
} from '../components/sheets/replacement-request/replacement-request.js';

const job = (status: string) =>
    ({
        id: 7,
        version: 3,
        status: { value: status, label: status },
    }) as never;

test('asks dispatch for a replacement with a context the server accepts', () => {
    for (const [status, context] of [
        ['en_route', 'transit'],
        ['accepted', 'on_site'],
        ['on_site', 'on_site'],
    ] as const) {
        const payload = buildReplacementRequest({
            asset: { operational_asset_id: 12 },
            job: job(status),
            note: '  Boom hoist brake slipping  ',
            reportedAt: '2026-09-27T08:00:00.000Z',
        });

        assert.equal(payload.context, context, status);
        assert.ok(['transit', 'on_site'].includes(payload.context));
    }
});

test('carries the unit, the job version and the operator’s own words', () => {
    const payload = buildReplacementRequest({
        asset: { operational_asset_id: 12 },
        job: job('accepted'),
        note: '  Boom hoist brake slipping  ',
        reportedAt: '2026-09-27T08:00:00.000Z',
    });

    assert.equal(payload.dispatch_job_id, 7);
    assert.equal(payload.job_version, 3);
    assert.equal(payload.operational_asset_id, 12);
    assert.equal(payload.reason, REPLACEMENT_REASON);
    assert.equal(
        payload.notes,
        'Replacement unit needed. Boom hoist brake slipping',
    );
});
