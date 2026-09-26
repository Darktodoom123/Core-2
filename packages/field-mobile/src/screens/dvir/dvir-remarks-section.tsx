import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import { createDvirSharedStyles } from './dvir-shared-styles';

export interface DvirRemarksSectionProps {
    mode: 'pre_trip' | 'post_trip' | 'history';
    remarks: string;
    setIsSaved: React.Dispatch<React.SetStateAction<boolean>>;
    setRemarks: React.Dispatch<React.SetStateAction<string>>;
}

export const DvirRemarksSection: React.FC<DvirRemarksSectionProps> = ({
    mode,
    remarks,
    setIsSaved,
    setRemarks,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const dvirSharedStyles = useThemedStyles(createDvirSharedStyles);

    return (
        <View style={[dvirSharedStyles.telemetryCard]}>
            <Text style={[dvirSharedStyles.telemetryHeading]}>
                INSPECTOR SIGN-OFF REMARKS
            </Text>
            <TextInput
                multiline
                numberOfLines={3}
                onChangeText={(val) => {
                    setRemarks(val);
                    setIsSaved(false);
                }}
                placeholder={
                    mode === 'pre_trip'
                        ? 'Note walkaround observation, fluid levels, tire status...'
                        : 'Note post-operation condition, site clearance...'
                }
                placeholderTextColor={theme.textMuted}
                style={[styles.remarksInput]}
                testID="dvir-remarks-input"
                value={remarks}
            />
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
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
