import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import { createDvirSharedStyles } from './dvir-shared-styles';

export interface DvirFooterActionProps {
    handleNextOrSubmit: () => void;
    hasUnselectedMultiAsset: boolean;
    isSaved: boolean;
    isUnassigned: boolean;
}

export const DvirFooterAction: React.FC<DvirFooterActionProps> = ({
    handleNextOrSubmit,
    hasUnselectedMultiAsset,
    isSaved,
    isUnassigned,
}) => {
    const styles = useThemedStyles(createStyles);
    const dvirSharedStyles = useThemedStyles(createDvirSharedStyles);

    return (
        <View style={[styles.footerContainer]}>
            <Pressable
                accessibilityLabel={isSaved ? 'Saved, back to home' : 'Next'}
                accessibilityRole="button"
                accessibilityState={{
                    disabled: isUnassigned || hasUnselectedMultiAsset,
                }}
                disabled={isUnassigned || hasUnselectedMultiAsset}
                onPress={handleNextOrSubmit}
                style={({ pressed }) => [
                    styles.nextButton,
                    (isUnassigned || hasUnselectedMultiAsset) &&
                        styles.nextButtonDisabled,
                    pressed &&
                        !(isUnassigned || hasUnselectedMultiAsset) &&
                        dvirSharedStyles.pressed,
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
            padding: 16,
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
