import { router, useForm } from '@inertiajs/react';
import { AlertTriangle, CheckCircle, Clock, Sparkles, XCircle } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button, EmptyState, PageHeading, Panel } from '@/components/ui';
import type { GptRecommendationViewModel, WorkspaceCapabilities } from '@/types/workspace';

export function GptRecommendationsSurface({
    recommendations = [],
    capabilities,
}: {
    recommendations?: GptRecommendationViewModel[];
    capabilities: WorkspaceCapabilities;
}) {
    const [selectedForAccept, setSelectedForAccept] = useState<GptRecommendationViewModel | null>(null);
    const [selectedForReject, setSelectedForReject] = useState<GptRecommendationViewModel | null>(null);

    const pending = recommendations.filter((r) => r.status === 'pending_review' && !r.is_expired);
    const history = recommendations.filter((r) => r.status !== 'pending_review' || r.is_expired);

    return (
        <div>
            <PageHeading
                title="GPT AI Advisory & Resource Recommendations"
                description="Review explainable AI dispatch and operational recommendations. All recommendations are purely advisory and require explicit human confirmation to apply."
            />

            <div className="space-y-6 p-4 md:p-6">
                {/* Pending Recommendations Section */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-base font-semibold text-ink flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-amber-500" />
                            Pending Human Review ({pending.length})
                        </h3>
                    </div>

                    {pending.length === 0 ? (
                        <Panel>
                            <EmptyState
                                icon={Sparkles}
                                title="No pending AI recommendations"
                                message="When dispatchers or managers request AI assistance, pending proposed resource plans will appear here for review."
                            />
                        </Panel>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                            {pending.map((rec) => (
                                <Panel key={rec.id} className="p-5 space-y-4 border-amber-200 dark:border-amber-900/50 bg-amber-50/20 dark:bg-amber-950/10">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/60 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-200">
                                                    {rec.purpose.replace('_', ' ').toUpperCase()}
                                                </span>
                                                <span className="text-xs font-mono text-ink-soft">
                                                    {rec.model}
                                                </span>
                                            </div>
                                            <h4 className="mt-1 text-sm font-semibold text-ink">
                                                Recommendation #{rec.id} (Dispatch #{rec.subject_id})
                                            </h4>
                                        </div>

                                        <div className="flex items-center text-xs text-amber-700 dark:text-amber-400 font-medium gap-1 bg-amber-100/80 dark:bg-amber-900/40 px-2 py-1 rounded">
                                            <Clock className="h-3.5 w-3.5" />
                                            <span>
                                                {rec.expires_in_seconds ? `${Math.ceil(rec.expires_in_seconds / 60)}m left` : '15m window'}
                                            </span>
                                        </div>
                                    </div>

                                    {rec.prompt_summary && (
                                        <p className="text-xs text-ink-soft bg-surface-subtle p-2.5 rounded border border-line">
                                            <span className="font-semibold text-ink">Context Summary:</span> {rec.prompt_summary}
                                        </p>
                                    )}

                                    {/* Proposed Resource Plan Summary */}
                                    <div className="space-y-2 text-xs">
                                        <h5 className="font-semibold text-ink">Proposed Resource Plan:</h5>
                                        {rec.proposed_personnel && rec.proposed_personnel.length > 0 && (
                                            <div className="bg-surface p-2 rounded border border-line">
                                                <span className="font-medium text-ink">Personnel:</span>{' '}
                                                {rec.proposed_personnel.map((p) => `${p.name || `User #${p.user_id}`} (${p.assignment_type})`).join(', ')}
                                            </div>
                                        )}

                                        {rec.proposed_assets && rec.proposed_assets.length > 0 && (
                                            <div className="bg-surface p-2 rounded border border-line">
                                                <span className="font-medium text-ink">Assets:</span>{' '}
                                                {rec.proposed_assets.map((a) => `${a.name || a.asset_code || `Asset #${a.operational_asset_id}`} (${a.assignment_type})`).join(', ')}
                                            </div>
                                        )}
                                    </div>

                                    {rec.conflicts && rec.conflicts.length > 0 && (
                                        <div className="p-2.5 rounded bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
                                            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                                            <div>
                                                <span className="font-semibold">Conflict Warnings Detected:</span>
                                                <ul className="list-disc pl-4 mt-1 space-y-0.5">
                                                    {rec.conflicts.map((c, i) => (
                                                        <li key={i}>{String(c.reason || c.message || JSON.stringify(c))}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between pt-2 border-t border-line text-xs">
                                        <span className="text-ink-soft">
                                            Requested by <span className="font-medium text-ink">{rec.requested_by.name}</span>
                                        </span>

                                        {capabilities.decide_gpt_recommendation && (
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    onClick={() => setSelectedForReject(rec)}
                                                >
                                                    <XCircle className="mr-1 h-3.5 w-3.5 text-red-500" />
                                                    Reject
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="primary"
                                                    onClick={() => setSelectedForAccept(rec)}
                                                >
                                                    <CheckCircle className="mr-1 h-3.5 w-3.5 text-emerald-400" />
                                                    Accept Proposal
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </Panel>
                            ))}
                        </div>
                    )}
                </div>

                {/* Recommendation History Table */}
                <div className="space-y-4 pt-4">
                    <h3 className="text-base font-semibold text-ink">Recommendation Decision History</h3>
                    {history.length === 0 ? (
                        <Panel>
                            <EmptyState
                                icon={Clock}
                                title="No historical AI decisions"
                                message="Completed, accepted, rejected, and expired AI recommendations will be logged here for audit."
                            />
                        </Panel>
                    ) : (
                        <Panel className="overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="border-b border-line bg-surface-subtle text-xs font-semibold text-ink-soft uppercase">
                                        <tr>
                                            <th className="px-4 py-3">ID</th>
                                            <th className="px-4 py-3">Purpose</th>
                                            <th className="px-4 py-3">Status</th>
                                            <th className="px-4 py-3">Model</th>
                                            <th className="px-4 py-3">Requested By</th>
                                            <th className="px-4 py-3">Decided By</th>
                                            <th className="px-4 py-3">Decided At</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-line">
                                        {history.map((rec) => (
                                            <tr key={rec.id} className="hover:bg-surface-subtle/50 text-xs">
                                                <td className="px-4 py-3 font-semibold text-ink font-mono">#{rec.id}</td>
                                                <td className="px-4 py-3 text-ink font-medium capitalize">
                                                    {rec.purpose.replace('_', ' ')}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                                        rec.status === 'accepted'
                                                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200'
                                                            : rec.status === 'rejected'
                                                            ? 'bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200'
                                                            : rec.status === 'stale' || rec.is_expired
                                                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200'
                                                            : 'bg-surface-subtle text-ink-soft'
                                                    }`}>
                                                        {rec.is_expired ? 'Expired (15m)' : rec.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 font-mono text-ink-soft">{rec.model}</td>
                                                <td className="px-4 py-3 text-ink">{rec.requested_by.name}</td>
                                                <td className="px-4 py-3 text-ink">{rec.decided_by?.name || rec.decided_by_name || 'N/A'}</td>
                                                <td className="px-4 py-3 text-ink-soft">
                                                    {rec.decided_at ? new Date(rec.decided_at).toLocaleString() : 'N/A'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Panel>
                    )}
                </div>
            </div>

            {selectedForAccept && (
                <AcceptGptModal
                    rec={selectedForAccept}
                    onClose={() => setSelectedForAccept(null)}
                />
            )}

            {selectedForReject && (
                <RejectGptModal
                    rec={selectedForReject}
                    onClose={() => setSelectedForReject(null)}
                />
            )}
        </div>
    );
}

function AcceptGptModal({
    rec,
    onClose,
}: {
    rec: GptRecommendationViewModel;
    onClose: () => void;
}) {
    const [processing, setProcessing] = useState(false);

    function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setProcessing(true);

        router.post(
            `/operations/gpt-recommendations/${rec.id}/accept`,
            {},
            {
                onFinish: () => {
                    setProcessing(false);
                    onClose();
                },
            }
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-lg bg-surface p-6 shadow-xl space-y-4">
                <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle className="h-6 w-6" />
                    <h3 className="text-lg font-semibold text-ink">Accept AI Recommendation</h3>
                </div>

                <p className="text-sm text-ink-soft leading-relaxed">
                    You are confirming this AI recommendation under your active authenticated human account. This will execute the resource assignment transaction (<code className="text-xs bg-surface-subtle px-1 py-0.5 rounded">AssignDispatchResources</code>) for Dispatch #{rec.subject_id}.
                </p>

                <div className="p-3 bg-surface-subtle rounded border border-line text-xs space-y-1">
                    <p className="font-semibold text-ink">Authorization & Safeguard Verification:</p>
                    <p className="text-ink-soft">• Operational context hash will be re-validated at decision time.</p>
                    <p className="text-ink-soft">• Decision will be recorded in audit log as <code className="text-xs">gpt.recommendation_accepted</code>.</p>
                </div>

                <form onSubmit={handleSubmit} className="flex justify-end gap-3 pt-2">
                    <Button type="button" variant="secondary" onClick={onClose} disabled={processing}>
                        Cancel
                    </Button>
                    <Button type="submit" variant="primary" disabled={processing}>
                        {processing ? 'Applying Assignment...' : 'Confirm & Apply Resource Plan'}
                    </Button>
                </form>
            </div>
        </div>
    );
}

function RejectGptModal({
    rec,
    onClose,
}: {
    rec: GptRecommendationViewModel;
    onClose: () => void;
}) {
    const form = useForm({
        reason: '',
    });

    function handleSubmit(e: FormEvent) {
        e.preventDefault();

        form.post(`/operations/gpt-recommendations/${rec.id}/reject`, {
            onSuccess: () => onClose(),
        });
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-lg bg-surface p-6 shadow-xl space-y-4">
                <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
                    <XCircle className="h-6 w-6" />
                    <h3 className="text-lg font-semibold text-ink">Reject AI Recommendation</h3>
                </div>

                <p className="text-sm text-ink-soft">
                    Rejecting Recommendation #{rec.id} will update its status to rejected and preserve an audit log.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-ink mb-1">
                            Rejection Reason (Optional)
                        </label>
                        <input
                            type="text"
                            className="w-full rounded border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-amber-500 focus:outline-none"
                            placeholder="e.g. Driver requested off shift / Asset under inspection"
                            value={form.data.reason}
                            onChange={(e) => form.setData('reason', e.target.value)}
                        />
                        {form.errors.reason && (
                            <p className="mt-1 text-xs text-red-500">{form.errors.reason}</p>
                        )}
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <Button type="button" variant="secondary" onClick={onClose} disabled={form.processing}>
                            Cancel
                        </Button>
                        <Button type="submit" variant="secondary" className="bg-red-50 text-red-700 hover:bg-red-100 border-red-200" disabled={form.processing}>
                            {form.processing ? 'Rejecting...' : 'Confirm Rejection'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
