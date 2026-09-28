import { MapPin } from 'lucide-react';
import { formatCoordinates } from '@/lib/coordinates';
import { cn } from '@/lib/utils';
import {
    ADDRESS_PENDING_LABEL,
    ADDRESS_UNAVAILABLE_LABEL,
    placeLabel,
    usePlace,
} from '@/services/reverse-geocoder';
import type { PlaceViewModel } from '@/types/workspace';

export { formatCoordinates };

interface LocationLabelProps {
    latitude: number | null | undefined;
    longitude: number | null | undefined;
    accuracyMetres?: number | null;
    /** Place the server already resolved; skips the client lookup. */
    place?: PlaceViewModel | null;
    /**
     * stacked: address, area, then coordinates (detail panels).
     * inline: one line, "address · coordinates" (tables, lists).
     * compact: address only, coordinates in the tooltip (tight rows).
     */
    variant?: 'stacked' | 'inline' | 'compact';
    /** Shown when there is no GPS fix at all. */
    emptyLabel?: string;
    showIcon?: boolean;
    className?: string;
}

/**
 * The one way a coordinate is shown in Operations: the nearest mapped
 * address first, the exact coordinates beside it. Never shows coordinates
 * alone as if they were a place, and never invents a location.
 */
export function LocationLabel({
    latitude,
    longitude,
    accuracyMetres,
    place: serverPlace,
    variant = 'stacked',
    emptyLabel = 'No GPS fix',
    showIcon = true,
    className,
}: LocationLabelProps) {
    const place = usePlace(latitude, longitude, serverPlace);

    if (place.status === 'none' || latitude == null || longitude == null) {
        return (
            <span className={cn('text-ink-soft', className)}>{emptyLabel}</span>
        );
    }

    const coordinates = formatCoordinates(latitude, longitude);
    const accuracy =
        accuracyMetres != null && Number.isFinite(Number(accuracyMetres))
            ? ` ±${Math.max(1, Math.round(Number(accuracyMetres)))} m`
            : '';
    const headline =
        place.status === 'resolved'
            ? variant === 'stacked'
                ? place.primary
                : (placeLabel(place) ?? place.primary)
            : place.status === 'pending'
              ? ADDRESS_PENDING_LABEL
              : ADDRESS_UNAVAILABLE_LABEL;
    const headlineTone =
        place.status === 'resolved' ? 'text-ink' : 'text-ink-soft italic';
    const icon = showIcon ? (
        <MapPin
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-strong"
            aria-hidden="true"
        />
    ) : null;

    if (variant === 'compact') {
        return (
            <span
                className={cn('inline-flex min-w-0 items-start gap-1', className)}
                title={`${coordinates}${accuracy}`}
            >
                {icon}
                <span className={cn('min-w-0 truncate', headlineTone)}>
                    {headline}
                </span>
            </span>
        );
    }

    if (variant === 'inline') {
        return (
            <span
                className={cn(
                    'inline-flex min-w-0 flex-wrap items-start gap-x-1.5',
                    className,
                )}
            >
                {icon}
                <span className={cn('font-medium', headlineTone)}>
                    {headline}
                </span>
                <span className="font-mono text-xs text-ink-soft tabular-nums">
                    {coordinates}
                    {accuracy}
                </span>
            </span>
        );
    }

    return (
        <span className={cn('flex min-w-0 items-start gap-1.5', className)}>
            {icon}
            <span className="min-w-0">
                <span
                    className={cn('block font-medium break-words', headlineTone)}
                    aria-live="polite"
                >
                    {headline}
                </span>
                {place.status === 'resolved' && place.secondary && (
                    <span className="block text-xs break-words text-ink-soft">
                        {place.secondary}
                    </span>
                )}
                <span className="block font-mono text-xs text-ink-soft tabular-nums">
                    {coordinates}
                    {accuracy}
                </span>
            </span>
        </span>
    );
}
