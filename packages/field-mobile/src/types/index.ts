export type DispatchPriority = 'routine' | 'priority' | 'emergency';

export type DispatchStatus =
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

export type AssignmentResponse = 'pending' | 'accepted' | 'rejected';

export interface User {
    id: number;
    name: string;
    username: string;
    email: string;
    role: string;
    is_active: boolean;
    phone?: string | null;
}

export interface MyAssignment {
    id: number;
    response_status: AssignmentResponse;
    response_status_label: string;
    responded_at?: string | null;
    response_reason?: string | null;
    assigned_at?: string | null;
}

export interface PersonnelAssignment {
    id: number;
    user_id: number;
    user_name: string;
    response_status: AssignmentResponse;
    response_status_label: string;
    responded_at?: string | null;
    assigned_at?: string | null;
    active_until?: string | null;
}

export interface AssetAssignment {
    id: number;
    operational_asset_id: number;
    asset_code: string;
    asset_name: string;
    asset_kind: string;
    assigned_at?: string | null;
    active_until?: string | null;
}

export interface ProgressionStep {
    status: {
        value: DispatchStatus;
        label: string;
    };
    state: 'complete' | 'current' | 'upcoming';
}

export interface ProgressionNext {
    status: {
        value: DispatchStatus;
        label: string;
    };
    action_label: string;
    confirmation_title: string;
    confirmation_message: string;
}

export interface ProgressionInfo {
    current: {
        value: DispatchStatus;
        label: string;
    };
    steps: ProgressionStep[];
    next?: ProgressionNext | null;
    message: string;
}

export interface Capabilities {
    can_respond: boolean;
    can_update_status: boolean;
    can_share_location: boolean;
}

export interface DispatchJob {
    id: number;
    reference: string;
    client: string;
    title: string;
    site: string;
    site_notes?: string | null;
    scheduled_start?: string | null;
    scheduled_end?: string | null;
    priority: {
        value: DispatchPriority;
        label: string;
    };
    status: {
        value: DispatchStatus;
        label: string;
    };
    version: number;
    requirements?: string[] | Record<string, unknown> | null;
    my_assignment?: MyAssignment | null;
    personnel_assignments?: PersonnelAssignment[];
    asset_assignments?: AssetAssignment[];
    progression?: ProgressionInfo | null;
    capabilities: Capabilities;
}

export type SosIncidentCategory =
    | 'unclassified'
    | 'vehicular_accident'
    | 'site_accident'
    | 'critical_asset_malfunction'
    | 'other_immediate_danger';

export type SosIncidentStatus =
    'active' | 'acknowledged' | 'escalated' | 'resolved' | 'cancelled';

export type SosDeliveryState =
    | 'preparing'
    | 'sending'
    | 'delivered'
    | 'acknowledged'
    | 'escalated'
    | 'not_delivered_offline'
    | 'retrying'
    | 'expired'
    | 'resolved'
    | 'cancelled';

export interface SosLocationSnapshot {
    latitude: number;
    longitude: number;
    accuracy_metres?: number | null;
    captured_at: string;
}

export interface SosContextSelection {
    dispatch_job_id?: number | null;
    operational_asset_id?: number | null;
}

export type SosEmergencyActionKind = 'call' | 'sms' | 'local_emergency_service';

export interface SosEmergencyAction {
    kind: SosEmergencyActionKind;
    label: string;
    uri: string;
    hint?: string | null;
}

export interface SosConfiguration {
    automatic_retry_window_minutes: number;
    actions: SosEmergencyAction[];
}

export interface SosIncidentResponderSummary {
    name?: string | null;
    acknowledged_at?: string | null;
}

export interface SosIncident {
    id: string;
    category: SosIncidentCategory;
    status: SosIncidentStatus;
    delivery_state: SosDeliveryState;
    device_activated_at: string;
    received_at?: string | null;
    escalation_due_at?: string | null;
    acknowledged_at?: string | null;
    escalated_at?: string | null;
    resolved_at?: string | null;
    cancelled_at?: string | null;
    dispatch?: {
        id: number;
        reference: string;
        label?: string | null;
    } | null;
    asset?: {
        id: number;
        code: string;
        label?: string | null;
    } | null;
    location?: SosLocationSnapshot | null;
    responder?: SosIncidentResponderSummary | null;
    available_actions?: SosEmergencyAction[];
}

export interface ActivateSosIncidentPayload extends SosContextSelection {
    category: SosIncidentCategory;
    device_activated_at: string;
    note?: string | null;
    location?: SosLocationSnapshot | null;
}

export interface SosCommandPayload extends ActivateSosIncidentPayload {
    command_id?: string;
}

export type OutboxCommandType =
    | 'respond_assignment'
    | 'transition_status'
    | 'share_location'
    | 'activate_sos'
    | 'submit_job_report';

export interface JobReportCommandPayload {
    dispatch_job_id: number;
    work_summary: string;
    remarks?: string | null;
    started_at?: string | null;
    ended_at?: string | null;
    ending_meter_value?: number | null;
    meter_type?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    signer_name?: string;
    signer_role?: string;
    signed_at?: string;
}

export type OutboxCommandState =
    'queued' | 'syncing' | 'failed' | 'conflict' | 'completed' | 'expired';

export type OutboxCommandPriority = 'ordinary' | 'emergency';

export interface CommandErrorDetails {
    message: string;
    code?: string;
    currentVersion?: number;
    serverSnapshot?: DispatchJob | null;
    retryable?: boolean;
}

export interface OutboxCommand {
    id: string; // UUID command_id
    actorId: number;
    type: OutboxCommandType;
    jobId?: number | null;
    assignmentId?: number | null;
    payload: Record<string, unknown>;
    payloadHash: string;
    priority?: OutboxCommandPriority;
    expiresAt?: string | null;
    expectedVersion?: number | null;
    state: OutboxCommandState;
    error?: CommandErrorDetails | null;
    createdAt: string;
    updatedAt: string;
    attempts: number;
    lastAttemptAt?: string | null;
    nextAttemptAt?: string | null;
    completedAt?: string | null;
}

export interface LocationSharePayload {
    dispatch_job_id?: number | null;
    operational_asset_id?: number | null;
    latitude: number;
    longitude: number;
    accuracy_metres?: number | null;
    sharing_enabled: boolean;
    captured_at: string;
    remarks?: string | null;
}

export interface ApiErrorResponse {
    message: string;
    error?: string;
    current_version?: number;
    data?: DispatchJob;
    errors?: Record<string, string[]>;
}

export interface DispatchAssignmentOfferV2 {
    id: number;
    attempt_id: number;
    plan_version_id: number;
    workspace_key: string;
    user_id: number;
    assignment_type: string;
    is_mandatory: boolean;
    status: string;
    offered_at?: string | null;
    responded_at?: string | null;
    response_reason?: string | null;
    user?: User;
}

export interface DispatchPlanVersionV2 {
    id: number;
    attempt_id: number;
    version: number;
    status: string;
    snapshot: Record<string, unknown>;
    submitted_at?: string | null;
    scheduled_start?: string | null;
    scheduled_end?: string | null;
}

export interface DispatchReadinessV2 {
    is_ready: boolean;
    attempt_version?: number | null;
    blockers: Array<{
        code: string;
        severity: string;
        details?: Record<string, unknown>;
    }>;
}

export interface DispatchJobV2 {
    id: number;
    reference: string;
    client: string;
    title: string;
    site: string;
    site_notes?: string | null;
    priority: string;
    status: string;
    version: number;
    scheduled_start?: string | null;
    scheduled_end?: string | null;
    attempt_number?: number;
    is_archived?: boolean;
    designated_lead?: {
        offer_id: number;
        user_id: number;
        name: string;
        username: string;
    } | null;
    is_designated_lead?: boolean;
    my_offer?: DispatchAssignmentOfferV2 | null;
    offers?: DispatchAssignmentOfferV2[];
    active_plan?: DispatchPlanVersionV2 | null;
    readiness?: DispatchReadinessV2 | null;
}

// ==========================================
// Shift & Field Operational State Types
// ==========================================

export type ShiftStatus = 'on_shift' | 'off_shift' | 'on_break' | 'standby';

export interface ShiftInfo {
    status: ShiftStatus;
    startedAt?: string | null;
    hoursElapsed?: number;
    breakCount?: number;
}

export type LocationSharingTone = 'active' | 'queued' | 'paused' | 'offline';

// ==========================================
// Heavy-Crane Route & Drive Mode Types
// ==========================================

export type HeavyCraneRouteStatus =
    'available' | 'cached' | 'stale' | 'unavailable';

export interface HeavyRouteInstruction {
    id: string;
    stepNumber: number;
    instruction: string;
    distanceLabel: string;
    caution?: string | null;
    isHazard?: boolean;
}

export interface HeavyVehicleRouteDetails {
    status: HeavyCraneRouteStatus;
    assetLabel: string;
    currentPosition: string;
    destination: string;
    siteEntrance: string;
    stagingPoint: string;
    etaLabel: string;
    distanceLabel: string;
    bridgeClearanceMetres?: number;
    axleWeightLimitTonnes?: number;
    isFresh: boolean;
    lastSyncedAt?: string | null;
    instructions: HeavyRouteInstruction[];
}

// ==========================================
// Parked-and-Secured Confirmation Types
// ==========================================

export interface ParkedSecuredChecklist {
    parkingBrakeEngaged: boolean;
    wheelChocksDeployed: boolean;
    hazardBeaconsActive: boolean;
    surfaceAssessed: boolean;
}

export interface ParkedSecuredState {
    isConfirmed: boolean;
    confirmedAt?: string | null;
    confirmedBy?: string | null;
    checklist: ParkedSecuredChecklist;
}

// ==========================================
// Crane Setup Safety Mode Types
// ==========================================

export type CraneHazardSeverity = 'critical' | 'warning' | 'info';

export interface CraneHazardItem {
    id: string;
    type:
        | 'powerline'
        | 'underground_utility'
        | 'unstable_ground'
        | 'traffic'
        | 'overhead_load';
    title: string;
    description: string;
    severity: CraneHazardSeverity;
    clearanceRequiredMetres?: number;
    isMitigated: boolean;
}

export interface CraneSetupSafetyChecklist {
    groundBearingVerified: boolean;
    outriggersFullyExtended: boolean;
    levelBubbleCentered: boolean;
    powerLineClearanceVerified: boolean;
    exclusionZoneBarricaded: boolean;
    windSpeedChecked: boolean;
}

export interface CraneSetupState {
    isSetupComplete: boolean;
    verifiedAt?: string | null;
    verifiedBy?: string | null;
    exclusionRadiusMetres: number;
    checklist: CraneSetupSafetyChecklist;
    hazards: CraneHazardItem[];
}

// ==========================================
// Technician Inspection & Handover Types
// ==========================================

export type InspectionCategory =
    | 'hydraulics'
    | 'electrical'
    | 'structural'
    | 'tires_tracks'
    | 'safety_devices'
    | 'fluids';

export type InspectionCheckStatus =
    'good' | 'attention' | 'critical' | 'pending';

export interface TechnicianInspectionCheck {
    id: string;
    category: InspectionCategory;
    label: string;
    status: InspectionCheckStatus;
    statusLabel: string;
    notes?: string | null;
    icon: string;
}

export type MaintenanceSeverity = 'minor' | 'major' | 'safety_critical';
export type MaintenanceStatus = 'logged' | 'in_progress' | 'repaired';

export interface MaintenanceWorkOrder {
    id: string;
    assetCode: string;
    assetName: string;
    defectTitle: string;
    description: string;
    severity: MaintenanceSeverity;
    status: MaintenanceStatus;
    reportedBy: string;
    createdAt: string;
    attachments?: Array<{
        uri: string;
        fileName?: string;
        fileSize?: number;
        base64?: string;
    }>;
}

export interface SafeReleaseVerification {
    isCertifiedSafe: boolean;
    certifiedBy?: string | null;
    certificationDate?: string | null;
    certificateNumber?: string | null;
    remarks?: string | null;
}

export interface FuelReceiptLog {
    id: string;
    assetCode: string;
    quantityLiters: number;
    fuelCost?: number | null;
    odometerKm?: number | null;
    engineHours?: number | null;
    receiptNumber: string;
    vendorName?: string | null;
    receiptPhotoUri?: string | null;
    loggedAt: string;
}

export type HandoverType = 'tech_to_operator' | 'operator_to_tech';
export type ConditionRating = 'excellent' | 'good' | 'fair' | 'out_of_service';

export interface TechnicianHandover {
    id: string;
    assetCode: string;
    technicianName: string;
    recipientName: string;
    handoverType: HandoverType;
    conditionRating: ConditionRating;
    odometerKm?: number | null;
    remarks: string;
    signatureConfirmed: boolean;
    timestamp: string;
}
