import type { WalkaroundPhotosMap } from '../../components/inspection';
import type { DefectItem } from '../../components/inspection/DvirDefectsModal';
import type { DigitalSignatureData } from '../../components/signature/DigitalSignatureModal';
import type { FieldApiClient } from '../../services/apiClient';
import type {
    DvirInspectionRecord,
    TechnicianInspectionCheck,
} from '../../types/index';
import { getDefaultInspectionChecks } from '../../utils/equipmentClassification';
import type { DesignatedEquipmentType } from '../../utils/equipmentClassification';

type DvirMode = 'pre_trip' | 'post_trip' | 'history';

export type DvirSubmitPayload = Parameters<
    FieldApiClient['createDvirInspection']
>[0];

export type WalkaroundPhotoPayload = ReturnType<
    typeof buildWalkaroundPhotosPayload
>[number];

/** Default equipment checks, reported defects, and post-trip shutdown checks. */
export function buildDvirChecks({
    chocksDeployed,
    designatedEquipment,
    mode,
    outriggersStowed,
    parkingBrakeSet,
    selectedDefects,
}: {
    chocksDeployed: boolean;
    designatedEquipment: DesignatedEquipmentType;
    mode: DvirMode;
    outriggersStowed: boolean;
    parkingBrakeSet: boolean;
    selectedDefects: DefectItem[];
}): TechnicianInspectionCheck[] {
    const defaultChecks = getDefaultInspectionChecks(designatedEquipment);
    const checksList: TechnicianInspectionCheck[] = [
        ...defaultChecks.map((chk) => ({ ...chk })),
        ...selectedDefects.map((def) => {
            const mappedCategory: TechnicianInspectionCheck['category'] =
                def.categoryKey === 'tires_wheels'
                    ? 'tires_tracks'
                    : def.categoryKey === 'in_cab_controls' ||
                        def.categoryKey === 'crane_lmi_safety'
                      ? 'safety_devices'
                      : def.categoryKey === 'brakes_suspension' ||
                          def.categoryKey === 'mobile_crane_outriggers'
                        ? 'hydraulics'
                        : def.categoryKey === 'exterior_front'
                          ? 'fluids'
                          : def.categoryKey === 'tower_crane_trolley'
                            ? 'electrical'
                            : 'structural';

            return {
                id: def.id,
                category: mappedCategory,
                label: `${def.categoryTitle}: ${def.label}`,
                status: def.critical
                    ? ('critical' as const)
                    : ('attention' as const),
                statusLabel: def.critical
                    ? 'Critical Defect · Block dispatch'
                    : 'Needs attention · Reported defect',
                icon: '',
            };
        }),
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
            angle,
            file_name: photo!.fileName,
            file_size: photo!.fileSize,
            base64: photo!.base64,
            uri: photo!.uri,
        }));
}

export function buildDvirRecord({
    checksList,
    currentAssetName,
    dvirSignature,
    engineHours,
    hasSignatureCaptured,
    inspectorName,
    isUnsafe,
    localAssetCode,
    mode,
    odometerKm,
    photosPayload,
    remarks,
    selectedDefects,
}: {
    checksList: TechnicianInspectionCheck[];
    currentAssetName: string;
    dvirSignature: DigitalSignatureData | null;
    engineHours: string;
    hasSignatureCaptured: boolean;
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
        type: mode === 'post_trip' ? 'post_trip' : 'pre_trip',
        assetCode: localAssetCode,
        assetName: currentAssetName,
        inspectorName,
        startingOdometerKm:
            mode === 'pre_trip' ? parseFloat(odometerKm) || 0 : undefined,
        endingOdometerKm:
            mode === 'post_trip' ? parseFloat(odometerKm) || 0 : undefined,
        engineHours: parseFloat(engineHours) || 0,
        hasDefects: selectedDefects.length > 0 || isUnsafe,
        criticalDefectsCount: selectedDefects.filter((d) => d.critical).length,
        checks: checksList,
        signatureCaptured: hasSignatureCaptured,
        signatureData: dvirSignature
            ? {
                  signerName: dvirSignature.signerName,
                  signerRole: dvirSignature.signerRole,
                  signedAt: dvirSignature.signedAt,
                  pointCount: dvirSignature.pointCount,
              }
            : null,
        remarks:
            remarks.trim() ||
            (mode === 'pre_trip'
                ? `Pre-trip walkaround inspection completed. Safety Status: ${isUnsafe ? 'UNSAFE' : 'SAFE TO DRIVE'}.`
                : `Post-trip shutdown walkaround completed. Machine parked & secured. Safety Status: ${isUnsafe ? 'UNSAFE' : 'SAFE TO DRIVE'}.`),
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
    currentAssetName,
    dvirSignature,
    hasSignatureCaptured,
    inspectorName,
    localAssetCode,
    photosPayload,
    record,
}: {
    currentAssetName: string;
    dvirSignature: DigitalSignatureData | null;
    hasSignatureCaptured: boolean;
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
        signature_captured: hasSignatureCaptured,
        digital_signature: dvirSignature
            ? {
                  signer_name: dvirSignature.signerName,
                  signer_role: dvirSignature.signerRole,
                  signed_at: dvirSignature.signedAt,
                  strokes: dvirSignature.strokes,
                  point_count: dvirSignature.pointCount,
              }
            : undefined,
        remarks: record.remarks,
        checks: checksPayload,
        photos: photosPayload.length > 0 ? photosPayload : undefined,
    };

    return dvirPayload;
}
