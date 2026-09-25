import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Button, Panel } from '@/components/ui';
import { getEcho } from '@/echo';
import type {
    WorkspaceCapabilities,
    WorkspaceSection,
} from '@/types/workspace';

type SafetyMetrics = {
    safe_man_hours_without_lti: number | null;
    days_without_lti: number | null;
    metric_availability: Record<string, 'available' | 'unavailable'>;
    open_hazards: number;
    active_work_stoppages: number;
    pending_critical_lifts: number;
    toolbox_meetings_today: number;
};

type SafetyHazard = {
    id: number;
    ticket_code: string;
    project_site: string;
    category: string;
    severity: string;
    description: string;
    location_detail: string;
    corrective_action_required: string;
    status: string;
    work_stoppage_issued: boolean;
    rectification_notes: string | null;
    location_latitude: number | null;
    location_longitude: number | null;
    location_accuracy_metres: number | null;
    photo_attachments?: Array<{
        id: number;
        original_filename: string;
        mime_type: string;
        size_bytes: number;
        download_url: string;
    }>;
    reporter_name: string;
    created_at: string;
};

type PendingHazardPhotoUpload = {
    hazardId: number;
    ticketCode: string;
    files: File[];
    commandIds: string[];
};

type CriticalLiftPlan = {
    id: number;
    lift_reference: string;
    project_site: string;
    risk_level: string;
    gross_load_weight_tons: number;
    crane_rated_capacity_tons: number;
    load_percentage_of_capacity: number;
    boom_length_meters: number;
    working_radius_meters: number;
    ground_bearing_condition: string;
    weather_wind_speed_kph: number | null;
    status: string;
    rejection_reason: string | null;
    operator_name: string | null;
    rigger_name: string | null;
    created_at: string;
};

type ToolboxMeeting = {
    id: number;
    project_site: string;
    topic_title: string;
    topic_category: string;
    conductor_name: string;
    attendee_count: number;
    notes: string | null;
    audit_hash: string | null;
    safety_officer_signed_at: string | null;
    created_at: string;
};

type WorkStoppage = {
    id: number;
    notice_number: string;
    project_site: string;
    reason: string;
    affected_area: string;
    is_active: boolean;
    issuer_name: string;
    lifted_by_name: string | null;
    lifted_at: string | null;
    lift_reason: string | null;
    created_at: string;
};

type SafetyData = {
    metrics: SafetyMetrics;
    hazards: SafetyHazard[];
    liftPlans: CriticalLiftPlan[];
    toolboxMeetings: ToolboxMeeting[];
    workStoppages: WorkStoppage[];
};

type SafetyTab =
    'overview' | 'lift-plans' | 'toolbox' | 'hazards' | 'stoppages' | 'exports';

const API_PATHS = {
    overview: '/operations/safety/overview',
    metrics: '/operations/safety/metrics',
    hazards: '/operations/safety/hazards',
    liftPlans: '/operations/safety/lift-plans',
    toolboxMeetings: '/operations/safety/toolbox-meetings',
    workStoppages: '/operations/safety/work-stoppages',
};

const TABS: Array<{ id: SafetyTab; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'lift-plans', label: 'Critical lift plans' },
    { id: 'toolbox', label: 'Toolbox meetings' },
    { id: 'hazards', label: 'Hazards' },
    { id: 'stoppages', label: 'Work stoppages' },
    { id: 'exports', label: 'Statutory exports' },
];

const inputClassName =
    'mt-1 block min-h-11 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const labelClassName = 'block text-sm font-medium text-foreground';

function csrfToken(): string {
    return (
        document
            .querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
            ?.getAttribute('content') ?? ''
    );
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(path, {
        credentials: 'same-origin',
        cache: 'no-store',
        ...init,
        headers: {
            Accept: 'application/json',
            ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
            ...(init?.method === 'POST' ? { 'X-CSRF-TOKEN': csrfToken() } : {}),
            ...init?.headers,
        },
    });
    const body = (await response.json().catch(() => null)) as {
        data?: unknown;
        message?: string;
        errors?: Record<string, string[]>;
    } | null;

    if (!response.ok) {
        const validationMessage = Object.values(body?.errors ?? {}).flat()[0];

        throw new Error(
            validationMessage ??
                body?.message ??
                'The safety request could not be completed. Retry or contact an Operations Manager.',
        );
    }

    return body as T;
}

function formatWhen(value: string | null | undefined): string {
    if (!value) {
        return 'Not recorded';
    }

    const date = new Date(value);

    return Number.isNaN(date.valueOf()) ? value : date.toLocaleString();
}

function statusLabel(value: string): string {
    if (value === 'pending_so_review') {
        return 'Awaiting Operations Manager review';
    }

    if (value === 'rectified') {
        return 'Rectified';
    }

    if (value === 'open') {
        return 'Open';
    }

    if (value === 'closed') {
        return 'Closed';
    }

    return value.replaceAll('_', ' ');
}

export function SafetyGovernanceSection({
    capabilities,
    onSectionChange,
}: {
    capabilities: WorkspaceCapabilities;
    onSectionChange?: (section: WorkspaceSection) => void;
}) {
    const [data, setData] = useState<SafetyData | null>(null);
    const [tab, setTab] = useState<SafetyTab>('overview');
    const [loading, setLoading] = useState(true);
    const [actionBusy, setActionBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const pendingCommands = useRef(
        new Map<string, { fingerprint: string; id: string }>(),
    );
    const pendingHazardPhotoUpload = useRef<PendingHazardPhotoUpload | null>(
        null,
    );
    const [pendingPhotoUpload, setPendingPhotoUpload] =
        useState<PendingHazardPhotoUpload | null>(null);
    const [hazardLocation, setHazardLocation] = useState<{
        latitude: number;
        longitude: number;
        accuracy: number | null;
        observedAt: string;
    } | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const overview = await requestJson<{ data: SafetyData }>(
                API_PATHS.overview,
            );
            setData(overview.data);
        } catch (loadError) {
            setError(
                loadError instanceof Error
                    ? loadError.message
                    : 'Safety records could not be loaded. Retry before making a decision.',
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        // This initial fetch drives the screen's loading and failure states.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void loadData();
    }, [loadData]);

    useEffect(() => {
        const echo = getEcho();

        if (!echo) {
            return;
        }

        const channel = echo.private('operations.safety');
        const refresh = () => void loadData();
        channel
            .listen('.CriticalLiftPlanChanged', refresh)
            .listen('.ToolboxMeetingChanged', refresh)
            .listen('.WorkStoppageChanged', refresh);

        return () => {
            channel
                .stopListening('.CriticalLiftPlanChanged')
                .stopListening('.ToolboxMeetingChanged')
                .stopListening('.WorkStoppageChanged');
        };
    }, [loadData]);

    const submit = useCallback(
        async (
            key: string,
            path: string,
            payload: Record<string, unknown>,
            message: string,
            afterSave?: (response: { data?: unknown }) => Promise<void>,
        ) => {
            setActionBusy(key);
            setError(null);
            setSuccess(null);

            try {
                const fingerprint = JSON.stringify(payload);
                const pending = pendingCommands.current.get(key);
                const commandId =
                    pending?.fingerprint === fingerprint
                        ? pending.id
                        : crypto.randomUUID();
                pendingCommands.current.set(key, {
                    fingerprint,
                    id: commandId,
                });
                const response = await requestJson<{ data?: unknown }>(path, {
                    method: 'POST',
                    body: JSON.stringify(payload),
                    headers: { 'Idempotency-Key': commandId },
                });
                await afterSave?.(response);
                pendingCommands.current.delete(key);
                setSuccess(message);
                await loadData();

                return true;
            } catch (submitError) {
                setError(
                    submitError instanceof Error
                        ? submitError.message
                        : 'The safety record was not saved. Review the form and retry.',
                );

                return false;
            } finally {
                setActionBusy(null);
            }
        },
        [loadData],
    );

    const createHazard = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);
        const files = formData
            .getAll('photo_files')
            .filter(
                (value): value is File =>
                    value instanceof File && value.size > 0,
            );
        const allowedImageTypes = new Set([
            'image/jpeg',
            'image/png',
            'image/heic',
            'image/heif',
        ]);

        if (files.length > 4) {
            setError('Choose up to 4 photos for one hazard report.');

            return;
        }

        if (files.some((file) => file.size > 15 * 1024 * 1024)) {
            setError('Each photo must be 15 MB or smaller.');

            return;
        }

        if (
            files.some(
                (file) => !allowedImageTypes.has(file.type.toLowerCase()),
            )
        ) {
            setError('Use JPEG, PNG, HEIC, or HEIF photo files.');

            return;
        }

        const payload = {
            ...Object.fromEntries(
                Array.from(formData.entries()).filter(
                    ([key]) => key !== 'photo_files',
                ),
            ),
            location_latitude: hazardLocation?.latitude ?? null,
            location_longitude: hazardLocation?.longitude ?? null,
            location_accuracy_metres: hazardLocation?.accuracy ?? null,
            location_observed_at: hazardLocation?.observedAt ?? null,
        };
        let hazardWasSaved = false;
        const saved = await submit(
            'hazard-create',
            API_PATHS.hazards,
            payload,
            'Hazard report saved. An Operations Manager can now review the corrective action.',
            async (response) => {
                const hazard = response.data as
                    { id?: number; ticket_code?: string } | undefined;

                if (!hazard || typeof hazard.id !== 'number') {
                    throw new Error(
                        'The hazard report was saved, but its photo upload could not be linked. Refresh the list and contact an Operations Manager.',
                    );
                }

                hazardWasSaved = true;

                if (files.length === 0) {
                    return;
                }

                const pending =
                    pendingHazardPhotoUpload.current?.hazardId === hazard.id
                        ? pendingHazardPhotoUpload.current
                        : {
                              hazardId: hazard.id,
                              ticketCode:
                                  hazard.ticket_code ?? `Hazard ${hazard.id}`,
                              files,
                              commandIds: files.map(() => crypto.randomUUID()),
                          };
                pendingHazardPhotoUpload.current = pending;
                setPendingPhotoUpload(pending);

                try {
                    await uploadHazardPhotos(pending);
                    pendingHazardPhotoUpload.current = null;
                    setPendingPhotoUpload(null);
                } catch (uploadError) {
                    await loadData();
                    const reason =
                        uploadError instanceof Error
                            ? uploadError.message
                            : 'The photo upload failed.';

                    throw new Error(
                        `${pending.ticketCode} was saved, but its photos were not all attached. Retry the photo upload before leaving this page. ${reason}`,
                    );
                }
            },
        );

        if (saved || hazardWasSaved) {
            form.reset();
            setHazardLocation(null);
        }
    };

    const uploadHazardPhotos = async (pending: PendingHazardPhotoUpload) => {
        for (const [index, file] of pending.files.entries()) {
            const body = new FormData();
            body.append('file', file);
            body.append('owner_type', 'site_hazard_ticket');
            body.append('owner_id', String(pending.hazardId));
            body.append('kind', 'hazard_photo');

            const response = await fetch('/operations/attachments', {
                method: 'POST',
                credentials: 'same-origin',
                cache: 'no-store',
                body,
                headers: {
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': csrfToken(),
                    'Idempotency-Key': pending.commandIds[index],
                },
            });
            const result = (await response.json().catch(() => null)) as {
                message?: string;
                errors?: Record<string, string[]>;
            } | null;

            if (!response.ok) {
                const validationMessage = Object.values(
                    result?.errors ?? {},
                ).flat()[0];

                throw new Error(
                    validationMessage ??
                        result?.message ??
                        'The photo upload failed. Retry when the connection is stable.',
                );
            }
        }
    };

    const retryHazardPhotoUpload = async () => {
        const pending = pendingHazardPhotoUpload.current;

        if (!pending) {
            return;
        }

        setActionBusy('hazard-photo-retry');
        setError(null);

        try {
            await uploadHazardPhotos(pending);
            pendingHazardPhotoUpload.current = null;
            setPendingPhotoUpload(null);
            setSuccess(
                `${pending.ticketCode} photos attached. The report is ready for manager review.`,
            );
            await loadData();
        } catch (uploadError) {
            setError(
                uploadError instanceof Error
                    ? uploadError.message
                    : 'The photos could not be attached. Keep this page open and retry.',
            );
        } finally {
            setActionBusy(null);
        }
    };

    const captureHazardLocation = () => {
        if (!navigator.geolocation) {
            setError(
                'This browser cannot capture GPS. Add a clear site and area description instead.',
            );

            return;
        }

        setError(null);
        navigator.geolocation.getCurrentPosition(
            ({ coords, timestamp }) =>
                setHazardLocation({
                    latitude: coords.latitude,
                    longitude: coords.longitude,
                    accuracy: Number.isFinite(coords.accuracy)
                        ? coords.accuracy
                        : null,
                    observedAt: new Date(timestamp || Date.now()).toISOString(),
                }),
            () =>
                setError(
                    'GPS was not captured. Check browser location permission or enter the site and area manually.',
                ),
            { enableHighAccuracy: true, maximumAge: 60_000, timeout: 8_000 },
        );
    };

    const createStoppage = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const form = event.currentTarget;
        const payload = Object.fromEntries(new FormData(form).entries());
        const saved = await submit(
            'stoppage-create',
            API_PATHS.workStoppages,
            payload,
            'Stop-work order issued. Dispatch progression at this site is now blocked until a manager lifts it.',
        );

        if (saved) {
            form.reset();
        }
    };

    const metricCards = data
        ? [
              {
                  label: 'Open hazards',
                  value: data.metrics.open_hazards,
                  detail: 'Awaiting corrective action',
              },
              {
                  label: 'Active work stoppages',
                  value: data.metrics.active_work_stoppages,
                  detail: 'Work must remain paused',
              },
              {
                  label: 'Lift plans awaiting review',
                  value: data.metrics.pending_critical_lifts,
                  detail: 'Dispatch stays blocked until approval',
              },
              {
                  label: 'Toolbox meetings today',
                  value: data.metrics.toolbox_meetings_today,
                  detail: 'Recorded today',
              },
          ]
        : [];

    return (
        <section
            className="space-y-5 p-4 md:p-6"
            aria-labelledby="safety-governance-title"
        >
            <header className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-3xl">
                    <p className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
                        Field governance
                    </p>
                    <h1
                        id="safety-governance-title"
                        className="text-foreground mt-1 text-2xl font-semibold"
                    >
                        Safety governance
                    </h1>
                    <p className="text-muted-foreground mt-2 text-sm leading-6">
                        Review lift-plan approvals, toolbox meeting records,
                        site hazards, and active stop-work orders.
                    </p>
                </div>
                <Button
                    variant="secondary"
                    onClick={() => void loadData()}
                    disabled={loading || actionBusy !== null}
                >
                    Refresh records
                </Button>
            </header>

            {error && (
                <div
                    role="alert"
                    className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger"
                >
                    <p>{error}</p>
                    <button
                        className="mt-2 font-semibold underline"
                        onClick={() => void loadData()}
                    >
                        Retry loading safety records
                    </button>
                </div>
            )}
            {success && (
                <div
                    role="status"
                    className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success"
                >
                    {success}
                </div>
            )}

            {loading && !data ? (
                <Panel>
                    <p role="status" aria-live="polite">
                        Loading current safety records…
                    </p>
                </Panel>
            ) : data ? (
                <>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {metricCards.map((card) => (
                            <Panel key={card.label} className="min-w-0">
                                <p className="text-muted-foreground text-sm font-medium">
                                    {card.label}
                                </p>
                                <p className="text-foreground mt-2 text-3xl font-semibold tabular-nums">
                                    {card.value}
                                </p>
                                <p className="text-muted-foreground mt-1 text-xs">
                                    {card.detail}
                                </p>
                            </Panel>
                        ))}
                    </div>

                    <Panel>
                        <h2 className="text-foreground text-base font-semibold">
                            Metrics that are not verified yet
                        </h2>
                        <p className="text-muted-foreground mt-1 text-sm">
                            Safe work hours and days since a recordable incident
                            are hidden until verified hour and incident records
                            are connected. Toolbox attendance is not used as a
                            substitute for either figure.
                        </p>
                        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                            <div>
                                <dt className="text-foreground font-medium">
                                    Safe work hours
                                </dt>
                                <dd className="text-muted-foreground">
                                    Not available
                                </dd>
                            </div>
                            <div>
                                <dt className="text-foreground font-medium">
                                    Days since a recordable incident
                                </dt>
                                <dd className="text-muted-foreground">
                                    Not available
                                </dd>
                            </div>
                        </dl>
                    </Panel>

                    <nav
                        aria-label="Safety governance sections"
                        role="tablist"
                        className="flex gap-2 overflow-x-auto border-b border-line pb-2"
                    >
                        {TABS.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                role="tab"
                                id={`safety-tab-${item.id}`}
                                aria-selected={tab === item.id}
                                aria-controls="safety-tab-panel"
                                onClick={() => setTab(item.id)}
                                className={`focus-visible:outline-primary min-h-11 shrink-0 rounded-lg px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 ${tab === item.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-surface-subtle'}`}
                            >
                                {item.label}
                            </button>
                        ))}
                    </nav>

                    <div
                        id="safety-tab-panel"
                        role="tabpanel"
                        aria-labelledby={`safety-tab-${tab}`}
                        className="space-y-4"
                    >
                        {tab === 'overview' && (
                            <div className="grid gap-4 xl:grid-cols-2">
                                <Panel>
                                    <h2 className="text-foreground text-base font-semibold">
                                        Current work stoppages
                                    </h2>
                                    {data.workStoppages.filter(
                                        (notice) => notice.is_active,
                                    ).length === 0 ? (
                                        <p className="text-muted-foreground mt-3 text-sm">
                                            No active stop-work orders are
                                            recorded.
                                        </p>
                                    ) : (
                                        <ul className="mt-3 space-y-3">
                                            {data.workStoppages
                                                .filter(
                                                    (notice) =>
                                                        notice.is_active,
                                                )
                                                .map((notice) => (
                                                    <li
                                                        key={notice.id}
                                                        className="rounded-lg border border-danger/30 bg-danger/5 p-3"
                                                    >
                                                        <p className="text-foreground font-semibold">
                                                            {
                                                                notice.notice_number
                                                            }{' '}
                                                            ·{' '}
                                                            {
                                                                notice.project_site
                                                            }
                                                        </p>
                                                        <p className="text-foreground mt-1 text-sm">
                                                            {notice.reason}
                                                        </p>
                                                        <p className="text-muted-foreground mt-1 text-xs">
                                                            Area:{' '}
                                                            {
                                                                notice.affected_area
                                                            }{' '}
                                                            · Issued by{' '}
                                                            {notice.issuer_name}
                                                        </p>
                                                    </li>
                                                ))}
                                        </ul>
                                    )}
                                </Panel>
                                <Panel>
                                    <h2 className="text-foreground text-base font-semibold">
                                        Next reviews
                                    </h2>
                                    <ul className="text-muted-foreground mt-3 space-y-2 text-sm">
                                        <li>
                                            {
                                                data.metrics
                                                    .pending_critical_lifts
                                            }{' '}
                                            lift plan(s) need an Operations
                                            Manager decision.
                                        </li>
                                        <li>
                                            {data.metrics.open_hazards} hazard
                                            report(s) need corrective action.
                                        </li>
                                        <li>
                                            {
                                                data.toolboxMeetings.filter(
                                                    (meeting) =>
                                                        !meeting.safety_officer_signed_at,
                                                ).length
                                            }{' '}
                                            toolbox meeting(s) need a manager
                                            co-sign.
                                        </li>
                                    </ul>
                                </Panel>
                            </div>
                        )}

                        {tab === 'lift-plans' && (
                            <div className="space-y-3">
                                <p className="text-muted-foreground text-sm">
                                    Review the load, crane capacity, site
                                    conditions, and wind record before
                                    authorizing. Authorization is written to the
                                    audit trail and is required by the dispatch
                                    safety gate.
                                </p>
                                {data.liftPlans.length === 0 ? (
                                    <EmptyMessage
                                        title="No lift plans recorded"
                                        message="Submitted plans will appear here for review."
                                    />
                                ) : (
                                    data.liftPlans.map((plan) => (
                                        <Panel key={plan.id}>
                                            <div className="flex flex-wrap justify-between gap-2">
                                                <div>
                                                    <h2 className="text-foreground font-semibold">
                                                        {plan.lift_reference} ·{' '}
                                                        {plan.project_site}
                                                    </h2>
                                                    <p className="text-muted-foreground mt-1 text-sm">
                                                        {statusLabel(
                                                            plan.status,
                                                        )}{' '}
                                                        ·{' '}
                                                        {statusLabel(
                                                            plan.risk_level,
                                                        )}
                                                    </p>
                                                </div>
                                                <p className="text-muted-foreground text-sm">
                                                    Submitted{' '}
                                                    {formatWhen(
                                                        plan.created_at,
                                                    )}
                                                </p>
                                            </div>
                                            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
                                                <SafetyField
                                                    label="Load / rated capacity"
                                                    value={`${plan.gross_load_weight_tons} t / ${plan.crane_rated_capacity_tons} t (${plan.load_percentage_of_capacity}%)`}
                                                />
                                                <SafetyField
                                                    label="Boom / working radius"
                                                    value={`${plan.boom_length_meters} m / ${plan.working_radius_meters} m`}
                                                />
                                                <SafetyField
                                                    label="Ground bearing"
                                                    value={
                                                        plan.ground_bearing_condition
                                                    }
                                                />
                                                <SafetyField
                                                    label="Wind recorded"
                                                    value={
                                                        plan.weather_wind_speed_kph ===
                                                        null
                                                            ? 'Not recorded'
                                                            : `${plan.weather_wind_speed_kph} km/h`
                                                    }
                                                />
                                                <SafetyField
                                                    label="Operator / rigger"
                                                    value={`${plan.operator_name ?? 'Not assigned'} / ${plan.rigger_name ?? 'Not assigned'}`}
                                                />
                                            </dl>
                                            {plan.rejection_reason && (
                                                <p className="text-foreground mt-3 rounded-md bg-warning/10 p-3 text-sm">
                                                    Previous decision:{' '}
                                                    {plan.rejection_reason}
                                                </p>
                                            )}
                                            {plan.status ===
                                                'pending_so_review' &&
                                                capabilities.safety_lift_plan_approve && (
                                                    <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-line pt-4">
                                                        <Button
                                                            disabled={
                                                                actionBusy !==
                                                                null
                                                            }
                                                            onClick={() => {
                                                                if (
                                                                    !window.confirm(
                                                                        `Authorize ${plan.lift_reference} for dispatch review?`,
                                                                    )
                                                                ) {
                                                                    return;
                                                                }

                                                                void submit(
                                                                    `lift-approve-${plan.id}`,
                                                                    `${API_PATHS.liftPlans}/${plan.id}/authorize`,
                                                                    {
                                                                        decision:
                                                                            'approve',
                                                                    },
                                                                    `${plan.lift_reference} authorized.`,
                                                                );
                                                            }}
                                                        >
                                                            Authorize lift plan
                                                        </Button>
                                                        <form
                                                            className="flex min-w-60 flex-1 items-end gap-2"
                                                            onSubmit={(
                                                                event,
                                                            ) => {
                                                                event.preventDefault();
                                                                const reason =
                                                                    new FormData(
                                                                        event.currentTarget,
                                                                    )
                                                                        .get(
                                                                            'reason',
                                                                        )
                                                                        ?.toString() ??
                                                                    '';
                                                                void submit(
                                                                    `lift-reject-${plan.id}`,
                                                                    `${API_PATHS.liftPlans}/${plan.id}/authorize`,
                                                                    {
                                                                        decision:
                                                                            'reject',
                                                                        reason,
                                                                    },
                                                                    `${plan.lift_reference} rejected with a recorded reason.`,
                                                                );
                                                            }}
                                                        >
                                                            <label
                                                                className={`${labelClassName} flex-1`}
                                                                htmlFor={`lift-reject-reason-${plan.id}`}
                                                            >
                                                                Reason to reject
                                                            </label>
                                                            <textarea
                                                                className={
                                                                    inputClassName
                                                                }
                                                                id={`lift-reject-reason-${plan.id}`}
                                                                name="reason"
                                                                required
                                                                minLength={3}
                                                                placeholder="Record the condition that must be corrected"
                                                            />
                                                            <Button
                                                                type="submit"
                                                                variant="secondary"
                                                                disabled={
                                                                    actionBusy !==
                                                                    null
                                                                }
                                                            >
                                                                Reject plan
                                                            </Button>
                                                        </form>
                                                    </div>
                                                )}
                                        </Panel>
                                    ))
                                )}
                            </div>
                        )}

                        {tab === 'toolbox' && (
                            <div className="space-y-3">
                                <p className="text-muted-foreground text-sm">
                                    Confirm the submitted briefing and attendee
                                    count before recording a manager co-sign.
                                </p>
                                {data.toolboxMeetings.length === 0 ? (
                                    <EmptyMessage
                                        title="No toolbox meetings recorded"
                                        message="Submitted daily meetings will appear here."
                                    />
                                ) : (
                                    data.toolboxMeetings.map((meeting) => (
                                        <Panel key={meeting.id}>
                                            <div className="flex flex-wrap justify-between gap-2">
                                                <div>
                                                    <h2 className="text-foreground font-semibold">
                                                        {meeting.topic_title}
                                                    </h2>
                                                    <p className="text-muted-foreground mt-1 text-sm">
                                                        {meeting.project_site} ·{' '}
                                                        {meeting.topic_category}
                                                    </p>
                                                </div>
                                                <p className="text-muted-foreground text-sm">
                                                    {formatWhen(
                                                        meeting.created_at,
                                                    )}
                                                </p>
                                            </div>
                                            <p className="text-foreground mt-3 text-sm">
                                                Led by {meeting.conductor_name}{' '}
                                                · {meeting.attendee_count}{' '}
                                                attendee(s)
                                            </p>
                                            {meeting.notes && (
                                                <p className="text-muted-foreground mt-2 text-sm">
                                                    {meeting.notes}
                                                </p>
                                            )}
                                            {meeting.audit_hash && (
                                                <p className="text-muted-foreground mt-2 text-xs break-all">
                                                    Audit hash:{' '}
                                                    <code>
                                                        {meeting.audit_hash}
                                                    </code>
                                                </p>
                                            )}
                                            {meeting.safety_officer_signed_at ? (
                                                <p className="mt-3 text-sm text-success">
                                                    Co-signed{' '}
                                                    {formatWhen(
                                                        meeting.safety_officer_signed_at,
                                                    )}
                                                </p>
                                            ) : capabilities.safety_tbm_cosign ? (
                                                <Button
                                                    className="mt-3"
                                                    disabled={
                                                        actionBusy !== null
                                                    }
                                                    onClick={() => {
                                                        if (
                                                            !window.confirm(
                                                                'Record your account as the manager co-signer for this toolbox meeting?',
                                                            )
                                                        ) {
                                                            return;
                                                        }

                                                        void submit(
                                                            `tbm-cosign-${meeting.id}`,
                                                            `${API_PATHS.toolboxMeetings}/${meeting.id}/cosign`,
                                                            {},
                                                            'Toolbox meeting co-signed under your account.',
                                                        );
                                                    }}
                                                >
                                                    Co-sign meeting
                                                </Button>
                                            ) : (
                                                <p className="mt-3 text-sm text-warning">
                                                    Awaiting manager co-sign
                                                </p>
                                            )}
                                        </Panel>
                                    ))
                                )}
                            </div>
                        )}

                        {tab === 'hazards' && (
                            <div className="space-y-4">
                                {pendingPhotoUpload && (
                                    <Panel>
                                        <h2 className="text-foreground font-semibold">
                                            Photos still need to upload
                                        </h2>
                                        <p className="text-muted-foreground mt-1 text-sm">
                                            {pendingPhotoUpload.ticketCode} is
                                            saved. Keep this page open and retry
                                            the private photo upload; the hazard
                                            report will not be duplicated.
                                        </p>
                                        <Button
                                            className="mt-3"
                                            onClick={() =>
                                                void retryHazardPhotoUpload()
                                            }
                                            disabled={actionBusy !== null}
                                        >
                                            {actionBusy === 'hazard-photo-retry'
                                                ? 'Retrying photo upload…'
                                                : 'Retry photo upload'}
                                        </Button>
                                    </Panel>
                                )}
                                {capabilities.safety_hazard_report && (
                                    <Panel>
                                        <h2 className="text-foreground text-base font-semibold">
                                            Report a site hazard
                                        </h2>
                                        <p className="text-muted-foreground mt-1 text-sm">
                                            Describe what was observed, where it
                                            is, and the corrective action
                                            needed. If anyone is in immediate
                                            danger, issue a separate stop-work
                                            order.
                                        </p>
                                        <form
                                            className="mt-4 grid gap-4 md:grid-cols-2"
                                            onSubmit={(event) =>
                                                void createHazard(event)
                                            }
                                        >
                                            <label className={labelClassName}>
                                                Project site
                                                <input
                                                    className={inputClassName}
                                                    name="project_site"
                                                    required
                                                    maxLength={255}
                                                />
                                            </label>
                                            <label className={labelClassName}>
                                                Hazard category
                                                <select
                                                    className={inputClassName}
                                                    name="category"
                                                    required
                                                    defaultValue="rigging_tackle"
                                                >
                                                    <option value="rigging_tackle">
                                                        Rigging and lifting
                                                        equipment
                                                    </option>
                                                    <option value="equipment">
                                                        Equipment condition
                                                    </option>
                                                    <option value="site_environment">
                                                        Site environment
                                                    </option>
                                                    <option value="electrical">
                                                        Electrical hazard
                                                    </option>
                                                    <option value="other">
                                                        Other
                                                    </option>
                                                </select>
                                            </label>
                                            <label className={labelClassName}>
                                                Severity
                                                <select
                                                    className={inputClassName}
                                                    name="severity"
                                                    required
                                                    defaultValue="medium"
                                                >
                                                    <option value="low">
                                                        Low
                                                    </option>
                                                    <option value="medium">
                                                        Medium
                                                    </option>
                                                    <option value="high">
                                                        High
                                                    </option>
                                                    <option value="critical">
                                                        Critical
                                                    </option>
                                                </select>
                                            </label>
                                            <label className={labelClassName}>
                                                Location detail
                                                <input
                                                    className={inputClassName}
                                                    name="location_detail"
                                                    required
                                                    maxLength={255}
                                                    placeholder="Grid, bay, floor, or landmark"
                                                />
                                            </label>
                                            <label
                                                className={`${labelClassName} md:col-span-2`}
                                            >
                                                What did you observe?
                                                <textarea
                                                    className={inputClassName}
                                                    name="description"
                                                    required
                                                    minLength={10}
                                                    rows={3}
                                                />
                                            </label>
                                            <label
                                                className={`${labelClassName} md:col-span-2`}
                                            >
                                                Corrective action needed
                                                <textarea
                                                    className={inputClassName}
                                                    name="corrective_action_required"
                                                    required
                                                    minLength={5}
                                                    rows={2}
                                                />
                                            </label>
                                            <div className="flex flex-wrap items-center gap-3 md:col-span-2">
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    onClick={
                                                        captureHazardLocation
                                                    }
                                                >
                                                    Add current GPS location
                                                </Button>
                                                <p
                                                    className="text-muted-foreground text-xs"
                                                    aria-live="polite"
                                                >
                                                    {hazardLocation
                                                        ? `GPS saved: ${hazardLocation.latitude.toFixed(5)}, ${hazardLocation.longitude.toFixed(5)}${hazardLocation.accuracy === null ? '' : ` (±${Math.round(hazardLocation.accuracy)} m)`}`
                                                        : 'GPS is optional if the device cannot capture it.'}
                                                </p>
                                            </div>
                                            <label
                                                className={`${labelClassName} md:col-span-2`}
                                            >
                                                Photo evidence (optional)
                                                <input
                                                    className={inputClassName}
                                                    type="file"
                                                    name="photo_files"
                                                    accept="image/jpeg,image/png,image/heic,image/heif"
                                                    multiple
                                                    disabled={
                                                        pendingPhotoUpload !==
                                                        null
                                                    }
                                                />
                                                <span className="text-muted-foreground mt-1 block text-xs font-normal">
                                                    Add up to 4 JPEG, PNG, or
                                                    HEIC photos, 15 MB each.
                                                    Photos are stored privately.
                                                </span>
                                            </label>
                                            <div className="md:col-span-2">
                                                <Button
                                                    type="submit"
                                                    disabled={
                                                        actionBusy !== null ||
                                                        pendingPhotoUpload !==
                                                            null
                                                    }
                                                >
                                                    {actionBusy ===
                                                    'hazard-create'
                                                        ? 'Saving report…'
                                                        : 'Save hazard report'}
                                                </Button>
                                            </div>
                                        </form>
                                    </Panel>
                                )}
                                {data.hazards.length === 0 ? (
                                    <EmptyMessage
                                        title="No hazard reports recorded"
                                        message="Submitted reports will appear here."
                                    />
                                ) : (
                                    data.hazards.map((hazard) => (
                                        <Panel key={hazard.id}>
                                            <div className="flex flex-wrap justify-between gap-2">
                                                <div>
                                                    <h2 className="text-foreground font-semibold">
                                                        {hazard.ticket_code} ·{' '}
                                                        {hazard.project_site}
                                                    </h2>
                                                    <p className="text-muted-foreground mt-1 text-sm">
                                                        {statusLabel(
                                                            hazard.severity,
                                                        )}{' '}
                                                        ·{' '}
                                                        {statusLabel(
                                                            hazard.status,
                                                        )}{' '}
                                                        · {hazard.category}
                                                    </p>
                                                </div>
                                                <p className="text-muted-foreground text-sm">
                                                    Reported{' '}
                                                    {formatWhen(
                                                        hazard.created_at,
                                                    )}
                                                </p>
                                            </div>
                                            <p className="text-foreground mt-3 text-sm">
                                                {hazard.description}
                                            </p>
                                            <p className="text-muted-foreground mt-1 text-sm">
                                                Location:{' '}
                                                {hazard.location_detail}
                                            </p>
                                            <p className="text-muted-foreground mt-1 text-sm">
                                                Corrective action:{' '}
                                                {
                                                    hazard.corrective_action_required
                                                }
                                            </p>
                                            {hazard.location_latitude !==
                                                null &&
                                                hazard.location_longitude !==
                                                    null && (
                                                    <p className="text-muted-foreground mt-1 text-xs">
                                                        GPS:{' '}
                                                        {hazard.location_latitude.toFixed(
                                                            5,
                                                        )}
                                                        ,{' '}
                                                        {hazard.location_longitude.toFixed(
                                                            5,
                                                        )}
                                                        {hazard.location_accuracy_metres ===
                                                        null
                                                            ? ''
                                                            : ` · ±${Math.round(hazard.location_accuracy_metres)} m`}
                                                    </p>
                                                )}
                                            {hazard.photo_attachments &&
                                                hazard.photo_attachments
                                                    .length > 0 && (
                                                    <div className="mt-3">
                                                        <p className="text-foreground text-sm font-medium">
                                                            Photo evidence
                                                        </p>
                                                        <ul className="mt-1 flex flex-wrap gap-3 text-sm">
                                                            {hazard.photo_attachments.map(
                                                                (photo) => (
                                                                    <li
                                                                        key={
                                                                            photo.id
                                                                        }
                                                                    >
                                                                        <a
                                                                            className="text-primary underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2"
                                                                            href={
                                                                                photo.download_url
                                                                            }
                                                                            target="_blank"
                                                                            rel="noreferrer"
                                                                        >
                                                                            View{' '}
                                                                            {
                                                                                photo.original_filename
                                                                            }
                                                                        </a>
                                                                    </li>
                                                                ),
                                                            )}
                                                        </ul>
                                                    </div>
                                                )}
                                            {hazard.rectification_notes && (
                                                <p className="text-muted-foreground mt-2 text-sm">
                                                    Correction recorded:{' '}
                                                    {hazard.rectification_notes}
                                                </p>
                                            )}
                                            {hazard.status === 'open' &&
                                                capabilities.safety_hazard_rectify && (
                                                    <form
                                                        className="mt-3 flex flex-wrap items-end gap-3"
                                                        onSubmit={(event) => {
                                                            event.preventDefault();
                                                            const notes =
                                                                new FormData(
                                                                    event.currentTarget,
                                                                )
                                                                    .get(
                                                                        'rectification_notes',
                                                                    )
                                                                    ?.toString() ??
                                                                '';

                                                            if (
                                                                !window.confirm(
                                                                    `Mark ${hazard.ticket_code} rectified with this correction record?`,
                                                                )
                                                            ) {
                                                                return;
                                                            }

                                                            void submit(
                                                                `hazard-rectify-${hazard.id}`,
                                                                `${API_PATHS.hazards}/${hazard.id}/rectify`,
                                                                {
                                                                    rectification_notes:
                                                                        notes,
                                                                },
                                                                `${hazard.ticket_code} marked rectified.`,
                                                            );
                                                        }}
                                                    >
                                                        <label
                                                            className={`${labelClassName} min-w-60 flex-1`}
                                                        >
                                                            Correction and
                                                            verification
                                                            <textarea
                                                                className={
                                                                    inputClassName
                                                                }
                                                                name="rectification_notes"
                                                                required
                                                                minLength={5}
                                                                maxLength={2000}
                                                                rows={2}
                                                                placeholder="Describe what changed and how it was checked"
                                                            />
                                                        </label>
                                                        <Button
                                                            type="submit"
                                                            variant="secondary"
                                                            disabled={
                                                                actionBusy !==
                                                                null
                                                            }
                                                        >
                                                            Mark corrective
                                                            action complete
                                                        </Button>
                                                    </form>
                                                )}
                                        </Panel>
                                    ))
                                )}
                            </div>
                        )}

                        {tab === 'stoppages' && (
                            <div className="space-y-4">
                                {capabilities.safety_work_stoppage_issue && (
                                    <Panel>
                                        <h2 className="text-foreground text-base font-semibold">
                                            Issue a stop-work order
                                        </h2>
                                        <p className="text-muted-foreground mt-1 text-sm">
                                            Any field worker can stop unsafe
                                            work. A stop-work order blocks
                                            dispatch status progression at this
                                            site until an Operations Manager
                                            records a verified lift reason.
                                        </p>
                                        <form
                                            className="mt-4 grid gap-4 md:grid-cols-2"
                                            onSubmit={(event) =>
                                                void createStoppage(event)
                                            }
                                        >
                                            <label className={labelClassName}>
                                                Project site
                                                <input
                                                    className={inputClassName}
                                                    name="project_site"
                                                    required
                                                    maxLength={255}
                                                />
                                            </label>
                                            <label className={labelClassName}>
                                                Affected area
                                                <input
                                                    className={inputClassName}
                                                    name="affected_area"
                                                    required
                                                    maxLength={255}
                                                    placeholder="Grid, bay, floor, or work zone"
                                                />
                                            </label>
                                            <label
                                                className={`${labelClassName} md:col-span-2`}
                                            >
                                                Reason work must stop
                                                <textarea
                                                    className={inputClassName}
                                                    name="reason"
                                                    required
                                                    minLength={10}
                                                    rows={3}
                                                />
                                            </label>
                                            <label
                                                className={`${labelClassName} md:col-span-2`}
                                            >
                                                Regulation reference (optional)
                                                <input
                                                    className={inputClassName}
                                                    name="dole_regulation_reference"
                                                    maxLength={128}
                                                    placeholder="Leave blank if unsure"
                                                />
                                            </label>
                                            <div className="md:col-span-2">
                                                <Button
                                                    type="submit"
                                                    disabled={
                                                        actionBusy !== null
                                                    }
                                                >
                                                    {actionBusy ===
                                                    'stoppage-create'
                                                        ? 'Issuing order…'
                                                        : 'Issue stop-work order'}
                                                </Button>
                                            </div>
                                        </form>
                                    </Panel>
                                )}
                                {data.workStoppages.length === 0 ? (
                                    <EmptyMessage
                                        title="No stop-work orders recorded"
                                        message="Orders issued for a site will appear here."
                                    />
                                ) : (
                                    data.workStoppages.map((notice) => (
                                        <Panel key={notice.id}>
                                            <div className="flex flex-wrap justify-between gap-2">
                                                <div>
                                                    <h2 className="text-foreground font-semibold">
                                                        {notice.notice_number} ·{' '}
                                                        {notice.project_site}
                                                    </h2>
                                                    <p
                                                        className={`mt-1 text-sm font-medium ${notice.is_active ? 'text-danger' : 'text-success'}`}
                                                    >
                                                        {notice.is_active
                                                            ? 'Active — work remains paused'
                                                            : `Lifted ${formatWhen(notice.lifted_at)}`}
                                                    </p>
                                                </div>
                                                <p className="text-muted-foreground text-sm">
                                                    Issued{' '}
                                                    {formatWhen(
                                                        notice.created_at,
                                                    )}
                                                </p>
                                            </div>
                                            <p className="text-foreground mt-3 text-sm">
                                                {notice.reason}
                                            </p>
                                            <p className="text-muted-foreground mt-1 text-sm">
                                                Affected area:{' '}
                                                {notice.affected_area} · Issued
                                                by {notice.issuer_name}
                                            </p>
                                            {notice.lift_reason && (
                                                <p className="text-muted-foreground mt-2 text-sm">
                                                    Lift reason:{' '}
                                                    {notice.lift_reason}
                                                </p>
                                            )}
                                            {notice.is_active &&
                                                capabilities.safety_work_stoppage_lift && (
                                                    <form
                                                        className="mt-4 flex flex-wrap items-end gap-3 border-t border-line pt-4"
                                                        onSubmit={(event) => {
                                                            event.preventDefault();
                                                            const reason =
                                                                new FormData(
                                                                    event.currentTarget,
                                                                )
                                                                    .get(
                                                                        'lift_reason',
                                                                    )
                                                                    ?.toString() ??
                                                                '';

                                                            if (
                                                                !window.confirm(
                                                                    `Lift ${notice.notice_number} after recording the verification reason?`,
                                                                )
                                                            ) {
                                                                return;
                                                            }

                                                            void submit(
                                                                `stoppage-lift-${notice.id}`,
                                                                `${API_PATHS.workStoppages}/${notice.id}/lift`,
                                                                {
                                                                    lift_reason:
                                                                        reason,
                                                                },
                                                                `${notice.notice_number} lifted with a recorded verification reason.`,
                                                            );
                                                        }}
                                                    >
                                                        <label
                                                            className={`${labelClassName} min-w-60 flex-1`}
                                                        >
                                                            Verified correction
                                                            and lift reason
                                                            <textarea
                                                                className={
                                                                    inputClassName
                                                                }
                                                                name="lift_reason"
                                                                required
                                                                minLength={5}
                                                                rows={2}
                                                                placeholder="Describe the repair and verification completed"
                                                            />
                                                        </label>
                                                        <Button
                                                            type="submit"
                                                            variant="secondary"
                                                            disabled={
                                                                actionBusy !==
                                                                null
                                                            }
                                                        >
                                                            Lift order
                                                        </Button>
                                                    </form>
                                                )}
                                        </Panel>
                                    ))
                                )}
                            </div>
                        )}

                        {tab === 'exports' && (
                            <Panel>
                                <h2 className="text-foreground text-base font-semibold">
                                    Available safety exports
                                </h2>
                                <p className="text-muted-foreground mt-1 text-sm">
                                    Open Reports to generate the currently
                                    configured DOLE WAIR and CSHP Safe Man-Hours
                                    exports. Figures marked unavailable above
                                    are not replaced with estimates.
                                </p>
                                <Button
                                    className="mt-4"
                                    onClick={() => onSectionChange?.('reports')}
                                >
                                    Open reports and exports
                                </Button>
                            </Panel>
                        )}
                    </div>
                </>
            ) : null}
        </section>
    );
}

function SafetyField({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-foreground mt-1 font-medium">{value}</dd>
        </div>
    );
}

function EmptyMessage({ title, message }: { title: string; message: string }) {
    return (
        <Panel>
            <h2 className="text-foreground font-semibold">{title}</h2>
            <p className="text-muted-foreground mt-1 text-sm">{message}</p>
        </Panel>
    );
}
