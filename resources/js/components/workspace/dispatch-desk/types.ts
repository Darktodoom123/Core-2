import type { ReactNode } from 'react';
import type {
    ApprovalViewModel,
    AssetViewModel,
    ClientViewModel,
    DispatchJobViewModel,
    GptRecommendationViewModel,
    RentalDispatchHandoffViewModel,
    SalesDispatchHandoffViewModel,
    ServiceRequestViewModel,
    WorkspaceCapabilities,
    WorkspaceUserViewModel,
} from '@/types/workspace';

export type DispatchDeskView =
    'incoming' | 'schedule' | 'in-progress' | 'history';

export type DispatchDeskMode = 'list' | 'calendar' | 'resources';

export type DispatchDeskPeriod = 'day' | 'week' | 'month';

export type DispatchSourceFilter =
    'all' | 'service_request' | 'rental_reservation' | 'sales_order' | 'manual';

export interface DispatchDeskProps {
    jobs: DispatchJobViewModel[];
    clients: ClientViewModel[];
    serviceRequests: ServiceRequestViewModel[];
    rentalHandoffs: RentalDispatchHandoffViewModel[];
    salesHandoffs: SalesDispatchHandoffViewModel[];
    assets?: AssetViewModel[];
    approvals?: ApprovalViewModel[];
    users?: WorkspaceUserViewModel[];
    gptRecommendations?: GptRecommendationViewModel[];
    capabilities: WorkspaceCapabilities;
    canCreate: boolean;
    refreshing: boolean;
    initialServiceRequestId?: number | null;
    resourceCoverage?: ReactNode;
}

export interface DispatchDeskUrlState {
    view: DispatchDeskView;
    mode: DispatchDeskMode;
    period: DispatchDeskPeriod;
    date: string;
    query: string;
    source: DispatchSourceFilter;
    attentionOnly: boolean;
    selectedJobId: number | null;
    showIntake: boolean;
    intakeMode: 'service' | 'rental' | 'sale' | null;
}
