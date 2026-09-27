import React, { useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    Text,
    TextInput,
    View,
} from 'react-native';
import type { FieldApiClient } from '../../../services/apiClient';
import { useTheme, useThemedStyles } from '../../../theme';
import type { EquipmentHandoverClaimResponse } from '../../../types/index';
import { createReliefStyles } from './relief-handover-styles';
import { useClaimHandover } from './use-relief-handover';

export interface IncomingClaimProps {
    apiClient?: FieldApiClient;
    isOnline?: boolean | null;
    onClaimed: (result: EquipmentHandoverClaimResponse) => void;
}

/** The relief operator claims a unit with its code and the outgoing operator's PIN. */
export const IncomingClaim: React.FC<IncomingClaimProps> = ({
    apiClient,
    isOnline,
    onClaimed,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createReliefStyles);
    const [unit, setUnit] = useState('');
    const [pin, setPin] = useState('');
    const { claim, isClaiming, error } = useClaimHandover(apiClient);
    const unitCode = unit.trim().toUpperCase();
    const isOffline = isOnline === false;
    const canClaim =
        unitCode.length > 0 && /^\d{4}$/.test(pin) && !isOffline && !isClaiming;

    const submit = async () => {
        const result = await claim(unitCode, pin);

        if (result) {
            onClaimed(result);
        }
    };

    return (
        <View style={styles.stack}>
            <Text style={styles.body}>
                Ask the outgoing operator to start the handover on their phone,
                then enter the unit code and the PIN they show you.
            </Text>

            <Text style={styles.label}>Unit code</Text>
            <TextInput
                accessibilityLabel="Unit code"
                autoCapitalize="characters"
                autoCorrect={false}
                onChangeText={setUnit}
                placeholder="e.g. CRN-101"
                placeholderTextColor={theme.textSecondary}
                style={styles.input}
                testID="handover-unit-input"
                value={unit}
            />

            <Text style={styles.label}>Handover PIN</Text>
            <TextInput
                accessibilityLabel="Four-digit handover PIN"
                keyboardType="number-pad"
                maxLength={4}
                onChangeText={(text) => setPin(text.replace(/\D/g, ''))}
                placeholder="0000"
                placeholderTextColor={theme.textSecondary}
                style={[styles.input, styles.pinInput]}
                testID="handover-pin-input"
                value={pin}
            />

            {isOffline ? (
                <View accessibilityRole="alert" style={styles.notice}>
                    <Text style={styles.noticeText}>
                        Claiming a unit needs a connection. Try again when you
                        are back online.
                    </Text>
                </View>
            ) : null}

            {error ? (
                <View accessibilityRole="alert" style={styles.notice}>
                    <Text style={styles.noticeText}>{error}</Text>
                </View>
            ) : null}

            <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: !canClaim, busy: isClaiming }}
                disabled={!canClaim}
                onPress={() => void submit()}
                style={({ pressed }) => [
                    styles.primary,
                    !canClaim && styles.primaryDisabled,
                    pressed && canClaim && styles.pressed,
                ]}
                testID="claim-pin-btn"
            >
                {isClaiming ? (
                    <ActivityIndicator color={theme.surfaceDark} />
                ) : (
                    <Text
                        style={[
                            styles.primaryText,
                            !canClaim && styles.primaryTextDisabled,
                        ]}
                    >
                        Claim unit
                    </Text>
                )}
            </Pressable>
        </View>
    );
};
