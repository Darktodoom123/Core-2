import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import React from 'react';
import { cn } from '@/lib/utils';
import type { DispatchDetailPageProps } from '@/types/workspace';

export function ActivationPrerequisiteChecklist({
    job,
    activation,
}: {
    job: DispatchDetailPageProps['job'];
    activation: DispatchDetailPageProps['activation'];
}) {
    const isActivatableStatus = [
        'draft',
        'pending_approval',
        'scheduled',
    ].includes(job.status.value);
    const hasPersonnel = job.personnel_assignments.length > 0;
    const hasAssets = job.asset_assignments.length > 0;
    const approvalPassed =
        !activation.approval_required ||
        activation.approval_status === 'approved';

    const items = [
        {
            title: 'Lifecycle status',
            desc: isActivatableStatus
                ? `Job is currently in ${job.status.label} status.`
                : `Job is in ${job.status.label} status (activation unavailable).`,
            ready: isActivatableStatus,
        },
        {
            title: 'Personnel assignment',
            desc: hasPersonnel
                ? `${job.personnel_assignments.length} field worker(s) assigned.`
                : 'At least one active eligible field worker is required.',
            ready:
                hasPersonnel &&
                !activation.blockers.some(
                    (b) => b.includes('worker') || b.includes('eligible'),
                ),
        },
        {
            title: 'Asset assignment & safety',
            desc: hasAssets
                ? `${job.asset_assignments.length} asset(s) assigned.`
                : 'At least one active safe asset (crane/truck) is required.',
            ready:
                hasAssets &&
                !activation.blockers.some(
                    (b) => b.includes('Asset') || b.includes('safe'),
                ),
        },
        {
            title: 'Operations Manager approval',
            desc:
                activation.approval_status === 'approved'
                    ? 'Operations Manager approval granted.'
                    : activation.approval_status === 'rejected'
                      ? 'Approval request was rejected.'
                      : 'Awaiting Operations Manager approval decision.',
            ready: approvalPassed,
        },
    ];

    return (
        <div className="space-y-2 rounded-lg border border-line bg-surface-subtle/50 p-3">
            <p className="text-xs font-semibold text-ink">
                Activation prerequisites
            </p>
            <ul className="space-y-2 text-xs">
                {items.map((item) => (
                    <li key={item.title} className="flex items-start gap-2">
                        {item.ready ? (
                            <CheckCircle2
                                className="mt-0.5 h-4 w-4 shrink-0 text-success-strong"
                                aria-hidden="true"
                            />
                        ) : (
                            <AlertTriangle
                                className="mt-0.5 h-4 w-4 shrink-0 text-warning-strong"
                                aria-hidden="true"
                            />
                        )}
                        <div>
                            <span
                                className={cn(
                                    'font-medium',
                                    item.ready
                                        ? 'text-ink'
                                        : 'text-warning-strong',
                                )}
                            >
                                {item.title}:
                            </span>{' '}
                            <span className="text-ink-soft">{item.desc}</span>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}
