import type { DispatchJob, LocationSharePayload, User } from '../types/index';
import type { CommandOutboxManager } from './commandOutbox';

export interface LocationCoordinates {
    latitude: number;
    longitude: number;
    accuracyMetres?: number | null;
}

export class LocationSharingService {
    private trackingTimer: ReturnType<typeof setInterval> | null = null;
    private isAutoTracking = false;

    constructor(private outbox: CommandOutboxManager) {}

    public canShareLocation(
        user?: User | null,
        job?: DispatchJob | null,
    ): boolean {
        if (!user || !user.is_active) {
            return false;
        }

        if (job) {
            return Boolean(job.capabilities?.can_share_location);
        }

        return true;
    }

    public async shareLocation(
        user: User,
        job: DispatchJob | null,
        assetId: number | null,
        coords: LocationCoordinates,
        remarks?: string,
    ): Promise<{ success: boolean; commandId?: string; reason?: string }> {
        if (!this.canShareLocation(user, job)) {
            return {
                success: false,
                reason: 'Location sharing is not authorized for this user or job contract.',
            };
        }

        const payload: LocationSharePayload = {
            dispatch_job_id: job?.id ?? null,
            operational_asset_id: assetId ?? null,
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy_metres: coords.accuracyMetres ?? null,
            sharing_enabled: true,
            captured_at: new Date().toISOString(),
            remarks: remarks ?? null,
        };

        const command = await this.outbox.enqueueShareLocation(payload);

        return {
            success: true,
            commandId: command.id,
        };
    }

    public async pauseSharing(
        user: User,
        job?: DispatchJob | null,
    ): Promise<{ success: boolean; commandId?: string; reason?: string }> {
        this.stopAutoTracking();

        if (!user || !user.is_active) {
            return {
                success: false,
                reason: 'Location sharing pause is not permitted for inactive user.',
            };
        }

        const payload: LocationSharePayload = {
            dispatch_job_id: job?.id ?? null,
            latitude: 0,
            longitude: 0,
            sharing_enabled: false,
            captured_at: new Date().toISOString(),
            remarks: 'Sharing paused by user',
        };

        const command = await this.outbox.enqueueShareLocation(payload);

        return {
            success: true,
            commandId: command.id,
        };
    }

    public startAutoTracking(
        user: User,
        job: DispatchJob | null,
        getLocationCoords: () => Promise<LocationCoordinates>,
        intervalMs: number = 30000, // Default 30s cadence for active work
    ): void {
        this.stopAutoTracking();

        if (!this.canShareLocation(user, job)) {
            return;
        }

        this.isAutoTracking = true;

        const captureAndQueue = async () => {
            if (!this.isAutoTracking || !this.canShareLocation(user, job)) {
                this.stopAutoTracking();

                return;
            }

            try {
                const coords = await getLocationCoords();
                await this.shareLocation(
                    user,
                    job,
                    null,
                    coords,
                    'Periodic field telemetry',
                );
            } catch (error: unknown) {
                // If location permissions were revoked mid-shift, halt auto-tracking immediately
                if (
                    error instanceof Error &&
                    error.message.includes('revoked')
                ) {
                    this.stopAutoTracking();
                }
            }
        };

        void captureAndQueue();
        this.trackingTimer = setInterval(() => {
            void captureAndQueue();
        }, intervalMs);
    }

    public stopAutoTracking(): void {
        this.isAutoTracking = false;

        if (this.trackingTimer) {
            clearInterval(this.trackingTimer);
            this.trackingTimer = null;
        }
    }

    public isTracking(): boolean {
        return this.isAutoTracking;
    }
}
