import { useMemo } from 'react';
import { LiveTrackingPreview } from '@/components/dashboards/live-tracking-preview';
import type {
    LocationUpdateViewModel,
    ScopeRefreshState,
    SosIncidentViewModel,
    WorkspaceSection,
    WorkspaceUserViewModel,
} from '@/types/workspace';
import { DataFreshness } from '../manager/manager-dashboard-header';
import { useNow } from '../manager/use-now';
import { AccessPanel } from './access-panel';
import { AdminAttentionList } from './admin-attention-list';
import {
    buildAttentionItems,
    roleDistribution,
    subsystems,
    summarizeAccounts,
    summarizeCredentials,
} from './admin-dashboard-model';
import { AdminMetricStrip } from './admin-metric-strip';
import { AiGovernancePanel } from './ai-governance-panel';
import { RecentAuditPanel } from './recent-audit-panel';
import { SystemHealthPanel } from './system-health-panel';
import {
    useAiGovernance,
    useAuditSummary,
    useSystemHealth,
} from './use-admin-data';

const CLOCK_INTERVAL_MS = 15_000;
const EMPTY_USERS: WorkspaceUserViewModel[] = [];
const EMPTY_LOCATIONS: LocationUpdateViewModel[] = [];
const EMPTY_INCIDENTS: SosIncidentViewModel[] = [];

export interface SystemAdminDashboardProps {
    users?: WorkspaceUserViewModel[];
    locations?: LocationUpdateViewModel[];
    activeSosIncidents?: SosIncidentViewModel[];
    availableSections: WorkspaceSection[];
    refresh?: ScopeRefreshState;
    workspaceRefresh?: ScopeRefreshState;
    realtimeConnected?: boolean;
    onSectionChange: (
        section: WorkspaceSection,
        options?: { serviceRequestId?: number; tab?: string },
    ) => void;
}

export function SystemAdminDashboard({
    users = EMPTY_USERS,
    locations = EMPTY_LOCATIONS,
    activeSosIncidents = EMPTY_INCIDENTS,
    availableSections,
    refresh,
    workspaceRefresh,
    realtimeConnected = false,
    onSectionChange,
}: SystemAdminDashboardProps) {
    const now = useNow(CLOCK_INTERVAL_MS);
    const can = (section: WorkspaceSection) =>
        availableSections.includes(section);

    const health = useSystemHealth();
    const governance = useAiGovernance(can('gpt-recommendations'));
    const audit = useAuditSummary(can('audit'));

    const accounts = useMemo(() => summarizeAccounts(users), [users]);
    const credentials = useMemo(() => summarizeCredentials(users), [users]);
    const roles = useMemo(() => roleDistribution(users), [users]);
    const rows = subsystems(health.data, realtimeConnected);
    const attention = buildAttentionItems({
        health: health.data,
        healthError: health.error,
        credentials,
        accounts,
        ai: governance.data,
    });

    const open = (section: WorkspaceSection, tab?: string) =>
        onSectionChange(section, tab ? { tab } : undefined);

    return (
        <div className="space-y-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0">
                    <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink">
                        Operation Dashboard
                    </h1>
                    <p className="mt-1 text-sm text-ink-soft">
                        <span className="font-semibold text-ink">
                            {attention.length === 0
                                ? 'Nothing needs your attention'
                                : `${attention.length} ${attention.length === 1 ? 'item needs' : 'items need'} attention`}
                        </span>
                        <span
                            className="mx-1.5 text-line-strong"
                            aria-hidden="true"
                        >
                            ·
                        </span>
                        Platform health, access, AI spend, and audit activity
                    </p>
                </div>
                <DataFreshness
                    realtimeConnected={realtimeConnected}
                    refresh={workspaceRefresh}
                    now={now}
                />
            </div>

            <AdminMetricStrip
                health={health.data}
                healthError={health.error}
                accounts={accounts}
                ai={governance.data}
                aiError={governance.error}
                audit={audit.data}
                auditError={audit.error}
                now={now}
                canOpen={can}
                onOpen={(section) => open(section)}
            />

            <AdminAttentionList
                items={attention}
                availableSections={availableSections}
                onOpen={open}
            />

            <SystemHealthPanel
                health={health.data}
                rows={rows}
                error={health.error}
                loading={health.loading}
                checkedAt={health.checkedAt}
                onRefresh={health.reload}
            />

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(20rem,1fr)] xl:items-start">
                <AccessPanel
                    credentials={credentials}
                    accounts={accounts}
                    roles={roles}
                    canOpenUsers={can('users')}
                    onOpenUsers={(tab) => open('users', tab)}
                />
                <div className="space-y-5">
                    {can('gpt-recommendations') && (
                        <AiGovernancePanel
                            governance={governance}
                            canOpenAdvisory
                            onOpenAdvisory={() => open('gpt-recommendations')}
                        />
                    )}
                    {can('audit') && (
                        <RecentAuditPanel
                            audit={audit.data}
                            error={audit.error}
                            now={now}
                            canOpenAudit
                            onOpenAudit={() => open('audit')}
                            onRetry={audit.reload}
                        />
                    )}
                </div>
            </div>

            {can('assets') && (
                <LiveTrackingPreview
                    locations={locations}
                    activeSosIncidents={activeSosIncidents}
                    refresh={refresh}
                    realtimeConnected={realtimeConnected}
                    onOpenTracking={() => open('assets')}
                />
            )}
        </div>
    );
}
