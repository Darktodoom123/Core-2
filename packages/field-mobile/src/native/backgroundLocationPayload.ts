import type { LocationSharePayload } from '../types/index';
import type { BackgroundLocationContext } from './backgroundLocationContext';

export interface BackgroundLocationSample {
    coords: {
        latitude: number;
        longitude: number;
        accuracy: number | null;
    };
    timestamp: number;
    mocked?: boolean;
}

function validCoordinate(value: number): boolean {
    return Number.isFinite(value);
}

export function toLocationSharePayload(
    sample: BackgroundLocationSample,
    context: BackgroundLocationContext,
    now: () => Date = () => new Date(),
): LocationSharePayload | null {
    if (
        sample.mocked === true ||
        !validCoordinate(sample.coords.latitude) ||
        !validCoordinate(sample.coords.longitude) ||
        sample.coords.latitude < -90 ||
        sample.coords.latitude > 90 ||
        sample.coords.longitude < -180 ||
        sample.coords.longitude > 180
    ) {
        return null;
    }

    const capturedAt = Number.isFinite(sample.timestamp)
        ? new Date(sample.timestamp)
        : now();

    return {
        dispatch_job_id: context.jobId,
        operational_asset_id: context.operationalAssetId ?? null,
        latitude: sample.coords.latitude,
        longitude: sample.coords.longitude,
        accuracy_metres: Number.isFinite(sample.coords.accuracy)
            ? sample.coords.accuracy
            : null,
        sharing_enabled: true,
        captured_at: Number.isNaN(capturedAt.getTime())
            ? now().toISOString()
            : capturedAt.toISOString(),
        remarks: 'Background field telemetry',
    };
}
