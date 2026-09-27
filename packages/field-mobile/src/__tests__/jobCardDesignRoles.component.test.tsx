import { render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import { JobListItemCard } from '../components/cards/JobListItemCard';
import { ThemeProvider } from '../theme';
import type { ThemeColors, ThemeMode } from '../theme';
import { darkHudThemeColors, lightThemeColors } from '../theme/tokens';
import type { DispatchJob, OutboxCommand } from '../types/index';

const MODES = [
    ['light', lightThemeColors],
    ['dark_hud', darkHudThemeColors],
] as const;

const baseJob: DispatchJob = {
    id: 7,
    reference: 'JOB-2026-0007',
    title: 'Girder Lift',
    client: 'DMCI Power & Infra',
    site: 'C-5 Flyover, Taguig',
    scheduled_start: '2026-09-07T08:00:00Z',
    priority: { value: 'emergency', label: 'Emergency' },
    capabilities: {
        can_respond: true,
        can_update_status: true,
        can_share_location: true,
    },
    status: { value: 'accepted', label: 'Accepted' },
    version: 3,
    my_assignment: {
        id: 9,
        response_status: 'accepted',
        response_status_label: 'Accepted',
        assigned_at: '2026-09-07T07:30:00Z',
    },
    asset_assignments: [],
};

type View = Awaited<ReturnType<typeof render>>;

const flat = (view: View, testID: string) => {
    const style = view.getByTestId(testID).props.style;

    return StyleSheet.flatten(
        typeof style === 'function' ? style({ pressed: false }) : style,
    );
};

const textColor = (view: View, text: string | RegExp) =>
    StyleSheet.flatten(view.getByText(text).props.style).color;

const renderCard = (
    mode: ThemeMode,
    props: Partial<React.ComponentProps<typeof JobListItemCard>> = {},
) =>
    render(
        <ThemeProvider initialMode={mode}>
            <JobListItemCard
                job={baseJob}
                onReportDelay={jest.fn()}
                onTransitionStatus={jest.fn()}
                {...props}
            />
        </ThemeProvider>,
    );

describe.each(MODES)(
    'Job card design roles (%s)',
    (mode, theme: ThemeColors) => {
        it('rests on a bordered surface with no shadow', async () => {
            const card = flat(await renderCard(mode), `job-card-${baseJob.id}`);

            expect(card.backgroundColor).toBe(theme.surface);
            expect(card.borderColor).toBe(theme.border);
            expect(card.elevation).toBeUndefined();
            expect(card.shadowOpacity).toBeUndefined();
        });

        it('labels an emergency priority in red with readable text', async () => {
            const view = await renderCard(mode);

            expect(
                flat(view, `job-priority-${baseJob.id}`).backgroundColor,
            ).toBe(theme.hazardRedLight);
            expect(textColor(view, 'Emergency')).toBe(theme.hazardRedText);
        });

        it('makes each lifecycle step one Signal Gold primary action with dark ink', async () => {
            const steps = [
                [
                    'accepted',
                    `action-en-route-btn-${baseJob.id}`,
                    'Start Transit',
                ],
                [
                    'en_route',
                    `action-arrive-btn-${baseJob.id}`,
                    'Arrived On Site',
                ],
                [
                    'arrived',
                    `action-start-work-btn-${baseJob.id}`,
                    'Begin Work',
                ],
                [
                    'working',
                    `action-complete-btn-${baseJob.id}`,
                    'Complete Job',
                ],
            ] as const;

            for (const [status, testID, label] of steps) {
                const view = await renderCard(mode, {
                    job: {
                        ...baseJob,
                        status: { value: status, label: status },
                    },
                });
                const button = flat(view, testID);

                expect(button.backgroundColor).toBe(theme.brandAmber);
                expect(button.minHeight).toBeGreaterThanOrEqual(52);
                expect(textColor(view, label)).toBe(theme.surfaceDark);
            }
        });

        it('keeps Report Delay a neutral secondary action, not a gold one', async () => {
            const view = await renderCard(mode);
            const button = flat(view, `report-delay-btn-${baseJob.id}`);

            expect(button.backgroundColor).toBe(theme.surface);
            expect(button.borderColor).toBe(theme.borderStrong);
            expect(button.minHeight).toBeGreaterThanOrEqual(48);
            expect(textColor(view, 'Report Delay')).toBe(theme.textPrimary);
        });

        it('shows a server-reported delay as an orange warning', async () => {
            const view = await renderCard(mode, {
                job: {
                    ...baseJob,
                    latest_delay: {
                        id: 1,
                        reason_label: 'Traffic',
                        estimated_minutes: 30,
                    } as DispatchJob['latest_delay'],
                },
            });
            const banner = flat(view, `delay-status-banner-${baseJob.id}`);

            expect(banner.backgroundColor).toBe(theme.warningOrangeLight);
            expect(banner.borderColor).toBe(theme.warningOrange);
            expect(textColor(view, /Delay Reported: Traffic/)).toBe(
                theme.warningOrangeText,
            );
        });

        it('shows a queued delay as waiting to send, never as reported', async () => {
            const queued = {
                id: 'cmd-1',
                type: 'report_delay',
                state: 'queued',
                jobId: baseJob.id,
                payload: { reason_label: 'Traffic', estimated_minutes: 15 },
            } as unknown as OutboxCommand;
            const view = await renderCard(mode, { queuedDelayCommand: queued });
            const banner = flat(view, `queued-delay-banner-${baseJob.id}`);

            expect(banner.backgroundColor).toBe(theme.actionCobaltLight);
            expect(banner.borderColor).toBe(theme.actionCobalt);
            expect(
                view.getByText(/Delay waiting to send: Traffic/),
            ).toBeTruthy();
            expect(view.queryByText(/Delay Reported/)).toBeNull();
        });

        it('asks for a response in orange, with a gold accept and an outlined red decline', async () => {
            const view = await renderCard(mode, {
                job: {
                    ...baseJob,
                    my_assignment: {
                        ...baseJob.my_assignment!,
                        response_status: 'pending',
                    },
                },
                onAcceptAssignment: jest.fn(),
                onRejectAssignment: jest.fn(),
            });

            expect(
                flat(view, `job-pending-banner-${baseJob.id}`).backgroundColor,
            ).toBe(theme.warningOrangeLight);
            expect(
                flat(view, `accept-assignment-btn-${baseJob.id}`)
                    .backgroundColor,
            ).toBe(theme.brandAmber);
            expect(textColor(view, 'Accept Dispatch')).toBe(theme.surfaceDark);

            const decline = flat(view, `decline-assignment-btn-${baseJob.id}`);

            expect(decline.borderColor).toBe(theme.hazardRed);
            expect(decline.minHeight).toBeGreaterThanOrEqual(48);
            expect(textColor(view, 'Decline')).toBe(theme.hazardRedText);
        });
    },
);
