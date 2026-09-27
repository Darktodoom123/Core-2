import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { ReliefHandoverModal } from '../components/sheets/ReliefHandoverModal';
import { ApiClientError } from '../services/apiClient';
import type { FieldApiClient } from '../services/apiClient';
import { ThemeProvider } from '../theme';
import type { ThemeMode } from '../theme';

const MODES: ThemeMode[] = ['light', 'dark_hud'];

const started = {
    dispatch_job_id: 42,
    asset_code: 'CRN-7',
    pin: '5307',
    handover_token: '0f8e7d6c-1111-4222-8333-444455556666',
    expires_at: '2026-09-27T12:15:00Z',
};

const claimed = {
    dispatch_job_id: 42,
    asset_code: 'CRN-7',
    status: 'transferred',
    previous_operator_id: 3,
    active_operator_id: 9,
    active_operator_name: 'Relief Operator',
};

const fakeApi = (overrides: Partial<Record<string, jest.Mock>> = {}) => {
    const api = {
        initiateEquipmentHandover: jest.fn(async () => ({ data: started })),
        claimEquipmentHandoverByUnit: jest.fn(async () => claimed),
        ...overrides,
    };

    return api as unknown as FieldApiClient & typeof api;
};

const renderModal = (
    mode: ThemeMode,
    props: Partial<React.ComponentProps<typeof ReliefHandoverModal>>,
) =>
    render(
        <ThemeProvider initialMode={mode}>
            <ReliefHandoverModal
                isOnline
                mode="incoming_claim"
                onClose={jest.fn()}
                visible
                {...props}
            />
        </ThemeProvider>,
    );

describe.each(MODES)('Relief handover (%s)', (mode) => {
    describe('outgoing operator', () => {
        it('starts the handover on the server and shows the PIN it returned', async () => {
            const api = fakeApi();
            const view = await renderModal(mode, {
                apiClient: api,
                assetCode: 'CRN-7',
                jobId: 42,
                mode: 'outgoing_offer',
            });

            expect(
                await view.findByTestId('handover-pin-display'),
            ).toHaveTextContent('5307');
            expect(api.initiateEquipmentHandover).toHaveBeenCalledWith(42);
            expect(view.getByText(/^Expires /)).toBeTruthy();
            expect(view.queryByText(/1-Tap/)).toBeNull();
            expect(view.queryByTestId('send-push-handover-btn')).toBeNull();
        });

        it('shows no PIN at all when the server did not start a handover', async () => {
            const api = fakeApi({
                initiateEquipmentHandover: jest
                    .fn()
                    .mockRejectedValueOnce(
                        new ApiClientError('Not assigned', 403),
                    )
                    .mockResolvedValueOnce({ data: started }),
            });
            const view = await renderModal(mode, {
                apiClient: api,
                assetCode: 'CRN-7',
                jobId: 42,
                mode: 'outgoing_offer',
            });

            expect(
                await view.findByText("Couldn't start the handover"),
            ).toBeTruthy();
            expect(view.queryByTestId('handover-pin-display')).toBeNull();
            expect(view.queryByText(/8421/)).toBeNull();

            await fireEvent.press(view.getByTestId('handover-start-retry'));
            expect(
                await view.findByTestId('handover-pin-display'),
            ).toHaveTextContent('5307');
        });

        it('explains that there is nothing to hand over without a job', async () => {
            const api = fakeApi();
            const view = await renderModal(mode, {
                apiClient: api,
                jobId: null,
                mode: 'outgoing_offer',
            });

            expect(view.getByText(/no active job to hand over/i)).toBeTruthy();
            expect(api.initiateEquipmentHandover).not.toHaveBeenCalled();
        });
    });

    describe('relief operator', () => {
        const fill = async (
            view: Awaited<ReturnType<typeof renderModal>>,
            unit: string,
            pin: string,
        ) => {
            await fireEvent.changeText(
                view.getByTestId('handover-unit-input'),
                unit,
            );
            await fireEvent.changeText(
                view.getByTestId('handover-pin-input'),
                pin,
            );
        };

        it('needs the unit code and a four-digit PIN before it can claim', async () => {
            const view = await renderModal(mode, { apiClient: fakeApi() });
            const button = view.getByTestId('claim-pin-btn');

            expect(button).toBeDisabled();
            await fill(view, 'CRN-7', '53');
            expect(button).toBeDisabled();
            await fill(view, '', '5307');
            expect(button).toBeDisabled();
            expect(view.queryByTestId('claim-1tap-btn')).toBeNull();
        });

        it('only reports a claim once the server has accepted it', async () => {
            const api = fakeApi();
            const onClaimed = jest.fn();
            const onClose = jest.fn();
            const view = await renderModal(mode, {
                apiClient: api,
                onClaimed,
                onClose,
            });

            await fill(view, ' crn-7 ', '5307');
            await fireEvent.press(view.getByTestId('claim-pin-btn'));

            await waitFor(() =>
                expect(onClaimed).toHaveBeenCalledWith(claimed),
            );
            expect(api.claimEquipmentHandoverByUnit).toHaveBeenCalledWith(
                'CRN-7',
                '5307',
            );
            expect(onClose).toHaveBeenCalled();
        });

        it('shows the server reason and stays open when the claim is rejected', async () => {
            const api = fakeApi({
                claimEquipmentHandoverByUnit: jest
                    .fn()
                    .mockRejectedValue(
                        new ApiClientError(
                            'That PIN is not right for this unit.',
                            422,
                        ),
                    ),
            });
            const onClaimed = jest.fn();
            const onClose = jest.fn();
            const view = await renderModal(mode, {
                apiClient: api,
                onClaimed,
                onClose,
            });

            await fill(view, 'CRN-7', '1111');
            await fireEvent.press(view.getByTestId('claim-pin-btn'));

            expect(
                await view.findByText('That PIN is not right for this unit.'),
            ).toBeTruthy();
            expect(onClaimed).not.toHaveBeenCalled();
            expect(onClose).not.toHaveBeenCalled();
        });

        it('does not pretend to claim while offline', async () => {
            const api = fakeApi();
            const view = await renderModal(mode, {
                apiClient: api,
                isOnline: false,
            });

            await fill(view, 'CRN-7', '5307');

            expect(view.getByText(/needs a connection/i)).toBeTruthy();
            expect(view.getByTestId('claim-pin-btn')).toBeDisabled();
        });
    });
});
