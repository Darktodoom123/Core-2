import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IncomingWork } from '@/components/workspace/incoming-work/incoming-work';
import type {
    DispatchJobViewModel,
    RentalDispatchHandoffViewModel,
    ServiceRequestViewModel,
    WorkspaceCapabilities,
} from '@/types/workspace';

const serviceRequest: ServiceRequestViewModel = {
    id: 11,
    reference: 'JO-2026-0201',
    client: {
        id: 1,
        code: 'C1-CL-0101',
        company_name: 'Megaworld Tower Builders Inc.',
    },
    project_name: 'Tower 3 precast facade panel lift',
    service_type: 'crane_lift',
    location: 'Uptown Bonifacio, Taguig City',
    site_notes: 'Gate pass at Guard House B.',
    scheduled_date: '2026-10-01T06:00:00+08:00',
    priority: { value: 'priority', label: 'Priority', tone: 'warning' },
    status: { value: 'submitted', label: 'Submitted', tone: 'info' },
    requirements: [
        'MOB-CRN-402 · XCMG XCR55L4 Rough-Terrain Crane',
        'Operator',
    ],
    dispatch_jobs_count: 0,
} as ServiceRequestViewModel;

const rental = {
    id: 21,
    reference: 'RN-2026-0031',
    client: {
        id: 2,
        code: 'C1-CL-0102',
        company_name: 'Ayala Land Estates Construction',
    },
    status: { value: 'reserved', label: 'Reserved', tone: 'info' },
    fulfillment_mode: 'delivery',
    location: 'Makati City',
    dispatch_job_id: null,
    ready: true,
    start_date: '2026-10-02',
    end_date: '2026-10-16',
    rental_items: [
        {
            id: 1,
            name: 'HEQ-LG-950E · LiuGong 950E Crawler Excavator',
            quantity: 1,
            operator: 'Operator',
        },
    ],
} as RentalDispatchHandoffViewModel;

const queuePage = {
    items: [
        {
            key: 'service-11',
            mode: 'service',
            sourceLabel: 'Service request',
            reference: 'JO-2026-0201',
            client: 'Megaworld Tower Builders Inc.',
            detail: 'Tower 3 precast facade panel lift',
            status: 'Submitted',
            sourceId: 11,
        },
        {
            key: 'rental-21',
            mode: 'rental',
            sourceLabel: 'Rental delivery',
            reference: 'RN-2026-0031',
            client: 'Ayala Land Estates Construction',
            detail: 'Makati City',
            status: 'Reserved',
            sourceId: 21,
        },
    ],
    service_requests: [serviceRequest],
    rental_handoffs: [rental],
    total: 2,
    current_page: 1,
    last_page: 1,
    per_page: 25,
};

function capabilities(
    overrides: Partial<WorkspaceCapabilities> = {},
): WorkspaceCapabilities {
    return {
        create_dispatch: true,
        create_service_request: false,
        convert_service_request: true,
        create_rental_dispatch: true,
        ...overrides,
    } as WorkspaceCapabilities;
}

function renderIncoming(
    props: Partial<Parameters<typeof IncomingWork>[0]> = {},
) {
    return render(
        <IncomingWork
            clients={[]}
            serviceRequests={[]}
            rentalHandoffs={[]}
            jobs={[]}
            capabilities={capabilities()}
            {...props}
        />,
    );
}

describe('IncomingWork', () => {
    beforeEach(() => {
        vi.stubGlobal(
            'fetch',
            vi.fn(
                async () =>
                    new Response(JSON.stringify(queuePage), { status: 200 }),
            ),
        );
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('lists Core 1 job orders and rentals and filters by type', async () => {
        renderIncoming();

        expect(await screen.findByText('JO-2026-0201')).toBeInTheDocument();
        expect(screen.getByText('RN-2026-0031')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /Rentals/ }));

        expect(screen.queryByText('JO-2026-0201')).not.toBeInTheDocument();
        expect(screen.getByText('RN-2026-0031')).toBeInTheDocument();
    });

    it('lists urgent job orders before routine rentals', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(
                async () =>
                    new Response(
                        JSON.stringify({
                            ...queuePage,
                            items: [...queuePage.items].reverse(),
                        }),
                        { status: 200 },
                    ),
            ),
        );
        renderIncoming();

        const queue = await screen.findByRole('list', {
            name: 'Incoming work queue',
        });
        const rows = within(queue).getAllByRole('listitem');

        expect(rows[0]).toHaveTextContent('JO-2026-0201');
        expect(rows[1]).toHaveTextContent('RN-2026-0031');
    });

    it('opens a job order with read-only Core 1 details and no manual reference field', async () => {
        renderIncoming();

        fireEvent.click(await screen.findByText('JO-2026-0201'));

        expect(
            screen.getByRole('heading', {
                name: 'Tower 3 precast facade panel lift',
            }),
        ).toBeInTheDocument();
        expect(
            screen.getByText(/update the order in Core 1/i),
        ).toBeInTheDocument();
        expect(
            screen.getByText(/No existing dispatch looks like this order/i),
        ).toBeInTheDocument();
        expect(
            screen.queryByLabelText(/Dispatch reference/i),
        ).not.toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'Create dispatch' }),
        ).toBeEnabled();

        const needs = screen.getByRole('region', {
            name: 'Equipment and operator',
        });
        expect(needs).toHaveTextContent('MOB-CRN-402 · XCMG XCR55L4');
        expect(needs).toHaveTextContent('Operator');
    });

    it('shows a rental unit from our fleet with the operator it needs', async () => {
        renderIncoming();

        fireEvent.click(await screen.findByText('RN-2026-0031'));

        const needs = screen.getByRole('region', {
            name: 'Equipment and operator',
        });
        expect(needs).toHaveTextContent(
            'HEQ-LG-950E · LiuGong 950E Crawler Excavator',
        );
        expect(needs).toHaveTextContent('Operator');
    });

    it('warns when a manual draft for the same client may already cover the order', async () => {
        const manualDraft = {
            id: 7,
            reference: 'DSP-MAN-2026-004',
            client: 'Megaworld Tower Builders Inc.',
            source: null,
        } as unknown as DispatchJobViewModel;

        renderIncoming({ jobs: [manualDraft] });

        fireEvent.click(await screen.findByText('JO-2026-0201'));

        expect(
            screen.getByText(/was created by hand for the same client/i),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'Open DSP-MAN-2026-004' }),
        ).toBeInTheDocument();
    });

    it('offers the Core 1 simulator only to users who can create service requests', async () => {
        const { unmount } = renderIncoming();

        await screen.findByText('JO-2026-0201');
        expect(
            screen.queryByRole('button', { name: /Simulate Core 1 order/i }),
        ).not.toBeInTheDocument();
        unmount();

        renderIncoming({
            capabilities: capabilities({ create_service_request: true }),
        });
        fireEvent.click(
            await screen.findByRole('button', {
                name: /Simulate Core 1 order/i,
            }),
        );

        expect(
            screen.getByRole('heading', {
                name: 'Simulate a Core 1 job order',
            }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'Send to Incoming work' }),
        ).toBeInTheDocument();
    });
});
