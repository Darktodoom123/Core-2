import type {
    SosIncidentCategoryValue,
    SosIncidentStatusValue,
} from '@/types/workspace';

export function humanizeSosValue(value: string): string {
    return value
        .replaceAll('_', ' ')
        .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function formatSosTimestamp(value: string | null): string {
    if (!value) {
        return 'Not recorded';
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? 'Not recorded'
        : date.toLocaleString([], {
              dateStyle: 'medium',
              timeStyle: 'short',
          });
}

export function formatSosAge(value: string, now = Date.now()): string {
    // new Date(null) is the epoch, so a missing time must not reach Date.
    const timestamp = value ? new Date(value).getTime() : Number.NaN;

    if (Number.isNaN(timestamp)) {
        return 'age unavailable';
    }

    const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));

    if (seconds < 60) {
        return `${seconds}s old`;
    }

    const minutes = Math.floor(seconds / 60);

    if (minutes < 60) {
        return `${minutes}m old`;
    }

    return `${Math.floor(minutes / 60)}h ${minutes % 60}m old`;
}

// Six decimal places is about 0.1 m: finer than any phone GPS fix, so the
// displayed value never rounds away real precision.
const COORDINATE_DECIMALS = 6;

export function formatSosCoordinates(
    latitude: number,
    longitude: number,
): string {
    return `${Number(latitude).toFixed(COORDINATE_DECIMALS)}, ${Number(longitude).toFixed(COORDINATE_DECIMALS)}`;
}

function toDms(value: number, positive: string, negative: string): string {
    const absolute = Math.abs(Number(value));
    let degrees = Math.floor(absolute);
    let minutes = Math.floor((absolute - degrees) * 60);
    let seconds = Number(
        ((absolute - degrees - minutes / 60) * 3600).toFixed(2),
    );

    if (seconds >= 60) {
        seconds = 0;
        minutes += 1;
    }

    if (minutes >= 60) {
        minutes = 0;
        degrees += 1;
    }

    return `${degrees}°${String(minutes).padStart(2, '0')}'${seconds.toFixed(2).padStart(5, '0')}"${value < 0 ? negative : positive}`;
}

export function formatSosCoordinatesDms(
    latitude: number,
    longitude: number,
): string {
    return `${toDms(latitude, 'N', 'S')} ${toDms(longitude, 'E', 'W')}`;
}

export function describeSosAccuracy(accuracyMetres: number | null): {
    label: string;
    quality: string;
    tone: 'success' | 'warning' | 'danger' | 'default';
} {
    if (accuracyMetres === null || Number.isNaN(Number(accuracyMetres))) {
        return {
            label: 'Not reported',
            quality: 'Unknown precision',
            tone: 'default',
        };
    }

    const metres = Math.max(1, Math.round(Number(accuracyMetres)));
    const label = `±${metres} m`;

    if (metres <= 15) {
        return { label, quality: 'Precise GPS', tone: 'success' };
    }

    if (metres <= 50) {
        return { label, quality: 'Approximate', tone: 'warning' };
    }

    return { label, quality: 'Imprecise', tone: 'danger' };
}

export function sosCategoryLabel(value: SosIncidentCategoryValue): string {
    return humanizeSosValue(value);
}

export function sosStatusLabel(value: SosIncidentStatusValue): string {
    return humanizeSosValue(value);
}

export function isUnresolvedSosStatus(value: SosIncidentStatusValue): boolean {
    return value !== 'resolved' && value !== 'cancelled';
}
