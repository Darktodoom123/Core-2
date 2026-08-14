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

export type OutboxCommandType =
    'respond_assignment' | 'transition_status' | 'share_location';

export type OutboxCommandState =
    'queued' | 'syncing' | 'failed' | 'conflict' | 'completed';

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
