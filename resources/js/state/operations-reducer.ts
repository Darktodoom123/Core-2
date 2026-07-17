import {
    auditEvents,
    dispatchJobs,
    fieldTasks,
    fuelRequests,
    gptProposal,
    resources,
    telemetry,
} from '@/data/fixtures';
import type {
    AppSection,
    OperationsAction,
    OperationsState,
    ToastMessage,
    UserRole,
} from '@/types/operations';

export const defaultSectionForRole: Record<UserRole, AppSection> = {
    administrator: 'board',
    dispatcher: 'board',
    manager: 'board',
    driver: 'today',
    operator: 'today',
    technician: 'tasks',
};

export function createInitialState(
    role: UserRole = 'dispatcher',
    section: AppSection = defaultSectionForRole[role],
): OperationsState {
    return {
        role,
        section,
        sidebarCollapsed: false,
        connectivity: 'online',
        queuedActions: 0,
        selectedJobId: 'job-1251',
        selectedAssetId: 'cr-250-04',
        jobs: structuredClone(dispatchJobs),
        resources: structuredClone(resources),
        proposal: structuredClone(gptProposal),
        telemetry: structuredClone(telemetry),
        fuelRequests: structuredClone(fuelRequests),
        fieldTasks: structuredClone(fieldTasks),
        auditEvents: structuredClone(auditEvents),
        toasts: [],
    };
}

function addToast(
    state: OperationsState,
    toast: Omit<ToastMessage, 'id'>,
): ToastMessage[] {
    return [
        ...state.toasts,
        {
            ...toast,
            id: Date.now(),
        },
    ].slice(-3);
}

export function operationsReducer(
    state: OperationsState,
    action: OperationsAction,
): OperationsState {
    switch (action.type) {
        case 'set-role':
            return { ...state, role: action.role, section: action.section };
        case 'set-section':
            return { ...state, section: action.section };
        case 'toggle-sidebar':
            return { ...state, sidebarCollapsed: !state.sidebarCollapsed };
        case 'select-job':
            return { ...state, selectedJobId: action.jobId };
        case 'select-asset':
            return { ...state, selectedAssetId: action.assetId };
        case 'resolve-conflict':
            return {
                ...state,
                proposal: {
                    ...state.proposal,
                    conflicts: state.proposal.conflicts.map((conflict) =>
                        conflict.id === action.conflictId
                            ? { ...conflict, resolved: true }
                            : conflict,
                    ),
                },
                toasts: addToast(state, {
                    tone: 'success',
                    title: 'Conflict resolved',
                    message: 'The updated 07:30 start is ready for review.',
                }),
            };
        case 'confirm-dispatch': {
            const unresolved = state.proposal.conflicts.some(
                (conflict) => !conflict.resolved,
            );

            if (unresolved) {
                return {
                    ...state,
                    toasts: addToast(state, {
                        tone: 'warning',
                        title: 'Resolve the travel conflict first',
                        message:
                            'Review the proposed start time before confirming this dispatch.',
                    }),
                };
            }

            return {
                ...state,
                jobs: state.jobs.map((job) =>
                    job.id === action.jobId
                        ? {
                              ...job,
                              status: 'Scheduled',
                              startTime: '07:30',
                              assignment: state.proposal.proposedAssignment,
                          }
                        : job,
                ),
                proposal: { ...state.proposal, state: 'Confirmed' },
                auditEvents: [
                    {
                        id: `audit-${Date.now()}`,
                        actor: 'Marco Villanueva',
                        action: 'Confirmed GPT-assisted dispatch',
                        detail: 'CON-1251 · CR-250-04 · 07:30 start',
                        timestamp: 'Just now',
                    },
                    ...state.auditEvents,
                ],
                toasts: addToast(state, {
                    tone: 'success',
                    title: 'Dispatch scheduled',
                    message:
                        'CON-1251 is scheduled for 07:30. The field team has been notified.',
                }),
            };
        }
        case 'advance-job': {
            const queuedActions =
                state.connectivity === 'offline'
                    ? state.queuedActions + 1
                    : state.queuedActions;

            return {
                ...state,
                queuedActions,
                jobs: state.jobs.map((job) =>
                    job.id === action.jobId
                        ? { ...job, status: action.status }
                        : job,
                ),
                toasts: addToast(state, {
                    tone:
                        state.connectivity === 'offline'
                            ? 'warning'
                            : 'success',
                    title:
                        state.connectivity === 'offline'
                            ? 'Update queued'
                            : `Status changed to ${action.status}`,
                    message:
                        state.connectivity === 'offline'
                            ? 'This update will sync when the connection returns.'
                            : 'Operations can see the new field status.',
                }),
            };
        }
        case 'decide-fuel-request':
            return {
                ...state,
                fuelRequests: state.fuelRequests.map((request) =>
                    request.id === action.requestId
                        ? { ...request, status: action.status }
                        : request,
                ),
                toasts: addToast(state, {
                    tone: action.status === 'Approved' ? 'success' : 'info',
                    title: `Fuel request ${action.status.toLowerCase()}`,
                    message:
                        action.status === 'Approved'
                            ? 'Dispatch and the requester can now see the approval.'
                            : 'The requester has been notified with the decision.',
                }),
            };
        case 'set-connectivity':
            return {
                ...state,
                connectivity: action.connectivity,
                toasts:
                    action.connectivity === 'offline'
                        ? addToast(state, {
                              tone: 'warning',
                              title: 'Working offline',
                              message:
                                  'Job updates will be kept on this device until you reconnect.',
                          })
                        : state.toasts,
            };
        case 'sync-queue':
            return {
                ...state,
                connectivity: 'online',
                queuedActions: 0,
                toasts: addToast(state, {
                    tone: 'success',
                    title: 'Updates synchronized',
                    message: 'Operations now has your latest field activity.',
                }),
            };
        case 'telemetry-tick':
            return {
                ...state,
                telemetry: state.telemetry.map((point, index) =>
                    point.freshness === 'Live'
                        ? {
                              ...point,
                              x: Math.max(
                                  8,
                                  Math.min(
                                      92,
                                      point.x + (index % 2 === 0 ? 0.35 : -0.3),
                                  ),
                              ),
                              y: Math.max(
                                  8,
                                  Math.min(
                                      88,
                                      point.y +
                                          (index % 2 === 0 ? 0.18 : -0.22),
                                  ),
                              ),
                              updatedAt: 'Just now',
                          }
                        : point,
                ),
            };
        case 'advance-task': {
            const queuedActions =
                state.connectivity === 'offline'
                    ? state.queuedActions + 1
                    : state.queuedActions;

            return {
                ...state,
                queuedActions,
                fieldTasks: state.fieldTasks.map((task) =>
                    task.id === action.taskId
                        ? { ...task, status: action.status }
                        : task,
                ),
                toasts: addToast(state, {
                    tone:
                        state.connectivity === 'offline'
                            ? 'warning'
                            : 'success',
                    title:
                        state.connectivity === 'offline'
                            ? 'Task update queued'
                            : `Task moved to ${action.status}`,
                    message:
                        state.connectivity === 'offline'
                            ? 'It will sync automatically when you reconnect.'
                            : 'The maintenance record has been updated.',
                }),
            };
        }
        case 'dismiss-toast':
            return {
                ...state,
                toasts: state.toasts.filter(
                    (toast) => toast.id !== action.toastId,
                ),
            };
        default:
            return state;
    }
}
