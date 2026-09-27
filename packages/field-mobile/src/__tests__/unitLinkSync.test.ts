import assert from 'node:assert/strict';
import test from 'node:test';
import {
    hasPendingLinkChange,
    readServerUnitLink,
    reconcileUnitLink,
} from '../services/unitLinkSync.js';
import type { OutboxCommand, ServerUnitLink } from '../types/index.js';

const LOCAL_LINK = {
    assetCode: 'CRN-101',
    linkedAt: '2026-09-27T07:00:00+08:00',
};

function serverLink(overrides: Partial<ServerUnitLink> = {}): ServerUnitLink {
    return {
        id: 1,
        operational_asset_id: 42,
        asset_code: 'CRN-101',
        asset_name: '50T Crane',
        dispatch_job_id: 9,
        linked_at: '2026-09-27T07:00:05+08:00',
        released_at: null,
        release_reason: null,
        ...overrides,
    };
}

function linkCommand(overrides: Partial<OutboxCommand> = {}): OutboxCommand {
    return {
        id: 'cmd-link',
        actorId: 7,
        type: 'link_unit',
        payload: { operational_asset_id: 42, asset_code: 'CRN-101' },
        payloadHash: 'hash',
        state: 'queued',
        createdAt: '2026-09-27T07:00:00+08:00',
        updatedAt: '2026-09-27T07:00:00+08:00',
        attempts: 0,
        ...overrides,
    };
}

test('a new phone takes the link the server holds', () => {
    assert.deepEqual(
        reconcileUnitLink(
            { link: null, changedAt: 0 },
            { link: serverLink(), fetchedAt: 10 },
            [],
        ),
        { assetCode: 'CRN-101', linkedAt: '2026-09-27T07:00:05+08:00' },
    );
});

test('a release made elsewhere, or by ending the shift, unlinks this phone', () => {
    assert.equal(
        reconcileUnitLink(
            { link: LOCAL_LINK, changedAt: 5 },
            { link: null, fetchedAt: 10 },
            [],
        ),
        null,
    );
});

test('offline, the phone keeps its own link', () => {
    assert.deepEqual(
        reconcileUnitLink({ link: LOCAL_LINK, changedAt: 5 }, null, []),
        LOCAL_LINK,
    );
});

test('a link still waiting to send is not undone by the server answer', () => {
    assert.deepEqual(
        reconcileUnitLink(
            { link: LOCAL_LINK, changedAt: 5 },
            { link: null, fetchedAt: 10 },
            [linkCommand()],
        ),
        LOCAL_LINK,
    );
});

test('a server answer from before the latest link or release is ignored', () => {
    assert.deepEqual(
        reconcileUnitLink(
            { link: LOCAL_LINK, changedAt: 20 },
            { link: null, fetchedAt: 10 },
            [],
        ),
        LOCAL_LINK,
    );
});

test('a link the server refused is dropped, even before the next fetch', () => {
    assert.equal(
        reconcileUnitLink({ link: LOCAL_LINK, changedAt: 5 }, null, [
            linkCommand({ state: 'conflict' }),
        ]),
        null,
    );
    assert.equal(
        reconcileUnitLink({ link: LOCAL_LINK, changedAt: 5 }, null, [
            linkCommand({
                state: 'failed',
                error: { message: 'Locked out', retryable: false },
            }),
        ]),
        null,
    );
});

test('an old refusal does not undo a later link of the same unit', () => {
    assert.deepEqual(
        reconcileUnitLink({ link: LOCAL_LINK, changedAt: 5 }, null, [
            linkCommand({
                state: 'conflict',
                createdAt: '2026-09-26T07:00:00+08:00',
            }),
        ]),
        LOCAL_LINK,
    );
});

test('only queued, sending, or retryable link changes count as pending', () => {
    assert.equal(hasPendingLinkChange([linkCommand()]), true);
    assert.equal(
        hasPendingLinkChange([
            linkCommand({ type: 'release_unit', state: 'syncing' }),
        ]),
        true,
    );
    assert.equal(
        hasPendingLinkChange([linkCommand({ state: 'completed' })]),
        false,
    );
    assert.equal(
        hasPendingLinkChange([linkCommand({ state: 'conflict' })]),
        false,
    );
    assert.equal(
        hasPendingLinkChange([
            linkCommand({ type: 'submit_dvir', state: 'queued' }),
        ]),
        false,
    );
});

test('an unreadable server answer is an error, never "unlinked"', () => {
    assert.equal(readServerUnitLink(null), null);
    assert.equal(
        readServerUnitLink({
            asset_code: 'CRN-101',
            linked_at: '2026-09-27T07:00:05+08:00',
        })?.asset_code,
        'CRN-101',
    );
    assert.throws(() => readServerUnitLink([]));
    assert.throws(() => readServerUnitLink({}));
    assert.throws(() => readServerUnitLink(undefined));
    assert.throws(() =>
        readServerUnitLink({ asset_code: 'CRN-101', linked_at: 'soon' }),
    );
});
