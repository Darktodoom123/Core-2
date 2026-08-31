import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../components/common/Icon';
import {
    FuelReceiptTab,
    HandoverTab,
    InspectionChecklistTab,
    MaintenanceWorkOrderTab,
    SafeReleaseTab,
} from '../components/inspection';
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
    onOpenDvir,
    onSaveInspection,
    onLogWorkOrder,
    onSafeRelease,
    onLogFuelReceipt,
    onCompleteHandover,
}) => {
    const { isDarkHud } = useTheme();
    const [activeTab, setActiveTab] = useState<
        | 'setup'
        | 'work_order'
        | 'safe_release'
        | 'fuel'
        | 'handover'
        | 'checklist'
    >('setup');

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
            {/* Top Navigation Header Bar matching DVIR */}
            <View style={[styles.headerBar, isDarkHud && styles.darkHeaderBar]}>
                {onBack ? (
                    <Pressable
                        accessibilityLabel="Close and return"
                        accessibilityRole="button"
                        onPress={onBack}
                        style={styles.closeHeaderBtn}
                    >
                        <Icon
                            color={isDarkHud ? '#94A3B8' : colors.text}
                            name="back"
                            size={22}
                        />
                    </Pressable>
                ) : null}
                <View style={styles.headerCenter}>
                    <Text
                        style={[
                            styles.pageCategory,
                            isDarkHud && styles.darkPageCategory,
                        ]}
                    >
                        VEHICLE SETUP &amp; FLEET HUB
                    </Text>
                    <Text
                        accessibilityRole="header"
                        style={[
                            styles.screenTitle,
                            isDarkHud && styles.darkScreenTitle,
                        ]}
                    >
                        {assetCode} · {assetName}
                    </Text>
                    <Text
                        style={[
                            styles.headerSubtitle,
                            isDarkHud && styles.darkHeaderSubtitle,
                        ]}
                    >
                        Assigned Operator: {technicianName}
                    </Text>
                </View>
            </View>

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
                        accessibilityLabel="Vehicle setup and telematics"
                        accessibilityRole="tab"
                        accessibilityState={{ selected: activeTab === 'setup' }}
                        onPress={() => setActiveTab('setup')}
                        style={[
                            styles.tabPill,
                            isDarkHud && styles.darkTabPill,
                            activeTab === 'setup' && styles.tabPillActive,
                            isDarkHud &&
                                activeTab === 'setup' &&
                                styles.darkTabPillActive,
                        ]}
                        testID="tab-setup-telematics"
                    >
                        <Text
                            style={[
                                styles.tabPillText,
                                isDarkHud && styles.darkTabPillText,
                                activeTab === 'setup' &&
                                    styles.tabPillTextActive,
                                isDarkHud &&
                                    activeTab === 'setup' &&
                                    styles.darkTabPillTextActive,
                            ]}
                        >
                            Setup &amp; Specs
                        </Text>
                    </Pressable>

                    <Pressable
                        accessibilityLabel="Maintenance work orders"
                        accessibilityRole="tab"
                        accessibilityState={{
                            selected: activeTab === 'work_order',
                        }}
                        onPress={() => setActiveTab('work_order')}
                        style={[
                            styles.tabPill,
                            isDarkHud && styles.darkTabPill,
                            activeTab === 'work_order' && styles.tabPillActive,
                            isDarkHud &&
                                activeTab === 'work_order' &&
                                styles.darkTabPillActive,
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
                            Work Orders ({workOrders.length})
                        </Text>
                    </Pressable>

                    <Pressable
                        accessibilityLabel="Safe release certification"
                        accessibilityRole="tab"
                        accessibilityState={{
                            selected: activeTab === 'safe_release',
                        }}
                        onPress={() => setActiveTab('safe_release')}
                        style={[
                            styles.tabPill,
                            isDarkHud && styles.darkTabPill,
                            activeTab === 'safe_release' &&
                                styles.tabPillActive,
                            isDarkHud &&
                                activeTab === 'safe_release' &&
                                styles.darkTabPillActive,
                        ]}
                        testID="tab-safe-release"
                    >
                        <Text
                            style={[
                                styles.tabPillText,
                                isDarkHud && styles.darkTabPillText,
                                activeTab === 'safe_release' &&
                                    styles.tabPillTextActive,
                                isDarkHud &&
                                    activeTab === 'safe_release' &&
                                    styles.darkTabPillTextActive,
                            ]}
                        >
                            Safe Release
                        </Text>
                    </Pressable>

                    <Pressable
                        accessibilityLabel="Fuel receipts"
                        accessibilityRole="tab"
                        accessibilityState={{ selected: activeTab === 'fuel' }}
                        onPress={() => setActiveTab('fuel')}
                        style={[
                            styles.tabPill,
                            isDarkHud && styles.darkTabPill,
                            activeTab === 'fuel' && styles.tabPillActive,
                            isDarkHud &&
                                activeTab === 'fuel' &&
                                styles.darkTabPillActive,
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
                            Fuel ({fuelLogs.length})
                        </Text>
                    </Pressable>

                    <Pressable
                        accessibilityLabel="Technician handover"
                        accessibilityRole="tab"
                        accessibilityState={{
                            selected: activeTab === 'handover',
                        }}
                        onPress={() => setActiveTab('handover')}
                        style={[
                            styles.tabPill,
                            isDarkHud && styles.darkTabPill,
                            activeTab === 'handover' && styles.tabPillActive,
                            isDarkHud &&
                                activeTab === 'handover' &&
                                styles.darkTabPillActive,
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
                accessibilityLabel="Vehicle setup, fleet telematics and maintenance workflows"
                contentContainerStyle={[
                    styles.contentContainer,
                    isDarkHud && styles.darkContentContainer,
                ]}
                style={styles.scrollView}
            >
                {/* TAB 1: Setup, Telematics & DVIR Status Card */}
                {activeTab === 'setup' ? (
                    <View style={styles.setupTabContent}>
                        {/* Primary DVIR Status Guarantee Banner */}
                        <View
                            style={[
                                styles.dvirStatusCard,
                                isDarkHud && styles.darkDvirStatusCard,
                            ]}
                            testID="dvir-unified-status-card"
                        >
                            <View style={styles.dvirCardHeader}>
                                <View style={styles.dvirBadge}>
                                    <Icon
                                        color="#10B981"
                                        name="shield-check"
                                        size={20}
                                    />
                                    <Text style={styles.dvirBadgeText}>
                                        UNIFIED DVIR ENGINE
                                    </Text>
                                </View>
                                <Text style={styles.dvirSubBadge}>
                                    Single Source of Truth
                                </Text>
                            </View>

                            <Text style={styles.dvirTitle}>
                                Pre-Trip &amp; Post-Trip Inspection Active
                            </Text>
                            <Text style={styles.dvirDescription}>
                                All vehicle and crane defects, 4-angle
                                walkaround photos, safety statuses, and
                                regulatory DOT/OSHA sign-offs are consolidated
                                in the primary DVIR module.
                            </Text>

                            {onOpenDvir ? (
                                <Pressable
                                    accessibilityLabel="Open full DVIR inspection engine"
                                    accessibilityRole="button"
                                    onPress={onOpenDvir}
                                    style={styles.openDvirBtn}
                                    testID="open-dvir-engine-btn"
                                >
                                    <Icon
                                        color="#FFFFFF"
                                        name="clipboard"
                                        size={18}
                                    />
                                    <Text style={styles.openDvirBtnText}>
                                        Open DVIR Inspection Engine
                                    </Text>
                                    <Icon
                                        color="#93C5FD"
                                        name="chevron-right"
                                        size={16}
                                    />
                                </Pressable>
                            ) : null}
                        </View>

                        {/* Telemetrics & Specs Grid */}
                        <View
                            style={[
                                styles.specsCard,
                                isDarkHud && styles.darkSpecsCard,
                            ]}
                        >
                            <Text
                                style={[
                                    styles.sectionTitle,
                                    isDarkHud && styles.darkText,
                                ]}
                            >
                                Live Telemetry &amp; Operating Specs
                            </Text>

                            <View style={styles.telemetryGrid}>
                                <View
                                    style={[
                                        styles.telemetryCell,
                                        isDarkHud && styles.darkTelemetryCell,
                                    ]}
                                >
                                    <Text style={styles.telemetryLabel}>
                                        Odometer
                                    </Text>
                                    <Text
                                        style={[
                                            styles.telemetryValue,
                                            isDarkHud && styles.darkText,
                                        ]}
                                    >
                                        42,150 km
                                    </Text>
                                </View>

                                <View
                                    style={[
                                        styles.telemetryCell,
                                        isDarkHud && styles.darkTelemetryCell,
                                    ]}
                                >
                                    <Text style={styles.telemetryLabel}>
                                        Engine Hours
                                    </Text>
                                    <Text
                                        style={[
                                            styles.telemetryValue,
                                            isDarkHud && styles.darkText,
                                        ]}
                                    >
                                        1,842.5 hrs
                                    </Text>
                                </View>

                                <View
                                    style={[
                                        styles.telemetryCell,
                                        isDarkHud && styles.darkTelemetryCell,
                                    ]}
                                >
                                    <Text style={styles.telemetryLabel}>
                                        Fuel Level
                                    </Text>
                                    <Text
                                        style={[
                                            styles.telemetryValue,
                                            styles.telemetryGreen,
                                        ]}
                                    >
                                        88% · Diesel
                                    </Text>
                                </View>

                                <View
                                    style={[
                                        styles.telemetryCell,
                                        isDarkHud && styles.darkTelemetryCell,
                                    ]}
                                >
                                    <Text style={styles.telemetryLabel}>
                                        Battery Voltage
                                    </Text>
                                    <Text
                                        style={[
                                            styles.telemetryValue,
                                            isDarkHud && styles.darkText,
                                        ]}
                                    >
                                        24.6 V (Normal)
                                    </Text>
                                </View>
                            </View>
                        </View>

                        {/* Crane Rigging & Outrigger Readiness */}
                        <View
                            style={[
                                styles.specsCard,
                                isDarkHud && styles.darkSpecsCard,
                            ]}
                        >
                            <Text
                                style={[
                                    styles.sectionTitle,
                                    isDarkHud && styles.darkText,
                                ]}
                            >
                                Crane &amp; Outrigger Configuration
                            </Text>

                            <View style={styles.configRows}>
                                <View style={styles.configRow}>
                                    <Text style={styles.configKey}>
                                        Outrigger Spread
                                    </Text>
                                    <Text
                                        style={[
                                            styles.configVal,
                                            isDarkHud && styles.darkText,
                                        ]}
                                    >
                                        100% Full Extension (Mid-Lock Engaged)
                                    </Text>
                                </View>

                                <View style={styles.configRow}>
                                    <Text style={styles.configKey}>
                                        Inclinometer Level
                                    </Text>
                                    <Text
                                        style={[
                                            styles.configVal,
                                            styles.telemetryGreen,
                                        ]}
                                    >
                                        0.0° Level (Within Safe &lt; 0.5°)
                                    </Text>
                                </View>

                                <View style={styles.configRow}>
                                    <Text style={styles.configKey}>
                                        Boom &amp; Fly Jib
                                    </Text>
                                    <Text
                                        style={[
                                            styles.configVal,
                                            isDarkHud && styles.darkText,
                                        ]}
                                    >
                                        40.0m Telescopic + 9.2m Lattice Jib
                                    </Text>
                                </View>

                                <View style={styles.configRow}>
                                    <Text style={styles.configKey}>
                                        Counterweight
                                    </Text>
                                    <Text
                                        style={[
                                            styles.configVal,
                                            isDarkHud && styles.darkText,
                                        ]}
                                    >
                                        12.5 Tonnes Full Slabs Mounted
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </View>
                ) : null}

                {/* TAB 2: Work Orders */}
                {activeTab === 'work_order' ? (
                    <MaintenanceWorkOrderTab
                        assetCode={assetCode}
                        assetName={assetName}
                        onLogWorkOrder={handleLogWorkOrder}
                        technicianName={technicianName}
                        workOrders={workOrders}
                    />
                ) : null}

                {/* TAB 3: Safe Release */}
                {activeTab === 'safe_release' ? (
                    <SafeReleaseTab
                        assetCode={assetCode}
                        assetName={assetName}
                        onSafeRelease={onSafeRelease ?? (() => {})}
                        technicianName={technicianName}
                    />
                ) : null}

                {/* TAB 4: Fuel Receipts */}
                {activeTab === 'fuel' ? (
                    <FuelReceiptTab
                        assetCode={assetCode}
                        fuelLogs={fuelLogs}
                        onLogFuelReceipt={handleLogFuel}
                    />
                ) : null}

                {/* TAB 5: Handover */}
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
        backgroundColor: '#090E1A',
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
    pageCategory: {
        color: '#F59E0B',
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 0.8,
    },
    darkPageCategory: {
        color: '#F59E0B',
    },
    screenTitle: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '800',
    },
    darkScreenTitle: {
        color: '#FFFFFF',
    },
    headerSubtitle: {
        color: '#94A3B8',
        fontSize: 12,
        fontWeight: '600',
        marginTop: 1,
    },
    darkHeaderSubtitle: {
        color: '#94A3B8',
    },
    tabBarContainer: {
        backgroundColor: '#0F172A',
        borderBottomColor: '#1E293B',
        borderBottomWidth: 1,
        paddingVertical: 8,
    },
    darkTabBarContainer: {
        backgroundColor: '#0F172A',
        borderBottomColor: '#1E293B',
    },
    tabBarScroll: {
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 16,
    },
    tabPill: {
        alignItems: 'center',
        backgroundColor: '#101A2E',
        borderColor: '#1E3254',
        borderRadius: 20,
        borderWidth: 1,
        justifyContent: 'center',
        minHeight: 36,
        paddingHorizontal: 14,
        paddingVertical: 6,
    },
    darkTabPill: {
        backgroundColor: '#101A2E',
        borderColor: '#1E3254',
    },
    tabPillActive: {
        backgroundColor: '#172554',
        borderColor: '#2563EB',
        borderWidth: 1.5,
    },
    darkTabPillActive: {
        backgroundColor: '#172554',
        borderColor: '#2563EB',
        borderWidth: 1.5,
    },
    tabPillText: {
        color: '#94A3B8',
        fontSize: 13,
        fontWeight: '700',
    },
    darkTabPillText: {
        color: '#94A3B8',
    },
    tabPillTextActive: {
        color: '#60A5FA',
        fontWeight: '800',
    },
    darkTabPillTextActive: {
        color: '#60A5FA',
        fontWeight: '800',
    },
    scrollView: {
        flex: 1,
    },
    contentContainer: {
        alignSelf: 'center',
        backgroundColor: '#090E1A',
        maxWidth: 720,
        padding: 16,
        paddingBottom: 32,
        width: '100%',
    },
    darkContentContainer: {
        backgroundColor: '#090E1A',
    },
    setupTabContent: {
        gap: 16,
    },
    dvirStatusCard: {
        backgroundColor: '#06281E',
        borderColor: '#065F46',
        borderRadius: 12,
        borderWidth: 1,
        padding: 16,
    },
    darkDvirStatusCard: {
        backgroundColor: '#06281E',
        borderColor: '#065F46',
    },
    dvirCardHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    dvirBadge: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 6,
    },
    dvirBadgeText: {
        color: '#059669',
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    dvirSubBadge: {
        color: '#6EE7B7',
        fontSize: 11,
        fontWeight: '700',
    },
    dvirTitle: {
        color: '#34D399',
        fontSize: 16,
        fontWeight: '800',
        marginBottom: 6,
    },
    dvirDescription: {
        color: '#A7F3D0',
        fontSize: 13,
        lineHeight: 18,
        marginBottom: 14,
    },
    openDvirBtn: {
        alignItems: 'center',
        backgroundColor: '#059669',
        borderRadius: 8,
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    openDvirBtnText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '800',
    },
    specsCard: {
        backgroundColor: '#0F172A',
        borderColor: '#1E293B',
        borderRadius: 12,
        borderWidth: 1,
        padding: 16,
    },
    darkSpecsCard: {
        backgroundColor: '#0F172A',
        borderColor: '#1E293B',
    },
    sectionTitle: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '800',
        marginBottom: 12,
    },
    darkText: {
        color: '#FFFFFF',
    },
    telemetryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    telemetryCell: {
        backgroundColor: '#162238',
        borderColor: '#1E3A8A',
        borderRadius: 8,
        borderWidth: 1,
        flex: 1,
        minWidth: '45%',
        padding: 12,
    },
    darkTelemetryCell: {
        backgroundColor: '#162238',
        borderColor: '#1E3A8A',
        borderWidth: 1,
    },
    telemetryLabel: {
        color: '#64748B',
        fontSize: 11,
        fontWeight: '700',
        marginBottom: 4,
    },
    telemetryValue: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '800',
    },
    telemetryGreen: {
        color: '#10B981',
    },
    configRows: {
        gap: 10,
    },
    configRow: {
        borderBottomColor: '#1E293B',
        borderBottomWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingBottom: 8,
    },
    configKey: {
        color: '#94A3B8',
        fontSize: 13,
        fontWeight: '600',
    },
    configVal: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '700',
        textAlign: 'right',
    },
});
