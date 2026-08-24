import { Head, router, usePage, usePoll } from '@inertiajs/react';
import type { ConnectionStatus } from 'laravel-echo';
import { AlertTriangle, Check, Info, LockKeyhole, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { OperationsOverviewDashboard } from '@/components/dashboards/operations-overview-dashboard';
import { Button, EmptyState, Panel } from '@/components/ui';
import { LiveDispatchWorkspace } from '@/components/workspace/live-dispatch-workspace';
import { LiveWorkspaceSection } from '@/components/workspace/live-workspace-sections';
import { LiveWorkspaceShell } from '@/components/workspace/live-workspace-shell';
import { getEcho, reconnectEcho } from '@/echo';
import { getOutboxQueue, queueCommand, syncOutbox } from '@/lib/outbox';
import type { OutboxItem } from '@/lib/outbox';
import { cn } from '@/lib/utils';
import type {
    RefreshMode,
    RefreshScope,
    ScopeRefreshState,
    WorkspaceFlash,
    WorkspacePageProps,
    WorkspaceFreshness,
    WorkspaceScopeFreshness,
    WorkspaceRefreshState,
    WorkspaceSection,
} from '@/types/workspace';

const FALLBACK_POLL_INTERVAL_MS = 15_000;
const DEFAULT_REFRESH_ERROR =
    'The workspace could not be refreshed. Review the current data before continuing.';

const SECTION_PROPS: Record<WorkspaceSection, string[]> = {
    overview: [
        'jobs',
        'clients',
        'serviceRequests',
        'assets',
        'fuelRequests',
        'locations',
        'approvals',
        'users',
        'auditEvents',
        'gptRecommendations',
    ],
    dispatch: [
        'jobs',
        'clients',
        'serviceRequests',
        'rentalHandoffs',
        'salesHandoffs',
        'assets',
        'approvals',
        'users',
        'gptRecommendations',
    ],
    assets: ['assets', 'locations'],
    tracking: ['assets', 'locations'],
    fuel: ['fuelRequests'],
    approvals: ['approvals'],
    reports: ['jobReports', 'reportExports', 'jobs'],
    notifications: ['notifications'],
    archive: ['archivedJobs'],
    'gpt-recommendations': ['gptRecommendations', 'jobs'],
    users: ['users', 'auditEvents'],
    audit: ['auditEvents'],
};

function hasSectionProps(
    props: WorkspacePageProps,
    section: WorkspaceSection,
): boolean {
    return SECTION_PROPS[section].every((prop) => prop in props);
}

export default function Workspace(props: WorkspacePageProps) {
    const { flash, errors } = usePage().props;
    const [section, setSection] = useState<WorkspaceSection | null>(
        props.initial_section,
    );
    const [wsState, setWsState] = useState<ConnectionStatus>(getInitialWsState);
    const [refreshState, setRefreshState] = useState<WorkspaceRefreshState>(
        () => createInitialRefreshState(props.workspace),
    );
    const activeRefreshes = useRef(
        new Map<RefreshScope, { mode: RefreshMode; completed: boolean }>(),
    );
    const handledServerRefresh = useRef<string | null>(null);
    const observedServerRefresh = useRef(props.workspace.refreshed_at);
    const [, setOutboxQueue] = useState<OutboxItem[]>(() => getOutboxQueue());
    const [locationPending, setLocationPending] = useState(false);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [dismissedRefreshedAt, setDismissedRefreshedAt] = useState<
        string | null
    >(null);
    const [currentTime, setCurrentTime] = useState(() => Date.now());
    const availableSection = props.navigation.some(
        (item) => item.id === section,
    )
        ? section
        : (props.navigation[0]?.id ?? null);

    const beginRefresh = useCallback(
        (scope: RefreshScope, mode: RefreshMode) => {
            if (activeRefreshes.current.size > 0) {
                return false;
            }

            const attemptedAt = new Date().toISOString();
            activeRefreshes.current.set(scope, {
                mode,
                completed: false,
            });
            setRefreshState((current) => ({
                ...current,
                [scope]: {
                    ...current[scope],
                    status: 'refreshing',
                    mode,
                    last_attempt_at: attemptedAt,
                    error: null,
                },
            }));

            return true;
        },
        [],
    );

    const markRefreshSuccess = useCallback(
        (scope: RefreshScope, page?: unknown) => {
            const active = activeRefreshes.current.get(scope);

            if (!active) {
                return;
            }

            active.completed = true;
            const freshness = getPageWorkspaceFreshness(page, props.workspace);
            const now = new Date().toISOString();
            handledServerRefresh.current = freshness.refreshed_at;

            setRefreshState((current) => {
                const refreshedScope = scopeFreshness(freshness, scope);
                const updatedScope = successfulRefreshState(
                    current[scope],
                    refreshedScope,
                    active.mode,
                    now,
                );

                if (scope === 'workspace') {
                    return {
                        workspace: updatedScope,
                        tracking: successfulRefreshState(
                            current.tracking,
                            scopeFreshness(freshness, 'tracking'),
                            active.mode,
                            now,
                        ),
                    };
                }

                return { ...current, tracking: updatedScope };
            });
        },
        [props.workspace],
    );

    const markRefreshFailure = useCallback(
        (scope: RefreshScope, message: string) => {
            const active = activeRefreshes.current.get(scope);

            if (!active) {
                return;
            }

            active.completed = true;
            setRefreshState((current) => ({
                ...current,
                [scope]: {
                    ...current[scope],
                    status: 'failed',
                    error: message,
                },
            }));
        },
        [],
    );

    const finishRefresh = useCallback(
        (scope: RefreshScope) => {
            const active = activeRefreshes.current.get(scope);

            if (!active) {
                return;
            }

            if (!active.completed) {
                markRefreshFailure(scope, 'The refresh was cancelled.');
            }

            activeRefreshes.current.delete(scope);
        },
        [markRefreshFailure],
    );

    const refresh = useCallback(
        (scope: RefreshScope = 'workspace', mode: RefreshMode = 'manual') => {
            if (!beginRefresh(scope, mode)) {
                return;
            }

            router.reload({
                only: [
                    'workspace',
                    'badges',
                    ...(scope === 'tracking'
                        ? ['locations']
                        : availableSection
                          ? SECTION_PROPS[availableSection]
                          : []),
                ],
                preserveErrors: true,
                onSuccess: (page) => markRefreshSuccess(scope, page),
                onError: () => markRefreshFailure(scope, DEFAULT_REFRESH_ERROR),
                onHttpException: () =>
                    markRefreshFailure(scope, DEFAULT_REFRESH_ERROR),
                onNetworkError: () =>
                    markRefreshFailure(
                        scope,
                        'The network is unavailable. Current data is still shown.',
                    ),
                onCancel: () =>
                    markRefreshFailure(scope, 'The refresh was cancelled.'),
                onFinish: () => finishRefresh(scope),
            });
        },
        [
            availableSection,
            beginRefresh,
            finishRefresh,
            markRefreshFailure,
            markRefreshSuccess,
        ],
    );
    const refreshWorkspace = useCallback(() => refresh('workspace'), [refresh]);
    const refreshRef = useRef(refresh);

    useEffect(() => {
        refreshRef.current = refresh;
    }, [refresh]);

    const fallbackPoll = usePoll(
        FALLBACK_POLL_INTERVAL_MS,
        () => ({
            onStart: () => beginRefresh('workspace', 'polling'),
            onSuccess: (page) => markRefreshSuccess('workspace', page),
            onError: () =>
                markRefreshFailure('workspace', DEFAULT_REFRESH_ERROR),
            onHttpException: () =>
                markRefreshFailure('workspace', DEFAULT_REFRESH_ERROR),
            onNetworkError: () =>
                markRefreshFailure(
                    'workspace',
                    'The network is unavailable. Current data is still shown.',
                ),
            onFinish: () => finishRefresh('workspace'),
        }),
        {
            autoStart: false,
            keepAlive: false,
            mode: 'rest',
        },
    );
    const fallbackPollControls = useRef(fallbackPoll);
    const refreshing = refreshState.workspace.status === 'refreshing';
    const usingPollingFallback = wsState !== 'connected';
    const timeStale = isStale(
        refreshState.workspace.refreshed_at,
        refreshState.workspace.stale_after_seconds,
        currentTime,
    );
    const staleDismissed =
        dismissedRefreshedAt === refreshState.workspace.refreshed_at;
    const showStaleNotice = timeStale && !staleDismissed;

    useEffect(() => {
        const timer = window.setInterval(
            () => setCurrentTime(Date.now()),
            15_000,
        );

        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        const poll = fallbackPollControls.current;

        if (usingPollingFallback) {
            poll.start();
        } else {
            poll.stop();
        }

        return () => poll.stop();
    }, [usingPollingFallback]);

    useEffect(() => {
        const echo = getEcho();

        if (!echo) {
            return;
        }

        let previousState = echo.connectionStatus();
        const initialStateSync = window.setTimeout(
            () => setWsState(echo.connectionStatus()),
            0,
        );
        const handleStateChange = (current: ConnectionStatus) => {
            setWsState(current);

            if (previousState !== 'connected' && current === 'connected') {
                refreshRef.current('workspace', 'realtime');
            }

            previousState = current;
        };
        const unsubscribeConnection =
            echo.connector.onConnectionChange(handleStateChange);

        echo.private('operations.workspace')
            .subscribed(() => setWsState(echo.connectionStatus()))
            .error(() => setWsState('failed'))
            .listen('.WorkspaceUpdated', () => {
                refreshRef.current('workspace', 'realtime');
            });

        return () => {
            window.clearTimeout(initialStateSync);
            unsubscribeConnection();
            echo.leave('operations.workspace');
        };
    }, []);

    useEffect(() => {
        const handleFocus = () => {
            if (
                isStale(
                    refreshState.workspace.refreshed_at,
                    refreshState.workspace.stale_after_seconds,
                    Date.now(),
                )
            ) {
                refreshRef.current('workspace', 'manual');
            }
        };
        window.addEventListener('focus', handleFocus);

        return () => window.removeEventListener('focus', handleFocus);
    }, [refreshState.workspace]);

    useEffect(() => {
        if (observedServerRefresh.current === props.workspace.refreshed_at) {
            return;
        }

        observedServerRefresh.current = props.workspace.refreshed_at;

        if (handledServerRefresh.current === props.workspace.refreshed_at) {
            handledServerRefresh.current = null;

            return;
        }

        setRefreshState((current) =>
            applyFullRefreshFreshness(current, props.workspace),
        );
    }, [props.workspace]);

    const [selectedServiceRequestId, setSelectedServiceRequestId] = useState<
        number | null
    >(null);

    const changeSection = (
        nextSection: WorkspaceSection,
        options?: { serviceRequestId?: number },
    ) => {
        setSection(nextSection);
        setSelectedServiceRequestId(options?.serviceRequestId ?? null);
        const url = new URL(window.location.href);
        url.searchParams.set('view', nextSection);
        router.visit(url.toString(), {
            only: ['workspace', 'badges', ...SECTION_PROPS[nextSection]],
            preserveState: true,
            preserveScroll: true,
            preserveErrors: true,
        });
    };

    useEffect(() => {
        const handlePopState = () => {
            const requested = new URL(window.location.href).searchParams.get(
                'view',
            ) as WorkspaceSection | null;
            const nextSection = props.navigation.some(
                (item) => item.id === requested,
            )
                ? requested
                : (props.navigation[0]?.id ?? null);

            setSection(nextSection);

            if (nextSection) {
                router.reload({
                    only: [
                        'workspace',
                        'badges',
                        ...SECTION_PROPS[nextSection],
                    ],
                    preserveErrors: true,
                });
            }
        };

        window.addEventListener('popstate', handlePopState);

        return () => window.removeEventListener('popstate', handlePopState);
    }, [props.navigation]);

    const reconnectAndRefresh = () => {
        reconnectEcho();
        refreshWorkspace();
    };

    const syncPendingOutbox = useCallback(async () => {
        try {
            await syncOutbox();
            const queue = getOutboxQueue();
            setOutboxQueue(queue);
            const failedLocation = queue.find(
                (item) =>
                    item.action === 'location.store' &&
                    (item.status === 'failed' || item.status === 'conflict'),
            );

            if (failedLocation) {
                setLocationError(
                    failedLocation.errorMessage ??
                        'A location change could not be synchronized. It remains queued for retry.',
                );
            }
        } catch {
            setOutboxQueue(getOutboxQueue());
            setLocationError(
                'Location synchronization failed. The command remains queued for retry.',
            );
        }
    }, []);

    useEffect(() => {
        const handleOnline = () => void syncPendingOutbox();
        window.addEventListener('online', handleOnline);
        const initialSync = window.setTimeout(
            () => void syncPendingOutbox(),
            0,
        );

        return () => {
            window.clearTimeout(initialSync);
            window.removeEventListener('online', handleOnline);
        };
    }, [syncPendingOutbox]);

    const updateOutboxState = useCallback(
        () => setOutboxQueue(getOutboxQueue()),
        [],
    );

    const toggleLocationSharing = useCallback(
        (enable: boolean) => {
            if (locationPending) {
                return;
            }

            setLocationError(null);

            const submit = async (payload: Record<string, unknown>) => {
                setLocationPending(true);
                const command = queueCommand(
                    'location.store',
                    '/operations/locations',
                    payload,
                );
                updateOutboxState();

                try {
                    await syncOutbox();
                    const queuedCommand = getOutboxQueue().find(
                        (item) => item.id === command.id,
                    );
                    setOutboxQueue(getOutboxQueue());

                    if (queuedCommand?.status === 'synchronized') {
                        refreshRef.current('tracking', 'manual');
                    } else {
                        setLocationError(
                            queuedCommand?.errorMessage ??
                                'Location change queued. It will retry when connectivity returns.',
                        );
                    }
                } catch {
                    setOutboxQueue(getOutboxQueue());
                    setLocationError(
                        'Location synchronization failed. The command remains queued for retry.',
                    );
                } finally {
                    setLocationPending(false);
                }
            };

            if (!enable) {
                void submit({
                    sharing_enabled: false,
                    captured_at: new Date().toISOString(),
                });

                return;
            }

            if (!('geolocation' in navigator)) {
                setLocationError(
                    'Location sharing is not supported by this browser.',
                );

                return;
            }

            setLocationPending(true);
            navigator.geolocation.getCurrentPosition(
                (position) =>
                    void submit({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy_metres: position.coords.accuracy,
                        captured_at: new Date(position.timestamp).toISOString(),
                        sharing_enabled: true,
                    }),
                (error) => {
                    setLocationPending(false);
                    setLocationError(locationErrorMessage(error.code));
                },
                {
                    enableHighAccuracy: true,
                    maximumAge: 30_000,
                    timeout: 15_000,
                },
            );
        },
        [locationPending, updateOutboxState],
    );

    const shareLocation = useCallback(() => {
        toggleLocationSharing(true);
    }, [toggleLocationSharing]);

    const validationErrorCount = Object.keys(errors).length;

    const unreadNotificationCount = (props.notifications ?? []).filter(
        (n) => n.status !== 'read' && !n.read_at,
    ).length;
    const pendingApprovalCount = (props.approvals ?? []).filter(
        (approval) => approval.status.value === 'pending',
    ).length;
    const sectionReady =
        availableSection !== null && hasSectionProps(props, availableSection);

    return (
        <>
            <Head title="Operations workspace" />
            <LiveWorkspaceShell
                navigation={props.navigation}
                section={availableSection}
                stale={showStaleNotice}
                refreshing={refreshing}
                canShareLocation={props.capabilities.share_location}
                locationPending={locationPending}
                unreadNotificationCount={unreadNotificationCount}
                pendingApprovalCount={pendingApprovalCount}
                notifications={props.notifications ?? []}
                onSectionChange={changeSection}
                onRefresh={refreshWorkspace}
                onShareLocation={shareLocation}
            >
                {(flash ||
                    locationError ||
                    validationErrorCount > 0 ||
                    showStaleNotice) && (
                    <div className="space-y-2 border-b border-line bg-surface px-4 py-3 md:px-6">
                        {flash && <FlashNotice flash={flash} />}
                        {locationError && (
                            <StateNotice
                                tone="error"
                                message={locationError}
                                onDismiss={() => setLocationError(null)}
                            />
                        )}
                        {validationErrorCount > 0 && (
                            <StateNotice
                                tone="error"
                                message={`${validationErrorCount} field${validationErrorCount === 1 ? '' : 's'} need attention. Your entries were preserved.`}
                            />
                        )}
                        {showStaleNotice && (
                            <StateNotice
                                tone="warning"
                                message={
                                    usingPollingFallback
                                        ? 'Automatic refresh could not keep this workspace current. Review current data or retry the live connection.'
                                        : 'This workspace has not refreshed recently. Review current data before making an operational decision.'
                                }
                                onDismiss={() =>
                                    setDismissedRefreshedAt(
                                        refreshState.workspace.refreshed_at,
                                    )
                                }
                                action={
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={
                                            usingPollingFallback
                                                ? reconnectAndRefresh
                                                : refreshWorkspace
                                        }
                                        disabled={refreshing}
                                    >
                                        {refreshing
                                            ? 'Refreshing…'
                                            : usingPollingFallback
                                              ? 'Retry live & refresh'
                                              : 'Refresh now'}
                                    </Button>
                                }
                            />
                        )}
                    </div>
                )}

                {availableSection === null ? (
                    <div className="p-4 md:p-6">
                        <Panel>
                            <EmptyState
                                icon={LockKeyhole}
                                title="No workspace modules available"
                                message="Your account is active, but it has no operational capabilities. Ask an administrator to review the assigned role."
                            />
                        </Panel>
                    </div>
                ) : !sectionReady ? (
                    <WorkspaceSectionLoading section={availableSection} />
                ) : availableSection === 'overview' ? (
                    <OperationsOverviewDashboard
                        jobs={props.jobs ?? []}
                        clients={props.clients ?? []}
                        serviceRequests={props.serviceRequests ?? []}
                        assets={props.assets ?? []}
                        fuelRequests={props.fuelRequests ?? []}
                        locations={props.locations ?? []}
                        approvals={props.approvals ?? []}
                        users={props.users ?? []}
                        auditEvents={props.auditEvents ?? []}
                        gptRecommendations={props.gptRecommendations ?? []}
                        capabilities={props.capabilities}
                        availableSections={props.navigation.map(
                            (item) => item.id,
                        )}
                        refresh={refreshState.tracking}
                        realtimeConnected={wsState === 'connected'}
                        onSectionChange={changeSection}
                    />
                ) : availableSection === 'dispatch' ? (
                    <LiveDispatchWorkspace
                        jobs={props.jobs!}
                        clients={props.clients!}
                        serviceRequests={props.serviceRequests!}
                        rentalHandoffs={props.rentalHandoffs!}
                        salesHandoffs={props.salesHandoffs!}
                        assets={props.assets!}
                        approvals={props.approvals!}
                        users={props.users!}
                        gptRecommendations={props.gptRecommendations!}
                        capabilities={props.capabilities}
                        canCreate={props.capabilities.create_dispatch}
                        refreshing={refreshing}
                        initialServiceRequestId={selectedServiceRequestId}
                    />
                ) : (
                    <LiveWorkspaceSection
                        section={availableSection}
                        assets={props.assets ?? []}
                        fuelRequests={props.fuelRequests ?? []}
                        locations={props.locations ?? []}
                        approvals={props.approvals ?? []}
                        users={props.users ?? []}
                        auditEvents={props.auditEvents ?? []}
                        capabilities={props.capabilities}
                        jobReports={props.jobReports}
                        reportExports={props.reportExports}
                        notifications={props.notifications}
                        archivedJobs={props.archivedJobs}
                        gptRecommendations={props.gptRecommendations}
                        jobs={props.jobs ?? []}
                        onSectionChange={changeSection}
                    />
                )}
            </LiveWorkspaceShell>
        </>
    );
}

function WorkspaceSectionLoading({ section }: { section: WorkspaceSection }) {
    return (
        <section
            className="space-y-4 p-4 md:p-6"
            aria-busy="true"
            aria-live="polite"
            aria-label={`${section} section loading`}
        >
            <div className="h-8 w-56 animate-pulse rounded-lg bg-surface-subtle" />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {[1, 2, 3].map((item) => (
                    <div
                        key={item}
                        className="h-32 animate-pulse rounded-xl border border-line bg-surface"
                    />
                ))}
            </div>
            <p className="sr-only">Loading {section} data.</p>
        </section>
    );
}

function FlashNotice({ flash }: { flash: WorkspaceFlash }) {
    return <StateNotice tone={flash.tone} message={flash.message} />;
}

function StateNotice({
    tone,
    message,
    onDismiss,
    action,
}: {
    tone: WorkspaceFlash['tone'];
    message: string;
    onDismiss?: () => void;
    action?: ReactNode;
}) {
    const Icon =
        tone === 'success'
            ? Check
            : tone === 'warning'
              ? AlertTriangle
              : tone === 'error'
                ? X
                : Info;

    return (
        <div
            className={cn(
                'flex items-start gap-3 rounded-lg px-3 py-2.5 text-sm',
                tone === 'success' && 'bg-success-soft text-success-strong',
                tone === 'warning' && 'bg-warning-soft text-warning-strong',
                tone === 'error' && 'bg-danger-soft text-danger',
                tone === 'info' && 'bg-info-soft text-info-strong',
            )}
            role={tone === 'error' ? 'alert' : 'status'}
        >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p className="min-w-0 flex-1 leading-5">{message}</p>
            {action}
            {onDismiss && (
                <button
                    type="button"
                    onClick={onDismiss}
                    className="-m-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hover:bg-black/5"
                    aria-label="Dismiss message"
                >
                    <X className="h-4 w-4" aria-hidden="true" />
                </button>
            )}
        </div>
    );
}

function isStale(
    refreshedAt: string,
    staleAfterSeconds: number,
    currentTime: number,
) {
    return (
        currentTime - new Date(refreshedAt).getTime() > staleAfterSeconds * 1000
    );
}

function locationErrorMessage(code: number) {
    if (code === GeolocationPositionError.PERMISSION_DENIED) {
        return 'Location permission was denied. Enable it in your browser before sharing.';
    }

    if (code === GeolocationPositionError.TIMEOUT) {
        return 'The browser could not determine a location in time. Try again in an open area.';
    }

    return 'Your current location is unavailable. Check device location services and try again.';
}

function getInitialWsState(): ConnectionStatus {
    // Keep the server render and the first client render deterministic. The
    // realtime connection state is synchronized after hydration in the effect
    // above, so reading Echo during initial render can cause a mismatch.
    return 'disconnected';
}

function createInitialRefreshState(
    freshness: WorkspaceFreshness,
): WorkspaceRefreshState {
    return {
        workspace: createInitialScopeRefreshState(freshness, 'workspace'),
        tracking: createInitialScopeRefreshState(freshness, 'tracking'),
    };
}

function createInitialScopeRefreshState(
    freshness: WorkspaceFreshness,
    scope: RefreshScope,
): ScopeRefreshState {
    const scopedFreshness = scopeFreshness(freshness, scope);

    return {
        ...scopedFreshness,
        status: 'idle',
        mode: 'initial',
        last_attempt_at: null,
        last_success_at: null,
        error: null,
    };
}

function getPageWorkspaceFreshness(
    page: unknown,
    fallback: WorkspaceFreshness,
): WorkspaceFreshness {
    if (
        typeof page === 'object' &&
        page !== null &&
        'props' in page &&
        typeof page.props === 'object' &&
        page.props !== null &&
        'workspace' in page.props &&
        typeof page.props.workspace === 'object' &&
        page.props.workspace !== null
    ) {
        return page.props.workspace as WorkspaceFreshness;
    }

    return fallback;
}

function scopeFreshness(
    freshness: WorkspaceFreshness,
    scope: RefreshScope,
): WorkspaceScopeFreshness {
    if (scope === 'tracking' && freshness.tracking) {
        return freshness.tracking;
    }

    return {
        refreshed_at: freshness.refreshed_at,
        stale_after_seconds: freshness.stale_after_seconds,
    };
}

function successfulRefreshState(
    current: ScopeRefreshState,
    freshness: WorkspaceScopeFreshness,
    mode: RefreshMode,
    completedAt: string,
): ScopeRefreshState {
    return {
        ...current,
        ...freshness,
        status: 'succeeded',
        mode,
        last_success_at: completedAt,
        error: null,
    };
}

function applyFullRefreshFreshness(
    current: WorkspaceRefreshState,
    freshness: WorkspaceFreshness,
): WorkspaceRefreshState {
    return {
        workspace: {
            ...current.workspace,
            ...scopeFreshness(freshness, 'workspace'),
        },
        tracking: {
            ...current.tracking,
            ...scopeFreshness(freshness, 'tracking'),
        },
    };
}
