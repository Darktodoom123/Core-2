import { router } from '@inertiajs/react';
import { CalendarDays, ChevronDown, ChevronUp, MapPin } from 'lucide-react';
import React, { useState } from 'react';
import { SiteLocationPicker } from '@/components/maplibre/site-location-picker';
import { Button, DataPair, Panel } from '@/components/ui';
import { WeatherSafetyTelemetry } from '@/components/weather/weather-safety-telemetry';
import { formatDateTime, humanize } from '@/lib/formatters';
import type { DispatchDetailPageProps } from '@/types/workspace';

export function DispatchContext({
    job,
}: {
    job: DispatchDetailPageProps['job'];
}) {
    const [isPickerOpen, setIsPickerOpen] = useState<boolean>(false);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [currentLat, setCurrentLat] = useState<number | null | undefined>(
        job.site_latitude,
    );
    const [currentLon, setCurrentLon] = useState<number | null | undefined>(
        job.site_longitude,
    );

    const isPinned =
        currentLat !== null &&
        currentLat !== undefined &&
        currentLon !== null &&
        currentLon !== undefined;

    const handleSaveCoordinates = (coords: {
        latitude: number;
        longitude: number;
    }) => {
        setIsSaving(true);
        router.patch(
            `/operations/dispatch-jobs/${job.id}/site-coordinates`,
            {
                site_latitude: coords.latitude,
                site_longitude: coords.longitude,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setCurrentLat(coords.latitude);
                    setCurrentLon(coords.longitude);
                    setIsSaving(false);
                },
                onError: () => {
                    setIsSaving(false);
                },
            },
        );
    };

    const handleSaveCraneCoordinates = (
        assignmentId: number,
        coords: {
            latitude: number;
            longitude: number;
            jibRadiusMeters?: number;
        },
    ) => {
        setIsSaving(true);
        router.patch(
            `/operations/dispatch-jobs/${job.id}/assets/${assignmentId}/site-coordinates`,
            {
                site_latitude: coords.latitude,
                site_longitude: coords.longitude,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setIsSaving(false);
                },
                onError: () => {
                    setIsSaving(false);
                },
            },
        );
    };

    const handleSavePlannedSlots = (
        slots: Array<{
            slot_key: string;
            name: string;
            required_type?: string | null;
            jib_radius_meters: number;
            site_latitude?: number | null;
            site_longitude?: number | null;
        }>,
    ) => {
        setIsSaving(true);
        router.patch(
            `/operations/dispatch-jobs/${job.id}/crane-slots`,
            {
                planned_crane_slots: slots,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    const firstWithCoords = slots.find(
                        (s) => s.site_latitude && s.site_longitude,
                    );

                    if (firstWithCoords) {
                        setCurrentLat(firstWithCoords.site_latitude);
                        setCurrentLon(firstWithCoords.site_longitude);
                    }

                    setIsSaving(false);
                },
                onError: () => {
                    setIsSaving(false);
                },
            },
        );
    };

    return (
        <Panel id="dispatch-context" className="p-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-line pb-3">
                <h2 className="font-semibold text-ink">Dispatch context</h2>
                <span className="text-xs text-ink-soft">
                    Last updated: {formatDateTime(job.updated_at)}
                </span>
            </div>
            <dl className="mt-3 divide-y divide-line">
                <DataPair
                    label="Source"
                    value={
                        job.source
                            ? `${job.source.label}${job.source.reference ? ` · ${job.source.reference}` : ''}`
                            : 'Direct dispatch'
                    }
                />
                {job.source?.fulfillment_mode && (
                    <DataPair
                        label="Fulfillment"
                        value={humanize(job.source.fulfillment_mode)}
                    />
                )}
                <DataPair
                    label="Schedule"
                    value={
                        <span className="inline-flex items-start gap-2">
                            <CalendarDays
                                className="mt-0.5 h-4 w-4 shrink-0 text-brand"
                                aria-hidden="true"
                            />
                            <span className="font-medium text-ink">
                                {formatDateTime(job.scheduled_start)} –{' '}
                                {formatDateTime(job.scheduled_end)}
                            </span>
                        </span>
                    }
                />
                <DataPair
                    label="Site"
                    value={
                        <div className="space-y-1">
                            <div className="flex items-center justify-between gap-2">
                                <span className="inline-flex items-start gap-2">
                                    <MapPin
                                        className="mt-0.5 h-4 w-4 shrink-0 text-brand"
                                        aria-hidden="true"
                                    />
                                    <span className="font-medium text-ink">
                                        {job.site}
                                    </span>
                                </span>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={() =>
                                        setIsPickerOpen((open) => !open)
                                    }
                                    className="h-7 text-xs"
                                >
                                    {isPinned ? (
                                        <>
                                            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />
                                            {isPickerOpen
                                                ? 'Hide Map'
                                                : 'Anchor Coordinates'}
                                        </>
                                    ) : (
                                        <>
                                            {isPickerOpen
                                                ? 'Hide Map'
                                                : 'Pin Coordinates'}
                                        </>
                                    )}
                                    {isPickerOpen ? (
                                        <ChevronUp className="ml-1 h-3 w-3" />
                                    ) : (
                                        <ChevronDown className="ml-1 h-3 w-3" />
                                    )}
                                </Button>
                            </div>
                            {isPinned && !isPickerOpen && (
                                <p className="font-mono text-[11px] text-ink-soft">
                                    📍 {currentLat?.toFixed(5)}° N,{' '}
                                    {currentLon?.toFixed(5)}° E (Hyper-local
                                    Wind Active)
                                </p>
                            )}
                        </div>
                    }
                />
            </dl>

            {/* Expandable Site Location Picker */}
            {isPickerOpen && (
                <div className="mt-3">
                    <SiteLocationPicker
                        latitude={currentLat}
                        longitude={currentLon}
                        siteName={job.site}
                        assignedCranes={job.asset_assignments}
                        plannedSlots={job.planned_crane_slots}
                        onChange={(coords) => {
                            setCurrentLat(coords.latitude);
                            setCurrentLon(coords.longitude);
                        }}
                        onSave={handleSaveCoordinates}
                        onSaveSlots={handleSavePlannedSlots}
                        onSaveCrane={handleSaveCraneCoordinates}
                        isSaving={isSaving}
                    />
                </div>
            )}

            {/* Hyper-local Site Environmental & Wind Safety Telemetry */}
            <WeatherSafetyTelemetry
                variant="site"
                latitude={currentLat}
                longitude={currentLon}
                locationLabel={job.site}
                className="mt-4"
            />

            <div className="mt-4 rounded-lg border border-line bg-surface-subtle/80 p-3">
                <p className="text-xs font-semibold text-ink">Site note</p>
                <p className="mt-1 text-sm leading-6 text-ink-soft">
                    {job.site_notes?.trim() ||
                        'No additional site instructions were recorded.'}
                </p>
            </div>
        </Panel>
    );
}
