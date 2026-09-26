import { formatCountdown, formatElapsed } from './manager-dashboard-model';
import { useNow } from './use-now';

const TICK_MS = 1_000;

/** Per-second countdown kept in a leaf so the dashboard itself stays calm. */
export function LiveCountdown({
    target,
    expiredLabel,
}: {
    target: number;
    expiredLabel: string;
}) {
    const now = useNow(TICK_MS);

    return <>{target > now ? formatCountdown(target - now) : expiredLabel}</>;
}

export function LiveElapsed({ since }: { since: string | null }) {
    const now = useNow(TICK_MS);

    return <>{formatElapsed(since, now, { precise: true }) ?? '—'}</>;
}

/** Fraction of an interval that has elapsed, re-rendered each second. */
export function LiveProgress({
    start,
    end,
    className,
    fillClassName,
}: {
    start: number;
    end: number;
    className?: string;
    fillClassName?: string;
}) {
    const now = useNow(TICK_MS);
    const progress = Math.min(
        100,
        Math.max(0, ((now - start) / Math.max(1, end - start)) * 100),
    );

    return (
        <span className={className} aria-hidden="true">
            <span className={fillClassName} style={{ width: `${progress}%` }} />
        </span>
    );
}
