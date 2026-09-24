import type { LngLat } from './geojson';

/**
 * Fixed reference location for the Alibaton equipment yard and warehouse.
 *
 * The coordinates are kept with the map component rather than attached to a
 * telemetry record because this is a facility reference point, not a moving
 * asset position.
 */
export const FOCHUN_WAREHOUSE: {
    id: string;
    label: string;
    address: string;
    position: LngLat;
    sourceUrl: string;
} = {
    id: 'alibaton-fochun-yard-warehouse',
    label: 'Alibaton Yard & Warehouse',
    address: 'Fochun Industrial Compound, Balagtas, 3016 Bulacan, Philippines',
    position: [120.9119228, 14.8512989],
    sourceUrl:
        'https://www.waze.com/live-map/directions/ph/central-luzon/balagtas/fochun-industrial-compound?to=place.ChIJWeLDt5ytlzMR_aH85PY5OYQ',
};
