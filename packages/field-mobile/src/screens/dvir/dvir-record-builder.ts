import type { WalkaroundPhotosMap } from '../../components/inspection';
import type { DefectItem } from '../../components/inspection/defects/defect-types';
import type { FieldApiClient } from '../../services/apiClient';
import type {
    DvirInspectionRecord,
    TechnicianInspectionCheck,
} from '../../types/index';
import { getDefaultInspectionChecks } from '../../utils/equipmentClassification';
import type { DesignatedEquipmentType } from '../../utils/equipmentClassification';
import { parseReading } from './dvir-readings';

type DvirMode = 'pre_trip' | 'post_trip' | 'history';

export type DvirSubmitPayload = Parameters<
    FieldApiClient['createDvirInspection']
>[0];

export type WalkaroundPhotoPayload = ReturnType<
    typeof buildWalkaroundPhotosPayload
>[number];

/** Where each defect group is filed on the server; the rest are structural. */
const CHECK_CATEGORY_BY_GROUP: Record<
    string,
    TechnicianInspectionCheck['category']
> = {
    tires_wheels: 'tires_tracks',
    in_cab_controls: 'safety_devices',
    crane_lmi_safety: 'safety_devices',
    tower_crane_cab: 'safety_devices',
    brakes_suspension: 'hydraulics',
    mobile_crane_outriggers: 'hydraulics',
    exterior_front: 'fluids',
    tower_crane_trolley: 'electrical',
    tower_crane_electrical: 'electrical',
};

/**
 * Sent when the operator marks the unit unsafe without naming a defect, so
 * the server has a critical check to lock the unit on and to put in the
 * work order.
 */
const DECLARED_UNSAFE_CHECK: TechnicianInspectionCheck = {
    id: 'operator-declared-unsafe',
    category: 'safety_devices',
    label: 'Operator declared the unit unsafe to operate',
    status: 'critical',
    statusLabel: 'Critical Defect · Block dispatch',
    icon: '',
};

/** Default equipment checks, reported defects, and post-trip shutdown checks. */
export function buildDvirChecks({
    chocksDeployed,
    declaredUnsafe,
    designatedEquipment,
    mode,
    outriggersStowed,
    parkingBrakeSet,
    selectedDefects,
}: {
    chocksDeployed: boolean;
    /** The operator chose "Unsafe" on the safety status. */
    declaredUnsafe: boolean;
    designatedEquipment: DesignatedEquipmentType | null;
    mode: DvirMode;
    outriggersStowed: boolean;
    parkingBrakeSet: boolean;
    selectedDefects: DefectItem[];
}): TechnicianInspectionCheck[] {
    const defaultChecks = getDefaultInspectionChecks(designatedEquipment);
    const checksList: TechnicianInspectionCheck[] = [
        ...defaultChecks.map((chk) => ({ ...chk })),
        ...selectedDefects.map((def) => ({
            id: def.id,
            category: CHECK_CATEGORY_BY_GROUP[def.categoryKey] ?? 'structural',
            label: `${def.categoryTitle}: ${def.label}`,
            status: def.critical
                ? ('critical' as const)
                : ('attention' as const),
            statusLabel: def.critical
                ? 'Critical Defect · Block dispatch'
                : 'Needs attention · Reported defect',
            icon: '',
        })),
        ...(declaredUnsafe && selectedDefects.length === 0
            ? [{ ...DECLARED_UNSAFE_CHECK }]
            : []),
        ...(mode === 'post_trip'
            ? [
                  {
                      id: 'post-trip-parking-brake',
                      category: 'hydraulics' as const,
                      label: 'Air brake & spring emergency brake fully engaged',
                      status: parkingBrakeSet
                          ? ('good' as const)
                          : ('critical' as const),
                      statusLabel: parkingBrakeSet
                          ? 'Pass · Engaged'
                          : 'Critical Defect · Brake not engaged',
                      icon: '',
                  },
                  {
                      id: 'post-trip-wheel-chocks',
                      category: 'safety_devices' as const,
                      label: 'Heavy wheel chocks firmly deployed on drive axles',
                      status: chocksDeployed
                          ? ('good' as const)
                          : ('attention' as const),
                      statusLabel: chocksDeployed
                          ? 'Pass · Deployed'
                          : 'Needs attention · Chocks not deployed',
                      icon: '',
                  },
                  {
                      id: 'post-trip-outriggers',
                      category: 'hydraulics' as const,
                      label: 'Outrigger beams & hydraulic jacks retracted & locked',
                      status: outriggersStowed
                          ? ('good' as const)
                          : ('critical' as const),
                      statusLabel: outriggersStowed
                          ? 'Pass · Retracted & locked'
                          : 'Critical Defect · Outriggers not stowed',
                      icon: '',
                  },
              ]
            : []),
    ];

    return checksList;
}

export function buildWalkaroundPhotosPayload(
    walkaroundPhotos: WalkaroundPhotosMap,
) {
    return Object.entries(walkaroundPhotos)
        .filter(([, photo]) => Boolean(photo))
        .map(([angle, photo]) => ({
            // Numbered defect slots are all the server's `defect` angle.
            angle: angle.startsWith('defect_') ? 'defect' : angle,
            file_name: photo!.fileName,
            file_size: photo!.fileSize,
            base64: photo!.base64,
            uri: photo!.uri,
        }));
}

/** A blank or unreadable reading is sent as null, never as 0. */
const readingOrNull = (value: string): number | null => {
    const reading = parseReading(value);

    return reading === null || Number.isNaN(reading) ? null : reading;
};

export function buildDvirRecord({
    attested,
    checksList,
    currentAssetName,
    engineHours,
    inspectorName,
    isUnsafe,
    localAssetCode,
    mode,
    odometerKm,
    photosPayload,
    remarks,
    selectedDefects,
}: {
    /** The operator ticked "I inspected this unit". */
    attested: boolean;
    checksList: TechnicianInspectionCheck[];
    currentAssetName: string;
    engineHours: string;
    inspectorName: string;
    isUnsafe: boolean;
    localAssetCode: string;
    mode: DvirMode;
    odometerKm: string;
    photosPayload: WalkaroundPhotoPayload[];
    remarks: string;
    selectedDefects: DefectItem[];
}): DvirInspectionRecord {
    const record: DvirInspectionRecord = {
        id: `DVIR-${Date.now().toString(36).toUpperCase()}`,
        syncState: 'on_phone',
        type: mode === 'post_trip' ? 'post_trip' : 'pre_trip',
        assetCode: localAssetCode,
        assetName: currentAssetName,
        inspectorName,
        startingOdometerKm:
            mode === 'pre_trip' ? readingOrNull(odometerKm) : undefined,
        endingOdometerKm:
            mode === 'post_trip' ? readingOrNull(odometerKm) : undefined,
        engineHours: readingOrNull(engineHours),
        hasDefects: selectedDefects.length > 0 || isUnsafe,
        // Matches the server, which counts the critical checks it receives.
        criticalDefectsCount: checksList.filter((c) => c.status === 'critical')
            .length,
        checks: checksList,
        signatureCaptured: attested,
        signatureData: null,
        // Only what the operator wrote; nothing is written on their behalf.
        remarks: remarks.trim() || null,
        completedAt: new Date().toISOString(),
    };

    if (photosPayload.length > 0) {
        record.photos = photosPayload.map((p) => ({
            angle: p.angle,
            file_name: p.file_name,
            url: p.uri,
            file_size_bytes: p.file_size,
        }));
    }

    return record;
}

export function buildDvirSubmitPayload({
    attested,
    currentAssetName,
    inspectorName,
    localAssetCode,
    photosPayload,
    record,
}: {
    attested: boolean;
    currentAssetName: string;
    inspectorName: string;
    localAssetCode: string;
    photosPayload: WalkaroundPhotoPayload[];
    record: DvirInspectionRecord;
}): DvirSubmitPayload {
    const checksPayload = record.checks.map((c) => ({
        id: c.id || undefined,
        category: c.category,
        label: c.label,
        status: c.status,
        status_label: c.statusLabel || undefined,
        notes: c.notes ?? undefined,
    }));

    const dvirPayload = {
        inspection_type: (record.type === 'post_trip'
            ? 'post_trip'
            : 'pre_trip') as 'pre_trip' | 'post_trip',
        asset_code: localAssetCode,
        asset_name: currentAssetName,
        inspector_name: inspectorName,
        starting_odometer_km:
            record.type === 'pre_trip'
                ? (record.startingOdometerKm ?? null)
                : null,
        ending_odometer_km:
            record.type === 'post_trip'
                ? (record.endingOdometerKm ?? null)
                : null,
        engine_hours: record.engineHours ?? null,
        has_defects: record.hasDefects,
        signature_captured: attested,
        remarks: record.remarks,
        checks: checksPayload,
        photos: photosPayload.length > 0 ? photosPayload : undefined,
    };

    return dvirPayload;
}
