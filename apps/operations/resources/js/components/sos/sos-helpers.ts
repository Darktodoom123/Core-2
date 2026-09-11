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
    const timestamp = new Date(value).getTime();

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

export function sosCategoryLabel(value: SosIncidentCategoryValue): string {
    return humanizeSosValue(value);
}

export function sosStatusLabel(value: SosIncidentStatusValue): string {
    return humanizeSosValue(value);
}

export function isUnresolvedSosStatus(value: SosIncidentStatusValue): boolean {
    return value !== 'resolved' && value !== 'cancelled';
}
