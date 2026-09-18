export function formatDateTime(
    value: string | null,
    emptyLabel = 'Not scheduled',
): string {
    if (value === null) {
        return emptyLabel;
    }

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}

export function formatDate(value: string | null, emptyLabel = 'N/A'): string {
    if (value === null || !value) {
        return emptyLabel;
    }

    try {
        return new Intl.DateTimeFormat(undefined, {
            dateStyle: 'medium',
        }).format(new Date(value));
    } catch {
        return value;
    }
}

export function humanize(value: string): string {
    return value.replaceAll('_', ' ');
}

export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(amount);
}

export function formatResourceCount(
    crewCount: number,
    assetCount: number,
): string {
    const parts: string[] = [];

    if (crewCount > 0) {
        parts.push(`${crewCount} crew`);
    }

    if (assetCount > 0) {
        parts.push(`${assetCount} ${assetCount === 1 ? 'asset' : 'assets'}`);
    }

    if (parts.length === 0) {
        return 'selected';
    }

    return parts.join(' & ');
}
