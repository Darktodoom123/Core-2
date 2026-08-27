/**
 * ============================================================================
 * PROTOTYPE SANDBOX STATE REDUCER (READ-ONLY SIMULATION ONLY)
 * ============================================================================
 *
 * STRICT ARCHITECTURAL RULE:
 * This reducer is used EXCLUSIVELY by the unrouted prototype demo sandbox
 * (resources/js/pages/operations.tsx).
 *
 * All actions in this reducer are simulated in-memory UI demonstrations.
 * They DO NOT execute backend mutations or persist state.
 * For live production operations, use the authoritative Inertia controllers
 * and workspace pages (/operations, /operations/dispatch-jobs/*).
 * ============================================================================
 */

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
                    tone: 'info',
                    title: 'Conflict resolved (Simulation)',
                    message:
                        '[Read-Only Simulation] The updated start time is previewed locally.',
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
                        title: 'Resolve conflicts first (Simulation)',
                        message:
                            '[Read-Only Simulation] Review the proposed start time before previewing confirmation.',
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
                toasts: addToast(state, {
                    tone: 'info',
                    title: 'Dispatch scheduled (Simulation)',
                    message:
                        '[Read-Only Simulation] CON-1251 simulated as scheduled. No backend changes were written.',
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
                    tone: state.connectivity === 'offline' ? 'warning' : 'info',
                    title:
                        state.connectivity === 'offline'
                            ? 'Update queued (Simulation)'
                            : `Status changed to ${action.status} (Simulation)`,
                    message:
                        state.connectivity === 'offline'
                            ? '[Read-Only Simulation] Update queued locally in memory.'
                            : '[Read-Only Simulation] Status updated in prototype view. No database records modified.',
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
                    tone: 'info',
                    title: `Fuel request ${action.status.toLowerCase()} (Simulation)`,
                    message: `[Read-Only Simulation] Fuel request decision simulated in sandbox memory.`,
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
                              title: 'Simulated Offline Mode',
                              message:
                                  '[Read-Only Simulation] Testing simulated offline state.',
                          })
                        : state.toasts,
            };
        case 'sync-queue':
            return {
                ...state,
                connectivity: 'online',
                queuedActions: 0,
                toasts: addToast(state, {
                    tone: 'info',
                    title: 'Sync completed (Simulation)',
                    message: '[Read-Only Simulation] In-memory queue cleared.',
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
                    tone: state.connectivity === 'offline' ? 'warning' : 'info',
                    title:
                        state.connectivity === 'offline'
                            ? 'Task update queued (Simulation)'
                            : `Task moved to ${action.status} (Simulation)`,
                    message:
                        '[Read-Only Simulation] Task state updated in local memory only.',
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
