import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { FieldSafetyScreen } from '../screens/FieldSafetyScreen';
import type { OutboxCommand } from '../types';

describe('FieldSafetyScreen', () => {
    it('explains offline limits and queues a stop-work order without claiming it reached Operations', async () => {
        const onIssueWorkStoppage = jest
            .fn()
            .mockResolvedValue('stop-command-1');
        const props = {
            activeSite: 'Pier 7',
            isOnline: false,
            commands: [] as OutboxCommand[],
            onBack: jest.fn(),
            onReportHazard: jest.fn().mockResolvedValue('hazard-command-1'),
            onIssueWorkStoppage,
        };
        const view = await render(<FieldSafetyScreen {...props} />);

        const offlineNotice = view.getByTestId('safety-offline-notice');
        expect(offlineNotice.props.children[1].props.children).toContain(
            'the Operations Manager has not received them yet.',
        );
        await fireEvent.press(view.getByTestId('open-stop-work-form'));
        await fireEvent.changeText(
            view.getByTestId('safety-area'),
            'North rigging zone',
        );
        await fireEvent.changeText(
            view.getByTestId('stop-work-reason'),
            'A suspended load is moving above an unprotected work area.',
        );
        await fireEvent.press(view.getByTestId('submit-stop-work'));

        await waitFor(() =>
            expect(onIssueWorkStoppage).toHaveBeenCalledWith({
                project_site: 'Pier 7',
                affected_area: 'North rigging zone',
                reason: 'A suspended load is moving above an unprotected work area.',
            }),
        );

        const queuedStop: OutboxCommand = {
            id: 'stop-command-1',
            actorId: 11,
            type: 'issue_work_stoppage',
            jobId: null,
            payload: {
                project_site: 'Pier 7',
                affected_area: 'North rigging zone',
                reason: 'A suspended load is moving above an unprotected work area.',
            },
            payloadHash: 'safe-test-hash',
            priority: 'emergency',
            state: 'queued',
            createdAt: '2026-09-24T08:00:00.000Z',
            updatedAt: '2026-09-24T08:00:00.000Z',
            attempts: 0,
        };
        await view.rerender(
            <FieldSafetyScreen {...props} commands={[queuedStop]} />,
        );

        expect(
            view.getByText(
                /Waiting for server confirmation.*Keep work stopped/i,
            ),
        ).toBeVisible();
        expect(
            view.getByText(/the order is sent and a manager lifts it/i),
        ).toBeVisible();
    });

    it('validates and submits a critical hazard report with the selected site and GPS evidence when available', async () => {
        const onReportHazard = jest.fn().mockResolvedValue('hazard-command-1');
        const view = await render(
            <FieldSafetyScreen
                activeSite="Pier 7"
                isOnline
                commands={[]}
                onBack={jest.fn()}
                onIssueWorkStoppage={jest
                    .fn()
                    .mockResolvedValue('stop-command-1')}
                onReportHazard={onReportHazard}
            />,
        );

        await fireEvent.press(view.getByTestId('open-hazard-form'));
        expect(view.getByTestId('safety-hazard-photo-picker')).toBeVisible();
        await fireEvent.press(view.getByTestId('submit-hazard'));
        expect(view.getByText(/Enter a site, location/)).toBeVisible();
        expect(onReportHazard).not.toHaveBeenCalled();

        await fireEvent.changeText(
            view.getByTestId('safety-area'),
            'North rigging zone',
        );
        await fireEvent.press(view.getByTestId('hazard-severity-critical'));
        await fireEvent.changeText(
            view.getByTestId('hazard-description'),
            'A damaged sling was found during inspection.',
        );
        await fireEvent.changeText(
            view.getByTestId('hazard-corrective-action'),
            'Remove it from service and inspect the replacement.',
        );
        await fireEvent.press(view.getByTestId('submit-hazard'));

        await waitFor(() =>
            expect(onReportHazard).toHaveBeenCalledWith(
                expect.objectContaining({
                    project_site: 'Pier 7',
                    location_detail: 'North rigging zone',
                    severity: 'critical',
                    location_latitude: null,
                    location_longitude: null,
                }),
            ),
        );
    });
});
