import { AlertTriangle, Check } from 'lucide-react';
import React from 'react';
import { cn } from '@/lib/utils';
import type { WorkspaceFlash } from '@/types/workspace';

export function DispatchAlertBanners({
    flash,
    conflictMessage,
}: {
    flash: WorkspaceFlash | null;
    conflictMessage: string | null;
}) {
    return (
        <>
            {flash && (
                <div
                    className={cn(
                        'flex items-start gap-3 rounded-lg border px-4 py-3 text-sm',
                        flash.tone === 'success' &&
                            'border-success bg-success-soft text-success-strong',
                        flash.tone === 'warning' &&
                            'border-warning bg-warning-soft text-warning-strong',
                        flash.tone === 'error' &&
                            'border-danger bg-danger-soft text-danger',
                        flash.tone === 'info' &&
                            'border-info bg-info-soft text-info-strong',
                    )}
                    role="status"
                    aria-live="polite"
                    aria-atomic="true"
                >
                    <Check
                        className="mt-0.5 h-4 w-4 shrink-0"
                        aria-hidden="true"
                    />
                    {flash.message}
                </div>
            )}

            {conflictMessage && (
                <div
                    className="flex items-start gap-3 rounded-lg border border-danger bg-danger-soft px-4 py-3 text-sm text-danger"
                    role="alert"
                    aria-live="assertive"
                    aria-atomic="true"
                >
                    <AlertTriangle
                        className="mt-0.5 h-4 w-4 shrink-0"
                        aria-hidden="true"
                    />
                    <div>
                        <p className="font-semibold">
                            Assignment could not be saved
                        </p>
                        <p className="mt-1">{conflictMessage}</p>
                        <p className="mt-1 text-xs">
                            Eligibility was rechecked against the current
                            schedule. Review the resource state below and try
                            again.
                        </p>
                    </div>
                </div>
            )}
        </>
    );
}
