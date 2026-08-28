import { cleanup, render } from '@testing-library/react-native/pure';
import React from 'react';
import { JobDetailScreen } from '../screens/JobDetailScreen';
import type { LocationSharingService } from '../services/locationService';
import type { DispatchJob, User } from '../types/index';

const mockUser: User = {
    id: 10,
    name: 'Juan Dela Cruz',
    username: 'juan.operator',
    email: 'operator@example.com',
    role: 'crane_operator',
    is_active: true,
};

const mockLocationService = {
    canShareLocation: () => true,
    startAutoTracking: jest.fn(),
    stopAutoTracking: jest.fn(),
    isTracking: () => false,
    shareLocation: jest.fn(),
    pauseSharing: jest.fn(),
} as unknown as LocationSharingService;

const defaultCapabilities = {
    can_respond: true,
    can_update_status: true,
    can_share_location: true,
};

describe('Machinery-Type Differentiated Workflows (Mobile vs Tower Crane)', () => {
    afterEach(async () => {
        await cleanup();
        jest.clearAllMocks();
    });

    it('renders Heavy Crane Route Card and omits Tower Weather Card for mobile crane assignment', async () => {
        const mobileJob: DispatchJob = {
            id: 101,
            reference: 'JOB-MOBILE-RT80',
            client: 'Megawide Construction',
            title: 'Steel Girder Erection',
            site: 'BGC Taguig Site',
            priority: { value: 'priority', label: 'Priority' },
            status: { value: 'accepted', label: 'Accepted' },
            version: 1,
            requirements: ['50T lift', 'Tandem lift'],
            capabilities: defaultCapabilities,
            asset_assignments: [
                {
                    id: 1,
                    operational_asset_id: 55,
                    asset_code: 'CRN-RT80',
                    asset_name: '80T Rough-Terrain Mobile Crane',
                    asset_kind: 'mobile_crane',
                },
            ],
            personnel_assignments: [],
        };

        const view = await render(
            <JobDetailScreen
                job={mobileJob}
                user={mockUser}
                outboxCommands={[]}
                locationService={mockLocationService}
                onBackToList={jest.fn()}
                onAcceptAssignment={jest.fn()}
                onRejectAssignment={jest.fn()}
                onTransitionStatus={jest.fn()}
                onAcceptServerState={jest.fn()}
                onRetryNewVersion={jest.fn()}
            />,
        );

        // Mobile Crane displays Route Card for highway transit
        expect(view.getByTestId('heavy-crane-route-card')).toBeTruthy();
        expect(view.getByText(/Heavy-crane route/i)).toBeTruthy();

        // Tower Crane Weather Card should NOT be present for mobile crane
        expect(view.queryByTestId('tower-crane-weather-card')).toBeNull();
    });

    it('renders Tower Crane Weather Card and omits Heavy Crane Route Card for stationary tower crane assignment', async () => {
        const towerJob: DispatchJob = {
            id: 202,
            reference: 'JOB-TOWER-MCT385',
            client: 'Ayala Land Premier',
            title: 'High-Rise Core Wall Pour',
            site: 'Makati Central Tower 1',
            priority: { value: 'routine', label: 'Routine' },
            status: { value: 'working', label: 'Working' },
            version: 1,
            requirements: ['Masthead anemometer active'],
            capabilities: defaultCapabilities,
            asset_assignments: [
                {
                    id: 2,
                    operational_asset_id: 88,
                    asset_code: 'TWR-385',
                    asset_name: 'Potain MCT385 Topless Tower Crane',
                    asset_kind: 'tower_crane',
                },
            ],
            personnel_assignments: [],
        };

        const view = await render(
            <JobDetailScreen
                job={towerJob}
                user={mockUser}
                outboxCommands={[]}
                locationService={mockLocationService}
                onBackToList={jest.fn()}
                onAcceptAssignment={jest.fn()}
                onRejectAssignment={jest.fn()}
                onTransitionStatus={jest.fn()}
                onAcceptServerState={jest.fn()}
                onRetryNewVersion={jest.fn()}
            />,
        );

        // Tower Crane renders the masthead weather & wind monitoring card
        expect(view.getByTestId('tower-crane-weather-card')).toBeTruthy();

        // Highway route card is omitted for stationary tower crane
        expect(view.queryByText(/Heavy crane route/i)).toBeNull();
    });
});
