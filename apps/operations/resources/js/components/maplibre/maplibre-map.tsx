import type * as MapLibreModule from 'maplibre-gl';
import type { Map as MapLibreInstance } from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { cn } from '@/lib/utils';
import { getMapAttribution, getMapStyleUrl } from './map-config';

type MapLibreRuntime = typeof MapLibreModule;

type MapLibreContextValue = {
    map: MapLibreInstance;
    maplibregl: MapLibreRuntime;
    prefersReducedMotion: boolean;
};

type ReadyMapContext = Omit<MapLibreContextValue, 'prefersReducedMotion'>;

const MapLibreContext = createContext<MapLibreContextValue | null>(null);

function supportsWebGL2(): boolean {
    try {
        return Boolean(document.createElement('canvas').getContext('webgl2'));
    } catch {
        return false;
    }
}

function mapHasSourceAttribution(map: MapLibreInstance): boolean {
    const style = map.getStyle();
    const usedSourceIds = new Set(
        style.layers.flatMap((layer) =>
            'source' in layer && typeof layer.source === 'string'
                ? [layer.source]
                : [],
        ),
    );

    if (style.terrain?.source) {
        usedSourceIds.add(style.terrain.source);
    }

    return [...usedSourceIds].some((sourceId) =>
        Boolean(map.getSource(sourceId)?.attribution?.trim()),
    );
}

function addMapAttributionControl(
    map: MapLibreInstance,
    maplibregl: MapLibreRuntime,
    styleVariant: 'light' | 'dark',
): void {
    const fallbackAttribution = getMapAttribution(styleVariant).trim();
    const hasSourceAttribution = mapHasSourceAttribution(map);
    const attributionOptions = hasSourceAttribution
        ? { customAttribution: [] }
        : fallbackAttribution
          ? { customAttribution: fallbackAttribution }
          : undefined;

    map.addControl(
        new maplibregl.AttributionControl(attributionOptions),
        'bottom-right',
    );
}

export function useMapLibre(): MapLibreContextValue {
    const context = useContext(MapLibreContext);

    if (!context) {
        throw new Error('useMapLibre must be used inside a ready MapLibreMap');
    }

    return context;
}

export function MapLibreMap({
    children,
    className,
    styleVariant = 'light',
    ariaLabel,
    center,
    zoom,
}: {
    children?: ReactNode;
    className?: string;
    styleVariant?: 'light' | 'dark';
    ariaLabel: string;
    center: [number, number];
    zoom: number;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [mapContext, setMapContext] = useState<ReadyMapContext | null>(null);
    const [status, setStatus] = useState<
        'loading' | 'ready' | 'degraded' | 'error'
    >(() => (getMapStyleUrl(styleVariant) ? 'loading' : 'error'));
    const [errorMessage, setErrorMessage] = useState<string | null>(() =>
        getMapStyleUrl(styleVariant)
            ? null
            : 'Map provider configuration is missing.',
    );
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
    const initialCenterRef = useRef(center);
    const mapLoadedRef = useRef(false);

    useEffect(() => {
        const mediaQuery = window.matchMedia(
            '(prefers-reduced-motion: reduce)',
        );
        const updatePreference = () =>
            setPrefersReducedMotion(mediaQuery.matches);
        updatePreference();
        mediaQuery.addEventListener('change', updatePreference);

        return () => mediaQuery.removeEventListener('change', updatePreference);
    }, []);

    useEffect(() => {
        let disposed = false;
        let map: MapLibreInstance | null = null;
        let resizeObserver: ResizeObserver | null = null;

        const styleUrl = getMapStyleUrl(styleVariant);

        if (!styleUrl) {
            return () => undefined;
        }

        void import('maplibre-gl')
            .then((maplibregl) => {
                if (disposed || !containerRef.current) {
                    return;
                }

                maplibregl.setWorkerUrl(maplibreWorkerUrl);

                if (!supportsWebGL2()) {
                    setStatus('error');
                    setErrorMessage(
                        'Map graphics are unavailable in this browser.',
                    );

                    return;
                }

                map = new maplibregl.Map({
                    container: containerRef.current,
                    style: styleUrl,
                    center: [
                        initialCenterRef.current[0],
                        initialCenterRef.current[1],
                    ],
                    zoom,
                    attributionControl: false,
                    cooperativeGestures: true,
                    maxPitch: 0,
                });

                resizeObserver = new ResizeObserver(() => map?.resize());
                resizeObserver.observe(containerRef.current);

                map.on('load', () => {
                    if (disposed || !map) {
                        return;
                    }

                    map.once('idle', () => {
                        if (!disposed && map) {
                            addMapAttributionControl(
                                map,
                                maplibregl,
                                styleVariant,
                            );
                        }
                    });

                    mapLoadedRef.current = true;
                    setStatus('ready');
                    setErrorMessage(null);
                    setMapContext({ map, maplibregl });
                });

                map.on('error', (event) => {
                    if (disposed) {
                        return;
                    }

                    const message = event.error?.message ?? '';

                    const resourceError = event as typeof event & {
                        sourceId?: string;
                        tile?: unknown;
                    };
                    const isGraphicsFailure =
                        event.error instanceof
                            maplibregl.GPUInitializationError ||
                        /webgl|gpu|context/i.test(message);

                    if (
                        mapLoadedRef.current &&
                        (resourceError.sourceId || resourceError.tile)
                    ) {
                        setStatus('degraded');
                        setErrorMessage(
                            'Some map tiles could not be loaded. The synchronized location list remains available.',
                        );

                        return;
                    }

                    setStatus('error');
                    setErrorMessage(
                        isGraphicsFailure
                            ? 'Map graphics are unavailable in this browser.'
                            : 'The map style or tiles could not be loaded.',
                    );
                });
            })
            .catch((error: unknown) => {
                if (!disposed) {
                    const message = error instanceof Error ? error.message : '';
                    setStatus('error');
                    setErrorMessage(
                        /webgl|gpu|context/i.test(message)
                            ? 'Map graphics are unavailable in this browser.'
                            : 'The map renderer could not be loaded.',
                    );
                }
            });

        return () => {
            disposed = true;
            mapLoadedRef.current = false;
            setMapContext(null);
            resizeObserver?.disconnect();
            map?.remove();
        };
    }, [styleVariant, zoom]);

    const context: MapLibreContextValue | null = mapContext
        ? { ...mapContext, prefersReducedMotion }
        : null;

    return (
        <div className={cn('relative h-full w-full', className)}>
            <div
                ref={containerRef}
                className="maplibre-map h-full w-full"
                role="application"
                tabIndex={0}
                aria-label={ariaLabel}
            />

            {status === 'loading' && (
                <div
                    className="absolute inset-0 flex items-center justify-center bg-surface-subtle/80 p-6 text-center backdrop-blur-xs"
                    role="status"
                    aria-live="polite"
                    aria-busy="true"
                >
                    <p className="text-sm text-ink-soft">Loading map…</p>
                </div>
            )}

            {status === 'error' && (
                <div
                    className="absolute inset-0 flex items-center justify-center bg-surface/90 p-6 text-center"
                    role="alert"
                >
                    <div className="max-w-sm space-y-1">
                        <p className="text-sm font-semibold text-ink">
                            Map unavailable
                        </p>
                        <p className="text-xs leading-5 text-ink-soft">
                            {errorMessage ??
                                'The synchronized location list remains available.'}
                        </p>
                    </div>
                </div>
            )}

            {status === 'degraded' && (
                <div
                    className="absolute top-3 right-3 z-[5] max-w-xs rounded-lg border border-warning bg-warning-soft/95 px-3 py-2 text-xs text-warning-strong shadow-sm"
                    role="status"
                    aria-live="polite"
                >
                    {errorMessage}
                </div>
            )}

            {context && (status === 'ready' || status === 'degraded') && (
                <MapLibreContext.Provider value={context}>
                    {children}
                </MapLibreContext.Provider>
            )}
        </div>
    );
}
