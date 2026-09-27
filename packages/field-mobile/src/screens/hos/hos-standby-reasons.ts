import type { StandbyReason } from '../../types/index';
import type { DesignatedEquipmentType } from '../../utils/equipmentClassification';

export interface StandbyReasonOption {
    reason: StandbyReason;
    label: string;
    /** The server bills this delay to the client as demurrage. */
    billable: boolean;
}

/** Billable per the server's StandbyReason::isDemurrageBillable(). */
const BILLABLE = new Set<StandbyReason>([
    'waiting_on_client',
    'waiting_on_concrete',
    'site_access_blocked',
]);

const option = (reason: StandbyReason, label: string): StandbyReasonOption => ({
    reason,
    label,
    billable: BILLABLE.has(reason),
});

/** Before linking to a machine, only reasons that fit any job. */
const GENERAL: StandbyReasonOption[] = [
    option('waiting_on_client', 'Waiting on the client'),
    option('site_access_blocked', "Can't get into the site"),
    option('weather_hold', 'Weather hold'),
    option('other', 'Other'),
];

const BY_TYPE: Record<DesignatedEquipmentType, StandbyReasonOption[]> = {
    mobile_crane: [
        option('waiting_on_client', 'Waiting on the client'),
        option('waiting_on_concrete', 'Waiting on the concrete pour'),
        option('weather_hold', 'High wind or weather hold'),
        option('site_access_blocked', "Can't get into the site"),
        option('rigging_recheck', 'Rigging & outrigger ground re-check'),
        option('inspection_hold', 'Machine inspection hold'),
        option('other', 'Other'),
    ],
    // DRAFT: tower crane reasons need review by a tower crane specialist.
    tower_crane: [
        option('waiting_on_client', 'Waiting on the client'),
        option('waiting_on_concrete', 'Waiting on the concrete pour'),
        option('weather_hold', 'High wind: jib left to weather-vane'),
        option('rigging_recheck', 'Rigging re-check'),
        option('inspection_hold', 'Crane inspection hold'),
        option('other', 'Other'),
    ],
    carrier: [
        option('waiting_on_client', 'Waiting to load or unload'),
        option('site_access_blocked', 'Road or site access blocked'),
        option('weather_hold', 'Weather or typhoon signal'),
        option('inspection_hold', 'Vehicle inspection hold'),
        option('other', 'Other'),
    ],
};

/**
 * Standby reasons for the machine the operator is linked to. With no linked
 * machine, only general reasons apply; nothing machine-specific is offered.
 */
export function standbyReasonsFor(
    linkedType: DesignatedEquipmentType | null,
): StandbyReasonOption[] {
    return linkedType ? BY_TYPE[linkedType] : GENERAL;
}

/** Every reason code any list can send, for the server contract test. */
export const ALL_STANDBY_REASON_CODES: StandbyReason[] = [
    ...new Set(
        [GENERAL, ...Object.values(BY_TYPE)].flat().map((item) => item.reason),
    ),
];
