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
    name: string;
    type: string;
    response_status: StatusViewModel<'pending' | 'accepted' | 'rejected'>;
}

export interface DispatchAssetAssignmentViewModel {
    id: number;
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

export interface AssetViewModel {
    id: number;
    code: string;
    name: string;
    kind: string;
    location: string | null;
    status: StatusViewModel<AssetStatusValue>;
    blocking_work_orders_count: number;
}

export interface FuelRequestViewModel {
    id: number;
    reference: string;
    requester: {
        id: number;
        name: string;
    };
    asset: {
        id: number;
        code: string;
    } | null;
    quantity_litres: string;
    fuel_type: string;
    purpose: string;
    status: StatusViewModel<FuelRequestStatusValue>;
}

export interface ApprovalViewModel {
    id: number;
    kind: string;
    status: StatusViewModel<ApprovalStatusValue>;
    subject: {
        id: number;
        reference: string;
    };
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

export type WorkspaceSection =
    'dispatch' | 'assets' | 'fuel' | 'approvals' | 'users' | 'audit';

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
    request_fuel: boolean;
    forward_fuel: boolean;
    approve_fuel: boolean;
    verify_fuel: boolean;
    decide_approval: boolean;
}

export interface WorkspaceFreshness {
    refreshed_at: string;
    stale_after_seconds: number;
}

export interface WorkspaceFlash {
    tone: 'success' | 'error' | 'warning' | 'info';
    message: string;
}

export interface WorkspacePageProps {
    jobs: DispatchJobViewModel[];
    clients: ClientViewModel[];
    serviceRequests: ServiceRequestViewModel[];
    assets: AssetViewModel[];
    fuelRequests: FuelRequestViewModel[];
    approvals: ApprovalViewModel[];
    users: WorkspaceUserViewModel[];
    auditEvents: AuditEventViewModel[];
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
    capabilities: {
        assign_resources: boolean;
        view_assignment_candidates: boolean;
    };
}
