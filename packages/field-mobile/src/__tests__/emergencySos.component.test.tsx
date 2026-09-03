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

        await fireEvent.press(view.getByTestId('activate-emergency-sos'));

        expect(onActivate).not.toHaveBeenCalled();
    });

    it('activates only after the full two-second hold and sends no required location', async () => {
        jest.useFakeTimers();
        const onActivate = jest
            .fn()
            .mockImplementation(() => new Promise<void>(() => undefined));

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
        await fireEvent(button, 'pressIn');
        await act(async () => {
            await Promise.resolve();
        });
        await act(() => {
            jest.advanceTimersByTime(1_999);
            expect(onActivate).not.toHaveBeenCalled();
            jest.advanceTimersByTime(1);
        });

        expect(onActivate).toHaveBeenCalledTimes(1);
        expect(onActivate.mock.calls[0][0]).toMatchObject({
            category: 'unclassified',
            dispatch_job_id: 7,
            operational_asset_id: 9,
            location: null,
        });
    });

    it('renders the floating SOS button with theme-aware cradle bezel in light and dark mode', async () => {
        // Light mode
        const lightView = await render(
            <ThemeProvider initialMode="light">
                <EmergencySosButton onHoldComplete={jest.fn()} />
            </ThemeProvider>,
        );
        const lightBtn = lightView.getByTestId('open-emergency-sos');
        const lightStyles = Array.isArray(lightBtn.props.style)
            ? Object.assign({}, ...lightBtn.props.style.filter(Boolean))
            : lightBtn.props.style;
        expect(lightStyles.borderColor).toBe('#FFFFFF');
        expect(lightStyles.borderWidth).toBe(3.5);
        expect(lightStyles.borderRadius).toBe(28);

        // Dark HUD mode
        const darkView = await render(
            <ThemeProvider initialMode="dark_hud">
                <EmergencySosButton onHoldComplete={jest.fn()} />
            </ThemeProvider>,
        );
        const darkBtn = darkView.getByTestId('open-emergency-sos');
        const darkStyles = Array.isArray(darkBtn.props.style)
            ? Object.assign({}, ...darkBtn.props.style.filter(Boolean))
            : darkBtn.props.style;
        expect(darkStyles.borderColor).toBe('#1E293B');
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
});
