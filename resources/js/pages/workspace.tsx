import { Head, router, usePage, usePoll } from '@inertiajs/react';
import type { ConnectionStatus } from 'laravel-echo';
import { AlertTriangle, Check, Info, LockKeyhole, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { OperationsOverviewDashboard } from '@/components/dashboards/operations-overview-dashboard';
import { Button, EmptyState, Panel } from '@/components/ui';
import { LiveDispatchWorkspace } from '@/components/workspace/live-dispatch-workspace';
import { LiveWorkspaceSection } from '@/components/workspace/live-workspace-sections';
import { LiveWorkspaceShell } from '@/components/workspace/live-workspace-shell';
import { getEcho, reconnectEcho } from '@/echo';
import { cn } from '@/lib/utils';
import type {
    WorkspaceFlash,
    WorkspacePageProps,
    WorkspaceSection,
} from '@/types/workspace';

const FALLBACK_POLL_INTERVAL_MS = 15_000;

export default function Workspace(props: WorkspacePageProps) {
    const { flash, errors } = usePage().props;
    const [section, setSection] = useState<WorkspaceSection | null>(() =>
        initialSection(props.navigation),
    );
    const [wsState, setWsState] = useState<ConnectionStatus>(getInitialWsState);
    const [refreshing, setRefreshing] = useState(false);
    const fallbackPoll = usePoll(
        FALLBACK_POLL_INTERVAL_MS,
        {},
        {
            autoStart: false,
            keepAlive: false,
            mode: 'rest',
        },
    );
    const fallbackPollControls = useRef(fallbackPoll);
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

    const usingPollingFallback = wsState !== 'connected';
    const timeStale = isStale(
        props.workspace.refreshed_at,
        props.workspace.stale_after_seconds,
        currentTime,
    );
    const staleDismissed =
        dismissedRefreshedAt === props.workspace.refreshed_at;
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
        const handleStateChange = (current: ConnectionStatus) => {
            setWsState(current);

            if (previousState !== 'connected' && current === 'connected') {
                router.reload();
            }

            previousState = current;
        };
        const unsubscribeConnection =
            echo.connector.onConnectionChange(handleStateChange);

        echo.private('operations.workspace')
            .subscribed(() => setWsState(echo.connectionStatus()))
            .error(() => setWsState('failed'))
            .listen('.WorkspaceUpdated', () => {
                router.reload();
            });

        return () => {
            unsubscribeConnection();
            echo.leave('operations.workspace');
        };
    }, []);

    useEffect(() => {
        const handleFocus = () => {
            if (
                isStale(
                    props.workspace.refreshed_at,
                    props.workspace.stale_after_seconds,
                    Date.now(),
                )
            ) {
                router.reload();
            }
        };
        window.addEventListener('focus', handleFocus);

        return () => window.removeEventListener('focus', handleFocus);
    }, [props.workspace.refreshed_at, props.workspace.stale_after_seconds]);

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
        window.history.replaceState({}, '', url);
    };

    const refresh = () =>
        router.reload({
            onStart: () => setRefreshing(true),
            onFinish: () => setRefreshing(false),
        });

    const reconnectAndRefresh = () => {
        reconnectEcho();
        refresh();
    };

    const shareLocation = () => {
        setLocationError(null);

        if (!('geolocation' in navigator)) {
            setLocationError(
                'Location sharing is not supported by this browser.',
            );

            return;
        }

        setLocationPending(true);
        const commandId =
            typeof crypto !== 'undefined' && crypto.randomUUID
                ? crypto.randomUUID()
                : `cmd-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        navigator.geolocation.getCurrentPosition(
            (position) =>
                router.post(
                    '/operations/locations',
                    {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy_metres: position.coords.accuracy,
                        captured_at: new Date(position.timestamp).toISOString(),
                        sharing_enabled: true,
                        command_id: commandId,
                    },
                    {
                        preserveScroll: true,
                        onError: () =>
                            setLocationError(
                                'The location could not be saved. Review the form message and try again.',
                            ),
                        onFinish: () => setLocationPending(false),
                    },
                ),
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
    };

    const validationErrorCount = Object.keys(errors).length;

    const unreadNotificationCount = (props.notifications ?? []).filter(
        (n) => n.status !== 'read' && !n.read_at,
    ).length;

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
                notifications={props.notifications ?? []}
                onSectionChange={changeSection}
                onRefresh={refresh}
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
                                        props.workspace.refreshed_at,
                                    )
                                }
                                action={
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={
                                            usingPollingFallback
                                                ? reconnectAndRefresh
                                                : refresh
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
                ) : availableSection === 'overview' ? (
                    <OperationsOverviewDashboard
                        jobs={props.jobs}
                        clients={props.clients}
                        serviceRequests={props.serviceRequests}
                        assets={props.assets}
                        fuelRequests={props.fuelRequests}
                        locations={props.locations ?? []}
                        approvals={props.approvals}
                        users={props.users}
                        auditEvents={props.auditEvents}
                        gptRecommendations={props.gptRecommendations}
                        capabilities={props.capabilities}
                        availableSections={props.navigation.map(
                            (item) => item.id,
                        )}
                        onSectionChange={changeSection}
                    />
                ) : availableSection === 'dispatch' ? (
                    <LiveDispatchWorkspace
                        jobs={props.jobs}
                        clients={props.clients}
                        serviceRequests={props.serviceRequests}
                        assets={props.assets}
                        approvals={props.approvals}
                        users={props.users}
                        gptRecommendations={props.gptRecommendations}
                        capabilities={props.capabilities}
                        canCreate={props.capabilities.create_dispatch}
                        refreshing={refreshing}
                        initialServiceRequestId={selectedServiceRequestId}
                    />
                ) : (
                    <LiveWorkspaceSection
                        section={availableSection}
                        assets={props.assets}
                        fuelRequests={props.fuelRequests}
                        locations={props.locations ?? []}
                        approvals={props.approvals}
                        users={props.users}
                        auditEvents={props.auditEvents}
                        capabilities={props.capabilities}
                        jobReports={props.jobReports}
                        reportExports={props.reportExports}
                        notifications={props.notifications}
                        archivedJobs={props.archivedJobs}
                        gptRecommendations={props.gptRecommendations}
                    />
                )}
            </LiveWorkspaceShell>
        </>
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

function initialSection(
    navigation: WorkspacePageProps['navigation'],
): WorkspaceSection | null {
    if (typeof window === 'undefined') {
        return navigation[0]?.id ?? null;
    }

    const requested = new URLSearchParams(window.location.search).get('view');
    const available = navigation.find((item) => item.id === requested);

    return available?.id ?? navigation[0]?.id ?? null;
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
    if (typeof window === 'undefined') {
        return 'connected';
    }

    return getEcho()?.connectionStatus() ?? 'disconnected';
}
