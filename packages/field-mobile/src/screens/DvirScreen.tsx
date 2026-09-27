import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { PhotoAttachment } from '../components/attachments/PhotoAttachmentPicker';
import { Icon } from '../components/common/Icon';
import { PreTripDefectFallbackModal } from '../components/index';
import {
    DEFECT_ANGLES,
    DefectSheet,
    DvirWalkaroundPhotos,
    findDefects,
} from '../components/inspection';
import type {
    WalkaroundAngle,
    WalkaroundPhotosMap,
} from '../components/inspection';
import { TileScreenHeader } from '../components/layout/tile-screen-header';
import { ReplacementRequestSheet } from '../components/sheets/replacement-request/replacement-request-sheet';
import type { FieldApiClient } from '../services/apiClient';
import type { CommandOutboxManager } from '../services/commandOutbox';
import { useTheme, useThemedStyles } from '../theme';
import type { ThemeColors } from '../theme';
import type { AssetAssignment, DvirInspectionRecord } from '../types/index';
import {
    getEquipmentPresentation,
    resolveDesignatedEquipmentType,
} from '../utils/equipmentClassification';
import type { DesignatedEquipmentType } from '../utils/equipmentClassification';
import { DvirAssetSelector } from './dvir/dvir-asset-selector';
import { DvirAttestation } from './dvir/dvir-attestation';
import { DvirCabPhotoCard } from './dvir/dvir-cab-photo-card';
import { DvirDefectsSection } from './dvir/dvir-defects-section';
import { DvirFooterAction } from './dvir/dvir-footer-action';
import { DvirHistoryArchive } from './dvir/dvir-history-archive';
import { DvirHistoryGroup } from './dvir/dvir-history-group';
import { DvirHistoryLoadError } from './dvir/dvir-history-load-error';
import { mapApiRecordToHistory } from './dvir/dvir-history-mapper';
import { DvirHistoryToggle } from './dvir/dvir-history-toggle';
import { DvirInspectionTypeSection } from './dvir/dvir-inspection-type-section';
import { DvirLockoutWarning } from './dvir/dvir-lockout-warning';
import { DvirMetersRow } from './dvir/dvir-meters-row';
import { dvirMissingItems } from './dvir/dvir-missing';
import { DvirNoticeBanner } from './dvir/dvir-notice-banner';
import { DvirParkedSecuredChecklist } from './dvir/dvir-parked-secured-checklist';
import { checkReadings } from './dvir/dvir-readings';
import {
    buildDvirChecks,
    buildDvirRecord,
    buildDvirSubmitPayload,
    buildWalkaroundPhotosPayload,
} from './dvir/dvir-record-builder';
import { DvirRemarksSection } from './dvir/dvir-remarks-section';
import { DvirSafetyStatusSection } from './dvir/dvir-safety-status-section';
import { createDvirSharedStyles } from './dvir/dvir-shared-styles';
import type { PostTripAnswers } from './dvir/post-trip-checks';
import {
    failedPostTripChecks,
    postTripChecksFor,
    postTripInspectionChecks,
    unansweredPostTripChecks,
} from './dvir/post-trip-checks';
import { useDvirHistory } from './dvir/use-dvir-history';

export interface DvirScreenProps {
    assetCode?: string;
    assetName?: string;
    assetKind?: string;
    equipmentType?: DesignatedEquipmentType;
    inspectorName?: string;
    activeJobReference?: string;
    initialMode?: 'pre_trip' | 'post_trip' | 'history';
    apiClient?: FieldApiClient;
    commandOutbox?: CommandOutboxManager;
    assetAssignments?: AssetAssignment[];
    selectedAssetId?: number | null;
    operationalAssetId?: number | null;
    onSelectAsset?: (assetId: number) => void;
    onBack?: () => void;
    onSaveInspectionRecord?: (record: DvirInspectionRecord) => void;
    onDefectLockout?: (assetCode: string, record: DvirInspectionRecord) => void;
    /** Asks dispatch for a replacement; the phone never switches units itself. */
    onRequestReplacement?: (note: string) => void;
    /** False when there is no job to send a replacement request with. */
    canRequestReplacement?: boolean;
    onSwitchToStandby?: () => void;
    onPreTripPassed?: (assetCode: string, record: DvirInspectionRecord) => void;
    /** Where Back goes after saving; shown on the button. */
    returnLabel?: string;
}

export const DvirScreen: React.FC<DvirScreenProps> = ({
    assetCode = '',
    assetName = '',
    assetKind,
    equipmentType,
    inspectorName = '',
    activeJobReference,
    initialMode = 'pre_trip',
    apiClient,
    commandOutbox,
    assetAssignments,
    selectedAssetId,
    operationalAssetId,
    onSelectAsset,
    onBack,
    onSaveInspectionRecord,
    onDefectLockout,
    onRequestReplacement,
    canRequestReplacement = false,
    onSwitchToStandby,
    onPreTripPassed,
    returnLabel,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const dvirSharedStyles = useThemedStyles(createDvirSharedStyles);

    const [uncontrolledAssetId, setUncontrolledAssetId] = useState<
        number | null
    >(
        assetAssignments && assetAssignments.length === 1
            ? assetAssignments[0].operational_asset_id
            : (operationalAssetId ?? null),
    );

    const [userSelectedAssetId, setUserSelectedAssetId] = useState<
        number | null
    >(null);
    const [prevPropAssetId, setPrevPropAssetId] = useState<
        number | null | undefined
    >(selectedAssetId);

    if (selectedAssetId !== prevPropAssetId) {
        setPrevPropAssetId(selectedAssetId);
        setUserSelectedAssetId(null);
    }

    const activeSelectedAssetId =
        userSelectedAssetId ??
        (selectedAssetId !== undefined && selectedAssetId !== null
            ? selectedAssetId
            : uncontrolledAssetId);

    const activeAssignment =
        assetAssignments?.find(
            (a) => a.operational_asset_id === activeSelectedAssetId,
        ) ??
        (assetAssignments && assetAssignments.length === 1
            ? assetAssignments[0]
            : null);

    const currentAssetCode = activeAssignment?.asset_code || assetCode;
    const currentAssetName = activeAssignment?.asset_name || assetName;
    const currentAssetKind = activeAssignment?.asset_kind || assetKind;
    const lastEngineHours =
        typeof activeAssignment?.engine_hours === 'number'
            ? activeAssignment.engine_hours
            : null;

    const localAssetCode = currentAssetCode;

    const isUnassigned =
        !localAssetCode ||
        localAssetCode === 'UNASSIGNED' ||
        (assetAssignments !== undefined && assetAssignments.length === 0);

    const hasUnselectedMultiAsset = Boolean(
        assetAssignments &&
        assetAssignments.length > 1 &&
        !activeSelectedAssetId,
    );

    const [defectFallbackModalOpen, setDefectFallbackModalOpen] =
        useState(false);
    const [replacementOpen, setReplacementOpen] = useState(false);
    const [replacementRequested, setReplacementRequested] = useState(false);

    const [mode, setMode] = useState<'pre_trip' | 'post_trip' | 'history'>(
        initialMode,
    );
    const [safetyStatus, setSafetyStatus] = useState<'safe' | 'unsafe'>('safe');
    const [selectedDefectIds, setSelectedDefectIds] = useState<string[]>([]);
    const [isDefectsModalOpen, setIsDefectsModalOpen] = useState(false);
    const [walkaroundPhotos, setWalkaroundPhotos] =
        useState<WalkaroundPhotosMap>({});
    // Readings start empty: the operator reads them off the unit.
    const [odometerKm, setOdometerKm] = useState('');
    const [engineHours, setEngineHours] = useState('');
    const [remarks, setRemarks] = useState('');
    const readings = checkReadings(engineHours, odometerKm, lastEngineHours);
    const [isSaved, setIsSaved] = useState(false);
    const {
        history,
        historyStatus,
        isHistoryLoading,
        olderRecords,
        past7DaysRecords,
        retryHistory,
        setHistory,
        setSyncError,
        syncError,
        todayRecords,
    } = useDvirHistory(apiClient);
    const [showOlderArchive, setShowOlderArchive] = useState(false);
    // The operator confirms the inspection; it is sent as signature_captured.
    const [attested, setAttested] = useState(false);

    const [chosenUnitType, setChosenUnitType] =
        useState<DesignatedEquipmentType | null>(null);

    const [prevTrackedAssetKey, setPrevTrackedAssetKey] = useState<
        string | null
    >(activeSelectedAssetId ? String(activeSelectedAssetId) : localAssetCode);

    // Parked-and-secured answers; every check starts unanswered.
    const [postTripAnswers, setPostTripAnswers] = useState<PostTripAnswers>({});

    const currentTrackedAssetKey = activeSelectedAssetId
        ? String(activeSelectedAssetId)
        : localAssetCode;

    if (currentTrackedAssetKey !== prevTrackedAssetKey) {
        setPrevTrackedAssetKey(currentTrackedAssetKey);
        setSelectedDefectIds([]);
        setWalkaroundPhotos({});
        setSafetyStatus('safe');
        setRemarks('');
        // Readings and the confirmation belong to the unit they were taken on.
        setEngineHours('');
        setOdometerKm('');
        setAttested(false);
        setChosenUnitType(null);
        setPostTripAnswers({});
        setIsSaved(false);
    }

    const [prevInitialMode, setPrevInitialMode] = useState(initialMode);

    if (initialMode && initialMode !== prevInitialMode) {
        setPrevInitialMode(initialMode);
        setMode(initialMode);
    }

    // Resolve designated equipment type and presentation attributes
    // The unit's type decides which defects exist. When it can't be
    // recognised the operator picks it in Add defects; nothing is guessed.
    const designatedEquipment: DesignatedEquipmentType | null = useMemo(
        () =>
            chosenUnitType ??
            resolveDesignatedEquipmentType({
                assetCode: localAssetCode,
                assetName: currentAssetName,
                assetKind: currentAssetKind,
                equipmentType,
            }),
        [
            chosenUnitType,
            localAssetCode,
            currentAssetName,
            currentAssetKind,
            equipmentType,
        ],
    );

    const presentation = useMemo(
        () => getEquipmentPresentation(designatedEquipment),
        [designatedEquipment],
    );

    // Lookup selected defects details
    const selectedDefects = useMemo(
        () => findDefects(selectedDefectIds),
        [selectedDefectIds],
    );

    // The server takes the unit out of service for any reported defect, not
    // only critical ones, so every pick counts as a lockout here too.
    const postTripChecks = useMemo(
        () => postTripChecksFor(designatedEquipment),
        [designatedEquipment],
    );
    const isPostTrip = mode === 'post_trip';
    const postTripFailed = isPostTrip
        ? failedPostTripChecks(postTripChecks, postTripAnswers)
        : [];
    const postTripUnanswered = isPostTrip
        ? unansweredPostTripChecks(postTripChecks, postTripAnswers).length
        : 0;
    // A "no" on a shutdown check is a reported defect, as on the server.
    const isUnsafe =
        safetyStatus === 'unsafe' ||
        selectedDefects.length > 0 ||
        postTripFailed.length > 0;
    const needsDefectPhotos = isUnsafe;
    // A reported problem needs words: where it is and how bad it is.
    const remarksMissing = needsDefectPhotos && remarks.trim() === '';
    // Walkaround photos are optional on pre- and post-trip; whatever is
    // taken is sent with the inspection.
    const missing = dvirMissingItems({
        readingsValid: readings.isValid,
        shutdownChecksUnanswered: postTripUnanswered,
        remarksMissing,
        attested,
    });

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

        if (defectIds.length > 0) {
            setSafetyStatus('unsafe');
        }

        setIsSaved(false);
    };

    const handleCompleteDvir = () => {
        // Construct checks list with tailored default items for equipment + selected defects
        const checksList = buildDvirChecks({
            declaredUnsafe: safetyStatus === 'unsafe',
            designatedEquipment,
            mode,
            postTripChecks: postTripInspectionChecks(
                postTripChecks,
                postTripAnswers,
            ),
            selectedDefects,
        });

        // Defect close-ups only go with an inspection that reports a defect.
        const photosPayload = buildWalkaroundPhotosPayload(
            needsDefectPhotos
                ? walkaroundPhotos
                : Object.fromEntries(
                      Object.entries(walkaroundPhotos).filter(
                          ([angle]) => !angle.startsWith('defect_'),
                      ),
                  ),
        );
        const record = buildDvirRecord({
            checksList,
            attested,
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
        });

        setHistory((prev) => [record, ...prev]);
        setIsSaved(true);
        onSaveInspectionRecord?.(record);

        const isPreTripLockout =
            (mode === 'pre_trip' || initialMode === 'pre_trip') && isUnsafe;

        if (isPreTripLockout) {
            onDefectLockout?.(localAssetCode, record);
            setDefectFallbackModalOpen(true);
        } else if (mode === 'pre_trip') {
            onPreTripPassed?.(localAssetCode, record);
        }

        const dvirPayload = buildDvirSubmitPayload({
            attested,
            currentAssetName,
            inspectorName,
            localAssetCode,
            photosPayload,
            record,
        });

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
        if (isSaved) {
            onBack?.();

            return;
        }

        if (isUnassigned || hasUnselectedMultiAsset || missing.length > 0) {
            return;
        }

        handleCompleteDvir();
    };

    return (
        <View style={styles.screenRoot} testID="dvir-screen">
            {/* Header: Unified Minimalist Header matching other tiles */}
            <TileScreenHeader
                backAccessibilityLabel="Back to dashboard"
                backTestID="dvir-back-button"
                category="Vehicle Inspection"
                onBack={onBack}
                rightElement={
                    <DvirHistoryToggle
                        historyCount={history.length}
                        isHistoryMode={mode === 'history'}
                        onToggle={() => {
                            setMode(
                                mode === 'history' ? 'pre_trip' : 'history',
                            );
                            setIsSaved(false);
                        }}
                    />
                }
                subtitle={
                    activeJobReference && activeJobReference !== 'NO-DISPATCH'
                        ? `Inspection Checklist · Ref: ${activeJobReference}`
                        : 'Inspection Checklist'
                }
                title="Create DVIR"
            />

            {/* Explicit Multi-Asset Selector Bar */}
            {assetAssignments && assetAssignments.length > 1 ? (
                <DvirAssetSelector
                    activeSelectedAssetId={activeSelectedAssetId}
                    assetAssignments={assetAssignments}
                    onSelectAsset={onSelectAsset}
                    setIsSaved={setIsSaved}
                    setUncontrolledAssetId={setUncontrolledAssetId}
                    setUserSelectedAssetId={setUserSelectedAssetId}
                />
            ) : null}
            {/* Prompt banner when multiple assets assigned but none explicitly selected */}
            {hasUnselectedMultiAsset ? (
                <DvirNoticeBanner
                    message="Multiple assets assigned. Select an asset above before completing inspection."
                    testID="dvir-no-asset-selected-banner"
                />
            ) : null}

            {/* Prompt banner when unassigned */}
            {isUnassigned ? (
                <DvirNoticeBanner
                    message="No operational equipment assigned to this shift or dispatch."
                    testID="dvir-unassigned-banner"
                />
            ) : null}

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
                                style={[dvirSharedStyles.historyMeta]}
                                testID="dvir-history-loading"
                            >
                                Loading DVIR history from server...
                            </Text>
                        )}
                        {syncError && (
                            <Text
                                style={[
                                    dvirSharedStyles.historyMeta,
                                    { color: theme.warningOrangeText },
                                ]}
                                testID="dvir-sync-warning"
                            >
                                {syncError}
                            </Text>
                        )}
                        {historyStatus === 'error' ? (
                            <DvirHistoryLoadError
                                hasLocalRecords={history.length > 0}
                                onRetry={apiClient ? retryHistory : undefined}
                            />
                        ) : null}
                        {/* Empty-window messages are only true once the server answered. */}
                        {historyStatus === 'loaded' || history.length > 0 ? (
                            <>
                                {/* Section 1: Today's Shift Inspections */}
                                <DvirHistoryGroup
                                    emptyMessage={
                                        historyStatus === 'loaded'
                                            ? 'No inspections logged today yet. Use Pre-Trip or Post-Trip above.'
                                            : null
                                    }
                                    records={todayRecords}
                                    title="TODAY'S SHIFT INSPECTIONS"
                                />
                                {/* Section 2: Past 7 Days (Compliance Window) */}
                                <DvirHistoryGroup
                                    emptyMessage={
                                        historyStatus === 'loaded'
                                            ? 'No prior inspections recorded within the past 7 days.'
                                            : null
                                    }
                                    records={past7DaysRecords}
                                    title="PAST 7 DAYS (SAFETY COMPLIANCE)"
                                />
                            </>
                        ) : null}
                        {/* Section 3: 30-Day Historical Archive */}
                        {olderRecords.length > 0 ? (
                            <DvirHistoryArchive
                                olderRecords={olderRecords}
                                setShowOlderArchive={setShowOlderArchive}
                                showOlderArchive={showOlderArchive}
                            />
                        ) : null}
                    </View>
                ) : (
                    /* Create DVIR (Exact Match to Uploaded Screenshots 1, 2 & 3) */
                    <View style={styles.formContainer}>
                        {replacementRequested ? (
                            <View
                                style={[styles.freshInspectionBanner]}
                                testID="replacement-requested-notice"
                            >
                                <Icon
                                    color={theme.textPrimary}
                                    name="clock"
                                    size={16}
                                />
                                <Text style={[styles.freshInspectionText]}>
                                    {`Replacement requested. You stay on ${localAssetCode || 'this unit'} until dispatch reassigns your job.`}
                                </Text>
                            </View>
                        ) : null}

                        {/* Section 1: Choose inspection type (Required) */}
                        <DvirInspectionTypeSection
                            mode={mode}
                            setIsSaved={setIsSaved}
                            setMode={setMode}
                        />
                        {/* Section 2: Take walkaround photos (4 angles: Driver Side, Front, Passenger Side, Back) */}
                        <DvirWalkaroundPhotos
                            onCapturePhoto={handleCapturePhoto}
                            onRemovePhoto={handleRemovePhoto}
                            photos={walkaroundPhotos}
                            requirement="optional"
                            title="Take walkaround photos"
                        />
                        <DvirCabPhotoCard
                            onCapturePhoto={handleCapturePhoto}
                            onRemovePhoto={handleRemovePhoto}
                            photo={walkaroundPhotos.cab}
                        />

                        {/* Section 3: Add new defects tailored to designated equipment */}
                        <DvirDefectsSection
                            handleRemoveDefect={handleRemoveDefect}
                            presentation={presentation}
                            selectedDefectIds={selectedDefectIds}
                            selectedDefects={selectedDefects}
                            setIsDefectsModalOpen={setIsDefectsModalOpen}
                        />
                        {needsDefectPhotos ? (
                            <DvirWalkaroundPhotos
                                angles={DEFECT_ANGLES}
                                onCapturePhoto={handleCapturePhoto}
                                onRemovePhoto={handleRemovePhoto}
                                photos={walkaroundPhotos}
                                testID="dvir-defect-photos"
                                title="Defect close-ups · up to 3"
                            />
                        ) : null}
                        {/* Section 4: Choose safety status (Required) */}
                        <DvirSafetyStatusSection
                            presentation={presentation}
                            safetyStatus={safetyStatus}
                            setIsSaved={setIsSaved}
                            setSafetyStatus={setSafetyStatus}
                        />
                        {/* Critical Dispatch Lockout Warning if Unsafe */}
                        {isUnsafe ? (
                            <DvirLockoutWarning
                                mode={mode}
                                onBack={onBack}
                                onSwitchToStandby={onSwitchToStandby}
                                onRequestReplacement={() =>
                                    setReplacementOpen(true)
                                }
                            />
                        ) : null}
                        {/* Inline Meters Input Row (Preserving Test Compatibility) */}
                        <DvirMetersRow
                            engineHours={engineHours}
                            engineHoursError={readings.engineHoursError}
                            lastEngineHours={lastEngineHours}
                            odometerError={readings.odometerError}
                            odometerKm={odometerKm}
                            setEngineHours={setEngineHours}
                            setIsSaved={setIsSaved}
                            setOdometerKm={setOdometerKm}
                        />
                        {/* Post-Trip Specific: Parked & Secured Verification */}
                        {mode === 'post_trip' ? (
                            <DvirParkedSecuredChecklist
                                answers={postTripAnswers}
                                checks={postTripChecks}
                                onAnswer={(id, answer) => {
                                    setPostTripAnswers((current) => ({
                                        ...current,
                                        [id]: answer,
                                    }));
                                    setIsSaved(false);
                                }}
                            />
                        ) : null}
                        {/* Inspector Remarks */}
                        <DvirRemarksSection
                            mode={mode}
                            remarks={remarks}
                            required={needsDefectPhotos}
                            setIsSaved={setIsSaved}
                            setRemarks={setRemarks}
                        />
                        <DvirAttestation
                            attested={attested}
                            onToggle={() => {
                                setAttested((value) => !value);
                                setIsSaved(false);
                            }}
                        />
                    </View>
                )}
            </ScrollView>

            {/* Bottom Sticky Action Button matching screenshot */}
            {mode !== 'history' ? (
                <DvirFooterAction
                    handleNextOrSubmit={handleNextOrSubmit}
                    hasUnselectedMultiAsset={hasUnselectedMultiAsset}
                    isSaved={isSaved}
                    isUnassigned={isUnassigned}
                    missing={missing}
                    returnLabel={returnLabel}
                />
            ) : null}
            {/* Defects Modal (Screenshot 3) */}
            <DefectSheet
                assetCode={localAssetCode}
                onApplyDefects={handleApplyDefects}
                onChooseUnitType={setChosenUnitType}
                onClose={() => setIsDefectsModalOpen(false)}
                selectedDefectIds={selectedDefectIds}
                unitType={designatedEquipment}
                visible={isDefectsModalOpen}
            />

            {/* Pre-Trip Safety Lockout Fallback Modal */}
            <PreTripDefectFallbackModal
                assetCode={localAssetCode}
                onClose={() => setDefectFallbackModalOpen(false)}
                onStandby={() => {
                    setDefectFallbackModalOpen(false);
                    onSwitchToStandby?.();
                    onBack?.();
                }}
                onRequestReplacement={() => {
                    setDefectFallbackModalOpen(false);
                    setReplacementOpen(true);
                }}
                visible={defectFallbackModalOpen}
            />

            <ReplacementRequestSheet
                assetCode={localAssetCode}
                canSend={canRequestReplacement}
                onClose={() => setReplacementOpen(false)}
                onSend={(note) => {
                    setReplacementRequested(true);
                    onRequestReplacement?.(note);
                }}
                visible={replacementOpen}
            />
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        screenRoot: {
            backgroundColor: theme.canvas,
            flex: 1,
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
        freshInspectionBanner: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: theme.successEmeraldLight,
            borderColor: theme.successEmerald,
            borderWidth: 1,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 10,
            marginBottom: 14,
        },
        freshInspectionText: {
            color: theme.successEmeraldText,
            fontSize: 12,
            fontWeight: '700',
            flex: 1,
        },
        historyContainer: {
            gap: 16,
        },
    });
