import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LocalOperationsMap } from '@/components/local-operations-map';
import type { TelemetryPoint } from '@/types/operations';

vi.mock('@/components/maplibre/maplibre-map', () => ({
    MapLibreMap: () => null,
    useMapLibre: () => {
        throw new Error('The simulated map layer should remain unmounted.');
    },
}));

describe('LocalOperationsMap asset presentation', () => {
    it('shows tracked assets and simulation status without rendering a worker category', () => {
        const points: TelemetryPoint[] = [
            {
                id: 'mobile-crane',
                resourceId: 'MC-01',
                label: 'MC-01',
                kind: 'crane',
                category: 'mobile_cranes',
                subtype: 'Mobile crane',
                x: 50,
                y: 50,
                freshness: 'Live',
                updatedAt: '10:14',
                destination: 'Balintawak Substation',
                eta: 'On site',
            },
            {
                id: 'operator',
                resourceId: 'OP-01',
                label: 'Operator context only',
                kind: 'operator',
                x: 52,
                y: 51,
                freshness: 'Live',
                updatedAt: '10:14',
                destination: 'Balintawak Substation',
                eta: 'On site',
            },
        ];

        render(
            <LocalOperationsMap
                points={points}
                selectedId="MC-01"
                onSelect={vi.fn()}
            />,
        );

        expect(screen.getByText('1 live · 1 assets')).toBeInTheDocument();
        expect(screen.getByText('Mobile cranes')).toBeInTheDocument();
        expect(
            screen.queryByText('Operator context only'),
        ).not.toBeInTheDocument();
        expect(
            screen.getByText(/Prototype \/ Sandbox Simulation Map/),
        ).toBeInTheDocument();
    });
});
