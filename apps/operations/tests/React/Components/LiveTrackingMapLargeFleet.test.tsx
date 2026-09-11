import {
    fireEvent,
    render,
    screen,
    waitFor,
    within,
} from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LiveTrackingMap } from '@/components/live-tracking-map';
import type {
    LocationUpdateViewModel,
    SosIncidentViewModel,
} from '@/types/workspace';

type GeoJsonFeature = {
    geometry: {
        coordinates: unknown;
        type: string;
    };
    properties?: Record<string, unknown>;
};

type GeoJsonData = {
    features: GeoJsonFeature[];
};

type FakeSource = {
    latestData: GeoJsonData;
    options: Record<string, unknown>;
    setData: (data: GeoJsonData) => void;
    getClusterLeaves: (
        clusterId: number,
        limit: number,
        offset: number,
    ) => Promise<GeoJsonFeature[]>;
};

type MapHandler = (event: unknown) => void;

type FakeLayer = {
    layout?: Record<string, unknown>;
    paint?: Record<string, unknown>;
};

type FakePopup = {
    history: HTMLElement[];
    latest: HTMLElement | null;
};

type MapHarness = {
    clusterLeafCalls: number;
    clusterLeaves: () => Promise<GeoJsonFeature[]>;
    layers: Map<string, FakeLayer>;
    map: FakeMap;
    maplibregl: {
        LngLatBounds: unknown;
        Marker: unknown;
        Popup: unknown;
    };
    popups: FakePopup[];
    queryFeature: GeoJsonFeature | null;
    sources: Map<string, FakeSource>;
};

type FakeMap = {
    addLayer: (layer: FakeLayer & { id: string }) => void;
    addSource: (id: string, options: Record<string, unknown>) => void;
    easeTo: (options: Record<string, unknown>) => void;
    fitBounds: (...args: unknown[]) => void;
    getLayer: (id: string) => FakeLayer | undefined;
    getSource: (id: string) => FakeSource | undefined;
    off: (
        event: string,
        layerOrHandler: string | MapHandler,
        maybeHandler?: MapHandler,
    ) => void;
    on: (
        event: string,
        layerOrHandler: string | MapHandler,
        maybeHandler?: MapHandler,
    ) => FakeMap;
    project: (position: unknown) => { x: number; y: number };
    queryRenderedFeatures: (...args: unknown[]) => GeoJsonFeature[];
    removeLayer: (id: string) => void;
    removeSource: (id: string) => void;
    setLayoutProperty: (id: string, property: string, value: unknown) => void;
    zoomIn: (...args: unknown[]) => void;
    zoomOut: (...args: unknown[]) => void;
};

const mapHarness = vi.hoisted(() => ({
    current: undefined as MapHarness | undefined,
}));

// Keep the real map content, marker factories, overlap grouping, and popup
// builders. This boundary supplies only the small MapLibre surface the
// component needs, so the tests exercise the large-fleet behavior itself.
vi.mock('@/components/maplibre/maplibre-map', async () => {
    const React = await import('react');
    const MapContext = React.createContext<{
        map: unknown;
        maplibregl: unknown;
        prefersReducedMotion: boolean;
    } | null>(null);

    function MapLibreMap({ children }: { children?: React.ReactNode }) {
        const harness = mapHarness.current;

        if (!harness) {
            throw new Error('The MapLibre test harness was not initialized.');
        }

        return React.createElement(
            MapContext.Provider,
            {
                value: {
                    map: harness.map,
                    maplibregl: harness.maplibregl,
                    prefersReducedMotion: false,
                },
            },
            React.createElement(
                'div',
                { 'data-testid': 'maplibre-test-boundary' },
                children,
            ),
        );
    }

    function useMapLibre() {
        const context = React.useContext(MapContext);

        if (!context) {
            throw new Error(
                'useMapLibre was called outside the test boundary.',
            );
        }

        return context;
    }

    return { MapLibreMap, useMapLibre };
});

function createMapHarness(): MapHarness {
    const harness: MapHarness = {
        clusterLeafCalls: 0,
        clusterLeaves: () => Promise.resolve([] as GeoJsonFeature[]),
        layers: new Map<string, FakeLayer>(),
        map: undefined as unknown as FakeMap,
        maplibregl: undefined as unknown as MapHarness['maplibregl'],
        popups: [] as FakePopup[],
        queryFeature: {
            geometry: {
                type: 'Point',
                coordinates: [121, 14.6],
            },
            properties: {
                cluster_id: 7,
                point_count: 251,
                point_count_abbreviated: '251',
            },
        } satisfies GeoJsonFeature,
        sources: new Map<string, FakeSource>(),
    };

    class Popup implements FakePopup {
        history: HTMLElement[] = [];
        latest: HTMLElement | null = null;
        private popupElement: HTMLDivElement | null = null;

        constructor() {
            harness.popups.push(this);
        }

        setDOMContent(content: HTMLElement): this {
            this.latest = content;
            this.history.push(content);
            this.popupElement?.replaceChildren(content);

            return this;
        }

        setLngLat(): this {
            return this;
        }

        addTo(): this {
            this.popupElement ??= document.createElement('div');
            this.popupElement.className = 'maplibre-test-popup';
            this.popupElement.replaceChildren(
                this.latest ?? document.createTextNode(''),
            );
            document.body.appendChild(this.popupElement);

            return this;
        }

        remove(): this {
            this.popupElement?.remove();
            this.popupElement = null;

            return this;
        }
    }

    class Marker {
        private readonly element: HTMLButtonElement;
        private popup: Popup | undefined;

        constructor(options: { element: HTMLButtonElement }) {
            this.element = options.element;
        }

        setLngLat(): this {
            return this;
        }

        setPopup(popup: Popup): this {
            this.popup = popup;

            return this;
        }

        addTo(): this {
            document.body.appendChild(this.element);
            this.element.addEventListener('click', () => {
                this.popup?.addTo();
            });

            return this;
        }

        remove(): this {
            this.popup?.remove();
            this.element.remove();

            return this;
        }

        getElement(): HTMLButtonElement {
            return this.element;
        }
    }

    class LngLatBounds {
        extend(): this {
            return this;
        }
    }

    harness.maplibregl = { LngLatBounds, Marker, Popup };

    const handlers: Array<{
        event: string;
        handler: MapHandler;
        layer?: string;
    }> = [];

    harness.map = {
        addLayer(layer) {
            harness.layers.set(layer.id, layer);
        },
        addSource(id, options) {
            const source: FakeSource = {
                latestData: options.data as GeoJsonData,
                options,
                setData(data) {
                    source.latestData = data;
                },
                getClusterLeaves() {
                    harness.clusterLeafCalls += 1;

                    return harness.clusterLeaves();
                },
            };
            harness.sources.set(id, source);
        },
        easeTo() {},
        fitBounds() {},
        getLayer(id) {
            return harness.layers.get(id);
        },
        getSource(id) {
            return harness.sources.get(id);
        },
        off(event, layerOrHandler, maybeHandler) {
            const layer =
                typeof layerOrHandler === 'string' ? layerOrHandler : undefined;
            const handler =
                typeof layerOrHandler === 'function'
                    ? layerOrHandler
                    : maybeHandler;

            for (let index = handlers.length - 1; index >= 0; index -= 1) {
                if (
                    handlers[index].event === event &&
                    handlers[index].layer === layer &&
                    handlers[index].handler === handler
                ) {
                    handlers.splice(index, 1);
                }
            }
        },
        on(event, layerOrHandler, maybeHandler) {
            handlers.push({
                event,
                handler:
                    typeof layerOrHandler === 'function'
                        ? layerOrHandler
                        : (maybeHandler as MapHandler),
                layer:
                    typeof layerOrHandler === 'string'
                        ? layerOrHandler
                        : undefined,
            });

            return harness.map;
        },
        project() {
            return { x: 0, y: 0 };
        },
        queryRenderedFeatures() {
            return harness.queryFeature ? [harness.queryFeature] : [];
        },
        removeLayer(id) {
            harness.layers.delete(id);
        },
        removeSource(id) {
            harness.sources.delete(id);
        },
        setLayoutProperty(id, property, value) {
            const layer = harness.layers.get(id);

            if (layer) {
                layer.layout ??= {};
                layer.layout[property] = value;
            }
        },
        zoomIn() {},
        zoomOut() {},
    };

    return harness;
}

function makeLocation(id: number): LocationUpdateViewModel {
    return {
        id,
        user: { id: 10_000 + id, name: `Operator ${id}` },
        asset: {
            id: 20_000 + id,
            code: `TRK-${id}`,
            name: `Support truck ${id}`,
            kind: 'truck',
        },
        job: null,
        latitude: 14.6,
        longitude: 121,
        accuracy_metres: null,
        speed: null,
        remarks: null,
        source: 'browser',
        sharing_enabled: true,
        captured_at: null,
        received_at: null,
        freshness_status: 'fresh',
    };
}

function makeSosIncident(
    location: LocationUpdateViewModel,
): SosIncidentViewModel {
    return {
        id: `sos-${location.id}`,
        category: { value: 'site_accident', label: 'Site accident' },
        status: { value: 'active', label: 'Active' },
        note: 'Operator requires assistance',
        worker: { ...location.user, phone: null },
        received_at: '2026-09-04T00:00:00Z',
        device_activated_at: null,
        escalation_due_at: null,
        escalated_at: null,
        acknowledged_at: null,
        acknowledged_by: null,
        resolved_at: null,
        resolved_by: null,
        resolution_code: null,
        resolution_notes: null,
        cancelled_at: null,
        cancellation_reason: null,
        dispatch: null,
        asset: location.asset
            ? {
                  id: location.asset.id,
                  code: location.asset.code,
                  name: location.asset.name,
              }
            : null,
        location: null,
        delivery_attempts: [],
        can_acknowledge: false,
        can_resolve: false,
        can_cancel: false,
    };
}

function makeFleet(count = 251): LocationUpdateViewModel[] {
    return Array.from({ length: count }, (_, index) => makeLocation(index + 1));
}

function leavesFor(locations: LocationUpdateViewModel[]): GeoJsonFeature[] {
    return locations.map((location) => ({
        geometry: {
            type: 'Point',
            coordinates: [location.longitude, location.latitude],
        },
        properties: { id: location.id },
    }));
}

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((promiseResolve, promiseReject) => {
        resolve = promiseResolve;
        reject = promiseReject;
    });

    return { promise, reject, resolve };
}

function currentSource(id: string): FakeSource {
    const source = mapHarness.current?.sources.get(id);

    if (!source) {
        throw new Error(`Expected MapLibre source ${id} to exist.`);
    }

    return source;
}

function selectedCount(source: FakeSource, id: number): number {
    const feature = source.latestData.features.find(
        (candidate) => candidate.properties?.id === id,
    );

    return Number(feature?.properties?.selectedCount ?? 0);
}

function sosMarker(): HTMLButtonElement {
    const marker = document.querySelector<HTMLButtonElement>(
        '.maplibre-sos-marker',
    );

    if (!marker) {
        throw new Error('Expected the SOS marker to be rendered.');
    }

    return marker;
}

describe('LiveTrackingMap large-fleet behavior', () => {
    it('publishes and clears selectedCount for a null-accuracy unit in an aggregated overview', async () => {
        const fleet = makeFleet();
        const harness = createMapHarness();
        mapHarness.current = harness;

        const { rerender } = render(
            <LiveTrackingMap
                locations={fleet}
                selectedLocationId={fleet[250].id}
                showLocationList={false}
            />,
        );

        await waitFor(() => {
            expect(
                currentSource('tracking-marker-overview').latestData.features,
            ).toHaveLength(251);
        });

        const overviewSource = currentSource('tracking-marker-overview');
        const accuracySource = currentSource('tracking-accuracy');
        const overviewLayer = harness.layers.get('tracking-marker-overview');

        expect(accuracySource.latestData.features).toHaveLength(0);
        expect(selectedCount(overviewSource, fleet[250].id)).toBe(1);
        expect(overviewSource.options.clusterProperties).toEqual({
            selectedCount: ['+', ['get', 'selectedCount']],
        });
        expect(overviewLayer?.paint?.['circle-stroke-color']).toEqual([
            'case',
            ['>', ['coalesce', ['get', 'selectedCount'], 0], 0],
            '#c98f12',
            '#ffffff',
        ]);
        expect(
            harness.layers.get('tracking-marker-count')?.layout?.visibility,
        ).toBe('visible');

        rerender(
            <LiveTrackingMap
                locations={fleet}
                selectedLocationId={null}
                showLocationList={false}
            />,
        );

        await waitFor(() => {
            expect(
                selectedCount(
                    currentSource('tracking-marker-overview'),
                    fleet[250].id,
                ),
            ).toBe(0);
        });
    });

    it('opens every member from a 251-unit coincident cluster anchored by its SOS marker', async () => {
        const fleet = makeFleet();
        const harness = createMapHarness();
        const onSelect = vi.fn();
        harness.clusterLeaves = () => Promise.resolve(leavesFor(fleet));
        mapHarness.current = harness;

        render(
            <LiveTrackingMap
                locations={fleet}
                activeSosIncidents={[makeSosIncident(fleet[0])]}
                onSelectedLocationChange={onSelect}
                showLocationList={false}
            />,
        );

        await waitFor(() => expect(sosMarker()).toBeInTheDocument());
        const marker = sosMarker();
        expect(marker).toHaveTextContent('SOS');
        expect(marker).toHaveTextContent('251');
        expect(marker).toHaveAccessibleName(
            'SOS incident for Operator 1 (Active). 251 units in this area',
        );

        fireEvent.click(marker);

        const picker = await screen.findByLabelText(
            'Select a unit in this area',
        );
        const memberButtons = within(picker).getAllByRole('button');
        expect(memberButtons).toHaveLength(251);
        expect(
            memberButtons.filter((button) => button.dataset.sos === 'true'),
        ).toHaveLength(1);

        const ordinaryMember = within(picker).getByRole('button', {
            name: /TRK-251/,
        });
        fireEvent.click(ordinaryMember);

        await waitFor(() => expect(onSelect).toHaveBeenCalledWith(251));
        expect(screen.getByText('TRK-251')).toBeInTheDocument();
        expect(harness.clusterLeafCalls).toBe(1);
    });

    it('ignores a pending cluster lookup after the marker group is filtered and replaced', async () => {
        const fleet = makeFleet();
        const harness = createMapHarness();
        const pending = deferred<GeoJsonFeature[]>();
        harness.clusterLeaves = () => pending.promise;
        mapHarness.current = harness;

        const { rerender } = render(
            <LiveTrackingMap
                locations={fleet}
                activeSosIncidents={[makeSosIncident(fleet[0])]}
                showLocationList={false}
            />,
        );

        await waitFor(() => expect(sosMarker()).toBeInTheDocument());
        fireEvent.click(sosMarker());
        await waitFor(() => expect(harness.clusterLeafCalls).toBe(1));

        const popup = harness.popups[0];
        const historyLength = popup.history.length;

        rerender(
            <LiveTrackingMap
                locations={fleet.slice(0, 250)}
                activeSosIncidents={[makeSosIncident(fleet[0])]}
                showLocationList={false}
            />,
        );

        pending.resolve(leavesFor(fleet));
        await pending.promise;
        await waitFor(() => expect(popup.history).toHaveLength(historyLength));
        expect(popup.latest).toHaveTextContent(
            'SOS · Urgent attention required',
        );
    });

    it('shows a recoverable message when the large-fleet member lookup fails', async () => {
        const fleet = makeFleet();
        const harness = createMapHarness();
        harness.clusterLeaves = () =>
            Promise.reject(new Error('cluster changed'));
        mapHarness.current = harness;

        render(
            <LiveTrackingMap
                locations={fleet}
                activeSosIncidents={[makeSosIncident(fleet[0])]}
                showLocationList={false}
            />,
        );

        await waitFor(() => expect(sosMarker()).toBeInTheDocument());
        fireEvent.click(sosMarker());

        expect(
            await screen.findByText(
                'This group changed. Select a unit from the synchronized list or try again.',
            ),
        ).toBeInTheDocument();
    });
});
