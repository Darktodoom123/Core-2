import { CheckCircle2, Circle, ListChecks, Truck, Users } from 'lucide-react';
import React from 'react';
import { Button, Panel } from '@/components/ui';
import { humanize } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type {
    AssetCandidateViewModel,
    DispatchDetailPageProps,
    PersonnelCandidateViewModel,
} from '@/types/workspace';
import { SelectionGroup } from './dispatch-detail-helpers';

export function AssignmentSelectionSummary({
    formId,
    personnel,
    assets,
    selectedCount,
    processing,
    canAssign,
    currentPersonnelCount,
    currentAssetCount,
    currentPersonnel,
    currentAssets,
}: {
    formId?: string;
    personnel: PersonnelCandidateViewModel[];
    assets: AssetCandidateViewModel[];
    selectedCount: number;
    processing: boolean;
    canAssign: boolean;
    currentPersonnelCount: number;
    currentAssetCount: number;
    currentPersonnel: DispatchDetailPageProps['job']['personnel_assignments'];
    currentAssets: DispatchDetailPageProps['job']['asset_assignments'];
}) {
    const hasDraftSelections = selectedCount > 0;
    const currentCount = currentPersonnelCount + currentAssetCount;
    const hasSavedAssignments = currentCount > 0;
    const summaryTitle = hasDraftSelections
        ? hasSavedAssignments
            ? 'Update assignment'
            : 'Draft assignment'
        : hasSavedAssignments
          ? 'Assigned resources'
          : 'Assignment plan';
    const summaryDescription = hasDraftSelections
        ? hasSavedAssignments
            ? 'Review the new resources before saving this assignment update.'
            : 'These selections are not saved yet. Review them before assigning.'
        : hasSavedAssignments
          ? 'Saved personnel and assets for this dispatch.'
          : 'Select eligible resources, then save them to this dispatch.';
    const visibleCount = hasDraftSelections ? selectedCount : currentCount;
    const visibleCountLabel = hasDraftSelections
        ? `new resource${selectedCount === 1 ? '' : 's'} selected`
        : hasSavedAssignments
          ? `resource${currentCount === 1 ? '' : 's'} assigned`
          : 'resources selected';

    const totalPeople = currentPersonnelCount + personnel.length;
    const totalAssets = currentAssetCount + assets.length;

    return (
        <Panel
            id="assignment-summary"
            className="overflow-hidden border-brand/40 shadow-sm"
        >
            <div className="border-b border-line bg-surface px-4 py-4">
                <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-strong">
                        {hasSavedAssignments && !hasDraftSelections ? (
                            <CheckCircle2
                                className="h-5 w-5"
                                aria-hidden="true"
                            />
                        ) : (
                            <ListChecks
                                className="h-5 w-5"
                                aria-hidden="true"
                            />
                        )}
                    </span>
                    <div>
                        <h2 className="text-base font-semibold text-ink">
                            {summaryTitle}
                        </h2>
                        <p className="mt-0.5 text-xs leading-5 text-ink-soft">
                            {summaryDescription}
                        </p>
                    </div>
                </div>
            </div>

            <div className="space-y-4 px-4 py-4">
                <div className="flex items-baseline gap-2">
                    <span
                        className="text-3xl font-bold tracking-tight text-ink"
                        aria-hidden="true"
                    >
                        {visibleCount}
                    </span>
                    <span className="text-sm font-medium text-ink-soft">
                        <span className="sr-only">{visibleCount} </span>
                        {visibleCountLabel}
                    </span>
                </div>

                {/* Live Requirements Tracker */}
                <div className="space-y-2 rounded-lg border border-line bg-surface-subtle/50 p-3">
                    <p className="text-[11px] font-semibold tracking-wider text-ink-soft uppercase">
                        Readiness targets
                    </p>
                    <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-ink">
                                <Users className="h-3.5 w-3.5 text-ink-soft" />
                                Field Personnel
                            </span>
                            <span
                                className={cn(
                                    'inline-flex items-center gap-1 font-semibold',
                                    totalPeople > 0
                                        ? 'text-success-strong'
                                        : 'text-warning-strong',
                                )}
                            >
                                {totalPeople > 0 ? (
                                    <>
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                        {totalPeople} ready
                                    </>
                                ) : (
                                    <>
                                        <Circle className="h-3.5 w-3.5 opacity-60" />
                                        1 required
                                    </>
                                )}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-ink">
                                <Truck className="h-3.5 w-3.5 text-ink-soft" />
                                Operational Asset
                            </span>
                            <span
                                className={cn(
                                    'inline-flex items-center gap-1 font-semibold',
                                    totalAssets > 0
                                        ? 'text-success-strong'
                                        : 'text-warning-strong',
                                )}
                            >
                                {totalAssets > 0 ? (
                                    <>
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                        {totalAssets} ready
                                    </>
                                ) : (
                                    <>
                                        <Circle className="h-3.5 w-3.5 opacity-60" />
                                        1 required
                                    </>
                                )}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="space-y-2.5 text-sm">
                    <AssignmentRequirementRow
                        label="People"
                        count={currentPersonnelCount}
                        draftCount={personnel.length}
                    />
                    <AssignmentRequirementRow
                        label="Assets"
                        count={currentAssetCount}
                        draftCount={assets.length}
                    />
                </div>

                {hasSavedAssignments && (
                    <div className="space-y-3 border-t border-line pt-3">
                        <p className="text-xs font-semibold text-ink-soft">
                            Currently assigned
                        </p>
                        <SelectionGroup
                            label="People"
                            items={currentPersonnel.map(
                                (assignment) =>
                                    assignment.name +
                                    ' / ' +
                                    humanize(assignment.type) +
                                    ' / ' +
                                    assignment.response_status.label,
                            )}
                            emptyMessage="No people assigned"
                        />
                        <SelectionGroup
                            label="Assets"
                            items={currentAssets.map(
                                (assignment) =>
                                    assignment.code +
                                    ' / ' +
                                    assignment.name +
                                    ' / ' +
                                    humanize(assignment.type),
                            )}
                            emptyMessage="No assets assigned"
                        />
                    </div>
                )}

                {hasDraftSelections && (
                    <div className="space-y-3 border-t border-line pt-3">
                        <p className="text-xs font-semibold text-ink-soft">
                            Pending changes
                        </p>
                        <SelectionGroup
                            label="People to add"
                            items={personnel.map((candidate) => candidate.name)}
                            emptyMessage="No people selected"
                        />
                        <SelectionGroup
                            label="Assets to add"
                            items={assets.map(
                                (candidate) =>
                                    candidate.code + ' / ' + candidate.name,
                            )}
                            emptyMessage="No assets selected"
                        />
                    </div>
                )}
            </div>

            {(!hasSavedAssignments || hasDraftSelections) && (
                <div className="border-t border-line bg-surface-subtle px-4 py-4">
                    <Button
                        type="submit"
                        form={formId}
                        variant="primary"
                        className="w-full"
                        disabled={
                            processing || selectedCount === 0 || !canAssign
                        }
                        aria-busy={processing}
                    >
                        {processing
                            ? 'Saving assignments…'
                            : selectedCount > 0
                              ? `Assign ${selectedCount} resource${selectedCount === 1 ? '' : 's'}`
                              : 'Select resources to continue'}
                    </Button>
                    <p className="mt-2 text-center text-xs leading-5 text-ink-soft">
                        {canAssign
                            ? 'At least one eligible resource is required. Activation also needs one person and one asset.'
                            : 'Your role can review this dispatch but cannot create assignments.'}
                    </p>
                </div>
            )}
        </Panel>
    );
}

function AssignmentRequirementRow({
    label,
    count,
    draftCount = 0,
}: {
    label: string;
    count: number;
    draftCount?: number;
}) {
    const ready = count > 0;

    return (
        <div className="flex items-center justify-between text-xs">
            <span className="text-ink-soft">{label}</span>
            <span className="inline-flex items-center gap-2 font-medium">
                <span
                    className={cn(
                        'inline-flex items-center gap-1 font-medium',
                        ready ? 'text-success-strong' : 'text-warning-strong',
                    )}
                >
                    {ready ? (
                        <CheckCircle2
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                        />
                    ) : (
                        <Circle
                            className="h-3.5 w-3.5 opacity-60"
                            aria-hidden="true"
                        />
                    )}
                    {count} assigned
                </span>
                {draftCount > 0 && (
                    <span className="font-semibold text-brand-strong">
                        · {draftCount} new
                    </span>
                )}
            </span>
        </div>
    );
}
