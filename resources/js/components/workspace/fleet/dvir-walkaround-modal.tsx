import {
    AlertTriangle,
    Camera,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    ExternalLink,
    ShieldAlert,
    X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui';
import { humanize } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { AssetViewModel } from '@/types/workspace';

interface DvirWalkaroundModalProps {
    isOpen: boolean;
    onClose: () => void;
    dvir: NonNullable<AssetViewModel['latest_dvir']>;
    assetCode: string;
    assetName: string;
    isLockedOut?: boolean;
    lockoutReason?: string | null;
    onResolveLockout?: () => void;
    canOverrideLockout?: boolean;
}

const ANGLE_LABELS: Record<string, string> = {
    front: 'Front Angle',
    passenger_side: 'Passenger Side',
    rear: 'Rear Angle',
    driver_side: 'Driver Side',
};

export function DvirWalkaroundModal({
    isOpen,
    onClose,
    dvir,
    assetCode,
    assetName,
    isLockedOut = false,
    lockoutReason = null,
    onResolveLockout,
    canOverrideLockout = false,
}: DvirWalkaroundModalProps) {
    const photos = dvir.photos ?? [];
    const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            } else if (e.key === 'ArrowRight') {
                setSelectedPhotoIndex((prev) =>
                    photos.length > 0 ? (prev + 1) % photos.length : 0,
                );
            } else if (e.key === 'ArrowLeft') {
                setSelectedPhotoIndex((prev) =>
                    photos.length > 0
                        ? (prev - 1 + photos.length) % photos.length
                        : 0,
                );
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose, photos.length]);

    if (!isOpen) {
        return null;
    }

    const currentPhoto = photos[selectedPhotoIndex] ?? null;
    const isCritical =
        dvir.status === 'critical_defect' || dvir.critical_defects_count > 0;
    const isDefect = dvir.status === 'defect_flagged' || dvir.has_defects;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dvir-modal-title"
        >
            <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b border-line px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div
                            className={cn(
                                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                                isCritical
                                    ? 'bg-danger-soft text-danger-strong'
                                    : isDefect
                                      ? 'bg-warning-soft text-warning-strong'
                                      : 'bg-success-soft text-success-strong',
                            )}
                        >
                            {isCritical ? (
                                <ShieldAlert className="h-6 w-6" />
                            ) : isDefect ? (
                                <AlertTriangle className="h-6 w-6" />
                            ) : (
                                <CheckCircle2 className="h-6 w-6" />
                            )}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3
                                    id="dvir-modal-title"
                                    className="text-base font-bold text-ink"
                                >
                                    DVIR Walkaround Inspection
                                </h3>
                                <span className="rounded bg-surface-subtle px-2 py-0.5 font-mono text-xs font-semibold text-ink-soft">
                                    {dvir.type === 'post_trip'
                                        ? 'Post-Trip'
                                        : 'Pre-Trip'}
                                </span>
                            </div>
                            <p className="text-xs text-ink-soft">
                                Asset:{' '}
                                <strong className="text-ink">
                                    {assetCode}
                                </strong>{' '}
                                ({assetName})
                                {dvir.completed_at && (
                                    <span>
                                        {' '}
                                        · Completed{' '}
                                        {new Date(
                                            dvir.completed_at,
                                        ).toLocaleString([], {
                                            month: 'short',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-ink-soft hover:bg-surface-subtle hover:text-ink focus:outline-none"
                        aria-label="Close dialog"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Lockout Alert Banner */}
                {isLockedOut && (
                    <div className="border-b border-danger/20 bg-danger-soft/70 px-6 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                                <ShieldAlert className="h-5 w-5 shrink-0 text-danger-strong" />
                                <div>
                                    <h4 className="text-xs font-bold text-danger-strong">
                                        SAFETY LOCKOUT ENFORCED
                                    </h4>
                                    <p className="text-xs text-danger-strong/90">
                                        {lockoutReason ||
                                            'Critical safety defect reported during walkaround inspection.'}
                                    </p>
                                </div>
                            </div>

                            {canOverrideLockout && onResolveLockout && (
                                <Button
                                    size="sm"
                                    variant="danger"
                                    onClick={onResolveLockout}
                                >
                                    Clear Safety Lockout
                                </Button>
                            )}
                        </div>
                    </div>
                )}

                {/* Modal Body */}
                <div className="flex flex-1 flex-col overflow-y-auto p-6 lg:flex-row lg:gap-6">
                    {/* Left: Photo Viewer */}
                    <div className="flex flex-1 flex-col space-y-3">
                        <div className="relative flex aspect-4/3 w-full items-center justify-center overflow-hidden rounded-xl border border-line bg-zinc-950">
                            {currentPhoto ? (
                                <>
                                    <img
                                        src={currentPhoto.url}
                                        alt={`${ANGLE_LABELS[currentPhoto.angle] ?? currentPhoto.angle} for asset ${assetCode}`}
                                        className="h-full w-full object-contain"
                                    />
                                    <div className="absolute top-3 left-3 rounded-lg bg-black/70 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-xs">
                                        {ANGLE_LABELS[currentPhoto.angle] ??
                                            humanize(currentPhoto.angle)}
                                    </div>
                                    <a
                                        href={currentPhoto.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="absolute top-3 right-3 rounded-lg bg-black/70 p-1.5 text-white/80 backdrop-blur-xs hover:text-white"
                                        title="Open full resolution in new tab"
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                    </a>

                                    {/* Carousel navigation controls */}
                                    {photos.length > 1 && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setSelectedPhotoIndex(
                                                        (prev) =>
                                                            (prev -
                                                                1 +
                                                                photos.length) %
                                                            photos.length,
                                                    )
                                                }
                                                className="absolute top-1/2 left-2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white/80 transition-colors hover:bg-black/80 hover:text-white"
                                                aria-label="Previous photo"
                                            >
                                                <ChevronLeft className="h-5 w-5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setSelectedPhotoIndex(
                                                        (prev) =>
                                                            (prev + 1) %
                                                            photos.length,
                                                    )
                                                }
                                                className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white/80 transition-colors hover:bg-black/80 hover:text-white"
                                                aria-label="Next photo"
                                            >
                                                <ChevronRight className="h-5 w-5" />
                                            </button>
                                        </>
                                    )}
                                </>
                            ) : (
                                <div className="flex flex-col items-center justify-center p-8 text-center text-zinc-400">
                                    <Camera className="mb-2 h-10 w-10 stroke-1 opacity-50" />
                                    <p className="text-xs">
                                        No walkaround photos attached to this
                                        inspection
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Thumbnail Strip */}
                        {photos.length > 0 && (
                            <div className="grid grid-cols-4 gap-2">
                                {photos.map((photo, index) => {
                                    const isSelected =
                                        index === selectedPhotoIndex;
                                    const angleLabel =
                                        ANGLE_LABELS[photo.angle] ??
                                        photo.angle;

                                    return (
                                        <button
                                            key={photo.id || index}
                                            type="button"
                                            onClick={() =>
                                                setSelectedPhotoIndex(index)
                                            }
                                            className={cn(
                                                'group relative aspect-4/3 overflow-hidden rounded-lg border text-left transition-all',
                                                isSelected
                                                    ? 'border-brand-strong ring-2 ring-brand/40'
                                                    : 'border-line opacity-75 hover:opacity-100',
                                            )}
                                        >
                                            <img
                                                src={photo.url}
                                                alt={angleLabel}
                                                className="h-full w-full object-cover"
                                            />
                                            <span className="absolute inset-x-0 bottom-0 truncate bg-black/70 px-1 py-0.5 text-[9px] font-semibold text-white">
                                                {angleLabel}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Right: Inspection Details & Defects Summary */}
                    <div className="mt-4 flex w-full flex-col space-y-4 lg:mt-0 lg:w-80">
                        <div className="rounded-xl border border-line bg-surface-subtle p-4">
                            <h4 className="text-xs font-bold tracking-wider text-ink uppercase">
                                Inspection Summary
                            </h4>
                            <dl className="mt-3 space-y-2 text-xs">
                                <div className="flex justify-between">
                                    <dt className="text-ink-soft">
                                        Inspection ID
                                    </dt>
                                    <dd className="font-mono font-semibold text-ink">
                                        DVIR-{String(dvir.id).padStart(6, '0')}
                                    </dd>
                                </div>
                                <div className="flex justify-between">
                                    <dt className="text-ink-soft">Result</dt>
                                    <dd>
                                        <span
                                            className={cn(
                                                'rounded px-1.5 py-0.5 text-[10px] font-bold',
                                                isCritical
                                                    ? 'bg-danger-soft text-danger-strong'
                                                    : isDefect
                                                      ? 'bg-warning-soft text-warning-strong'
                                                      : 'bg-success-soft text-success-strong',
                                            )}
                                        >
                                            {isCritical
                                                ? 'CRITICAL DEFECT'
                                                : isDefect
                                                  ? 'DEFECTS FLAGGED'
                                                  : 'PASSED'}
                                        </span>
                                    </dd>
                                </div>
                                <div className="flex justify-between">
                                    <dt className="text-ink-soft">
                                        Defects Count
                                    </dt>
                                    <dd className="font-semibold text-ink">
                                        {dvir.critical_defects_count > 0
                                            ? `${dvir.critical_defects_count} critical defect(s)`
                                            : dvir.has_defects
                                              ? 'Minor defects noted'
                                              : 'None (Clean)'}
                                    </dd>
                                </div>
                                <div className="flex justify-between">
                                    <dt className="text-ink-soft">
                                        Photos Verified
                                    </dt>
                                    <dd className="font-semibold text-ink">
                                        {photos.length} angle(s) captured
                                    </dd>
                                </div>
                            </dl>
                        </div>

                        {/* Safety & Compliance Card */}
                        <div className="rounded-xl border border-line bg-surface p-4 text-xs">
                            <h4 className="flex items-center gap-1.5 font-semibold text-ink">
                                <ShieldAlert className="h-4 w-4 text-brand-strong" />
                                Walkaround Verification
                            </h4>
                            <p className="mt-1.5 text-[11px] leading-relaxed text-ink-soft">
                                Field mobile operator walkarounds enforce
                                mandatory 4-angle exterior photo verification
                                and checklist item grading before heavy
                                machinery operation.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-end border-t border-line bg-surface-subtle/50 px-6 py-3">
                    <Button variant="secondary" onClick={onClose}>
                        Close
                    </Button>
                </div>
            </div>
        </div>
    );
}
