import {
    act,
    cleanup,
    fireEvent,
    render,
} from '@testing-library/react-native/pure';
import React from 'react';
import { FieldBottomNav } from '../components/layout/field-bottom-nav';
import { EmergencySosButton } from '../components/sos/emergency-sos-button';
import { EmergencySosSheet } from '../components/sos/emergency-sos-sheet';
import { ThemeProvider } from '../theme';
import type { DispatchJob } from '../types/index';

const job: DispatchJob = {
    id: 7,
    reference: 'DISP-007',
    client: 'North Harbor',
    title: 'Move crane',
    site: 'Pier 7',
    priority: { value: 'routine', label: 'Routine' },
    status: { value: 'dispatched', label: 'Dispatched' },
    version: 1,
    asset_assignments: [
        {
            id: 8,
            operational_asset_id: 9,
            asset_code: 'CRANE-9',
            asset_name: 'Mobile crane',
            asset_kind: 'mobile_crane',
        },
    ],
    capabilities: {
        can_respond: false,
        can_update_status: true,
        can_share_location: true,
    },
};

describe('Emergency SOS sheet', () => {
    afterEach(() => {
        cleanup();
        jest.useRealTimers();
    });

    it('does not activate on a normal tap', async () => {
        const onActivate = jest.fn().mockResolvedValue(undefined);

        const view = await render(
            <EmergencySosSheet
                actions={[]}
                deliveryState="preparing"
                isOnline={true}
                jobs={[job]}
                onActivate={onActivate}
                onClassify={jest.fn().mockResolvedValue(undefined)}
                onClose={jest.fn()}
                visible
            />,
        );

        await act(async () => {
            fireEvent.press(view.getByTestId('activate-emergency-sos'));
        });

        expect(onActivate).not.toHaveBeenCalled();
    });

    it('activates only after the full two-second hold and sends no required location', async () => {
        jest.useFakeTimers();
        const onActivate = jest.fn().mockResolvedValue(undefined);

        const view = await render(
            <EmergencySosSheet
                actions={[]}
                deliveryState="preparing"
                isOnline={true}
                jobs={[job]}
                onActivate={onActivate}
                onClassify={jest.fn().mockResolvedValue(undefined)}
                onClose={jest.fn()}
                visible
            />,
        );

        const button = view.getByTestId('activate-emergency-sos');
        await act(async () => {
            fireEvent(button, 'pressIn');
        });
        await act(async () => {
            jest.advanceTimersByTime(1_999);
        });
        expect(onActivate).not.toHaveBeenCalled();

        await act(async () => {
            jest.advanceTimersByTime(1);
        });

        // 2-second hold completed: confirmation modal is now presented for safety
        expect(view.getByTestId('confirm-broadcast-modal')).toBeVisible();
        expect(onActivate).not.toHaveBeenCalled();

        // Operator confirms broadcast to Operations Manager
        await act(async () => {
            fireEvent.press(view.getByTestId('confirm-broadcast-btn'));
        });

        expect(onActivate).toHaveBeenCalledTimes(1);
        expect(onActivate.mock.calls[0][0]).toMatchObject({
            category: 'unclassified',
            dispatch_job_id: 7,
            operational_asset_id: 9,
            location: null,
        });

        jest.clearAllTimers();
        jest.useRealTimers();
    });

    it('renders the floating SOS button with light theme cradle bezel', async () => {
        const view = await render(
            <ThemeProvider initialMode="light">
                <EmergencySosButton onHoldComplete={jest.fn()} />
            </ThemeProvider>,
        );
        const btn = view.getByTestId('open-emergency-sos');
        const styles = Array.isArray(btn.props.style)
            ? Object.assign({}, ...btn.props.style.filter(Boolean))
            : btn.props.style;
        expect(styles.borderColor).toBe('#FFFFFF');
        expect(styles.borderWidth).toBe(3.5);
        expect(styles.borderRadius).toBe(28);
    });

    it('renders the floating SOS button with dark HUD cradle bezel', async () => {
        const view = await render(
            <ThemeProvider initialMode="dark_hud">
                <EmergencySosButton onHoldComplete={jest.fn()} />
            </ThemeProvider>,
        );
        const btn = view.getByTestId('open-emergency-sos');
        const styles = Array.isArray(btn.props.style)
            ? Object.assign({}, ...btn.props.style.filter(Boolean))
            : btn.props.style;
        expect(styles.borderColor).toBe('#1E293B');
    });

    it('renders FieldBottomNav with clean SOS dock without artificial cutout background disc', async () => {
        const navView = await render(
            <FieldBottomNav
                activeItem="today"
                onSelect={jest.fn()}
                onSosHoldComplete={jest.fn()}
            />,
        );

        expect(navView.getByTestId('bottom-nav-bar')).toBeVisible();
        expect(navView.getByTestId('open-emergency-sos')).toBeVisible();
        expect(navView.queryByTestId('cradle-cutout')).toBeNull();
    });

    it('opens emergency SOS immediately on a simple tap without any hold state or delay', async () => {
        const onOpen = jest.fn();
        const view = await render(
            <EmergencySosButton onHoldComplete={onOpen} />,
        );
        const btn = view.getByTestId('open-emergency-sos');

        // Simple instantaneous tap
        await act(async () => {
            fireEvent.press(btn);
        });

        expect(onOpen).toHaveBeenCalledTimes(1);
    });

    it('allows selecting emergency category, toggling situational chips, and entering situation notes in preparing state', async () => {
        const onActivate = jest.fn().mockResolvedValue(undefined);

        const view = await render(
            <EmergencySosSheet
                actions={[]}
                deliveryState="preparing"
                isOnline={true}
                jobs={[job]}
                onActivate={onActivate}
                onClassify={jest.fn().mockResolvedValue(undefined)}
                onClose={jest.fn()}
                visible
            />,
        );

        // Select Equipment / Asset Failure category
        await act(async () => {
            fireEvent.press(
                view.getByTestId('sos-category-critical_asset_malfunction'),
            );
        });
        expect(
            view.getByTestId('sos-category-critical_asset_malfunction').props
                .accessibilityState.selected,
        ).toBe(true);

        // Toggle situational hazard chips
        await act(async () => {
            fireEvent.press(view.getByTestId('sos-chip-tipping_risk'));
        });
        expect(
            view.getByTestId('sos-chip-tipping_risk').props.accessibilityState
                .checked,
        ).toBe(true);

        // Enter freeform notes
        await act(async () => {
            fireEvent.changeText(
                view.getByTestId('sos-notes-input'),
                'Boom stuck at 45 degrees, hydraulic pressure drop.',
            );
        });

        expect(view.getByText('50/200 characters')).toBeVisible();
    });

    it('displays humanized safety desk card and classifies emergency in real-time during active incident', async () => {
        const onClassify = jest.fn().mockResolvedValue(undefined);

        const activeIncident = {
            id: 'sos-uuid-1234',
            category: 'unclassified' as const,
            status: 'acknowledged' as const,
            delivery_state: 'acknowledged' as const,
            device_activated_at: new Date().toISOString(),
            responder: {
                name: 'Elena Ramos (Safety Desk 1)',
                acknowledged_at: new Date().toISOString(),
            },
            worker_note: null,
        };

        const view = await render(
            <EmergencySosSheet
                actions={[
                    {
                        kind: 'call',
                        label: 'Call Safety Desk',
                        uri: 'tel:+15551234567',
                    },
                ]}
                activeIncident={activeIncident}
                deliveryState="acknowledged"
                isOnline={true}
                jobs={[job]}
                onActivate={jest.fn().mockResolvedValue(undefined)}
                onClassify={onClassify}
                onClose={jest.fn()}
                visible
            />,
        );

        // Central Safety Desk card with responder information is rendered
        expect(
            view.getByText('Central Safety Desk (Live Channel)'),
        ).toBeVisible();
        expect(
            view.getByText('Assigned Responder: Elena Ramos (Safety Desk 1)'),
        ).toBeVisible();
        expect(view.getByText('Call Safety Desk')).toBeVisible();

        // Switch emergency category to Site Incident / Worker Injured
        const injuryCategoryBtn = view.getByTestId(
            'sos-category-site_accident',
        );
        await act(async () => {
            fireEvent.press(injuryCategoryBtn);
        });

        expect(onClassify).toHaveBeenCalledWith('site_accident', undefined);

        // Toggle situational hazard chip
        const workerInjuredChip = view.getByTestId('sos-chip-worker_injured');
        await act(async () => {
            fireEvent.press(workerInjuredChip);
        });

        expect(onClassify).toHaveBeenCalledWith(
            'site_accident',
            '[Worker Injured]',
        );

        // Add detailed notes and submit via Update Dispatch Notes button
        const notesInput = view.getByTestId('sos-notes-input');
        await act(async () => {
            fireEvent.changeText(
                notesInput,
                '[Worker Injured] Rigger sustained foot injury near outrigger pad.',
            );
        });

        const sendNotesBtn = view.getByTestId('sos-send-notes-btn');
        await act(async () => {
            fireEvent.press(sendNotesBtn);
        });

        expect(onClassify).toHaveBeenCalledWith(
            'site_accident',
            '[Worker Injured] Rigger sustained foot injury near outrigger pad.',
        );
    });

    it('renders category selector with dark HUD styling in dark mode', async () => {
        const view = await render(
            <ThemeProvider initialMode="dark_hud">
                <EmergencySosSheet
                    actions={[]}
                    deliveryState="preparing"
                    isOnline={true}
                    jobs={[job]}
                    onActivate={jest.fn().mockResolvedValue(undefined)}
                    onClassify={jest.fn().mockResolvedValue(undefined)}
                    onClose={jest.fn()}
                    visible
                />
            </ThemeProvider>,
        );

        const sheetRoot = view.getByTestId('emergency-sos-sheet');
        const sheetStyles = Array.isArray(sheetRoot.props.style)
            ? Object.assign({}, ...sheetRoot.props.style.filter(Boolean))
            : sheetRoot.props.style;
        expect(sheetStyles.backgroundColor).toBe('#090D16');

        const categoryCard = view.getByTestId(
            'sos-category-vehicular_accident',
        );
        const cardStyles = Array.isArray(categoryCard.props.style)
            ? Object.assign({}, ...categoryCard.props.style.filter(Boolean))
            : categoryCard.props.style;
        expect(cardStyles.backgroundColor).toBe('#1E293B');
        expect(cardStyles.borderColor).toBe('#334155');
    });

    it('transmits selected emergency category and notes to Operations Manager upon completing 2-second hold', async () => {
        jest.useFakeTimers();
        const onActivate = jest.fn().mockResolvedValue(undefined);

        const view = await render(
            <EmergencySosSheet
                actions={[]}
                deliveryState="preparing"
                isOnline={true}
                jobs={[job]}
                onActivate={onActivate}
                onClassify={jest.fn().mockResolvedValue(undefined)}
                onClose={jest.fn()}
                visible
            />,
        );

        expect(view.getByText('Send to Operations Manager')).toBeVisible();
        expect(
            view.getByText(
                'Select emergency category and situation details before sending to the Operations Manager.',
            ),
        ).toBeVisible();

        // Operator selects Equipment / Asset Failure
        await act(async () => {
            fireEvent.press(
                view.getByTestId('sos-category-critical_asset_malfunction'),
            );
        });

        // Operator selects situational chip
        await act(async () => {
            fireEvent.press(view.getByTestId('sos-chip-tipping_risk'));
        });

        // Operator enters notes
        await act(async () => {
            fireEvent.changeText(
                view.getByTestId('sos-notes-input'),
                '[Tipping / Instability] Outrigger sinking into soft asphalt.',
            );
        });

        // Operator holds the activate button for full 2 seconds
        const button = view.getByTestId('activate-emergency-sos');
        await act(async () => {
            fireEvent(button, 'pressIn');
        });
        await act(async () => {
            jest.advanceTimersByTime(2_000);
        });

        // Confirmation modal is presented with emergency summary
        expect(view.getByTestId('confirm-broadcast-modal')).toBeVisible();
        expect(
            view.getAllByText('Equipment / Asset Failure').length,
        ).toBeGreaterThanOrEqual(1);
        expect(view.getAllByText('Tipping Risk').length).toBeGreaterThanOrEqual(
            1,
        );
        expect(
            view.getByText(
                '[Tipping / Instability] Outrigger sinking into soft asphalt.',
            ),
        ).toBeVisible();

        // Operator confirms broadcast
        await act(async () => {
            fireEvent.press(view.getByTestId('confirm-broadcast-btn'));
        });

        expect(onActivate).toHaveBeenCalledTimes(1);
        expect(onActivate.mock.calls[0][0]).toMatchObject({
            category: 'critical_asset_malfunction',
            dispatch_job_id: 7,
            operational_asset_id: 9,
            note: '[Tipping / Instability] Outrigger sinking into soft asphalt.',
            location: null,
        });

        jest.clearAllTimers();
        jest.useRealTimers();
    });

    it('keeps emergency categories, hazard chips, and notes visible and accessible during retrying state (prevents empty screen bug)', async () => {
        const view = await render(
            <EmergencySosSheet
                actions={[
                    {
                        kind: 'call',
                        label: 'Call Operations Desk',
                        uri: 'tel:+15559876543',
                    },
                ]}
                activeIncident={null}
                deliveryState="retrying"
                isOnline={false}
                jobs={[job]}
                onActivate={jest.fn().mockResolvedValue(undefined)}
                onClassify={jest.fn().mockResolvedValue(undefined)}
                onClose={jest.fn()}
                visible
            />,
        );

        // Beacon banner shows queued/retrying state with Operations Manager context
        expect(
            view.getByText('EMERGENCY ALERT QUEUED · RETRYING'),
        ).toBeVisible();
        expect(
            view.getByText('Retrying Transmission to Operations Manager'),
        ).toBeVisible();

        // Delivery status summary is rendered
        expect(view.getByTestId('sos-delivery-status')).toBeVisible();

        // CRITICAL BUG FIX: Category selector, chips, and notes are NOT hidden!
        expect(
            view.getByTestId('sos-category-vehicular_accident'),
        ).toBeVisible();
        expect(
            view.getByTestId('sos-category-critical_asset_malfunction'),
        ).toBeVisible();
        expect(view.getByTestId('sos-category-site_accident')).toBeVisible();
        expect(
            view.getByTestId('sos-category-other_immediate_danger'),
        ).toBeVisible();
        expect(view.getByTestId('sos-chip-tipping_risk')).toBeVisible();
        expect(view.getByTestId('sos-notes-input')).toBeVisible();
    });

    it('allows cancelling emergency broadcast from the confirmation modal to edit triage details', async () => {
        jest.useFakeTimers();
        const onActivate = jest.fn().mockResolvedValue(undefined);

        const view = await render(
            <EmergencySosSheet
                actions={[]}
                deliveryState="preparing"
                isOnline={true}
                jobs={[job]}
                onActivate={onActivate}
                onClassify={jest.fn().mockResolvedValue(undefined)}
                onClose={jest.fn()}
                visible
            />,
        );

        const button = view.getByTestId('activate-emergency-sos');
        await act(async () => {
            fireEvent(button, 'pressIn');
        });
        await act(async () => {
            jest.advanceTimersByTime(2_000);
        });

        expect(view.getByTestId('confirm-broadcast-modal')).toBeVisible();

        // Operator clicks Cancel & Edit
        await act(async () => {
            fireEvent.press(view.getByTestId('cancel-broadcast-btn'));
        });

        // Broadcast was NOT sent
        expect(onActivate).not.toHaveBeenCalled();

        jest.clearAllTimers();
        jest.useRealTimers();
    });
});
