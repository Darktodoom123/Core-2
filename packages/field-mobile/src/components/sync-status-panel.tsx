import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { OutboxCommand } from '../types/index';
import { colors, sharedStyles } from './nativeStyles';

export interface SyncStatusPanelProps {
    showDetails: boolean;
    syncGuidance: string;
    queuedCount: number;
    syncingCount: number;
    failedCount: number;
    conflictCount: number;
    onSyncNow?: () => void;
    isOnline?: boolean | null;
    failedCommands?: OutboxCommand[];
}

export const SyncStatusPanel: React.FC<SyncStatusPanelProps> = ({
    showDetails,
    syncGuidance,
    queuedCount,
    syncingCount,
    failedCount,
    conflictCount,
    onSyncNow,
    isOnline,
}) => {
    if (!showDetails) {
        return null;
    }

    const syncAttentionCount = failedCount + conflictCount;

    return (
        <View
            accessibilityLiveRegion="polite"
            style={[
                styles.panel,
                conflictCount > 0 && styles.panelConflict,
                isOnline === false && styles.panelOffline,
            ]}
            testID="outbox-status-bar"
        >
            <Text style={styles.panelTitle}>Sync details</Text>
            <View style={styles.details} testID="sync-details">
                <Text
                    style={[
                        styles.guidance,
                        syncAttentionCount > 0 && styles.guidanceAttention,
                    ]}
                    testID="sync-guidance"
                >
                    {syncGuidance}
                </Text>
                <View style={styles.chipRow}>
                    <SyncChip
                        label={`Queued: ${queuedCount}`}
                        active={queuedCount > 0}
                        tone="queued"
                    />
                    <SyncChip
                        label={`Syncing: ${syncingCount}`}
                        active={syncingCount > 0}
                        tone="syncing"
                    />
                    <SyncChip
                        label={`Failed: ${failedCount}`}
                        active={failedCount > 0}
                        tone="failed"
                    />
                    <SyncChip
                        label={`Conflicts: ${conflictCount}`}
                        active={conflictCount > 0}
                        tone="conflict"
                    />
                </View>
                {onSyncNow &&
                isOnline === true &&
                (queuedCount > 0 || failedCount > 0) ? (
                    <Pressable
                        accessibilityLabel="Sync queued commands now"
                        accessibilityRole="button"
                        onPress={onSyncNow}
                        style={({ pressed }) => [
                            sharedStyles.button,
                            styles.syncButton,
                            pressed && styles.pressed,
                        ]}
                    >
                        <Text style={sharedStyles.buttonText}>Sync now</Text>
                    </Pressable>
                ) : null}
            </View>
        </View>
    );
};

type SyncChipTone = 'queued' | 'syncing' | 'failed' | 'conflict';

const SyncChip: React.FC<{
    label: string;
    active: boolean;
    tone: SyncChipTone;
}> = ({ label, active, tone }) => (
    <View
        style={[
            styles.chip,
            !active && styles.zeroChip,
            active && tone === 'queued' && styles.queuedChip,
            active && tone === 'syncing' && styles.syncingChip,
            active && tone === 'failed' && styles.failedChip,
            active && tone === 'conflict' && styles.conflictChip,
        ]}
    >
        <Text
            style={[
                styles.chipText,
                !active && styles.zeroChipText,
                active && tone === 'queued' && styles.queuedChipText,
                active && tone === 'syncing' && styles.syncingChipText,
                active && tone === 'failed' && styles.failedChipText,
                active && tone === 'conflict' && styles.conflictChipText,
            ]}
        >
            {label}
        </Text>
    </View>
);

const styles = StyleSheet.create({
    panel: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 12,
        borderWidth: 1,
        gap: 8,
        marginBottom: 16,
        padding: 12,
    },
    panelConflict: {
        backgroundColor: colors.warningLight,
        borderColor: colors.warningBorder,
    },
    panelOffline: {
        backgroundColor: colors.warningLight,
        borderColor: colors.warningBorder,
    },
    panelTitle: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '800',
    },
    details: {
        borderTopColor: colors.border,
        borderTopWidth: 1,
        gap: 8,
        paddingTop: 8,
    },
    guidance: {
        color: colors.secondary,
        fontSize: 13,
        lineHeight: 19,
    },
    guidanceAttention: {
        color: colors.warningDark,
        fontWeight: '700',
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 2,
    },
    chip: {
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    chipText: {
        fontSize: 12,
        fontWeight: '800',
        fontVariant: ['tabular-nums'],
    },
    queuedChip: {
        backgroundColor: colors.surfaceMuted,
    },
    queuedChipText: {
        color: colors.secondary,
    },
    syncingChip: {
        backgroundColor: colors.blueSoft,
    },
    syncingChipText: {
        color: colors.blueDark,
    },
    failedChip: {
        backgroundColor: colors.redSoft,
    },
    failedChipText: {
        color: colors.redDark,
    },
    conflictChip: {
        backgroundColor: colors.warningSoft,
    },
    conflictChipText: {
        color: colors.warningDark,
    },
    zeroChip: {
        backgroundColor: colors.surfaceMuted,
    },
    zeroChipText: {
        color: colors.secondary,
    },
    syncButton: {
        backgroundColor: colors.amber,
        minHeight: 48,
        width: '100%',
    },
    pressed: {
        opacity: 0.78,
    },
});
