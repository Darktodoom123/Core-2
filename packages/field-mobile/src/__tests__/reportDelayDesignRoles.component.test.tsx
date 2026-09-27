import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import { ReportDelayModal } from '../components/sheets/ReportDelayModal';
import { ThemeProvider } from '../theme';
import type { ThemeColors, ThemeMode } from '../theme';
import { darkHudThemeColors, lightThemeColors } from '../theme/tokens';
import type { DispatchJob } from '../types/index';

const MODES = [
    ['light', lightThemeColors],
    ['dark_hud', darkHudThemeColors],
] as const;

const job: DispatchJob = {
    id: 21,
    reference: 'JOB-2026-0021',
    title: 'Tower Crane Erection',
    client: 'Megawide',
    site: 'BGC, Taguig',
    scheduled_start: '2026-09-07T08:00:00Z',
    priority: { value: 'routine', label: 'Routine' },
    capabilities: {
        can_respond: true,
        can_update_status: true,
        can_share_location: true,
    },
    status: { value: 'working', label: 'Working' },
    version: 2,
    asset_assignments: [
        {
            id: 1,
            operational_asset_id: 501,
            asset_code: 'CRN-501',
            asset_name: 'Tower Crane',
            asset_kind: 'tower_crane',
        },
        {
            id: 2,
            operational_asset_id: 502,
            asset_code: 'TRK-502',
            asset_name: 'Boom Truck',
            asset_kind: 'boom_truck',
        },
    ],
};

type View = Awaited<ReturnType<typeof render>>;

const flat = (view: View, testID: string) => {
    const style = view.getByTestId(testID).props.style;

    return StyleSheet.flatten(
        typeof style === 'function' ? style({ pressed: false }) : style,
    );
};

const textColor = (view: View, text: string) =>
    StyleSheet.flatten(view.getByText(text).props.style).color;

const renderSheet = (mode: ThemeMode) =>
    render(
        <ThemeProvider initialMode={mode}>
            <ReportDelayModal
                job={job}
                onClose={jest.fn()}
                onNavigateDvir={jest.fn()}
                onSubmit={jest.fn()}
                visible
            />
        </ThemeProvider>,
    );

const expectSelected = (view: View, testID: string, theme: ThemeColors) => {
    const style = flat(view, testID);

    expect(style.backgroundColor).toBe(theme.brandAmberLight);
    expect(style.borderColor).toBe(theme.brandAmber);
};

describe.each(MODES)(
    'Report delay sheet design roles (%s)',
    (mode, theme: ThemeColors) => {
        it('draws the sheet on the theme surface', async () => {
            const view = await renderSheet(mode);

            expect(flat(view, 'report-delay-sheet').backgroundColor).toBe(
                theme.surface,
            );
            expect(textColor(view, 'Report Operational Delay')).toBe(
                theme.textPrimary,
            );
        });

        it('marks every chosen option with Signal Gold Soft, never cobalt', async () => {
            const view = await renderSheet(mode);

            expectSelected(view, 'context-on_site-btn', theme);
            expect(textColor(view, 'On-Site Execution')).toBe(
                theme.textPrimary,
            );
            expectSelected(view, 'asset-chip-whole-job', theme);
            expectSelected(view, 'minute-chip-30', theme);

            await fireEvent.press(
                view.getByTestId('delay-reason-site_not_ready'),
            );

            expectSelected(view, 'delay-reason-site_not_ready', theme);
            expect(textColor(view, 'Site Not Prepared')).toBe(
                theme.textPrimary,
            );
            expect(flat(view, 'context-transit-btn').backgroundColor).not.toBe(
                theme.actionCobalt,
            );
        });

        it('warns that a delay is not a defect report in orange, with a neutral DVIR link', async () => {
            const view = await renderSheet(mode);

            await fireEvent.press(
                view.getByTestId('delay-reason-equipment_issue'),
            );

            const notice = flat(view, 'dvir-cross-reference-notice');

            expect(notice.backgroundColor).toBe(theme.warningOrangeLight);
            expect(notice.borderColor).toBe(theme.warningOrange);
            expect(textColor(view, 'Equipment Defect Notice')).toBe(
                theme.warningOrangeText,
            );

            const link = flat(view, 'go-to-dvir-btn');

            expect(link.backgroundColor).toBe(theme.surface);
            expect(link.borderColor).toBe(theme.borderStrong);
            expect(textColor(view, 'Go to DVIR Pre/Post-Trip Inspection')).toBe(
                theme.textPrimary,
            );
        });

        it('submits with a Signal Gold action whose ink stays dark', async () => {
            const view = await renderSheet(mode);
            const submit = flat(view, 'submit-delay-btn');

            expect(submit.backgroundColor).toBe(theme.brandAmber);
            expect(submit.minHeight).toBeGreaterThanOrEqual(52);
            expect(textColor(view, 'Report to Dispatch')).toBe(
                theme.surfaceDark,
            );
            expect(textColor(view, 'Cancel')).toBe(theme.textPrimary);
        });

        it('shows a missing reason as a red error', async () => {
            const view = await renderSheet(mode);

            await fireEvent.press(view.getByTestId('submit-delay-btn'));

            expect(flat(view, 'delay-error').backgroundColor).toBe(
                theme.hazardRedLight,
            );
            expect(textColor(view, 'Please select a delay reason.')).toBe(
                theme.hazardRedText,
            );
        });
    },
);
