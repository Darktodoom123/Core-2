import { ApprovalsSurface } from '@/components/approvals';
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
