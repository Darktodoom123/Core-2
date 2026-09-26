import { router } from '@inertiajs/react';
import { CheckCircle2, LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { SosIncidentViewModel } from '@/types/workspace';

interface SosAcknowledgeControlProps {
    incident: SosIncidentViewModel;
    size?: 'sm' | 'md';
    className?: string;
}

export function SosAcknowledgeControl({
    incident,
    size = 'md',
    className,
}: SosAcknowledgeControlProps) {
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!incident.can_acknowledge) {
        return null;
    }

    const acknowledge = () => {
        if (submitting) {
            return;
        }

        setSubmitting(true);
        setError(null);
        router.post(
            `/operations/sos-incidents/${incident.id}/acknowledge`,
            {},
            {
                preserveScroll: true,
                onError: () =>
                    setError(
                        'The server could not record your acknowledgement. Refresh the queue before trying again.',
                    ),
                onFinish: () => setSubmitting(false),
            },
        );
    };

    return (
        <div className="space-y-2">
            <Button
                variant="primary"
                size={size}
                onClick={acknowledge}
                disabled={submitting}
                className={cn('w-full sm:w-auto', className)}
            >
                {submitting ? (
                    <LoaderCircle
                        className="h-4 w-4 animate-spin"
                        aria-hidden="true"
                    />
                ) : (
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                )}
                {submitting
                    ? 'Recording acknowledgement…'
                    : 'Acknowledge emergency'}
            </Button>
            {error && (
                <p className="text-sm text-danger" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
}
