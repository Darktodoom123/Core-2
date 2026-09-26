import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import type { StandbyReason } from '../../types/index';
import { STANDBY_REASONS } from './hos-constants';
import { createHosSharedStyles } from './hos-shared-styles';

export interface HosStandbyReasonSelectorProps {
    setIsSaved: React.Dispatch<React.SetStateAction<boolean>>;
    setStandbyReason: React.Dispatch<React.SetStateAction<StandbyReason>>;
    standbyReason: StandbyReason;
}

export const HosStandbyReasonSelector: React.FC<
    HosStandbyReasonSelectorProps
> = ({ setIsSaved, setStandbyReason, standbyReason }) => {
    const styles = useThemedStyles(createStyles);
    const hosSharedStyles = useThemedStyles(createHosSharedStyles);

    return (
        <View
            style={[hosSharedStyles.sectionCard]}
            testID="standby-reason-section"
        >
            <Text
                accessibilityRole="header"
                style={[hosSharedStyles.sectionTitle]}
            >
                STANDBY &amp; DEMURRAGE REASON
            </Text>
            <Text style={[hosSharedStyles.sectionHelper]}>
                Required for client billable delay attribution and contractual
                demurrage logs.
            </Text>

            <View style={styles.standbyChipsGrid}>
                {STANDBY_REASONS.map((r) => {
                    const isSelected = standbyReason === r.reason;

                    return (
                        <Pressable
                            key={r.reason}
                            accessibilityLabel={r.label}
                            accessibilityRole="button"
                            onPress={() => {
                                setStandbyReason(r.reason);
                                setIsSaved(false);
                            }}
                            style={({ pressed }) => [
                                styles.standbyChip,
                                isSelected && styles.standbyChipSelected,
                                pressed && hosSharedStyles.pressed,
                            ]}
                            testID={`standby-reason-${r.reason}`}
                        >
                            <Text
                                style={[
                                    styles.standbyChipText,
                                    isSelected &&
                                        styles.standbyChipTextSelected,
                                ]}
                            >
                                {r.label}
                            </Text>
                            {isSelected ? (
                                <Text style={[styles.standbyCheckGlyph]}>
                                    ✓
                                </Text>
                            ) : null}
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        standbyCheckGlyph: {
            color: theme.textPrimary,
            fontSize: 14,
            fontWeight: '700',
            marginLeft: 8,
        },
        standbyChip: {
            alignItems: 'center',
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderRadius: 12,
            borderWidth: 1,
            flexDirection: 'row',
            justifyContent: 'space-between',
            minHeight: 48,
            paddingHorizontal: 14,
            paddingVertical: 12,
        },
        standbyChipSelected: {
            backgroundColor: theme.brandAmberLight,
            borderColor: theme.brandAmber,
            borderWidth: 1.5,
        },
        standbyChipText: {
            color: theme.textSecondary,
            flex: 1,
            fontSize: 12.5,
            fontWeight: '700',
        },
        standbyChipTextSelected: {
            color: theme.textPrimary,
            fontWeight: '700',
        },
        standbyChipsGrid: {
            gap: 8,
        },
    });
