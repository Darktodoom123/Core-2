import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { JobListItemCard } from '../components/cards/JobListItemCard';
import { DispatchIntakeSheet } from '../components/sheets/DispatchIntakeSheet';
import { ReportDelayModal } from '../components/sheets/ReportDelayModal';
import { DispatchOrdersScreen } from '../screens/DispatchOrdersScreen';
import type { DispatchJob, ReportDelayPayload } from '../types/index';

const mockMultiAssetJob: DispatchJob = {
    id: 101,
    reference: 'DISP-2026-0891',
    title: '50T Crane Transit & Rigging',
    status: {
        value: 'en_route',
        label: 'En Route',
    },
    priority: {
        value: 'priority',
        label: 'Priority',
    },
    scheduled_start: '2026-09-03T08:00:00Z',
    scheduled_end: '2026-09-03T18:00:00Z',
    site: 'Batangas Power Plant Expansion',
    client: 'DMCI Power & Infra',
    version: 3,
    capabilities: {
        can_respond: true,
        can_update_status: true,
        can_share_location: true,
    },
    asset_assignments: [
        {
            id: 1,
            operational_asset_id: 50,
            asset_code: 'ALB-CRN-050',
            asset_name: '50T Tadano All-Terrain Crane',
            asset_kind: 'mobile_crane',
        },
        {
            id: 2,
            operational_asset_id: 51,
            asset_code: 'ALB-TRK-012',
            asset_name: 'Support Flatbed Hauler',
            asset_kind: 'transport',
        },
    ],
};

const mockWorkingJob: DispatchJob = {
    ...mockMultiAssetJob,
    id: 102,
    status: {
        value: 'working',
        label: 'Working / On Site',
    },
    asset_assignments: [
        {
            id: 1,
            operational_asset_id: 50,
            asset_code: 'ALB-CRN-050',
            asset_name: '50T Tadano All-Terrain Crane',
            asset_kind: 'mobile_crane',
        },
    ],
};

const mockPendingJob: DispatchJob = {
    ...mockMultiAssetJob,
    id: 103,
    my_assignment: {
        id: 99,
        response_status: 'pending',
        response_status_label: 'Pending Response',
    },
};

describe('Job Delay Reporting Mobile Components', () => {
    describe('ReportDelayModal', () => {
        it('renders transit delay reasons by default for en_route job and allows submitting a transit delay', async () => {
            const onSubmit = jest.fn();
            const onClose = jest.fn();

            const view = await render(
                <ReportDelayModal
                    job={mockMultiAssetJob}
                    onClose={onClose}
                    onSubmit={onSubmit}
                    visible={true}
                />,
            );

            expect(view.getByText('Report Operational Delay')).toBeTruthy();
            expect(
                view.getByText('DISP-2026-0891 · 50T Crane Transit & Rigging'),
            ).toBeTruthy();
            expect(view.getByText('Traffic Congestion')).toBeTruthy();
            expect(view.getByText('Road Closure / Detour')).toBeTruthy();

            // Select Traffic Congestion
            await fireEvent.press(view.getByTestId('delay-reason-traffic'));

            // Select 45 min estimated delay
            await fireEvent.press(view.getByTestId('minute-chip-45'));

            // Enter notes
            const notesInput = view.getByTestId('delay-notes-input');
            await fireEvent.changeText(
                notesInput,
                'SLEX tollway heavy backlog',
            );

            // Select Entire Job chip
            await fireEvent.press(view.getByTestId('asset-chip-whole-job'));

            // Submit
            await fireEvent.press(view.getByTestId('submit-delay-btn'));

            expect(onSubmit).toHaveBeenCalledTimes(1);
            const payload: ReportDelayPayload = onSubmit.mock.calls[0][0];
            expect(payload.dispatch_job_id).toBe(101);
            expect(payload.context).toBe('transit');
            expect(payload.reason).toBe('traffic');
            expect(payload.estimated_minutes).toBe(45);
            expect(payload.notes).toBe('SLEX tollway heavy backlog');
            expect(payload.operational_asset_id).toBeNull();
            expect(payload.job_version).toBe(3);
            expect(onClose).toHaveBeenCalled();
        });

        it('switches to on-site stage reasons when on-site toggle is pressed', async () => {
            const onSubmit = jest.fn();
            const onClose = jest.fn();

            const view = await render(
                <ReportDelayModal
                    job={mockWorkingJob}
                    onClose={onClose}
                    onSubmit={onSubmit}
                    visible={true}
                />,
            );

            // Defaults to on_site for working status
            expect(view.getByText('Site Not Prepared')).toBeTruthy();
            expect(view.getByText('Materials / Rigging Missing')).toBeTruthy();
            expect(view.getByText('Awaiting Safety Clearance')).toBeTruthy();

            // Select Site Not Prepared
            await fireEvent.press(
                view.getByTestId('delay-reason-site_not_ready'),
            );

            await fireEvent.press(view.getByTestId('submit-delay-btn'));

            expect(onSubmit).toHaveBeenCalledTimes(1);
            const payload: ReportDelayPayload = onSubmit.mock.calls[0][0];
            expect(payload.context).toBe('on_site');
            expect(payload.reason).toBe('site_not_ready');
            expect(payload.dispatch_job_id).toBe(102);
            expect(payload.operational_asset_id).toBe(50);
        });

        it('shows DVIR cross-reference banner and opens DVIR when equipment_issue is selected', async () => {
            const onSubmit = jest.fn();
            const onNavigateDvir = jest.fn();

            const view = await render(
                <ReportDelayModal
                    job={mockMultiAssetJob}
                    onClose={jest.fn()}
                    onNavigateDvir={onNavigateDvir}
                    onSubmit={onSubmit}
                    visible={true}
                />,
            );

            // Select Equipment Issue
            await fireEvent.press(
                view.getByTestId('delay-reason-equipment_issue'),
            );

            // DVIR notice banner appears explaining it does not replace DVIR or cause auto-lockout
            expect(
                view.getByText(
                    /Reporting a delay explains operational hold-up to dispatch/i,
                ),
            ).toBeTruthy();

            // Open DVIR button navigates
            const dvirBtn = view.getByTestId('go-to-dvir-btn');
            await fireEvent.press(dvirBtn);
            expect(onNavigateDvir).toHaveBeenCalledTimes(1);
        });

        it('validates that a reason must be selected before submitting', async () => {
            const onSubmit = jest.fn();

            const view = await render(
                <ReportDelayModal
                    job={mockMultiAssetJob}
                    onClose={jest.fn()}
                    onSubmit={onSubmit}
                    visible={true}
                />,
            );

            await fireEvent.press(view.getByTestId('submit-delay-btn'));
            expect(onSubmit).not.toHaveBeenCalled();
            expect(
                view.getByText('Please select a delay reason.'),
            ).toBeTruthy();
        });
    });

    describe('JobListItemCard Delay Actions and Badges', () => {
        it('renders Report Delay button for active/accepted jobs and invokes onReportDelay', async () => {
            const onReportDelay = jest.fn();

            const view = await render(
                <JobListItemCard
                    job={mockWorkingJob}
                    onReportDelay={onReportDelay}
                />,
            );

            const reportBtn = view.getByTestId('report-delay-btn-102');
            expect(reportBtn).toBeTruthy();

            await fireEvent.press(reportBtn);
            expect(onReportDelay).toHaveBeenCalledTimes(1);
            expect(onReportDelay).toHaveBeenCalledWith(mockWorkingJob);
        });

        it('does not render Report Delay button when job has a pending assignment response requirement', async () => {
            const onReportDelay = jest.fn();

            const view = await render(
                <JobListItemCard
                    job={mockPendingJob}
                    onReportDelay={onReportDelay}
                />,
            );

            expect(view.queryByTestId('report-delay-btn-103')).toBeNull();
            expect(view.getByTestId('accept-assignment-btn-103')).toBeTruthy();
            expect(view.getByTestId('decline-assignment-btn-103')).toBeTruthy();
        });

        it('renders delay status banner when job has a latest_delay reported', async () => {
            const jobWithDelay: DispatchJob = {
                ...mockWorkingJob,
                latest_delay: {
                    id: 42,
                    dispatch_job_id: 102,
                    context: 'on_site',
                    context_label: 'On Site',
                    reason: 'site_not_ready',
                    reason_label: 'Site Not Prepared',
                    estimated_minutes: 45,
                    notes: 'Crane pad soft ground requires crane mats before setup.',
                    reported_by: { id: 1, name: 'Test Operator' },
                    reported_at: '2026-09-17T12:00:00Z',
                    created_at: '2026-09-17T12:00:00Z',
                },
            };

            const view = await render(
                <JobListItemCard
                    job={jobWithDelay}
                    onReportDelay={jest.fn()}
                />,
            );

            const banner = view.getByTestId('delay-status-banner-102');
            expect(banner).toBeTruthy();
            expect(
                view.getByText(/Delay Reported: Site Not Prepared \(\+45m\)/),
            ).toBeTruthy();
            expect(
                view.getByText(
                    'Crane pad soft ground requires crane mats before setup.',
                ),
            ).toBeTruthy();
        });
    });

    describe('DispatchOrdersScreen and DispatchIntakeSheet Delay Integration', () => {
        it('renders Report Delay button in DispatchOrdersScreen and invokes onReportDelay', async () => {
            const onReportDelay = jest.fn();

            const view = await render(
                <DispatchOrdersScreen
                    jobs={[mockWorkingJob]}
                    onReportDelay={onReportDelay}
                />,
            );

            const reportBtn = view.getByTestId('report-delay-btn-102');
            expect(reportBtn).toBeTruthy();

            await fireEvent.press(reportBtn);
            expect(onReportDelay).toHaveBeenCalledWith(mockWorkingJob);
        });

        it('forwards onReportDelay through DispatchIntakeSheet', async () => {
            const onReportDelay = jest.fn();

            const view = await render(
                <DispatchIntakeSheet
                    jobs={[mockWorkingJob]}
                    onClose={jest.fn()}
                    onReportDelay={onReportDelay}
                    visible={true}
                />,
            );

            const reportBtn = view.getByTestId('report-delay-btn-102');
            expect(reportBtn).toBeTruthy();

            await fireEvent.press(reportBtn);
            expect(onReportDelay).toHaveBeenCalledWith(mockWorkingJob);
        });
    });
});
