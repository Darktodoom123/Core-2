/**
 * Shared view-model factories for the manager dashboard model and component
 * tests. Values mirror the shapes the workspace view models send.
 */
import type {
    ApprovalViewModel,
    AssetViewModel,
    DispatchJobViewModel,
    FuelRequestViewModel,
    SosIncidentViewModel,
    WorkspaceCapabilities,
} from '@/types/workspace';

// 09:42 local time keeps "today" independent of the machine's timezone.
export const NOW = new Date(2026, 8, 26, 9, 42, 0).getTime();

export function at(hours: number, minutes = 0, dayOffset = 0): string {
    return new Date(2026, 8, 26 + dayOffset, hours, minutes, 0).toISOString();
}

export function minutesAgo(minutes: number): string {
    return new Date(NOW - minutes * 60_000).toISOString();
}

export const ALL_FUEL_CAPABILITIES = {
    forward_fuel: true,
    approve_fuel: true,
    verify_fuel: true,
    record_fuel: true,
} as WorkspaceCapabilities;

export function sos(
    id: string,
    overrides: Partial<SosIncidentViewModel> = {},
): SosIncidentViewModel {
    return {
        id,
        category: { value: 'site_accident', label: 'Site accident' },
        status: { value: 'active', label: 'Active' },
        note: null,
        worker: { id: 7, name: `Operator ${id}`, phone: null },
        received_at: minutesAgo(1),
        device_activated_at: null,
        escalation_due_at: new Date(NOW + 108_000).toISOString(),
        escalated_at: null,
        acknowledged_at: null,
        acknowledged_by: null,
        resolved_at: null,
        resolved_by: null,
        resolution_code: null,
        resolution_notes: null,
        cancelled_at: null,
        cancellation_reason: null,
        dispatch: {
            id: 142,
            reference: 'DSP-0142',
            title: 'Crane lift',
            site: 'Taguig site',
        },
        asset: { id: 50, code: 'CR-50T', name: '50T mobile crane' },
        location: null,
        delivery_attempts: [],
        can_acknowledge: true,
        can_resolve: true,
        can_cancel: false,
        ...overrides,
    };
}

export function asset(
    id: number,
    overrides: Partial<AssetViewModel> = {},
): AssetViewModel {
    return {
        id,
        code: `A-${id}`,
        name: `Asset ${id}`,
        kind: 'mobile_crane',
        subtype: null,
        category: 'mobile_cranes',
        category_label: 'Mobile crane',
        status: { value: 'available', label: 'Available' },
        blocking_work_orders_count: 0,
        is_dispatchable: true,
        inspections: [],
        maintenance_work_orders: [],
        ...overrides,
    } as AssetViewModel;
}

export function approval(
    id: number,
    overrides: Partial<ApprovalViewModel> = {},
    subject: Partial<ApprovalViewModel['subject']> = {},
): ApprovalViewModel {
    return {
        id,
        kind: 'dispatch_activation',
        status: { value: 'pending', label: 'Pending' },
        subject: {
            id: 100 + id,
            reference: `DSP-0${100 + id}`,
            title: 'Boom truck delivery',
            site: 'Makati',
            site_notes: null,
            scheduled_start: at(10),
            scheduled_end: at(12),
            priority: { value: 'routine', label: 'Routine' },
            status: { value: 'pending_approval', label: 'Pending approval' },
            version: 1,
            ...subject,
        },
        requester: { id: 3, name: 'Dispatcher One' },
        requested_changes: {
            personnel: [],
            assets: [],
            ended_personnel: [],
            ended_assets: [],
        },
        can_decide: true,
        decision_blocker: null,
        created_at: minutesAgo(41),
        ...overrides,
    };
}

export function fuel(
    id: number,
    status: FuelRequestViewModel['status']['value'],
    overrides: Partial<FuelRequestViewModel> = {},
): FuelRequestViewModel {
    return {
        id,
        reference: `FR-${id}`,
        requester: { id: 9, name: 'Field Operator' },
        job: { id: 136, reference: 'DSP-0136', title: 'Steel truss lift' },
        asset: { id: 12, code: 'TR-12', name: 'Tractor head' },
        quantity_litres: '180.00',
        fuel_type: 'diesel',
        purpose: 'Haul',
        urgency: { value: 'normal', label: 'Normal' },
        status: { value: status, label: status },
        submitted_at: minutesAgo(65),
        logs: [],
        ...overrides,
    };
}

export function job(
    id: number,
    status: DispatchJobViewModel['status']['value'],
    overrides: Partial<DispatchJobViewModel> = {},
): DispatchJobViewModel {
    return {
        id,
        reference: `DSP-${id}`,
        client: 'Client',
        title: `Job ${id}`,
        site: 'Site',
        site_notes: null,
        source: {
            type: 'service_request',
            label: 'Service',
            reference: null,
            status: null,
            fulfillment_mode: null,
            location: null,
        },
        priority: { value: 'routine', label: 'Routine' },
        status: { value: status, label: status },
        scheduled_start: at(8),
        scheduled_end: at(12),
        requirements: [],
        version: 1,
        updated_at: null,
        personnel_assignments: [
            {
                id: 1,
                user_id: 1,
                name: 'Operator',
                type: 'crane_operator',
                response_status: { value: 'accepted', label: 'Accepted' },
                responded_at: null,
                response_reason: null,
            },
        ],
        asset_assignments: [
            {
                id: 1,
                operational_asset_id: 1,
                code: 'CR-1',
                name: 'Crane',
                type: 'crane',
            },
        ],
        ...overrides,
    };
}
