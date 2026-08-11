import React, { useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import type {
    LocationCoordinates,
    LocationSharingService,
} from '../services/locationService';
import type { DispatchJob, User } from '../types/index';
import { colors, sharedStyles } from './nativeStyles';

export interface LocationSharingCardProps {
    user: User;
    job?: DispatchJob | null;
    locationService: LocationSharingService;
    getCurrentLocation?: () => Promise<LocationCoordinates>;
    onLocationQueued?: (commandId: string) => void;
}

export const LocationSharingCard: React.FC<LocationSharingCardProps> = ({
    user,
    job,
    locationService,
    getCurrentLocation,
    onLocationQueued,
}) => {
    const canShare = locationService.canShareLocation(user, job);
    const [statusMsg, setStatusMsg] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    if (!canShare) {
        return null;
    }

    const handleShareNow = async () => {
        if (!getCurrentLocation) {
            setStatusMsg('Location provider is not available on this device.');

            return;
        }

        setIsLoading(true);

        try {
            const coords = await getCurrentLocation();
            const result = await locationService.shareLocation(
                user,
                job ?? null,
                null,
                coords,
                'Manual field check-in',
            );

            if (result.success && result.commandId) {
                setStatusMsg(
                    `Location queued for sync (${result.commandId.slice(0, 8)})`,
                );
                onLocationQueued?.(result.commandId);
            } else {
                setStatusMsg(`Failed: ${result.reason}`);
            }
        } catch (error: unknown) {
            setStatusMsg(
                error instanceof Error
                    ? error.message
                    : 'Unable to read the device location.',
            );
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <View
            style={[styles.card, !getCurrentLocation && styles.cardUnavailable]}
            testID="location-sharing-card"
        >
            <View style={styles.headingRow}>
                <View
                    style={[
                        styles.stateMark,
                        !getCurrentLocation && styles.stateMarkUnavailable,
                    ]}
                />
                <Text accessibilityRole="header" style={styles.heading}>
                    {getCurrentLocation
                        ? 'Location sharing available'
                        : 'Location sharing unavailable'}
                </Text>
            </View>
            <Text style={styles.description}>
                {getCurrentLocation
                    ? 'Share a current location update for this active assignment. The update is queued safely if the network drops.'
                    : 'Device location is not connected in this build. No location update will be recorded.'}
            </Text>
            <View style={styles.row}>
                <Pressable
                    accessibilityLabel={
                        isLoading
                            ? 'Reading device location'
                            : getCurrentLocation
                              ? 'Share current location now'
                              : 'Location unavailable'
                    }
                    accessibilityRole="button"
                    accessibilityState={{
                        busy: isLoading,
                        disabled: isLoading || !getCurrentLocation,
                    }}
                    disabled={isLoading || !getCurrentLocation}
                    onPress={() => void handleShareNow()}
                    style={({ pressed }) => [
                        sharedStyles.button,
                        styles.shareButton,
                        !getCurrentLocation && styles.unavailableButton,
                        pressed && styles.pressed,
                    ]}
                    testID="share-location-btn"
                >
                    {isLoading ? (
                        <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                        <Text
                            style={[
                                sharedStyles.buttonText,
                                !getCurrentLocation &&
                                    styles.unavailableButtonText,
                            ]}
                        >
                            {getCurrentLocation
                                ? 'Share current location'
                                : 'Location unavailable'}
                        </Text>
                    )}
                </Pressable>
                {statusMsg ? (
                    <Text
                        accessibilityLiveRegion="polite"
                        style={styles.status}
                        testID="location-status-msg"
                    >
                        {statusMsg}
                    </Text>
                ) : null}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.greenSoft,
        borderColor: colors.greenBorder,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 16,
        padding: 16,
    },
    cardUnavailable: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
    },
    headingRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 10,
    },
    stateMark: {
        backgroundColor: colors.green,
        borderRadius: 6,
        height: 12,
        width: 12,
    },
    stateMarkUnavailable: {
        backgroundColor: colors.muted,
    },
    heading: {
        color: colors.greenDark,
        fontSize: 17,
        fontWeight: '800',
    },
    description: {
        color: colors.secondary,
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 12,
        marginTop: 8,
    },
    row: {
        alignItems: 'stretch',
        flexDirection: 'column',
        gap: 12,
    },
    shareButton: {
        backgroundColor: colors.amber,
        width: '100%',
    },
    unavailableButton: {
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderWidth: 1,
    },
    unavailableButtonText: {
        color: colors.muted,
    },
    status: {
        color: colors.greenDark,
        flexShrink: 1,
        fontSize: 13,
        lineHeight: 19,
    },
    pressed: {
        opacity: 0.78,
    },
});
