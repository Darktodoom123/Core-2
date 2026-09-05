import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { HosScreen } from '../screens/HosScreen';

describe('HosScreen Component & Workflows', () => {
    it('renders the 4 live ELD duty clocks and shift progress gauge', async () => {
        const onBack = jest.fn();
        const onUpdateDutyStatus = jest.fn();

        const view = await render(
            <HosScreen
                operatorName="Alex Rivera"
                shiftInfo={{
                    status: 'on_shift',
                    dutyStatus: 'operating',
                    startedAt: '08:00 AM',
                    hoursElapsed: 4.5,
                }}
                onBack={onBack}
                onUpdateDutyStatus={onUpdateDutyStatus}
                userRole="Certified Crane Operator"
            />,
        );

        // Header & Titles
        expect(
            view.getByText('HOURS OF SERVICE (HoS) · ELD COCKPIT'),
        ).toBeTruthy();
        expect(view.getByText('Duty Status & Shift Management')).toBeTruthy();
        expect(
            view.getByText(
                'Operator: Alex Rivera · Shift Started: 08:00 AM (4.5h Elapsed)',
            ),
        ).toBeTruthy();

        // 4 Live ELD Clocks Card
        expect(view.getByTestId('hos-eld-clocks-card')).toBeTruthy();
        expect(view.getByText('LIVE ELD DUTY CLOCKS')).toBeTruthy();
        expect(view.getByText('Drive / Operating')).toBeTruthy();
        expect(view.getByText('Shift Window')).toBeTruthy();
        expect(view.getByText('70-Hr 8-Day Cycle')).toBeTruthy();
        expect(view.getByText('Break Countdown')).toBeTruthy();

        // 24-Hour Duty Timeline Graph & Logs
        expect(view.getByTestId('hos-timeline-graph')).toBeTruthy();
        expect(view.getByTestId('hos-activity-logs')).toBeTruthy();
    });

    it('allows toggling between all 5 duty statuses and shows demurrage options for standby', async () => {
        const view = await render(<HosScreen />);

        // 5 Duty Status Options exist
        expect(view.getByTestId('duty-option-operating')).toBeTruthy();
        expect(view.getByTestId('duty-option-driving')).toBeTruthy();
        expect(view.getByTestId('duty-option-standby')).toBeTruthy();
        expect(view.getByTestId('duty-option-on_break')).toBeTruthy();
        expect(view.getByTestId('duty-option-off_duty')).toBeTruthy();

        // Switch to Standby
        await fireEvent.press(view.getByTestId('duty-option-standby'));

        // Demurrage reasons appear
        expect(view.getByTestId('standby-reason-section')).toBeTruthy();
        expect(
            view.getByText('Client Site Delay (Billable Demurrage)'),
        ).toBeTruthy();
        expect(
            view.getByTestId('standby-reason-waiting_on_concrete'),
        ).toBeTruthy();

        // Select Concrete Mixer standby reason
        await fireEvent.press(
            view.getByTestId('standby-reason-waiting_on_concrete'),
        );

        // Switch to Driving
        await fireEvent.press(view.getByTestId('duty-option-driving'));
        expect(view.queryByTestId('standby-reason-section')).toBeNull();
    });

    it('submits certified duty status updates and invokes onUpdateDutyStatus', async () => {
        const onUpdateDutyStatus = jest.fn();

        const view = await render(
            <HosScreen onUpdateDutyStatus={onUpdateDutyStatus} />,
        );

        // Enter transition remarks
        const remarksInput = view.getByTestId('hos-remarks-input');
        await fireEvent.changeText(
            remarksInput,
            'Lift complete at Taguig site; transitioning to highway transit.',
        );

        // Select Driving
        await fireEvent.press(view.getByTestId('duty-option-driving'));

        // Confirm
        const confirmBtn = view.getByTestId('confirm-hos-btn');
        await fireEvent.press(confirmBtn);

        expect(onUpdateDutyStatus).toHaveBeenCalledWith(
            'driving',
            undefined,
            'Lift complete at Taguig site; transitioning to highway transit.',
        );

        // Stamp appears
        expect(view.getByTestId('hos-confirmed-stamp')).toBeTruthy();
        expect(
            view.getByText('✓ DUTY STATUS UPDATED & CERTIFIED'),
        ).toBeTruthy();
    });

    it('calls onBack when back button is pressed', async () => {
        const onBack = jest.fn();
        const view = await render(<HosScreen onBack={onBack} />);

        const backBtn = view.getByTestId('hos-back-btn');
        await fireEvent.press(backBtn);

        expect(onBack).toHaveBeenCalled();
    });

    it('renders cleanly in daylight mode with user-friendly helper text', async () => {
        const view = await render(<HosScreen />);

        // Helper text and section headers
        expect(view.getByText('SELECT ACTIVE DUTY STATUS')).toBeTruthy();
        expect(
            view.getByText(
                'Tap to switch duty status. Complies with DOLE-OSHC and DOT ELD mandates.',
            ),
        ).toBeTruthy();
        expect(view.getByText('Duty Transition Remarks & Notes')).toBeTruthy();
        expect(
            view.getByText(
                'Visual ELD graph of 24-hour shift status progression (00:00 to 24:00).',
            ),
        ).toBeTruthy();
        expect(
            view.getByText(
                'Timestamped change-of-duty event logs with GPS location audits.',
            ),
        ).toBeTruthy();
        expect(
            view.getByText(
                'I certify that these duty status entries and hours of service are true, complete, and accurate for this shift.',
            ),
        ).toBeTruthy();

        // Toggling certification enables/disables the confirmation button
        const certCheck = view.getByTestId('hos-cert-check');
        const confirmBtn = view.getByTestId('confirm-hos-btn');

        // Initially certified (button enabled)
        expect(confirmBtn.props.accessibilityState?.disabled).toBeFalsy();

        // Uncheck certification
        await fireEvent.press(certCheck);
        expect(confirmBtn.props.accessibilityState?.disabled).toBe(true);

        // Re-check certification
        await fireEvent.press(certCheck);
        expect(confirmBtn.props.accessibilityState?.disabled).toBeFalsy();
    });

    it('navigates across 8-day timeline history and synchronizes shift activity logs', async () => {
        const view = await render(<HosScreen />);

        // Initially shows Today
        expect(view.getByText('24-HOUR DUTY TIMELINE (TODAY)')).toBeTruthy();
        expect(view.getByText("TODAY'S SHIFT ACTIVITY LOG")).toBeTruthy();
        expect(view.getByText('Active Shift in Progress')).toBeTruthy();
        expect(
            view.getByText('Sign off and certify log at end of shift'),
        ).toBeTruthy();

        // Step back to Yesterday (Sep 4)
        const prevBtn = view.getByTestId('hos-prev-day-btn');
        await fireEvent.press(prevBtn);

        expect(
            view.getByText('24-HOUR DUTY TIMELINE — THU, SEP 4 (YESTERDAY)'),
        ).toBeTruthy();
        expect(
            view.getByText('SHIFT ACTIVITY LOG — THU, SEP 4 (YESTERDAY)'),
        ).toBeTruthy();
        expect(view.getByText('6 EVENTS')).toBeTruthy();
        expect(
            view.getByText('✓ Certified by Alex Rivera · Sep 4, 17:18 PHT'),
        ).toBeTruthy();
        expect(
            view.getByText(
                'Lowbed equipment transit via SLEX to Calamba construction hub',
            ),
        ).toBeTruthy();

        // Step forward back to Today
        const nextBtn = view.getByTestId('hos-next-day-btn');
        await fireEvent.press(nextBtn);

        expect(view.getByText('24-HOUR DUTY TIMELINE (TODAY)')).toBeTruthy();
        expect(view.getByText("TODAY'S SHIFT ACTIVITY LOG")).toBeTruthy();
    });

    it('jumps directly to historical rest days via quick-jump day pills', async () => {
        const view = await render(<HosScreen />);

        // Tap Day Pill 4 (Mon, Sep 1 - 34h restart)
        const dayPill4 = view.getByTestId('hos-day-pill-4');
        await fireEvent.press(dayPill4);

        expect(
            view.getByText('24-HOUR DUTY TIMELINE — MON, SEP 1'),
        ).toBeTruthy();
        expect(
            view.getByText('✓ 34-Hour Restart Period · Off Duty Logged'),
        ).toBeTruthy();
        expect(view.getByText('SHIFT ACTIVITY LOG — MON, SEP 1')).toBeTruthy();
        expect(
            view.getByText(
                'Mandatory 34-Hour HoS Cycle Restart — 24 consecutive hours off-duty',
            ),
        ).toBeTruthy();
        expect(view.getAllByText('24h 00m').length).toBeGreaterThanOrEqual(1);
    });

    it('renders empty log rest placeholder when historical day has no transition events', async () => {
        const customHistory = [
            {
                id: 'day-empty',
                dayLabel: 'Sun, Aug 24',
                dateFormatted: 'Sunday, Aug 24, 2026',
                shortDate: 'Aug 24',
                isToday: false,
                driveHoursFormatted: '0h 00m',
                onDutyHoursFormatted: '0h 00m',
                offDutyHoursFormatted: '24h 00m',
                totalShiftFormatted: '0h 00m',
                certificationStatus: 'restart' as const,
                certifiedByText: '✓ 34-Hour Restart Period · Off Duty Logged',
                segments: {
                    off: [{ left: '0%' as any, width: '100%' as any }],
                    brk: [],
                    drv: [],
                    on: [],
                },
                events: [],
            },
        ];

        const view = await render(
            <HosScreen timelineHistory={customHistory} />,
        );

        expect(
            view.getByText('34-Hour Restart / Full Off-Duty Rest Period'),
        ).toBeTruthy();
        expect(
            view.getByText(
                'No duty status transitions recorded. Consecutive 24-hour off-duty rest period logged.',
            ),
        ).toBeTruthy();
    });
});
