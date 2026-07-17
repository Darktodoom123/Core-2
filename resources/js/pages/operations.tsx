import { Head, usePage } from '@inertiajs/react';
import { useEffect, useReducer, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import {
    DispatchBoard,
    GuidedDispatch,
    LiveOperations,
} from '@/components/surfaces/dispatch-surfaces';
import {
    AdministrationSurface,
    AdministratorOverview,
    ManagerOverview,
    ReportsSurface,
} from '@/components/surfaces/management-surfaces';
import { FieldMobileApp } from '@/components/surfaces/mobile-surfaces';
import {
    FuelManagement,
    ResourceDirectory,
} from '@/components/surfaces/resource-surfaces';
import { ToastStack } from '@/components/ui';
import {
    createInitialState,
    defaultSectionForRole,
    operationsReducer,
} from '@/state/operations-reducer';
import type { AppSection, FieldTask, UserRole } from '@/types/operations';

const sections: AppSection[] = [
    'overview',
    'dispatch',
    'board',
    'live',
    'fleet',
    'equipment',
    'fuel',
    'reports',
    'administration',
    'today',
    'job',
    'tasks',
    'issues',
];

function initialRouteState(role: UserRole) {
    if (typeof window === 'undefined') {
        return {
            role,
            section: defaultSectionForRole[role],
        };
    }

    const params = new URLSearchParams(window.location.search);
    const persistedSection = window.localStorage.getItem('ctms-section');
    const sectionParam = params.get('view') ?? persistedSection;
    const section = sections.includes(sectionParam as AppSection)
        ? (sectionParam as AppSection)
        : defaultSectionForRole[role];

    return { role, section };
}

export default function Operations() {
    const { auth } = usePage().props;
    const authenticatedRole = (auth.prototype_role ?? 'dispatcher') as UserRole;
    const initial = initialRouteState(authenticatedRole);
    const [state, dispatch] = useReducer(
        operationsReducer,
        createInitialState(initial.role, initial.section),
    );
    const [query, setQuery] = useState('');

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        params.set('view', state.section);
        window.history.replaceState(
            {},
            '',
            `${window.location.pathname}?${params.toString()}`,
        );
        window.localStorage.setItem('ctms-section', state.section);
    }, [state.section]);

    useEffect(() => {
        const timer = window.setInterval(
            () => dispatch({ type: 'telemetry-tick' }),
            8000,
        );

        return () => window.clearInterval(timer);
    }, []);

    const selectSection = (section: AppSection) => {
        dispatch({ type: 'set-section', section });
        setQuery('');
    };

    const renderWebSurface = () => {
        if (state.role === 'administrator') {
            switch (state.section) {
                case 'board':
                    return (
                        <DispatchBoard
                            jobs={state.jobs}
                            resources={state.resources}
                            selectedJobId={state.selectedJobId}
                            query={query}
                            onSelectJob={(jobId) =>
                                dispatch({ type: 'select-job', jobId })
                            }
                        />
                    );
                case 'dispatch':
                    return (
                        <GuidedDispatch
                            jobs={state.jobs}
                            resources={state.resources}
                            proposal={state.proposal}
                            selectedJobId={state.selectedJobId}
                            query={query}
                            onSelectJob={(jobId) =>
                                dispatch({ type: 'select-job', jobId })
                            }
                            onResolveConflict={(conflictId) =>
                                dispatch({
                                    type: 'resolve-conflict',
                                    conflictId,
                                })
                            }
                            onConfirmDispatch={(jobId) =>
                                dispatch({ type: 'confirm-dispatch', jobId })
                            }
                        />
                    );
                case 'administration':
                    return <AdministrationSurface />;
                case 'fleet':
                    return (
                        <ResourceDirectory
                            mode="fleet"
                            resources={state.resources}
                            selectedAssetId={state.selectedAssetId}
                            query={query}
                            role={state.role}
                            onSelectAsset={(assetId) =>
                                dispatch({ type: 'select-asset', assetId })
                            }
                        />
                    );
                case 'equipment':
                    return (
                        <ResourceDirectory
                            mode="equipment"
                            resources={state.resources}
                            selectedAssetId={state.selectedAssetId}
                            query={query}
                            role={state.role}
                            onSelectAsset={(assetId) =>
                                dispatch({ type: 'select-asset', assetId })
                            }
                        />
                    );
                case 'fuel':
                    return (
                        <FuelManagement
                            requests={state.fuelRequests}
                            role={state.role}
                            query={query}
                            onDecide={(requestId, status) =>
                                dispatch({
                                    type: 'decide-fuel-request',
                                    requestId,
                                    status,
                                })
                            }
                        />
                    );
                case 'reports':
                    return (
                        <ReportsSurface
                            resources={state.resources}
                            auditEvents={state.auditEvents}
                            administrator
                        />
                    );
                default:
                    return (
                        <AdministratorOverview
                            resources={state.resources}
                            auditEvents={state.auditEvents}
                            onNavigate={selectSection}
                        />
                    );
            }
        }

        if (state.role === 'manager') {
            switch (state.section) {
                case 'live':
                    return (
                        <LiveOperations
                            telemetry={state.telemetry}
                            selectedAssetId={state.selectedAssetId}
                            onSelectAsset={(assetId) =>
                                dispatch({ type: 'select-asset', assetId })
                            }
                        />
                    );
                case 'board':
                    return (
                        <DispatchBoard
                            jobs={state.jobs}
                            resources={state.resources}
                            selectedJobId={state.selectedJobId}
                            query={query}
                            onSelectJob={(jobId) =>
                                dispatch({ type: 'select-job', jobId })
                            }
                        />
                    );
                case 'fleet':
                case 'equipment':
                    return (
                        <ResourceDirectory
                            mode={
                                state.section === 'equipment'
                                    ? 'equipment'
                                    : 'fleet'
                            }
                            resources={state.resources}
                            selectedAssetId={state.selectedAssetId}
                            query={query}
                            role={state.role}
                            onSelectAsset={(assetId) =>
                                dispatch({ type: 'select-asset', assetId })
                            }
                        />
                    );
                case 'fuel':
                    return (
                        <FuelManagement
                            requests={state.fuelRequests}
                            role={state.role}
                            query={query}
                            onDecide={(requestId, status) =>
                                dispatch({
                                    type: 'decide-fuel-request',
                                    requestId,
                                    status,
                                })
                            }
                        />
                    );
                case 'reports':
                    return (
                        <ReportsSurface
                            resources={state.resources}
                            auditEvents={state.auditEvents}
                        />
                    );
                case 'dispatch':
                    return (
                        <GuidedDispatch
                            jobs={state.jobs}
                            resources={state.resources}
                            proposal={state.proposal}
                            selectedJobId={state.selectedJobId}
                            query={query}
                            onSelectJob={(jobId) =>
                                dispatch({ type: 'select-job', jobId })
                            }
                            onResolveConflict={(conflictId) =>
                                dispatch({
                                    type: 'resolve-conflict',
                                    conflictId,
                                })
                            }
                            onConfirmDispatch={(jobId) =>
                                dispatch({ type: 'confirm-dispatch', jobId })
                            }
                        />
                    );
                default:
                    return (
                        <ManagerOverview
                            jobs={state.jobs}
                            fuelRequests={state.fuelRequests}
                            onNavigate={selectSection}
                        />
                    );
            }
        }

        switch (state.section) {
            case 'board':
                return (
                    <DispatchBoard
                        jobs={state.jobs}
                        resources={state.resources}
                        selectedJobId={state.selectedJobId}
                        query={query}
                        onSelectJob={(jobId) =>
                            dispatch({ type: 'select-job', jobId })
                        }
                    />
                );
            case 'live':
                return (
                    <LiveOperations
                        telemetry={state.telemetry}
                        selectedAssetId={state.selectedAssetId}
                        onSelectAsset={(assetId) =>
                            dispatch({ type: 'select-asset', assetId })
                        }
                    />
                );
            case 'fleet':
            case 'equipment':
                return (
                    <ResourceDirectory
                        mode={
                            state.section === 'equipment'
                                ? 'equipment'
                                : 'fleet'
                        }
                        resources={state.resources}
                        selectedAssetId={state.selectedAssetId}
                        query={query}
                        role={state.role}
                        onSelectAsset={(assetId) =>
                            dispatch({ type: 'select-asset', assetId })
                        }
                    />
                );
            case 'fuel':
                return (
                    <FuelManagement
                        requests={state.fuelRequests}
                        role={state.role}
                        query={query}
                        onDecide={(requestId, status) =>
                            dispatch({
                                type: 'decide-fuel-request',
                                requestId,
                                status,
                            })
                        }
                    />
                );
            case 'reports':
                return (
                    <ReportsSurface
                        resources={state.resources}
                        auditEvents={state.auditEvents}
                    />
                );
            default:
                return (
                    <GuidedDispatch
                        jobs={state.jobs}
                        resources={state.resources}
                        proposal={state.proposal}
                        selectedJobId={state.selectedJobId}
                        query={query}
                        onSelectJob={(jobId) =>
                            dispatch({ type: 'select-job', jobId })
                        }
                        onResolveConflict={(conflictId) =>
                            dispatch({
                                type: 'resolve-conflict',
                                conflictId,
                            })
                        }
                        onConfirmDispatch={(jobId) =>
                            dispatch({ type: 'confirm-dispatch', jobId })
                        }
                    />
                );
        }
    };

    const fieldRole = ['driver', 'operator', 'technician'].includes(state.role);

    return (
        <>
            <Head title="Core Transaction 2 Operations" />
            <AppShell
                role={state.role}
                section={state.section}
                collapsed={fieldRole ? true : state.sidebarCollapsed}
                connectivity={state.connectivity}
                queuedActions={state.queuedActions}
                query={query}
                onQueryChange={setQuery}
                onSectionChange={selectSection}
                onToggleSidebar={() => dispatch({ type: 'toggle-sidebar' })}
            >
                {fieldRole ? (
                    <FieldMobileApp
                        role={
                            state.role as 'driver' | 'operator' | 'technician'
                        }
                        section={state.section}
                        jobs={state.jobs}
                        fieldTasks={state.fieldTasks}
                        connectivity={state.connectivity}
                        queuedActions={state.queuedActions}
                        onSectionChange={selectSection}
                        onConnectivityChange={(connectivity) =>
                            dispatch({
                                type: 'set-connectivity',
                                connectivity,
                            })
                        }
                        onSync={() => dispatch({ type: 'sync-queue' })}
                        onAdvanceJob={(jobId, status) =>
                            dispatch({ type: 'advance-job', jobId, status })
                        }
                        onAdvanceTask={(
                            taskId: string,
                            status: FieldTask['status'],
                        ) => dispatch({ type: 'advance-task', taskId, status })}
                    />
                ) : (
                    renderWebSurface()
                )}
            </AppShell>
            <ToastStack
                toasts={state.toasts}
                onDismiss={(toastId) =>
                    dispatch({ type: 'dismiss-toast', toastId })
                }
            />
        </>
    );
}
