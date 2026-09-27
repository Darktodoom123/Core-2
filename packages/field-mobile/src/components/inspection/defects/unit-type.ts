import type { DesignatedEquipmentType } from '../../../utils/equipmentClassification';
import type { IconName } from '../../common/Icon';

export interface UnitTypeCopy {
    label: string;
    plural: string;
    hint: string;
    icon: IconName;
}

export const UNIT_TYPES: Record<DesignatedEquipmentType, UnitTypeCopy> = {
    mobile_crane: {
        label: 'Mobile crane',
        plural: 'mobile cranes',
        hint: 'Boom, outriggers and a road chassis',
        icon: 'crane',
    },
    tower_crane: {
        label: 'Tower crane',
        plural: 'tower cranes',
        hint: 'Fixed mast, jib and trolley',
        icon: 'crane',
    },
    carrier: {
        label: 'Truck / carrier',
        plural: 'trucks',
        hint: 'Road vehicle, flatbed or lowbed',
        icon: 'truck',
    },
};

export const UNIT_TYPE_ORDER: DesignatedEquipmentType[] = [
    'mobile_crane',
    'tower_crane',
    'carrier',
];
