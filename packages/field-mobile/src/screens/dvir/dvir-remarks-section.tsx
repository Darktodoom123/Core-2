import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../../components/nativeStyles';
import { useTheme } from '../../theme';
import { dvirSharedStyles } from './dvir-shared-styles';

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
    const { isDarkHud } = useTheme();

    return (
        <View
            style={[
                dvirSharedStyles.telemetryCard,
                isDarkHud && dvirSharedStyles.darkTelemetryCard,
            ]}
        >
            <Text
                style={[
                    dvirSharedStyles.telemetryHeading,
                    isDarkHud && dvirSharedStyles.darkTelemetryHeading,
                ]}
            >
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
                placeholderTextColor={isDarkHud ? '#64748B' : colors.muted}
                style={[
                    styles.remarksInput,
                    isDarkHud && styles.darkRemarksInput,
                ]}
                testID="dvir-remarks-input"
                value={remarks}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    darkRemarksInput: {
        backgroundColor: '#162238',
        borderColor: '#1E3A8A',
        color: '#FFFFFF',
    },
    remarksInput: {
        backgroundColor: '#F8FAFC',
        borderColor: colors.borderStrong,
        borderRadius: 8,
        borderWidth: 1,
        color: colors.text,
        fontSize: 13,
        minHeight: 70,
        padding: 10,
        textAlignVertical: 'top',
    },
});
