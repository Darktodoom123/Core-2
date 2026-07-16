import {
    AlertTriangle,
    Construction,
    Layers3,
    LocateFixed,
    Route,
    Truck,
    UserRoundCog,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button, StatusBadge } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { TelemetryPoint } from '@/types/operations';

export function LocalOperationsMap({
    points,
    selectedId,
    onSelect,
}: {
    points: TelemetryPoint[];
    selectedId: string;
    onSelect: (resourceId: string) => void;
}) {
    const [showRoutes, setShowRoutes] = useState(true);
    const [showGeofences, setShowGeofences] = useState(true);
    const selected = useMemo(
        () =>
            points.find((point) => point.resourceId === selectedId) ??
            points[0],
        [points, selectedId],
    );

    return (
        <div className="grid min-h-[34rem] grid-cols-1 border-t border-line xl:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="relative min-h-[28rem] overflow-hidden bg-[#eef3f6]">
                <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
                    <Button
                        size="icon"
                        variant="secondary"
                        aria-label="Center the operations map"
                        title="Center map"
                    >
                        <LocateFixed className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                        size="icon"
                        variant={showRoutes ? 'primary' : 'secondary'}
                        onClick={() => setShowRoutes((value) => !value)}
                        aria-pressed={showRoutes}
                        aria-label="Toggle planned routes"
                        title="Planned routes"
                    >
                        <Route className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                        size="icon"
                        variant={showGeofences ? 'primary' : 'secondary'}
                        onClick={() => setShowGeofences((value) => !value)}
                        aria-pressed={showGeofences}
                        aria-label="Toggle job-site geofences"
                        title="Job-site geofences"
                    >
                        <Layers3 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                </div>

                <svg
                    className="absolute inset-0 h-full w-full"
                    viewBox="0 0 1000 650"
                    role="img"
                    aria-label="Local operations map showing Metro Manila job sites and routes"
                    preserveAspectRatio="xMidYMid slice"
                >
                    <rect width="1000" height="650" fill="#eef3f6" />
                    <path
                        className="map-water"
                        d="M-20 500 C160 455 205 520 340 492 C470 465 500 585 660 548 C780 521 825 426 1020 444 L1020 700 L-20 700 Z"
                    />
                    {[
                        'M-40 110 C180 160 320 68 540 130 S820 190 1040 95',
                        'M-20 265 C150 224 305 292 470 250 S795 220 1020 285',
                        'M38 430 C220 380 350 445 540 390 S780 348 1010 410',
                        'M155 -30 C200 105 154 250 236 355 S330 520 286 690',
                        'M490 -20 C470 145 545 245 520 390 S470 548 540 690',
                        'M770 -20 C735 130 804 245 760 382 S720 520 805 690',
                    ].map((path) => (
                        <path
                            key={path}
                            className="map-road map-road-major"
                            d={path}
                            strokeWidth="9"
                        />
                    ))}
                    {[
                        'M-10 60 C220 30 415 95 620 52 S850 28 1030 65',
                        'M-20 200 C185 180 342 214 540 183 S812 160 1010 190',
                        'M35 340 C206 310 390 345 580 318 S850 300 1030 335',
                        'M62 555 C260 525 420 574 650 530 S860 512 1030 548',
                        'M74 -20 C110 115 80 245 130 370 S180 535 146 690',
                        'M360 -20 C332 160 394 250 370 410 S335 560 400 690',
                        'M630 -20 C605 120 652 255 620 390 S594 540 650 690',
                        'M900 -20 C865 132 910 272 885 410 S860 560 920 690',
                    ].map((path) => (
                        <path
                            key={path}
                            className="map-road"
                            d={path}
                            strokeWidth="4"
                        />
                    ))}
                    {showGeofences && (
                        <>
                            <path
                                d="M586 105 L755 82 L828 170 L770 260 L600 238 L552 166 Z"
                                fill="rgba(37,99,235,0.08)"
                                stroke="#2563eb"
                                strokeWidth="3"
                            />
                            <path
                                d="M350 350 L520 330 L580 420 L510 512 L348 482 L310 402 Z"
                                fill="rgba(37,99,235,0.08)"
                                stroke="#2563eb"
                                strokeWidth="3"
                            />
                        </>
                    )}
                    {showRoutes && (
                        <>
                            <path
                                className="map-route"
                                d="M250 282 C345 260 410 330 485 355 S628 314 704 248"
                                strokeWidth="7"
                            />
                            <path
                                className="map-route"
                                d="M410 540 C450 478 502 446 548 408 S642 342 688 280"
                                strokeWidth="7"
                            />
                        </>
                    )}
                    <g
                        fill="#5f6f7d"
                        fontFamily="Instrument Sans"
                        fontSize="18"
                    >
                        <text x="90" y="145">
                            North Yard
                        </text>
                        <text x="612" y="132">
                            Balintawak
                        </text>
                        <text x="365" y="442">
                            Marikina
                        </text>
                        <text x="700" y="358">
                            Pasig
                        </text>
                        <text x="170" y="585">
                            Quezon City
                        </text>
                    </g>
                </svg>

                {points.map((point) => {
                    const Icon =
                        point.kind === 'truck'
                            ? Truck
                            : point.kind === 'crane'
                              ? Construction
                              : UserRoundCog;

                    return (
                        <button
                            key={point.id}
                            type="button"
                            onClick={() => onSelect(point.resourceId)}
                            style={{ left: `${point.x}%`, top: `${point.y}%` }}
                            className={cn(
                                'absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-surface p-1.5 text-ink shadow-md transition-transform duration-200 hover:scale-105',
                                selected?.resourceId === point.resourceId &&
                                    'ring-2 ring-brand ring-offset-2',
                                point.freshness === 'Delayed' &&
                                    'text-amber-800',
                                point.freshness === 'Offline' &&
                                    'text-muted grayscale',
                            )}
                            aria-label={`${point.label}, ${point.freshness}, ${point.destination}`}
                        >
                            <Icon className="h-5 w-5" aria-hidden="true" />
                            <span className="sr-only">{point.label}</span>
                        </button>
                    );
                })}

                <div className="absolute right-3 bottom-3 z-10 rounded-lg bg-surface/95 p-3 text-xs text-ink-soft shadow-sm">
                    <div className="flex items-center gap-2">
                        <Construction className="h-4 w-4" aria-hidden="true" />
                        Local simulated map · Prototype data
                    </div>
                </div>
            </div>

            <aside
                className="max-h-[38rem] overflow-y-auto border-t border-line bg-surface xl:border-t-0 xl:border-l"
                aria-label="Live asset list"
            >
                <div className="sticky top-0 z-10 border-b border-line bg-surface px-4 py-3">
                    <h3 className="font-semibold text-ink">
                        Tracked resources
                    </h3>
                    <p className="mt-0.5 text-xs text-ink-soft">
                        {
                            points.filter((point) => point.freshness === 'Live')
                                .length
                        }{' '}
                        live · {points.length} total
                    </p>
                </div>
                <ul className="divide-y divide-line">
                    {points.map((point) => (
                        <li key={point.id}>
                            <button
                                type="button"
                                onClick={() => onSelect(point.resourceId)}
                                className={cn(
                                    'w-full px-4 py-3 text-left hover:bg-surface-subtle',
                                    selected?.resourceId === point.resourceId &&
                                        'bg-brand-soft',
                                )}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-semibold text-ink">
                                            {point.label}
                                        </p>
                                        <p className="mt-1 text-xs text-ink-soft">
                                            {point.destination}
                                        </p>
                                    </div>
                                    <StatusBadge status={point.freshness} />
                                </div>
                                <div className="mt-2 flex items-center justify-between gap-3 text-xs text-ink-soft">
                                    <span>{point.eta}</span>
                                    <span>Updated {point.updatedAt}</span>
                                </div>
                            </button>
                        </li>
                    ))}
                </ul>
                <div className="m-4 flex items-start gap-2 rounded-lg bg-warning-soft p-3 text-xs leading-5 text-amber-950">
                    <AlertTriangle
                        className="mt-0.5 h-4 w-4 shrink-0"
                        aria-hidden="true"
                    />
                    Stale and offline signals remain visible so dispatchers can
                    distinguish missing data from inactive assets.
                </div>
            </aside>
        </div>
    );
}
