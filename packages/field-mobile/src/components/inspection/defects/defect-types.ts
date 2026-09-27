import type { DesignatedEquipmentType } from '../../../utils/equipmentClassification';

export interface DefectItem {
    id: string;
    label: string;
    categoryKey: string;
    categoryTitle: string;
    /** A critical defect locks the unit out of dispatch. */
    critical?: boolean;
    /** Narrows a shared group item to these unit types. */
    onlyFor?: DesignatedEquipmentType[];
}

export interface DefectCategoryGroup {
    key: string;
    title: string;
    applicableTo?: DesignatedEquipmentType[];
    items: DefectItem[];
}

export type DefectSeverity = 'critical' | 'attention';
