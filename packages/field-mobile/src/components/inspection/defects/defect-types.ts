import type { DesignatedEquipmentType } from '../../../utils/equipmentClassification';

export interface DefectItem {
    id: string;
    label: string;
    categoryKey: string;
    categoryTitle: string;
    /** Severity for maintenance; every reported defect locks the unit. */
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
