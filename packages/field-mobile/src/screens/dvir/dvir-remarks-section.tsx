import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import { createDvirSharedStyles } from './dvir-shared-styles';

export interface DvirRemarksSectionProps {
    mode: 'pre_trip' | 'post_trip' | 'history';
    remarks: string;
    /** Required when the unit is unsafe or has defects. */
    required?: boolean;
    setIsSaved: React.Dispatch<React.SetStateAction<boolean>>;
    setRemarks: React.Dispatch<React.SetStateAction<string>>;
}

export const DvirRemarksSection: React.FC<DvirRemarksSectionProps> = ({
    mode,
    remarks,
    required = false,
    setIsSaved,
    setRemarks,
}) => {
    const isMissing = required && remarks.trim() === '';

    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const dvirSharedStyles = useThemedStyles(createDvirSharedStyles);

    return (
        <View style={[dvirSharedStyles.telemetryCard]}>
            <Text style={[dvirSharedStyles.telemetryHeading]}>
                {required ? 'REMARKS · REQUIRED' : 'REMARKS · OPTIONAL'}
            </Text>
            <TextInput
                multiline
                numberOfLines={3}
                onChangeText={(val) => {
                    setRemarks(val);
                    setIsSaved(false);
                }}
                placeholder={
                    required
                        ? 'Where is the problem and how bad is it?'
                        : mode === 'pre_trip'
                          ? 'Note walkaround observation, fluid levels, tire status...'
                          : 'Note post-operation condition, site clearance...'
                }
                placeholderTextColor={theme.textMuted}
                style={[styles.remarksInput]}
                testID="dvir-remarks-input"
                value={remarks}
            />
            {isMissing ? (
                <Text accessibilityLiveRegion="polite" style={styles.missing}>
                    Describe where the problem is and how bad it is.
                </Text>
            ) : null}
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        missing: {
            color: theme.warningOrangeText,
            fontSize: 13,
            fontWeight: '500',
            marginTop: 6,
        },
        remarksInput: {
            backgroundColor: theme.surfaceHighlight,
            borderColor: theme.borderStrong,
            borderRadius: 12,
            borderWidth: 1,
            color: theme.textPrimary,
            fontSize: 16,
            minHeight: 96,
            padding: 10,
            textAlignVertical: 'top',
        },
    });
