import { useForm } from '@inertiajs/react';
import {
    AlertTriangle,
    Camera,
    CheckCircle2,
    ClipboardCheck,
    Gauge,
    ShieldAlert,
    Wrench,
} from 'lucide-react';
import type { FormEvent } from 'react';
import React, { useState } from 'react';
import { Button } from '@/components/ui';
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

export function FleetInspectionsSection({
    asset,
    canInspect,
    onViewDvir,
}: FleetInspectionsSectionProps) {
    const [showForm, setShowForm] = useState(false);
    const form = useForm<{
        type: InspectionTypeValue;
        result: InspectionResultValue;
        checklist: Record<string, boolean>;
        findings: string;
    }>({
        type: 'safety',
        result: 'passed',
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
        form.post(`/operations/assets/${asset.id}/inspections`, {
            preserveScroll: true,
            onSuccess: () => {
                setShowForm(false);
                form.reset();
            },
        });
    };

    const dvirInspections: DvirInspectionViewModel[] =
        asset.dvir_inspections && asset.dvir_inspections.length > 0
            ? asset.dvir_inspections
            : asset.latest_dvir
              ? [
                    {
                        id: asset.latest_dvir.id,
                        reference: `DVIR-${String(asset.latest_dvir.id).padStart(6, '0')}`,
                        inspection_type: asset.latest_dvir.type,
                        type: asset.latest_dvir.type,
                        status: asset.latest_dvir.status,
                        has_defects: asset.latest_dvir.has_defects,
                        critical_defects_count:
                            asset.latest_dvir.critical_defects_count,
                        completed_at: asset.latest_dvir.completed_at,
                        inspector_name: asset.latest_dvir.inspector_name,
                        photos: asset.latest_dvir.photos ?? [],
                    },
                ]
              : [];

    const hasAnyInspections =
        dvirInspections.length > 0 || asset.inspections.length > 0;

    return (
        <div className="space-y-6">
            {canInspect && (
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-bold text-ink">
                            Fleet Inspection Audit Trail
                        </h3>
                        <p className="text-xs text-ink-soft">
                            Routine pre-trip and post-trip checks use DVIR.
                            Record workshop checks and post-repair verification
                            here.
                        </p>
                    </div>
                    <Button
                        variant={showForm ? 'secondary' : 'primary'}
                        size="sm"
                        onClick={() => setShowForm(!showForm)}
                    >
                        {showForm
                            ? 'Cancel inspection'
                            : 'Record new inspection'}
                    </Button>
                </div>
            )}

            {showForm && canInspect && (
                <form
                    onSubmit={submit}
                    className="space-y-4 rounded-xl border border-line bg-surface-subtle p-4"
                    noValidate
                >
                    <h4 className="font-semibold text-ink">
                        Workshop / Post-Repair Verification
                    </h4>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="text-sm font-medium text-ink">
                            Inspection type
                            <select
                                value={form.data.type}
                                onChange={(e) =>
                                    form.setData(
                                        'type',
                                        e.target.value as InspectionTypeValue,
                                    )
                                }
                                className="mt-1 h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-xs text-ink transition-colors focus-visible:border-brand-strong focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                            >
                                <option value="post_repair">
                                    Post-repair verification
                                </option>
                                <option value="maintenance">Maintenance</option>
                                <option value="safety">Safety</option>
                            </select>
                        </label>
                        <label className="text-sm font-medium text-ink">
                            Result *
                            <select
                                value={form.data.result}
                                onChange={(e) =>
                                    form.setData(
                                        'result',
                                        e.target.value as InspectionResultValue,
                                    )
                                }
                                className="mt-1 h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-xs text-ink transition-colors focus-visible:border-brand-strong focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                            >
                                <option value="passed">Passed</option>
                                <option value="failed">
                                    Failed (Moves to Under Inspection)
                                </option>
                                <option value="conditional">
                                    Conditional (Moves to Under Inspection)
                                </option>
                            </select>
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
                                        className="flex items-center gap-2 text-sm text-ink"
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

                    <div className="flex justify-end">
                        <Button
                            type="submit"
                            variant="primary"
                            disabled={form.processing}
                        >
                            {form.processing
                                ? 'Submitting…'
                                : 'Save inspection record'}
                        </Button>
                    </div>
                </form>
            )}

            {!hasAnyInspections ? (
                <div className="rounded-xl border border-dashed border-line p-8 text-center">
                    <ClipboardCheck className="mx-auto h-8 w-8 stroke-1 text-ink-soft opacity-60" />
                    <p className="mt-2 text-sm font-medium text-ink">
                        No inspections recorded for this asset yet.
                    </p>
                    <p className="mt-1 text-xs text-ink-soft">
                        Field operator pre/post-trip DVIRs and shop audits will
                        appear here.
                    </p>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Pre-Trip and Post-Trip DVIR Compliance Log */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <ClipboardCheck className="h-4 w-4 text-brand-strong" />
                                <h4 className="text-sm font-bold text-ink">
                                    Daily DVIR Compliance Log (Pre- &amp;
                                    Post-Trip)
                                </h4>
                            </div>
                            <span className="rounded-full bg-surface-subtle px-2 py-0.5 font-mono text-[10px] font-semibold text-ink-soft tabular-nums">
                                {dvirInspections.length} recorded
                            </span>
                        </div>

                        {dvirInspections.length === 0 ? (
                            <p className="rounded-lg border border-line bg-surface-subtle/50 p-4 text-xs text-ink-soft">
                                No pre-trip or post-trip DVIR reports submitted
                                for this equipment yet.
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {dvirInspections.map((dvir) => {
                                    const isPreTrip =
                                        dvir.type === 'pre_trip' ||
                                        dvir.inspection_type === 'pre_trip';
                                    const isCritical =
                                        dvir.status === 'critical_defect' ||
                                        dvir.critical_defects_count > 0;
                                    const isDefect =
                                        dvir.status === 'defect_flagged' ||
                                        dvir.has_defects;

                                    return (
                                        <div
                                            key={dvir.id}
                                            className="space-y-2.5 rounded-xl border border-line bg-surface p-4"
                                        >
                                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 pb-2">
                                                <div className="flex items-center gap-2">
                                                    <span
                                                        className={cn(
                                                            'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium',
                                                            isPreTrip
                                                                ? 'bg-sky-500/10 text-sky-700 dark:text-sky-400'
                                                                : 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400',
                                                        )}
                                                    >
                                                        {isPreTrip
                                                            ? 'Pre-Trip'
                                                            : 'Post-Trip'}
                                                    </span>
                                                    <span className="font-mono text-xs font-semibold text-ink tabular-nums">
                                                        {dvir.reference ||
                                                            `DVIR-${String(dvir.id).padStart(6, '0')}`}
                                                    </span>
                                                    <span className="text-xs text-ink-soft">
                                                        {formatDateTime(
                                                            dvir.completed_at,
                                                            'Date not recorded',
                                                        )}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <span
                                                        className={cn(
                                                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                                                            isCritical
                                                                ? 'bg-danger-soft text-danger-strong'
                                                                : isDefect
                                                                  ? 'bg-warning-soft text-warning-strong'
                                                                  : 'bg-success-soft text-success-strong',
                                                        )}
                                                    >
                                                        {isCritical ? (
                                                            <>
                                                                <ShieldAlert className="h-3 w-3" />
                                                                Critical Defect
                                                            </>
                                                        ) : isDefect ? (
                                                            <>
                                                                <AlertTriangle className="h-3 w-3" />
                                                                Defects Flagged
                                                            </>
                                                        ) : (
                                                            <>
                                                                <CheckCircle2 className="h-3 w-3" />
                                                                Passed
                                                            </>
                                                        )}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Details & Telemetry row */}
                                            <div className="grid gap-2 text-xs text-ink-soft sm:grid-cols-2 md:grid-cols-3">
                                                <div>
                                                    <span className="font-medium text-ink">
                                                        Inspector:{' '}
                                                    </span>
                                                    {dvir.inspector_name ||
                                                        'Driver not recorded'}
                                                </div>
                                                {(dvir.starting_odometer_km !==
                                                    null ||
                                                    dvir.ending_odometer_km !==
                                                        null) && (
                                                    <div className="flex items-center gap-1">
                                                        <Gauge className="h-3.5 w-3.5 shrink-0 text-ink-soft" />
                                                        <span className="tabular-nums">
                                                            Odo:{' '}
                                                            {dvir.starting_odometer_km !==
                                                                null &&
                                                            dvir.starting_odometer_km !==
                                                                undefined
                                                                ? `${dvir.starting_odometer_km.toLocaleString()} km`
                                                                : ''}
                                                            {dvir.ending_odometer_km !==
                                                                null &&
                                                            dvir.ending_odometer_km !==
                                                                undefined
                                                                ? ` → ${dvir.ending_odometer_km.toLocaleString()} km`
                                                                : ''}
                                                        </span>
                                                    </div>
                                                )}
                                                {dvir.engine_hours !== null &&
                                                    dvir.engine_hours !==
                                                        undefined && (
                                                        <div>
                                                            <span className="font-medium text-ink">
                                                                Engine
                                                                Hours:{' '}
                                                            </span>
                                                            <span className="tabular-nums">
                                                                {
                                                                    dvir.engine_hours
                                                                }{' '}
                                                                hrs
                                                            </span>
                                                        </div>
                                                    )}
                                            </div>

                                            {/* Defects Breakdown */}
                                            {dvir.defects &&
                                                dvir.defects.length > 0 && (
                                                    <div className="space-y-1.5 rounded-lg border border-line/60 bg-surface-subtle p-2.5">
                                                        <span className="text-xs font-semibold text-ink">
                                                            Flagged checklist
                                                            defects
                                                        </span>
                                                        {dvir.defects.map(
                                                            (defect) => (
                                                                <div
                                                                    key={
                                                                        defect.id
                                                                    }
                                                                    className="flex items-start gap-1.5 text-xs"
                                                                >
                                                                    <span
                                                                        className={cn(
                                                                            'mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium capitalize',
                                                                            defect.status ===
                                                                                'critical'
                                                                                ? 'bg-danger-soft text-danger-strong'
                                                                                : 'bg-warning-soft text-warning-strong',
                                                                        )}
                                                                    >
                                                                        {
                                                                            defect.status
                                                                        }
                                                                    </span>
                                                                    <span className="font-medium text-ink">
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
                                                                            (
                                                                            {
                                                                                defect.notes
                                                                            }
                                                                            )
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            ),
                                                        )}
                                                    </div>
                                                )}

                                            {/* Driver Remarks */}
                                            {dvir.remarks && (
                                                <p className="rounded-md bg-surface-subtle px-2.5 py-1 text-xs text-ink-soft italic">
                                                    &ldquo;{dvir.remarks}&rdquo;
                                                </p>
                                            )}

                                            {/* Actions */}
                                            <div className="flex items-center justify-between border-t border-line/50 pt-2">
                                                <div className="text-[11px] text-ink-soft">
                                                    {dvir.signature_captured && (
                                                        <span className="inline-flex items-center gap-1 font-medium text-success-strong">
                                                            <CheckCircle2 className="h-3 w-3" />
                                                            Driver signature
                                                            verified
                                                        </span>
                                                    )}
                                                </div>
                                                {onViewDvir && (
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        onClick={() =>
                                                            onViewDvir(dvir)
                                                        }
                                                        className="inline-flex items-center gap-1 text-xs"
                                                    >
                                                        <Camera className="h-3.5 w-3.5" />
                                                        {(dvir.photos?.length ??
                                                            0) > 0 ? (
                                                            <>
                                                                Walkaround
                                                                Photos (
                                                                <span className="tabular-nums">
                                                                    {
                                                                        dvir
                                                                            .photos
                                                                            .length
                                                                    }
                                                                </span>
                                                                )
                                                            </>
                                                        ) : (
                                                            'View Inspection'
                                                        )}
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Workshop & Safety Audits */}
                    <div className="space-y-3 border-t border-line pt-5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Wrench className="h-4 w-4 text-ink-soft" />
                                <h4 className="text-sm font-bold text-ink">
                                    Workshop &amp; Safety Audits
                                </h4>
                            </div>
                            <span className="rounded-full bg-surface-subtle px-2 py-0.5 font-mono text-[10px] font-semibold text-ink-soft tabular-nums">
                                {asset.inspections.length} recorded
                            </span>
                        </div>

                        {asset.inspections.length === 0 ? (
                            <p className="rounded-lg border border-line bg-surface-subtle/50 p-4 text-xs text-ink-soft">
                                No shop or periodic safety audits recorded for
                                this asset yet.
                            </p>
                        ) : (
                            <ul className="divide-y divide-line rounded-xl border border-line bg-surface px-4">
                                {asset.inspections.map((ins) => (
                                    <li key={ins.id} className="py-3">
                                        <div className="flex items-center justify-between">
                                            <span className="font-semibold text-ink capitalize">
                                                {humanize(ins.type)} inspection
                                            </span>
                                            <span
                                                className={cn(
                                                    'rounded-full px-2 py-0.5 text-xs font-semibold capitalize',
                                                    ins.result === 'passed'
                                                        ? 'bg-success-soft text-success-strong'
                                                        : 'bg-danger-soft text-danger',
                                                )}
                                            >
                                                {ins.result}
                                            </span>
                                        </div>
                                        <p className="mt-1 text-xs text-ink-soft">
                                            Completed:{' '}
                                            {formatDateTime(
                                                ins.completed_at,
                                                'Not recorded',
                                            )}
                                        </p>
                                        {ins.findings && (
                                            <p className="mt-1 text-sm text-ink-soft">
                                                {ins.findings}
                                            </p>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
