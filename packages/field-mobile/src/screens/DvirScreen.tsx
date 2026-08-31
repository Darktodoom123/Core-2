import React, { useMemo, useState } from 'react';
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
    WalkaroundAngle,
    WalkaroundPhotosMap,
} from '../components/inspection';
import { colors } from '../components/nativeStyles';
import { useTheme } from '../theme';
import type {
    DvirInspectionRecord,
    TechnicianInspectionCheck,
} from '../types/index';

export interface DvirScreenProps {
    assetCode?: string;
    assetName?: string;
    inspectorName?: string;
    activeJobReference?: string;
    initialMode?: 'pre_trip' | 'post_trip' | 'history';
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

const INITIAL_HISTORY: DvirInspectionRecord[] = [
    {
        id: 'DVIR-2026-0830-01',
        type: 'pre_trip',
        assetCode: 'ALB-CRN-050',
        assetName: '50T Tadano All-Terrain Crane',
        inspectorName: 'Alex Rivera (Certified Operator)',
        startingOdometerKm: 42120,
        engineHours: 1836,
        hasDefects: false,
        criticalDefectsCount: 0,
        checks: DEFAULT_CHECKS,
        signatureCaptured: true,
        remarks: 'Morning pre-shift inspection passed with zero defects.',
        completedAt: new Date(Date.now() - 86400000).toISOString(),
    },
    {
        id: 'DVIR-2026-0829-02',
        type: 'post_trip',
        assetCode: 'ALB-CRN-050',
        assetName: '50T Tadano All-Terrain Crane',
        inspectorName: 'Alex Rivera (Certified Operator)',
        endingOdometerKm: 42100,
        engineHours: 1830,
        hasDefects: false,
        criticalDefectsCount: 0,
        checks: DEFAULT_CHECKS,
        signatureCaptured: true,
        remarks: 'Post-job walkaround clean. Asset parked and secured.',
        completedAt: new Date(Date.now() - 172800000).toISOString(),
    },
];

export const DvirScreen: React.FC<DvirScreenProps> = ({
    assetCode = 'ALB-CRN-050',
    assetName = '50T Tadano All-Terrain Crane',
    inspectorName = 'Alex Rivera (Certified Crane Operator)',
    activeJobReference = 'DISP-2026-0891',
    initialMode = 'pre_trip',
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

    // Post-Trip Specific State
    const [chocksDeployed, setChocksDeployed] = useState(true);
    const [parkingBrakeSet, setParkingBrakeSet] = useState(true);
    const [outriggersStowed, setOutriggersStowed] = useState(true);

    // Determine default crane equipment filter
    const initialEquipmentFilter = useMemo(() => {
        const combined = `${assetCode} ${assetName}`.toLowerCase();

        if (
            combined.includes('tower') ||
            combined.includes('twr') ||
            combined.includes('potain') ||
            combined.includes('wolff')
        ) {
            return 'tower_crane' as const;
        }

        if (
            combined.includes('crane') ||
            combined.includes('crn') ||
            combined.includes('tadano') ||
            combined.includes('all-terrain') ||
            combined.includes('crawler')
        ) {
            return 'mobile_crane' as const;
        }

        return 'all' as const;
    }, [assetCode, assetName]);

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
        // Construct checks list with default items + selected defects
        const checksList: TechnicianInspectionCheck[] = [
            ...DEFAULT_CHECKS.map((chk) => ({ ...chk })),
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

        setHistory((prev) => [record, ...prev]);
        setIsSaved(true);
        onSaveInspectionRecord?.(record);
    };

    const handleNextOrSubmit = () => {
        handleCompleteDvir();
    };

    return (
        <View
            style={[styles.screenRoot, isDarkHud && styles.darkScreenRoot]}
            testID="dvir-screen"
        >
            {/* Header matching screenshot */}
            <View style={[styles.headerBar, isDarkHud && styles.darkHeaderBar]}>
                <Pressable
                    accessibilityLabel="Back or dismiss"
                    accessibilityRole="button"
                    onPress={() => {
                        if (onBack) {
                            onBack();
                        }
                    }}
                    style={styles.closeHeaderBtn}
                    testID="dvir-back-button"
                >
                    <Icon
                        color={isDarkHud ? '#F8FAFC' : colors.text}
                        name="close"
                        size={22}
                    />
                </Pressable>

                <View style={styles.headerCenter}>
                    <Text
                        style={[
                            styles.screenTitle,
                            isDarkHud && styles.darkScreenTitle,
                        ]}
                    >
                        Create DVIR
                    </Text>
                    <Text
                        style={[
                            styles.headerSubtitle,
                            isDarkHud && styles.darkHeaderSubtitle,
                        ]}
                    >
                        DVIR Inspection Engine
                    </Text>
                    {activeJobReference ? (
                        <Text style={styles.jobRefSubtext}>
                            Ref: {activeJobReference}
                        </Text>
                    ) : null}
                </View>

                {/* History Switcher / Job Ref Pill */}
                <Pressable
                    accessibilityLabel="Toggle history"
                    accessibilityRole="button"
                    onPress={() => {
                        setMode(mode === 'history' ? 'pre_trip' : 'history');
                        setIsSaved(false);
                    }}
                    style={[
                        styles.historyToggleBadge,
                        mode === 'history' && styles.historyToggleBadgeActive,
                    ]}
                    testID="tab-history"
                >
                    <Icon
                        color={mode === 'history' ? '#FFFFFF' : '#38BDF8'}
                        name="file-text"
                        size={14}
                    />
                    <Text
                        style={[
                            styles.historyToggleText,
                            mode === 'history' &&
                                styles.historyToggleTextActive,
                        ]}
                    >
                        {mode === 'history'
                            ? 'Form'
                            : `History (${history.length})`}
                    </Text>
                </Pressable>
            </View>

            {/* Main Content Area */}
            <ScrollView
                contentContainerStyle={styles.contentContainer}
                keyboardShouldPersistTaps="handled"
                style={styles.scrollView}
            >
                {mode === 'history' ? (
                    /* Past DVIR Records History View */
                    <View style={styles.historyContainer}>
                        <Text
                            style={[
                                styles.sectionHeading,
                                isDarkHud && styles.darkSectionHeading,
                            ]}
                        >
                            PAST DVIR INSPECTION RECORDS
                        </Text>
                        <View style={styles.historyList}>
                            {history.map((item) => (
                                <View
                                    key={item.id}
                                    style={[
                                        styles.historyCard,
                                        isDarkHud && styles.darkHistoryCard,
                                        item.criticalDefectsCount > 0 ||
                                        item.hasDefects
                                            ? styles.historyCardDefect
                                            : styles.historyCardClean,
                                    ]}
                                    testID={`history-card-${item.id}`}
                                >
                                    <View style={styles.historyCardHeader}>
                                        <View style={styles.historyRefGroup}>
                                            <Text
                                                style={styles.historyTypeBadge}
                                            >
                                                {item.type === 'pre_trip'
                                                    ? 'PRE-TRIP GAUNTLET'
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
                                            style={[
                                                styles.statusPill,
                                                item.hasDefects
                                                    ? styles.statusPillDefect
                                                    : styles.statusPillClean,
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.statusPillText,
                                                    item.hasDefects
                                                        ? styles.statusTextDefect
                                                        : styles.statusTextClean,
                                                ]}
                                            >
                                                {item.hasDefects
                                                    ? `${item.criticalDefectsCount > 0 ? item.criticalDefectsCount : 'Defects'} Logged`
                                                    : '✓ Clean Pass'}
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
                                        {item.assetCode} · {item.assetName}
                                    </Text>
                                    <Text style={styles.historyMeta}>
                                        Inspector: {item.inspectorName}
                                    </Text>
                                    <Text style={styles.historyMeta}>
                                        Logged:{' '}
                                        {new Date(
                                            item.completedAt,
                                        ).toLocaleString()}
                                    </Text>
                                    {item.remarks ? (
                                        <Text style={styles.historyRemarks}>
                                            "{item.remarks}"
                                        </Text>
                                    ) : null}
                                </View>
                            ))}
                        </View>
                    </View>
                ) : (
                    /* Create DVIR (Exact Match to Uploaded Screenshots 1, 2 & 3) */
                    <View style={styles.formContainer}>
                        {/* Section 1: Choose inspection type (Required) */}
                        <View style={styles.formSection}>
                            <Text style={styles.formSectionTitle}>
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
                                        mode === 'pre_trip' &&
                                            styles.toggleCardActive,
                                    ]}
                                    testID="tab-pre-trip"
                                >
                                    <Text
                                        style={[
                                            styles.toggleCardText,
                                            mode === 'pre_trip' &&
                                                styles.toggleCardTextActive,
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
                                        mode === 'post_trip' &&
                                            styles.toggleCardActive,
                                    ]}
                                    testID="tab-post-trip"
                                >
                                    <Text
                                        style={[
                                            styles.toggleCardText,
                                            mode === 'post_trip' &&
                                                styles.toggleCardTextActive,
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

                        {/* Section 3: Add new vehicle defects */}
                        <View style={styles.formSection}>
                            <Text style={styles.formSectionTitle}>
                                Add new vehicle defects
                            </Text>
                            <Text style={styles.helperNotice}>
                                Any vehicle attributes not displayed are
                                certified safe by the driver
                            </Text>

                            <Pressable
                                accessibilityLabel="Add vehicle defects"
                                accessibilityRole="button"
                                onPress={() => setIsDefectsModalOpen(true)}
                                style={({ pressed }) => [
                                    styles.addDefectsBtn,
                                    selectedDefectIds.length > 0 &&
                                        styles.addDefectsBtnActive,
                                    pressed && styles.pressed,
                                ]}
                                testID="add-defects-button"
                            >
                                <Text
                                    style={[
                                        styles.addDefectsBtnText,
                                        selectedDefectIds.length > 0 &&
                                            styles.addDefectsBtnTextActive,
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
                                                    ? styles.defectChipCritical
                                                    : styles.defectChipNormal,
                                            ]}
                                        >
                                            <Text
                                                numberOfLines={1}
                                                style={styles.defectChipText}
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
                                                    color="#FFFFFF"
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
                            <Text style={styles.formSectionTitle}>
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
                                        safetyStatus === 'safe' &&
                                            styles.toggleCardActive,
                                    ]}
                                    testID="safety-status-safe"
                                >
                                    <Text
                                        style={[
                                            styles.toggleCardText,
                                            safetyStatus === 'safe' &&
                                                styles.toggleCardTextActive,
                                        ]}
                                    >
                                        Safe to drive
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
                                        safetyStatus === 'unsafe' &&
                                            styles.toggleCardUnsafeActive,
                                    ]}
                                    testID="safety-status-unsafe"
                                >
                                    <Text
                                        style={[
                                            styles.toggleCardText,
                                            safetyStatus === 'unsafe' &&
                                                styles.toggleCardUnsafeTextActive,
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
                                style={styles.lockoutBanner}
                                testID="dvir-lockout-banner"
                            >
                                <Icon color="#EF4444" name="alert" size={20} />
                                <View style={styles.lockoutCopy}>
                                    <Text style={styles.lockoutTitle}>
                                        DISPATCH LOCKOUT ACTIVE
                                    </Text>
                                    <Text style={styles.lockoutText}>
                                        Vehicle marked unsafe or contains
                                        critical defects. Machine is locked from
                                        dispatch until verified by a certified
                                        mechanic.
                                    </Text>
                                </View>
                            </View>
                        ) : null}

                        {/* Inline Meters Input Row (Preserving Test Compatibility) */}
                        <View style={styles.telemetryCard}>
                            <Text style={styles.telemetryHeading}>
                                METERS & BASELINE READINGS
                            </Text>
                            <View style={styles.inputsRow}>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>
                                        Odometer (km)
                                    </Text>
                                    <TextInput
                                        keyboardType="numeric"
                                        onChangeText={(val) => {
                                            setOdometerKm(val);
                                            setIsSaved(false);
                                        }}
                                        style={styles.textInput}
                                        testID="input-odometer"
                                        value={odometerKm}
                                    />
                                </View>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>
                                        Engine Hours (hrs)
                                    </Text>
                                    <TextInput
                                        keyboardType="numeric"
                                        onChangeText={(val) => {
                                            setEngineHours(val);
                                            setIsSaved(false);
                                        }}
                                        style={styles.textInput}
                                        testID="input-engine-hours"
                                        value={engineHours}
                                    />
                                </View>
                            </View>
                        </View>

                        {/* Post-Trip Specific: Parked & Secured Verification */}
                        {mode === 'post_trip' ? (
                            <View style={styles.postTripSecureCard}>
                                <Text style={styles.telemetryHeading}>
                                    PARKED & SECURED SHUTDOWN CHECKLIST
                                </Text>

                                <Pressable
                                    accessibilityRole="checkbox"
                                    onPress={() =>
                                        setParkingBrakeSet(!parkingBrakeSet)
                                    }
                                    style={styles.secureCheckItem}
                                    testID="check-parking-brake"
                                >
                                    <Icon
                                        color={
                                            parkingBrakeSet
                                                ? '#10B981'
                                                : '#94A3B8'
                                        }
                                        name={
                                            parkingBrakeSet
                                                ? 'check-circle'
                                                : 'alert'
                                        }
                                        size={18}
                                    />
                                    <Text style={styles.secureCheckLabel}>
                                        Air brake & spring emergency brake fully
                                        engaged
                                    </Text>
                                </Pressable>

                                <Pressable
                                    accessibilityRole="checkbox"
                                    onPress={() =>
                                        setChocksDeployed(!chocksDeployed)
                                    }
                                    style={styles.secureCheckItem}
                                    testID="check-wheel-chocks"
                                >
                                    <Icon
                                        color={
                                            chocksDeployed
                                                ? '#10B981'
                                                : '#94A3B8'
                                        }
                                        name={
                                            chocksDeployed
                                                ? 'check-circle'
                                                : 'alert'
                                        }
                                        size={18}
                                    />
                                    <Text style={styles.secureCheckLabel}>
                                        Heavy wheel chocks firmly deployed on
                                        drive axles
                                    </Text>
                                </Pressable>

                                <Pressable
                                    accessibilityRole="checkbox"
                                    onPress={() =>
                                        setOutriggersStowed(!outriggersStowed)
                                    }
                                    style={styles.secureCheckItem}
                                    testID="check-outriggers-stowed"
                                >
                                    <Icon
                                        color={
                                            outriggersStowed
                                                ? '#10B981'
                                                : '#94A3B8'
                                        }
                                        name={
                                            outriggersStowed
                                                ? 'check-circle'
                                                : 'alert'
                                        }
                                        size={18}
                                    />
                                    <Text style={styles.secureCheckLabel}>
                                        Outrigger beams & hydraulic jacks
                                        retracted & locked
                                    </Text>
                                </Pressable>
                            </View>
                        ) : null}

                        {/* Inspector Remarks */}
                        <View style={styles.telemetryCard}>
                            <Text style={styles.telemetryHeading}>
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
                                placeholderTextColor="#64748B"
                                style={styles.remarksInput}
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
                            pressed && styles.pressed,
                        ]}
                        testID="complete-dvir-button"
                    >
                        <Text style={styles.nextButtonText}>
                            {isSaved ? '✓ DVIR Certified & Synced' : 'Next'}
                        </Text>
                    </Pressable>
                </View>
            ) : null}

            {/* Defects Modal (Screenshot 3) */}
            <DvirDefectsModal
                initialEquipmentFilter={initialEquipmentFilter}
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
        backgroundColor: '#090E1A', // Deep navy black
        flex: 1,
    },
    darkScreenRoot: {
        backgroundColor: '#090E1A',
    },
    headerBar: {
        alignItems: 'center',
        backgroundColor: '#0F172A',
        borderBottomColor: '#1E293B',
        borderBottomWidth: 1,
        flexDirection: 'row',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    darkHeaderBar: {
        backgroundColor: '#0F172A',
        borderBottomColor: '#1E293B',
    },
    closeHeaderBtn: {
        alignItems: 'center',
        height: 38,
        justifyContent: 'center',
        width: 38,
    },
    headerCenter: {
        flex: 1,
    },
    screenTitle: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '800',
    },
    darkScreenTitle: {
        color: '#F8FAFC',
    },
    headerSubtitle: {
        color: '#94A3B8',
        fontSize: 11,
        marginTop: 1,
    },
    darkHeaderSubtitle: {
        color: '#94A3B8',
    },
    jobRefSubtext: {
        color: '#64748B',
        fontSize: 10,
        fontWeight: '500',
    },
    historyToggleBadge: {
        alignItems: 'center',
        backgroundColor: '#1E293B',
        borderColor: '#334155',
        borderRadius: 8,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    historyToggleBadgeActive: {
        backgroundColor: '#0284C7',
        borderColor: '#38BDF8',
    },
    historyToggleText: {
        color: '#38BDF8',
        fontSize: 12,
        fontWeight: '700',
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
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '800',
        letterSpacing: 0.1,
    },
    requiredBadge: {
        color: '#EF4444',
        fontSize: 13,
        fontWeight: '700',
        marginBottom: 10,
        marginTop: 2,
    },
    helperNotice: {
        color: '#94A3B8',
        fontSize: 13,
        lineHeight: 18,
        marginBottom: 12,
        marginTop: 2,
    },
    toggleRow: {
        flexDirection: 'row',
        gap: 12,
    },
    toggleCard: {
        alignItems: 'center',
        backgroundColor: '#101A2E',
        borderColor: '#1E3254',
        borderRadius: 10,
        borderWidth: 1.5,
        flex: 1,
        justifyContent: 'center',
        minHeight: 52,
        paddingHorizontal: 12,
    },
    toggleCardActive: {
        backgroundColor: '#172554',
        borderColor: '#2563EB',
        borderWidth: 2,
    },
    toggleCardUnsafeActive: {
        backgroundColor: '#450A0A',
        borderColor: '#DC2626',
        borderWidth: 2,
    },
    toggleCardText: {
        color: '#CBD5E1',
        fontSize: 15,
        fontWeight: '700',
    },
    toggleCardTextActive: {
        color: '#60A5FA',
        fontWeight: '800',
    },
    toggleCardUnsafeTextActive: {
        color: '#F87171',
        fontWeight: '800',
    },
    addDefectsBtn: {
        alignItems: 'center',
        backgroundColor: 'transparent',
        borderColor: '#2563EB',
        borderRadius: 8,
        borderWidth: 1.5,
        justifyContent: 'center',
        minHeight: 46,
        paddingHorizontal: 16,
        width: '100%',
    },
    addDefectsBtnActive: {
        backgroundColor: '#1E293B',
        borderColor: '#38BDF8',
    },
    addDefectsBtnText: {
        color: '#38BDF8',
        fontSize: 15,
        fontWeight: '800',
    },
    addDefectsBtnTextActive: {
        color: '#38BDF8',
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
        backgroundColor: '#1E293B',
        borderColor: '#334155',
        borderWidth: 1,
    },
    defectChipCritical: {
        backgroundColor: '#7F1D1D',
        borderColor: '#DC2626',
        borderWidth: 1,
    },
    defectChipText: {
        color: '#F8FAFC',
        fontSize: 12,
        fontWeight: '700',
    },
    removeChipBtn: {
        padding: 2,
    },
    lockoutBanner: {
        alignItems: 'center',
        backgroundColor: '#450A0A',
        borderColor: '#DC2626',
        borderRadius: 12,
        borderWidth: 1.5,
        flexDirection: 'row',
        gap: 12,
        padding: 14,
    },
    lockoutCopy: {
        flex: 1,
    },
    lockoutTitle: {
        color: '#FCA5A5',
        fontSize: 13,
        fontWeight: '900',
        letterSpacing: 0.3,
    },
    lockoutText: {
        color: '#FECACA',
        fontSize: 12,
        lineHeight: 16,
        marginTop: 2,
    },
    telemetryCard: {
        backgroundColor: '#0F1A2E',
        borderColor: '#1E293B',
        borderRadius: 12,
        borderWidth: 1,
        padding: 14,
    },
    telemetryHeading: {
        color: '#94A3B8',
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.5,
        marginBottom: 10,
    },
    inputsRow: {
        flexDirection: 'row',
        gap: 12,
    },
    inputGroup: {
        flex: 1,
    },
    inputLabel: {
        color: '#CBD5E1',
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 4,
    },
    textInput: {
        backgroundColor: '#162238',
        borderColor: '#1E3A8A',
        borderRadius: 8,
        borderWidth: 1,
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
        minHeight: 44,
        paddingHorizontal: 12,
    },
    remarksInput: {
        backgroundColor: '#162238',
        borderColor: '#1E3A8A',
        borderRadius: 8,
        borderWidth: 1,
        color: '#FFFFFF',
        fontSize: 13,
        minHeight: 70,
        padding: 10,
        textAlignVertical: 'top',
    },
    postTripSecureCard: {
        backgroundColor: '#0F1A2E',
        borderColor: '#1E293B',
        borderRadius: 12,
        borderWidth: 1,
        padding: 14,
    },
    secureCheckItem: {
        alignItems: 'center',
        borderBottomColor: '#1E293B',
        borderBottomWidth: 1,
        flexDirection: 'row',
        gap: 10,
        paddingVertical: 10,
    },
    secureCheckLabel: {
        color: '#E2E8F0',
        flex: 1,
        fontSize: 13,
        fontWeight: '600',
    },
    summaryCard: {
        backgroundColor: '#0F1A2E',
        borderColor: '#1E293B',
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
        color: '#94A3B8',
        fontSize: 13,
        fontWeight: '600',
    },
    summaryValue: {
        color: '#F8FAFC',
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
        backgroundColor: '#0F2744',
        borderColor: '#0284C7',
        borderRadius: 12,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 12,
        padding: 14,
    },
    certText: {
        color: '#BAE6FD',
        flex: 1,
        fontSize: 12,
        lineHeight: 17,
    },
    historyContainer: {
        gap: 10,
    },
    sectionHeading: {
        color: '#94A3B8',
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.5,
        marginBottom: 10,
    },
    darkSectionHeading: {
        color: '#94A3B8',
    },
    historyList: {
        gap: 10,
    },
    historyCard: {
        backgroundColor: '#0F1A2E',
        borderRadius: 12,
        borderWidth: 1,
        padding: 14,
    },
    darkHistoryCard: {
        backgroundColor: '#0F1A2E',
        borderColor: '#1E293B',
    },
    historyCardClean: {
        borderColor: '#059669',
    },
    historyCardDefect: {
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
        color: '#94A3B8',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    historyId: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '800',
    },
    darkHistoryId: {
        color: '#F8FAFC',
    },
    statusPill: {
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    statusPillClean: {
        backgroundColor: '#064E3B',
    },
    statusPillDefect: {
        backgroundColor: '#7F1D1D',
    },
    statusPillText: {
        fontSize: 11,
        fontWeight: '800',
    },
    statusTextClean: {
        color: '#6EE7B7',
    },
    statusTextDefect: {
        color: '#FCA5A5',
    },
    historyAsset: {
        color: '#E2E8F0',
        fontSize: 13,
        fontWeight: '700',
        marginTop: 2,
    },
    darkHistoryAsset: {
        color: '#CBD5E1',
    },
    historyMeta: {
        color: '#94A3B8',
        fontSize: 11,
        marginTop: 2,
    },
    historyRemarks: {
        color: '#94A3B8',
        fontStyle: 'italic',
        fontSize: 12,
        marginTop: 6,
    },
    footerContainer: {
        backgroundColor: '#0F172A',
        borderTopColor: '#1E293B',
        borderTopWidth: 1,
        padding: 16,
    },
    darkFooterContainer: {
        backgroundColor: '#0F172A',
    },
    nextButton: {
        alignItems: 'center',
        backgroundColor: '#2563EB',
        borderRadius: 10,
        justifyContent: 'center',
        minHeight: 52,
        width: '100%',
    },
    nextButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '800',
    },
    pressed: {
        opacity: 0.8,
        transform: [{ scale: 0.985 }],
    },
});
