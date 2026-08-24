import type {
    DirectDispatchEquipmentSubtype,
    DirectDispatchFormData,
    DirectDispatchWorkStream,
} from './types';

export const DIRECT_DISPATCH_PROVENANCE = 'Manual source · manual_intake';

export const MOBILE_CRANE_REQUIREMENTS = [
    'Require on-site ground bearing & soil stability check',
    'Require outrigger pad clearance & positioning check',
    'Require overhead power line safe clearance verification (15m)',
    'Require certified rigging gear & inspection sign-off',
    'Require site induction & PPE compliance verification',
    'Require traffic control & local municipal permit in place',
];

export const TOWER_CRANE_REQUIREMENTS = [
    'Require weathervaning / free-slew mechanism verification at shift end',
    'Require foundation anchor bolt & mast pin torque inspection',
    'Require Load Moment Indicator (LMI) & hoist limit switch testing',
    'Require high-rise aviation obstruction warning lights operational',
    'Require mast vertical ladder fall-arrest rail & safety cage inspection',
];

export const GENERAL_SERVICE_REQUIREMENTS = [
    'Require certified rigging gear & inspection sign-off',
    'Require site induction & PPE compliance verification',
    'Require traffic control & local municipal permit in place',
    'Require task hazard analysis & safety briefing sign-off',
];

export const RENTAL_DELIVERY_REQUIREMENTS = [
    'Require pre-checkout condition photos & fluid/hour meter documentation',
    'Require pre-operation inspection & safe release certificate',
    'Require customer site delivery receipt & condition handover sign-off',
    'Require heavy transport lowbed 4-point tie-down inspection',
];

export const SALES_TRANSPORT_REQUIREMENTS = [
    'Require physical VIN & serial number verification against sales order',
    'Require heavy transport lowbed height & route clearance check',
    'Require delivery handover inspection & customer sign-off',
    'Require equipment title & ownership transfer documentation sign-off',
];

export const GENERAL_OPERATIONAL_REQUIREMENTS = [
    'Require on-site ground bearing & soil stability check',
    'Require outrigger pad clearance & positioning check',
    'Require overhead power line safe clearance verification',
    'Require site induction & PPE compliance verification',
    'Require certified rigging gear & inspection sign-off',
    'Require traffic control & local municipal permit in place',
];

export const DIRECT_DISPATCH_WORK_TYPES: Array<{
    id: DirectDispatchWorkStream;
    title: string;
    description: string;
}> = [
    {
        id: 'service',
        title: 'Field service',
        description: 'Crane lifts and on-site service work',
    },
    {
        id: 'rental',
        title: 'Rental delivery',
        description: 'Equipment hire mobilization and preparation',
    },
    {
        id: 'sale',
        title: 'Sales transport',
        description: 'Machinery hauling and VIN handover',
    },
    {
        id: 'general',
        title: 'General operational',
        description: 'Ad-hoc direct draft dispatch',
    },
];

export const DIRECT_DISPATCH_SUBTYPES: Array<{
    id: DirectDispatchEquipmentSubtype;
    label: string;
}> = [
    { id: 'mobile_crane', label: 'Mobile / all-terrain crane' },
    { id: 'tower_crane', label: 'Tower crane' },
    { id: 'general_service', label: 'Rigging and support' },
];

export function getRecommendedRequirements(
    workStream: DirectDispatchWorkStream,
    equipmentSubtype: DirectDispatchEquipmentSubtype | null,
): string[] {
    if (workStream === 'service') {
        if (equipmentSubtype === 'tower_crane') {
            return [...TOWER_CRANE_REQUIREMENTS];
        }

        if (equipmentSubtype === 'general_service') {
            return [...GENERAL_SERVICE_REQUIREMENTS];
        }

        return [...MOBILE_CRANE_REQUIREMENTS];
    }

    if (workStream === 'rental') {
        return [...RENTAL_DELIVERY_REQUIREMENTS];
    }

    if (workStream === 'sale') {
        return [...SALES_TRANSPORT_REQUIREMENTS];
    }

    return [...GENERAL_OPERATIONAL_REQUIREMENTS];
}

export function getWorkStreamLabel(
    workStream: DirectDispatchWorkStream,
): string {
    return (
        DIRECT_DISPATCH_WORK_TYPES.find(
            (workType) => workType.id === workStream,
        )?.title ?? 'General operational'
    );
}

export function getEquipmentSubtypeLabel(
    equipmentSubtype: DirectDispatchEquipmentSubtype | null,
): string | null {
    if (!equipmentSubtype) {
        return null;
    }

    return (
        DIRECT_DISPATCH_SUBTYPES.find(
            (subtype) => subtype.id === equipmentSubtype,
        )?.label ?? null
    );
}

export function getRequirementHeading(
    workStream: DirectDispatchWorkStream,
    equipmentSubtype: DirectDispatchEquipmentSubtype | null,
): string {
    if (workStream === 'service' && equipmentSubtype === 'tower_crane') {
        return 'Tower crane safety requirements';
    }

    if (workStream === 'service') {
        return 'Crane lift and site safety requirements';
    }

    if (workStream === 'rental') {
        return 'Rental preparation and delivery requirements';
    }

    if (workStream === 'sale') {
        return 'Sales transport and handover requirements';
    }

    return 'Standard operational requirements';
}

export function getRequirementDescription(
    workStream: DirectDispatchWorkStream,
    equipmentSubtype: DirectDispatchEquipmentSubtype | null,
): string {
    if (workStream === 'service' && equipmentSubtype === 'tower_crane') {
        return 'Add future job-brief checks for weathervaning, mast connections, LMI, and aviation beacons.';
    }

    if (workStream === 'service') {
        return 'Add future job-brief checks for ground stability, outriggers, powerline clearance, and rigging.';
    }

    if (workStream === 'rental') {
        return 'Add future job-brief checks for condition evidence, safe release, and delivery handover.';
    }

    if (workStream === 'sale') {
        return 'Add future job-brief checks for VIN verification, tie-downs, and ownership transfer.';
    }

    return 'Add future job-brief checks for site induction, PPE, traffic control, and permits.';
}

export function getTitlePlaceholder(
    workStream: DirectDispatchWorkStream,
    equipmentSubtype: DirectDispatchEquipmentSubtype | null,
): string {
    if (workStream === 'service') {
        if (equipmentSubtype === 'tower_crane') {
            return 'e.g. High-rise tower crane erection and operation';
        }

        if (equipmentSubtype === 'general_service') {
            return 'e.g. Structural rigging and technical site service';
        }

        return 'e.g. 50T mobile crane tandem lift and erection';
    }

    if (workStream === 'rental') {
        return 'e.g. Rough terrain crane rental delivery and setup';
    }

    if (workStream === 'sale') {
        return 'e.g. Excavator sales transport and handover';
    }

    return 'e.g. Heavy crane lift and transport';
}

export function getReferencePrefix(
    workStream: DirectDispatchWorkStream,
): string {
    if (workStream === 'service') {
        return 'DSP-SRV';
    }

    if (workStream === 'rental') {
        return 'DSP-REN';
    }

    if (workStream === 'sale') {
        return 'DSP-SAL';
    }

    return 'DSP-MAN';
}

export function mergeSelectedRequirements(
    recommended: string[],
    selectedCustomRequirements: string[],
): string[] {
    return Array.from(new Set([...recommended, ...selectedCustomRequirements]));
}

export function deriveDirectDispatchIntakeData(
    formData: DirectDispatchFormData,
    customRequirements: string[],
) {
    const recommendedRequirements = getRecommendedRequirements(
        formData.work_stream,
        formData.equipment_subtype,
    );

    return {
        recommendedRequirements,
        customRequirements,
        selectedCustomRequirements: customRequirements.filter((requirement) =>
            formData.requirements.includes(requirement),
        ),
        referencePrefix: getReferencePrefix(formData.work_stream),
        requirementHeading: getRequirementHeading(
            formData.work_stream,
            formData.equipment_subtype,
        ),
        requirementDescription: getRequirementDescription(
            formData.work_stream,
            formData.equipment_subtype,
        ),
        titlePlaceholder: getTitlePlaceholder(
            formData.work_stream,
            formData.equipment_subtype,
        ),
    };
}
