/**
 * Philippine Operations Formatting Utilities
 * Standardizes Philippine Peso (₱), PHT Timezone (Asia/Manila), and Machine Telemetry formatting.
 */

/**
 * Format a number as Philippine Peso (e.g. ₱4,500.00 or ₱42,500)
 */
export function formatPHP(
    amount: number | null | undefined,
    showDecimals: boolean = true,
): string {
    if (amount === null || amount === undefined || isNaN(amount)) {
        return '₱0.00';
    }

    return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
        minimumFractionDigits: showDecimals ? 2 : 0,
        maximumFractionDigits: showDecimals ? 2 : 0,
    }).format(amount);
}

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

/**
 * Format duration in minutes/seconds to industrial ledger notation (e.g. "05h 15m")
 */
export function formatDurationHoursMins(totalMinutes: number): string {
    if (isNaN(totalMinutes) || totalMinutes < 0) {
        return '00h 00m';
    }

    const hours = Math.floor(totalMinutes / 60);
    const mins = Math.floor(totalMinutes % 60);

    const padH = String(hours).padStart(2, '0');
    const padM = String(mins).padStart(2, '0');

    return `${padH}h ${padM}m`;
}

/**
 * Format seconds to stopwatch format (e.g. "07:15:20")
 */
export function formatStopwatch(totalSeconds: number): string {
    if (isNaN(totalSeconds) || totalSeconds < 0) {
        return '00:00:00';
    }

    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = Math.floor(totalSeconds % 60);

    const padH = String(hours).padStart(2, '0');
    const padM = String(mins).padStart(2, '0');
    const padS = String(secs).padStart(2, '0');

    return `${padH}:${padM}:${padS}`;
}
