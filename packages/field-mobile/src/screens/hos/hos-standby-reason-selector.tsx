import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import type { StandbyReason } from '../../types/index';
import { STANDBY_REASONS } from './hos-constants';
import { hosSharedStyles } from './hos-shared-styles';

export interface HosStandbyReasonSelectorProps {
    setIsSaved: React.Dispatch<React.SetStateAction<boolean>>;
    setStandbyReason: React.Dispatch<React.SetStateAction<StandbyReason>>;
    standbyReason: StandbyReason;
}

export const HosStandbyReasonSelector: React.FC<
    HosStandbyReasonSelectorProps
> = ({ setIsSaved, setStandbyReason, standbyReason }) => {
    const { isDarkHud } = useTheme();

    return (
        <View
            style={[
                hosSharedStyles.sectionCard,
                isDarkHud && hosSharedStyles.darkSectionCard,
            ]}
            testID="standby-reason-section"
        >
            <Text
                accessibilityRole="header"
                style={[
                    hosSharedStyles.sectionTitle,
                    isDarkHud && hosSharedStyles.darkSectionTitle,
                ]}
            >
                STANDBY &amp; DEMURRAGE REASON
            </Text>
            <Text
                style={[
                    hosSharedStyles.sectionHelper,
                    isDarkHud && hosSharedStyles.darkSectionHelper,
                ]}
            >
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
                                isDarkHud && styles.darkStandbyChip,
                                isSelected &&
                                    (isDarkHud
                                        ? styles.darkStandbyChipSelected
                                        : styles.standbyChipSelected),
                                pressed && hosSharedStyles.pressed,
                            ]}
                            testID={`standby-reason-${r.reason}`}
                        >
                            <Text
                                style={[
                                    styles.standbyChipText,
                                    isDarkHud && styles.darkStandbyChipText,
                                    isSelected &&
                                        (isDarkHud
                                            ? styles.darkStandbyChipTextSelected
                                            : styles.standbyChipTextSelected),
                                ]}
                            >
                                {r.label}
                            </Text>
                            {isSelected ? (
                                <Text
                                    style={[
                                        styles.standbyCheckGlyph,
                                        isDarkHud &&
                                            styles.darkStandbyCheckGlyph,
                                    ]}
                                >
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

const styles = StyleSheet.create({
    darkStandbyCheckGlyph: {
        color: '#FFBF00',
    },
    darkStandbyChip: {
        backgroundColor: '#0F172A',
        borderColor: '#334155',
    },
    darkStandbyChipSelected: {
        backgroundColor: 'rgba(255, 191, 0, 0.15)',
        borderColor: '#FFBF00',
        borderWidth: 1.5,
    },
    darkStandbyChipText: {
        color: '#94A3B8',
    },
    darkStandbyChipTextSelected: {
        color: '#FFBF00',
        fontWeight: '800',
    },
    standbyCheckGlyph: {
        color: '#806000',
        fontSize: 14,
        fontWeight: '900',
        marginLeft: 8,
    },
    standbyChip: {
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderColor: '#E2E8F0',
        borderRadius: 12,
        borderWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        minHeight: 48,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    standbyChipSelected: {
        backgroundColor: '#FFF3C4',
        borderColor: '#FFBF00',
        borderWidth: 1.5,
    },
    standbyChipText: {
        color: '#475569',
        flex: 1,
        fontSize: 12.5,
        fontWeight: '700',
    },
    standbyChipTextSelected: {
        color: '#806000',
        fontWeight: '800',
    },
    standbyChipsGrid: {
        gap: 8,
    },
});
