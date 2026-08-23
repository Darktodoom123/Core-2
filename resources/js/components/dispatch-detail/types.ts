import type {
    AssetCandidateViewModel,
    PersonnelCandidateViewModel,
} from '@/types/workspace';

export interface AssignmentRequestPayload {
    personnel: Array<{
        user_id: number;
        assignment_type: PersonnelCandidateViewModel['assignment_type'];
    }>;
    assets: Array<{
        operational_asset_id: number;
        assignment_type: AssetCandidateViewModel['assignment_type'];
    }>;
}

export type DispatchStep = 1 | 2 | 3;
