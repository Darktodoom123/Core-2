import { LayoutGrid, List, Search, ShieldCheck, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyState, PageHeading, Panel } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { ApprovalViewModel } from '@/types/workspace';
import { ApprovalCard } from './approval-card';
import { ApprovalMetricsBar } from './approval-metrics-bar';
import type { ApprovalFilterType } from './approval-metrics-bar';

interface ApprovalsSurfaceProps {
    approvals: ApprovalViewModel[];
    canDecide: boolean;
}

export function ApprovalsSurface({
    approvals,
    canDecide,
}: ApprovalsSurfaceProps) {
    const [filter, setFilter] = useState<ApprovalFilterType>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    const filteredApprovals = useMemo(() => {
        let list = approvals;

        if (filter === 'actionable') {
            list = list.filter((a) => canDecide && a.can_decide);
        } else if (filter === 'peer') {
            list = list.filter((a) => !a.can_decide);
        } else if (filter === 'urgent') {
            list = list.filter(
                (a) =>
                    a.subject.priority?.value === 'emergency' ||
                    a.subject.priority?.value === 'priority',
            );
        }

        if (searchQuery.trim().length > 0) {
            const query = searchQuery.toLowerCase().trim();
            list = list.filter((a) => {
                const ref = a.subject.reference.toLowerCase();
                const title = (a.subject.title ?? '').toLowerCase();
                const requester = a.requester.name.toLowerCase();
                const site = (a.subject.site ?? '').toLowerCase();
                const kind = a.kind.toLowerCase();
                const personnel = a.requested_changes.personnel
                    .map((p) => p.name.toLowerCase())
                    .join(' ');
                const assets = a.requested_changes.assets
                    .map((ass) => `${ass.code} ${ass.name}`.toLowerCase())
                    .join(' ');

                return (
                    ref.includes(query) ||
                    title.includes(query) ||
                    requester.includes(query) ||
                    site.includes(query) ||
                    kind.includes(query) ||
                    personnel.includes(query) ||
                    assets.includes(query)
                );
            });
        }

        return list;
    }, [approvals, filter, searchQuery, canDecide]);

    return (
        <div>
            <PageHeading
                title="Pending approvals"
                description="Review requester, operational context, proposed resource changes, and policy compliance before recording an independent decision."
                actions={
                    <span
                        className="rounded-full bg-warning-soft px-3 py-1.5 text-xs font-semibold text-warning-strong"
                        role="status"
                    >
                        {approvals.length}{' '}
                        {approvals.length === 1
                            ? 'pending decision'
                            : 'pending decisions'}
                    </span>
                }
            />

            <div className="space-y-4 p-4 md:p-6">
                {/* KPI Metrics Strip & Quick Filter Bar */}
                {approvals.length > 0 && (
                    <ApprovalMetricsBar
                        approvals={approvals}
                        activeFilter={filter}
                        onFilterChange={setFilter}
                        canDecide={canDecide}
                    />
                )}

                {/* Toolbar: Search and View Layout Toggle */}
                {approvals.length > 0 && (
                    <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="relative max-w-md min-w-0 flex-1">
                            <Search
                                className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-ink-soft"
                                aria-hidden="true"
                            />
                            <input
                                type="search"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by ID, requester, title, personnel, asset..."
                                className="w-full rounded-lg border border-line-strong bg-surface py-1.5 pr-8 pl-9 text-xs text-ink placeholder:text-ink-soft focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="absolute top-1/2 right-2.5 -translate-y-1/2 text-ink-soft hover:text-ink"
                                    aria-label="Clear search"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>

                        <div className="flex items-center justify-between gap-2 sm:justify-end">
                            <span className="text-xs text-ink-soft">
                                Showing {filteredApprovals.length} of{' '}
                                {approvals.length} requests
                            </span>

                            <div className="flex items-center rounded-lg border border-line bg-surface-subtle p-0.5">
                                <button
                                    type="button"
                                    onClick={() => setViewMode('grid')}
                                    className={cn(
                                        'rounded-md p-1.5 text-xs transition-colors',
                                        viewMode === 'grid'
                                            ? 'bg-surface text-ink shadow-2xs'
                                            : 'text-ink-soft hover:text-ink',
                                    )}
                                    aria-label="Grid view"
                                    title="2-Column Grid View"
                                >
                                    <LayoutGrid className="h-3.5 w-3.5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setViewMode('list')}
                                    className={cn(
                                        'rounded-md p-1.5 text-xs transition-colors',
                                        viewMode === 'list'
                                            ? 'bg-surface text-ink shadow-2xs'
                                            : 'text-ink-soft hover:text-ink',
                                    )}
                                    aria-label="List view"
                                    title="1-Column Full Width View"
                                >
                                    <List className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Main Approvals Content Area */}
                {filteredApprovals.length === 0 ? (
                    <Panel>
                        <EmptyState
                            icon={ShieldCheck}
                            title={
                                approvals.length === 0
                                    ? 'No approvals need attention'
                                    : 'No approvals match selected criteria'
                            }
                            message={
                                approvals.length === 0
                                    ? 'All dispatch and reassignment requests awaiting manager decision are clear.'
                                    : 'Try adjusting your search query or switching active filter tabs above.'
                            }
                        />
                    </Panel>
                ) : (
                    <div
                        className={cn(
                            'grid gap-4',
                            viewMode === 'grid'
                                ? 'xl:grid-cols-2'
                                : 'grid-cols-1',
                        )}
                    >
                        {filteredApprovals.map((approval) => (
                            <ApprovalCard
                                key={approval.id}
                                approval={approval}
                                canDecide={canDecide && approval.can_decide}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
