import type {
    InspectionCategory,
    TechnicianInspectionCheck,
} from '../../types/index';
import type { DesignatedEquipmentType } from '../../utils/equipmentClassification';

/** The operator's answer to one shutdown check; absent until they answer. */
export type PostTripAnswer = 'yes' | 'no';
export type PostTripAnswers = Partial<Record<string, PostTripAnswer>>;

export interface PostTripCheck {
    id: string;
    /** Asked as a yes/no question. */
    label: string;
    category: InspectionCategory;
    /** Severity when the answer is "no"; any "no" locks the unit. */
    failStatus: 'critical' | 'attention';
    failLabel: string;
}

const PARKING_BRAKE: PostTripCheck = {
    id: 'post-trip-parking-brake',
    label: 'Air brake & spring emergency brake fully engaged',
    category: 'hydraulics',
    failStatus: 'critical',
    failLabel: 'Critical Defect · Brake not engaged',
};

const WHEEL_CHOCKS: PostTripCheck = {
    id: 'post-trip-wheel-chocks',
    label: 'Wheel chocks firmly placed on the drive axles',
    category: 'safety_devices',
    failStatus: 'attention',
    failLabel: 'Needs attention · Chocks not placed',
};

const OUTRIGGERS: PostTripCheck = {
    id: 'post-trip-outriggers',
    label: 'Outrigger beams & jacks retracted and locked',
    category: 'hydraulics',
    failStatus: 'critical',
    failLabel: 'Critical Defect · Outriggers not stowed',
};

const HOOK_SECURED: PostTripCheck = {
    id: 'post-trip-hook-secured',
    label: 'No load on the hook; hook block stowed or raised clear',
    category: 'structural',
    failStatus: 'critical',
    failLabel: 'Critical Defect · Hook not secured',
};

const POWER_ISOLATED: PostTripCheck = {
    id: 'post-trip-power-isolated',
    label: 'Engine off or main power isolated; keys removed, cab locked',
    category: 'electrical',
    failStatus: 'attention',
    failLabel: 'Needs attention · Unit not shut down',
};

// DRAFT: tower crane shutdown steps need review by a tower crane specialist.
const SLEW_FREE: PostTripCheck = {
    id: 'post-trip-slew-free',
    label: 'Slewing brake released so the jib weather-vanes freely',
    category: 'structural',
    failStatus: 'critical',
    failLabel: 'Critical Defect · Jib cannot weather-vane',
};

const TROLLEY_PARKED: PostTripCheck = {
    id: 'post-trip-trolley-parked',
    label: 'Trolley parked in its rest position near the mast',
    category: 'electrical',
    failStatus: 'attention',
    failLabel: 'Needs attention · Trolley not parked',
};

const PARKED_LEVEL: PostTripCheck = {
    id: 'post-trip-parked-level',
    label: 'Parked on firm, level ground clear of traffic',
    category: 'structural',
    failStatus: 'attention',
    failLabel: 'Needs attention · Unsafe parking position',
};

const CHECKS_BY_TYPE: Record<DesignatedEquipmentType, PostTripCheck[]> = {
    mobile_crane: [
        PARKING_BRAKE,
        WHEEL_CHOCKS,
        OUTRIGGERS,
        HOOK_SECURED,
        POWER_ISOLATED,
    ],
    carrier: [PARKING_BRAKE, WHEEL_CHOCKS, POWER_ISOLATED],
    tower_crane: [HOOK_SECURED, TROLLEY_PARKED, SLEW_FREE, POWER_ISOLATED],
};

/** Shutdown checks that apply to this kind of unit. */
export function postTripChecksFor(
    type: DesignatedEquipmentType | null,
): PostTripCheck[] {
    // Unknown type: ask only what holds for any machine, never guess.
    return type ? CHECKS_BY_TYPE[type] : [PARKED_LEVEL, POWER_ISOLATED];
}

export const unansweredPostTripChecks = (
    checks: PostTripCheck[],
    answers: PostTripAnswers,
): PostTripCheck[] => checks.filter((check) => !answers[check.id]);

export const failedPostTripChecks = (
    checks: PostTripCheck[],
    answers: PostTripAnswers,
): PostTripCheck[] => checks.filter((check) => answers[check.id] === 'no');

/** Answered checks as inspection records; unanswered ones are never sent. */
export function postTripInspectionChecks(
    checks: PostTripCheck[],
    answers: PostTripAnswers,
): TechnicianInspectionCheck[] {
    return checks
        .filter((check) => answers[check.id])
        .map((check) => {
            const passed = answers[check.id] === 'yes';

            return {
                id: check.id,
                category: check.category,
                label: check.label,
                status: passed ? 'good' : check.failStatus,
                statusLabel: passed ? 'Pass · Confirmed' : check.failLabel,
                icon: '',
            };
        });
}
