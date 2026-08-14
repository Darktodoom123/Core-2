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

export function humanize(value: string): string {
    return value.replaceAll('_', ' ');
}
