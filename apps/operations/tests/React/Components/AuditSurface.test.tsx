import {
    fireEvent,
    render,
    screen,
    waitFor,
    within,
} from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditSurface } from '@/components/workspace/audit/audit-surface';

vi.mock('@inertiajs/react', () => ({
    router: { reload: vi.fn() },
    useForm: (initial: Record<string, unknown>) => ({
        data: initial,
        errors: {},
        processing: false,
        setData: vi.fn(),
        post: vi.fn(),
    }),
}));

const page = {
    events: [
        {
            id: 3,
            action: 'user.access_updated',
            actor: { id: 1, name: 'Ada Admin' },
            occurred_at: '2026-09-29T08:00:00Z',
            reason: 'Promoted to manager',
            subject_type: 'user',
            subject_id: 9,
            before: { role: 'operator', is_active: true },
            after: { role: 'operations_manager', is_active: true },
            ip_address: '10.0.0.5',
            request_id: '5b0e9b4e-1d1c-4a51-9d0b-6a3e0f7f2c11',
        },
    ],
    total: 51,
    current_page: 1,
    last_page: 3,
    per_page: 25,
    counts: {
        all: 51,
        access: 20,
        dispatch: 10,
        fleet: 8,
        safety: 5,
        reports: 4,
        gpt: 4,
        overrides: 1,
    },
    actors: [{ id: 1, name: 'Ada Admin' }],
    last_24h_total: 4,
};

let fetchMock: ReturnType<typeof vi.fn>;

describe('AuditSurface', () => {
    beforeEach(() => {
        fetchMock = vi.fn(() =>
            Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve(page),
            }),
        );
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('shows server totals and pages instead of a fixed sample', async () => {
        render(<AuditSurface />);

        expect(
            await screen.findByText('Showing 1–25 of 51 events'),
        ).toBeInTheDocument();
        expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
        expect(screen.getByText('Account access changed')).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'Access & people (20)' }),
        ).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
        await waitFor(() =>
            expect(fetchMock).toHaveBeenLastCalledWith(
                '/operations/audit-events?page=2&per_page=25',
                expect.anything(),
            ),
        );
    });

    it('asks the server for a category and resets to the first page', async () => {
        render(<AuditSurface />);
        await screen.findByText('Showing 1–25 of 51 events');

        fireEvent.click(
            screen.getByRole('button', { name: 'Admin overrides (1)' }),
        );

        await waitFor(() =>
            expect(fetchMock).toHaveBeenLastCalledWith(
                '/operations/audit-events?category=overrides&per_page=25',
                expect.anything(),
            ),
        );
    });

    it('explains an event with a field-level before and after', async () => {
        render(<AuditSurface />);

        fireEvent.click(
            await screen.findByRole('button', {
                name: 'View details: Account access changed',
            }),
        );

        const dialog = await screen.findByRole('dialog');
        const row = within(dialog).getByRole('row', { name: /role/i });
        expect(within(row).getByText('operator')).toBeInTheDocument();
        expect(within(row).getByText('operations_manager')).toBeInTheDocument();
        expect(
            within(dialog).queryByRole('row', { name: /is active/i }),
        ).not.toBeInTheDocument();
        expect(within(dialog).getByText('10.0.0.5')).toBeInTheDocument();
    });

    it('offers finished audit exports for download on the same page', async () => {
        render(
            <AuditSurface
                exports={[
                    {
                        id: 'e1',
                        export_type: {
                            value: 'system_audit',
                            label: 'System audit',
                        },
                        format: 'CSV',
                        status: { value: 'completed', label: 'Completed' },
                        filters: null,
                        file_size_bytes: 1200,
                        row_count: 67,
                        error_message: null,
                        expires_at: null,
                        created_at: '2026-09-29T08:00:00Z',
                        completed_at: '2026-09-29T08:01:00Z',
                        is_downloadable: true,
                        can_download: true,
                        is_expired: false,
                        download_url:
                            '/operations/reports/exports/e1/download?signature=x',
                        retry_url: '/operations/reports/exports/e1/retry',
                    },
                    {
                        id: 'e2',
                        export_type: {
                            value: 'dispatches',
                            label: 'Dispatches',
                        },
                        format: 'CSV',
                        status: { value: 'completed', label: 'Completed' },
                        filters: null,
                        file_size_bytes: 10,
                        row_count: 1,
                        error_message: null,
                        expires_at: null,
                        created_at: null,
                        completed_at: null,
                        is_downloadable: true,
                        can_download: true,
                        is_expired: false,
                        download_url: '/other',
                        retry_url: '/other/retry',
                    },
                ]}
            />,
        );

        const panel = await screen.findByRole('region', {
            name: 'Your audit exports',
        });
        expect(within(panel).getByText('67 events')).toBeInTheDocument();
        expect(
            within(panel).getByRole('link', { name: 'Download' }),
        ).toHaveAttribute(
            'href',
            '/operations/reports/exports/e1/download?signature=x',
        );
        expect(within(panel).getAllByRole('link')).toHaveLength(1);
    });
});
