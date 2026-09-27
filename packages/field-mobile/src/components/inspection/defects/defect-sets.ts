import type { DesignatedEquipmentType } from '../../../utils/equipmentClassification';
import { DVIR_DEFECT_CATEGORIES } from './defect-catalog';
import type {
    DefectCategoryGroup,
    DefectItem,
    DefectSeverity,
} from './defect-types';

/** Groups in the order an operator walks the unit. */
const GROUP_ORDER: Record<DesignatedEquipmentType, string[]> = {
    mobile_crane: [
        'mobile_crane_boom',
        'mobile_crane_outriggers',
        'mobile_crane_superstructure',
        'crane_hoist_rigging',
        'crane_lmi_safety',
        'in_cab_controls',
        'exterior_front',
        'exterior_sides',
        'exterior_rear',
        'brakes_suspension',
        'tires_wheels',
    ],
    tower_crane: [
        'tower_crane_mast',
        'tower_crane_slewing',
        'tower_crane_jib',
        'tower_crane_trolley',
        'crane_hoist_rigging',
        'crane_lmi_safety',
        'tower_crane_cab',
        'tower_crane_electrical',
    ],
    carrier: [
        'exterior_front',
        'exterior_sides',
        'exterior_rear',
        'in_cab_controls',
        'brakes_suspension',
        'tires_wheels',
    ],
};

/** The problems operators report most for each unit type. */
export const COMMON_DEFECT_IDS: Record<DesignatedEquipmentType, string[]> = {
    mobile_crane: [
        'crane_hoist_wire_rope',
        'crane_hook_latch',
        'crane_lmi_a2b',
        'crane_outriggers_jacks',
        'front_fluid_levels',
        'tire_tread_depth',
    ],
    tower_crane: [
        'crane_hoist_wire_rope',
        'crane_hook_latch',
        'crane_lmi_a2b',
        'tower_trolley_wire_rope',
        'crane_anemometer_wind',
        'tower_slewing_brake',
    ],
    carrier: [
        'tire_tread_depth',
        'rear_brake_lights',
        'brake_service_brakes',
        'front_fluid_levels',
        'side_mirrors_windshield',
        'cab_horn_alarm',
    ],
};

export const ALL_DEFECTS: DefectItem[] = DVIR_DEFECT_CATEGORIES.flatMap(
    (group) => group.items,
);

/** The groups and items that apply to one unit type, in walkaround order. */
export function defectGroupsFor(
    type: DesignatedEquipmentType,
): DefectCategoryGroup[] {
    return GROUP_ORDER[type]
        .map((key) => DVIR_DEFECT_CATEGORIES.find((group) => group.key === key))
        .filter((group): group is DefectCategoryGroup => Boolean(group))
        .map((group) => ({
            ...group,
            items: group.items.filter(
                (item) => !item.onlyFor || item.onlyFor.includes(type),
            ),
        }))
        .filter((group) => group.items.length > 0);
}

export function findDefects(ids: string[]): DefectItem[] {
    return ALL_DEFECTS.filter((item) => ids.includes(item.id));
}

export const defectSeverity = (item: DefectItem): DefectSeverity =>
    item.critical ? 'critical' : 'attention';

/** The unit type is fixed, so the "Mobile Crane:" style prefix is noise. */
export const groupDisplayTitle = (group: Pick<DefectCategoryGroup, 'title'>) =>
    group.title.replace(/^(Mobile Crane|Tower Crane):\s*/, '');
