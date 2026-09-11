import {
    AlertTriangle,
    CheckCircle2,
    ClipboardCheck,
    Fuel,
    Link as LinkIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CrossReferences {
    associated_dvirs?: Array<{
        id: number;
        reference: string;
        has_defects: boolean;
        critical_defects_count?: number;
    }>;
    associated_fuel_requests?: Array<{
        id: number;
        reference: string;
        quantity_litres: string;
    }>;
}

interface JobReportCrossReferencesProps {
    crossReferences?: CrossReferences;
    className?: string;
}

export function JobReportCrossReferences({
    crossReferences,
    className,
}: JobReportCrossReferencesProps) {
    const dvirs = crossReferences?.associated_dvirs ?? [];
    const fuels = crossReferences?.associated_fuel_requests ?? [];

    const hasReferences = dvirs.length > 0 || fuels.length > 0;

    if (!hasReferences) {
        return null;
    }

    return (
        <div
            className={cn(
                'space-y-4 rounded-xl border border-line bg-surface p-4 text-xs',
                className,
            )}
        >
            <div className="flex items-center gap-1.5 border-b border-line pb-2.5 font-semibold text-ink">
                <LinkIcon className="h-4 w-4 text-brand-strong" />
                <span>Operational Cross-References</span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                {/* Associated DVIRs */}
                <div className="space-y-2">
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-ink-soft uppercase">
                        <ClipboardCheck className="h-3.5 w-3.5 text-ink-soft" />
                        <span>
                            Pre/Post-Trip DVIR Inspections ({dvirs.length})
                        </span>
                    </span>

                    {dvirs.length === 0 ? (
                        <p className="text-xs text-ink-soft italic">
                            No DVIR inspection sheets linked to this job.
                        </p>
                    ) : (
                        <ul className="space-y-1.5">
                            {dvirs.map((dvir) => (
                                <li
                                    key={dvir.id}
                                    className="flex items-center justify-between rounded-lg border border-line bg-surface-subtle px-3 py-2"
                                >
                                    <span className="font-mono font-medium text-ink">
                                        {dvir.reference}
                                    </span>
                                    {dvir.has_defects ? (
                                        <span className="inline-flex items-center gap-1 rounded-full border border-danger/30 bg-danger-soft px-2 py-0.5 text-[10px] font-semibold text-danger-strong">
                                            <AlertTriangle className="h-2.5 w-2.5" />
                                            Defect Flagged
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success-soft px-2 py-0.5 text-[10px] font-semibold text-success-strong">
                                            <CheckCircle2 className="h-2.5 w-2.5" />
                                            Passed
                                        </span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Associated Fuel Tickets */}
                <div className="space-y-2">
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-ink-soft uppercase">
                        <Fuel className="h-3.5 w-3.5 text-ink-soft" />
                        <span>Fuel Requests ({fuels.length})</span>
                    </span>

                    {fuels.length === 0 ? (
                        <p className="text-xs text-ink-soft italic">
                            No fuel request tickets linked to this job.
                        </p>
                    ) : (
                        <ul className="space-y-1.5">
                            {fuels.map((fuel) => (
                                <li
                                    key={fuel.id}
                                    className="flex items-center justify-between rounded-lg border border-line bg-surface-subtle px-3 py-2"
                                >
                                    <span className="font-mono font-medium text-ink">
                                        {fuel.reference}
                                    </span>
                                    <span className="font-mono text-xs font-semibold text-ink">
                                        {fuel.quantity_litres} L
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}
