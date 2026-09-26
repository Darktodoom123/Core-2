import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import { Icon } from '../common/Icon';

export type SyncTone =
    'checking' | 'online' | 'attention' | 'failed' | 'offline' | 'syncing';

export interface SyncStatusPillProps {
    label: string;
    message: string;
    tone: SyncTone;
    onPress?: () => void;
}

interface ToneColors {
    surface: string;
    edge: string;
    mark: string;
    text: string;
}

// Attention is a warning (conflicts, retryable failures, sign-in); failed is
// critical (rejected actions, expired SOS). Syncing is informational.
const toneColors = (theme: ThemeColors, tone: SyncTone): ToneColors => {
    switch (tone) {
        case 'online':
            return {
                surface: theme.successEmeraldLight,
                edge: theme.successEmerald,
                mark: theme.successEmerald,
                text: theme.textPrimary,
            };
        case 'offline':
        case 'attention':
            return {
                surface: theme.warningOrangeLight,
                edge: theme.warningOrange,
                mark: theme.warningOrange,
                text: theme.warningOrangeText,
            };
        case 'failed':
            return {
                surface: theme.hazardRedLight,
                edge: theme.hazardRed,
                mark: theme.hazardRed,
                text: theme.hazardRedText,
            };
        case 'syncing':
            return {
                surface: theme.actionCobaltLight,
                edge: theme.actionCobalt,
                mark: theme.actionCobalt,
                text: theme.textPrimary,
            };
        case 'checking':
        default:
            return {
                surface: theme.surface,
                edge: theme.border,
                mark: theme.textSecondary,
                text: theme.textPrimary,
            };
    }
};

export const SyncStatusPill: React.FC<SyncStatusPillProps> = ({
    label,
    message,
    tone,
    onPress,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const colors = toneColors(theme, tone);

    const pillBody = (
        <View
            accessibilityLabel={`Sync status: ${label}, ${message}`}
            accessibilityRole={onPress ? 'button' : 'summary'}
            style={[
                styles.syncPill,
                { backgroundColor: colors.surface, borderColor: colors.edge },
            ]}
            testID="sync-status-pill"
        >
            <View
                style={[styles.syncMark, { backgroundColor: colors.mark }]}
                testID="sync-status-mark"
            />
            <Text style={[styles.syncLabel, { color: colors.text }]}>
                {label}
            </Text>
            <Text style={styles.syncSeparator}>·</Text>
            <Text selectable style={styles.syncMessage}>
                {message}
            </Text>
            <Icon color={colors.text} name="chevron-right" size={14} />
        </View>
    );

    if (onPress) {
        return (
            <Pressable
                accessibilityHint="Opens outbox and synchronization details sheet"
                accessibilityLabel={`Sync status: ${label}, ${message}. Tap to view synchronization details`}
                accessibilityRole="button"
                onPress={onPress}
                style={({ pressed }) => [
                    styles.syncPillWrapper,
                    pressed && styles.pressed,
                ]}
                testID="sync-pill-pressable"
            >
                {pillBody}
            </Pressable>
        );
    }

    return <View style={styles.syncPillWrapper}>{pillBody}</View>;
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        pressed: {
            opacity: 0.78,
        },
        // The sync pill is one of the few floating layers allowed a shadow.
        syncPill: {
            alignItems: 'center',
            alignSelf: 'stretch',
            borderRadius: 999,
            borderWidth: 1,
            elevation: 1,
            flexDirection: 'row',
            gap: 8,
            minHeight: 48,
            paddingHorizontal: 14,
            paddingVertical: 6,
            shadowColor: theme.surfaceDark,
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 2,
        },
        syncLabel: {
            fontSize: 13,
            fontWeight: '700',
        },
        syncMark: {
            borderRadius: 4,
            height: 8,
            width: 8,
        },
        syncMessage: {
            color: theme.textSecondary,
            flex: 1,
            fontSize: 12,
            lineHeight: 17,
            textAlign: 'right',
        },
        syncPillWrapper: {
            width: '100%',
        },
        syncSeparator: {
            color: theme.textSecondary,
            fontSize: 12,
        },
    });
