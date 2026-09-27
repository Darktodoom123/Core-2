import React, { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme, useThemedStyles } from '../../../theme';
import type { ThemeColors } from '../../../theme';
import type { DispatchJob } from '../../../types/index';
import { Icon } from '../../common/Icon';
import { directionsUrl } from './job-directions';

/** Hands navigation to the phone's maps app; the app draws no routes itself. */
export const JobDirectionsButton: React.FC<{ job: DispatchJob }> = ({
    job,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const [error, setError] = useState<string | null>(null);
    const url = directionsUrl(job);

    if (!url) {
        return null;
    }

    const openMaps = async () => {
        setError(null);

        try {
            await Linking.openURL(url);
        } catch {
            setError(
                "Couldn't open maps on this phone. Use the site address above.",
            );
        }
    };

    return (
        <View style={styles.wrap}>
            <Pressable
                accessibilityHint="Opens your maps app"
                accessibilityLabel={`Directions to ${job.site || 'the job site'}`}
                accessibilityRole="link"
                onPress={openMaps}
                style={({ pressed }) => [
                    styles.button,
                    pressed && styles.pressed,
                ]}
                testID={`job-directions-btn-${job.id}`}
            >
                <Icon color={theme.textPrimary} name="map" size={16} />
                <Text style={styles.label}>Directions</Text>
            </Pressable>
            {error ? (
                <Text accessibilityRole="alert" style={styles.error}>
                    {error}
                </Text>
            ) : null}
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        wrap: {
            gap: 6,
        },
        button: {
            alignItems: 'center',
            backgroundColor: theme.surface,
            borderColor: theme.borderStrong,
            borderRadius: 12,
            borderWidth: 1,
            flexDirection: 'row',
            gap: 8,
            justifyContent: 'center',
            minHeight: 48,
            paddingHorizontal: 14,
        },
        label: {
            color: theme.textPrimary,
            fontSize: 14,
            fontWeight: '700',
        },
        error: {
            color: theme.warningOrangeText,
            fontSize: 13,
            lineHeight: 18,
        },
        pressed: {
            transform: [{ scale: 0.985 }],
        },
    });
