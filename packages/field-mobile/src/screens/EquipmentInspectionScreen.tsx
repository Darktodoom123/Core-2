import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
    FuelReceiptTab,
    HandoverTab,
    InspectionChecklistTab,
    MaintenanceWorkOrderTab,
} from '../components/inspection';
import { TileScreenHeader } from '../components/layout/tile-screen-header';
import { colors } from '../components/nativeStyles';
import { useTheme } from '../theme';
import type {
    AssetAssignment,
    FuelReceiptLog,
    MaintenanceWorkOrder,
    SafeReleaseVerification,
    TechnicianHandover,
    TechnicianInspectionCheck,
} from '../types/index';

export interface EquipmentInspectionScreenProps {
    assetCode?: string;
    assetName?: string;
    technicianName?: string;
    onBack?: () => void;
    onOpenDvir?: () => void;
    onOpenFuel?: () => void;
    onSaveInspection?: (
        checks: TechnicianInspectionCheck[],
        assetId?: number,
        workOrderId?: string,
    ) => void;
    onLogWorkOrder?: (
        workOrder: MaintenanceWorkOrder,
        assetId?: number,
    ) => void;
    onSafeRelease?: (verification: SafeReleaseVerification) => void;
    onLogFuelReceipt?: (fuelLog: FuelReceiptLog) => void;
    onCompleteHandover?: (handover: TechnicianHandover) => void;
    assetAssignments?: AssetAssignment[];
    selectedAssetId?: number | null;
    onSelectAsset?: (assetId: number) => void;
}

const INITIAL_CHECKS: TechnicianInspectionCheck[] = [
    {
        id: 'hyd-01',
        category: 'hydraulics',
        label: 'Hydraulic cylinders & outrigger rams',
        status: 'good',
        statusLabel: 'Pass · No leaks',
        icon: '',
    },
    {
        id: 'elec-01',
        category: 'electrical',
        label: 'Load Moment Indicator (LMI) & sensors',
        status: 'good',
        statusLabel: 'Pass · Calibrated',
        icon: '',
    },
    {
        id: 'struct-01',
        category: 'structural',
        label: 'Telescopic boom sections & wear pads',
        status: 'good',
        statusLabel: 'Pass · Smooth extension',
        icon: '',
    },
    {
        id: 'rope-01',
        category: 'structural',
        label: 'Hoist wire rope & main hook block',
        status: 'good',
        statusLabel: 'Pass · Safety latch intact',
        icon: '',
    },
];

export const EquipmentInspectionScreen: React.FC<
    EquipmentInspectionScreenProps
> = ({
    assetCode = 'CRN-07',
    assetName = '50-Ton Mobile All-Terrain Crane',
    technicianName = 'Alex Rivera (Certified Crane Technician)',
    assetAssignments,
    selectedAssetId,
    onSelectAsset,
    onBack,
    onOpenDvir,
    onSaveInspection,
    onLogWorkOrder,
    onLogFuelReceipt,
    onOpenFuel,
    onCompleteHandover,
}) => {
    const { isDarkHud } = useTheme();
    const [activeTab, setActiveTab] = useState<
        'work_order' | 'fuel' | 'handover' | 'checklist'
    >('work_order');

    const [uncontrolledAssetId, setUncontrolledAssetId] = useState<
        number | null
    >(
        assetAssignments && assetAssignments.length === 1
            ? assetAssignments[0].operational_asset_id
            : null,
    );

    const activeSelectedAssetId =
        selectedAssetId !== undefined && selectedAssetId !== null
            ? selectedAssetId
            : uncontrolledAssetId;

    const activeAssignment =
        assetAssignments?.find(
            (a) => a.operational_asset_id === activeSelectedAssetId,
        ) ??
        (assetAssignments && assetAssignments.length === 1
            ? assetAssignments[0]
            : null);

    const currentAssetCode = activeAssignment?.asset_code || assetCode;
    const currentAssetName = activeAssignment?.asset_name || assetName;
    const displayTitle = activeAssignment
        ? `${currentAssetCode} · ${currentAssetName}`
        : assetAssignments && assetAssignments.length > 1
          ? 'Select Assigned Equipment'
          : `${currentAssetCode} · ${currentAssetName}`;

    const [checks, setChecks] =
        useState<TechnicianInspectionCheck[]>(INITIAL_CHECKS);
    const [isSaved, setIsSaved] = useState(false);
    const [workOrders, setWorkOrders] = useState<MaintenanceWorkOrder[]>([
        {
            id: 'WO-8041',
            assetCode: currentAssetCode,
            assetName: currentAssetName,
            defectTitle: 'Boom slider wear pad adjustment',
            description:
                'Routine tensioning of boom section #2 nylon wear pad.',
            severity: 'minor',
            status: 'repaired',
            reportedBy: technicianName,
            createdAt: new Date().toISOString(),
        },
    ]);
    const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<
        string | null
    >(() => workOrders.find((wo) => wo.status === 'repaired')?.id ?? null);
    const [verifiedWorkOrderIds, setVerifiedWorkOrderIds] = useState<string[]>(
        [],
    );
    const [fuelLogs, setFuelLogs] = useState<FuelReceiptLog[]>([
        {
            id: 'FL-301',
            assetCode: currentAssetCode,
            quantityLiters: 140,
            fuelCost: 285.5,
            odometerKm: 42150,
            engineHours: 1840,
            receiptNumber: 'RCPT-PETRO-9921',
            vendorName: 'Apex Commercial Fuel Station',
            loggedAt: new Date().toISOString(),
        },
    ]);

    const handleToggleCheck = (id: string) => {
        setChecks((prev) =>
            prev.map((item) => {
                if (item.id !== id) {
                    return item;
                }

                if (item.status === 'good') {
                    return {
                        ...item,
                        status: 'attention',
                        statusLabel: 'Needs attention · Minor wear',
                    };
                } else if (item.status === 'attention') {
                    return {
                        ...item,
                        status: 'critical',
                        statusLabel: 'Critical Defect · Block dispatch',
                    };
                } else {
                    return {
                        ...item,
                        status: 'good',
                        statusLabel: 'Pass · Operational',
                    };
                }
            }),
        );
        setIsSaved(false);
    };

    const handleSaveInspection = () => {
        if (
            assetAssignments &&
            assetAssignments.length > 1 &&
            !activeSelectedAssetId
        ) {
            return;
        }

        const eligibleWorkOrder =
            workOrders.find(
                (wo) =>
                    wo.id === selectedWorkOrderId && wo.status === 'repaired',
            ) ?? workOrders.find((wo) => wo.status === 'repaired');

        if (!eligibleWorkOrder) {
            return;
        }

        setIsSaved(true);
        setVerifiedWorkOrderIds((prev) =>
            prev.includes(eligibleWorkOrder.id)
                ? prev
                : [...prev, eligibleWorkOrder.id],
        );
        onSaveInspection?.(
            checks,
            activeSelectedAssetId ?? undefined,
            eligibleWorkOrder.id,
        );
    };

    const handleLogWorkOrder = (wo: MaintenanceWorkOrder) => {
        if (
            assetAssignments &&
            assetAssignments.length > 1 &&
            !activeSelectedAssetId
        ) {
            return;
        }

        const orderWithAsset: MaintenanceWorkOrder = {
            ...wo,
            assetCode: currentAssetCode,
            assetName: currentAssetName,
        };
        setWorkOrders((prev) => [orderWithAsset, ...prev]);
        onLogWorkOrder?.(orderWithAsset, activeSelectedAssetId ?? undefined);
    };

    const handleLogFuel = (log: FuelReceiptLog) => {
        setFuelLogs((prev) => [log, ...prev]);
        onLogFuelReceipt?.(log);
    };

    return (
        <View
            style={[styles.screenRoot, isDarkHud && styles.darkScreenRoot]}
            testID="equipment-inspection-screen"
        >
            {/* Top Navigation Header Bar matching DVIR & other tiles */}
            <TileScreenHeader
                backAccessibilityLabel="Back to dashboard"
                backTestID="equipment-back-button"
                category="Vehicle Maintenance"
                onBack={onBack}
                subtitle={`Assigned Operator: ${technicianName}`}
                title={displayTitle}
            />

            {/* Explicit Multi-Asset Selector Bar */}
            {assetAssignments && assetAssignments.length > 1 ? (
                <View
                    accessibilityLabel="Select assigned equipment"
                    accessibilityRole="radiogroup"
                    style={[
                        styles.assetSelectorContainer,
                        isDarkHud && styles.darkAssetSelectorContainer,
                    ]}
                    testID="equipment-asset-selector"
                >
                    <Text
                        style={[
                            styles.assetSelectorLabel,
                            isDarkHud && styles.darkAssetSelectorLabel,
                        ]}
                    >
                        Assigned Equipment:
                    </Text>
                    <ScrollView
                        contentContainerStyle={styles.assetSelectorScroll}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                    >
                        {assetAssignments.map((assignment) => {
                            const isSelected =
                                assignment.operational_asset_id ===
                                activeSelectedAssetId;

                            return (
                                <Pressable
                                    key={assignment.operational_asset_id}
                                    accessibilityLabel={`Select ${assignment.asset_code} ${assignment.asset_name}`}
                                    accessibilityRole="radio"
                                    accessibilityState={{
                                        selected: isSelected,
                                    }}
                                    onPress={() => {
                                        setUncontrolledAssetId(
                                            assignment.operational_asset_id,
                                        );
                                        onSelectAsset?.(
                                            assignment.operational_asset_id,
                                        );
                                    }}
                                    style={({ pressed }) => [
                                        styles.assetPill,
                                        isDarkHud && styles.darkAssetPill,
                                        isSelected && styles.assetPillActive,
                                        isDarkHud &&
                                            isSelected &&
                                            styles.darkAssetPillActive,
                                        pressed && styles.pressed,
                                    ]}
                                    testID={`select-asset-${assignment.operational_asset_id}`}
                                >
                                    <Text
                                        style={[
                                            styles.assetPillCode,
                                            isDarkHud &&
                                                styles.darkAssetPillCode,
                                            isSelected &&
                                                styles.assetPillCodeActive,
                                            isDarkHud &&
                                                isSelected &&
                                                styles.darkAssetPillCodeActive,
                                        ]}
                                    >
                                        {assignment.asset_code}
                                    </Text>
                                    <Text
                                        numberOfLines={1}
                                        style={[
                                            styles.assetPillName,
                                            isDarkHud &&
                                                styles.darkAssetPillName,
                                            isSelected &&
                                                styles.assetPillNameActive,
                                            isDarkHud &&
                                                isSelected &&
                                                styles.darkAssetPillNameActive,
                                        ]}
                                    >
                                        {assignment.asset_name}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </ScrollView>
                </View>
            ) : null}

            {/* Prompt banner when multiple assets assigned but none explicitly selected */}
            {assetAssignments &&
            assetAssignments.length > 1 &&
            !activeSelectedAssetId ? (
                <View
                    accessibilityRole="alert"
                    style={[
                        styles.noAssetBanner,
                        isDarkHud && styles.darkNoAssetBanner,
                    ]}
                    testID="no-asset-selected-banner"
                >
                    <Text
                        style={[
                            styles.noAssetBannerText,
                            isDarkHud && styles.darkNoAssetBannerText,
                        ]}
                    >
                        Multiple assets assigned. Select an asset above to
                        inspect or log work orders.
                    </Text>
                </View>
            ) : null}

            {/* Navigation Tabs Bar matching DVIR Segment Filter */}
            <View
                accessibilityRole="tablist"
                style={[
                    styles.tabBarContainer,
                    isDarkHud && styles.darkTabBarContainer,
                ]}
            >
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.tabBarScroll}
                >
                    <Pressable
                        accessibilityLabel="Maintenance work orders"
                        accessibilityRole="tab"
                        accessibilityState={{
                            selected: activeTab === 'work_order',
                        }}
                        onPress={() => setActiveTab('work_order')}
                        style={({ pressed }) => [
                            styles.tabPill,
                            isDarkHud && styles.darkTabPill,
                            activeTab === 'work_order' && styles.tabPillActive,
                            isDarkHud &&
                                activeTab === 'work_order' &&
                                styles.darkTabPillActive,
                            pressed && styles.pressed,
                        ]}
                        testID="tab-work-orders"
                    >
                        <Text
                            style={[
                                styles.tabPillText,
                                isDarkHud && styles.darkTabPillText,
                                activeTab === 'work_order' &&
                                    styles.tabPillTextActive,
                                isDarkHud &&
                                    activeTab === 'work_order' &&
                                    styles.darkTabPillTextActive,
                            ]}
                        >
                            Work Orders
                        </Text>
                        <View
                            style={[
                                styles.countBadge,
                                isDarkHud && styles.darkCountBadge,
                                activeTab === 'work_order' &&
                                    styles.countBadgeActive,
                                isDarkHud &&
                                    activeTab === 'work_order' &&
                                    styles.darkCountBadgeActive,
                            ]}
                        >
                            <Text
                                style={[
                                    styles.countBadgeText,
                                    isDarkHud && styles.darkCountBadgeText,
                                    activeTab === 'work_order' &&
                                        styles.countBadgeTextActive,
                                    isDarkHud &&
                                        activeTab === 'work_order' &&
                                        styles.darkCountBadgeTextActive,
                                ]}
                            >
                                {workOrders.length}
                            </Text>
                        </View>
                    </Pressable>

                    <Pressable
                        accessibilityLabel="Fuel receipts"
                        accessibilityRole="tab"
                        accessibilityState={{ selected: activeTab === 'fuel' }}
                        onPress={() => setActiveTab('fuel')}
                        style={({ pressed }) => [
                            styles.tabPill,
                            isDarkHud && styles.darkTabPill,
                            activeTab === 'fuel' && styles.tabPillActive,
                            isDarkHud &&
                                activeTab === 'fuel' &&
                                styles.darkTabPillActive,
                            pressed && styles.pressed,
                        ]}
                        testID="tab-fuel"
                    >
                        <Text
                            style={[
                                styles.tabPillText,
                                isDarkHud && styles.darkTabPillText,
                                activeTab === 'fuel' &&
                                    styles.tabPillTextActive,
                                isDarkHud &&
                                    activeTab === 'fuel' &&
                                    styles.darkTabPillTextActive,
                            ]}
                        >
                            Fuel
                        </Text>
                        <View
                            style={[
                                styles.countBadge,
                                isDarkHud && styles.darkCountBadge,
                                activeTab === 'fuel' && styles.countBadgeActive,
                                isDarkHud &&
                                    activeTab === 'fuel' &&
                                    styles.darkCountBadgeActive,
                            ]}
                        >
                            <Text
                                style={[
                                    styles.countBadgeText,
                                    isDarkHud && styles.darkCountBadgeText,
                                    activeTab === 'fuel' &&
                                        styles.countBadgeTextActive,
                                    isDarkHud &&
                                        activeTab === 'fuel' &&
                                        styles.darkCountBadgeTextActive,
                                ]}
                            >
                                {fuelLogs.length}
                            </Text>
                        </View>
                    </Pressable>

                    <Pressable
                        accessibilityLabel="Technician handover"
                        accessibilityRole="tab"
                        accessibilityState={{
                            selected: activeTab === 'handover',
                        }}
                        onPress={() => setActiveTab('handover')}
                        style={({ pressed }) => [
                            styles.tabPill,
                            isDarkHud && styles.darkTabPill,
                            activeTab === 'handover' && styles.tabPillActive,
                            isDarkHud &&
                                activeTab === 'handover' &&
                                styles.darkTabPillActive,
                            pressed && styles.pressed,
                        ]}
                        testID="tab-handover"
                    >
                        <Text
                            style={[
                                styles.tabPillText,
                                isDarkHud && styles.darkTabPillText,
                                activeTab === 'handover' &&
                                    styles.tabPillTextActive,
                                isDarkHud &&
                                    activeTab === 'handover' &&
                                    styles.darkTabPillTextActive,
                            ]}
                        >
                            Handover
                        </Text>
                    </Pressable>

                    <Pressable
                        accessibilityLabel="Post-repair inspection checklist"
                        accessibilityRole="tab"
                        accessibilityState={{
                            selected: activeTab === 'checklist',
                        }}
                        onPress={() => setActiveTab('checklist')}
                        style={({ pressed }) => [
                            styles.tabPill,
                            isDarkHud && styles.darkTabPill,
                            activeTab === 'checklist' && styles.tabPillActive,
                            isDarkHud &&
                                activeTab === 'checklist' &&
                                styles.darkTabPillActive,
                            pressed && styles.pressed,
                        ]}
                        testID="tab-checklist"
                    >
                        <Text
                            style={[
                                styles.tabPillText,
                                isDarkHud && styles.darkTabPillText,
                                activeTab === 'checklist' &&
                                    styles.tabPillTextActive,
                                isDarkHud &&
                                    activeTab === 'checklist' &&
                                    styles.darkTabPillTextActive,
                            ]}
                        >
                            Post-Repair
                        </Text>
                    </Pressable>
                </ScrollView>
            </View>

            {/* Scrollable Content Container matching DVIR Form */}
            <ScrollView
                accessibilityLabel="Vehicle maintenance and fleet workflows"
                contentContainerStyle={[
                    styles.contentContainer,
                    isDarkHud && styles.darkContentContainer,
                ]}
                style={styles.scrollView}
            >
                {/* TAB 1: Work Orders */}
                {activeTab === 'work_order' ? (
                    <MaintenanceWorkOrderTab
                        assetCode={currentAssetCode}
                        assetName={currentAssetName}
                        onLogWorkOrder={handleLogWorkOrder}
                        onOpenDvir={onOpenDvir}
                        onStartPostRepair={(woId: string) => {
                            setSelectedWorkOrderId(woId);
                            setActiveTab('checklist');
                        }}
                        technicianName={technicianName}
                        verifiedWorkOrderIds={verifiedWorkOrderIds}
                        workOrders={workOrders}
                    />
                ) : null}

                {/* TAB 2: Fuel Receipts */}
                {activeTab === 'fuel' ? (
                    <View style={{ gap: 12 }}>
                        {onOpenFuel ? (
                            <View
                                style={{
                                    paddingHorizontal: 16,
                                    paddingTop: 12,
                                }}
                            >
                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel="Open Fuel Management"
                                    onPress={onOpenFuel}
                                    style={{
                                        minHeight: 44,
                                        paddingHorizontal: 14,
                                        paddingVertical: 10,
                                        borderRadius: 8,
                                        backgroundColor: colors.amberDark,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <Text
                                        style={{
                                            color: colors.white,
                                            fontWeight: '700',
                                        }}
                                    >
                                        Open Full Fuel Management Module
                                    </Text>
                                </Pressable>
                            </View>
                        ) : null}
                        <FuelReceiptTab
                            assetCode={currentAssetCode}
                            fuelLogs={fuelLogs}
                            onLogFuelReceipt={handleLogFuel}
                        />
                    </View>
                ) : null}

                {/* TAB 4: Handover */}
                {activeTab === 'handover' ? (
                    <HandoverTab
                        assetCode={currentAssetCode}
                        onCompleteHandover={onCompleteHandover ?? (() => {})}
                        technicianName={technicianName}
                    />
                ) : null}

                {/* Dedicated Post-Repair Verification tab */}
                {activeTab === 'checklist' ? (
                    <InspectionChecklistTab
                        availableWorkOrders={workOrders}
                        checks={checks}
                        isSaved={isSaved}
                        onBackToWorkOrders={() => setActiveTab('work_order')}
                        onOpenDvir={onOpenDvir}
                        onSaveInspection={handleSaveInspection}
                        onSelectWorkOrder={(woId) =>
                            setSelectedWorkOrderId(woId)
                        }
                        onToggleCheck={handleToggleCheck}
                        selectedWorkOrder={
                            workOrders.find(
                                (wo) => wo.id === selectedWorkOrderId,
                            ) ?? null
                        }
                    />
                ) : null}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    screenRoot: {
        backgroundColor: colors.background,
        flex: 1,
    },
    darkScreenRoot: {
        backgroundColor: colors.hudBackground,
    },
    tabBarContainer: {
        backgroundColor: colors.surface,
        borderBottomColor: colors.border,
        borderBottomWidth: 1,
        paddingVertical: 8,
    },
    darkTabBarContainer: {
        backgroundColor: colors.hudSurface,
        borderBottomColor: colors.hudBorder,
    },
    tabBarScroll: {
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 16,
    },
    tabPill: {
        alignItems: 'center',
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 20,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 6,
        justifyContent: 'center',
        minHeight: 38,
        paddingHorizontal: 14,
        paddingVertical: 6,
    },
    darkTabPill: {
        backgroundColor: colors.surfaceDark,
        borderColor: colors.hudBorder,
    },
    tabPillActive: {
        backgroundColor: colors.amber,
        borderColor: colors.amber,
    },
    darkTabPillActive: {
        backgroundColor: colors.hudAmber,
        borderColor: colors.hudAmber,
    },
    tabPillText: {
        color: colors.muted,
        fontSize: 13,
        fontWeight: '700',
    },
    darkTabPillText: {
        color: colors.hudTextDim,
    },
    tabPillTextActive: {
        color: '#FFFFFF',
        fontWeight: '800',
    },
    darkTabPillTextActive: {
        color: colors.surfaceDark,
        fontWeight: '800',
    },
    countBadge: {
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.08)',
        borderRadius: 10,
        justifyContent: 'center',
        minWidth: 18,
        paddingHorizontal: 6,
        paddingVertical: 1,
    },
    darkCountBadge: {
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
    },
    countBadgeActive: {
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
    },
    darkCountBadgeActive: {
        backgroundColor: 'rgba(15, 23, 42, 0.25)',
    },
    countBadgeText: {
        color: colors.muted,
        fontSize: 11,
        fontWeight: '800',
    },
    darkCountBadgeText: {
        color: colors.hudTextDim,
    },
    countBadgeTextActive: {
        color: '#FFFFFF',
        fontWeight: '800',
    },
    darkCountBadgeTextActive: {
        color: colors.surfaceDark,
        fontWeight: '800',
    },
    scrollView: {
        flex: 1,
    },
    contentContainer: {
        alignSelf: 'center',
        maxWidth: 720,
        padding: 16,
        paddingBottom: 36,
        width: '100%',
    },
    darkContentContainer: {
        backgroundColor: colors.hudBackground,
    },
    pressed: {
        opacity: 0.82,
        transform: [{ scale: 0.96 }],
    },
    assetSelectorContainer: {
        backgroundColor: colors.surface,
        borderBottomColor: colors.border,
        borderBottomWidth: 1,
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    darkAssetSelectorContainer: {
        backgroundColor: colors.hudSurface,
        borderBottomColor: colors.hudBorder,
    },
    assetSelectorLabel: {
        color: colors.muted,
        fontSize: 12,
        fontWeight: '700',
        marginBottom: 8,
        textTransform: 'uppercase',
    },
    darkAssetSelectorLabel: {
        color: colors.hudTextDim,
    },
    assetSelectorScroll: {
        flexDirection: 'row',
        gap: 8,
    },
    assetPill: {
        alignItems: 'center',
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 8,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 6,
        minHeight: 36,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    darkAssetPill: {
        backgroundColor: colors.surfaceDark,
        borderColor: colors.hudBorder,
    },
    assetPillActive: {
        backgroundColor: colors.amberDark,
        borderColor: colors.amberDark,
    },
    darkAssetPillActive: {
        backgroundColor: colors.hudAmber,
        borderColor: colors.hudAmber,
    },
    assetPillCode: {
        color: colors.primary,
        fontSize: 13,
        fontWeight: '800',
    },
    darkAssetPillCode: {
        color: colors.hudText,
    },
    assetPillCodeActive: {
        color: '#FFFFFF',
    },
    darkAssetPillCodeActive: {
        color: colors.surfaceDark,
    },
    assetPillName: {
        color: colors.muted,
        fontSize: 12,
        fontWeight: '500',
        maxWidth: 160,
    },
    darkAssetPillName: {
        color: colors.hudTextDim,
    },
    assetPillNameActive: {
        color: '#FFFFFF',
    },
    darkAssetPillNameActive: {
        color: colors.surfaceDark,
    },
    noAssetBanner: {
        backgroundColor: '#FEF3C7',
        borderColor: '#F59E0B',
        borderRadius: 8,
        borderWidth: 1,
        marginHorizontal: 16,
        marginTop: 10,
        padding: 12,
    },
    darkNoAssetBanner: {
        backgroundColor: '#78350F',
        borderColor: '#D97706',
    },
    noAssetBannerText: {
        color: '#92400E',
        fontSize: 13,
        fontWeight: '600',
        textAlign: 'center',
    },
    darkNoAssetBannerText: {
        color: '#FEF3C7',
    },
});
