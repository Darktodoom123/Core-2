export type CrewRole =
    | 'crane_operator'
    | 'rigger_certified'
    | 'signalman_spotter'
    | 'welder_fitter'
    | 'general_laborer';

export type PreOpCheckStatus =
    'passed' | 'pending' | 'flagged' | 'not_required';
export type CertificationStatus = 'valid' | 'expiring_soon' | 'expired';

export interface CrewMemberReadiness {
    id: string;
    name: string;
    role: CrewRole;
    roleLabel: string;
    tesdaCertification?: {
        name: string;
        expiryDate: string;
        status: CertificationStatus;
    };
    preOpStatus: PreOpCheckStatus;
    tbmAttended: boolean;
    fitToWork: boolean;
    photoUrl?: string;
}

export interface ToolboxMeetingTopic {
    id: string;
    title: string;
    category:
        | 'Lifting & Rigging'
        | 'Heavy Equipment'
        | 'Site Environment'
        | 'Health & PPE';
    summary: string;
    keyPoints: string[];
}

export interface ToolboxMeetingRecord {
    id: string;
    projectSite: string;
    date: string;
    time: string;
    topicId: string;
    topicTitle: string;
    conductorName: string;
    conductorRole: 'Field Foreman' | 'Safety Officer';
    attendeeIds: string[];
    attendeeCount: number;
    photoEvidenceUrl?: string;
    photoTimestamp?: string;
    safetyOfficerCoSigned: boolean;
    safetyOfficerName?: string;
    safetyOfficerSignedAt?: string;
    notes?: string;
}

export type LiftRiskLevel = 'routine' | 'critical' | 'complex_tandem';
export type LiftPermitStatus =
    'draft' | 'pending_so_review' | 'approved' | 'rejected' | 'revoked';

export interface CriticalLiftPlan {
    id: string;
    liftReference: string;
    projectSite: string;
    equipmentCode: string;
    equipmentModel: string;
    craneOperatorName: string;
    leadRiggerName: string;
    riggerTesdaNcNumber: string;
    riskLevel: LiftRiskLevel;
    grossLoadWeightTons: number;
    craneRatedCapacityTons: number;
    loadPercentageOfCapacity: number;
    boomLengthMeters: number;
    workingRadiusMeters: number;
    groundBearingCondition:
        | 'Engineered Timber Pads'
        | 'Steel Plates on Compacted Soil'
        | 'Concrete Pad'
        | 'Unverified Ground';
    overheadObstacles: boolean;
    weatherWindSpeedKph: number;
    maxAllowedWindSpeedKph: number;
    status: LiftPermitStatus;
    foremanSignOff: {
        signed: boolean;
        signedBy?: string;
        signedAt?: string;
    };
    safetyOfficerSignOff: {
        signed: boolean;
        signedBy?: string;
        signedAt?: string;
        rejectionReason?: string;
    };
}

export type HazardSeverity = 'minor' | 'moderate' | 'high' | 'imminent_danger';
export type HazardCategory =
    | 'rigging_tackle'
    | 'ground_soil_instability'
    | 'ppe_violation'
    | 'pinch_point_crush'
    | 'overhead_powerlines'
    | 'housekeeping_fire'
    | 'equipment_defect';

export interface SiteHazardTicket {
    id: string;
    ticketCode: string;
    projectSite: string;
    reportedBy: string;
    reporterRole: string;
    reportedAt: string;
    category: HazardCategory;
    categoryLabel: string;
    severity: HazardSeverity;
    description: string;
    locationDetail: string;
    photoEvidenceUrl?: string;
    correctiveActionRequired: string;
    status: 'open' | 'under_investigation' | 'rectified' | 'closed';
    workStoppageIssued: boolean;
    assignedToForemanName?: string;
    rectifiedAt?: string;
}

export interface WorkStoppageNotice {
    id: string;
    noticeNumber: string;
    projectSite: string;
    issuedBySafetyOfficer: string;
    issuedAt: string;
    reason: string;
    doleRegulationReference: string;
    affectedEquipmentCode?: string;
    affectedArea: string;
    isActive: boolean;
    acknowledgedByForeman?: string;
    acknowledgedAt?: string;
    liftedAt?: string;
}

export interface SafeManHoursMetrics {
    safeManHoursWithoutLti: number;
    daysWithoutLti: number;
    activeSitesCount: number;
    todayTbmCompletionPercentage: number;
    openHazardCount: number;
    imminentDangerCount: number;
    activePermitCount: number;
}
