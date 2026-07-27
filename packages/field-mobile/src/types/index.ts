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
  | 'respond_assignment'
  | 'transition_status'
  | 'share_location';

export type OutboxCommandState =
  | 'queued'
  | 'syncing'
  | 'failed'
  | 'conflict'
  | 'completed';

export interface CommandErrorDetails {
  message: string;
  code?: string;
  currentVersion?: number;
  serverSnapshot?: DispatchJob | null;
}

export interface OutboxCommand {
  id: string; // UUID command_id
  type: OutboxCommandType;
  jobId?: number | null;
  assignmentId?: number | null;
  payload: Record<string, unknown>;
  expectedVersion?: number | null;
  state: OutboxCommandState;
  error?: CommandErrorDetails | null;
  createdAt: string;
  updatedAt: string;
  retryCount: number;
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
