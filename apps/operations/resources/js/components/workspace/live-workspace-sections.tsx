import type { ReactNode } from 'react';
import { ApprovalsSurface } from '@/components/approvals';
import { Skeleton } from '@/components/ui';
import { ArchiveSurface } from '@/components/workspace/archive-workspace-section';
import { AuditSurface } from '@/components/workspace/audit/audit-surface';
import { FleetSurface } from '@/components/workspace/fleet';
import { FuelSurface } from '@/components/workspace/fuel';
import { GptRecommendationsSurface } from '@/components/workspace/gpt-workspace-section';
import { NotificationsSurface } from '@/components/workspace/notifications-workspace-section';
import { UserManagementWorkspaceSection } from '@/components/workspace/personnel/user-management-workspace-section';
import { ReportsSurface } from '@/components/workspace/reports-workspace-section';
import type {
    ApprovalViewModel,
    ArchivedJobViewModel,
    AssetViewModel,
    DispatchJobViewModel,
    FuelRequestStatsViewModel,
    FuelRequestViewModel,
    GptRecommendationViewModel,
    JobReportStatsViewModel,
    JobReportViewModel,
    LocationUpdateViewModel,
    NotificationViewModel,
    PaginationMeta,
    ReportExportViewModel,
    SosIncidentViewModel,
    WorkspaceCapabilities,
    WorkspaceSection,
    WorkspaceUserViewModel,
} from '@/types/workspace';

export function LiveWorkspaceSection({
    section,
    assets,
    assetsTotal,
    assetsPagination,
    fuelRequests,
    fuelRequestsTotal,
    fuelRequestsStats,
    fuelRequestsPagination,
    locations,
    approvals,
    capabilities,
    jobReports = [],
    jobReportsTotal,
    jobReportsStats,
    jobReportsPagination,
    reportExports = [],
    notifications = [],
    notificationsTotal,
    notificationsHasMore = false,
    unreadNotificationCount = 0,
    archivedJobs = [],
    gptRecommendations = [],
    gptRecommendationHistoryPagination,
    gptSelectedRecommendation,
    jobs = [],
    users = [],
    activeSosIncidents,
    onSectionChange,
}: {
    section: Exclude<WorkspaceSection, 'dispatch'>;
    assets: AssetViewModel[];
    assetsTotal?: number;
    assetsPagination?: PaginationMeta;
    fuelRequests: FuelRequestViewModel[];
    fuelRequestsTotal?: number;
    fuelRequestsStats?: FuelRequestStatsViewModel;
    fuelRequestsPagination?: PaginationMeta;
    locations: LocationUpdateViewModel[];
    approvals: ApprovalViewModel[];
    capabilities: WorkspaceCapabilities;
    jobReports?: JobReportViewModel[];
    jobReportsTotal?: number;
    jobReportsStats?: JobReportStatsViewModel;
    jobReportsPagination?: PaginationMeta;
    reportExports?: ReportExportViewModel[];
    notifications?: NotificationViewModel[];
    notificationsTotal?: number;
    notificationsHasMore?: boolean;
    unreadNotificationCount?: number;
    archivedJobs?: ArchivedJobViewModel[];
    gptRecommendations?: GptRecommendationViewModel[];
    gptRecommendationHistoryPagination?: PaginationMeta;
    gptSelectedRecommendation?: GptRecommendationViewModel | null;
    jobs?: DispatchJobViewModel[];
    users?: WorkspaceUserViewModel[];
    activeSosIncidents?: SosIncidentViewModel[];
    onSectionChange?: (section: WorkspaceSection) => void;
}) {
    switch (section) {
        case 'assets':
            return (
                <FleetSurface
                    assets={assets}
                    assetsTotal={assetsTotal}
                    locations={locations}
                    activeSosIncidents={activeSosIncidents}
                    capabilities={capabilities}
                    onSectionChange={onSectionChange}
                    pagination={assetsPagination}
                />
            );
        case 'fuel':
            return (
                <FuelSurface
                    requests={fuelRequests}
                    capabilities={capabilities}
                    assets={assets}
                    total={fuelRequestsTotal}
                    stats={fuelRequestsStats}
                    pagination={fuelRequestsPagination}
                />
            );
        case 'tracking':
            return (
                <FleetSurface
                    assets={assets}
                    assetsTotal={assetsTotal}
                    locations={locations}
                    activeSosIncidents={activeSosIncidents}
                    capabilities={capabilities}
                    onSectionChange={onSectionChange}
                    initialViewMode="map"
                    pagination={assetsPagination}
                />
            );
        case 'approvals':
            return (
                <ApprovalsSurface
                    approvals={approvals}
                    canDecide={capabilities.decide_approval}
                />
            );
        case 'reports':
            return (
                <ReportsSurface
                    reports={jobReports}
                    exports={reportExports}
                    jobs={jobs}
                    capabilities={capabilities}
                    total={jobReportsTotal}
                    serverStats={jobReportsStats}
                    pagination={jobReportsPagination}
                />
            );

        case 'notifications':
            return (
                <NotificationsSurface
                    notifications={notifications}
                    total={notificationsTotal}
                    hasMore={notificationsHasMore}
                    unreadCount={unreadNotificationCount}
                    onNavigate={onSectionChange}
                />
            );
        case 'archive':
            return (
                <ArchiveSurface
                    jobs={archivedJobs}
                    capabilities={capabilities}
                />
            );
        case 'gpt-recommendations':
            return (
                <GptRecommendationsSurface
                    recommendations={gptRecommendations}
                    historyPagination={gptRecommendationHistoryPagination}
                    selectedRecommendation={gptSelectedRecommendation}
                    capabilities={capabilities}
                    onSectionChange={onSectionChange}
                />
            );
        case 'users':
            return (
                <UserManagementWorkspaceSection
                    users={users ?? []}
                    capabilities={capabilities}
                />
            );
        case 'audit':
            return <AuditSurface exports={reportExports} />;
    }
}

export function ResponsiveTable({
    headers,
    rows,
}: {
    headers: string[];
    rows: Array<{ key: number; cells: ReactNode[] }>;
}) {
    return (
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
            <div className="divide-y divide-line md:hidden">
                {rows.map((row) => (
                    <dl key={row.key} className="space-y-2 px-4 py-3">
                        {row.cells.map((cell, index) => (
                            <div
                                key={headers[index]}
                                className="grid grid-cols-[minmax(7rem,0.7fr)_minmax(0,1fr)] gap-3 text-sm"
                            >
                                <dt className="text-ink-soft">
                                    {headers[index]}
                                </dt>
                                <dd className="min-w-0 text-right text-ink">
                                    {cell}
                                </dd>
                            </div>
                        ))}
                    </dl>
                ))}
            </div>
            <div
                className="workspace-scroll-region hidden md:block"
                role="region"
                aria-label="Responsive data table scroll region"
                tabIndex={0}
            >
                <table className="w-full text-left text-sm">
                    <thead className="bg-surface-subtle text-ink-soft">
                        <tr>
                            {headers.map((header) => (
                                <th
                                    key={header}
                                    scope="col"
                                    className="px-4 py-3 font-medium"
                                >
                                    {header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr key={row.key} className="border-t border-line">
                                {row.cells.map((cell, index) => (
                                    <td
                                        key={headers[index]}
                                        className="px-4 py-3"
                                    >
                                        {cell}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export function AssetListSkeleton() {
    return (
        <div className="space-y-px" aria-label="Loading operational assets">
            {[1, 2, 3, 4].map((item) => (
                <div key={item} className="border-b border-line px-4 py-3.5">
                    <div className="flex items-center justify-between gap-2">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-5 w-24 rounded-full" />
                    </div>
                    <Skeleton className="mt-2 h-3.5 w-36" />
                    <Skeleton className="mt-2 h-3 w-28" />
                </div>
            ))}
        </div>
    );
}

export function FuelTableSkeleton() {
    return (
        <div
            className="divide-y divide-line"
            aria-label="Loading fuel requests"
        >
            {[1, 2, 3, 4].map((item) => (
                <div
                    key={item}
                    className="flex items-center justify-between p-4"
                >
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3.5 w-48" />
                    </div>
                    <Skeleton className="h-6 w-24 rounded-full" />
                </div>
            ))}
        </div>
    );
}
