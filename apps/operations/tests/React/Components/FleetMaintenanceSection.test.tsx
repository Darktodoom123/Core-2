import { fireEvent, render, screen } from '@testing-library/react';
import React, { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FleetMaintenanceSection } from '@/components/workspace/fleet/fleet-maintenance-section';
import type { AssetViewModel } from '@/types/workspace';

let mockPost = vi.fn();

vi.mock('@inertiajs/react', () => {
    return {
        useForm: (initialValues: any) => {
            const [data, setDataState] = useState(initialValues);
            const [errors, setErrors] = useState<Record<string, string>>({});
            const [processing, setProcessing] = useState(false);
            let transformer: (d: any) => any = (d) => d;

            return {
                data,
                setData: (keyOrFn: any, val?: any) => {
                    if (typeof keyOrFn === 'function') {
                        setDataState(keyOrFn);
                    } else if (typeof keyOrFn === 'string') {
                        setDataState((prev: any) => ({
                            ...prev,
                            [keyOrFn]: val,
                        }));
                    } else {
                        setDataState(keyOrFn);
                    }
                },
                post: (url: string, options?: any) => {
                    mockPost(url, { data: transformer(data), options });
                    options?.onSuccess?.();
                },
                errors,
                setErrors,
                processing,
                setProcessing,
                reset: vi.fn(),
                clearErrors: vi.fn(),
                setError: (key: string, message: string) => {
                    setErrors((prev) => ({ ...prev, [key]: message }));
                },
                transform: (callback: any) => {
                    transformer = callback;
                },
            };
        },
    };
});

function createMockAsset(overrides: Partial<AssetViewModel> = {}): AssetViewModel {
    return {
        id: 1,
        code: 'CRN-001',
        name: 'Test Crane',
        kind: 'crane',
        status: {
            value: 'under_maintenance',
            label: 'Under Maintenance',
            badge_color: 'amber',
            allows_dispatch: false,
        },
        blocking_work_orders_count: 1,
        maintenance_work_orders: [
            {
                id: 101,
                defect: 'Hydraulic boom seal leak',
                status: 'open',
                dispatch_blocking: true,
                scheduled_at: null,
                next_due_at: null,
                completed_at: null,
                work_performed: [],
                parts: [],
                released_at: null,
                remarks: 'Requires cylinder overhaul',
            },
        ],
        inspections: [],
        dvir_inspections: [],
        fuel_logs: [],
        ...overrides,
    } as unknown as AssetViewModel;
}

describe('FleetMaintenanceSection UI', () => {
    beforeEach(() => {
        mockPost = vi.fn();
        vi.clearAllMocks();
    });

    it('displays "Pending Repair Completion" and provides "Record repair completion" action for authorized maintainers', () => {
        const asset = createMockAsset();

        render(<FleetMaintenanceSection asset={asset} canMaintain={true} />);

        expect(screen.getByText('Hydraulic boom seal leak')).toBeInTheDocument();
        expect(screen.getByText('Pending Repair Completion')).toBeInTheDocument();

        const recordBtn = screen.getByRole('button', {
            name: /record repair completion/i,
        });
        expect(recordBtn).toBeInTheDocument();
    });

    it('does not display maintenance action buttons for non-maintainers', () => {
        const asset = createMockAsset();

        render(<FleetMaintenanceSection asset={asset} canMaintain={false} />);

        expect(
            screen.queryByRole('button', { name: /record repair completion/i }),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: /release work order/i }),
        ).not.toBeInTheDocument();
    });

    it('opens repair completion form and posts to /operations/maintenance/:id/complete', () => {
        const asset = createMockAsset();

        render(<FleetMaintenanceSection asset={asset} canMaintain={true} />);

        const recordBtn = screen.getByRole('button', {
            name: /record repair completion/i,
        });
        fireEvent.click(recordBtn);

        expect(
            screen.getByText(/authoritatively record physical repair completion/i),
        ).toBeInTheDocument();

        const workPerformedTextarea = screen.getByLabelText(/work performed \*/i);
        fireEvent.change(workPerformedTextarea, {
            target: { value: 'Replaced boom hydraulic seal\nPressure tested at 250 bar' },
        });

        const partsInput = screen.getByLabelText(/parts used/i);
        fireEvent.change(partsInput, {
            target: { value: 'SEAL-HYD-99, O-RING-22' },
        });

        const timestampInput = screen.getByLabelText(/completion timestamp/i);
        expect(timestampInput).toBeInTheDocument();
        fireEvent.change(timestampInput, {
            target: { value: '2026-09-17 10:30:00' },
        });

        const submitBtn = screen.getByRole('button', {
            name: /^record repair completion$/i,
        });
        fireEvent.click(submitBtn);

        expect(mockPost).toHaveBeenCalledWith(
            '/operations/maintenance/101/complete',
            expect.objectContaining({
                data: expect.objectContaining({
                    work_performed: ['Replaced boom hydraulic seal', 'Pressure tested at 250 bar'],
                    parts: ['SEAL-HYD-99', 'O-RING-22'],
                    completed_at: '2026-09-17 10:30:00',
                }),
            }),
        );
    });

    it('displays "Repair Completed" badge and enables "Release work order" action when repair is already completed', () => {
        const asset = createMockAsset({
            maintenance_work_orders: [
                {
                    id: 102,
                    defect: 'Brake cylinder failure',
                    status: 'repair_completed',
                    dispatch_blocking: true,
                    scheduled_at: null,
                    next_due_at: null,
                    completed_at: '2026-09-17T10:30:00.000Z',
                    work_performed: ['Replaced master cylinder'],
                    parts: ['CYL-900'],
                    released_at: null,
                    remarks: null,
                },
            ],
        });

        render(<FleetMaintenanceSection asset={asset} canMaintain={true} />);

        expect(screen.getByText(/repair completed/i)).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: /release work order/i }),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: /record repair completion/i }),
        ).not.toBeInTheDocument();
    });
});
