import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme, useThemedStyles } from '../../../theme';
import type { ThemeColors } from '../../../theme';
import { Icon } from '../../common/Icon';

export interface DefectSheetFooterProps {
    count: number;
    criticalCount: number;
    onDone: () => void;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Sticky footer: warns before a critical pick locks the unit, then applies. */
export const DefectSheetFooter: React.FC<DefectSheetFooterProps> = ({
    count,
    criticalCount,
    onDone,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);

    return (
        <View style={styles.footer}>
            {criticalCount > 0 ? (
                <View accessibilityLiveRegion="polite" style={styles.warning}>
                    <Icon
                        color={theme.hazardRedText}
                        name="alert-circle"
                        size={16}
                    />
                    <Text style={styles.warningText}>
                        {`${plural(criticalCount, 'critical defect')} — the unit will be locked when you submit.`}
                    </Text>
                </View>
            ) : null}
            <Pressable
                accessibilityLabel={
                    count > 0 ? `Add ${plural(count, 'defect')}` : 'Done'
                }
                accessibilityRole="button"
                onPress={onDone}
                style={styles.done}
                testID="defects-modal-done"
            >
                <Text style={styles.doneText}>
                    {count > 0 ? `Add ${plural(count, 'defect')}` : 'Done'}
                </Text>
            </Pressable>
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        footer: {
            backgroundColor: theme.surface,
            borderTopColor: theme.border,
            borderTopWidth: 1,
            gap: 10,
            paddingHorizontal: 16,
            paddingVertical: 12,
        },
        warning: {
            alignItems: 'flex-start',
            flexDirection: 'row',
            gap: 8,
        },
        warningText: {
            color: theme.hazardRedText,
            flex: 1,
            fontSize: 14,
            fontWeight: '500',
            lineHeight: 20,
        },
        done: {
            alignItems: 'center',
            backgroundColor: theme.brandAmber,
            borderRadius: 12,
            justifyContent: 'center',
            minHeight: 52,
        },
        doneText: {
            color: theme.surfaceDark,
            fontSize: 16,
            fontWeight: '700',
        },
    });
