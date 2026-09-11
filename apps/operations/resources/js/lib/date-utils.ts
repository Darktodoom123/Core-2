export function localDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

export function dateFromLocalKey(value: string): Date {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

    if (!match) {
        return new Date(Number.NaN);
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day);

    if (
        !Number.isFinite(year) ||
        !Number.isFinite(month) ||
        !Number.isFinite(day) ||
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        return new Date(Number.NaN);
    }

    return date;
}

export function shiftLocalDate(value: string, days: number): string {
    const date = dateFromLocalKey(value);

    if (Number.isNaN(date.getTime())) {
        return localDateKey(new Date());
    }

    date.setDate(date.getDate() + days);

    return localDateKey(date);
}

export function shiftLocalMonth(value: string, months: number): string {
    const date = dateFromLocalKey(value);

    if (Number.isNaN(date.getTime())) {
        return localDateKey(new Date());
    }

    date.setDate(1);
    date.setMonth(date.getMonth() + months);

    return localDateKey(date);
}

export function startOfMonthLocalDate(value: string): Date {
    const date = dateFromLocalKey(value);

    if (Number.isNaN(date.getTime())) {
        const today = new Date();

        return new Date(today.getFullYear(), today.getMonth(), 1);
    }

    return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function startOfWeekLocalDate(value: string): string {
    const date = dateFromLocalKey(value);

    if (Number.isNaN(date.getTime())) {
        const today = new Date();
        const mondayOffset = (today.getDay() + 6) % 7;
        today.setDate(today.getDate() - mondayOffset);

        return localDateKey(today);
    }

    const mondayOffset = (date.getDay() + 6) % 7;
    date.setDate(date.getDate() - mondayOffset);

    return localDateKey(date);
}

export function weekDateKeys(value: string): string[] {
    const weekStart = startOfWeekLocalDate(value);

    return Array.from({ length: 7 }, (_, index) =>
        shiftLocalDate(weekStart, index),
    );
}

export function isDateOnlyValue(value: string | null): value is string {
    return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export function isValidLocalDateKey(value: string): boolean {
    const date = dateFromLocalKey(value);

    return !Number.isNaN(date.getTime());
}

export function parseScheduleDate(value: string | null): Date | null {
    if (!value) {
        return null;
    }

    if (isDateOnlyValue(value)) {
        const date = dateFromLocalKey(value);

        return Number.isNaN(date.getTime()) ? null : date;
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? null : date;
}
