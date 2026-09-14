import {
    AlertTriangle,
    CheckCircle2,
    TrendingDown,
    TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FuelVarianceBadgeProps {
    variancePercentage?: string | number | null;
    varianceLitres?: string | number | null;
    isAnomaly?: boolean;
    compact?: boolean;
    className?: string;
}

export function FuelVarianceBadge({
    variancePercentage,
    varianceLitres,
    isAnomaly = false,
    compact = false,
    className,
}: FuelVarianceBadgeProps) {
    if (variancePercentage === null || variancePercentage === undefined) {
        if (isAnomaly) {
            return (
                <span
                    className={cn(
                        'inline-flex items-center gap-1 rounded-md border border-danger/30 bg-danger-soft px-2 py-0.5 text-xs font-semibold text-danger-strong',
                        className,
                    )}
                    title="Fuel consumption variance exceeds baseline threshold by >= 15%"
                >
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    <span>Consumption Anomaly</span>
                </span>
            );
        }

        return null;
    }

    const pct =
        typeof variancePercentage === 'number'
            ? variancePercentage
            : parseFloat(String(variancePercentage)) || 0;

    const litres =
        typeof varianceLitres === 'number'
            ? varianceLitres
            : parseFloat(String(varianceLitres)) || 0;

    const hasAnomaly = isAnomaly || pct >= 15.0;
    const isUnder = pct < 0;

    if (compact) {
        if (hasAnomaly) {
            return (
                <span
                    className={cn(
                        'inline-flex items-center gap-1 rounded-md border border-danger/30 bg-danger-soft px-2 py-0.5 text-[10px] font-semibold text-danger-strong',
                        className,
                    )}
                    title={`Consumption Anomaly: +${pct.toFixed(1)}% (${litres > 0 ? `+${litres.toFixed(1)}L` : ''}) exceeds equipment baseline`}
                >
                    <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
                    <span className="tabular-nums">
                        +{pct.toFixed(1)}% Anomaly
                    </span>
                </span>
            );
        }

        if (isUnder) {
            return (
                <span
                    className={cn(
                        'inline-flex items-center gap-1 rounded-md border border-success/30 bg-success-soft px-2 py-0.5 text-[10px] font-semibold text-success-strong',
                        className,
                    )}
                    title={`Fuel Efficient: ${pct.toFixed(1)}% vs baseline`}
                >
                    <TrendingDown className="h-2.5 w-2.5 shrink-0" />
                    <span className="tabular-nums">{pct.toFixed(1)}%</span>
                </span>
            );
        }

        return (
            <span
                className={cn(
                    'inline-flex items-center gap-1 rounded-md border border-line bg-surface-subtle px-2 py-0.5 text-[10px] font-medium text-ink-soft',
                    className,
                )}
            >
                <TrendingUp className="h-2.5 w-2.5 shrink-0" />
                <span className="tabular-nums">
                    {pct > 0 ? `+${pct.toFixed(1)}%` : `${pct.toFixed(1)}%`}
                </span>
            </span>
        );
    }

    return (
        <div
            className={cn(
                'inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 text-xs',
                hasAnomaly
                    ? 'border-danger/40 bg-danger-soft font-semibold text-danger-strong'
                    : isUnder
                      ? 'border-success/30 bg-success-soft font-medium text-success-strong'
                      : 'border-line bg-surface-subtle font-medium text-ink-soft',
                className,
            )}
        >
            {hasAnomaly ? (
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-danger-strong" />
            ) : isUnder ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success-strong" />
            ) : (
                <TrendingUp className="h-3.5 w-3.5 shrink-0 text-ink-soft" />
            )}

            <div>
                <div className="flex items-center gap-1">
                    <span>
                        {hasAnomaly
                            ? 'Burn Rate Anomaly'
                            : isUnder
                              ? 'Efficient Consumption'
                              : 'Nominal Consumption'}
                    </span>
                    <span className="font-mono text-[11px] tabular-nums">
                        (
                        {pct > 0 ? `+${pct.toFixed(1)}%` : `${pct.toFixed(1)}%`}
                        )
                    </span>
                </div>
                {litres !== 0 && (
                    <span className="block text-[10px] tabular-nums opacity-80">
                        {litres > 0
                            ? `+${litres.toFixed(1)}L excess`
                            : `${litres.toFixed(1)}L saved`}{' '}
                        vs baseline
                    </span>
                )}
            </div>
        </div>
    );
}
