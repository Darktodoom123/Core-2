import React, { useEffect, useMemo, useState } from 'react';
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import type { PhotoAttachment } from '../components/attachments/PhotoAttachmentPicker';
import { Icon } from '../components/common/Icon';
import {
    DVIR_DEFECT_CATEGORIES,
    DvirDefectsModal,
    DvirWalkaroundPhotos,
} from '../components/inspection';
import type {
    CraneEquipmentFilter,
    WalkaroundAngle,
    WalkaroundPhotosMap,
} from '../components/inspection';
import { TileScreenHeader } from '../components/layout/tile-screen-header';
import { colors } from '../components/nativeStyles';
import type { FieldApiClient } from '../services/apiClient';
import type { CommandOutboxManager } from '../services/commandOutbox';
import { useTheme } from '../theme';
import type {
    DvirInspectionRecord,
    TechnicianInspectionCheck,
} from '../types/index';
import {
    getDefaultInspectionChecks,
    getEquipmentPresentation,
    resolveDesignatedEquipmentType,
} from '../utils/equipmentClassification';

export interface DvirScreenProps {
    assetCode?: string;
    assetName?: string;
    assetKind?: string;
    equipmentType?: CraneEquipmentFilter;
    inspectorName?: string;
    activeJobReference?: string;
    initialMode?: 'pre_trip' | 'post_trip' | 'history';
    apiClient?: FieldApiClient;
    commandOutbox?: CommandOutboxManager;
    onBack?: () => void;
    onSaveInspectionRecord?: (record: DvirInspectionRecord) => void;
}

const DEFAULT_CHECKS: TechnicianInspectionCheck[] = [
    {
        id: 'chk-hyd-01',
        category: 'hydraulics',
        label: 'Hydraulic cylinders, rams & hoses',
        status: 'good',
        statusLabel: 'Pass · No fluid leaks',
        icon: '',
    },
    {
        id: 'chk-elec-01',
        category: 'electrical',
        label: 'Load Moment Indicator (LMI) & A2B Alarm',
        status: 'good',
        statusLabel: 'Pass · Audible alarm active',
        icon: '',
    },
    {
        id: 'chk-struct-01',
        category: 'structural',
        label: 'Telescopic boom & wear pads',
        status: 'good',
        statusLabel: 'Pass · Structural integrity intact',
        icon: '',
    },
    {
        id: 'chk-tire-01',
        category: 'tires_tracks',
        label: 'Tire pressures & wheel lug torque',
        status: 'good',
        statusLabel: 'Pass · 120 PSI baseline verified',
        icon: '',
    },
    {
        id: 'chk-safe-01',
        category: 'safety_devices',
        label: 'Emergency e-stop, beacon & horn',
        status: 'good',
        statusLabel: 'Pass · Functional',
        icon: '',
    },
];

/**
 * Maps a snake_case `DvirInspectionResource` payload from
 * `GET /api/v1/dvir/inspections` onto the mobile record shape.
 */
const mapApiRecordToHistory = (record: any): DvirInspectionRecord => ({
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

const INITIAL_HISTORY: DvirInspectionRecord[] = [
    {
        id: 'DVIR-2026-0831-01',
        type: 'pre_trip',
        assetCode: 'ALB-CRN-050',
        assetName: '50T Tadano All-Terrain Crane',
        inspectorName: 'Alex Rivera (Certified Operator)',
        startingOdometerKm: 42150,
        engineHours: 1842.5,
        hasDefects: false,
        criticalDefectsCount: 0,
        checks: DEFAULT_CHECKS,
        signatureCaptured: true,
        remarks:
            'Today pre-shift inspection passed with zero defects. Outriggers & LMI verified.',
        completedAt: new Date().toISOString(),
    },
    {
        id: 'DVIR-2026-0830-02',
        type: 'post_trip',
        assetCode: 'ALB-CRN-050',
        assetName: '50T Tadano All-Terrain Crane',
        inspectorName: 'Alex Rivera (Certified Operator)',
        endingOdometerKm: 42120,
        engineHours: 1836,
        hasDefects: false,
        criticalDefectsCount: 0,
        checks: DEFAULT_CHECKS,
        signatureCaptured: true,
        remarks: 'Post-job walkaround clean. Asset parked and secured.',
        completedAt: new Date(Date.now() - 86400000).toISOString(),
    },
    {
        id: 'DVIR-2026-0828-01',
        type: 'pre_trip',
        assetCode: 'ALB-CRN-050',
        assetName: '50T Tadano All-Terrain Crane',
        inspectorName: 'Alex Rivera (Certified Operator)',
        startingOdometerKm: 42080,
        engineHours: 1824,
        hasDefects: false,
        criticalDefectsCount: 0,
        checks: DEFAULT_CHECKS,
        signatureCaptured: true,
        remarks: 'Pre-trip complete. Fluid levels verified.',
        completedAt: new Date(Date.now() - 259200000).toISOString(),
    },
    {
        id: 'DVIR-2026-0818-01',
        type: 'post_trip',
        assetCode: 'ALB-CRN-050',
        assetName: '50T Tadano All-Terrain Crane',
        inspectorName: 'Alex Rivera (Certified Operator)',
        endingOdometerKm: 41850,
        engineHours: 1795,
        hasDefects: true,
        criticalDefectsCount: 0,
        checks: DEFAULT_CHECKS,
        signatureCaptured: true,
        remarks: 'Hydraulic hose sweat noted and reported to fleet shop.',
        completedAt: new Date(Date.now() - 1123200000).toISOString(),
    },
];

export const DvirScreen: React.FC<DvirScreenProps> = ({
    assetCode = 'ALB-CRN-050',
    assetName = '50T Tadano All-Terrain Crane',
    assetKind,
    equipmentType,
    inspectorName = 'Alex Rivera (Certified Crane Operator)',
    activeJobReference = 'DISP-2026-0891',
    initialMode = 'pre_trip',
    apiClient,
    commandOutbox,
    onBack,
    onSaveInspectionRecord,
}) => {
    const { isDarkHud } = useTheme();
    const [mode, setMode] = useState<'pre_trip' | 'post_trip' | 'history'>(
        initialMode,
    );
    const [safetyStatus, setSafetyStatus] = useState<'safe' | 'unsafe'>('safe');
    const [selectedDefectIds, setSelectedDefectIds] = useState<string[]>([]);
    const [isDefectsModalOpen, setIsDefectsModalOpen] = useState(false);
    const [walkaroundPhotos, setWalkaroundPhotos] =
        useState<WalkaroundPhotosMap>({});
    const [odometerKm, setOdometerKm] = useState('42150');
    const [engineHours, setEngineHours] = useState('1842.5');
    const [remarks, setRemarks] = useState('');
    const [isSaved, setIsSaved] = useState(false);
    const [history, setHistory] =
        useState<DvirInspectionRecord[]>(INITIAL_HISTORY);
    const [showOlderArchive, setShowOlderArchive] = useState(false);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);
    const [syncError, setSyncError] = useState<string | null>(null);

    useEffect(() => {
        if (!apiClient) {
            return;
        }

        let cancelled = false;

        const load = (): void => {
            setIsHistoryLoading(true);

            apiClient
                .fetchDvirInspections(30)
                .then((res) => {
                    if (cancelled) {
                        return;
                    }

                    if (Array.isArray(res?.inspections)) {
                        setHistory(res.inspections.map(mapApiRecordToHistory));
                        setSyncError(null);
                    }
                })
                .catch(() => {
                    if (cancelled) {
                        return;
                    }

                    setSyncError(
                        'DVIR history could not be loaded. Showing cached records.',
                    );
                })
                .finally(() => {
                    if (!cancelled) {
                        setIsHistoryLoading(false);
                    }
                });
        };

        queueMicrotask(load);

        return () => {
            cancelled = true;
        };
    }, [apiClient]);

    // Group history records into Today, Past 7 Days (Compliance), and Older (30-Day Archive)
    const { todayRecords, past7DaysRecords, olderRecords } = useMemo(() => {
        const now = new Date();
        const startOfToday = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
        ).getTime();
        const sevenDaysAgo = startOfToday - 7 * 86400000;

        const today: DvirInspectionRecord[] = [];
        const past7Days: DvirInspectionRecord[] = [];
        const older: DvirInspectionRecord[] = [];

        history.forEach((record) => {
            const time = new Date(record.completedAt).getTime();

            if (time >= startOfToday) {
                today.push(record);
            } else if (time >= sevenDaysAgo) {
                past7Days.push(record);
            } else {
                older.push(record);
            }
        });

        return {
            todayRecords: today,
            past7DaysRecords: past7Days,
            olderRecords: older,
        };
    }, [history]);

    // Post-Trip Specific State
    const [chocksDeployed, setChocksDeployed] = useState(true);
    const [parkingBrakeSet, setParkingBrakeSet] = useState(true);
    const [outriggersStowed, setOutriggersStowed] = useState(true);

    // Resolve designated equipment type and presentation attributes
    const designatedEquipment = useMemo(
        () =>
            resolveDesignatedEquipmentType({
                assetCode,
                assetName,
                assetKind,
                equipmentType,
            }),
        [assetCode, assetName, assetKind, equipmentType],
    );

    const presentation = useMemo(
        () => getEquipmentPresentation(designatedEquipment),
        [designatedEquipment],
    );

    // Lookup selected defects details
    const selectedDefects = useMemo(() => {
        const allItems = DVIR_DEFECT_CATEGORIES.flatMap((cat) => cat.items);

        return allItems.filter((item) => selectedDefectIds.includes(item.id));
    }, [selectedDefectIds]);

    const hasCriticalDefects = selectedDefects.some((d) => d.critical);
    const isUnsafe = safetyStatus === 'unsafe' || hasCriticalDefects;

    const handleCapturePhoto = (
        angle: WalkaroundAngle,
        photo: PhotoAttachment,
    ) => {
        setWalkaroundPhotos((prev) => ({
            ...prev,
            [angle]: photo,
        }));
        setIsSaved(false);
    };

    const handleRemovePhoto = (angle: WalkaroundAngle) => {
        setWalkaroundPhotos((prev) => {
            const next = { ...prev };

            delete next[angle];

            return next;
        });
        setIsSaved(false);
    };

    const handleRemoveDefect = (id: string) => {
        setSelectedDefectIds((prev) => prev.filter((item) => item !== id));
        setIsSaved(false);
    };

    const handleApplyDefects = (defectIds: string[]) => {
        setSelectedDefectIds(defectIds);
        const allItems = DVIR_DEFECT_CATEGORIES.flatMap((cat) => cat.items);
        const selected = allItems.filter((item) => defectIds.includes(item.id));

        if (selected.some((item) => item.critical)) {
            setSafetyStatus('unsafe');
        }

        setIsSaved(false);
    };

    const handleCompleteDvir = () => {
        // Construct checks list with tailored default items for equipment + selected defects
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

        const record: DvirInspectionRecord = {
            id: `DVIR-${Date.now().toString(36).toUpperCase()}`,
            type: mode === 'post_trip' ? 'post_trip' : 'pre_trip',
            assetCode,
            assetName,
            inspectorName,
            startingOdometerKm:
                mode === 'pre_trip' ? parseFloat(odometerKm) || 0 : undefined,
            endingOdometerKm:
                mode === 'post_trip' ? parseFloat(odometerKm) || 0 : undefined,
            engineHours: parseFloat(engineHours) || 0,
            hasDefects: selectedDefects.length > 0 || isUnsafe,
            criticalDefectsCount: selectedDefects.filter((d) => d.critical)
                .length,
            checks: checksList,
            signatureCaptured: true,
            remarks:
                remarks.trim() ||
                (mode === 'pre_trip'
                    ? `Pre-trip walkaround inspection completed. Safety Status: ${isUnsafe ? 'UNSAFE' : 'SAFE TO DRIVE'}.`
                    : `Post-trip shutdown walkaround completed. Machine parked & secured. Safety Status: ${isUnsafe ? 'UNSAFE' : 'SAFE TO DRIVE'}.`),
            completedAt: new Date().toISOString(),
        };

        const photosPayload = Object.entries(walkaroundPhotos)
            .filter(([, photo]) => Boolean(photo))
            .map(([angle, photo]) => ({
                angle,
                file_name: photo!.fileName,
                file_size: photo!.fileSize,
                base64: photo!.base64,
                uri: photo!.uri,
            }));

        if (photosPayload.length > 0) {
            record.photos = photosPayload.map((p) => ({
                angle: p.angle,
                file_name: p.file_name,
                url: p.uri,
                file_size_bytes: p.file_size,
            }));
        }

        setHistory((prev) => [record, ...prev]);
        setIsSaved(true);
        onSaveInspectionRecord?.(record);

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
            asset_code: assetCode,
            asset_name: assetName,
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
            signature_captured: true,
            remarks: record.remarks,
            checks: checksPayload,
            photos: photosPayload.length > 0 ? photosPayload : undefined,
        };

        if (commandOutbox) {
            commandOutbox
                .enqueueSubmitDvir(dvirPayload)
                .then(async () => {
                    setSyncError(null);

                    if (apiClient) {
                        try {
                            await commandOutbox.processQueue(apiClient);
                        } catch {
                            // Safely retained in offline outbox
                        }
                    }
                })
                .catch(() => {
                    setSyncError(
                        'DVIR saved on device only — will not appear in server history.',
                    );
                });
        } else if (apiClient) {
            apiClient
                .createDvirInspection(dvirPayload)
                .then((responseRecord) => {
                    const mapped = mapApiRecordToHistory(responseRecord);
                    setHistory((prev) => [
                        mapped,
                        ...prev.filter((item) => item !== record),
                    ]);
                    setSyncError(null);
                })
                .catch(() => {
                    setSyncError(
                        'DVIR saved on device only — will not appear in server history.',
                    );
                });
        }
    };

    const handleNextOrSubmit = () => {
        handleCompleteDvir();
    };

    return (
        <View
            style={[styles.screenRoot, isDarkHud && styles.darkScreenRoot]}
            testID="dvir-screen"
        >
            {/* Header: Unified Minimalist Header matching other tiles */}
            <TileScreenHeader
                backAccessibilityLabel="Back to dashboard"
                backTestID="dvir-back-button"
                category="Vehicle Inspection"
                onBack={onBack}
                rightElement={
                    <Pressable
                        accessibilityLabel="Toggle history"
                        accessibilityRole="button"
                        onPress={() => {
                            setMode(
                                mode === 'history' ? 'pre_trip' : 'history',
                            );
                            setIsSaved(false);
                        }}
                        style={({ pressed }) => [
                            styles.historyToggleBadge,
                            isDarkHud && styles.darkHistoryToggleBadge,
                            mode === 'history' &&
                                styles.historyToggleBadgeActive,
                            isDarkHud &&
                                mode === 'history' &&
                                styles.darkHistoryToggleBadgeActive,
                            pressed && styles.historyToggleBadgePressed,
                        ]}
                        testID="tab-history"
                    >
                        <Icon
                            color={
                                mode === 'history'
                                    ? '#FFFFFF'
                                    : isDarkHud
                                      ? '#F59E0B'
                                      : colors.amber
                            }
                            name="file-text"
                            size={14}
                        />
                        <Text
                            style={[
                                styles.historyToggleText,
                                isDarkHud && styles.darkHistoryToggleText,
                                mode === 'history' &&
                                    styles.historyToggleTextActive,
                            ]}
                        >
                            {mode === 'history'
                                ? 'Form'
                                : `History (${history.length})`}
                        </Text>
                    </Pressable>
                }
                subtitle={
                    activeJobReference
                        ? `Inspection Checklist · Ref: ${activeJobReference}`
                        : 'Inspection Checklist'
                }
                title="Create DVIR"
            />

            {/* Main Content Area */}
            <ScrollView
                contentContainerStyle={styles.contentContainer}
                keyboardShouldPersistTaps="handled"
                style={styles.scrollView}
            >
                {mode === 'history' ? (
                    /* Past DVIR Records Grouped History View */
                    <View style={styles.historyContainer}>
                        {isHistoryLoading && (
                            <Text
                                style={[
                                    styles.historyMeta,
                                    isDarkHud && styles.darkHistoryAsset,
                                ]}
                                testID="dvir-history-loading"
                            >
                                Loading DVIR history from server...
                            </Text>
                        )}
                        {syncError && (
                            <Text
                                style={[
                                    styles.historyMeta,
                                    { color: '#F59E0B' },
                                ]}
                                testID="dvir-sync-warning"
                            >
                                {syncError}
                            </Text>
                        )}
                        {/* Section 1: Today's Shift Inspections */}
                        <View style={styles.timelineSection}>
                            <View style={styles.timelineSectionHeader}>
                                <Text
                                    style={[
                                        styles.sectionHeading,
                                        isDarkHud && styles.darkSectionHeading,
                                    ]}
                                >
                                    TODAY'S SHIFT INSPECTIONS
                                </Text>
                                <Text
                                    style={[
                                        styles.timelineSectionCount,
                                        isDarkHud &&
                                            styles.darkTimelineSectionCount,
                                    ]}
                                >
                                    {todayRecords.length}
                                </Text>
                            </View>
                            {todayRecords.length > 0 ? (
                                <View style={styles.historyList}>
                                    {todayRecords.map((item) => (
                                        <View
                                            key={item.id}
                                            style={[
                                                styles.historyCard,
                                                isDarkHud &&
                                                    styles.darkHistoryCard,
                                                item.criticalDefectsCount > 0 ||
                                                item.hasDefects
                                                    ? isDarkHud
                                                        ? styles.darkHistoryCardDefect
                                                        : styles.historyCardDefect
                                                    : isDarkHud
                                                      ? styles.darkHistoryCardClean
                                                      : styles.historyCardClean,
                                            ]}
                                            testID={`history-card-${item.id}`}
                                        >
                                            <View
                                                style={styles.historyCardHeader}
                                            >
                                                <View
                                                    style={
                                                        styles.historyRefGroup
                                                    }
                                                >
                                                    <Text
                                                        style={[
                                                            styles.historyTypeBadge,
                                                            isDarkHud &&
                                                                styles.darkHistoryTypeBadge,
                                                        ]}
                                                    >
                                                        {item.type ===
                                                        'pre_trip'
                                                            ? 'PRE-TRIP INSPECTION'
                                                            : 'POST-TRIP CHECK'}
                                                    </Text>
                                                    <Text
                                                        style={[
                                                            styles.historyId,
                                                            isDarkHud &&
                                                                styles.darkHistoryId,
                                                        ]}
                                                    >
                                                        {item.id}
                                                    </Text>
                                                </View>
                                                <View
                                                    style={
                                                        styles.statusIndicator
                                                    }
                                                >
                                                    <View
                                                        style={[
                                                            styles.statusDot,
                                                            item.hasDefects
                                                                ? styles.statusDotDefect
                                                                : styles.statusDotClean,
                                                        ]}
                                                    />
                                                    <Text
                                                        style={[
                                                            styles.statusText,
                                                            item.hasDefects
                                                                ? isDarkHud
                                                                    ? styles.darkStatusTextDefect
                                                                    : styles.statusTextDefect
                                                                : isDarkHud
                                                                  ? styles.darkStatusTextClean
                                                                  : styles.statusTextClean,
                                                        ]}
                                                    >
                                                        {item.hasDefects
                                                            ? `${item.criticalDefectsCount > 0 ? item.criticalDefectsCount : 'Defects'} Logged`
                                                            : 'Clean Pass'}
                                                    </Text>
                                                </View>
                                            </View>

                                            <Text
                                                style={[
                                                    styles.historyAsset,
                                                    isDarkHud &&
                                                        styles.darkHistoryAsset,
                                                ]}
                                            >
                                                {item.assetCode} ·{' '}
                                                {item.assetName}
                                            </Text>
                                            <Text
                                                style={[
                                                    styles.historyMeta,
                                                    isDarkHud &&
                                                        styles.darkHistoryMeta,
                                                ]}
                                            >
                                                Inspector: {item.inspectorName}
                                            </Text>
                                            <Text
                                                style={[
                                                    styles.historyMeta,
                                                    isDarkHud &&
                                                        styles.darkHistoryMeta,
                                                ]}
                                            >
                                                Logged:{' '}
                                                {new Date(
                                                    item.completedAt,
                                                ).toLocaleString()}
                                            </Text>
                                            {item.remarks ? (
                                                <Text
                                                    style={[
                                                        styles.historyRemarks,
                                                        isDarkHud &&
                                                            styles.darkHistoryRemarks,
                                                    ]}
                                                >
                                                    "{item.remarks}"
                                                </Text>
                                            ) : null}
                                        </View>
                                    ))}
                                </View>
                            ) : (
                                <View style={styles.emptyTimelineContainer}>
                                    <Text
                                        style={[
                                            styles.emptyTimelineText,
                                            isDarkHud &&
                                                styles.darkEmptyTimelineText,
                                        ]}
                                    >
                                        No inspections logged today yet. Use
                                        Pre-Trip or Post-Trip above.
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Section 2: Past 7 Days (Compliance Window) */}
                        <View style={styles.timelineSection}>
                            <View style={styles.timelineSectionHeader}>
                                <Text
                                    style={[
                                        styles.sectionHeading,
                                        isDarkHud && styles.darkSectionHeading,
                                    ]}
                                >
                                    PAST 7 DAYS (SAFETY COMPLIANCE)
                                </Text>
                                <Text
                                    style={[
                                        styles.timelineSectionCount,
                                        isDarkHud &&
                                            styles.darkTimelineSectionCount,
                                    ]}
                                >
                                    {past7DaysRecords.length}
                                </Text>
                            </View>
                            {past7DaysRecords.length > 0 ? (
                                <View style={styles.historyList}>
                                    {past7DaysRecords.map((item) => (
                                        <View
                                            key={item.id}
                                            style={[
                                                styles.historyCard,
                                                isDarkHud &&
                                                    styles.darkHistoryCard,
                                                item.criticalDefectsCount > 0 ||
                                                item.hasDefects
                                                    ? isDarkHud
                                                        ? styles.darkHistoryCardDefect
                                                        : styles.historyCardDefect
                                                    : isDarkHud
                                                      ? styles.darkHistoryCardClean
                                                      : styles.historyCardClean,
                                            ]}
                                            testID={`history-card-${item.id}`}
                                        >
                                            <View
                                                style={styles.historyCardHeader}
                                            >
                                                <View
                                                    style={
                                                        styles.historyRefGroup
                                                    }
                                                >
                                                    <Text
                                                        style={[
                                                            styles.historyTypeBadge,
                                                            isDarkHud &&
                                                                styles.darkHistoryTypeBadge,
                                                        ]}
                                                    >
                                                        {item.type ===
                                                        'pre_trip'
                                                            ? 'PRE-TRIP INSPECTION'
                                                            : 'POST-TRIP CHECK'}
                                                    </Text>
                                                    <Text
                                                        style={[
                                                            styles.historyId,
                                                            isDarkHud &&
                                                                styles.darkHistoryId,
                                                        ]}
                                                    >
                                                        {item.id}
                                                    </Text>
                                                </View>
                                                <View
                                                    style={
                                                        styles.statusIndicator
                                                    }
                                                >
                                                    <View
                                                        style={[
                                                            styles.statusDot,
                                                            item.hasDefects
                                                                ? styles.statusDotDefect
                                                                : styles.statusDotClean,
                                                        ]}
                                                    />
                                                    <Text
                                                        style={[
                                                            styles.statusText,
                                                            item.hasDefects
                                                                ? isDarkHud
                                                                    ? styles.darkStatusTextDefect
                                                                    : styles.statusTextDefect
                                                                : isDarkHud
                                                                  ? styles.darkStatusTextClean
                                                                  : styles.statusTextClean,
                                                        ]}
                                                    >
                                                        {item.hasDefects
                                                            ? `${item.criticalDefectsCount > 0 ? item.criticalDefectsCount : 'Defects'} Logged`
                                                            : 'Clean Pass'}
                                                    </Text>
                                                </View>
                                            </View>

                                            <Text
                                                style={[
                                                    styles.historyAsset,
                                                    isDarkHud &&
                                                        styles.darkHistoryAsset,
                                                ]}
                                            >
                                                {item.assetCode} ·{' '}
                                                {item.assetName}
                                            </Text>
                                            <Text
                                                style={[
                                                    styles.historyMeta,
                                                    isDarkHud &&
                                                        styles.darkHistoryMeta,
                                                ]}
                                            >
                                                Inspector: {item.inspectorName}
                                            </Text>
                                            <Text
                                                style={[
                                                    styles.historyMeta,
                                                    isDarkHud &&
                                                        styles.darkHistoryMeta,
                                                ]}
                                            >
                                                Logged:{' '}
                                                {new Date(
                                                    item.completedAt,
                                                ).toLocaleString()}
                                            </Text>
                                            {item.remarks ? (
                                                <Text
                                                    style={[
                                                        styles.historyRemarks,
                                                        isDarkHud &&
                                                            styles.darkHistoryRemarks,
                                                    ]}
                                                >
                                                    "{item.remarks}"
                                                </Text>
                                            ) : null}
                                        </View>
                                    ))}
                                </View>
                            ) : (
                                <View style={styles.emptyTimelineContainer}>
                                    <Text
                                        style={[
                                            styles.emptyTimelineText,
                                            isDarkHud &&
                                                styles.darkEmptyTimelineText,
                                        ]}
                                    >
                                        No prior inspections recorded within the
                                        past 7 days.
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Section 3: 30-Day Historical Archive */}
                        {olderRecords.length > 0 ? (
                            <View style={styles.timelineSection}>
                                <Pressable
                                    accessibilityLabel="Toggle 30-day historical archive"
                                    accessibilityRole="button"
                                    onPress={() =>
                                        setShowOlderArchive((prev) => !prev)
                                    }
                                    style={styles.archiveToggleBtn}
                                    testID="toggle-older-archive"
                                >
                                    <Text
                                        style={[
                                            styles.archiveToggleText,
                                            isDarkHud &&
                                                styles.darkArchiveToggleText,
                                        ]}
                                    >
                                        {showOlderArchive
                                            ? `▼ Hide 30-Day Archive (${olderRecords.length} Records)`
                                            : `▶ Load 30-Day Archive (${olderRecords.length} Older Records)`}
                                    </Text>
                                </Pressable>
                                {showOlderArchive ? (
                                    <View
                                        style={[
                                            styles.historyList,
                                            { marginTop: 10 },
                                        ]}
                                    >
                                        {olderRecords.map((item) => (
                                            <View
                                                key={item.id}
                                                style={[
                                                    styles.historyCard,
                                                    isDarkHud &&
                                                        styles.darkHistoryCard,
                                                    item.criticalDefectsCount >
                                                        0 || item.hasDefects
                                                        ? isDarkHud
                                                            ? styles.darkHistoryCardDefect
                                                            : styles.historyCardDefect
                                                        : isDarkHud
                                                          ? styles.darkHistoryCardClean
                                                          : styles.historyCardClean,
                                                ]}
                                                testID={`history-card-${item.id}`}
                                            >
                                                <View
                                                    style={
                                                        styles.historyCardHeader
                                                    }
                                                >
                                                    <View
                                                        style={
                                                            styles.historyRefGroup
                                                        }
                                                    >
                                                        <Text
                                                            style={[
                                                                styles.historyTypeBadge,
                                                                isDarkHud &&
                                                                    styles.darkHistoryTypeBadge,
                                                            ]}
                                                        >
                                                            {item.type ===
                                                            'pre_trip'
                                                                ? 'PRE-TRIP INSPECTION'
                                                                : 'POST-TRIP CHECK'}
                                                        </Text>
                                                        <Text
                                                            style={[
                                                                styles.historyId,
                                                                isDarkHud &&
                                                                    styles.darkHistoryId,
                                                            ]}
                                                        >
                                                            {item.id}
                                                        </Text>
                                                    </View>
                                                    <View
                                                        style={
                                                            styles.statusIndicator
                                                        }
                                                    >
                                                        <View
                                                            style={[
                                                                styles.statusDot,
                                                                item.hasDefects
                                                                    ? styles.statusDotDefect
                                                                    : styles.statusDotClean,
                                                            ]}
                                                        />
                                                        <Text
                                                            style={[
                                                                styles.statusText,
                                                                item.hasDefects
                                                                    ? isDarkHud
                                                                        ? styles.darkStatusTextDefect
                                                                        : styles.statusTextDefect
                                                                    : isDarkHud
                                                                      ? styles.darkStatusTextClean
                                                                      : styles.statusTextClean,
                                                            ]}
                                                        >
                                                            {item.hasDefects
                                                                ? `${item.criticalDefectsCount > 0 ? item.criticalDefectsCount : 'Defects'} Logged`
                                                                : 'Clean Pass'}
                                                        </Text>
                                                    </View>
                                                </View>

                                                <Text
                                                    style={[
                                                        styles.historyAsset,
                                                        isDarkHud &&
                                                            styles.darkHistoryAsset,
                                                    ]}
                                                >
                                                    {item.assetCode} ·{' '}
                                                    {item.assetName}
                                                </Text>
                                                <Text
                                                    style={[
                                                        styles.historyMeta,
                                                        isDarkHud &&
                                                            styles.darkHistoryMeta,
                                                    ]}
                                                >
                                                    Inspector:{' '}
                                                    {item.inspectorName}
                                                </Text>
                                                <Text
                                                    style={[
                                                        styles.historyMeta,
                                                        isDarkHud &&
                                                            styles.darkHistoryMeta,
                                                    ]}
                                                >
                                                    Logged:{' '}
                                                    {new Date(
                                                        item.completedAt,
                                                    ).toLocaleString()}
                                                </Text>
                                                {item.remarks ? (
                                                    <Text
                                                        style={[
                                                            styles.historyRemarks,
                                                            isDarkHud &&
                                                                styles.darkHistoryRemarks,
                                                        ]}
                                                    >
                                                        "{item.remarks}"
                                                    </Text>
                                                ) : null}
                                            </View>
                                        ))}
                                    </View>
                                ) : null}
                            </View>
                        ) : null}
                    </View>
                ) : (
                    /* Create DVIR (Exact Match to Uploaded Screenshots 1, 2 & 3) */
                    <View style={styles.formContainer}>
                        {/* Section 1: Choose inspection type (Required) */}
                        <View style={styles.formSection}>
                            <Text
                                style={[
                                    styles.formSectionTitle,
                                    isDarkHud && styles.darkFormSectionTitle,
                                ]}
                            >
                                Choose inspection type
                            </Text>
                            <Text style={styles.requiredBadge}>Required</Text>

                            <View style={styles.toggleRow}>
                                <Pressable
                                    accessibilityLabel="Pre-Trip Inspection"
                                    accessibilityRole="button"
                                    accessibilityState={{
                                        selected: mode === 'pre_trip',
                                    }}
                                    onPress={() => {
                                        setMode('pre_trip');
                                        setIsSaved(false);
                                    }}
                                    style={[
                                        styles.toggleCard,
                                        isDarkHud && styles.darkToggleCard,
                                        mode === 'pre_trip' &&
                                            styles.toggleCardActive,
                                        isDarkHud &&
                                            mode === 'pre_trip' &&
                                            styles.darkToggleCardActive,
                                    ]}
                                    testID="tab-pre-trip"
                                >
                                    <Text
                                        style={[
                                            styles.toggleCardText,
                                            isDarkHud &&
                                                styles.darkToggleCardText,
                                            mode === 'pre_trip' &&
                                                styles.toggleCardTextActive,
                                            isDarkHud &&
                                                mode === 'pre_trip' &&
                                                styles.darkToggleCardTextActive,
                                        ]}
                                    >
                                        1. Pre-Trip
                                    </Text>
                                </Pressable>

                                <Pressable
                                    accessibilityLabel="Post-Trip Inspection"
                                    accessibilityRole="button"
                                    accessibilityState={{
                                        selected: mode === 'post_trip',
                                    }}
                                    onPress={() => {
                                        setMode('post_trip');
                                        setIsSaved(false);
                                    }}
                                    style={[
                                        styles.toggleCard,
                                        isDarkHud && styles.darkToggleCard,
                                        mode === 'post_trip' &&
                                            styles.toggleCardActive,
                                        isDarkHud &&
                                            mode === 'post_trip' &&
                                            styles.darkToggleCardActive,
                                    ]}
                                    testID="tab-post-trip"
                                >
                                    <Text
                                        style={[
                                            styles.toggleCardText,
                                            isDarkHud &&
                                                styles.darkToggleCardText,
                                            mode === 'post_trip' &&
                                                styles.toggleCardTextActive,
                                            isDarkHud &&
                                                mode === 'post_trip' &&
                                                styles.darkToggleCardTextActive,
                                        ]}
                                    >
                                        2. Post-Trip
                                    </Text>
                                </Pressable>
                            </View>
                        </View>

                        {/* Section 2: Take walkaround photos (4 angles: Driver Side, Front, Passenger Side, Back) */}
                        <DvirWalkaroundPhotos
                            onCapturePhoto={handleCapturePhoto}
                            onRemovePhoto={handleRemovePhoto}
                            photos={walkaroundPhotos}
                            title="Take walkaround photos"
                        />

                        {/* Section 3: Add new defects tailored to designated equipment */}
                        <View style={styles.formSection}>
                            <Text
                                style={[
                                    styles.formSectionTitle,
                                    isDarkHud && styles.darkFormSectionTitle,
                                ]}
                                testID="dvir-defects-section-title"
                            >
                                {presentation.defectsSectionTitle.replace(
                                    'Add ',
                                    'Add new ',
                                )}
                            </Text>
                            <Text
                                style={[
                                    styles.helperNotice,
                                    isDarkHud && styles.darkHelperNotice,
                                ]}
                            >
                                {presentation.safetyDisclaimer}
                            </Text>

                            <Pressable
                                accessibilityLabel={`Add ${presentation.shortLabel.toLowerCase()} defects`}
                                accessibilityRole="button"
                                onPress={() => setIsDefectsModalOpen(true)}
                                style={({ pressed }) => [
                                    styles.addDefectsBtn,
                                    isDarkHud && styles.darkAddDefectsBtn,
                                    selectedDefectIds.length > 0 &&
                                        styles.addDefectsBtnActive,
                                    isDarkHud &&
                                        selectedDefectIds.length > 0 &&
                                        styles.darkAddDefectsBtnActive,
                                    pressed && styles.pressed,
                                ]}
                                testID="add-defects-button"
                            >
                                <Text
                                    style={[
                                        styles.addDefectsBtnText,
                                        isDarkHud &&
                                            styles.darkAddDefectsBtnText,
                                        selectedDefectIds.length > 0 &&
                                            styles.addDefectsBtnTextActive,
                                        isDarkHud &&
                                            selectedDefectIds.length > 0 &&
                                            styles.darkAddDefectsBtnTextActive,
                                    ]}
                                >
                                    {selectedDefectIds.length > 0
                                        ? `Edit defects (${selectedDefectIds.length} added)`
                                        : 'Add defects'}
                                </Text>
                            </Pressable>

                            {/* Selected Defect Tags / Chips */}
                            {selectedDefects.length > 0 ? (
                                <View style={styles.defectChipsContainer}>
                                    {selectedDefects.map((defect) => (
                                        <View
                                            key={defect.id}
                                            style={[
                                                styles.defectChip,
                                                defect.critical
                                                    ? isDarkHud
                                                        ? styles.darkDefectChipCritical
                                                        : styles.defectChipCritical
                                                    : isDarkHud
                                                      ? styles.darkDefectChipNormal
                                                      : styles.defectChipNormal,
                                            ]}
                                        >
                                            <Text
                                                numberOfLines={1}
                                                style={[
                                                    styles.defectChipText,
                                                    isDarkHud &&
                                                        styles.darkDefectChipText,
                                                ]}
                                            >
                                                {defect.label}
                                            </Text>
                                            <Pressable
                                                accessibilityLabel={`Remove defect ${defect.label}`}
                                                accessibilityRole="button"
                                                hitSlop={8}
                                                onPress={() =>
                                                    handleRemoveDefect(
                                                        defect.id,
                                                    )
                                                }
                                                style={styles.removeChipBtn}
                                            >
                                                <Icon
                                                    color={
                                                        isDarkHud
                                                            ? '#FFFFFF'
                                                            : defect.critical
                                                              ? '#991B1B'
                                                              : colors.amberDark
                                                    }
                                                    name="close"
                                                    size={12}
                                                />
                                            </Pressable>
                                        </View>
                                    ))}
                                </View>
                            ) : null}
                        </View>

                        {/* Section 4: Choose safety status (Required) */}
                        <View style={styles.formSection}>
                            <Text
                                style={[
                                    styles.formSectionTitle,
                                    isDarkHud && styles.darkFormSectionTitle,
                                ]}
                            >
                                Choose safety status
                            </Text>
                            <Text style={styles.requiredBadge}>Required</Text>

                            <View style={styles.toggleRow}>
                                <Pressable
                                    accessibilityLabel="Safe to drive"
                                    accessibilityRole="button"
                                    accessibilityState={{
                                        selected: safetyStatus === 'safe',
                                    }}
                                    onPress={() => {
                                        setSafetyStatus('safe');
                                        setIsSaved(false);
                                    }}
                                    style={[
                                        styles.toggleCard,
                                        isDarkHud && styles.darkToggleCard,
                                        safetyStatus === 'safe' &&
                                            styles.toggleCardActive,
                                        isDarkHud &&
                                            safetyStatus === 'safe' &&
                                            styles.darkToggleCardActive,
                                    ]}
                                    testID="safety-status-safe"
                                >
                                    <Text
                                        style={[
                                            styles.toggleCardText,
                                            isDarkHud &&
                                                styles.darkToggleCardText,
                                            safetyStatus === 'safe' &&
                                                styles.toggleCardTextActive,
                                            isDarkHud &&
                                                safetyStatus === 'safe' &&
                                                styles.darkToggleCardTextActive,
                                        ]}
                                    >
                                        {presentation.safetySafeLabel}
                                    </Text>
                                </Pressable>

                                <Pressable
                                    accessibilityLabel="Unsafe"
                                    accessibilityRole="button"
                                    accessibilityState={{
                                        selected: safetyStatus === 'unsafe',
                                    }}
                                    onPress={() => {
                                        setSafetyStatus('unsafe');
                                        setIsSaved(false);
                                    }}
                                    style={[
                                        styles.toggleCard,
                                        isDarkHud && styles.darkToggleCard,
                                        safetyStatus === 'unsafe' &&
                                            styles.toggleCardUnsafeActive,
                                        isDarkHud &&
                                            safetyStatus === 'unsafe' &&
                                            styles.darkToggleCardUnsafeActive,
                                    ]}
                                    testID="safety-status-unsafe"
                                >
                                    <Text
                                        style={[
                                            styles.toggleCardText,
                                            isDarkHud &&
                                                styles.darkToggleCardText,
                                            safetyStatus === 'unsafe' &&
                                                styles.toggleCardUnsafeTextActive,
                                            isDarkHud &&
                                                safetyStatus === 'unsafe' &&
                                                styles.darkToggleCardUnsafeTextActive,
                                        ]}
                                    >
                                        Unsafe
                                    </Text>
                                </Pressable>
                            </View>
                        </View>

                        {/* Critical Dispatch Lockout Warning if Unsafe */}
                        {isUnsafe ? (
                            <View
                                style={[
                                    styles.lockoutBanner,
                                    isDarkHud && styles.darkLockoutBanner,
                                ]}
                                testID="dvir-lockout-banner"
                            >
                                <Icon
                                    color={isDarkHud ? '#EF4444' : '#DC2626'}
                                    name="alert"
                                    size={20}
                                />
                                <View style={styles.lockoutCopy}>
                                    <Text
                                        style={[
                                            styles.lockoutTitle,
                                            isDarkHud &&
                                                styles.darkLockoutTitle,
                                        ]}
                                    >
                                        DISPATCH LOCKOUT ACTIVE
                                    </Text>
                                    <Text
                                        style={[
                                            styles.lockoutText,
                                            isDarkHud && styles.darkLockoutText,
                                        ]}
                                    >
                                        Vehicle marked unsafe or contains
                                        critical defects. Machine is locked from
                                        dispatch until verified by a certified
                                        mechanic.
                                    </Text>
                                </View>
                            </View>
                        ) : null}

                        {/* Inline Meters Input Row (Preserving Test Compatibility) */}
                        <View
                            style={[
                                styles.telemetryCard,
                                isDarkHud && styles.darkTelemetryCard,
                            ]}
                        >
                            <Text
                                style={[
                                    styles.telemetryHeading,
                                    isDarkHud && styles.darkTelemetryHeading,
                                ]}
                            >
                                METERS & BASELINE READINGS
                            </Text>
                            <View style={styles.inputsRow}>
                                <View style={styles.inputGroup}>
                                    <Text
                                        style={[
                                            styles.inputLabel,
                                            isDarkHud && styles.darkInputLabel,
                                        ]}
                                    >
                                        Odometer (km)
                                    </Text>
                                    <TextInput
                                        keyboardType="numeric"
                                        onChangeText={(val) => {
                                            setOdometerKm(val);
                                            setIsSaved(false);
                                        }}
                                        style={[
                                            styles.textInput,
                                            isDarkHud && styles.darkTextInput,
                                        ]}
                                        testID="input-odometer"
                                        value={odometerKm}
                                    />
                                </View>
                                <View style={styles.inputGroup}>
                                    <Text
                                        style={[
                                            styles.inputLabel,
                                            isDarkHud && styles.darkInputLabel,
                                        ]}
                                    >
                                        Engine Hours (hrs)
                                    </Text>
                                    <TextInput
                                        keyboardType="numeric"
                                        onChangeText={(val) => {
                                            setEngineHours(val);
                                            setIsSaved(false);
                                        }}
                                        style={[
                                            styles.textInput,
                                            isDarkHud && styles.darkTextInput,
                                        ]}
                                        testID="input-engine-hours"
                                        value={engineHours}
                                    />
                                </View>
                            </View>
                        </View>

                        {/* Post-Trip Specific: Parked & Secured Verification */}
                        {mode === 'post_trip' ? (
                            <View
                                style={[
                                    styles.postTripSecureCard,
                                    isDarkHud && styles.darkPostTripSecureCard,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.telemetryHeading,
                                        isDarkHud &&
                                            styles.darkTelemetryHeading,
                                    ]}
                                >
                                    PARKED & SECURED SHUTDOWN CHECKLIST
                                </Text>

                                <Pressable
                                    accessibilityRole="checkbox"
                                    onPress={() =>
                                        setParkingBrakeSet(!parkingBrakeSet)
                                    }
                                    style={[
                                        styles.secureCheckItem,
                                        isDarkHud && styles.darkSecureCheckItem,
                                    ]}
                                    testID="check-parking-brake"
                                >
                                    <Icon
                                        color={
                                            parkingBrakeSet
                                                ? isDarkHud
                                                    ? '#10B981'
                                                    : colors.green
                                                : isDarkHud
                                                  ? '#64748B'
                                                  : '#CBD5E1'
                                        }
                                        name={
                                            parkingBrakeSet
                                                ? 'check-circle'
                                                : 'alert'
                                        }
                                        size={18}
                                    />
                                    <Text
                                        style={[
                                            styles.secureCheckLabel,
                                            isDarkHud &&
                                                styles.darkSecureCheckLabel,
                                        ]}
                                    >
                                        Air brake & spring emergency brake fully
                                        engaged
                                    </Text>
                                </Pressable>

                                <Pressable
                                    accessibilityRole="checkbox"
                                    onPress={() =>
                                        setChocksDeployed(!chocksDeployed)
                                    }
                                    style={[
                                        styles.secureCheckItem,
                                        isDarkHud && styles.darkSecureCheckItem,
                                    ]}
                                    testID="check-wheel-chocks"
                                >
                                    <Icon
                                        color={
                                            chocksDeployed
                                                ? isDarkHud
                                                    ? '#10B981'
                                                    : colors.green
                                                : isDarkHud
                                                  ? '#64748B'
                                                  : '#CBD5E1'
                                        }
                                        name={
                                            chocksDeployed
                                                ? 'check-circle'
                                                : 'alert'
                                        }
                                        size={18}
                                    />
                                    <Text
                                        style={[
                                            styles.secureCheckLabel,
                                            isDarkHud &&
                                                styles.darkSecureCheckLabel,
                                        ]}
                                    >
                                        Heavy wheel chocks firmly deployed on
                                        drive axles
                                    </Text>
                                </Pressable>

                                <Pressable
                                    accessibilityRole="checkbox"
                                    onPress={() =>
                                        setOutriggersStowed(!outriggersStowed)
                                    }
                                    style={[
                                        styles.secureCheckItem,
                                        isDarkHud && styles.darkSecureCheckItem,
                                    ]}
                                    testID="check-outriggers-stowed"
                                >
                                    <Icon
                                        color={
                                            outriggersStowed
                                                ? isDarkHud
                                                    ? '#10B981'
                                                    : colors.green
                                                : isDarkHud
                                                  ? '#64748B'
                                                  : '#CBD5E1'
                                        }
                                        name={
                                            outriggersStowed
                                                ? 'check-circle'
                                                : 'alert'
                                        }
                                        size={18}
                                    />
                                    <Text
                                        style={[
                                            styles.secureCheckLabel,
                                            isDarkHud &&
                                                styles.darkSecureCheckLabel,
                                        ]}
                                    >
                                        Outrigger beams & hydraulic jacks
                                        retracted & locked
                                    </Text>
                                </Pressable>
                            </View>
                        ) : null}

                        {/* Inspector Remarks */}
                        <View
                            style={[
                                styles.telemetryCard,
                                isDarkHud && styles.darkTelemetryCard,
                            ]}
                        >
                            <Text
                                style={[
                                    styles.telemetryHeading,
                                    isDarkHud && styles.darkTelemetryHeading,
                                ]}
                            >
                                INSPECTOR SIGN-OFF REMARKS
                            </Text>
                            <TextInput
                                multiline
                                numberOfLines={3}
                                onChangeText={(val) => {
                                    setRemarks(val);
                                    setIsSaved(false);
                                }}
                                placeholder={
                                    mode === 'pre_trip'
                                        ? 'Note walkaround observation, fluid levels, tire status...'
                                        : 'Note post-operation condition, site clearance...'
                                }
                                placeholderTextColor={
                                    isDarkHud ? '#64748B' : colors.muted
                                }
                                style={[
                                    styles.remarksInput,
                                    isDarkHud && styles.darkRemarksInput,
                                ]}
                                testID="dvir-remarks-input"
                                value={remarks}
                            />
                        </View>
                    </View>
                )}
            </ScrollView>

            {/* Bottom Sticky Action Button matching screenshot */}
            {mode !== 'history' ? (
                <View
                    style={[
                        styles.footerContainer,
                        isDarkHud && styles.darkFooterContainer,
                    ]}
                >
                    <Pressable
                        accessibilityLabel="Next"
                        accessibilityRole="button"
                        onPress={handleNextOrSubmit}
                        style={({ pressed }) => [
                            styles.nextButton,
                            isDarkHud && styles.darkNextButton,
                            pressed && styles.pressed,
                        ]}
                        testID="complete-dvir-button"
                    >
                        <Text
                            style={[
                                styles.nextButtonText,
                                isDarkHud && styles.darkNextButtonText,
                            ]}
                        >
                            {isSaved ? '✓ DVIR Certified & Synced' : 'Next'}
                        </Text>
                    </Pressable>
                </View>
            ) : null}

            {/* Defects Modal (Screenshot 3) */}
            <DvirDefectsModal
                assetCode={assetCode}
                assetKind={assetKind}
                assetName={assetName}
                designatedEquipment={designatedEquipment}
                initialEquipmentFilter={designatedEquipment}
                onApplyDefects={handleApplyDefects}
                onClose={() => setIsDefectsModalOpen(false)}
                selectedDefectIds={selectedDefectIds}
                visible={isDefectsModalOpen}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    screenRoot: {
        backgroundColor: colors.background,
        flex: 1,
    },
    darkScreenRoot: {
        backgroundColor: '#090E1A',
    },
    historyToggleBadge: {
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderColor: colors.border,
        borderRadius: 8,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    darkHistoryToggleBadge: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
    },
    historyToggleBadgeActive: {
        backgroundColor: colors.amber,
        borderColor: colors.amber,
    },
    darkHistoryToggleBadgeActive: {
        backgroundColor: '#B45309',
        borderColor: '#F59E0B',
    },
    historyToggleText: {
        color: colors.amberDark,
        fontSize: 12,
        fontWeight: '700',
    },
    darkHistoryToggleText: {
        color: '#F59E0B',
    },
    historyToggleTextActive: {
        color: '#FFFFFF',
    },
    scrollView: {
        flex: 1,
    },
    contentContainer: {
        padding: 16,
        paddingBottom: 24,
    },
    formContainer: {
        gap: 20,
    },
    formSection: {
        marginBottom: 4,
    },
    formSectionTitle: {
        color: colors.text,
        fontSize: 17,
        fontWeight: '800',
        letterSpacing: 0.1,
    },
    darkFormSectionTitle: {
        color: '#FFFFFF',
    },
    requiredBadge: {
        color: '#EF4444',
        fontSize: 13,
        fontWeight: '700',
        marginBottom: 10,
        marginTop: 2,
    },
    helperNotice: {
        color: colors.textSecondary,
        fontSize: 13,
        lineHeight: 18,
        marginBottom: 12,
        marginTop: 2,
    },
    darkHelperNotice: {
        color: '#94A3B8',
    },
    toggleRow: {
        flexDirection: 'row',
        gap: 12,
    },
    toggleCard: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 10,
        borderWidth: 1.5,
        flex: 1,
        justifyContent: 'center',
        minHeight: 52,
        paddingHorizontal: 12,
    },
    darkToggleCard: {
        backgroundColor: '#101A2E',
        borderColor: '#1E3254',
    },
    toggleCardActive: {
        backgroundColor: colors.amberLight,
        borderColor: colors.amber,
        borderWidth: 2,
    },
    darkToggleCardActive: {
        backgroundColor: '#451A03',
        borderColor: '#F59E0B',
        borderWidth: 2,
    },
    toggleCardUnsafeActive: {
        backgroundColor: '#FEF2F2',
        borderColor: '#DC2626',
        borderWidth: 2,
    },
    darkToggleCardUnsafeActive: {
        backgroundColor: '#450A0A',
        borderColor: '#DC2626',
        borderWidth: 2,
    },
    toggleCardText: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '700',
    },
    darkToggleCardText: {
        color: '#CBD5E1',
    },
    toggleCardTextActive: {
        color: colors.amberDark,
        fontWeight: '800',
    },
    darkToggleCardTextActive: {
        color: '#FDE68A',
        fontWeight: '800',
    },
    toggleCardUnsafeTextActive: {
        color: '#B91C1C',
        fontWeight: '800',
    },
    darkToggleCardUnsafeTextActive: {
        color: '#F87171',
        fontWeight: '800',
    },
    addDefectsBtn: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.amber,
        borderRadius: 8,
        borderWidth: 1.5,
        justifyContent: 'center',
        minHeight: 46,
        paddingHorizontal: 16,
        width: '100%',
    },
    darkAddDefectsBtn: {
        backgroundColor: 'transparent',
        borderColor: '#F59E0B',
    },
    addDefectsBtnActive: {
        backgroundColor: colors.amberLight,
        borderColor: colors.amber,
    },
    darkAddDefectsBtnActive: {
        backgroundColor: '#451A03',
        borderColor: '#F59E0B',
    },
    addDefectsBtnText: {
        color: colors.amber,
        fontSize: 15,
        fontWeight: '800',
    },
    darkAddDefectsBtnText: {
        color: '#F59E0B',
    },
    addDefectsBtnTextActive: {
        color: colors.amberDark,
    },
    darkAddDefectsBtnTextActive: {
        color: '#FDE68A',
    },
    defectChipsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 12,
    },
    defectChip: {
        alignItems: 'center',
        borderRadius: 8,
        flexDirection: 'row',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    defectChipNormal: {
        backgroundColor: colors.amberLight,
        borderColor: colors.amberBorder,
        borderWidth: 1,
    },
    darkDefectChipNormal: {
        backgroundColor: '#2A1805',
        borderColor: '#78350F',
        borderWidth: 1,
    },
    defectChipCritical: {
        backgroundColor: '#FEE2E2',
        borderColor: '#FECACA',
        borderWidth: 1,
    },
    darkDefectChipCritical: {
        backgroundColor: '#7F1D1D',
        borderColor: '#DC2626',
        borderWidth: 1,
    },
    defectChipText: {
        color: colors.text,
        fontSize: 12,
        fontWeight: '700',
    },
    darkDefectChipText: {
        color: '#F8FAFC',
    },
    removeChipBtn: {
        padding: 2,
    },
    lockoutBanner: {
        alignItems: 'center',
        backgroundColor: '#FEF2F2',
        borderColor: '#EF4444',
        borderRadius: 12,
        borderWidth: 1.5,
        flexDirection: 'row',
        gap: 12,
        padding: 14,
    },
    darkLockoutBanner: {
        backgroundColor: '#450A0A',
        borderColor: '#DC2626',
    },
    lockoutCopy: {
        flex: 1,
    },
    lockoutTitle: {
        color: '#991B1B',
        fontSize: 13,
        fontWeight: '900',
        letterSpacing: 0.3,
    },
    darkLockoutTitle: {
        color: '#FCA5A5',
    },
    lockoutText: {
        color: '#B91C1C',
        fontSize: 12,
        lineHeight: 16,
        marginTop: 2,
    },
    darkLockoutText: {
        color: '#FECACA',
    },
    telemetryCard: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 12,
        borderWidth: 1,
        padding: 14,
    },
    darkTelemetryCard: {
        backgroundColor: '#0F1A2E',
        borderColor: '#1E293B',
    },
    telemetryHeading: {
        color: colors.textSecondary,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.5,
        marginBottom: 10,
    },
    darkTelemetryHeading: {
        color: '#94A3B8',
    },
    inputsRow: {
        flexDirection: 'row',
        gap: 12,
    },
    inputGroup: {
        flex: 1,
    },
    inputLabel: {
        color: colors.text,
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 4,
    },
    darkInputLabel: {
        color: '#CBD5E1',
    },
    textInput: {
        backgroundColor: '#F8FAFC',
        borderColor: colors.borderStrong,
        borderRadius: 8,
        borderWidth: 1,
        color: colors.text,
        fontSize: 14,
        fontWeight: '700',
        minHeight: 44,
        paddingHorizontal: 12,
    },
    darkTextInput: {
        backgroundColor: '#162238',
        borderColor: '#1E3A8A',
        color: '#FFFFFF',
    },
    remarksInput: {
        backgroundColor: '#F8FAFC',
        borderColor: colors.borderStrong,
        borderRadius: 8,
        borderWidth: 1,
        color: colors.text,
        fontSize: 13,
        minHeight: 70,
        padding: 10,
        textAlignVertical: 'top',
    },
    darkRemarksInput: {
        backgroundColor: '#162238',
        borderColor: '#1E3A8A',
        color: '#FFFFFF',
    },
    postTripSecureCard: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 12,
        borderWidth: 1,
        padding: 14,
    },
    darkPostTripSecureCard: {
        backgroundColor: '#0F1A2E',
        borderColor: '#1E293B',
    },
    secureCheckItem: {
        alignItems: 'center',
        borderBottomColor: colors.border,
        borderBottomWidth: 1,
        flexDirection: 'row',
        gap: 10,
        paddingVertical: 10,
    },
    darkSecureCheckItem: {
        borderBottomColor: '#1E293B',
    },
    secureCheckLabel: {
        color: colors.text,
        flex: 1,
        fontSize: 13,
        fontWeight: '600',
    },
    darkSecureCheckLabel: {
        color: '#E2E8F0',
    },
    summaryCard: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 12,
        borderWidth: 1,
        gap: 8,
        padding: 14,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    summaryKey: {
        color: colors.textSecondary,
        fontSize: 13,
        fontWeight: '600',
    },
    summaryValue: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '700',
    },
    summarySafe: {
        color: '#10B981',
    },
    summaryUnsafe: {
        color: '#EF4444',
    },
    certBox: {
        alignItems: 'center',
        backgroundColor: colors.amberLight,
        borderColor: colors.amberBorder,
        borderRadius: 12,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 12,
        padding: 14,
    },
    certText: {
        color: colors.amberDark,
        flex: 1,
        fontSize: 12,
        lineHeight: 17,
    },
    historyContainer: {
        gap: 16,
    },
    timelineSection: {
        gap: 8,
    },
    timelineSectionHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 2,
    },
    timelineSectionCount: {
        color: colors.textSecondary,
        fontSize: 12,
        fontWeight: '600',
    },
    darkTimelineSectionCount: {
        color: '#94A3B8',
    },
    emptyTimelineContainer: {
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 18,
    },
    emptyTimelineText: {
        color: colors.muted,
        fontSize: 13,
        lineHeight: 18,
        textAlign: 'center',
    },
    darkEmptyTimelineText: {
        color: '#64748B',
    },
    archiveToggleBtn: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
    },
    darkArchiveToggleBtn: {},
    archiveToggleText: {
        color: colors.amberDark,
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    darkArchiveToggleText: {
        color: '#F59E0B',
    },
    sectionHeading: {
        color: colors.textSecondary,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.5,
        marginBottom: 0,
    },
    darkSectionHeading: {
        color: '#94A3B8',
    },
    historyList: {
        gap: 10,
    },
    historyCard: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 12,
        borderWidth: 1,
        padding: 14,
    },
    darkHistoryCard: {
        backgroundColor: '#0F1A2E',
        borderColor: '#1E293B',
    },
    historyCardClean: {
        borderColor: '#10B981',
    },
    darkHistoryCardClean: {
        borderColor: '#059669',
    },
    historyCardDefect: {
        borderColor: '#EF4444',
    },
    darkHistoryCardDefect: {
        borderColor: '#DC2626',
    },
    historyCardHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    historyRefGroup: {
        gap: 2,
    },
    historyTypeBadge: {
        color: colors.textSecondary,
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    darkHistoryTypeBadge: {
        color: '#94A3B8',
    },
    historyId: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '800',
    },
    darkHistoryId: {
        color: '#F8FAFC',
    },
    statusIndicator: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 6,
    },
    statusDot: {
        borderRadius: 4,
        height: 7,
        width: 7,
    },
    statusDotClean: {
        backgroundColor: '#10B981',
    },
    statusDotDefect: {
        backgroundColor: '#EF4444',
    },
    statusText: {
        fontSize: 12,
        fontWeight: '700',
    },
    statusTextClean: {
        color: '#059669',
    },
    darkStatusTextClean: {
        color: '#34D399',
    },
    statusTextDefect: {
        color: '#DC2626',
    },
    darkStatusTextDefect: {
        color: '#F87171',
    },
    historyAsset: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '700',
        marginTop: 2,
    },
    darkHistoryAsset: {
        color: '#CBD5E1',
    },
    historyMeta: {
        color: colors.textSecondary,
        fontSize: 11,
        marginTop: 2,
    },
    darkHistoryMeta: {
        color: '#94A3B8',
    },
    historyRemarks: {
        color: colors.textSecondary,
        fontStyle: 'italic',
        fontSize: 12,
        marginTop: 6,
    },
    darkHistoryRemarks: {
        color: '#94A3B8',
    },
    footerContainer: {
        backgroundColor: colors.surface,
        borderTopColor: colors.border,
        borderTopWidth: 1,
        padding: 16,
    },
    darkFooterContainer: {
        backgroundColor: '#0F172A',
        borderTopColor: '#1E293B',
    },
    nextButton: {
        alignItems: 'center',
        backgroundColor: colors.amber,
        borderRadius: 10,
        justifyContent: 'center',
        minHeight: 52,
        width: '100%',
    },
    darkNextButton: {
        backgroundColor: '#F59E0B',
    },
    nextButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '800',
    },
    darkNextButtonText: {
        color: '#0F172A',
    },
    historyToggleBadgePressed: {
        opacity: 0.8,
        transform: [{ scale: 0.94 }],
    },
    pressed: {
        opacity: 0.82,
        transform: [{ scale: 0.96 }],
    },
});
