import { AlertTriangle, CheckCircle, Clock, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ApprovalViewModel } from '@/types/workspace';

export type ApprovalFilterType = 'all' | 'actionable' | 'peer' | 'urgent';

interface ApprovalMetricsBarProps {
    approvals: ApprovalViewModel[];
    activeFilter: ApprovalFilterType;
    onFilterChange: (filter: ApprovalFilterType) => void;
    canDecide: boolean;
}

export function ApprovalMetricsBar({
    approvals,
    activeFilter,
    onFilterChange,
    canDecide,
}: ApprovalMetricsBarProps) {
    const totalPending = approvals.length;
    const actionableCount = approvals.filter(
        (a) => canDecide && a.can_decide,
    ).length;
    const peerReviewCount = approvals.filter((a) => !a.can_decide).length;
    const urgentCount = approvals.filter(
        (a) =>
            a.subject.priority?.value === 'emergency' ||
            a.subject.priority?.value === 'priority',
    ).length;

    const metrics = [
        {
            id: 'all' as ApprovalFilterType,
            label: 'All Pending',
            count: totalPending,
            icon: Clock,
            description: 'Total queue',
            colorClass: 'text-brand-strong',
            bgClass: 'bg-brand-soft/40',
            activeClass: 'ring-2 ring-brand border-brand bg-brand-soft/60',
        },
        {
            id: 'actionable' as ApprovalFilterType,
            label: 'Actionable by You',
            count: actionableCount,
            icon: CheckCircle,
            description: 'Awaiting your review',
            colorClass: 'text-success-strong',
            bgClass: 'bg-success-soft/50',
            activeClass:
                'ring-2 ring-success border-success bg-success-soft/70',
            badge:
                actionableCount > 0 ? (
                    <span className="inline-flex items-center rounded-full bg-success px-1.5 py-0.5 text-[10px] font-bold text-white">
                        Action required
                    </span>
                ) : undefined,
        },
        {
            id: 'peer' as ApprovalFilterType,
            label: 'Peer Review Required',
            count: peerReviewCount,
            icon: Lock,
            description: 'Segregated governance',
            colorClass: 'text-warning-strong',
            bgClass: 'bg-warning-soft/50',
            activeClass:
                'ring-2 ring-warning border-warning bg-warning-soft/70',
        },
        {
            id: 'urgent' as ApprovalFilterType,
            label: 'High Priority',
            count: urgentCount,
            icon: AlertTriangle,
            description: 'Urgent dispatches',
            colorClass: 'text-danger-strong',
            bgClass: 'bg-danger-soft/50',
            activeClass: 'ring-2 ring-danger border-danger bg-danger-soft/70',
            badge:
                urgentCount > 0 ? (
                    <span className="inline-flex items-center rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-bold text-white">
                        Urgent
                    </span>
                ) : undefined,
        },
    ];

    return (
        <div
            className="grid grid-cols-2 gap-2.5 sm:grid-cols-2 lg:grid-cols-4"
            role="tablist"
            aria-label="Approval queue filter metrics"
        >
            {metrics.map((metric) => {
                const isActive = activeFilter === metric.id;
                const Icon = metric.icon;

                return (
                    <button
                        key={metric.id}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => onFilterChange(metric.id)}
                        className={cn(
                            'group relative flex flex-col justify-between rounded-xl border border-line bg-surface p-3.5 text-left transition-all duration-150 ease-out hover:border-line-strong hover:shadow-xs focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none',
                            isActive
                                ? metric.activeClass
                                : 'hover:bg-surface-subtle/30',
                        )}
                    >
                        <div className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
                                <Icon
                                    className={cn(
                                        'h-3.5 w-3.5 shrink-0',
                                        metric.colorClass,
                                    )}
                                    aria-hidden="true"
                                />
                                {metric.label}
                            </span>
                            {metric.badge}
                        </div>

                        <div className="mt-3 flex items-baseline justify-between">
                            <span className="text-2xl font-bold tracking-tight text-ink">
                                {metric.count}
                            </span>
                            <span className="text-[11px] font-medium text-ink-soft">
                                {metric.description}
                            </span>
                        </div>
                    </button>
                );
            })}
        </div>
    );
}
