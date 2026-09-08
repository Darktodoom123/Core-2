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
    credential?: {
        label: string;
        status: string;
        expires_at: string | null;
    } | null;
}

export interface DispatchAssetAssignmentViewModel {
    id: number;
    operational_asset_id: number;
    code: string;
    name: string;
    type: string;
    kind?: string;
    subtype?: string | null;
    site_latitude?: number | null;
    site_longitude?: number | null;
    jib_length_meters?: number | null;
}

export interface PlannedCraneSlotViewModel {
    slot_key: string;
    name: string;
    required_type?: string | null;
    jib_radius_meters: number;
    site_latitude?: number | null;
    site_longitude?: number | null;
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
    site_latitude?: number | null;
    site_longitude?: number | null;
    planned_crane_slots?: PlannedCraneSlotViewModel[];
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

export type InspectionTypeValue =
    'pre_operation' | 'post_operation' | 'maintenance' | 'safety';

export type InspectionResultValue = 'passed' | 'failed' | 'conditional';

export interface InspectionViewModel {
    id: number;
    type: InspectionTypeValue;
    result: InspectionResultValue;
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

export type TelemetryFreshnessStatus =
    'fresh' | 'delayed' | 'stale' | 'offline';

export interface OperatorBindingViewModel {
    id: number;
    name: string;
    avatar?: string | null;
    avatar_url?: string | null;
    shift_started_at: string | null;
    shift_duration_minutes?: number;
    hours_elapsed: number;
    telemetry_status: TelemetryFreshnessStatus;
}

export type HosDutyStatusValue =
    'operating' | 'driving' | 'standby' | 'on_break' | 'off_duty' | string;

export type FatigueStatusValue =
    'normal' | 'warning' | 'critical' | 'violation';

export interface EquipmentHosViewModel {
    duty_status: HosDutyStatusValue;
    duty_status_label: string;
    hours_elapsed: number;
    fatigue_status: FatigueStatusValue;
    dole_warning: boolean;
    daily_operating_hours?: number;
    drive_remaining_minutes?: number;
    shift_window_remaining_minutes?: number;
    break_countdown_minutes?: number;
    active_demurrage?: boolean;
}

export type DvirOverallStatusValue =
    | 'passed'
    | 'defect_flagged'
    | 'critical_defect'
    | 'pending_inspection'
    | string;

export interface DvirPhotoViewModel {
    id: number;
    angle: string;
    url: string;
    file_name: string;
    file_size_bytes?: number;
    is_defect_photo?: boolean;
    defect_notes?: string | null;
    sha256_checksum?: string | null;
    uploaded_at?: string | null;
}

export interface DvirInspectionDefectViewModel {
    id: number;
    category: string;
    label: string;
    status: string;
    notes?: string | null;
}

export interface DvirInspectionViewModel {
    id: number;
    reference: string;
    inspection_type?: 'pre_trip' | 'post_trip' | string;
    type: 'pre_trip' | 'post_trip' | string;
    status: DvirOverallStatusValue;
    has_defects: boolean;
    critical_defects_count: number;
    completed_at: string | null;
    inspector_name?: string | null;
    starting_odometer_km?: number | null;
    ending_odometer_km?: number | null;
    engine_hours?: number | null;
    remarks?: string | null;
    signature_captured?: boolean;
    photos: DvirPhotoViewModel[];
    defects?: DvirInspectionDefectViewModel[];
}

export interface DvirInspectionSummaryViewModel {
    id: number;
    inspection_type?: 'pre_trip' | 'post_trip' | string;
    type: 'pre_trip' | 'post_trip' | string;
    status: DvirOverallStatusValue;
    has_defects: boolean;
    critical_defects_count: number;
    completed_at: string | null;
    inspector_name?: string | null;
    photos: DvirPhotoViewModel[];
}

export interface AssetLockoutViewModel {
    is_locked_out: boolean;
    lockout_reason: string | null;
    critical_defects_count: number;
    can_override: boolean;
    blocking_work_order_id?: number | null;
    locked_at?: string | null;
    latest_critical_dvir_id?: number | null;
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
    baseline_burn_rate?: string | number | null;
    burn_rate_unit?: string | null;
    location: string | null;
    specifications: Record<string, unknown>;
    status: StatusViewModel<AssetStatusValue>;
    blocking_work_orders_count: number;
    is_dispatchable: boolean;
    active_operator?: OperatorBindingViewModel | null;
    hos?: EquipmentHosViewModel | null;
    latest_dvir?: DvirInspectionSummaryViewModel | null;
    dvir_inspections?: DvirInspectionViewModel[];
    lockout?: AssetLockoutViewModel | null;
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
    variance_litres?: string | null;
    variance_percentage?: string | null;
    effective_burn_rate?: string | null;
    burn_rate_unit?: string | null;
    is_anomaly?: boolean;
    anomaly_reason?: string | null;
    receipt_path: string | null;
    receipt_url?: string | null;
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
    shift?: {
        id: number;
        operator_name?: string | null;
    } | null;
    asset: {
        id: number;
        code: string;
        name?: string;
        kind?: string | null;
        subtype?: string | null;
        registration_number?: string | null;
        manufacturer?: string | null;
        model?: string | null;
        meter_type?: string | null;
        meter_value?: string | null;
        baseline_burn_rate?: string | null;
        burn_rate_unit?: string | null;
    } | null;
    quantity_litres: string;
    fuel_type: string;
    purpose: string;
    status: StatusViewModel<FuelRequestStatusValue>;
    decision_reason?: string | null;
    created_at?: string | null;
    submitted_at?: string | null;
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

export interface DispatchResourceUserViewModel {
    id: number;
    name: string;
    is_active: boolean;
    suspended_at: string | null;
    role: string | null;
    role_label: string | null;
    availability_status: string | null;
    has_credentials: boolean;
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
        kind:
            | 'truck'
            | 'vehicle'
            | 'crane'
            | 'mobile_crane'
            | 'tower_crane'
            | 'equipment'
            | string;
        location?: string | null;
    } | null;
    job: {
        id: number;
        reference: string;
        title: string;
        site?: string | null;
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
    freshness_status: TelemetryFreshnessStatus;
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
    status: StatusViewModel<'draft' | 'submitted' | 'approved' | 'rejected'>;
    work_summary: string;
    remarks: string | null;
    rejection_reason?: string | null;
    ending_meter_value?: number | null;
    meter_type?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    resubmitted_count?: number;
    can_be_resubmitted?: boolean;
    started_at: string | null;
    ended_at: string | null;
    submitted_at: string | null;
    signer_name?: string | null;
    signer_role?: string | null;
    signed_at?: string | null;
    delay_logs?: Array<{
        id: number;
        duty_status: string;
        standby_reason: string;
        is_demurrage_billable: boolean;
        started_at: string;
        ended_at: string | null;
        duration_minutes?: number | null;
    }>;
    cross_references?: {
        associated_dvirs?: Array<{
            id: number;
            reference: string;
            has_defects: boolean;
            critical_defects_count?: number;
        }>;
        associated_fuel_requests?: Array<{
            id: number;
            reference: string;
            quantity_litres: string;
        }>;
    };
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
    | 'sos'
    | 'safety';

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
    safety_lockdown_asset: boolean;
    inspect_asset: boolean;
    maintain_asset: boolean;
    request_gpt_assistance: boolean;
    proactive_gpt_assistance?: boolean;
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

export interface PaginationMeta {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from?: number | null;
    to?: number | null;
}

export interface FuelRequestStatsViewModel {
    total: number;
    pending: number;
    approved: number;
    verified: number;
    logged: number;
    anomalies: number;
}

export interface JobReportStatsViewModel {
    total: number;
    draft: number;
    submitted: number;
    approved: number;
    rejected: number;
}

export interface WorkspacePageProps {
    jobs?: DispatchJobViewModel[];
    clients?: ClientViewModel[];
    serviceRequests?: ServiceRequestViewModel[];
    rentalHandoffs?: RentalDispatchHandoffViewModel[];
    salesHandoffs?: SalesDispatchHandoffViewModel[];
    assets?: AssetViewModel[];
    assets_total?: number;
    assets_pagination?: PaginationMeta;
    fuelRequests?: FuelRequestViewModel[];
    fuelRequests_total?: number;
    fuelRequests_stats?: FuelRequestStatsViewModel;
    fuelRequests_pagination?: PaginationMeta;
    locations?: LocationUpdateViewModel[];
    approvals?: ApprovalViewModel[];
    users?: WorkspaceUserViewModel[];
    dispatchResourceUsers?: DispatchResourceUserViewModel[];
    auditEvents?: AuditEventViewModel[];
    gptRecommendations?: GptRecommendationViewModel[];
    jobReports?: JobReportViewModel[];
    jobReports_total?: number;
    jobReports_stats?: JobReportStatsViewModel;
    jobReports_pagination?: PaginationMeta;
    reportExports?: ReportExportViewModel[];
    notifications?: NotificationViewModel[];
    archivedJobs?: ArchivedJobViewModel[];
    navigation: WorkspaceNavigationItem[];
    initial_section: WorkspaceSection | null;
    projectPlanning?: ProjectPlanningViewModel | null;
    capabilities: WorkspaceCapabilities;
    workspace: WorkspaceFreshness;
    badges?: {
        jobs: number;
        pending_approvals: number;
        unread_notifications: number;
        blocking_assets: number;
        pending_fuel?: number;
        active_sos?: number;
    };
    activeSosIncidents: SosIncidentViewModel[];
}

export interface ProjectPlanningViewModel {
    projects: ProjectPlanViewModel[];
    page: number;
    last_page: number;
    total: number;
    can_edit: boolean;
    as_of: string;
}

export interface ProjectPlanViewModel {
    id: number;
    name: string;
    source_reference: string;
    client: string;
    site: string;
    status: 'draft' | 'pending' | 'approved' | 'rejected';
    version: number;
    approved_version: number | null;
    decision_reason: string | null;
    can_decide: boolean;
    phases: ProjectPhaseViewModel[];
}

export interface ProjectPhaseViewModel {
    id: number;
    name: string;
    kind: string;
    starts_at: string;
    ends_at: string;
    coverage: Record<'driver' | 'crane_operator' | 'rigger', number>;
    allocations: Array<{
        id: number;
        operational_asset_id: number;
        code: string;
        name: string;
        status: string;
        kind: 'reservation' | 'maintenance';
        starts_at: string;
        ends_at: string;
        notes: string | null;
    }>;
    shifts: ProjectShiftViewModel[];
}

export interface ProjectShiftViewModel {
    archived?: boolean;
    id: number;
    job_id: number;
    reference: string;
    status: string;
    starts_at: string;
    ends_at: string;
    version: number;
    locked: boolean;
    confirmed_plan_version: number | null;
    personnel: Array<{
        user_id: number;
        name: string;
        assignment_type: 'driver' | 'crane_operator' | 'rigger';
        response: string;
    }>;
    pending_roster: Array<{
        name?: string;
        user_id: number;
        assignment_type: 'driver' | 'crane_operator' | 'rigger';
    }> | null;
    reason: string | null;
    can_decide: boolean;
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
    assignment_type: 'driver' | 'crane_operator' | 'rigger';
    assignment_label: string;
    eligible: boolean;
    reasons: string[];
    availability: StatusViewModel<
        'available' | 'assigned' | 'unavailable' | 'on_leave' | 'not_recorded'
    >;
    account_status: StatusViewModel<'active' | 'inactive' | 'suspended'>;
    credential: {
        kind:
            | 'driver_license'
            | 'operator_certification'
            | 'rigger_certification'
            | null;
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

export interface DispatchExecutionMilestoneViewModel {
    id: number;
    status: StatusViewModel<DispatchStatusValue>;
    recorded_at: string | null;
}

export interface DispatchExecutionLocationViewModel {
    id: number;
    latitude: number;
    longitude: number;
    accuracy_metres: number | null;
    source: string;
    user: { id: number; name: string } | null;
    asset: { id: number; code: string; name: string } | null;
    captured_at: string | null;
    received_at: string | null;
}

export interface DispatchExecutionReportViewModel {
    id: number;
    status: StatusViewModel<'submitted' | 'approved' | 'rejected'>;
    started_at: string | null;
    ended_at: string | null;
    submitted_at: string | null;
    work_summary: string;
    remarks: string | null;
    coordinates: { latitude: number; longitude: number } | null;
}

export interface DispatchExecutionViewModel {
    status: StatusViewModel<DispatchStatusValue>;
    updated_at: string | null;
    milestones: DispatchExecutionMilestoneViewModel[];
    issues: Array<{ kind: string; title: string; detail: string }>;
    site: {
        name: string;
        notes: string | null;
        planned_coordinates: { latitude: number; longitude: number } | null;
        latest_location: DispatchExecutionLocationViewModel | null;
    };
    reports: DispatchExecutionReportViewModel[];
    activity: Array<{
        id: string;
        kind: 'status' | 'report' | 'location';
        title: string;
        detail: string;
        recorded_at: string | null;
    }>;
}

export interface DispatchDetailPageProps {
    project_context?: {
        name: string;
        phase: string;
        return_url: string;
    } | null;
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
    execution?: DispatchExecutionViewModel | null;
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
