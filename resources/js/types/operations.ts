export type UserRole =
    | 'administrator'
    | 'dispatcher'
    | 'manager'
    | 'driver'
    | 'operator'
    | 'technician';

export type AppSection =
    | 'overview'
    | 'dispatch'
    | 'board'
    | 'live'
    | 'fleet'
    | 'equipment'
    | 'fuel'
    | 'reports'
    | 'administration'
    | 'today'
    | 'job'
    | 'tasks'
    | 'issues';

/**
 * Presentation-only labels used by the unrouted fixture prototype.
 * Live and persisted status contracts belong to workspace.ts.
 */
export type PrototypeDispatchStatusLabel =
    | 'Draft'
    | 'Scheduled'
    | 'Dispatched'
    | 'En route'
    | 'Arrived'
    | 'In progress'
    | 'On hold'
    | 'Completed'
    | 'Cancelled';

export type PrototypeAssetStatusLabel =
    'Available' | 'Assigned' | 'Working' | 'Maintenance' | 'Offline';

export type PrototypeFuelStatusLabel =
    'Pending' | 'Approved' | 'Rejected' | 'Dispensed';

export type TelemetryFreshness = 'Live' | 'Delayed' | 'Stale' | 'Offline';
export type ConnectivityState = 'online' | 'offline' | 'syncing';

export interface Assignment {
    driverId?: string;
    operatorId?: string;
    truckId?: string;
    craneId?: string;
    supportEquipmentIds: string[];
}

export interface DispatchJob {
    id: string;
    reference: string;
    client: string;
    contact: string;
    title: string;
    site: string;
    siteNote: string;
    scheduledDate: string;
    startTime: string;
    endTime: string;
    priority: 'Routine' | 'Priority' | 'Emergency';
    status: PrototypeDispatchStatusLabel;
    workType: string;
    requirements: string[];
    assignment: Assignment;
}

interface ResourceBase {
    id: string;
    code: string;
    name: string;
    status: PrototypeAssetStatusLabel;
    location: string;
    utilization: number;
}

export interface TruckResource extends ResourceBase {
    kind: 'truck';
    subtype: 'Boom truck' | 'Flatbed' | 'Step deck';
    odometerKm: number;
    nextService: string;
}

export interface CraneResource extends ResourceBase {
    kind: 'crane';
    capacityTons: number;
    operatingHours: number;
    certification: string;
}

export interface EquipmentResource extends ResourceBase {
    kind: 'equipment';
    subtype: 'Manlift' | 'Forklift' | 'Rigging set';
    inspectionDue: string;
}

export interface DriverResource extends ResourceBase {
    kind: 'driver';
    license: string;
    qualification: string;
}

export interface OperatorResource extends ResourceBase {
    kind: 'operator';
    certification: string;
    liftsLast90Days: number;
}

export interface TechnicianResource extends ResourceBase {
    kind: 'technician';
    specialty: string;
    openTasks: number;
}

export type Resource =
    | TruckResource
    | CraneResource
    | EquipmentResource
    | DriverResource
    | OperatorResource
    | TechnicianResource;

export interface GptProposal {
    id: string;
    jobId: string;
    state: 'Draft' | 'Confirmed' | 'Rejected';
    generatedAt: string;
    summary: string;
    reasons: string[];
    assumptions: string[];
    conflicts: Array<{
        id: string;
        title: string;
        detail: string;
        resolved: boolean;
    }>;
    proposedAssignment: Assignment;
}

export interface TelemetryPoint {
    id: string;
    resourceId: string;
    label: string;
    kind: 'truck' | 'crane' | 'technician';
    x: number;
    y: number;
    freshness: TelemetryFreshness;
    updatedAt: string;
    destination: string;
    eta: string;
}

export interface FuelRequest {
    id: string;
    reference: string;
    assetCode: string;
    jobReference: string;
    requestedBy: string;
    liters: number;
    fuelType: 'Diesel' | 'Gasoline';
    cost: number;
    meterReading: string;
    status: PrototypeFuelStatusLabel;
    requestedAt: string;
}

export interface FieldTask {
    id: string;
    reference: string;
    assetCode: string;
    title: string;
    location: string;
    scheduledAt: string;
    priority: 'Routine' | 'Priority' | 'Emergency';
    status:
        | 'Assigned'
        | 'Diagnosing'
        | 'Repairing'
        | 'Testing'
        | 'Waiting for parts'
        | 'Completed';
    checklistCompleted: number;
    checklistTotal: number;
}

export interface AuditEvent {
    id: string;
    actor: string;
    action: string;
    detail: string;
    timestamp: string;
}

export interface ToastMessage {
    id: number;
    tone: 'success' | 'warning' | 'info';
    title: string;
    message: string;
}

export interface OperationsState {
    role: UserRole;
    section: AppSection;
    sidebarCollapsed: boolean;
    connectivity: ConnectivityState;
    queuedActions: number;
    selectedJobId: string;
    selectedAssetId: string;
    jobs: DispatchJob[];
    resources: Resource[];
    proposal: GptProposal;
    telemetry: TelemetryPoint[];
    fuelRequests: FuelRequest[];
    fieldTasks: FieldTask[];
    auditEvents: AuditEvent[];
    toasts: ToastMessage[];
}

export type OperationsAction =
    | { type: 'set-role'; role: UserRole; section: AppSection }
    | { type: 'set-section'; section: AppSection }
    | { type: 'toggle-sidebar' }
    | { type: 'select-job'; jobId: string }
    | { type: 'select-asset'; assetId: string }
    | { type: 'resolve-conflict'; conflictId: string }
    | { type: 'confirm-dispatch'; jobId: string }
    | {
          type: 'advance-job';
          jobId: string;
          status: PrototypeDispatchStatusLabel;
      }
    | {
          type: 'decide-fuel-request';
          requestId: string;
          status: 'Approved' | 'Rejected';
      }
    | { type: 'set-connectivity'; connectivity: ConnectivityState }
    | { type: 'sync-queue' }
    | { type: 'telemetry-tick' }
    | { type: 'advance-task'; taskId: string; status: FieldTask['status'] }
    | { type: 'dismiss-toast'; toastId: number };

export const roleLabels: Record<UserRole, string> = {
    administrator: 'System Administrator',
    dispatcher: 'Dispatcher',
    manager: 'Operations Manager',
    driver: 'Driver',
    operator: 'Crane Operator',
    technician: 'Field Technician',
};
