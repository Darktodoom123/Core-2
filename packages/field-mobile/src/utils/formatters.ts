/**
 * Philippine Operations Formatting Utilities
 * Standardizes Philippine Peso (₱), PHT Timezone (Asia/Manila), and Machine Telemetry formatting.
 */

/**
 * Format timestamp in Philippine Standard Time (PHT, UTC+8)
 * e.g. "14:15:32 PHT" or "15 Aug 2026, 02:44 PHT"
 */
export function formatPHT(
    dateInput: string | Date | null | undefined,
    formatStyle: 'time' | 'datetime' | 'date' = 'datetime',
): string {
    if (!dateInput) {
        return '--';
    }

    const date =
        typeof dateInput === 'string' ? new Date(dateInput) : dateInput;

    if (isNaN(date.getTime())) {
        return '--';
    }

    const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Manila',
        hour12: false,
    };

    if (formatStyle === 'time') {
        options.hour = '2-digit';
        options.minute = '2-digit';
        options.second = '2-digit';

        return `${new Intl.DateTimeFormat('en-PH', options).format(date)} PHT`;
    }

    if (formatStyle === 'date') {
        options.year = 'numeric';
        options.month = 'short';
        options.day = '2-digit';

        return new Intl.DateTimeFormat('en-PH', options).format(date);
    }

    options.year = 'numeric';
    options.month = 'short';
    options.day = '2-digit';
    options.hour = '2-digit';
    options.minute = '2-digit';

    return `${new Intl.DateTimeFormat('en-PH', options).format(date)} PHT`;
}
