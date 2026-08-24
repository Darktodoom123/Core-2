import {
    act,
    cleanup,
    fireEvent,
    render,
} from '@testing-library/react-native/pure';
import React from 'react';
import { EmergencySosSheet } from '../components/sos/emergency-sos-sheet';
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

        fireEvent.press(view.getByTestId('activate-emergency-sos'));

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
        fireEvent(button, 'pressIn');
        await act(async () => {
            jest.advanceTimersByTime(1_999);
        });
        expect(onActivate).not.toHaveBeenCalled();

        await act(async () => {
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
});
