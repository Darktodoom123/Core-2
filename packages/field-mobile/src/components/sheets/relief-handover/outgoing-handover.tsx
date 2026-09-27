import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type { FieldApiClient } from '../../../services/apiClient';
import { useTheme, useThemedStyles } from '../../../theme';
import { Icon } from '../../common/Icon';
import { createReliefStyles } from './relief-handover-styles';
import { useStartHandover } from './use-relief-handover';

const time = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
    });

export interface OutgoingHandoverProps {
    apiClient?: FieldApiClient;
    jobId?: number | null;
    assetCode?: string;
}

/** The outgoing operator gets a PIN from the server to give the relief operator. */
export const OutgoingHandover: React.FC<OutgoingHandoverProps> = ({
    apiClient,
    jobId,
    assetCode,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createReliefStyles);
    const { status, handover, retry } = useStartHandover(apiClient, jobId);

    if (!jobId) {
        return (
            <Text style={styles.body}>
                You have no active job to hand over. A handover starts from the
                job you are working on.
            </Text>
        );
    }

    if (status === 'idle' || status === 'starting') {
        return (
            <View accessibilityLiveRegion="polite" style={styles.stack}>
                <ActivityIndicator color={theme.textSecondary} />
                <Text style={styles.muted}>Starting the handover…</Text>
            </View>
        );
    }

    if (status === 'error' || !handover) {
        return (
            <View accessibilityRole="alert" style={styles.notice}>
                <Text style={styles.noticeText}>
                    Couldn't start the handover
                </Text>
                <Text style={styles.body}>
                    The server didn't return a PIN. Check your connection and
                    try again.
                </Text>
                <Pressable
                    accessibilityRole="button"
                    onPress={retry}
                    style={({ pressed }) => [
                        styles.secondary,
                        pressed && styles.pressed,
                    ]}
                    testID="handover-start-retry"
                >
                    <Icon color={theme.textPrimary} name="sync" size={16} />
                    <Text style={styles.secondaryText}>Try again</Text>
                </Pressable>
            </View>
        );
    }

    const unit = handover.asset_code || assetCode || 'this unit';

    return (
        <View style={styles.stack}>
            <Text style={styles.body}>
                Give the relief operator the unit code{' '}
                <Text style={styles.label}>{unit}</Text> and this PIN. They
                enter both on their phone to take over.
            </Text>
            <View
                accessibilityLabel={`Handover PIN ${handover.pin.split('').join(' ')}`}
                style={styles.pinRow}
                testID="handover-pin-display"
            >
                {handover.pin.split('').map((digit, index) => (
                    <View key={`pin-${index}`} style={styles.pinBox}>
                        <Text style={styles.pinDigit}>{digit}</Text>
                    </View>
                ))}
            </View>
            <Text style={styles.muted}>
                Expires {time(handover.expires_at)}. Five wrong PINs cancel it.
            </Text>
        </View>
    );
};
