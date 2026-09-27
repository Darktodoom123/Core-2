import type { DelayReasonCode } from '../../../types/index';
import type { IconName } from '../../common/Icon';

export interface ReasonOption {
    code: DelayReasonCode;
    label: string;
    description: string;
    icon: IconName;
}

export const TRANSIT_REASONS: ReasonOption[] = [
    {
        code: 'traffic',
        label: 'Traffic Congestion',
        description: 'Heavy traffic or escort pace delay',
        icon: 'truck',
    },
    {
        code: 'road_closure',
        label: 'Road Closure / Detour',
        description: 'Road barrier, re-blocking, or construction',
        icon: 'route',
    },
    {
        code: 'low_clearance',
        label: 'Low Clearance Obstruction',
        description: 'Overhead wires, bridge, or structural limit',
        icon: 'alert',
    },
    {
        code: 'site_access_restricted',
        label: 'Site Access Restricted',
        description: 'Gate locked, queue, or permit check',
        icon: 'shield-check',
    },
    {
        code: 'weather',
        label: 'Adverse Weather',
        description: 'Heavy rain, flooding, or reduced visibility',
        icon: 'sun',
    },
    {
        code: 'equipment_issue',
        label: 'Equipment Issue (In Transit)',
        description: 'Vehicle warning, tire issue, or mechanical concern',
        icon: 'tools',
    },
    {
        code: 'other',
        label: 'Other Transit Delay',
        description: 'Unforeseen route delay',
        icon: 'clock',
    },
];

export const ON_SITE_REASONS: ReasonOption[] = [
    {
        code: 'site_not_ready',
        label: 'Site Not Prepared',
        description: 'Unstable ground, uncleared pad, or obstructions',
        icon: 'pin',
    },
    {
        code: 'materials_unavailable',
        label: 'Materials / Rigging Missing',
        description: 'Loads, slings, or rigging hardware not ready',
        icon: 'clipboard',
    },
    {
        code: 'awaiting_clearance',
        label: 'Awaiting Safety Clearance',
        description: 'Permit-to-work, engineering, or marshaling sign-off',
        icon: 'shield-check',
    },
    {
        code: 'weather',
        label: 'Weather / Wind Hold',
        description: 'Wind speed exceeds rated crane capacity or storm',
        icon: 'sun',
    },
    {
        code: 'equipment_issue',
        label: 'Equipment Issue (On Site)',
        description: 'Hydraulic, outrigger, or hoist malfunction',
        icon: 'tools',
    },
    {
        code: 'other',
        label: 'Other On-Site Delay',
        description: 'Operational demurrage or unexpected site hold',
        icon: 'clock',
    },
];

export const ESTIMATE_OPTIONS = [15, 30, 45, 60, 90, 120];
