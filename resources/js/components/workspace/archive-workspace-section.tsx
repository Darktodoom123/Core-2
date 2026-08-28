import { router, useForm } from '@inertiajs/react';
import { Archive, Filter, RotateCcw, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Button, EmptyState, PageHeading, Panel } from '@/components/ui';
import { CanonicalStatusBadge } from '@/components/workspace/canonical-status-badge';
import { formatDateTime } from '@/lib/formatters';
import type {
    ArchivedJobViewModel,
    WorkspaceCapabilities,
} from '@/types/workspace';

export function ArchiveSurface({
    jobs = [],
    capabilities,
}: {
    jobs?: ArchivedJobViewModel[];
    capabilities: WorkspaceCapabilities;
}) {
    const [selectedJob, setSelectedJob] = useState<ArchivedJobViewModel | null>(
        null,
    );
    const [searchQuery, setSearchQuery] = useState('');

    const filteredJobs = useMemo(() => {
        if (!searchQuery.trim()) {
            return jobs;
        }

        const query = searchQuery.toLowerCase().trim();

        return jobs.filter((job) => {
            const ref = job.reference.toLowerCase();
            const client = job.client.toLowerCase();
            const title = job.title.toLowerCase();
            const reason = job.cancellation_reason?.toLowerCase() ?? '';

            return (
                ref.includes(query) ||
                client.includes(query) ||
                title.includes(query) ||
                reason.includes(query)
            );
        });
    }, [jobs, searchQuery]);

    return (
        <div className="workspace-width-contained">
            <PageHeading
                title="Archived & canceled dispatches"
                description="View soft-deleted operational dispatches, review archive reasons, and restore dispatches to active state."
            />
            <div className="space-y-6 p-4 md:p-6">
                {/* Search Bar */}
                {jobs.length > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="relative w-full sm:w-72">
                            <Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-ink-soft" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by reference, client, or reason…"
                                className="h-11 w-full rounded-lg border border-line bg-surface pr-14 pl-8 text-xs text-ink placeholder:text-ink-soft focus:border-brand focus:outline-none"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="absolute top-1/2 right-1 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-ink-soft hover:text-ink"
                                    aria-label="Clear search"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>
                        <span className="text-xs text-ink-soft">
                            {filteredJobs.length} of {jobs.length} archived
                        </span>
                    </div>
                )}

                {jobs.length === 0 ? (
                    <Panel>
                        <EmptyState
                            icon={Archive}
                            title="No archived dispatches"
                            message="Dispatches soft-deleted or archived by administrators will appear here for audit and restoration."
                        />
                    </Panel>
                ) : filteredJobs.length === 0 ? (
                    <Panel>
                        <EmptyState
                            icon={Filter}
                            title="No matching dispatches"
                            message="No archived dispatches match the search term."
                        />
                    </Panel>
                ) : (
                    <Panel className="overflow-hidden">
                        <div
                            className="workspace-scroll-region"
                            role="region"
                            aria-label="Archived dispatches table scroll region"
                            tabIndex={0}
                        >
                            <table className="w-full text-left text-sm">
                                <thead className="border-b border-line bg-surface-subtle text-xs font-semibold text-ink-soft uppercase">
                                    <tr>
                                        <th className="px-4 py-3">Reference</th>
                                        <th className="px-4 py-3">Client</th>
                                        <th className="px-4 py-3">Title</th>
                                        <th className="px-4 py-3">
                                            Status & Reason
                                        </th>
                                        <th className="px-4 py-3">
                                            Archived At
                                        </th>
                                        <th className="px-4 py-3 text-right">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-line">
                                    {filteredJobs.map((job) => (
                                        <tr
                                            key={job.id}
                                            className="hover:bg-surface-subtle/50"
                                        >
                                            <td className="px-4 py-3 font-mono font-semibold text-ink">
                                                {job.reference}
                                            </td>
                                            <td className="px-4 py-3 text-ink">
                                                {job.client}
                                            </td>
                                            <td className="px-4 py-3 font-medium text-ink">
                                                {job.title}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="space-y-1">
                                                    <CanonicalStatusBadge
                                                        status={job.status}
                                                    />
                                                    {job.cancellation_reason && (
                                                        <p className="max-w-xs text-xs text-ink-soft italic">
                                                            “
                                                            {
                                                                job.cancellation_reason
                                                            }
                                                            ”
                                                        </p>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-ink-soft">
                                                {job.deleted_at
                                                    ? formatDateTime(
                                                          job.deleted_at,
                                                      )
                                                    : 'N/A'}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {capabilities.restore_dispatch && (
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        onClick={() =>
                                                            setSelectedJob(job)
                                                        }
                                                    >
                                                        <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                                                        Restore
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Panel>
                )}

                {selectedJob && (
                    <RestoreJobModal
                        job={selectedJob}
                        onClose={() => setSelectedJob(null)}
                    />
                )}
            </div>
        </div>
    );
}

function RestoreJobModal({
    job,
    onClose,
}: {
    job: ArchivedJobViewModel;
    onClose: () => void;
}) {
    const form = useForm({
        reason: '',
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        router.post(
            `/operations/dispatch-jobs/${job.id}/restore`,
            { reason: form.data.reason },
            {
                preserveScroll: true,
                onSuccess: () => {
                    form.reset();
                    onClose();
                },
            },
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <Panel className="w-full max-w-lg space-y-4 p-6 shadow-xl">
                <div className="flex items-center justify-between border-b border-line pb-3">
                    <h3 className="text-lg font-bold text-ink">
                        Restore Dispatch {job.reference}
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-1 text-ink-soft hover:bg-surface-subtle hover:text-ink"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <p className="text-sm text-ink-soft">
                    Restoring this dispatch will remove its archived soft-delete
                    flag and return it to active workspace operations.
                </p>
                <form onSubmit={submit} className="space-y-4" noValidate>
                    <div>
                        <label className="block text-xs font-semibold text-ink uppercase">
                            Reason for restoration *
                        </label>
                        <input
                            type="text"
                            value={form.data.reason}
                            onChange={(e) =>
                                form.setData('reason', e.target.value)
                            }
                            className="mt-1 h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm focus:border-brand focus:outline-none"
                            placeholder="e.g. Accidental archive / Reopened with client approval"
                            required
                        />
                        {form.errors.reason && (
                            <p className="mt-1 text-xs text-danger">
                                {form.errors.reason}
                            </p>
                        )}
                    </div>

                    <div className="flex justify-end gap-3 border-t border-line pt-3">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={onClose}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            disabled={
                                form.processing || !form.data.reason.trim()
                            }
                        >
                            {form.processing
                                ? 'Restoring…'
                                : 'Confirm Restoration'}
                        </Button>
                    </div>
                </form>
            </Panel>
        </div>
    );
}
