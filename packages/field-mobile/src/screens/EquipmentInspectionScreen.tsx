import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
    FuelReceiptTab,
    HandoverTab,
    InspectionChecklistTab,
    MaintenanceWorkOrderTab,
    SafeReleaseTab,
} from '../components/inspection';
import { colors } from '../components/nativeStyles';
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
        id: 'hyd-02',
        category: 'hydraulics',
        label: 'Hydraulic pressure & control valves',
        status: 'good',
        statusLabel: 'Pass · Normal pressure (210 bar)',
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
        id: 'elec-02',
        category: 'electrical',
        label: 'Anti-two-block (A2B) limit switch',
        status: 'good',
        statusLabel: 'Pass · Audible alarm active',
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
    {
        id: 'tire-01',
        category: 'tires_tracks',
        label: 'Tire pressures & wheel lug torque',
        status: 'good',
        statusLabel: 'Pass · 120 PSI across all axles',
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
    onSafeRelease,
    onLogFuelReceipt,
    onCompleteHandover,
}) => {
    const [activeTab, setActiveTab] = useState<
        'checklist' | 'work_order' | 'safe_release' | 'fuel' | 'handover'
    >('checklist');

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

    const goodCount = checks.filter((c) => c.status === 'good').length;

    return (
        <ScrollView
            accessibilityLabel="Technician inspection and maintenance workflows"
            contentContainerStyle={styles.container}
            testID="equipment-inspection-screen"
        >
            <View style={styles.header}>
                {onBack ? (
                    <Pressable
                        accessibilityLabel="Back to previous screen"
                        accessibilityRole="button"
                        onPress={onBack}
                        style={styles.backBtn}
                    >
                        <Text style={styles.backIcon}>‹</Text>
                        <Text style={styles.backText}>Back</Text>
                    </Pressable>
                ) : null}
                <View style={styles.headerCopy}>
                    <Text style={styles.pageCategory}>
                        FIELD TECHNICIAN WORKFLOW
                    </Text>
                    <Text accessibilityRole="header" style={styles.assetTitle}>
                        {assetCode} · {assetName}
                    </Text>
                    <Text style={styles.techSubtitle}>
                        Technician: {technicianName}
                    </Text>
                </View>
            </View>

            <View style={styles.tabBar} accessibilityRole="tablist">
                <Pressable
                    accessibilityLabel="Asset inspection checklist"
                    accessibilityRole="tab"
                    accessibilityState={{ selected: activeTab === 'checklist' }}
                    onPress={() => setActiveTab('checklist')}
                    style={[
                        styles.tabItem,
                        activeTab === 'checklist' && styles.tabItemSelected,
                    ]}
                    testID="tab-checklist"
                >
                    <Text
                        style={[
                            styles.tabText,
                            activeTab === 'checklist' && styles.tabTextSelected,
                        ]}
                    >
                        Inspection ({goodCount}/{checks.length})
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
                        styles.tabItem,
                        activeTab === 'work_order' && styles.tabItemSelected,
                    ]}
                    testID="tab-work-orders"
                >
                    <Text
                        style={[
                            styles.tabText,
                            activeTab === 'work_order' &&
                                styles.tabTextSelected,
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
                        styles.tabItem,
                        activeTab === 'safe_release' && styles.tabItemSelected,
                    ]}
                    testID="tab-safe-release"
                >
                    <Text
                        style={[
                            styles.tabText,
                            activeTab === 'safe_release' &&
                                styles.tabTextSelected,
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
                        styles.tabItem,
                        activeTab === 'fuel' && styles.tabItemSelected,
                    ]}
                    testID="tab-fuel"
                >
                    <Text
                        style={[
                            styles.tabText,
                            activeTab === 'fuel' && styles.tabTextSelected,
                        ]}
                    >
                        Fuel ({fuelLogs.length})
                    </Text>
                </Pressable>

                <Pressable
                    accessibilityLabel="Technician handover"
                    accessibilityRole="tab"
                    accessibilityState={{ selected: activeTab === 'handover' }}
                    onPress={() => setActiveTab('handover')}
                    style={[
                        styles.tabItem,
                        activeTab === 'handover' && styles.tabItemSelected,
                    ]}
                    testID="tab-handover"
                >
                    <Text
                        style={[
                            styles.tabText,
                            activeTab === 'handover' && styles.tabTextSelected,
                        ]}
                    >
                        Handover
                    </Text>
                </Pressable>
            </View>

            {activeTab === 'checklist' ? (
                <InspectionChecklistTab
                    checks={checks}
                    isSaved={isSaved}
                    onSaveInspection={handleSaveInspection}
                    onToggleCheck={handleToggleCheck}
                />
            ) : null}

            {activeTab === 'work_order' ? (
                <MaintenanceWorkOrderTab
                    assetCode={assetCode}
                    assetName={assetName}
                    onLogWorkOrder={handleLogWorkOrder}
                    technicianName={technicianName}
                    workOrders={workOrders}
                />
            ) : null}

            {activeTab === 'safe_release' ? (
                <SafeReleaseTab
                    assetCode={assetCode}
                    assetName={assetName}
                    onSafeRelease={onSafeRelease ?? (() => {})}
                    technicianName={technicianName}
                />
            ) : null}

            {activeTab === 'fuel' ? (
                <FuelReceiptTab
                    assetCode={assetCode}
                    fuelLogs={fuelLogs}
                    onLogFuelReceipt={handleLogFuel}
                />
            ) : null}

            {activeTab === 'handover' ? (
                <HandoverTab
                    assetCode={assetCode}
                    onCompleteHandover={onCompleteHandover ?? (() => {})}
                    technicianName={technicianName}
                />
            ) : null}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        alignSelf: 'center',
        maxWidth: 720,
        padding: 16,
        paddingBottom: 32,
        width: '100%',
    },
    header: {
        marginBottom: 16,
    },
    backBtn: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 4,
        marginBottom: 8,
        minHeight: 48,
        minWidth: 72,
    },
    backIcon: {
        color: colors.text,
        fontSize: 26,
        fontWeight: '300',
    },
    backText: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '700',
    },
    headerCopy: {
        gap: 2,
    },
    pageCategory: {
        color: colors.amberDark,
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 0.8,
    },
    assetTitle: {
        color: colors.text,
        fontSize: 22,
        fontWeight: '800',
    },
    techSubtitle: {
        color: colors.secondary,
        fontSize: 13,
        fontWeight: '600',
    },
    tabBar: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 10,
        borderWidth: 1,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
        marginBottom: 16,
        padding: 4,
    },
    tabItem: {
        alignItems: 'center',
        borderRadius: 8,
        justifyContent: 'center',
        minHeight: 48,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    tabItemSelected: {
        backgroundColor: colors.amberSoft,
    },
    tabText: {
        color: colors.secondary,
        fontSize: 12,
        fontWeight: '700',
    },
    tabTextSelected: {
        color: colors.amberDark,
        fontWeight: '900',
    },
});
