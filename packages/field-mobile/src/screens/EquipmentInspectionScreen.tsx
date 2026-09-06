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
    onSaveInspection?: (checks: TechnicianInspectionCheck[]) => void;
    onLogWorkOrder?: (workOrder: MaintenanceWorkOrder) => void;
    onSafeRelease?: (verification: SafeReleaseVerification) => void;
    onLogFuelReceipt?: (fuelLog: FuelReceiptLog) => void;
    onCompleteHandover?: (handover: TechnicianHandover) => void;
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
    onBack,
    onSaveInspection,
    onLogWorkOrder,
    onLogFuelReceipt,
    onCompleteHandover,
}) => {
    const { isDarkHud } = useTheme();
    const [activeTab, setActiveTab] = useState<
        'work_order' | 'fuel' | 'handover' | 'checklist'
    >('work_order');

    const [checks, setChecks] =
        useState<TechnicianInspectionCheck[]>(INITIAL_CHECKS);
    const [isSaved, setIsSaved] = useState(false);
    const [workOrders, setWorkOrders] = useState<MaintenanceWorkOrder[]>([
        {
            id: 'WO-8041',
            assetCode,
            assetName,
            defectTitle: 'Boom slider wear pad adjustment',
            description:
                'Routine tensioning of boom section #2 nylon wear pad.',
            severity: 'minor',
            status: 'repaired',
            reportedBy: technicianName,
            createdAt: new Date().toISOString(),
        },
    ]);
    const [fuelLogs, setFuelLogs] = useState<FuelReceiptLog[]>([
        {
            id: 'FL-301',
            assetCode,
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
        setIsSaved(true);
        onSaveInspection?.(checks);
    };

    const handleLogWorkOrder = (wo: MaintenanceWorkOrder) => {
        setWorkOrders((prev) => [wo, ...prev]);
        onLogWorkOrder?.(wo);
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
                title={`${assetCode} · ${assetName}`}
            />

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
                        assetCode={assetCode}
                        assetName={assetName}
                        onLogWorkOrder={handleLogWorkOrder}
                        technicianName={technicianName}
                        workOrders={workOrders}
                    />
                ) : null}

                {/* TAB 2: Fuel Receipts */}
                {activeTab === 'fuel' ? (
                    <FuelReceiptTab
                        assetCode={assetCode}
                        fuelLogs={fuelLogs}
                        onLogFuelReceipt={handleLogFuel}
                    />
                ) : null}

                {/* TAB 4: Handover */}
                {activeTab === 'handover' ? (
                    <HandoverTab
                        assetCode={assetCode}
                        onCompleteHandover={onCompleteHandover ?? (() => {})}
                        technicianName={technicianName}
                    />
                ) : null}

                {/* Backwards compatibility fallback if checklist tab selected */}
                {activeTab === 'checklist' ? (
                    <InspectionChecklistTab
                        checks={checks}
                        isSaved={isSaved}
                        onSaveInspection={handleSaveInspection}
                        onToggleCheck={handleToggleCheck}
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
});
