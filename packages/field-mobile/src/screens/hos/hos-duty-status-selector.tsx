import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import type { DutyStatus } from '../../types/index';
import { DUTY_STATUS_OPTIONS } from './hos-constants';
import { hosSharedStyles } from './hos-shared-styles';

export interface HosDutyStatusSelectorProps {
    selectedStatus: DutyStatus;
    setIsSaved: React.Dispatch<React.SetStateAction<boolean>>;
    setSelectedStatus: (status: DutyStatus) => void;
}

export const HosDutyStatusSelector: React.FC<HosDutyStatusSelectorProps> = ({
    selectedStatus,
    setIsSaved,
    setSelectedStatus,
}) => {
    const { isDarkHud } = useTheme();

    return (
        <View
            style={[
                hosSharedStyles.sectionCard,
                isDarkHud && hosSharedStyles.darkSectionCard,
            ]}
            testID="duty-status-selector"
        >
            <Text
                accessibilityRole="header"
                style={[
                    hosSharedStyles.sectionTitle,
                    isDarkHud && hosSharedStyles.darkSectionTitle,
                ]}
            >
                SELECT ACTIVE DUTY STATUS
            </Text>
            <Text
                style={[
                    hosSharedStyles.sectionHelper,
                    isDarkHud && hosSharedStyles.darkSectionHelper,
                ]}
            >
                Tap to switch duty status. Complies with DOLE-OSHC and DOT ELD
                mandates.
            </Text>

            <View style={styles.dutyOptionsList}>
                {DUTY_STATUS_OPTIONS.map((opt) => {
                    const isSelected = selectedStatus === opt.status;

                    return (
                        <Pressable
                            key={opt.status}
                            accessibilityLabel={`${opt.title}, ${opt.subtitle}`}
                            accessibilityRole="button"
                            onPress={() => {
                                setSelectedStatus(opt.status);
                                setIsSaved(false);
                            }}
                            style={({ pressed }) => [
                                styles.dutyOptionCard,
                                isDarkHud && styles.darkDutyOptionCard,
                                isSelected &&
                                    (isDarkHud
                                        ? styles.darkDutyOptionCardSelected
                                        : styles.dutyOptionCardSelected),
                                pressed && styles.dutyOptionCardPressed,
                            ]}
                            testID={`duty-option-${opt.status}`}
                        >
                            <View style={styles.optionLeft}>
                                <View
                                    style={[
                                        styles.optionBadge,
                                        {
                                            borderColor: opt.accentColor,
                                        },
                                        isSelected && {
                                            backgroundColor: opt.accentColor,
                                        },
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.optionBadgeText,
                                            isDarkHud &&
                                                styles.darkOptionBadgeText,
                                            isSelected &&
                                                (isDarkHud
                                                    ? styles.darkOptionBadgeTextActive
                                                    : styles.optionBadgeTextActive),
                                        ]}
                                    >
                                        {opt.badge}
                                    </Text>
                                </View>
                                <View style={styles.optionCopy}>
                                    <Text
                                        style={[
                                            styles.optionTitle,
                                            isDarkHud && styles.darkOptionTitle,
                                            isSelected &&
                                                (isDarkHud
                                                    ? styles.darkOptionTitleSelected
                                                    : styles.optionTitleSelected),
                                        ]}
                                    >
                                        {opt.title}
                                    </Text>
                                    <Text
                                        style={[
                                            styles.optionSubtitle,
                                            isDarkHud &&
                                                styles.darkOptionSubtitle,
                                        ]}
                                    >
                                        {opt.subtitle}
                                    </Text>
                                </View>
                            </View>

                            <View
                                style={[
                                    styles.radioButton,
                                    isDarkHud && styles.darkRadioButton,
                                    isSelected &&
                                        (isDarkHud
                                            ? styles.darkRadioButtonSelected
                                            : styles.radioButtonSelected),
                                ]}
                            >
                                {isSelected ? (
                                    <View
                                        style={[
                                            styles.radioButtonInner,
                                            isDarkHud &&
                                                styles.darkRadioButtonInner,
                                        ]}
                                    />
                                ) : null}
                            </View>
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    darkDutyOptionCard: {
        backgroundColor: '#1E293B',
        borderColor: 'rgba(255, 255, 255, 0.08)',
        shadowColor: '#000000',
        shadowOpacity: 0.2,
    },
    darkDutyOptionCardSelected: {
        backgroundColor: 'rgba(255, 191, 0, 0.12)',
        borderColor: '#FFBF00',
        borderWidth: 2,
    },
    darkOptionBadgeText: {
        color: '#F8FAFC',
    },
    darkOptionBadgeTextActive: {
        color: '#FFFFFF',
    },
    darkOptionSubtitle: {
        color: '#94A3B8',
    },
    darkOptionTitle: {
        color: '#FFFFFF',
    },
    darkOptionTitleSelected: {
        color: '#FFBF00',
    },
    darkRadioButton: {
        borderColor: '#475569',
    },
    darkRadioButtonInner: {
        backgroundColor: '#FFBF00',
    },
    darkRadioButtonSelected: {
        borderColor: '#FFBF00',
    },
    dutyOptionCard: {
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderColor: '#E2E8F0',
        borderRadius: 14,
        borderWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        minHeight: 64,
        paddingHorizontal: 16,
        paddingVertical: 12,
        elevation: 1,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 2,
    },
    dutyOptionCardPressed: {
        opacity: 0.88,
        transform: [{ scale: 0.99 }],
    },
    dutyOptionCardSelected: {
        backgroundColor: '#FFF3C4',
        borderColor: '#FFBF00',
        borderWidth: 2,
    },
    dutyOptionsList: {
        gap: 10,
    },
    optionBadge: {
        alignItems: 'center',
        backgroundColor: 'transparent',
        borderRadius: 8,
        borderWidth: 1.5,
        height: 30,
        justifyContent: 'center',
        width: 42,
    },
    optionBadgeText: {
        color: '#0F172A',
        fontSize: 12,
        fontWeight: '900',
    },
    optionBadgeTextActive: {
        color: '#FFFFFF',
    },
    optionCopy: {
        flex: 1,
    },
    optionLeft: {
        alignItems: 'center',
        flex: 1,
        flexDirection: 'row',
        gap: 12,
    },
    optionSubtitle: {
        color: '#64748B',
        fontSize: 12,
        marginTop: 2,
    },
    optionTitle: {
        color: '#0F172A',
        fontSize: 14,
        fontWeight: '700',
    },
    optionTitleSelected: {
        color: '#806000',
    },
    radioButton: {
        alignItems: 'center',
        borderColor: '#CBD5E1',
        borderRadius: 11,
        borderWidth: 2,
        height: 22,
        justifyContent: 'center',
        width: 22,
    },
    radioButtonInner: {
        backgroundColor: '#FFBF00',
        borderRadius: 5.5,
        height: 11,
        width: 11,
    },
    radioButtonSelected: {
        borderColor: '#FFBF00',
    },
});
