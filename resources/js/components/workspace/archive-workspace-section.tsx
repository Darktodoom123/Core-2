import { router, useForm } from '@inertiajs/react';
import { Archive, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button, EmptyState, PageHeading, Panel } from '@/components/ui';
import { CanonicalStatusBadge } from '@/components/workspace/canonical-status-badge';
import type { ArchivedJobViewModel, WorkspaceCapabilities } from '@/types/workspace';

export function ArchiveSurface({
    jobs = [],
    capabilities,
}: {
    jobs?: ArchivedJobViewModel[];
    capabilities: WorkspaceCapabilities;
}) {
    const [selectedJob, setSelectedJob] = useState<ArchivedJobViewModel | null>(null);

    return (
        <div>
            <PageHeading
                title="Archived & canceled dispatches"
                description="View soft-deleted operational dispatches, review archive reasons, and restore dispatches to active state."
            />
            <div className="space-y-6 p-4 md:p-6">
                {jobs.length === 0 ? (
                    <Panel>
                        <EmptyState
                            icon={Archive}
                            title="No archived dispatches"
                            message="Dispatches soft-deleted or archived by administrators will appear here for audit and restoration."
                        />
                    </Panel>
                ) : (
                    <Panel className="overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="border-b border-line bg-surface-subtle text-xs font-semibold text-ink-soft uppercase">
                                    <tr>
                                        <th className="px-4 py-3">Reference</th>
                                        <th className="px-4 py-3">Client</th>
                                        <th className="px-4 py-3">Title</th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3">Archived / Deleted</th>
                                        <th className="px-4 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-line">
                                    {jobs.map((job) => (
                                        <tr key={job.id} className="hover:bg-surface-subtle/50">
                                            <td className="px-4 py-3 font-semibold text-ink font-mono">
                                                {job.reference}
                                            </td>
                                            <td className="px-4 py-3 text-ink">{job.client}</td>
                                            <td className="px-4 py-3 text-ink font-medium">{job.title}</td>
                                            <td className="px-4 py-3">
                                                <CanonicalStatusBadge status={job.status} />
                                            </td>
                                            <td className="px-4 py-3 text-xs text-ink-soft">
                                                {job.deleted_at ? new Date(job.deleted_at).toLocaleString() : 'N/A'}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {capabilities.restore_dispatch && (
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        onClick={() => setSelectedJob(job)}
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
            <Panel className="w-full max-w-lg p-6 space-y-4">
                <h3 className="text-lg font-bold text-ink">
                    Restore Dispatch {job.reference}
                </h3>
                <p className="text-sm text-ink-soft">
                    Restoring this dispatch will remove its archived soft-delete flag and return it to active workspace operations.
                </p>
                <form onSubmit={submit} className="space-y-4" noValidate>
                    <div>
                        <label className="block text-sm font-medium text-ink">
                            Reason for restoration *
                        </label>
                        <input
                            type="text"
                            value={form.data.reason}
                            onChange={(e) => form.setData('reason', e.target.value)}
                            className="mt-1 h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm"
                            placeholder="e.g. Accidental archive by dispatcher"
                            required
                        />
                        {form.errors.reason && (
                            <p className="mt-1 text-xs text-danger">{form.errors.reason}</p>
                        )}
                    </div>

                    <div className="flex justify-end gap-3 pt-2 border-t border-line">
                        <Button type="button" variant="secondary" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            disabled={form.processing || !form.data.reason.trim()}
                        >
                            {form.processing ? 'Restoring…' : 'Confirm Restoration'}
                        </Button>
                    </div>
                </form>
            </Panel>
        </div>
    );
}
