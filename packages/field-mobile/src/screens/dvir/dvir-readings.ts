/** A typed meter reading, or null when the field is blank. NaN when not a number. */
export function parseReading(value: string): number | null {
    const trimmed = value.trim();

    if (trimmed === '') {
        return null;
    }

    return /^\d+(\.\d+)?$/.test(trimmed) ? Number(trimmed) : Number.NaN;
}

export interface ReadingsCheck {
    engineHoursError: string | null;
    odometerError: string | null;
    isValid: boolean;
}

export const formatHours = (hours: number) =>
    `${hours.toLocaleString('en-US')} hrs`;

/**
 * Engine hours are required on every DVIR; the odometer is optional because
 * some units have none. Neither may be invented, and engine hours cannot go
 * below the last reading the server recorded for the unit.
 */
export function checkReadings(
    engineHours: string,
    odometerKm: string,
    lastEngineHours?: number | null,
): ReadingsCheck {
    const hours = parseReading(engineHours);
    const odometer = parseReading(odometerKm);
    let engineHoursError: string | null = null;
    let odometerError: string | null = null;

    if (hours === null) {
        engineHoursError = 'Enter the engine hours reading.';
    } else if (Number.isNaN(hours)) {
        engineHoursError = 'Engine hours must be a number.';
    } else if (typeof lastEngineHours === 'number' && hours < lastEngineHours) {
        engineHoursError = `Engine hours can't be lower than the last recorded ${formatHours(lastEngineHours)}.`;
    }

    if (odometer !== null && Number.isNaN(odometer)) {
        odometerError = 'Odometer must be a number of 0 or more.';
    }

    return {
        engineHoursError,
        odometerError,
        isValid: engineHoursError === null && odometerError === null,
    };
}
