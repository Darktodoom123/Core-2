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
    | 'in_transit'
    | 'on_site'
    | 'maintenance'
    | 'out_of_service'
    | 'working'
    | 'under_inspection'
    | 'under_maintenance'
    | 'awaiting_parts'
    | 'ready_for_service'
    | 'unavailable';

export type ApprovalStatusValue = 'pending' | 'approved' | 'rejected';

export type SosIncidentCategoryValue =
    | 'unclassified'
    | 'vehicular_accident'
    | 'site_accident'
    | 'critical_asset_malfunction'
    | 'other_immediate_danger';

export type SosIncidentStatusValue =
    'active' | 'escalated' | 'acknowledged' | 'resolved' | 'cancelled';

export type SosLocationFreshness = 'fresh' | 'delayed' | 'stale' | 'offline';

export type ReportExportStatusValue =
    'queued' | 'processing' | 'completed' | 'failed' | 'expired';

export type CanonicalStatusValue =
    | DispatchStatusValue
    | DispatchPriorityValue
    | ServiceRequestStatusValue
    | FuelRequestStatusValue
    | AssetStatusValue
    | ApprovalStatusValue
    | ReportExportStatusValue;

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

export type DispatchSourceType =
    | 'direct'
    | 'service_request'
    | 'rental_reservation'
    | 'sales_order'
    | 'manual';

export interface DispatchRequirementItem {
    id: string;
    text: string;
    completed: boolean;
    required_for_activation?: boolean;
}

export interface RentalItemContext {
    id: number;
    name: string;
    quantity: number;
    condition_notes?: string | null;
}

export interface SalesOrderItemContext {
    id: number;
    name: string;
    quantity: number;
    sku?: string | null;
}

export interface GeoCoordinates {
    latitude: number | null;
    longitude: number | null;
}

export interface DispatchSourceViewModel {
    type: DispatchSourceType;
    label: string;
    reference: string | null;
    status: StatusViewModel<string> | null;
    fulfillment_mode: string | null;
    location: string | null;
    manual_intake?: boolean;
    provenance_indicator?: string | null;
    service_type?: string | null;
    project_name?: string | null;
    site_notes?: string | null;
    technical_requirements?: string[];
    start_date?: string | null;
    end_date?: string | null;
    rental_items?: RentalItemContext[];
    condition_requirements?: string[];
    operator_required?: boolean;
    operator_context?: string | null;
    order_items?: SalesOrderItemContext[];
    delivery_destination_coordinates?: GeoCoordinates | null;
    total_cents?: number | null;
}

export interface UnlinkedHandoffItem {
    id: number;
    source_type: 'service' | 'rental' | 'sale';
    source_label: string;
    reference: string;
    client: {
        id: number;
        code: string;
        company_name: string;
    };
    title: string;
    location: string | null;
    scheduled_date?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    total_cents?: number | null;
    fulfillment_mode?: 'delivery' | 'pickup' | null;
    requirements?: string[];
    rental_items?: RentalItemContext[];
    order_items?: SalesOrderItemContext[];
    destination_coordinates?: GeoCoordinates | null;
    dispatch_job_id: number | null;
    matched_draft_job_id?: number | null;
    matched_draft_reference?: string | null;
    match_reason?: string | null;
    reconciliation_status: 'unlinked' | 'matching_draft_found' | 'linked';
}

export interface DispatchJobViewModel {
    id: number;
    reference: string;
    client: string;
    title: string;
    site: string;
    site_notes: string | null;
    source: DispatchSourceViewModel | null;
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

export interface CommercialDispatchHandoffViewModel {
    id: number;
    reference: string;
    client: {
        id: number;
        code: string;
        company_name: string;
    };
    status: StatusViewModel<string>;
    fulfillment_mode: 'delivery' | 'pickup';
    location: string | null;
    dispatch_job_id: number | null;
    ready: boolean;
}

export interface RentalDispatchHandoffViewModel extends CommercialDispatchHandoffViewModel {
    start_date: string | null;
    end_date: string | null;
    rental_items?: RentalItemContext[];
    condition_requirements?: string[];
    operator_required?: boolean;
    operator_context?: string | null;
}

export interface SalesDispatchHandoffViewModel extends CommercialDispatchHandoffViewModel {
    total_cents: number;
    order_items?: SalesOrderItemContext[];
    destination_coordinates?: GeoCoordinates | null;
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

export interface PersonnelCredentialViewModel {
    id: number;
    kind:
        'driver_license' | 'operator_certification' | 'qualification' | string;
    credential_number: string;
    credential_type: string;
    issued_at: string | null;
    expires_at: string | null;
    status: 'active' | 'expired' | 'suspended' | string;
    is_expired?: boolean;
    expires_soon?: boolean;
    verified_at?: string | null;
}

export interface PersonnelProfileViewModel {
    employee_number: string | null;
    availability_status: string;
    emergency_contact_name: string | null;
    emergency_contact_phone: string | null;
}

export interface WorkspaceUserViewModel {
    id: number;
    name: string;
    username?: string;
    email: string;
    phone?: string | null;
    is_active: boolean;
    suspended_at?: string | null;
    role: string | null;
    role_label: string | null;
    profile?: PersonnelProfileViewModel | null;
    credentials?: PersonnelCredentialViewModel[];
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
    subject_type?: string | null;
    subject_id?: number | string | null;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    ip_address?: string | null;
    request_id?: string | null;
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
        kind: 'truck' | 'vehicle' | 'crane' | 'equipment';
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

export interface AttachmentViewModel {
    id: number;
    kind: string;
    original_filename: string;
    mime_type: string;
    size_bytes: number;
    checksum_sha256: string;
    download_url: string;
}

export interface JobReportViewModel {
    id: number;
    dispatch_job_id: number;
    job: {
        id: number;
        reference: string;
        title: string;
    } | null;
    author: {
        id: number;
        name: string;
    } | null;
    status: StatusViewModel<'submitted' | 'approved' | 'rejected'>;
    work_summary: string;
    remarks: string | null;
    started_at: string | null;
    ended_at: string | null;
    submitted_at: string | null;
    attachments: AttachmentViewModel[];
}

export interface NotificationViewModel {
    id: string;
    type: string;
    status: string;
    data: Record<string, unknown>;
    read_at: string | null;
    created_at: string | null;
    dispatch_job: {
        id: number;
        reference: string;
        title: string;
    } | null;
}

export interface ArchivedJobViewModel {
    id: number;
    reference: string;
    client: string;
    title: string;
    site: string;
    priority: StatusViewModel<DispatchPriorityValue>;
    status: StatusViewModel<DispatchStatusValue>;
    cancellation_reason: string | null;
    version: number;
    deleted_at: string | null;
}

export interface ReportExportViewModel {
    id: string;
    export_type: StatusViewModel<string>;
    format: string;
    status: StatusViewModel<
        'queued' | 'processing' | 'completed' | 'failed' | 'expired'
    >;
    filters: Record<string, unknown> | null;
    file_size_bytes: number | null;
    row_count: number | null;
    error_message: string | null;
    expires_at: string | null;
    created_at: string | null;
    completed_at: string | null;
    is_downloadable: boolean;
    is_expired: boolean;
    download_url: string;
    retry_url: string;
}

export type WorkspaceSection =
    | 'overview'
    | 'dispatch'
    | 'assets'
    | 'fuel'
    | 'tracking'
    | 'approvals'
    | 'reports'
    | 'notifications'
    | 'archive'
    | 'gpt-recommendations'
    | 'users'
    | 'audit'
    | 'sos';

export interface WorkspaceNavigationItem {
    id: WorkspaceSection;
    label: string;
}

export interface WorkspaceCapabilities {
    create_dispatch: boolean;
    create_client: boolean;
    create_service_request: boolean;
    convert_service_request: boolean;
    create_rental_dispatch: boolean;
    create_sales_dispatch: boolean;
    share_location: boolean;
    view_tracking: boolean;
    request_fuel: boolean;
    forward_fuel: boolean;
    approve_fuel: boolean;
    verify_fuel: boolean;
    record_fuel: boolean;
    decide_approval: boolean;
    update_assigned_dispatch_status: boolean;
    update_asset_status: boolean;
    inspect_asset: boolean;
    maintain_asset: boolean;
    request_gpt_assistance: boolean;
    decide_gpt_recommendation: boolean;
    retry_gpt_recommendation: boolean;
    create_job_report: boolean;
    attachment_upload: boolean;
    attachment_policy: {
        owner_type: 'job_report';
        max_bytes: number;
        max_count: number;
        accepted_mime_types: string[];
    };
    review_job_report: boolean;
    export_reports: boolean;
    manage_notifications: boolean;
    view_archive: boolean;
    restore_dispatch: boolean;
    view_sos: boolean;
    respond_sos: boolean;
}

export interface SosPersonViewModel {
    id: number;
    name: string;
    phone: string | null;
}

export interface SosIncidentLocationViewModel {
    latitude: number | null;
    longitude: number | null;
    accuracy_metres: number | null;
    captured_at: string | null;
    freshness_status: SosLocationFreshness;
    context: string | null;
}

export interface SosDeliveryAttemptViewModel {
    channel: 'database' | 'realtime' | 'email' | 'sms' | string;
    target: string;
    status: 'pending' | 'sent' | 'delivered' | 'failed' | string;
    attempted_at: string | null;
    delivered_at: string | null;
    failure_code: string | null;
}

export interface SosIncidentViewModel {
    id: string;
    category: StatusViewModel<SosIncidentCategoryValue>;
    status: StatusViewModel<SosIncidentStatusValue>;
    note: string | null;
    worker: SosPersonViewModel;
    received_at: string;
    device_activated_at: string | null;
    escalation_due_at: string | null;
    escalated_at: string | null;
    acknowledged_at: string | null;
    acknowledged_by: SosPersonViewModel | null;
    resolved_at: string | null;
    resolved_by: SosPersonViewModel | null;
    resolution_code: string | null;
    resolution_notes: string | null;
    cancelled_at: string | null;
    cancellation_reason: string | null;
    dispatch: {
        id: number;
        reference: string;
        title: string;
        site: string | null;
    } | null;
    asset: {
        id: number;
        code: string;
        name: string;
    } | null;
    location: SosIncidentLocationViewModel | null;
    delivery_attempts: SosDeliveryAttemptViewModel[];
    can_acknowledge: boolean;
    can_resolve: boolean;
    can_cancel: boolean;
}

export interface WorkspaceFreshness {
    refreshed_at: string;
    stale_after_seconds: number;
    tracking?: WorkspaceTrackingFreshness;
}

export type RefreshScope = 'workspace' | 'tracking';

export type RefreshMode = 'initial' | 'realtime' | 'polling' | 'manual';

export type RefreshStatus = 'idle' | 'refreshing' | 'succeeded' | 'failed';

export interface WorkspaceScopeFreshness {
    refreshed_at: string;
    stale_after_seconds: number;
}

export interface WorkspaceTrackingFreshness extends WorkspaceScopeFreshness {
    latest_received_at: string | null;
    current_user: {
        sharing_enabled: boolean | null;
        captured_at: string | null;
        received_at: string | null;
    } | null;
}

export interface ScopeRefreshState extends WorkspaceScopeFreshness {
    status: RefreshStatus;
    mode: RefreshMode;
    last_attempt_at: string | null;
    last_success_at: string | null;
    error: string | null;
}

export interface WorkspaceRefreshState {
    workspace: ScopeRefreshState;
    tracking: ScopeRefreshState;
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
    is_stale?: boolean;
    prompt_summary: string | null;
    response_summary: string | null;
    recommendation: Record<string, unknown>;
    proposed_personnel?: Array<{
        user_id: number;
        name?: string;
        role?: string;
        assignment_type: string;
    }>;
    proposed_assets?: Array<{
        operational_asset_id: number;
        asset_code?: string;
        name?: string;
        assignment_type: string;
    }>;
    conflicts: Array<Record<string, unknown>>;
    model: string;
    cost_usd: number | null;
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    } | null;
    generated_at: string | null;
    latency_ms: number | null;
    purge_at: string | null;
    expires_at: string | null;
    expires_in_seconds?: number;
    is_expired: boolean;
    is_retryable: boolean;
    error_message: string | null;
    retry_url: string;
    requested_by: {
        id: number;
        name: string;
    };
    decided_by: {
        id: number;
        name: string;
    } | null;
    decided_by_name?: string | null;
    decided_at: string | null;
    created_at: string | null;
    is_advisory: boolean;
}

export interface WorkspacePageProps {
    jobs?: DispatchJobViewModel[];
    clients?: ClientViewModel[];
    serviceRequests?: ServiceRequestViewModel[];
    rentalHandoffs?: RentalDispatchHandoffViewModel[];
    salesHandoffs?: SalesDispatchHandoffViewModel[];
    assets?: AssetViewModel[];
    fuelRequests?: FuelRequestViewModel[];
    locations?: LocationUpdateViewModel[];
    approvals?: ApprovalViewModel[];
    users?: WorkspaceUserViewModel[];
    auditEvents?: AuditEventViewModel[];
    gptRecommendations?: GptRecommendationViewModel[];
    jobReports?: JobReportViewModel[];
    reportExports?: ReportExportViewModel[];
    notifications?: NotificationViewModel[];
    archivedJobs?: ArchivedJobViewModel[];
    navigation: WorkspaceNavigationItem[];
    initial_section: WorkspaceSection | null;
    capabilities: WorkspaceCapabilities;
    workspace: WorkspaceFreshness;
    badges?: {
        jobs: number;
        pending_approvals: number;
        unread_notifications: number;
        blocking_assets: number;
    };
    activeSosIncidents: SosIncidentViewModel[];
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
    assignment_type: 'truck' | 'crane' | 'mobile_crane' | 'equipment';
    assignment_label: string;
    eligible: boolean;
    reasons: string[];
    readiness: StatusViewModel<AssetStatusValue>;
    blocking_maintenance_count: number;
    schedule_conflicts: AssignmentScheduleConflictViewModel[];
    already_assigned: boolean;
}

export interface CandidatePageViewModel<T> {
    data: T[];
    pagination: {
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
        from: number | null;
        to: number | null;
    };
    evaluated_at: string;
    job_version: number;
    schedule_fingerprint: string;
    error: string | null;
}

export interface DispatchDetailPageProps {
    job: DispatchJobViewModel;
    personnel_candidates?:
        | CandidatePageViewModel<PersonnelCandidateViewModel>
        | PersonnelCandidateViewModel[];
    asset_candidates?:
        | CandidatePageViewModel<AssetCandidateViewModel>
        | AssetCandidateViewModel[];
    activation: {
        ready: boolean;
        blockers: string[];
        approval_required: boolean;
        approval_status: ApprovalStatusValue | null;
        approval_request_id?: number | null;
        approval_kind?: string | null;
        approval_reason?: string | null;
        approval_notes?: string | null;
        can_decide_approval?: boolean;
        can_approve_and_activate?: boolean;
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
        request_gpt_assistance?: boolean;
    };
}
