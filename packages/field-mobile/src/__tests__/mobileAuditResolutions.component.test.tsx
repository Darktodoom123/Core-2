import {
    act,
    cleanup,
    fireEvent,
    render,
    waitFor,
} from '@testing-library/react-native/pure';
import React from 'react';
import { JobListItemCard } from '../components/cards/JobListItemCard';
import { FieldSafetySheet } from '../components/sheets/field-safety-sheet';
import { AssignedJobsListScreen } from '../screens/AssignedJobsListScreen';
import { DvirScreen } from '../screens/DvirScreen';
import { ApiClientError } from '../services/apiClient';
import type { DispatchJob } from '../types/index';

jest.setTimeout(25000);

const createMockJob = (
    id: number,
    reference: string,
    statusValue:
        | 'dispatched'
        | 'accepted'
        | 'en_route'
        | 'arrived'
        | 'working'
        | 'completed',
    statusLabel: string,
): DispatchJob => ({
    id,
    reference,
    client: 'Megawide Construction Corp',
    title: 'Metro Manila Subway Station 4 Lifting',
    site: 'Station 4 East Valenzuela Site',
    scheduled_start: '2026-09-26T08:00:00Z',
    priority: { value: 'priority', label: 'Priority' },
    status: { value: statusValue, label: statusLabel },
    version: 3,
    my_assignment: {
        id: 501,
        response_status: 'accepted',
        response_status_label: 'Accepted',
    },
    capabilities: {
        can_respond: true,
        can_update_status: true,
        can_share_location: true,
    },
});

/** DVIR readings start empty; tests that complete one enter a real reading. */
const enterEngineHours = async (view: { getByTestId: (id: string) => any }) => {
    await fireEvent.changeText(view.getByTestId('input-engine-hours'), '1855');
};

describe('Mobile Application Audit Resolutions Component Tests', () => {
    afterEach(async () => {
        await cleanup();
    });

    describe('Issue 1 & 3: JobListItemCard Status Progression & Duplicate Action Prevention', () => {
        it('renders Start Transit button for dispatched job and calls onTransitionStatus', async () => {
            const onTransition = jest.fn();
            const job = createMockJob(
                101,
                'DISP-101',
                'dispatched',
                'Dispatched',
            );

            const view = await render(
                <JobListItemCard job={job} onTransitionStatus={onTransition} />,
            );

            const transitBtn = view.getByTestId('action-en-route-btn-101');
            expect(transitBtn).toBeTruthy();
            expect(view.getByText('Start Transit')).toBeTruthy();

            await fireEvent.press(transitBtn);
            expect(onTransition).toHaveBeenCalledWith(101, 'en_route', 3);
        });

        it('renders Arrived On Site button for en_route job and calls onTransitionStatus', async () => {
            const onTransition = jest.fn();
            const job = createMockJob(102, 'DISP-102', 'en_route', 'En Route');

            const view = await render(
                <JobListItemCard job={job} onTransitionStatus={onTransition} />,
            );

            const arriveBtn = view.getByTestId('action-arrive-btn-102');
            expect(arriveBtn).toBeTruthy();
            expect(view.getByText('Arrived On Site')).toBeTruthy();

            await fireEvent.press(arriveBtn);
            expect(onTransition).toHaveBeenCalledWith(102, 'arrived', 3);
        });

        it('requires 500ms hold to confirm transit transitions and prevents accidental glove taps', async () => {
            jest.useFakeTimers();
            const onTransition = jest.fn();
            const job = createMockJob(
                101,
                'DISP-101',
                'dispatched',
                'Dispatched',
            );

            const view = await render(
                <JobListItemCard job={job} onTransitionStatus={onTransition} />,
            );

            const transitBtn = view.getByTestId('action-en-route-btn-101');
            expect(view.getByTestId('transit-hold-progress-101')).toBeTruthy();

            // Scenario 1: Accidental quick glove tap (<500ms)
            await act(async () => {
                fireEvent(transitBtn, 'pressIn');
                jest.advanceTimersByTime(200);
                fireEvent(transitBtn, 'pressOut');
                fireEvent(transitBtn, 'press');
            });
            expect(onTransition).not.toHaveBeenCalled();

            // Scenario 2: Intentional 500ms hold
            await act(async () => {
                fireEvent(transitBtn, 'pressIn');
                jest.advanceTimersByTime(500);
                fireEvent(transitBtn, 'pressOut');
                fireEvent(transitBtn, 'press');
            });
            expect(onTransition).toHaveBeenCalledWith(101, 'en_route', 3);

            view.unmount();
            act(() => {
                jest.clearAllTimers();
            });
            jest.useRealTimers();
        });

        it('renders Begin Work button for arrived job and calls onTransitionStatus', async () => {
            const onTransition = jest.fn();
            const job = createMockJob(
                103,
                'DISP-103',
                'arrived',
                'Arrived On Site',
            );

            const view = await render(
                <JobListItemCard job={job} onTransitionStatus={onTransition} />,
            );

            const workBtn = view.getByTestId('action-start-work-btn-103');
            expect(workBtn).toBeTruthy();
            expect(view.getByText('Begin Work')).toBeTruthy();

            await fireEvent.press(workBtn);
            expect(onTransition).toHaveBeenCalledWith(103, 'working', 3);
        });

        it('renders Complete Job button for working job and opens digital signature modal', async () => {
            const onTransition = jest.fn();
            const job = createMockJob(
                104,
                'DISP-104',
                'working',
                'In Progress',
            );

            const view = await render(
                <JobListItemCard job={job} onTransitionStatus={onTransition} />,
            );

            const completeBtn = view.getByTestId('action-complete-btn-104');
            expect(completeBtn).toBeTruthy();
            expect(view.getByText('Complete Job')).toBeTruthy();

            // Press Complete Job opens signature signoff modal
            await fireEvent.press(completeBtn);
            expect(view.getByTestId('digital-signature-modal')).toBeTruthy();
            expect(
                view.getByText('Client Sign-Off & Job Completion'),
            ).toBeTruthy();

            // Fill signer name and adopt signature mark
            const nameInput = view.getByTestId(
                'digital-signature-modal-name-input',
            );
            await fireEvent.changeText(nameInput, 'Engr. Roberto Santos');
            await fireEvent.press(
                view.getByTestId('digital-signature-modal-adopt-mark'),
            );

            await fireEvent.press(
                view.getByTestId('digital-signature-modal-submit'),
            );

            expect(onTransition).toHaveBeenCalledWith(
                104,
                'completed',
                3,
                expect.objectContaining({
                    signerName: 'Engr. Roberto Santos',
                }),
            );
        });

        it('hides assignment actions when hideAssignmentActions is true', async () => {
            const pendingJob: DispatchJob = {
                ...createMockJob(105, 'DISP-105', 'dispatched', 'Dispatched'),
                my_assignment: {
                    id: 505,
                    response_status: 'pending',
                    response_status_label: 'Pending Response',
                },
                capabilities: {
                    can_respond: false,
                    can_update_status: false,
                    can_share_location: false,
                },
            };

            const view = await render(
                <JobListItemCard
                    hideAssignmentActions={true}
                    job={pendingJob}
                    onAcceptAssignment={jest.fn()}
                    onRejectAssignment={jest.fn()}
                />,
            );

            expect(view.queryByTestId('accept-assignment-btn-105')).toBeNull();
            expect(view.queryByTestId('decline-assignment-btn-105')).toBeNull();
        });
    });

    const baseScreenProps = {
        isLoading: false,
        outboxCommands: [],
        onRefresh: jest.fn(),
        onSosHoldComplete: jest.fn(),
    };

    describe('Issue 4, 5, 7, 9: AssignedJobsListScreen UX Flow Improvements', () => {
        it('renders one no-unit card with the relief handover inside it when jobs list is empty', async () => {
            const view = await render(
                <AssignedJobsListScreen
                    {...baseScreenProps}
                    isUnitLinked={false}
                    jobs={[]}
                    userName="Alex Rivera"
                    userRole="operator"
                />,
            );

            // One neutral card replaces the "UNASSIGNED" vehicle card and the
            // separate standby banner; it claims no inspection result.
            expect(view.getByTestId('no-unit-card')).toBeTruthy();
            expect(view.getByText('No unit assigned')).toBeTruthy();
            expect(view.queryByTestId('hero-vehicle-card')).toBeNull();
            expect(view.queryByTestId('standby-no-dispatch-banner')).toBeNull();
            expect(view.queryByText('DVIR Cleared')).toBeNull();

            // Unassigned start unit button should NOT display
            expect(view.queryByTestId('start-unit-on-site-btn')).toBeNull();

            // Claim Equipment Handover button should display
            const claimBtn = view.getByTestId('incoming-handover-claim-btn');
            expect(claimBtn).toBeTruthy();
            expect(
                view.getByText('Relief handover — claim a unit'),
            ).toBeTruthy();

            // Pressing claim handover opens ReliefHandoverModal in incoming_claim mode
            await fireEvent.press(claimBtn);
            expect(view.getByTestId('relief-handover-modal')).toBeTruthy();
            expect(view.getByText('Claim a unit')).toBeTruthy();
        });

        it('links the unit only after the server accepts the relief claim', async () => {
            const mockClaim = jest
                .fn()
                .mockRejectedValueOnce(
                    new ApiClientError(
                        'That PIN is not right for this unit.',
                        422,
                    ),
                )
                .mockResolvedValueOnce({
                    dispatch_job_id: 42,
                    asset_code: 'CRN-7',
                    status: 'transferred',
                    previous_operator_id: 3,
                    active_operator_id: 9,
                    active_operator_name: 'Alex Rivera',
                });
            const mockRefresh = jest.fn();
            const mockLinkUnit = jest.fn();
            const mockApiClient: any = {
                claimEquipmentHandoverByUnit: mockClaim,
                fetchShiftStatus: jest.fn().mockResolvedValue({}),
                fetchWeatherTelemetry: jest.fn().mockResolvedValue(null),
            };

            const view = await render(
                <AssignedJobsListScreen
                    {...baseScreenProps}
                    apiClient={mockApiClient}
                    isOnline
                    isUnitLinked={false}
                    jobs={[]}
                    onLinkUnit={mockLinkUnit}
                    onRefresh={mockRefresh}
                    userName="Alex Rivera"
                    userRole="operator"
                />,
            );

            await fireEvent.press(
                view.getByTestId('incoming-handover-claim-btn'),
            );
            expect(view.queryByTestId('claim-1tap-btn')).toBeNull();

            await fireEvent.changeText(
                view.getByTestId('handover-unit-input'),
                'crn-7',
            );
            await fireEvent.changeText(
                view.getByTestId('handover-pin-input'),
                '1111',
            );
            await fireEvent.press(view.getByTestId('claim-pin-btn'));

            // Rejected: nothing is linked and the sheet stays open.
            expect(
                await view.findByText('That PIN is not right for this unit.'),
            ).toBeTruthy();
            expect(mockLinkUnit).not.toHaveBeenCalled();
            expect(view.getByText('No unit assigned')).toBeTruthy();

            await fireEvent.changeText(
                view.getByTestId('handover-pin-input'),
                '5307',
            );
            await fireEvent.press(view.getByTestId('claim-pin-btn'));

            await waitFor(() =>
                expect(mockLinkUnit).toHaveBeenCalledWith('CRN-7'),
            );
            expect(mockClaim).toHaveBeenLastCalledWith('CRN-7', '5307');
            expect(mockRefresh).toHaveBeenCalled();
        });

        it('surfaces visible assignment summary card on the home dashboard and allows viewing orders', async () => {
            const onSelectJob = jest.fn();
            const jobs = [
                createMockJob(201, 'DISP-201', 'dispatched', 'Dispatched'),
            ];

            const view = await render(
                <AssignedJobsListScreen
                    {...baseScreenProps}
                    isUnitLinked={true}
                    jobs={jobs}
                    onSelectJob={onSelectJob}
                    userName="Alex Rivera"
                    userRole="operator"
                />,
            );

            const card = view.getByTestId('home-assignment-summary-card');
            expect(card).toBeTruthy();
            expect(view.getByText('Your assignments')).toBeTruthy();
            expect(view.getAllByText('DISP-201').length).toBeGreaterThanOrEqual(
                1,
            );
            expect(
                view.getAllByText('Metro Manila Subway Station 4 Lifting')
                    .length,
            ).toBeGreaterThanOrEqual(1);

            // Tapping View Orders opens dispatch intake orders view
            const viewOrdersBtn = view.getByTestId('home-view-orders-btn');
            await fireEvent.press(viewOrdersBtn);
            expect(
                view.getByTestId('dispatch-orders-screen-view'),
            ).toBeTruthy();

            // Close intake sheet
            await fireEvent.press(
                view.getByTestId('close-dispatch-intake-btn'),
            );

            // Tapping the active job pill selects job and opens intake
            const activeJobPill = view.getByTestId('home-active-job-pill');
            await fireEvent.press(activeJobPill);
            expect(onSelectJob).toHaveBeenCalledWith(201);
            expect(
                view.getByTestId('dispatch-orders-screen-view'),
            ).toBeTruthy();
        });

        it('renders Post-Trip DVIR button on active dashboard before release unit and passes post_trip mode', async () => {
            const onOpenDvir = jest.fn();
            const jobs = [
                createMockJob(202, 'DISP-202', 'working', 'In Progress'),
            ];

            const view = await render(
                <AssignedJobsListScreen
                    {...baseScreenProps}
                    dvirStatus="cleared"
                    isUnitLinked={true}
                    jobs={jobs}
                    onOpenDvir={onOpenDvir}
                    userName="Alex Rivera"
                    userRole="operator"
                />,
            );

            const postTripBtn = view.getByTestId(
                'quick-action-post-trip-dvir-btn',
            );
            expect(postTripBtn).toBeTruthy();
            expect(view.getByText('Post-Trip DVIR')).toBeTruthy();

            await fireEvent.press(postTripBtn);
            expect(onOpenDvir).toHaveBeenCalledWith('post_trip');
        });
    });

    describe('Issue 2: NotificationsSheet Assignment Response Dispatches', () => {
        it('enqueues assignment accept and decline actions from notifications sheet', async () => {
            const onAccept = jest.fn();
            const onReject = jest.fn();
            const pendingJob: DispatchJob = {
                ...createMockJob(301, 'DISP-301', 'dispatched', 'Dispatched'),
                my_assignment: {
                    id: 999,
                    response_status: 'pending',
                    response_status_label: 'Pending Response',
                },
            };

            const view = await render(
                <AssignedJobsListScreen
                    {...baseScreenProps}
                    isUnitLinked={true}
                    jobs={[pendingJob]}
                    onAcceptAssignment={onAccept}
                    onRejectAssignment={onReject}
                    userName="Alex Rivera"
                    userRole="operator"
                />,
            );

            // Open notification sheet
            const notifTrigger = view.getByTestId('notification-button');
            await fireEvent.press(notifTrigger);

            expect(view.getByTestId('notifications-sheet')).toBeTruthy();

            // Press Accept Assignment in notification sheet
            const acceptBtn = view.getByTestId('notification-accept-job-301');
            await fireEvent.press(acceptBtn);

            expect(onAccept).toHaveBeenCalledWith(301, 999, 3);

            // Re-open notification sheet and test Decline
            await fireEvent.press(notifTrigger);
            const declineBtn = view.getByTestId('notification-decline-job-301');
            await fireEvent.press(declineBtn);

            expect(onReject).toHaveBeenCalledWith(
                301,
                999,
                expect.stringContaining('Declined by mobile operator'),
                3,
            );
        });
    });

    describe('Issue 6: DvirScreen Digital Signature Integration', () => {
        it('renders signature section, allows capturing signature, and includes signature in DVIR record', async () => {
            const onSaveRecord = jest.fn();

            const view = await render(
                <DvirScreen
                    assetCode="ALB-CRN-050"
                    assetName="50T Tadano All-Terrain Crane"
                    inspectorName="Alex Rivera"
                    onSaveInspectionRecord={onSaveRecord}
                />,
            );

            expect(view.getByTestId('dvir-signature-section')).toBeTruthy();
            expect(
                view.getByText('DIGITAL SIGNATURE CERTIFICATION'),
            ).toBeTruthy();

            const signBtn = view.getByTestId('dvir-sign-button');
            expect(signBtn).toBeTruthy();
            expect(
                view.getByText('Capture Inspector Digital Signature'),
            ).toBeTruthy();

            // Open signature modal
            await fireEvent.press(signBtn);
            expect(
                view.getByTestId('dvir-digital-signature-modal'),
            ).toBeTruthy();

            // Enter inspector name in modal and adopt signature mark
            const nameInput = view.getByTestId(
                'dvir-digital-signature-modal-name-input',
            );
            await fireEvent.changeText(
                nameInput,
                'Alex Rivera (Certified Operator)',
            );
            await fireEvent.press(
                view.getByTestId('dvir-digital-signature-modal-adopt-mark'),
            );

            // Confirm signature
            await fireEvent.press(
                view.getByTestId('dvir-digital-signature-modal-submit'),
            );

            // Verify signature confirmation is rendered
            await waitFor(() => {
                expect(
                    view.getByTestId('dvir-signature-confirmed'),
                ).toBeTruthy();
            });
            expect(
                view.getByText(
                    /Certified by Alex Rivera \(Certified Operator\)/,
                ),
            ).toBeTruthy();

            // Complete DVIR
            await enterEngineHours(view);
            await fireEvent.press(view.getByTestId('complete-dvir-button'));

            expect(onSaveRecord).toHaveBeenCalledWith(
                expect.objectContaining({
                    assetCode: 'ALB-CRN-050',
                    signatureCaptured: true,
                    signatureData: expect.objectContaining({
                        signerName: 'Alex Rivera (Certified Operator)',
                    }),
                }),
            );
        });
    });

    describe('Issue 2: DOLE 4.5-Hour Continuous Rest Prompter', () => {
        it('renders DOLE continuous rest banner when operating unbroken for >= 270 minutes (4.5 hours)', async () => {
            const onChangeDutyStatus = jest.fn();
            const view = await render(
                <AssignedJobsListScreen
                    {...baseScreenProps}
                    jobs={[]}
                    onChangeDutyStatus={onChangeDutyStatus}
                    shiftInfo={{
                        status: 'on_shift',
                        dutyStatus: 'driving',
                        continuousOperatingMinutes: 280,
                        drivingMinutes: 280,
                        operatingMinutes: 280,
                    }}
                />,
            );

            const banner = view.getByTestId('dole-continuous-rest-banner');
            expect(banner).toBeTruthy();
            expect(
                view.getByTestId('dole-continuous-counter-pill'),
            ).toBeTruthy();
            expect(view.getByText(/4\.7h continuous/i)).toBeTruthy();
            expect(
                view.getByText(/DOLE Mandatory Rest Break Required/i),
            ).toBeTruthy();

            const breakBtn = view.getByTestId('dole-continuous-break-btn');
            expect(breakBtn).toBeTruthy();
            await fireEvent.press(breakBtn);
            expect(onChangeDutyStatus).toHaveBeenCalledWith('on_break');
        });

        it('correctly calculates continuous operating time across duty status switches (driving to operating) without breaks', async () => {
            const onChangeDutyStatus = jest.fn();
            // Operator drove for 180m, then operating for 100m, no breaks taken (breakCount: 0)
            // Even if currentDutyStartedAt is recent, unbroken duty = 280 minutes
            const view = await render(
                <AssignedJobsListScreen
                    {...baseScreenProps}
                    jobs={[]}
                    onChangeDutyStatus={onChangeDutyStatus}
                    shiftInfo={{
                        status: 'on_shift',
                        dutyStatus: 'operating',
                        breakCount: 0,
                        breakMinutes: 0,
                        drivingMinutes: 180,
                        operatingMinutes: 100,
                        limitCounterMinutes: 280,
                        currentDutyStartedAt: new Date(
                            Date.now() - 30 * 60 * 1000,
                        ).toISOString(),
                    }}
                />,
            );

            const banner = view.getByTestId('dole-continuous-rest-banner');
            expect(banner).toBeTruthy();
            expect(
                view.getByText(/DOLE Mandatory Rest Break Required/i),
            ).toBeTruthy();
            expect(view.getByText(/4\.7h continuous/i)).toBeTruthy();
        });

        it('renders DOLE warning banner when continuous operation reaches 4.0 hours (240 mins)', async () => {
            const view = await render(
                <AssignedJobsListScreen
                    {...baseScreenProps}
                    jobs={[]}
                    shiftInfo={{
                        status: 'on_shift',
                        dutyStatus: 'driving',
                        continuousOperatingMinutes: 250,
                    }}
                />,
            );

            const banner = view.getByTestId('dole-continuous-rest-banner');
            expect(banner).toBeTruthy();
            expect(
                view.getByText(/Approaching 4\.5h Continuous Operation/i),
            ).toBeTruthy();
            expect(view.getByText(/4\.2h continuous/i)).toBeTruthy();
            expect(
                view.getByText(/Prepare to transition to standby/i),
            ).toBeTruthy();
        });
    });

    describe('Issue 6: FieldSafetySheet and RA 11058 Statutory Safety Stoppage Modal', () => {
        it('renders FieldSafetySheet modal with fullScreen presentation and can trigger work stoppage', async () => {
            const onClose = jest.fn();
            const onIssueWorkStoppage = jest
                .fn()
                .mockResolvedValue('stop-cmd-99');
            const view = await render(
                <FieldSafetySheet
                    activeSite="Cavite Gateway Terminal"
                    commands={[]}
                    isOnline={true}
                    onClose={onClose}
                    onIssueWorkStoppage={onIssueWorkStoppage}
                    onReportHazard={jest.fn()}
                    visible={true}
                />,
            );

            expect(view.getByTestId('field-safety-sheet')).toBeTruthy();
            expect(view.getByText('Safety and hazards')).toBeTruthy();

            // Open stop work form
            await fireEvent.press(view.getByTestId('open-stop-work-form'));

            // Select RA 11058 imminent danger
            await fireEvent.press(
                view.getByTestId('stoppage-type-imminent-danger'),
            );
            expect(view.getByTestId('ra-11058-statutory-badge')).toBeTruthy();

            // Close sheet
            await fireEvent.press(view.getByLabelText('Back'));
            expect(view.getByText('Safety and hazards')).toBeTruthy();
            await fireEvent.press(view.getByLabelText('Back'));
            expect(onClose).toHaveBeenCalled();
        });
    });
});
