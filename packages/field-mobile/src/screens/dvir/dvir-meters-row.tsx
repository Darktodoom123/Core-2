import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import { createDvirSharedStyles } from './dvir-shared-styles';

export interface DvirMetersRowProps {
    engineHours: string;
    odometerKm: string;
    setEngineHours: React.Dispatch<React.SetStateAction<string>>;
    setIsSaved: React.Dispatch<React.SetStateAction<boolean>>;
    setOdometerKm: React.Dispatch<React.SetStateAction<string>>;
}

export const DvirMetersRow: React.FC<DvirMetersRowProps> = ({
    engineHours,
    odometerKm,
    setEngineHours,
    setIsSaved,
    setOdometerKm,
}) => {
    const styles = useThemedStyles(createStyles);
    const dvirSharedStyles = useThemedStyles(createDvirSharedStyles);

    return (
        <View style={[dvirSharedStyles.telemetryCard]}>
            <Text style={[dvirSharedStyles.telemetryHeading]}>
                METERS & BASELINE READINGS
            </Text>
            <View style={styles.inputsRow}>
                <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel]}>Odometer (km)</Text>
                    <TextInput
                        keyboardType="numeric"
                        onChangeText={(val) => {
                            setOdometerKm(val);
                            setIsSaved(false);
                        }}
                        style={[styles.textInput]}
                        testID="input-odometer"
                        value={odometerKm}
                    />
                </View>
                <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel]}>Engine Hours (hrs)</Text>
                    <TextInput
                        keyboardType="numeric"
                        onChangeText={(val) => {
                            setEngineHours(val);
                            setIsSaved(false);
                        }}
                        style={[styles.textInput]}
                        testID="input-engine-hours"
                        value={engineHours}
                    />
                </View>
            </View>
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        inputGroup: {
            flex: 1,
        },
        inputLabel: {
            color: theme.textPrimary,
            fontSize: 12,
            fontWeight: '700',
            marginBottom: 4,
        },
        inputsRow: {
            flexDirection: 'row',
            gap: 12,
        },
        textInput: {
            backgroundColor: theme.surfaceHighlight,
            borderColor: theme.borderStrong,
            borderRadius: 12,
            borderWidth: 1,
            color: theme.textPrimary,
            fontSize: 16,
            fontWeight: '700',
            minHeight: 48,
            paddingHorizontal: 12,
        },
    });
