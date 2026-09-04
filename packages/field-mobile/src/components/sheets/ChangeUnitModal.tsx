import React, { useState } from 'react';
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useTheme } from '../../theme';
import { Icon } from '../common/Icon';
import { shadows } from '../nativeStyles';

export interface ChangeUnitModalProps {
    visible: boolean;
    currentAssetCode?: string;
    availableUnits?: Array<{ code: string; name: string; capacity: string }>;
    onConfirmUnitChange: (newUnitCode: string, reason: string) => void;
    onClose: () => void;
}

const DEFAULT_UNITS = [
    {
        code: 'CRN-102',
        name: 'Liebherr LTM 1100-5.2',
        capacity: '100T All-Terrain',
    },
    { code: 'CRN-103', name: 'Tadano GR-800XL', capacity: '80T Rough Terrain' },
    {
        code: 'CRN-201',
        name: 'Kobelco CK2750G',
        capacity: '250T Crawler Crane',
    },
    {
        code: 'TRK-202',
        name: 'Volvo FH16 Prime Mover',
        capacity: '60T Heavy Hauler',
    },
];

export const ChangeUnitModal: React.FC<ChangeUnitModalProps> = ({
    visible,
    currentAssetCode = 'CRN-101',
    availableUnits = DEFAULT_UNITS,
    onConfirmUnitChange,
    onClose,
}) => {
    const { isDarkHud } = useTheme();
    const [selectedUnit, setSelectedUnit] = useState<string>('');
    const [reason, setReason] = useState<string>(
        'Site supervisor reallocated unit due to mechanical readiness',
    );

    const handleConfirm = () => {
        if (!selectedUnit) {
            return;
        }

        onConfirmUnitChange(selectedUnit, reason);
        onClose();
    };

    return (
        <Modal
            animationType="slide"
            onRequestClose={onClose}
            transparent
            visible={visible}
        >
            <View style={styles.overlay} testID="change-unit-modal">
                <View style={[styles.dialog, isDarkHud && styles.darkDialog]}>
                    <View style={styles.headerRow}>
                        <View style={styles.titleWrap}>
                            <Text
                                style={[
                                    styles.title,
                                    isDarkHud && styles.darkTitle,
                                ]}
                            >
                                Override Assigned Equipment
                            </Text>
                            <Text
                                style={[
                                    styles.subtitle,
                                    isDarkHud && styles.darkSubtitle,
                                ]}
                            >
                                Currently assigned: {currentAssetCode}
                            </Text>
                        </View>
                        <Pressable
                            accessibilityLabel="Close dialog"
                            accessibilityRole="button"
                            onPress={onClose}
                            style={styles.closeBtn}
                        >
                            <Icon
                                color={isDarkHud ? '#94A3B8' : '#64748B'}
                                name="chevron-right"
                                size={20}
                            />
                        </Pressable>
                    </View>

                    <Text style={[styles.prompt, isDarkHud && styles.darkText]}>
                        Select the physical machinery present on site:
                    </Text>

                    <ScrollView style={styles.unitList}>
                        {availableUnits.map((unit) => {
                            const isSelected = selectedUnit === unit.code;

                            return (
                                <Pressable
                                    key={unit.code}
                                    accessibilityLabel={`Select unit ${unit.code}`}
                                    accessibilityRole="button"
                                    onPress={() => setSelectedUnit(unit.code)}
                                    style={[
                                        styles.unitOption,
                                        isDarkHud && styles.darkUnitOption,
                                        isSelected && styles.selectedOption,
                                        isSelected &&
                                            isDarkHud &&
                                            styles.darkSelectedOption,
                                    ]}
                                    testID={`unit-option-${unit.code}`}
                                >
                                    <View style={styles.optionHeader}>
                                        <Text
                                            style={[
                                                styles.unitCode,
                                                isSelected &&
                                                    styles.selectedCode,
                                            ]}
                                        >
                                            {unit.code}
                                        </Text>
                                        <Text
                                            style={[
                                                styles.unitCapacity,
                                                isDarkHud &&
                                                    styles.darkSubtitle,
                                            ]}
                                        >
                                            {unit.capacity}
                                        </Text>
                                    </View>
                                    <Text
                                        style={[
                                            styles.unitName,
                                            isDarkHud && styles.darkText,
                                        ]}
                                    >
                                        {unit.name}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </ScrollView>

                    <Text
                        style={[
                            styles.inputLabel,
                            isDarkHud && styles.darkSubtitle,
                        ]}
                    >
                        Reason for substitution (alert sent to dispatch):
                    </Text>
                    <TextInput
                        multiline
                        numberOfLines={2}
                        onChangeText={setReason}
                        style={[
                            styles.reasonInput,
                            isDarkHud && styles.darkReasonInput,
                        ]}
                        testID="change-unit-reason-input"
                        value={reason}
                    />

                    <View style={styles.actionRow}>
                        <Pressable
                            accessibilityLabel="Cancel unit override"
                            accessibilityRole="button"
                            onPress={onClose}
                            style={[
                                styles.cancelBtn,
                                isDarkHud && styles.darkCancelBtn,
                            ]}
                        >
                            <Text
                                style={[
                                    styles.cancelText,
                                    isDarkHud && styles.darkSubtitle,
                                ]}
                            >
                                Cancel
                            </Text>
                        </Pressable>
                        <Pressable
                            accessibilityLabel="Confirm unit override"
                            accessibilityRole="button"
                            disabled={!selectedUnit}
                            onPress={handleConfirm}
                            style={[
                                styles.confirmBtn,
                                !selectedUnit && styles.disabledBtn,
                            ]}
                            testID="confirm-change-unit-btn"
                        >
                            <Text style={styles.confirmText}>
                                Confirm Override
                            </Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.65)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    dialog: {
        width: '100%',
        maxWidth: 420,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 24,
        maxHeight: '85%',
        ...shadows.lg,
    },
    darkDialog: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
        borderWidth: 1,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 14,
    },
    titleWrap: {
        flex: 1,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0F172A',
    },
    darkTitle: {
        color: '#F8FAFC',
    },
    subtitle: {
        fontSize: 13,
        color: '#64748B',
        marginTop: 2,
    },
    darkSubtitle: {
        color: '#94A3B8',
    },
    closeBtn: {
        padding: 6,
    },
    prompt: {
        fontSize: 14,
        fontWeight: '600',
        color: '#334155',
        marginBottom: 10,
    },
    darkText: {
        color: '#F8FAFC',
    },
    unitList: {
        maxHeight: 220,
        marginBottom: 14,
    },
    unitOption: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
    },
    darkUnitOption: {
        backgroundColor: '#0F172A',
        borderColor: '#334155',
    },
    selectedOption: {
        borderColor: '#2563EB',
        backgroundColor: '#EFF6FF',
    },
    darkSelectedOption: {
        borderColor: '#60A5FA',
        backgroundColor: '#1E3A8A',
    },
    optionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    unitCode: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1E293B',
    },
    selectedCode: {
        color: '#2563EB',
    },
    unitCapacity: {
        fontSize: 12,
        color: '#64748B',
    },
    unitName: {
        fontSize: 13,
        color: '#475569',
    },
    inputLabel: {
        fontSize: 12,
        color: '#64748B',
        marginBottom: 6,
    },
    reasonInput: {
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 8,
        padding: 10,
        fontSize: 13,
        color: '#0F172A',
        backgroundColor: '#F8FAFC',
        marginBottom: 16,
    },
    darkReasonInput: {
        borderColor: '#475569',
        backgroundColor: '#0F172A',
        color: '#F8FAFC',
    },
    actionRow: {
        flexDirection: 'row',
        gap: 12,
    },
    cancelBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#CBD5E1',
        alignItems: 'center',
    },
    darkCancelBtn: {
        borderColor: '#475569',
    },
    cancelText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#475569',
    },
    confirmBtn: {
        flex: 1.4,
        paddingVertical: 12,
        borderRadius: 10,
        backgroundColor: '#2563EB',
        alignItems: 'center',
    },
    disabledBtn: {
        backgroundColor: '#94A3B8',
        opacity: 0.6,
    },
    confirmText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});
