import { usePlace } from '@/services/reverse-geocoder';
import type { PlaceViewModel } from '@/types/workspace';

export type SosPlaceName =
    | { status: 'none' }
    | { status: 'loading' }
    | { status: 'failed' }
    | { status: 'ready'; primary: string; secondary: string | null };

/**
 * Nearest address for an SOS fix. Uses the place the server sent with the
 * incident; otherwise asks the server once. Coordinates stay the source of
 * truth; the address is a readable aid and may be unavailable.
 */
export function useSosPlaceName(
    latitude: number | null | undefined,
    longitude: number | null | undefined,
    serverPlace?: PlaceViewModel | null,
): SosPlaceName {
    const place = usePlace(latitude, longitude, serverPlace);

    switch (place.status) {
        case 'none':
            return { status: 'none' };
        case 'pending':
            return { status: 'loading' };
        case 'unavailable':
            return { status: 'failed' };
        default:
            return {
                status: 'ready',
                primary: place.primary,
                secondary: place.secondary,
            };
    }
}
