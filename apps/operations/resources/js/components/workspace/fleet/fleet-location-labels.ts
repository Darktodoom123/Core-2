import type { LocationUpdateViewModel } from '@/types/workspace';

export function hasLocationCoordinates(
    location: LocationUpdateViewModel | null | undefined,
): location is LocationUpdateViewModel & {
    latitude: number;
    longitude: number;
} {
    return (
        location?.latitude !== null &&
        location?.latitude !== undefined &&
        location?.longitude !== null &&
        location?.longitude !== undefined
    );
}

export function getFleetLocationFreshnessLabel(
    location: LocationUpdateViewModel,
): string {
    if (hasLocationCoordinates(location)) {
        return location.freshness_status === 'fresh'
            ? 'Fresh location'
            : 'Last known location';
    }

    if (location.has_gps_report === false) {
        return 'No GPS report';
    }

    return location.freshness_label ?? 'Location unavailable';
}

export function getFleetLocationFreshnessDescription(
    location: LocationUpdateViewModel,
): string {
    if (hasLocationCoordinates(location)) {
        return location.freshness_status === 'fresh'
            ? 'Current position'
            : 'Last reported position; current position is unknown.';
    }

    if (location.recorded_location) {
        return `Recorded location: ${location.recorded_location}`;
    }

    return 'Coordinates unavailable';
}
