import type {
    DvirInspectionRecord,
    TechnicianInspectionCheck,
} from '../../types/index';

/**
 * Maps a snake_case `DvirInspectionResource` payload from
 * `GET /api/v1/dvir/inspections` onto the mobile record shape.
 */
export const mapApiRecordToHistory = (record: any): DvirInspectionRecord => ({
    id: String(record.id ?? ''),
    type: record.type === 'post_trip' ? 'post_trip' : 'pre_trip',
    assetCode: record.asset_code ?? '',
    assetName: record.asset_name ?? '',
    inspectorName: record.inspector_name ?? '',
    startingOdometerKm: record.starting_odometer_km ?? null,
    endingOdometerKm: record.ending_odometer_km ?? null,
    engineHours: record.engine_hours ?? null,
    hasDefects: Boolean(record.has_defects),
    criticalDefectsCount: record.critical_defects_count ?? 0,
    checks: Array.isArray(record.checks)
        ? record.checks.map((check: any): TechnicianInspectionCheck => ({
              id: String(check.id ?? ''),
              category: check.category,
              label: check.label,
              status: check.status,
              statusLabel: check.status_label ?? '',
              notes: check.notes ?? null,
              icon: '',
          }))
        : [],
    photos: Array.isArray(record.photos)
        ? record.photos.map((p: any) => ({
              id: p.id,
              angle: p.angle,
              file_name: p.file_name,
              url: p.url,
              file_size_bytes: p.file_size_bytes,
              created_at: p.created_at,
          }))
        : undefined,
    signatureCaptured: Boolean(record.signature_captured),
    remarks: record.remarks ?? null,
    completedAt: record.completed_at ?? new Date().toISOString(),
});
