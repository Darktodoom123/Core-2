import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import type { DutyStatus } from '../../types/index';
import { DUTY_STATUS_OPTIONS } from './hos-constants';
import { createHosSharedStyles } from './hos-shared-styles';

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
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const hosSharedStyles = useThemedStyles(createHosSharedStyles);

    return (
        <View
            style={[hosSharedStyles.sectionCard]}
            testID="duty-status-selector"
        >
            <Text
                accessibilityRole="header"
                style={[hosSharedStyles.sectionTitle]}
            >
                SELECT ACTIVE DUTY STATUS
            </Text>
            <Text style={[hosSharedStyles.sectionHelper]}>
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
                                isSelected && styles.dutyOptionCardSelected,
                                pressed && styles.dutyOptionCardPressed,
                            ]}
                            testID={`duty-option-${opt.status}`}
                        >
                            <View style={styles.optionLeft}>
                                <View
                                    style={[
                                        styles.optionBadge,
                                        {
                                            borderColor: theme[opt.accentToken],
                                        },
                                        isSelected && {
                                            backgroundColor:
                                                theme[opt.accentToken],
                                        },
                                    ]}
                                    testID={`duty-badge-${opt.status}`}
                                >
                                    <Text
                                        style={[
                                            styles.optionBadgeText,
                                            isSelected &&
                                                styles.optionBadgeTextActive,
                                        ]}
                                    >
                                        {opt.badge}
                                    </Text>
                                </View>
                                <View style={styles.optionCopy}>
                                    <Text
                                        style={[
                                            styles.optionTitle,
                                            isSelected &&
                                                styles.optionTitleSelected,
                                        ]}
                                    >
                                        {opt.title}
                                    </Text>
                                    <Text style={[styles.optionSubtitle]}>
                                        {opt.subtitle}
                                    </Text>
                                </View>
                            </View>

                            <View
                                style={[
                                    styles.radioButton,
                                    isSelected && styles.radioButtonSelected,
                                ]}
                            >
                                {isSelected ? (
                                    <View style={[styles.radioButtonInner]} />
                                ) : null}
                            </View>
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        dutyOptionCard: {
            alignItems: 'center',
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderRadius: 12,
            borderWidth: 1,
            flexDirection: 'row',
            justifyContent: 'space-between',
            minHeight: 64,
            paddingHorizontal: 16,
            paddingVertical: 12,
        },
        dutyOptionCardPressed: {
            opacity: 0.88,
            transform: [{ scale: 0.99 }],
        },
        dutyOptionCardSelected: {
            backgroundColor: theme.brandAmberLight,
            borderColor: theme.brandAmber,
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
            color: theme.textPrimary,
            fontSize: 12,
            fontWeight: '700',
        },
        // Text on a duty category fill.
        optionBadgeTextActive: {
            color: theme.textInverse,
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
            color: theme.textSecondary,
            fontSize: 12,
            marginTop: 2,
        },
        optionTitle: {
            color: theme.textPrimary,
            fontSize: 14,
            fontWeight: '700',
        },
        optionTitleSelected: {
            color: theme.textPrimary,
        },
        radioButton: {
            alignItems: 'center',
            borderColor: theme.borderStrong,
            borderRadius: 11,
            borderWidth: 2,
            height: 22,
            justifyContent: 'center',
            width: 22,
        },
        radioButtonInner: {
            backgroundColor: theme.brandAmberText,
            borderRadius: 5.5,
            height: 11,
            width: 11,
        },
        radioButtonSelected: {
            borderColor: theme.brandAmberText,
        },
    });
