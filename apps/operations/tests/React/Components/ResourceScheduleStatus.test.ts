import { describe, expect, it } from 'vitest';
import {
    getScheduleAwareStatus,
    resolveAssetDisplayStatus,
} from '@/components/workspace/resource-schedule-status';
import type {
    AssetDispatchOccupancyViewModel,
    AssetViewModel,
    DispatchJobViewModel,
} from '@/types/workspace';

const job = (status: string) =>
    ({ status: { value: status, label: status } }) as DispatchJobViewModel;

const occupancy = (
    state: AssetDispatchOccupancyViewModel['state'],
    label: string,
): AssetDispatchOccupancyViewModel => ({
    state,
    label,
    open_jobs_count: 1,
    job: {
        id: 1,
        reference: 'DSP-1',
        title: null,
        status: { value: 'scheduled', label: 'Scheduled' },
        scheduled_start: null,
        scheduled_end: null,
    },
});

describe('schedule-aware resource status', () => {
    it('keeps the recorded status when the resource carries no open work', () => {
        expect(getScheduleAwareStatus('Available', 'success', [])).toEqual({
            label: 'Available',
            tone: 'success',
        });
        expect(
            getScheduleAwareStatus('Available', 'success', [
                job('completed'),
                job('cancelled'),
            ]),
        ).toEqual({ label: 'Available', tone: 'success' });
    });

    it('reports the most operationally significant commitment', () => {
        expect(
            getScheduleAwareStatus('Available', 'success', [job('draft')]),
        ).toEqual({ label: 'Tentative', tone: 'warning' });
        expect(
            getScheduleAwareStatus('Available', 'success', [
                job('pending_approval'),
                job('scheduled'),
            ]),
        ).toEqual({ label: 'Scheduled', tone: 'brand' });
        expect(
            getScheduleAwareStatus('Available', 'success', [
                job('scheduled'),
                job('en_route'),
            ]),
        ).toEqual({ label: 'On Job', tone: 'info' });
    });

    it('never masks a blocking fleet status', () => {
        expect(
            getScheduleAwareStatus('Under maintenance', 'warning', [
                job('working'),
            ]),
        ).toEqual({ label: 'Under maintenance', tone: 'warning' });
    });

    it('shows server occupancy only for open assets', () => {
        const available = {
            status: { value: 'available', label: 'Available' },
            dispatch_occupancy: occupancy('scheduled', 'Scheduled'),
        } as AssetViewModel;
        const maintenance = {
            status: { value: 'under_maintenance', label: 'Under maintenance' },
            dispatch_occupancy: occupancy('scheduled', 'Scheduled'),
        } as AssetViewModel;

        expect(resolveAssetDisplayStatus(available)).toEqual({
            value: 'scheduled',
            label: 'Scheduled',
        });
        expect(resolveAssetDisplayStatus(maintenance)).toBe(maintenance.status);
    });
});
