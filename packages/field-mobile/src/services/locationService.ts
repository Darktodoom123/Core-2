import type { DispatchJob, LocationSharePayload, User } from '../types/index';
import type { CommandOutboxManager } from './commandOutbox';

export interface LocationCoordinates {
    latitude: number;
    longitude: number;
    accuracyMetres?: number | null;
}

export class LocationSharingService {
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
}
