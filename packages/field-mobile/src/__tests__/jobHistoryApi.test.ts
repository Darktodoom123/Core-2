import assert from 'node:assert/strict';
import test from 'node:test';
import { FieldApiClient } from '../services/apiClient';

const clientReturning = (body: unknown, status = 200) => {
    const urls: string[] = [];
    const client = new FieldApiClient({
        baseUrl: 'http://localhost:8000',
        getToken: () => 'token',
        fetchFn: (async (input: RequestInfo | URL) => {
            urls.push(input.toString());

            return new Response(JSON.stringify(body), { status });
        }) as typeof fetch,
    });

    return { client, urls };
};

test('asks the server for the operator history window and page', async () => {
    const { client, urls } = clientReturning({
        data: [
            {
                id: 7,
                reference: 'JOB-7',
                completed_at: '2026-09-27T08:00:00+00:00',
            },
        ],
        meta: { current_page: 1, last_page: 3 },
    });

    const page = await client.fetchJobHistory(1);

    assert.equal(
        urls[0],
        'http://localhost:8000/api/v1/dispatch-jobs?scope=history&days=30&page=1',
    );
    assert.equal(page.items[0].id, 7);
    assert.equal(page.items[0].completed_at, '2026-09-27T08:00:00+00:00');
    assert.equal(page.nextPage, 2);
});

test('reports no next page on the last page', async () => {
    const { client } = clientReturning({
        data: [],
        meta: { current_page: 2, last_page: 2 },
    });

    assert.equal((await client.fetchJobHistory(2)).nextPage, null);
});

test('surfaces a server failure instead of an empty history', async () => {
    const { client } = clientReturning({ message: 'Server Error' }, 500);

    await assert.rejects(() => client.fetchJobHistory(1));
});
