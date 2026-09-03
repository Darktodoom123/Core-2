import { cleanup, fireEvent, render } from '@testing-library/react-native/pure';
import '@testing-library/react-native/matchers';
import React from 'react';
import { AssetVehicleCard } from '../components/cards/AssetVehicleCard';
import { ThemeProvider } from '../theme';
import type { DispatchJob } from '../types/index';

describe('AssetVehicleCard Component', () => {
    afterEach(async () => {
        await cleanup();
        jest.clearAllMocks();
    });

    const mockJob: DispatchJob = {
        id: 101,
        reference: 'DISP-2026-0891',
        title: '50T Dual Pick & Set',
        status: {
            value: 'arrived',
            label: 'Arrived at Site',
        },
        priority: {
            value: 'priority',
            label: 'Priority',
        },
        scheduled_start: '2026-08-31T08:00:00Z',
        site: 'DMCI Block B',
        client: 'DMCI Power Corp',
        version: 1,
        capabilities: {
            can_respond: true,
            can_update_status: true,
            can_share_location: true,
        },
    };

    it('renders default heavy crane data, capacity, and DVIR cleared badge in daylight mode', async () => {
        const view = await render(
            <ThemeProvider initialMode="light">
                <AssetVehicleCard />
            </ThemeProvider>,
        );

        expect(view.getByTestId('hero-vehicle-card')).toBeTruthy();
        expect(view.getByText('ALB-CRN-050')).toBeTruthy();
        expect(view.getByText('Liebherr LTM 1050-3.1')).toBeTruthy();
        expect(view.getByText('50T All-Terrain')).toBeTruthy();
        expect(view.getByText('DVIR Cleared')).toBeTruthy();
        expect(
            view.getByText('20T Counterweight · Jib Extension'),
        ).toBeTruthy();
        expect(
            view.getByText('Yard Standby · Ready for Mobilization'),
        ).toBeTruthy();
        expect(view.getByText('4,820 hrs')).toBeTruthy();
        expect(view.getByText('82% Fuel')).toBeTruthy();
    });

    it('renders active dispatch mission details when assigned a job', async () => {
        const view = await render(
            <AssetVehicleCard
                activeJob={mockJob}
                assetCode="ALB-CRN-100"
                assetName="Grove GMK 5100"
                ratedCapacity="100T All-Terrain"
            />,
        );

        expect(view.getByText('ALB-CRN-100')).toBeTruthy();
        expect(view.getByText('Grove GMK 5100')).toBeTruthy();
        expect(view.getByText('100T All-Terrain')).toBeTruthy();
        expect(view.getByText('ACTIVE DISPATCH')).toBeTruthy();
        expect(view.getByText('DISP-2026-0891')).toBeTruthy();
        expect(view.getByText('50T Dual Pick & Set')).toBeTruthy();
        expect(view.getByText('DMCI Power Corp · DMCI Block B')).toBeTruthy();
    });

    it('renders different DVIR inspection status badges correctly', async () => {
        // Pending Pre-Trip
        const pendingView = await render(
            <AssetVehicleCard dvirStatus="pending" />,
        );
        expect(pendingView.getByText('Pre-Trip Due')).toBeTruthy();

        // Defect Flagged
        const defectView = await render(
            <AssetVehicleCard dvirStatus="defect" />,
        );
        expect(defectView.getByText('Defect Flagged')).toBeTruthy();
    });

    it('triggers onPress callback when interactive', async () => {
        const onPress = jest.fn();
        const view = await render(
            <AssetVehicleCard activeJob={mockJob} onPress={onPress} />,
        );

        const card = view.getByTestId('hero-vehicle-card');
        await fireEvent.press(card);
        expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('renders cleanly in dark HUD cockpit theme', async () => {
        const view = await render(
            <ThemeProvider initialMode="dark_hud">
                <AssetVehicleCard
                    activeJob={mockJob}
                    assetCode="ALB-CRN-050"
                    dvirStatus="cleared"
                />
            </ThemeProvider>,
        );

        expect(view.getByTestId('hero-vehicle-card')).toBeTruthy();
        expect(view.getByText('ALB-CRN-050')).toBeTruthy();
        expect(view.getByText('DVIR Cleared')).toBeTruthy();
        expect(view.getByText('DISP-2026-0891')).toBeTruthy();
    });
});
