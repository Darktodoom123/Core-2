import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../components/nativeStyles';
import { useTheme } from '../../theme';
import { dvirSharedStyles } from './dvir-shared-styles';

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
    const { isDarkHud } = useTheme();

    return (
        <View
            style={[
                styles.footerContainer,
                isDarkHud && styles.darkFooterContainer,
            ]}
        >
            <Pressable
                accessibilityLabel="Next"
                accessibilityRole="button"
                accessibilityState={{
                    disabled: isUnassigned || hasUnselectedMultiAsset,
                }}
                disabled={isUnassigned || hasUnselectedMultiAsset}
                onPress={handleNextOrSubmit}
                style={({ pressed }) => [
                    styles.nextButton,
                    isDarkHud && styles.darkNextButton,
                    (isUnassigned || hasUnselectedMultiAsset) &&
                        styles.nextButtonDisabled,
                    pressed &&
                        !(isUnassigned || hasUnselectedMultiAsset) &&
                        dvirSharedStyles.pressed,
                ]}
                testID="complete-dvir-button"
            >
                <Text
                    style={[
                        styles.nextButtonText,
                        isDarkHud && styles.darkNextButtonText,
                    ]}
                >
                    {isSaved ? '✓ DVIR Certified & Synced' : 'Next'}
                </Text>
            </Pressable>
        </View>
    );
};

const styles = StyleSheet.create({
    darkFooterContainer: {
        backgroundColor: '#0F172A',
        borderTopColor: '#1E293B',
    },
    darkNextButton: {
        backgroundColor: '#FFBF00',
    },
    darkNextButtonText: {
        color: '#0F172A',
    },
    footerContainer: {
        backgroundColor: colors.surface,
        borderTopColor: colors.border,
        borderTopWidth: 1,
        padding: 16,
    },
    nextButton: {
        alignItems: 'center',
        backgroundColor: colors.primary,
        borderRadius: 10,
        justifyContent: 'center',
        minHeight: 52,
        width: '100%',
    },
    nextButtonDisabled: {
        opacity: 0.45,
    },
    nextButtonText: {
        color: '#0F172A',
        fontSize: 16,
        fontWeight: '800',
    },
});
