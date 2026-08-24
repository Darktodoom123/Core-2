import { router } from '@inertiajs/react';
import { Ban, Check, LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '@/components/ui';
import type { SosIncidentViewModel } from '@/types/workspace';

const RESOLUTION_OPTIONS = [
    { value: 'worker_safe', label: 'Worker safe' },
    { value: 'medical_assistance', label: 'Medical assistance' },
    {
        value: 'emergency_services_contacted',
        label: 'Emergency services contacted',
    },
    { value: 'asset_secured', label: 'Asset secured' },
    { value: 'other', label: 'Other outcome' },
] as const;

interface SosResolutionFormProps {
    incident: SosIncidentViewModel;
}

export function SosResolutionForm({ incident }: SosResolutionFormProps) {
    const [resolutionCode, setResolutionCode] = useState('');
    const [resolutionNotes, setResolutionNotes] = useState('');
    const [cancellationReason, setCancellationReason] = useState('');
    const [submitting, setSubmitting] = useState<'resolve' | 'cancel' | null>(
        null,
    );
    const [error, setError] = useState<string | null>(null);

    if (!incident.can_resolve && !incident.can_cancel) {
        return null;
    }

    const submitResolution = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!resolutionCode || resolutionNotes.trim().length < 1) {
            setError(
                'Choose an outcome and enter a closure note before resolving.',
            );

            return;
        }

        setSubmitting('resolve');
        setError(null);
        router.post(
            `/operations/sos-incidents/${incident.id}/resolve`,
            {
                resolution_code: resolutionCode,
                resolution_notes: resolutionNotes.trim(),
            },
            {
                preserveScroll: true,
                onError: () =>
                    setError(
                        'The server rejected this resolution. The entered outcome was preserved.',
                    ),
                onFinish: () => setSubmitting(null),
            },
        );
    };

    const submitCancellation = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (cancellationReason.trim().length < 1) {
            setError('Enter a reason before recording a false alarm.');

            return;
        }

        setSubmitting('cancel');
        setError(null);
        router.post(
            `/operations/sos-incidents/${incident.id}/cancel`,
            { cancellation_reason: cancellationReason.trim() },
            {
                preserveScroll: true,
                onError: () =>
                    setError(
                        'The server rejected this cancellation. The entered reason was preserved.',
                    ),
                onFinish: () => setSubmitting(null),
            },
        );
    };

    return (
        <div className="space-y-5 border-t border-line pt-5">
            {incident.can_resolve && (
                <form className="space-y-4" onSubmit={submitResolution}>
                    <div>
                        <h3 className="text-base font-semibold text-ink">
                            Resolve emergency
                        </h3>
                        <p className="mt-1 text-sm leading-5 text-ink-soft">
                            Resolution is a separate audited action. Record what
                            happened and the safe outcome.
                        </p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                        <label className="text-sm font-medium text-ink">
                            Outcome code
                            <select
                                value={resolutionCode}
                                onChange={(event) =>
                                    setResolutionCode(event.target.value)
                                }
                                className="mt-1 min-h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm"
                                required
                            >
                                <option value="">Select an outcome</option>
                                {RESOLUTION_OPTIONS.map((option) => (
                                    <option
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="text-sm font-medium text-ink">
                            Closure note
                            <textarea
                                value={resolutionNotes}
                                onChange={(event) =>
                                    setResolutionNotes(event.target.value)
                                }
                                className="mt-1 min-h-24 w-full resize-y rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm"
                                maxLength={2000}
                                required
                                aria-describedby="sos-resolution-note-help"
                            />
                            <span
                                id="sos-resolution-note-help"
                                className="mt-1 block text-xs font-normal text-ink-soft"
                            >
                                Keep the operational outcome concise. Do not add
                                private medical details.
                            </span>
                        </label>
                    </div>
                    <Button
                        type="submit"
                        variant="primary"
                        disabled={submitting !== null}
                    >
                        {submitting === 'resolve' ? (
                            <LoaderCircle
                                className="h-4 w-4 animate-spin"
                                aria-hidden="true"
                            />
                        ) : (
                            <Check className="h-4 w-4" aria-hidden="true" />
                        )}
                        {submitting === 'resolve'
                            ? 'Recording resolution…'
                            : 'Resolve emergency'}
                    </Button>
                </form>
            )}

            {incident.can_cancel && (
                <details className="rounded-lg border border-line bg-surface-subtle p-3">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-semibold text-ink">
                        <Ban
                            className="h-4 w-4 text-warning-strong"
                            aria-hidden="true"
                        />
                        Record false alarm
                    </summary>
                    <form
                        className="mt-3 space-y-3"
                        onSubmit={submitCancellation}
                    >
                        <label className="block text-sm font-medium text-ink">
                            Reason
                            <textarea
                                value={cancellationReason}
                                onChange={(event) =>
                                    setCancellationReason(event.target.value)
                                }
                                className="mt-1 min-h-20 w-full resize-y rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm"
                                maxLength={1000}
                                required
                                aria-describedby="sos-cancellation-help"
                            />
                            <span
                                id="sos-cancellation-help"
                                className="mt-1 block text-xs font-normal text-ink-soft"
                            >
                                This preserves the incident and its audit
                                record; it does not delete the alert.
                            </span>
                        </label>
                        <Button
                            type="submit"
                            variant="danger"
                            disabled={submitting !== null}
                        >
                            {submitting === 'cancel' ? (
                                <LoaderCircle
                                    className="h-4 w-4 animate-spin"
                                    aria-hidden="true"
                                />
                            ) : (
                                <Ban className="h-4 w-4" aria-hidden="true" />
                            )}
                            {submitting === 'cancel'
                                ? 'Recording false alarm…'
                                : 'Record false alarm'}
                        </Button>
                    </form>
                </details>
            )}

            {error && (
                <p className="text-sm text-danger" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
}
