import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../../components/nativeStyles';
import { useTheme } from '../../theme';
import { dvirSharedStyles } from './dvir-shared-styles';

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
                METERS & BASELINE READINGS
            </Text>
            <View style={styles.inputsRow}>
                <View style={styles.inputGroup}>
                    <Text
                        style={[
                            styles.inputLabel,
                            isDarkHud && styles.darkInputLabel,
                        ]}
                    >
                        Odometer (km)
                    </Text>
                    <TextInput
                        keyboardType="numeric"
                        onChangeText={(val) => {
                            setOdometerKm(val);
                            setIsSaved(false);
                        }}
                        style={[
                            styles.textInput,
                            isDarkHud && styles.darkTextInput,
                        ]}
                        testID="input-odometer"
                        value={odometerKm}
                    />
                </View>
                <View style={styles.inputGroup}>
                    <Text
                        style={[
                            styles.inputLabel,
                            isDarkHud && styles.darkInputLabel,
                        ]}
                    >
                        Engine Hours (hrs)
                    </Text>
                    <TextInput
                        keyboardType="numeric"
                        onChangeText={(val) => {
                            setEngineHours(val);
                            setIsSaved(false);
                        }}
                        style={[
                            styles.textInput,
                            isDarkHud && styles.darkTextInput,
                        ]}
                        testID="input-engine-hours"
                        value={engineHours}
                    />
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    darkInputLabel: {
        color: '#CBD5E1',
    },
    darkTextInput: {
        backgroundColor: '#162238',
        borderColor: '#1E3A8A',
        color: '#FFFFFF',
    },
    inputGroup: {
        flex: 1,
    },
    inputLabel: {
        color: colors.text,
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 4,
    },
    inputsRow: {
        flexDirection: 'row',
        gap: 12,
    },
    textInput: {
        backgroundColor: '#F8FAFC',
        borderColor: colors.borderStrong,
        borderRadius: 8,
        borderWidth: 1,
        color: colors.text,
        fontSize: 14,
        fontWeight: '700',
        minHeight: 48,
        paddingHorizontal: 12,
    },
});
