import type {
    ClientViewModel,
    DispatchPriorityValue,
    WorkspaceCapabilities,
} from '@/types/workspace';

export type DirectDispatchWorkStream =
    'service' | 'rental' | 'sale' | 'general';

export type DirectDispatchEquipmentSubtype =
    'mobile_crane' | 'tower_crane' | 'general_service';

export interface DirectDispatchFormData {
    client: string;
    title: string;
    site: string;
    scheduled_start: string;
    scheduled_end: string;
    priority: DispatchPriorityValue;
    work_stream: DirectDispatchWorkStream;
    equipment_subtype: DirectDispatchEquipmentSubtype | null;
    site_notes: string;
    requirements: string[];
}

export type DirectDispatchFormErrors = Record<string, string | undefined>;

export type DirectDispatchExitReason = 'back' | 'close' | 'success';

export type DirectDispatchCapabilities = Pick<
    WorkspaceCapabilities,
    'create_client'
>;

export interface DirectDispatchIntakeProps {
    clients: ClientViewModel[];
    capabilities?: DirectDispatchCapabilities;
    onBack?: () => void;
    onClose?: () => void;
    onAddClient?: () => void;
    onDirtyChange?: (isDirty: boolean) => void;
    onEntryFocus?: (heading: HTMLHeadingElement) => void;
    onExitFocus?: (reason: DirectDispatchExitReason) => void;
}

export interface DirectDispatchSummaryProjection {
    client: string;
    workStream: string;
    equipmentSubtype: string | null;
    site: string;
    schedule: string;
    priority: string;
    requirementCount: number;
    missingRequiredFields: string[];
    provenance: string;
    draftNotice: string;
}
