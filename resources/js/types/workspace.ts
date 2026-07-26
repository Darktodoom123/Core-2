export type DispatchStatusValue =
    | 'draft'
    | 'pending_approval'
    | 'scheduled'
    | 'dispatched'
    | 'accepted'
    | 'en_route'
    | 'arrived'
    | 'working'
    | 'completed'
    | 'cancelled';

export type DispatchPriorityValue = 'routine' | 'priority' | 'emergency';

export type ServiceRequestStatusValue = 'submitted' | 'dispatching';

export type FuelRequestStatusValue =
    'submitted' | 'forwarded' | 'approved' | 'rejected' | 'verified' | 'logged';

export type AssetStatusValue =
    | 'available'
    | 'assigned'
    | 'working'
    | 'under_inspection'
    | 'under_maintenance'
    | 'awaiting_parts'
    | 'ready_for_service'
    | 'unavailable';

export type ApprovalStatusValue = 'pending' | 'approved' | 'rejected';

export type CanonicalStatusValue =
    | DispatchStatusValue
    | DispatchPriorityValue
    | ServiceRequestStatusValue
    | FuelRequestStatusValue
    | AssetStatusValue
    | ApprovalStatusValue;

export interface StatusViewModel<TValue extends string> {
    value: TValue;
    label: string;
}

export interface DispatchAssignmentViewModel {
    id: number;
    user_id: number;
    name: string;
    type: string;
    response_status: StatusViewModel<'pending' | 'accepted' | 'rejected'>;
    responded_at: string | null;
    response_reason: string | null;
}

export interface DispatchAssetAssignmentViewModel {
    id: number;
    operational_asset_id: number;
    code: string;
    name: string;
    type: string;
}

export interface DispatchJobViewModel {
    id: number;
    reference: string;
    client: string;
    title: string;
    site: string;
    site_notes: string | null;
    priority: StatusViewModel<DispatchPriorityValue>;
    status: StatusViewModel<DispatchStatusValue>;
    scheduled_start: string | null;
    scheduled_end: string | null;
    requirements: string[];
    version: number;
    updated_at: string | null;
    personnel_assignments: DispatchAssignmentViewModel[];
    asset_assignments: DispatchAssetAssignmentViewModel[];
}

export interface ClientViewModel {
    id: number;
    code: string;
    company_name: string;
    address: string | null;
}

export interface ServiceRequestViewModel {
    id: number;
    reference: string;
    client: {
        id: number;
        code: string;
        company_name: string;
    };
    project_name: string;
    service_type: string;
    location: string;
    site_notes: string | null;
    scheduled_date: string | null;
    priority: StatusViewModel<DispatchPriorityValue>;
    status: StatusViewModel<ServiceRequestStatusValue>;
    requirements: string[];
    dispatch_jobs_count: number;
}

export interface InspectionViewModel {
    id: number;
    type: 'pre_operation' | 'post_operation' | 'maintenance' | 'safety';
    result: 'passed' | 'failed' | 'conditional';
    checklist: Record<string, boolean>;
    findings: string | null;
    completed_at: string | null;
}

export interface MaintenanceWorkOrderViewModel {
    id: number;
    defect: string;
    status: string;
    dispatch_blocking: boolean;
    scheduled_at: string | null;
    next_due_at: string | null;
    work_performed: string[];
    parts: string[];
    released_at: string | null;
    remarks: string | null;
}

export interface AssetViewModel {
    id: number;
    code: string;
    name: string;
    kind: string;
    subtype: string | null;
    registration_number: string | null;
    manufacturer: string | null;
    model: string | null;
    rated_capacity: string | number | null;
    capacity_unit: string | null;
    meter_type: string | null;
    meter_value: string | number | null;
    location: string | null;
    specifications: Record<string, unknown>;
    status: StatusViewModel<AssetStatusValue>;
    blocking_work_orders_count: number;
    is_dispatchable: boolean;
    inspections: InspectionViewModel[];
    maintenance_work_orders: MaintenanceWorkOrderViewModel[];
}

export interface FuelLogViewModel {
    id: number;
    quantity_litres: string;
    odometer_km: number | null;
    hour_meter: string | null;
    price_per_litre: string | null;
    total_cost: string | null;
    fuel_station: string | null;
    remarks: string | null;
    receipt_path: string | null;
    recorded_by: {
        id: number;
        name: string;
    } | null;
    recorded_at: string | null;
}

export interface FuelRequestViewModel {
    id: number;
    reference: string;
    requester: {
        id: number;
        name: string;
    };
    job: {
        id: number;
        reference: string;
        title: string;
    } | null;
    asset: {
        id: number;
        code: string;
        name?: string;
    } | null;
    quantity_litres: string;
    fuel_type: string;
    purpose: string;
    status: StatusViewModel<FuelRequestStatusValue>;
    decision_reason?: string | null;
    reviewed_at?: string | null;
    approved_at?: string | null;
    verified_at?: string | null;
    logs?: FuelLogViewModel[];
}

export interface ApprovalViewModel {
    id: number;
    kind: string;
    status: StatusViewModel<ApprovalStatusValue>;
    subject: {
        id: number;
        reference: string;
        title: string | null;
        site: string | null;
        site_notes: string | null;
        scheduled_start: string | null;
        scheduled_end: string | null;
        priority: StatusViewModel<DispatchPriorityValue> | null;
        status: StatusViewModel<DispatchStatusValue> | null;
        version: number | null;
    };
    requester: {
        id: number;
        name: string;
    };
    requested_changes: {
        personnel: Array<{
            id: number;
            name: string;
            assignment_type: string;
        }>;
        assets: Array<{
            id: number;
            code: string;
            name: string;
            assignment_type: string;
        }>;
        ended_personnel: Array<{
            id: number;
            name: string;
            assignment_type: string;
        }>;
        ended_assets: Array<{
            id: number;
            code: string;
            name: string;
            assignment_type: string;
        }>;
    };
    can_decide: boolean;
    decision_blocker: string | null;
    created_at: string | null;
}

export interface WorkspaceUserViewModel {
    id: number;
    name: string;
    email: string;
    is_active: boolean;
    role: string | null;
    role_label: string | null;
}

export interface AuditEventViewModel {
    id: number;
    action: string;
    actor: {
        id: number;
        name: string;
    } | null;
    occurred_at: string | null;
    reason: string | null;
}

export interface LocationUpdateViewModel {
    id: number;
    user: {
        id: number;
        name: string;
    };
    asset: {
        id: number;
        code: string;
        name: string;
    } | null;
    job: {
        id: number;
        reference: string;
        title: string;
    } | null;
    latitude: number | null;
    longitude: number | null;
    accuracy_metres: number | null;
    speed: number | null;
    remarks: string | null;
    source: string;
    sharing_enabled: boolean;
    captured_at: string | null;
    received_at: string | null;
    freshness_status: 'fresh' | 'delayed' | 'stale' | 'offline';
}

export type WorkspaceSection =
    | 'dispatch'
    | 'assets'
    | 'fuel'
    | 'tracking'
    | 'approvals'
    | 'users'
    | 'audit';

export interface WorkspaceNavigationItem {
    id: WorkspaceSection;
    label: string;
}

export interface WorkspaceCapabilities {
    create_dispatch: boolean;
    create_client: boolean;
    create_service_request: boolean;
    convert_service_request: boolean;
    share_location: boolean;
    view_tracking: boolean;
    request_fuel: boolean;
    forward_fuel: boolean;
    approve_fuel: boolean;
    verify_fuel: boolean;
    record_fuel: boolean;
    decide_approval: boolean;
    update_assigned_dispatch_status: boolean;
    register_asset: boolean;
    update_asset_status: boolean;
    inspect_asset: boolean;
    maintain_asset: boolean;
}

export interface WorkspaceFreshness {
    refreshed_at: string;
    stale_after_seconds: number;
}

export interface WorkspaceFlash {
    tone: 'success' | 'error' | 'warning' | 'info';
    message: string;
}

export interface GptRecommendationViewModel {
    id: number;
    subject_type: string;
    subject_id: number;
    purpose: string;
    context_hash: string;
    status: string;
    prompt_summary: string | null;
    response_summary: string | null;
    recommendation: Record<string, unknown>;
    conflicts: Array<Record<string, unknown>>;
    model: string;
    cost_usd: number | null;
    expires_at: string | null;
    is_expired: boolean;
    error_message: string | null;
    requested_by: {
        id: number;
        name: string;
    };
    decided_by: {
        id: number;
        name: string;
    } | null;
    decided_at: string | null;
    created_at: string | null;
    is_advisory: boolean;
}

export interface WorkspacePageProps {
    jobs: DispatchJobViewModel[];
    clients: ClientViewModel[];
    serviceRequests: ServiceRequestViewModel[];
    assets: AssetViewModel[];
    fuelRequests: FuelRequestViewModel[];
    locations: LocationUpdateViewModel[];
    approvals: ApprovalViewModel[];
    users: WorkspaceUserViewModel[];
    auditEvents: AuditEventViewModel[];
    gptRecommendations: GptRecommendationViewModel[];
    navigation: WorkspaceNavigationItem[];
    capabilities: WorkspaceCapabilities;
    workspace: WorkspaceFreshness;
}

export interface AssignmentScheduleConflictViewModel {
    id: number;
    reference: string;
    scheduled_start: string | null;
    scheduled_end: string | null;
}

export interface PersonnelCandidateViewModel {
    id: number;
    name: string;
    assignment_type: 'driver' | 'crane_operator' | 'field_technician';
    assignment_label: string;
    eligible: boolean;
    reasons: string[];
    availability: StatusViewModel<
        'available' | 'assigned' | 'unavailable' | 'on_leave' | 'not_recorded'
    >;
    account_status: StatusViewModel<'active' | 'inactive' | 'suspended'>;
    credential: {
        kind: 'driver_license' | 'operator_certification' | null;
        label: string;
        status:
            | 'valid'
            | 'missing'
            | 'expired'
            | 'inactive'
            | 'not_yet_valid'
            | 'not_required';
        expires_at: string | null;
    };
    schedule_conflicts: AssignmentScheduleConflictViewModel[];
    already_assigned: boolean;
}

export interface AssetCandidateViewModel {
    id: number;
    code: string;
    name: string;
    assignment_type: 'truck' | 'crane' | 'equipment';
    assignment_label: string;
    eligible: boolean;
    reasons: string[];
    readiness: StatusViewModel<AssetStatusValue>;
    blocking_maintenance_count: number;
    schedule_conflicts: AssignmentScheduleConflictViewModel[];
    already_assigned: boolean;
}

export interface DispatchDetailPageProps {
    job: DispatchJobViewModel;
    personnel_candidates: PersonnelCandidateViewModel[];
    asset_candidates: AssetCandidateViewModel[];
    activation: {
        ready: boolean;
        blockers: string[];
        approval_required: boolean;
        approval_status: ApprovalStatusValue | null;
    };
    progression: {
        current: StatusViewModel<DispatchStatusValue>;
        steps: Array<{
            status: StatusViewModel<DispatchStatusValue>;
            state: 'complete' | 'current' | 'upcoming';
        }>;
        next: {
            status: StatusViewModel<DispatchStatusValue>;
            action_label: string;
            confirmation_title: string;
            confirmation_message: string;
        } | null;
        message: string;
    } | null;
    capabilities: {
        assign_resources: boolean;
        reassign_resources: boolean;
        view_assignment_candidates: boolean;
        activate: boolean;
        update_own_status: boolean;
        respond_assignment: boolean;
        cancel: boolean;
        reopen: boolean;
        archive: boolean;
        restore: boolean;
    };
}
