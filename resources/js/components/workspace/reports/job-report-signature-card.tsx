import { CheckCircle2, Clock, MapPin, UserCheck } from 'lucide-react';
import { formatDateTime } from '@/lib/formatters';
import { cn } from '@/lib/utils';

interface JobReportSignatureCardProps {
    signerName?: string | null;
    signerRole?: string | null;
    signedAt?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    className?: string;
}

export function JobReportSignatureCard({
    signerName,
    signerRole,
    signedAt,
    latitude,
    longitude,
    className,
}: JobReportSignatureCardProps) {
    const isSigned = Boolean(signerName && signerName.trim() !== '');

    if (!isSigned) {
        return (
            <div
                className={cn(
                    'rounded-xl border border-warning/30 bg-warning-soft/20 p-4 text-xs',
                    className,
                )}
            >
                <div className="flex items-center gap-2 font-semibold text-warning-strong">
                    <Clock className="h-4 w-4" />
                    <span>Client Sign-Off: Not recorded</span>
                </div>
                <p className="mt-1 text-ink-soft">
                    This job report was submitted from the field without
                    recorded client sign-off metadata. Verify physical paper
                    ticket or on-site delivery slip before final approval.
                </p>
            </div>
        );
    }

    return (
        <div
            className={cn(
                'rounded-xl border border-success/40 bg-success-soft/15 p-4 text-xs',
                className,
            )}
        >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-success/20 pb-3">
                <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-success-soft text-success-strong">
                        <UserCheck className="h-4 w-4" />
                    </span>
                    <div>
                        <span className="text-[10px] font-bold tracking-wider text-success-strong uppercase">
                            Recorded Client Sign-Off
                        </span>
                        <h4 className="text-sm font-bold text-ink">
                            {signerName}
                        </h4>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                    <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success-soft px-2.5 py-0.5 text-[11px] font-semibold text-success-strong">
                        <CheckCircle2 className="h-3 w-3" />
                        Sign-Off Recorded
                    </span>
                    <span className="text-[10px] text-ink-soft">
                        Field receipt; distinct from office review
                    </span>
                </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div>
                    <span className="text-[10px] font-bold text-ink-soft uppercase">
                        Signer Role / Title
                    </span>
                    <p className="font-medium text-ink">
                        {signerRole || 'Client Site Representative'}
                    </p>
                </div>

                <div>
                    <span className="text-[10px] font-bold text-ink-soft uppercase">
                        Signature Timestamp
                    </span>
                    <p className="font-medium text-ink">
                        {signedAt
                            ? formatDateTime(signedAt)
                            : 'Recorded at submission'}
                    </p>
                </div>

                <div>
                    <span className="text-[10px] font-bold text-ink-soft uppercase">
                        Location Stamp
                    </span>
                    <p className="flex items-center gap-1 font-mono text-ink">
                        <MapPin className="h-3 w-3 text-brand-strong" />
                        {latitude !== null &&
                        longitude !== null &&
                        latitude !== undefined &&
                        longitude !== undefined
                            ? `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
                            : 'Location not recorded'}
                    </p>
                </div>
            </div>
        </div>
    );
}
