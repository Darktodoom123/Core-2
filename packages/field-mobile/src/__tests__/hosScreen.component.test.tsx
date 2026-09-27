import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { HosScreen } from '../screens/HosScreen';
import type { ShiftInfo } from '../types/index';
import { TIMELINE_HISTORY_DAYS } from './hos-test-fixtures';

const onShift: ShiftInfo = {
    status: 'on_shift',
    dutyStatus: 'operating',
    startedAt: '08:00 AM',
    hoursElapsed: 4.5,
    shiftElapsedMinutes: 270,
    operatingMinutes: 120,
    drivingMinutes: 60,
    standbyMinutes: 30,
    breakMinutes: 60,
    limitCounterMinutes: 180,
};

const offShift: ShiftInfo = {
    status: 'off_shift',
    dutyStatus: 'off_duty',
    startedAt: null,
    hoursElapsed: null,
};

describe('HosScreen', () => {
    it('shows the server status in the header and the DOLE clock during a shift', async () => {
        const view = await render(
            <HosScreen operatorName="BJ Bello" shiftInfo={onShift} />,
        );

        expect(view.getByText('Duty status')).toBeTruthy();
        expect(
            view.getByText('BJ Bello · On shift since 08:00 AM'),
        ).toBeTruthy();
        // Header pill and the selector badge both read OPR.
        expect(view.getAllByText('OPR')).toHaveLength(2);
        expect(view.getByTestId('hos-limit-counter-value')).toHaveTextContent(
            '3h 00m',
        );
        expect(view.getByTestId('duty-current-operating')).toBeTruthy();

        for (const usRule of [/ELD/, /70-Hr/, /DOT/, /Shift Window/]) {
            expect(view.queryByText(usRule)).toBeNull();
        }
    });

    it('is honest when no shift is running: one empty state, no wall of Unavailable', async () => {
        const view = await render(
            <HosScreen operatorName="BJ Bello" shiftInfo={offShift} />,
        );

        expect(view.getByText('BJ Bello · No shift running')).toBeTruthy();
        expect(view.getByTestId('hos-clocks-empty')).toBeTruthy();
        expect(view.queryByText(/Unavailable/)).toBeNull();
        expect(view.getByTestId('duty-current-off_duty')).toBeTruthy();
    });

    it('invents no operator, shift or history when props are missing', async () => {
        const view = await render(<HosScreen />);

        expect(view.queryByText(/Alex Rivera/)).toBeNull();
        // In the header and in the shift clock.
        expect(view.getAllByText('No shift running')).toHaveLength(2);
        expect(view.getByTestId('duty-current-off_duty')).toBeTruthy();
    });

    it('never starts with the legal certification ticked', async () => {
        const onUpdateDutyStatus = jest.fn();
        const view = await render(
            <HosScreen
                onUpdateDutyStatus={onUpdateDutyStatus}
                shiftInfo={onShift}
            />,
        );

        await fireEvent.press(view.getByTestId('duty-option-driving'));

        const certCheck = view.getByTestId('hos-cert-check');
        expect(certCheck.props.accessibilityState).toMatchObject({
            checked: false,
        });
        expect(
            view.getByTestId('confirm-hos-btn').props.accessibilityState,
        ).toMatchObject({ disabled: true });

        await fireEvent.press(certCheck);
        expect(
            view.getByTestId('confirm-hos-btn').props.accessibilityState,
        ).toMatchObject({ disabled: false });
    });

    it('sends the change, then waits for the server instead of claiming it was accepted', async () => {
        const onUpdateDutyStatus = jest.fn();
        const view = await render(
            <HosScreen
                onUpdateDutyStatus={onUpdateDutyStatus}
                shiftInfo={onShift}
            />,
        );

        await fireEvent.changeText(
            view.getByTestId('hos-remarks-input'),
            'Lift complete; heading back to the yard.',
        );
        await fireEvent.press(view.getByTestId('duty-option-driving'));
        await fireEvent.press(view.getByTestId('hos-cert-check'));
        expect(
            view.getByText('Change to On Duty — Driving / Transit'),
        ).toBeTruthy();
        await fireEvent.press(view.getByTestId('confirm-hos-btn'));

        expect(onUpdateDutyStatus).toHaveBeenCalledWith(
            'driving',
            undefined,
            'Lift complete; heading back to the yard.',
        );
        expect(view.getByTestId('hos-confirmed-stamp')).toHaveTextContent(
            /Waiting for the server/,
        );
        expect(view.queryByText(/Accepted by the server/)).toBeNull();
    });

    it('offers one way to end a shift: Off Duty, then End shift & go off duty', async () => {
        const onUpdateDutyStatus = jest.fn();
        const view = await render(
            <HosScreen
                onUpdateDutyStatus={onUpdateDutyStatus}
                shiftInfo={onShift}
            />,
        );

        expect(view.queryByTestId('hos-end-shift-card')).toBeNull();

        await fireEvent.press(view.getByTestId('duty-option-off_duty'));
        await fireEvent.press(view.getByTestId('hos-cert-check'));
        expect(view.getByText('End shift & go off duty')).toBeTruthy();

        await fireEvent.press(view.getByTestId('confirm-hos-btn'));
        expect(onUpdateDutyStatus).toHaveBeenCalledWith(
            'off_duty',
            undefined,
            undefined,
        );
    });

    it('does not offer to change to the status you are already in', async () => {
        const view = await render(<HosScreen shiftInfo={onShift} />);

        await fireEvent.press(view.getByTestId('hos-cert-check'));

        expect(view.getByText('This is your current status')).toBeTruthy();
        expect(
            view.getByTestId('confirm-hos-btn').props.accessibilityState,
        ).toMatchObject({ disabled: true });
    });

    it('shows standby reasons only for Standby, using the server codes', async () => {
        const view = await render(<HosScreen shiftInfo={onShift} />);

        await fireEvent.press(view.getByTestId('duty-option-standby'));
        expect(view.getByTestId('standby-reason-section')).toBeTruthy();
        expect(
            view.getByTestId('standby-reason-waiting_on_client'),
        ).toBeTruthy();

        await fireEvent.press(view.getByTestId('duty-option-driving'));
        expect(view.queryByTestId('standby-reason-section')).toBeNull();
    });

    it('blocks Operating and Driving at the DOLE 10h limit, leaving Standby, Break and Off Duty', async () => {
        const view = await render(
            <HosScreen
                shiftInfo={{
                    ...onShift,
                    dutyStatus: 'standby',
                    limitCounterMinutes: 600,
                }}
            />,
        );

        for (const blocked of ['operating', 'driving']) {
            const option = view.getByTestId(`duty-option-${blocked}`);
            expect(option.props.accessibilityState).toMatchObject({
                disabled: true,
            });
            expect(option).toHaveTextContent(/10h limit reached/);
        }

        for (const allowed of ['on_break', 'off_duty']) {
            expect(
                view.getByTestId(`duty-option-${allowed}`).props
                    .accessibilityState,
            ).toMatchObject({ disabled: false });
        }
    });

    it('calls onBack when back button is pressed', async () => {
        const onBack = jest.fn();
        const view = await render(<HosScreen onBack={onBack} />);

        await fireEvent.press(view.getByTestId('hos-back-btn'));

        expect(onBack).toHaveBeenCalled();
    });

    it('navigates the day history it is given', async () => {
        const view = await render(
            <HosScreen
                shiftInfo={onShift}
                timelineHistory={TIMELINE_HISTORY_DAYS}
            />,
        );

        expect(view.getByText('24-HOUR DUTY TIMELINE (TODAY)')).toBeTruthy();

        await fireEvent.press(view.getByTestId('hos-prev-day-btn'));
        expect(
            view.getByText('24-HOUR DUTY TIMELINE — THU, SEP 4 (YESTERDAY)'),
        ).toBeTruthy();

        await fireEvent.press(view.getByTestId('hos-next-day-btn'));
        expect(view.getByText('24-HOUR DUTY TIMELINE (TODAY)')).toBeTruthy();
    });

    it('renders a neutral empty state when a day has no accepted duty events', async () => {
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
                certifiedByText: 'Off duty all day',
                segments: {
                    off: [{ left: '0%' as never, width: '100%' as never }],
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

        expect(view.getByText('No server-accepted duty events')).toBeTruthy();
        expect(view.getByText('Rest day')).toBeTruthy();
    });
});
