import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/common/Icon';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import { createDvirSharedStyles } from './dvir-shared-styles';

export interface DvirFooterActionProps {
    handleNextOrSubmit: () => void;
    hasUnselectedMultiAsset: boolean;
    isSaved: boolean;
    isUnassigned: boolean;
    /** What still has to be filled in; Next stays disabled until it's empty. */
    missing?: string[];
}

export const DvirFooterAction: React.FC<DvirFooterActionProps> = ({
    handleNextOrSubmit,
    hasUnselectedMultiAsset,
    isSaved,
    isUnassigned,
    missing = [],
}) => {
    const isIncomplete = missing.length > 0;
    const isBlocked =
        !isSaved && (isUnassigned || hasUnselectedMultiAsset || isIncomplete);

    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const dvirSharedStyles = useThemedStyles(createDvirSharedStyles);

    return (
        <View style={[styles.footerContainer]}>
            {!isSaved && isIncomplete ? (
                <View
                    accessibilityLiveRegion="polite"
                    style={styles.missing}
                    testID="dvir-missing"
                >
                    <Icon
                        color={theme.textSecondary}
                        name="alert-circle"
                        size={14}
                    />
                    <Text style={styles.missingText}>
                        {`Still needed: ${missing.join(', ')}`}
                    </Text>
                </View>
            ) : null}
            <Pressable
                accessibilityLabel={isSaved ? 'Saved, back to home' : 'Next'}
                accessibilityRole="button"
                accessibilityState={{ disabled: isBlocked }}
                disabled={isBlocked}
                onPress={handleNextOrSubmit}
                style={({ pressed }) => [
                    styles.nextButton,
                    isBlocked && styles.nextButtonDisabled,
                    pressed && !isBlocked && dvirSharedStyles.pressed,
                ]}
                testID="complete-dvir-button"
            >
                <Text style={[styles.nextButtonText]}>
                    {isSaved ? 'Saved · Back to home' : 'Next'}
                </Text>
            </Pressable>
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        footerContainer: {
            backgroundColor: theme.surface,
            borderTopColor: theme.border,
            borderTopWidth: 1,
            gap: 10,
            padding: 16,
        },
        missing: {
            alignItems: 'flex-start',
            flexDirection: 'row',
            gap: 6,
        },
        missingText: {
            color: theme.textSecondary,
            flex: 1,
            fontSize: 13,
            lineHeight: 18,
        },
        nextButton: {
            alignItems: 'center',
            backgroundColor: theme.brandAmber,
            borderRadius: 12,
            justifyContent: 'center',
            minHeight: 52,
            width: '100%',
        },
        nextButtonDisabled: {
            opacity: 0.45,
        },
        nextButtonText: {
            color: theme.surfaceDark,
            fontSize: 16,
            fontWeight: '700',
        },
    });
