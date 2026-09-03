import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveTrackingPreview } from '@/components/dashboards/live-tracking-preview';
import type { LiveTrackingPreviewProps } from '@/components/dashboards/live-tracking-preview';
import type {
    LocationUpdateViewModel,
    SosIncidentViewModel,
} from '@/types/workspace';

const mapState = vi.hoisted(() => ({ unavailable: false }));

// Exercise the preview's actual controls while replacing only the lazy map's
// browser/WebGL boundary. Selection travels through the public map callbacks.
vi.mock('@/components/live-tracking-map', () => ({
    LiveTrackingMap: ({
        locations,
        selectedLocationId,
        onSelectedLocationChange,
    }: {
        locations: LocationUpdateViewModel[];
        selectedLocationId?: number | null;
        onSelectedLocationChange?: (id: number | null) => void;
    }) => (
        <section aria-label="Map test surface">
            {mapState.unavailable ? (
                <p role="status">Map unavailable</p>
            ) : (
                <>
                    <output aria-label="Map selection">
                        {selectedLocationId ?? 'None'}
                    </output>
                    {locations
                        .filter(
                            (location) =>
                                location.latitude !== null &&
                                location.longitude !== null,
                        )
                        .map((location) => (
                            <button
                                key={location.id}
                                onClick={() =>
                                    onSelectedLocationChange?.(location.id)
                                }
                            >
                                Map marker{' '}
                                {location.asset?.code ?? location.user.name}
                            </button>
                        ))}
                </>
            )}
        </section>
    ),
}));

function location(
    id: number,
    overrides: Partial<LocationUpdateViewModel> = {},
): LocationUpdateViewModel {
    return {
        id,
        user: { id: 100 + id, name: `Operator ${id}` },
        asset: {
            id: 200 + id,
            code: `CRN-${id}`,
            name: `Hydraulic crane ${id}`,
            kind: 'crane',
        },
        job: {
            id: 300 + id,
            reference: `JOB-${id}`,
            title: `Assigned lift ${id}`,
            site: 'North yard',
        },
        latitude: 14.5995,
        longitude: 121.0142,
        accuracy_metres: 5,
        speed: null,
        remarks: null,
        source: 'mobile',
        sharing_enabled: true,
        captured_at: '2026-09-03T03:00:00Z',
        received_at: '2026-09-03T03:10:00Z',
        freshness_status: 'offline',
        ...overrides,
    };
}

const crane = location(1);
const truck = location(2, {
    asset: {
        id: 202,
        code: 'TRK-202',
        name: 'Support flatbed',
        kind: 'truck',
    },
    freshness_status: 'fresh',
    captured_at: '2026-09-03T03:59:00Z',
    received_at: '2026-09-03T03:59:05Z',
});
const southCrane = location(3, {
    job: {
        id: 303,
        reference: 'JOB-3',
        title: 'South lift',
        site: 'South yard',
    },
    freshness_status: 'delayed',
});
const worker = location(4, {
    asset: null,
    user: { id: 104, name: 'Alex Reyes' },
    job: null,
    latitude: null,
    longitude: null,
    captured_at: null,
    received_at: null,
    freshness_status: 'stale',
});

function sosFor(
    unit: LocationUpdateViewModel,
    status: SosIncidentViewModel['status']['value'] = 'active',
): SosIncidentViewModel {
    return {
        id: `sos-${unit.id}`,
        category: { value: 'site_accident', label: 'Site accident' },
        status: { value: status, label: status },
        note: 'Operator requires assistance',
        worker: { ...unit.user, phone: null },
        received_at: '2026-09-03T03:59:00Z',
        device_activated_at: null,
        escalation_due_at: null,
        escalated_at: null,
        acknowledged_at: null,
        acknowledged_by: null,
        resolved_at: null,
        resolved_by: null,
        resolution_code: null,
        resolution_notes: null,
        cancelled_at: null,
        cancellation_reason: null,
        dispatch: null,
        asset: unit.asset,
        location: null,
        delivery_attempts: [],
        can_acknowledge: false,
        can_resolve: false,
        can_cancel: false,
    };
}

async function show(overrides: Partial<LiveTrackingPreviewProps> = {}) {
    const props: LiveTrackingPreviewProps = {
        locations: [crane, truck, southCrane, worker],
        ...overrides,
    };
    const result = render(<LiveTrackingPreview {...props} />);
    await screen.findByRole('region', { name: 'Map test surface' });

    return { ...result, props };
}

function inspect(name: string) {
    return screen.getByRole('button', { name: `Inspect ${name}` });
}

function search(value: string) {
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find a unit' }), {
        target: { value },
    });
}

describe('field tracking preview', () => {
    beforeEach(() => {
        mapState.unavailable = false;
        vi.spyOn(Date, 'now').mockReturnValue(
            new Date('2026-09-03T04:00:00Z').getTime(),
        );
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('keeps actual unit freshness distinct from the feed connection', async () => {
        const { rerender, props } = await show({ realtimeConnected: true });
        expect(
            screen.getByRole('heading', { name: 'Field tracking' }),
        ).toBeInTheDocument();
        const summary = screen.getByRole('group', { name: 'Unit freshness' });

        for (const label of [
            '4 units',
            '1 fresh',
            '1 delayed',
            '1 stale',
            '1 offline',
        ]) {
            expect(within(summary).getByText(label)).toBeInTheDocument();
        }

        expect(screen.getByText('Feed connected')).toBeInTheDocument();
        expect(
            screen.queryByText('Live', { exact: true }),
        ).not.toBeInTheDocument();
        expect(
            screen.getByText('Showing last reported locations'),
        ).toBeInTheDocument();

        rerender(<LiveTrackingPreview {...props} realtimeConnected={false} />);
        expect(screen.getByText('Feed disconnected')).toBeInTheDocument();
        expect(within(summary).getByText('1 fresh')).toBeInTheDocument();
        expect(within(summary).getByText('1 offline')).toBeInTheDocument();

        rerender(
            <LiveTrackingPreview {...props} realtimeConnected={undefined} />,
        );
        expect(
            screen.queryByText(/Feed connected|Feed disconnected/),
        ).not.toBeInTheDocument();
    });

    it('searches case-insensitively by asset ID, equipment name, and personnel name', async () => {
        await show();

        search('  trk-202  ');
        expect(inspect('TRK-202')).toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: 'Inspect CRN-1' }),
        ).not.toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'Map marker TRK-202' }),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: 'Map marker CRN-1' }),
        ).not.toBeInTheDocument();

        search('HYDRAULIC');
        expect(inspect('CRN-1')).toBeInTheDocument();
        expect(inspect('CRN-3')).toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: 'Inspect TRK-202' }),
        ).not.toBeInTheDocument();

        search('alex reyes');
        expect(inspect('Alex Reyes')).toBeEnabled();
    });

    it('composes asset, assigned-jobsite, attention, and search filters', async () => {
        await show();
        fireEvent.click(
            screen.getByRole('button', {
                name: 'Asset type filter: All Types',
            }),
        );
        fireEvent.click(
            screen.getByRole('menuitemcheckbox', { name: /^Cranes/ }),
        );
        fireEvent.keyDown(document, { key: 'Escape' });
        fireEvent.change(
            screen.getByRole('combobox', { name: 'Assigned jobsite' }),
            {
                target: { value: 'North yard' },
            },
        );
        fireEvent.click(
            screen.getByRole('button', { name: /^Needs attention/ }),
        );
        search('crn');

        expect(inspect('CRN-1')).toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: 'Inspect CRN-3' }),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: 'Inspect TRK-202' }),
        ).not.toBeInTheDocument();
        expect(
            screen.getByRole('group', { name: 'Unit freshness' }),
        ).toHaveTextContent('1 offline');

        fireEvent.change(
            screen.getByRole('combobox', { name: 'Assigned jobsite' }),
            {
                target: { value: 'South yard' },
            },
        );
        expect(inspect('CRN-3')).toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: 'Inspect CRN-1' }),
        ).not.toBeInTheDocument();
        expect(
            screen.getByRole('group', { name: 'Unit freshness' }),
        ).toHaveTextContent('1 delayed');
    });

    it.each(['active', 'escalated', 'acknowledged'] as const)(
        'includes fresh units with an %s SOS in Needs attention',
        async (status) => {
            await show({ activeSosIncidents: [sosFor(truck, status)] });
            fireEvent.click(
                screen.getByRole('button', { name: /^Needs attention/ }),
            );
            expect(inspect('TRK-202')).toBeInTheDocument();
            expect(inspect('CRN-1')).toBeInTheDocument();
            expect(inspect('CRN-3')).toBeInTheDocument();
            expect(inspect('Alex Reyes')).toBeInTheDocument();
            expect(
                screen.getByRole('button', { name: /^Needs attention/ }),
            ).toHaveAttribute('aria-pressed', 'true');
        },
    );

    it.each(['resolved', 'cancelled'] as const)(
        'excludes fresh units whose SOS is %s from Needs attention',
        async (status) => {
            await show({ activeSosIncidents: [sosFor(truck, status)] });
            fireEvent.click(
                screen.getByRole('button', { name: /^Needs attention/ }),
            );
            expect(
                screen.queryByRole('button', { name: 'Inspect TRK-202' }),
            ).not.toBeInTheDocument();
            fireEvent.click(screen.getByRole('button', { name: /^All units/ }));
            expect(inspect('TRK-202')).toBeInTheDocument();
        },
    );

    it('synchronizes selection in both directions and clears excluded markers', async () => {
        await show();
        expect(screen.getByLabelText('Map selection')).toHaveTextContent(
            'None',
        );
        fireEvent.click(inspect('CRN-1'));
        expect(inspect('CRN-1')).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByLabelText('Map selection')).toHaveTextContent('1');

        fireEvent.click(
            screen.getByRole('button', { name: 'Map marker TRK-202' }),
        );
        expect(inspect('TRK-202')).toHaveAttribute('aria-pressed', 'true');
        expect(inspect('CRN-1')).toHaveAttribute('aria-pressed', 'false');
        expect(
            screen.getByRole('region', { name: 'Selected unit details' }),
        ).toHaveTextContent('TRK-202');

        search('no such unit');
        expect(screen.getByText('No matching units')).toBeInTheDocument();
        expect(screen.getByLabelText('Map selection')).toHaveTextContent(
            'None',
        );
        expect(
            screen.queryByRole('region', { name: 'Selected unit details' }),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: /^Map marker/ }),
        ).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
        expect(
            screen.getByRole('searchbox', { name: 'Find a unit' }),
        ).toHaveValue('');
        expect(inspect('TRK-202')).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByLabelText('Map selection')).toHaveTextContent(
            'None',
        );
    });

    it('clears a selection when refreshed data removes that unit', async () => {
        const { rerender } = await show();
        fireEvent.click(inspect('CRN-1'));
        rerender(<LiveTrackingPreview locations={[truck]} />);
        expect(screen.getByLabelText('Map selection')).toHaveTextContent(
            'None',
        );
        expect(
            screen.queryByRole('region', { name: 'Selected unit details' }),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByText('Showing last reported locations'),
        ).not.toBeInTheDocument();
    });

    it('keeps captured and received timestamps distinct in selected details', async () => {
        await show();
        fireEvent.click(inspect('CRN-1'));
        const details = screen.getByRole('region', {
            name: 'Selected unit details',
        });
        expect(within(details).getByText('Captured')).toBeInTheDocument();
        expect(within(details).getByText('Received')).toBeInTheDocument();
        const captured = details.querySelector(
            'time[datetime="2026-09-03T03:00:00Z"]',
        );
        const received = details.querySelector(
            'time[datetime="2026-09-03T03:10:00Z"]',
        );
        expect(captured).toHaveTextContent('2026');
        expect(received).toHaveTextContent('2026');
        expect(captured?.textContent).not.toBe(received?.textContent);
    });

    it('allows inspection of units without coordinates or timestamps', async () => {
        await show();
        expect(inspect('Alex Reyes')).toBeEnabled();
        fireEvent.click(inspect('Alex Reyes'));
        expect(inspect('Alex Reyes')).toHaveAttribute('aria-pressed', 'true');
        const details = screen.getByRole('region', {
            name: 'Selected unit details',
        });
        expect(details).toHaveTextContent('Alex Reyes');
        expect(details).toHaveTextContent('Coordinates unavailable');
        expect(details.querySelector('time[datetime]')).not.toBeInTheDocument();
        expect(details).not.toHaveTextContent(/Invalid Date|NaN/);
    });

    it('keeps every matching unit reachable beyond the old five-row limit', async () => {
        await show({
            locations: Array.from({ length: 7 }, (_, index) =>
                location(index + 1),
            ),
        });
        expect(
            screen.getAllByRole('button', { name: /^Inspect / }),
        ).toHaveLength(7);
        fireEvent.click(inspect('CRN-7'));
        expect(
            screen.getByRole('region', { name: 'Selected unit details' }),
        ).toHaveTextContent('CRN-7');
    });

    it('retains filters and selected details while switching Map and List views', async () => {
        await show();
        const view = within(
            screen.getByRole('group', { name: 'Tracking view' }),
        );
        expect(view.getByRole('button', { name: 'Map' })).toHaveAttribute(
            'aria-pressed',
            'true',
        );
        search('crn-1');
        fireEvent.click(view.getByRole('button', { name: 'List' }));
        expect(view.getByRole('button', { name: 'List' })).toHaveAttribute(
            'aria-pressed',
            'true',
        );
        fireEvent.click(inspect('CRN-1'));
        fireEvent.click(view.getByRole('button', { name: 'Map' }));
        expect(
            screen.getByRole('searchbox', { name: 'Find a unit' }),
        ).toHaveValue('crn-1');
        expect(screen.getByLabelText('Map selection')).toHaveTextContent('1');
        expect(
            screen.getByRole('region', { name: 'Selected unit details' }),
        ).toHaveTextContent('CRN-1');
    });

    it('keeps inspection available when the map reports an unavailable state', async () => {
        mapState.unavailable = true;
        await show();
        expect(screen.getByText('Map unavailable')).toBeInTheDocument();
        fireEvent.click(inspect('CRN-1'));
        expect(
            screen.getByRole('region', { name: 'Selected unit details' }),
        ).toHaveTextContent('CRN-1');
    });

    it('explains an empty feed and opens full tracking only on request', async () => {
        const onOpenTracking = vi.fn();
        await show({ locations: [], onOpenTracking });
        expect(screen.getByText('No location updates')).toBeInTheDocument();
        expect(
            screen.getByRole('group', { name: 'Unit freshness' }),
        ).toHaveTextContent('0 units');
        expect(
            screen.queryByText('Showing last reported locations'),
        ).not.toBeInTheDocument();
        expect(onOpenTracking).not.toHaveBeenCalled();
        fireEvent.click(
            screen.getByRole('button', { name: 'Open full tracking' }),
        );
        expect(onOpenTracking).toHaveBeenCalledOnce();
    });
});
