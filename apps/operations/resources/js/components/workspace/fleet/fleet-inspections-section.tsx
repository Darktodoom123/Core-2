import { useForm } from '@inertiajs/react';
import {
    AlertTriangle,
    Camera,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    ClipboardCheck,
    RefreshCw,
    Wrench,
} from 'lucide-react';
import type { FormEvent } from 'react';
import React, { useState } from 'react';
import { Button, InlineNotice, Modal } from '@/components/ui';
import { DvirStatusBadge } from '@/components/workspace/fleet/dvir-status-badge';
import { FleetInput } from '@/components/workspace/fleet/fleet-input';
import { formatDateTime, humanize } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type {
    AssetViewModel,
    DvirInspectionViewModel,
    InspectionResultValue,
    InspectionTypeValue,
} from '@/types/workspace';

export interface FleetInspectionsSectionProps {
    asset: AssetViewModel;
    canInspect: boolean;
    onViewDvir?: (dvir: DvirInspectionViewModel) => void;
}

type DvirHistoryFilter = 'all' | 'needs_attention' | 'pre_trip' | 'post_trip';
type DvirHistoryRange = 'all' | '7' | '30' | '90' | '365';
type InspectionSource = 'field' | 'workshop';

interface DvirHistoryCursor {
    before_id: number;
    before_completed_at: string;
}

interface DvirHistoryResponse {
    data: DvirInspectionViewModel[];
    meta: {
        total: number;
        has_more: boolean;
        next: DvirHistoryCursor | null;
    };
}

const DVIR_HISTORY_PAGE_SIZE = 15;

function initialDvirRecords(asset: AssetViewModel): DvirInspectionViewModel[] {
    if (asset.dvir_inspections && asset.dvir_inspections.length > 0) {
        return asset.dvir_inspections;
    }

    if (!asset.latest_dvir) {
        return [];
    }

    return [
        {
            id: asset.latest_dvir.id,
            reference: `DVIR-${String(asset.latest_dvir.id).padStart(6, '0')}`,
            inspection_type: asset.latest_dvir.type,
            type: asset.latest_dvir.type,
            status: asset.latest_dvir.status,
            has_defects: asset.latest_dvir.has_defects,
            critical_defects_count: asset.latest_dvir.critical_defects_count,
            completed_at: asset.latest_dvir.completed_at,
            received_at: asset.latest_dvir.received_at,
            inspector_name: asset.latest_dvir.inspector_name,
            photos: asset.latest_dvir.photos ?? [],
        },
    ];
}

function cursorAfter(
    records: DvirInspectionViewModel[],
): DvirHistoryCursor | null {
    const last = records.at(-1);

    return last?.completed_at
        ? {
              before_id: last.id,
              before_completed_at: last.completed_at,
          }
        : null;
}

function isDvirAttention(dvir: DvirInspectionViewModel): boolean {
    return (
        dvir.has_defects ||
        dvir.critical_defects_count > 0 ||
        dvir.status === 'defect_flagged' ||
        dvir.status === 'critical_defect'
    );
}

function dvirTypeLabel(dvir: DvirInspectionViewModel): string {
    return dvir.type === 'post_trip' || dvir.inspection_type === 'post_trip'
        ? 'Post-trip'
        : 'Pre-trip';
}

function recordCountLabel(count: number): string {
    return `${count} ${count === 1 ? 'record' : 'records'}`;
}

export function FleetInspectionsSection({
    asset,
    canInspect,
    onViewDvir,
}: FleetInspectionsSectionProps) {
    const [showForm, setShowForm] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const form = useForm<{
        type: InspectionTypeValue | '';
        result: InspectionResultValue | '';
        checklist: Record<string, boolean>;
        findings: string;
    }>({
        type: '',
        result: '',
        checklist: {
            brakes: true,
            steering: true,
            tires_or_tracks: true,
            hydraulics: true,
            lights_and_signals: true,
        },
        findings: '',
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();

        if (!form.data.type) {
            form.setError('type', 'Choose an inspection type.');

            return;
        }

        if (!form.data.result) {
            form.setError('result', 'Choose the inspection result.');

            return;
        }

        form.post(`/operations/assets/${asset.id}/inspections`, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => {
                setShowForm(false);
                form.reset();
                setSuccessMessage('Inspection record saved.');
            },
        });
    };

    const initialRecords = initialDvirRecords(asset);
    const dvirCount = asset.dvir_inspections_count ?? null;
    const workshopInspectionCount = asset.inspections_count ?? null;
    const latestWorkshopInspection = [...asset.inspections].sort((a, b) => {
        const aTime = a.completed_at ? Date.parse(a.completed_at) : 0;
        const bTime = b.completed_at ? Date.parse(b.completed_at) : 0;

        return bTime - aTime || b.id - a.id;
    })[0];
    const initialSource: InspectionSource =
        (dvirCount ?? initialRecords.length) > 0
            ? 'field'
            : (workshopInspectionCount ?? asset.inspections.length) > 0
              ? 'workshop'
              : 'field';
    const [activeSource, setActiveSource] = useState<{
        assetId: number;
        source: InspectionSource;
    } | null>(null);
    const selectedSource =
        activeSource?.assetId === asset.id
            ? activeSource.source
            : initialSource;
    const [dvirFilter, setDvirFilter] = useState<DvirHistoryFilter>('all');
    const [dvirRange, setDvirRange] = useState<DvirHistoryRange>('all');
    const [dvirInspections, setDvirInspections] =
        useState<DvirInspectionViewModel[]>(initialRecords);
    const [dvirTotal, setDvirTotal] = useState<number | null>(dvirCount);
    const [nextCursor, setNextCursor] = useState<DvirHistoryCursor | null>(
        dvirCount !== null && dvirCount > initialRecords.length
            ? cursorAfter(initialRecords)
            : null,
    );
    const [expandedDvirId, setExpandedDvirId] = useState<number | null>(null);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyError, setHistoryError] = useState<string | null>(null);

    const loadDvirHistory = async ({
        filter = dvirFilter,
        range = dvirRange,
        append = false,
    }: {
        filter?: DvirHistoryFilter;
        range?: DvirHistoryRange;
        append?: boolean;
    } = {}) => {
        setHistoryLoading(true);
        setHistoryError(null);

        const params = new URLSearchParams({
            limit: String(DVIR_HISTORY_PAGE_SIZE),
        });

        if (filter !== 'all') {
            params.set('filter', filter);
        }

        if (range !== 'all') {
            params.set('days', range);
        }

        if (append && nextCursor) {
            params.set('before_id', String(nextCursor.before_id));
            params.set('before_completed_at', nextCursor.before_completed_at);
        }

        try {
            const response = await fetch(
                `/operations/assets/${asset.id}/dvir-history?${params.toString()}`,
                {
                    headers: { Accept: 'application/json' },
                    credentials: 'same-origin',
                },
            );
            const body = (await response.json().catch(() => null)) as
                DvirHistoryResponse | { message?: string } | null;

            if (!response.ok || !body || !('data' in body)) {
                throw new Error(
                    body && 'message' in body && body.message
                        ? body.message
                        : 'Unable to load DVIR history. Try again.',
                );
            }

            const incoming = body.data;
            setDvirInspections((current) => {
                if (!append) {
                    return incoming;
                }

                const byId = new Map(
                    [...current, ...incoming].map((dvir) => [dvir.id, dvir]),
                );

                return [...byId.values()].sort((a, b) => {
                    const aTime = a.completed_at
                        ? Date.parse(a.completed_at)
                        : 0;
                    const bTime = b.completed_at
                        ? Date.parse(b.completed_at)
                        : 0;

                    return bTime - aTime || b.id - a.id;
                });
            });
            setDvirTotal(body.meta.total);
            setNextCursor(body.meta.next);
        } catch (error) {
            setHistoryError(
                error instanceof Error
                    ? error.message
                    : 'Unable to load DVIR history. Try again.',
            );
        } finally {
            setHistoryLoading(false);
        }
    };

    const hasAnyInspections =
        (dvirCount ?? 0) > 0 ||
        initialRecords.length > 0 ||
        (workshopInspectionCount ?? asset.inspections.length) > 0;

    const openInspectionDialog = () => {
        setSuccessMessage(null);
        form.clearErrors();
        setShowForm(true);
    };

    const closeInspectionDialog = () => {
        setShowForm(false);
    };

    return (
        <div className="space-y-7">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
                <div className="min-w-0">
                    <h3 className="text-base font-semibold text-ink">
                        Inspection history
                    </h3>
                    <p className="mt-1 max-w-2xl text-sm leading-5 text-ink-soft">
                        Review field reports and workshop checks for this asset.
                    </p>
                </div>
                {canInspect && (
                    <Button
                        variant="primary"
                        size="sm"
                        onClick={openInspectionDialog}
                        className="shrink-0"
                    >
                        <ClipboardCheck className="mr-1.5 h-3.5 w-3.5" />
                        Record workshop inspection
                    </Button>
                )}
            </div>

            {successMessage && (
                <InlineNotice tone="success" title={successMessage} />
            )}

            <section
                aria-label="Inspection status overview"
                className="overflow-hidden rounded-lg border border-line bg-surface"
            >
                <div className="grid md:grid-cols-2 md:divide-x md:divide-line">
                    <div className="p-4 sm:p-5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <h4 className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
                                Latest field DVIR
                            </h4>
                            <span
                                className="text-xs font-semibold text-ink-soft tabular-nums"
                                aria-live="polite"
                            >
                                {dvirTotal === null
                                    ? 'Total unavailable'
                                    : `${dvirTotal} total records`}
                            </span>
                        </div>
                        <div className="mt-3">
                            {asset.latest_dvir ? (
                                <DvirStatusBadge
                                    dvir={asset.latest_dvir}
                                    compact
                                />
                            ) : (
                                <p className="text-sm font-semibold text-ink">
                                    No field DVIR received
                                </p>
                            )}
                            <p className="mt-1 text-xs text-ink-soft">
                                {asset.latest_dvir
                                    ? formatDateTime(
                                          asset.latest_dvir.completed_at,
                                          'Completion time not recorded',
                                      )
                                    : 'Awaiting a mobile submission'}
                            </p>
                            {asset.latest_dvir?.received_at && (
                                <p className="mt-1 text-xs text-ink-soft">
                                    Accepted by Core-2{' '}
                                    {formatDateTime(
                                        asset.latest_dvir.received_at,
                                        'Receipt time not recorded',
                                    )}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="border-t border-line p-4 sm:p-5 md:border-t-0">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <h4 className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
                                Latest workshop check
                            </h4>
                            <span className="text-xs font-semibold text-ink-soft tabular-nums">
                                {workshopInspectionCount === null
                                    ? 'Total unavailable'
                                    : `${workshopInspectionCount} total records`}
                            </span>
                        </div>
                        <div className="mt-3">
                            {latestWorkshopInspection ? (
                                <span
                                    className={cn(
                                        'inline-flex items-center gap-1.5 text-sm font-semibold capitalize',
                                        latestWorkshopInspection.result ===
                                            'passed'
                                            ? 'text-success-strong'
                                            : latestWorkshopInspection.result ===
                                                'conditional'
                                              ? 'text-warning-strong'
                                              : 'text-danger-strong',
                                    )}
                                >
                                    <span
                                        className="h-2 w-2 rounded-full bg-current"
                                        aria-hidden="true"
                                    />
                                    {latestWorkshopInspection.result}
                                </span>
                            ) : (
                                <p className="text-sm font-semibold text-ink">
                                    No workshop check recorded
                                </p>
                            )}
                            <p className="mt-1 text-xs text-ink-soft">
                                {latestWorkshopInspection
                                    ? `Completed ${formatDateTime(latestWorkshopInspection.completed_at, 'date not recorded')}`
                                    : 'Record a check after maintenance or safety work'}
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <Modal
                open={showForm && canInspect}
                onClose={closeInspectionDialog}
                title="Record workshop inspection"
                description={`${asset.code} · ${asset.name}`}
                size="lg"
                closeOnBackdrop={false}
                contentClassName="p-5 sm:p-6"
                footer={
                    <div className="flex w-full flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs leading-5 text-ink-soft">
                            Your unfinished entries remain if you close this
                            dialog.
                        </p>
                        <div className="flex flex-col-reverse gap-2 sm:flex-row">
                            <Button
                                variant="secondary"
                                onClick={closeInspectionDialog}
                                aria-label="Close inspection dialog"
                            >
                                Close
                            </Button>
                            <Button
                                type="submit"
                                form={`inspection-form-${asset.id}`}
                                variant="primary"
                                disabled={
                                    form.processing ||
                                    !form.data.type ||
                                    !form.data.result
                                }
                            >
                                {form.processing
                                    ? 'Submitting…'
                                    : 'Save inspection record'}
                            </Button>
                        </div>
                    </div>
                }
            >
                <form
                    id={`inspection-form-${asset.id}`}
                    onSubmit={submit}
                    className="space-y-5"
                    noValidate
                >
                    <div>
                        <h3 className="text-base font-semibold text-ink">
                            Workshop / Post-Repair Verification
                        </h3>
                        <p className="mt-1 text-sm leading-5 text-ink-soft">
                            Record the inspection that supports a maintenance
                            release or an equipment readiness decision.
                        </p>
                    </div>

                    <div
                        role="note"
                        className="rounded-lg bg-surface-subtle p-3.5 text-xs leading-5 text-ink-soft"
                    >
                        Choose both an inspection type and a result. The result
                        is never assumed, and a non-passing result can affect
                        dispatchability.
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="text-sm font-medium text-ink">
                            Inspection type
                            <select
                                id={`inspection-type-${asset.id}`}
                                value={form.data.type}
                                data-autofocus
                                onChange={(e) => {
                                    form.clearErrors('type');
                                    form.setData(
                                        'type',
                                        e.target.value as
                                            InspectionTypeValue | '',
                                    );
                                }}
                                aria-invalid={Boolean(form.errors.type)}
                                className="mt-1 h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink transition-colors focus-visible:border-brand-strong focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                            >
                                <option value="">Select inspection type</option>
                                <option value="post_repair">
                                    Post-repair verification
                                </option>
                                <option value="maintenance">Maintenance</option>
                                <option value="safety">Safety</option>
                            </select>
                            {form.errors.type && (
                                <p
                                    role="alert"
                                    className="mt-1 text-xs text-danger"
                                >
                                    {form.errors.type}
                                </p>
                            )}
                        </label>
                        <label className="text-sm font-medium text-ink">
                            Result *
                            <select
                                id={`inspection-result-${asset.id}`}
                                value={form.data.result}
                                onChange={(e) => {
                                    form.clearErrors('result');
                                    form.setData(
                                        'result',
                                        e.target.value as
                                            InspectionResultValue | '',
                                    );
                                }}
                                aria-invalid={Boolean(form.errors.result)}
                                className="mt-1 h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink transition-colors focus-visible:border-brand-strong focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                            >
                                <option value="">Select result</option>
                                <option value="passed">Passed</option>
                                <option value="failed">
                                    Failed (Moves to Under Inspection)
                                </option>
                                <option value="conditional">
                                    Conditional (Moves to Under Inspection)
                                </option>
                            </select>
                            {form.errors.result && (
                                <p
                                    role="alert"
                                    className="mt-1 text-xs text-danger"
                                >
                                    {form.errors.result}
                                </p>
                            )}
                        </label>
                    </div>

                    <div>
                        <span className="text-xs font-semibold text-ink">
                            Inspection checklist
                        </span>
                        <div className="mt-2 grid gap-2 sm:grid-cols-3">
                            {Object.entries(form.data.checklist).map(
                                ([key, val]) => (
                                    <label
                                        key={key}
                                        className="flex min-h-11 items-center gap-2 rounded-md border border-line px-3 text-sm text-ink"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={val}
                                            onChange={(e) =>
                                                form.setData('checklist', {
                                                    ...form.data.checklist,
                                                    [key]: e.target.checked,
                                                })
                                            }
                                            className="h-4 w-4 rounded border-line-strong text-brand-strong"
                                        />
                                        <span>{humanize(key)}</span>
                                    </label>
                                ),
                            )}
                        </div>
                    </div>

                    <FleetInput
                        label="Findings / Remarks"
                        value={form.data.findings}
                        error={form.errors.findings}
                        onChange={(v) => form.setData('findings', v)}
                    />
                </form>
            </Modal>

            {!hasAnyInspections ? (
                <div className="rounded-lg bg-surface-subtle/50 px-4 py-8 text-center">
                    <ClipboardCheck className="mx-auto h-7 w-7 stroke-1 text-ink-soft opacity-60" />
                    <p className="mt-3 text-sm font-semibold text-ink">
                        No inspections recorded for this asset yet.
                    </p>
                    <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-ink-soft">
                        Field operator pre/post-trip DVIRs and shop audits will
                        appear here after they are recorded.
                    </p>
                </div>
            ) : (
                <div className="space-y-8">
                    <div
                        role="tablist"
                        aria-label="Inspection record source"
                        className="flex flex-wrap gap-2 border-b border-line pb-3"
                    >
                        {(
                            [
                                [
                                    'field',
                                    'Field DVIRs',
                                    dvirTotal ?? initialRecords.length,
                                ],
                                [
                                    'workshop',
                                    'Workshop checks',
                                    workshopInspectionCount ??
                                        asset.inspections.length,
                                ],
                            ] as const
                        ).map(([source, label, count]) => (
                            <button
                                key={source}
                                type="button"
                                role="tab"
                                aria-selected={selectedSource === source}
                                aria-controls={`asset-${source}-inspection-panel-${asset.id}`}
                                onClick={() =>
                                    setActiveSource({
                                        assetId: asset.id,
                                        source,
                                    })
                                }
                                className={cn(
                                    'min-h-11 rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-hidden',
                                    selectedSource === source
                                        ? 'border-brand-strong bg-brand-soft text-brand-strong'
                                        : 'border-line bg-surface text-ink-soft hover:bg-surface-subtle hover:text-ink',
                                )}
                            >
                                {label}{' '}
                                <span className="tabular-nums">({count})</span>
                            </button>
                        ))}
                    </div>

                    <section
                        id={`asset-field-inspection-panel-${asset.id}`}
                        role="tabpanel"
                        aria-labelledby={`asset-dvir-heading-${asset.id}`}
                        hidden={selectedSource !== 'field'}
                        className="space-y-4"
                    >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex items-start gap-2">
                                <ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-strong" />
                                <div>
                                    <h4
                                        id={`asset-dvir-heading-${asset.id}`}
                                        className="text-sm font-semibold text-ink"
                                    >
                                        Field DVIR history
                                    </h4>
                                    <p className="mt-1 text-xs leading-5 text-ink-soft">
                                        Mobile pre-trip and post-trip
                                        walkarounds. New records appear after
                                        Core-2 accepts the submission.
                                    </p>
                                </div>
                            </div>
                            <span className="text-xs font-semibold text-ink-soft tabular-nums">
                                {dvirTotal === null
                                    ? 'Total unavailable'
                                    : recordCountLabel(dvirTotal)}
                            </span>
                        </div>

                        <div className="flex flex-col gap-3 border-y border-line py-3 lg:flex-row lg:items-center lg:justify-between">
                            <div
                                className="flex flex-wrap gap-2"
                                role="group"
                                aria-label="Filter field DVIR history"
                            >
                                {(
                                    [
                                        ['all', 'All records'],
                                        ['needs_attention', 'Needs attention'],
                                        ['pre_trip', 'Pre-trip'],
                                        ['post_trip', 'Post-trip'],
                                    ] as const
                                ).map(([value, label]) => (
                                    <button
                                        key={value}
                                        type="button"
                                        aria-pressed={dvirFilter === value}
                                        onClick={() => {
                                            setDvirFilter(value);
                                            void loadDvirHistory({
                                                filter: value,
                                                append: false,
                                            });
                                        }}
                                        className={cn(
                                            'min-h-11 rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-hidden',
                                            dvirFilter === value
                                                ? 'border-brand-strong bg-brand-soft text-brand-strong'
                                                : 'border-line bg-surface text-ink-soft hover:bg-surface-subtle hover:text-ink',
                                        )}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <label className="flex min-h-11 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm text-ink-soft">
                                    <span className="sr-only">
                                        History range
                                    </span>
                                    <select
                                        value={dvirRange}
                                        onChange={(event) => {
                                            const range = event.target
                                                .value as DvirHistoryRange;
                                            setDvirRange(range);
                                            void loadDvirHistory({
                                                range,
                                                append: false,
                                            });
                                        }}
                                        className="bg-transparent text-sm font-medium text-ink outline-hidden"
                                    >
                                        <option value="all">All time</option>
                                        <option value="7">Last 7 days</option>
                                        <option value="30">Last 30 days</option>
                                        <option value="90">Last 90 days</option>
                                        <option value="365">
                                            Last 12 months
                                        </option>
                                    </select>
                                </label>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() =>
                                        void loadDvirHistory({
                                            append: false,
                                        })
                                    }
                                    disabled={historyLoading}
                                    aria-label="Refresh field DVIR history"
                                >
                                    <RefreshCw
                                        className={cn(
                                            'mr-1.5 h-3.5 w-3.5',
                                            historyLoading && 'animate-spin',
                                        )}
                                    />
                                    Refresh
                                </Button>
                            </div>
                        </div>

                        {historyError && (
                            <InlineNotice
                                tone="warning"
                                title="DVIR history could not be refreshed"
                                role="alert"
                                action={
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() =>
                                            void loadDvirHistory({
                                                append: false,
                                            })
                                        }
                                    >
                                        Try again
                                    </Button>
                                }
                            >
                                {historyError}
                            </InlineNotice>
                        )}

                        {historyLoading && (
                            <p className="text-sm text-ink-soft" role="status">
                                Loading DVIR history…
                            </p>
                        )}

                        {dvirInspections.length === 0 ? (
                            <p className="rounded-lg bg-surface-subtle/60 px-4 py-4 text-sm text-ink-soft">
                                {dvirFilter === 'all' && dvirRange === 'all'
                                    ? 'No field DVIR reports have been accepted for this asset yet.'
                                    : 'No DVIR records match the selected filters.'}
                            </p>
                        ) : (
                            <ul
                                aria-label="Field DVIR records"
                                className="overflow-hidden rounded-lg border border-line"
                            >
                                {[...dvirInspections]
                                    .sort((a, b) => {
                                        const attentionOrder =
                                            Number(isDvirAttention(b)) -
                                            Number(isDvirAttention(a));

                                        if (attentionOrder !== 0) {
                                            return attentionOrder;
                                        }

                                        return (
                                            (b.completed_at
                                                ? Date.parse(b.completed_at)
                                                : 0) -
                                                (a.completed_at
                                                    ? Date.parse(a.completed_at)
                                                    : 0) || b.id - a.id
                                        );
                                    })
                                    .map((dvir) => {
                                        const expanded =
                                            expandedDvirId === dvir.id;
                                        const detailId = `dvir-details-${asset.id}-${dvir.id}`;
                                        const photoCount =
                                            dvir.photos?.length ?? 0;
                                        const odometerLabel =
                                            dvir.starting_odometer_km !==
                                                null &&
                                            dvir.starting_odometer_km !==
                                                undefined
                                                ? `${dvir.starting_odometer_km.toLocaleString()} km${dvir.ending_odometer_km !== null && dvir.ending_odometer_km !== undefined ? ` → ${dvir.ending_odometer_km.toLocaleString()} km` : ''}`
                                                : dvir.ending_odometer_km !==
                                                        null &&
                                                    dvir.ending_odometer_km !==
                                                        undefined
                                                  ? `${dvir.ending_odometer_km.toLocaleString()} km`
                                                  : null;

                                        return (
                                            <li
                                                key={dvir.id}
                                                className={cn(
                                                    'border-b border-line last:border-b-0',
                                                    isDvirAttention(dvir) &&
                                                        'bg-warning-soft/25',
                                                )}
                                            >
                                                <button
                                                    type="button"
                                                    className="flex min-h-16 w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden focus-visible:ring-inset"
                                                    aria-expanded={expanded}
                                                    aria-controls={detailId}
                                                    onClick={() =>
                                                        setExpandedDvirId(
                                                            expanded
                                                                ? null
                                                                : dvir.id,
                                                        )
                                                    }
                                                >
                                                    <span className="min-w-0 flex-1">
                                                        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                                            <span className="text-xs font-semibold text-brand-strong">
                                                                {dvirTypeLabel(
                                                                    dvir,
                                                                )}
                                                            </span>
                                                            <span className="text-xs font-semibold text-ink-soft tabular-nums">
                                                                {dvir.reference}
                                                            </span>
                                                            {isDvirAttention(
                                                                dvir,
                                                            ) && (
                                                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-warning-strong">
                                                                    <AlertTriangle className="h-3.5 w-3.5" />
                                                                    Needs
                                                                    attention
                                                                </span>
                                                            )}
                                                        </span>
                                                        <span className="mt-1 block truncate text-sm font-medium text-ink">
                                                            {formatDateTime(
                                                                dvir.completed_at,
                                                                'Completion time not recorded',
                                                            )}
                                                            <span className="font-normal text-ink-soft">
                                                                {' · '}
                                                                {dvir.inspector_name ||
                                                                    'Driver not recorded'}
                                                            </span>
                                                        </span>
                                                    </span>
                                                    <span className="flex shrink-0 items-center gap-2">
                                                        <DvirStatusBadge
                                                            dvir={dvir}
                                                            compact
                                                        />
                                                        {photoCount > 0 && (
                                                            <span className="hidden items-center gap-1 text-xs font-medium text-ink-soft sm:inline-flex">
                                                                <Camera className="h-3.5 w-3.5" />
                                                                <span className="tabular-nums">
                                                                    {photoCount}
                                                                </span>
                                                            </span>
                                                        )}
                                                        {expanded ? (
                                                            <ChevronDown
                                                                className="h-4 w-4 text-ink-soft"
                                                                aria-hidden="true"
                                                            />
                                                        ) : (
                                                            <ChevronRight
                                                                className="h-4 w-4 text-ink-soft"
                                                                aria-hidden="true"
                                                            />
                                                        )}
                                                    </span>
                                                </button>

                                                {expanded && (
                                                    <div
                                                        id={detailId}
                                                        className="space-y-4 border-t border-line px-4 py-4"
                                                    >
                                                        <dl className="grid gap-3 text-xs sm:grid-cols-2 md:grid-cols-4">
                                                            <div>
                                                                <dt className="font-semibold text-ink-soft">
                                                                    Completed
                                                                </dt>
                                                                <dd className="mt-1 text-ink">
                                                                    {formatDateTime(
                                                                        dvir.completed_at,
                                                                        'Not recorded',
                                                                    )}
                                                                </dd>
                                                            </div>
                                                            <div>
                                                                <dt className="font-semibold text-ink-soft">
                                                                    Received by
                                                                    Core-2
                                                                </dt>
                                                                <dd className="mt-1 text-ink">
                                                                    {dvir.received_at
                                                                        ? formatDateTime(
                                                                              dvir.received_at,
                                                                              'Not recorded',
                                                                          )
                                                                        : 'Receipt time not available'}
                                                                </dd>
                                                            </div>
                                                            <div>
                                                                <dt className="font-semibold text-ink-soft">
                                                                    Driver
                                                                </dt>
                                                                <dd className="mt-1 text-ink">
                                                                    {dvir.inspector_name ||
                                                                        'Not recorded'}
                                                                </dd>
                                                            </div>
                                                            <div>
                                                                <dt className="font-semibold text-ink-soft">
                                                                    Odometer /
                                                                    engine
                                                                </dt>
                                                                <dd className="mt-1 text-ink tabular-nums">
                                                                    {odometerLabel && (
                                                                        <span className="block">
                                                                            {
                                                                                odometerLabel
                                                                            }
                                                                        </span>
                                                                    )}
                                                                    {dvir.engine_hours !==
                                                                        null &&
                                                                        dvir.engine_hours !==
                                                                            undefined && (
                                                                            <span className="block">
                                                                                {
                                                                                    dvir.engine_hours
                                                                                }{' '}
                                                                                hrs
                                                                            </span>
                                                                        )}
                                                                    {!odometerLabel &&
                                                                        (dvir.engine_hours ===
                                                                            null ||
                                                                            dvir.engine_hours ===
                                                                                undefined) &&
                                                                        'Not recorded'}
                                                                </dd>
                                                            </div>
                                                        </dl>

                                                        {dvir.defects &&
                                                            dvir.defects
                                                                .length > 0 && (
                                                                <div className="space-y-2 rounded-lg bg-warning-soft/60 p-3">
                                                                    <p className="text-xs font-semibold text-warning-strong">
                                                                        Flagged
                                                                        checklist
                                                                        defects
                                                                    </p>
                                                                    <ul className="space-y-1.5">
                                                                        {dvir.defects.map(
                                                                            (
                                                                                defect,
                                                                            ) => (
                                                                                <li
                                                                                    key={
                                                                                        defect.id
                                                                                    }
                                                                                    className="flex items-start gap-2 text-xs text-ink"
                                                                                >
                                                                                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-warning-strong" />
                                                                                    <span>
                                                                                        <span className="font-medium">
                                                                                            {
                                                                                                defect.category
                                                                                            }

                                                                                            :{' '}
                                                                                            {
                                                                                                defect.label
                                                                                            }
                                                                                        </span>
                                                                                        {defect.notes && (
                                                                                            <span className="text-ink-soft">
                                                                                                {' '}
                                                                                                —{' '}
                                                                                                {
                                                                                                    defect.notes
                                                                                                }
                                                                                            </span>
                                                                                        )}
                                                                                    </span>
                                                                                </li>
                                                                            ),
                                                                        )}
                                                                    </ul>
                                                                </div>
                                                            )}

                                                        {dvir.remarks && (
                                                            <p className="rounded-lg bg-surface-subtle px-3 py-2 text-sm text-ink-soft">
                                                                {dvir.remarks}
                                                            </p>
                                                        )}

                                                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                                                            <div className="flex flex-wrap items-center gap-3 text-xs text-ink-soft">
                                                                {dvir.signature_captured && (
                                                                    <span className="inline-flex items-center gap-1 font-medium text-success-strong">
                                                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                                                        Driver
                                                                        signature
                                                                        verified
                                                                    </span>
                                                                )}
                                                                {photoCount ===
                                                                    0 && (
                                                                    <span>
                                                                        No
                                                                        walkaround
                                                                        photos
                                                                        attached
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {onViewDvir && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="secondary"
                                                                    onClick={() =>
                                                                        onViewDvir(
                                                                            dvir,
                                                                        )
                                                                    }
                                                                    className="shrink-0"
                                                                >
                                                                    <Camera className="mr-1.5 h-3.5 w-3.5" />
                                                                    {photoCount >
                                                                    0
                                                                        ? `View walkaround photos (${photoCount})`
                                                                        : 'View inspection details'}
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </li>
                                        );
                                    })}
                            </ul>
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-ink-soft">
                            <span className="tabular-nums" aria-live="polite">
                                Showing {dvirInspections.length} of{' '}
                                {dvirTotal ?? dvirInspections.length} records
                            </span>
                            {nextCursor && (
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() =>
                                        void loadDvirHistory({
                                            append: true,
                                        })
                                    }
                                    disabled={historyLoading}
                                >
                                    {historyLoading
                                        ? 'Loading…'
                                        : 'Load older records'}
                                </Button>
                            )}
                        </div>
                    </section>

                    <section
                        id={`asset-workshop-inspection-panel-${asset.id}`}
                        role="tabpanel"
                        aria-labelledby={`asset-workshop-heading-${asset.id}`}
                        hidden={selectedSource !== 'workshop'}
                        className="space-y-3 border-t border-line pt-6"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Wrench className="h-4 w-4 text-ink-soft" />
                                <h4
                                    id={`asset-workshop-heading-${asset.id}`}
                                    className="text-sm font-semibold text-ink"
                                >
                                    Workshop &amp; Safety Audits
                                </h4>
                            </div>
                            <span className="text-xs font-semibold text-ink-soft tabular-nums">
                                {workshopInspectionCount === null
                                    ? 'Total unavailable'
                                    : recordCountLabel(workshopInspectionCount)}
                            </span>
                        </div>
                        <p className="text-xs leading-5 text-ink-soft">
                            Workshop, safety, and post-repair verification
                            records used by the readiness workflow.
                        </p>

                        {asset.inspections.length === 0 ? (
                            <p className="rounded-lg bg-surface-subtle/60 px-4 py-3 text-sm text-ink-soft">
                                No shop or periodic safety audits recorded for
                                this asset yet.
                            </p>
                        ) : (
                            <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
                                {asset.inspections.map((ins) => (
                                    <li key={ins.id} className="space-y-2 p-4">
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-ink capitalize">
                                                    {humanize(ins.type)}{' '}
                                                    inspection
                                                </p>
                                                <p className="mt-1 text-xs text-ink-soft">
                                                    Completed:{' '}
                                                    {formatDateTime(
                                                        ins.completed_at,
                                                        'Not recorded',
                                                    )}
                                                </p>
                                            </div>
                                            <span
                                                className={cn(
                                                    'inline-flex items-center gap-1.5 text-xs font-semibold capitalize',
                                                    ins.result === 'passed'
                                                        ? 'text-success-strong'
                                                        : ins.result ===
                                                            'conditional'
                                                          ? 'text-warning-strong'
                                                          : 'text-danger-strong',
                                                )}
                                            >
                                                <span
                                                    className="h-1.5 w-1.5 rounded-full bg-current"
                                                    aria-hidden="true"
                                                />
                                                {ins.result}
                                            </span>
                                        </div>
                                        {ins.findings && (
                                            <p className="rounded-md bg-surface-subtle px-3 py-2 text-sm text-ink-soft">
                                                {ins.findings}
                                            </p>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </div>
            )}
        </div>
    );
}
