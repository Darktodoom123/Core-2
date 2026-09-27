import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import { formatHours } from './dvir-readings';
import { createDvirSharedStyles } from './dvir-shared-styles';

export interface DvirMetersRowProps {
    engineHours: string;
    engineHoursError?: string | null;
    /** The last engine hours the server recorded for this unit, if any. */
    lastEngineHours?: number | null;
    odometerError?: string | null;
    odometerKm: string;
    setEngineHours: React.Dispatch<React.SetStateAction<string>>;
    setIsSaved: React.Dispatch<React.SetStateAction<boolean>>;
    setOdometerKm: React.Dispatch<React.SetStateAction<string>>;
}

export const DvirMetersRow: React.FC<DvirMetersRowProps> = ({
    engineHours,
    engineHoursError = null,
    lastEngineHours = null,
    odometerError = null,
    odometerKm,
    setEngineHours,
    setIsSaved,
    setOdometerKm,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const dvirSharedStyles = useThemedStyles(createDvirSharedStyles);

    return (
        <View style={[dvirSharedStyles.telemetryCard]}>
            <Text style={[dvirSharedStyles.telemetryHeading]}>
                METERS & BASELINE READINGS
            </Text>
            <View style={styles.inputsRow}>
                <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel]}>
                        Odometer (km) · optional
                    </Text>
                    <TextInput
                        keyboardType="numeric"
                        onChangeText={(val) => {
                            setOdometerKm(val);
                            setIsSaved(false);
                        }}
                        style={[styles.textInput]}
                        placeholder="Leave blank if none"
                        placeholderTextColor={theme.textSecondary}
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
                        placeholder="Reading"
                        placeholderTextColor={theme.textSecondary}
                        testID="input-engine-hours"
                        value={engineHours}
                    />
                </View>
            </View>
            {typeof lastEngineHours === 'number' ? (
                <Text style={styles.hint}>
                    Last recorded: {formatHours(lastEngineHours)}
                </Text>
            ) : null}
            {[engineHoursError, odometerError]
                .filter(Boolean)
                .map((message) => (
                    <Text
                        accessibilityLiveRegion="polite"
                        key={message}
                        style={styles.error}
                    >
                        {message}
                    </Text>
                ))}
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        hint: {
            color: theme.textSecondary,
            fontSize: 13,
            marginTop: 8,
        },
        error: {
            color: theme.warningOrangeText,
            fontSize: 13,
            fontWeight: '500',
            marginTop: 6,
        },
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
