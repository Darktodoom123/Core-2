import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Linking, StyleSheet } from 'react-native';
import { JobListItemCard } from '../components/cards/JobListItemCard';
import { ThemeProvider } from '../theme';
import type { ThemeColors, ThemeMode } from '../theme';
import { darkHudThemeColors, lightThemeColors } from '../theme/tokens';
import type { DispatchJob, DispatchStatus } from '../types/index';

const MODES = [
    ['light', lightThemeColors],
    ['dark_hud', darkHudThemeColors],
] as const;

const jobWith = (
    status: DispatchStatus,
    overrides: Partial<DispatchJob> = {},
): DispatchJob => ({
    id: 7,
    reference: 'JOB-2026-0007',
    title: 'Girder Lift',
    client: 'DMCI Power & Infra',
    site: 'C-5 Flyover, Taguig',
    site_latitude: 14.5176,
    site_longitude: 121.0509,
    scheduled_start: '2026-09-07T08:00:00Z',
    priority: { value: 'routine', label: 'Routine' },
    capabilities: {
        can_respond: true,
        can_update_status: true,
        can_share_location: true,
    },
    status: { value: status, label: status },
    version: 3,
    my_assignment: {
        id: 9,
        response_status: 'accepted',
        response_status_label: 'Accepted',
    },
    asset_assignments: [],
    ...overrides,
});

const renderCard = (mode: ThemeMode, job: DispatchJob) =>
    render(
        <ThemeProvider initialMode={mode}>
            <JobListItemCard
                job={job}
                onReportDelay={jest.fn()}
                onTransitionStatus={jest.fn()}
            />
        </ThemeProvider>,
    );

describe.each(MODES)('Job card directions (%s)', (mode, theme: ThemeColors) => {
    afterEach(() => jest.restoreAllMocks());

    it.each(['accepted', 'en_route'] as const)(
        'offers Directions as a neutral secondary action while %s',
        async (status) => {
            const view = await renderCard(mode, jobWith(status));
            const style = view.getByTestId('job-directions-btn-7').props.style;
            const flat = StyleSheet.flatten(
                typeof style === 'function' ? style({ pressed: false }) : style,
            );

            expect(flat.backgroundColor).toBe(theme.surface);
            expect(flat.backgroundColor).not.toBe(theme.brandAmber);
            expect(flat.minHeight).toBeGreaterThanOrEqual(48);
        },
    );

    it('opens the maps app at the site pin', async () => {
        const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
        const view = await renderCard(mode, jobWith('en_route'));

        await fireEvent.press(view.getByTestId('job-directions-btn-7'));

        expect(open).toHaveBeenCalledWith(
            'https://www.google.com/maps/dir/?api=1&destination=14.5176%2C121.0509',
        );
    });

    it('says so plainly when maps cannot be opened', async () => {
        jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no app'));
        const view = await renderCard(mode, jobWith('en_route'));

        await fireEvent.press(view.getByTestId('job-directions-btn-7'));

        await waitFor(() =>
            expect(view.getByText(/Couldn't open maps/)).toBeTruthy(),
        );
    });

    it('hides Directions once on site', async () => {
        const view = await renderCard(mode, jobWith('arrived'));

        expect(view.queryByTestId('job-directions-btn-7')).toBeNull();
    });

    it('hides Directions when the job has no place to go', async () => {
        const view = await renderCard(
            mode,
            jobWith('en_route', {
                site: '',
                site_latitude: null,
                site_longitude: null,
            }),
        );

        expect(view.queryByTestId('job-directions-btn-7')).toBeNull();
    });
});
