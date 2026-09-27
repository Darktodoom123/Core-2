import React from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import type { OutboxProjection } from '../../../services/outboxProjection';
import { useTheme, useThemedStyles } from '../../../theme';
import type { ThemeColors } from '../../../theme';
import { Icon } from '../../common/Icon';

export type OutboxFilterTab = 'all' | 'attention' | 'waiting' | 'completed';

export interface OutboxSummaryProps {
    projection: OutboxProjection;
    isOnline: boolean | null;
    onSyncNow?: () => void;
}

/**
 * Connection, one plain sentence of guidance, and the one main action. The
 * card is neutral unless something needs the operator: orange when it can be
 * retried or reviewed, red when the server turned an action down.
 */
export const OutboxSummary: React.FC<OutboxSummaryProps> = ({
    projection,
    isOnline,
    onSyncNow,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const hasAttention = projection.counts.attention > 0;
    const isCritical = projection.headerPill.tone === 'failed';
    const edge = isCritical
        ? theme.hazardRed
        : hasAttention
          ? theme.warningOrange
          : theme.border;
    const dot =
        isOnline === true
            ? theme.successEmerald
            : isOnline === false
              ? theme.warningOrange
              : theme.textSecondary;
    const canRetry =
        hasAttention && projection.sections.attention.some((i) => i.retryable);
    const showSync =
        onSyncNow &&
        isOnline === true &&
        (projection.canSyncNow || projection.isProcessing);

    return (
        <View
            style={[styles.card, { borderColor: edge }]}
            testID="outbox-overview-card"
        >
            <View style={styles.row}>
                <View style={[styles.dot, { backgroundColor: dot }]} />
                <Text style={styles.connection}>
                    {isOnline === true
                        ? 'Connected'
                        : isOnline === false
                          ? 'Offline — actions stay on this phone'
                          : 'Checking connection'}
                </Text>
                {projection.isProcessing ? (
                    <View style={styles.row}>
                        <ActivityIndicator
                            color={theme.actionCobalt}
                            size="small"
                        />
                        <Text style={styles.syncing}>Sending…</Text>
                    </View>
                ) : null}
            </View>

            <Text style={styles.guidance} testID="outbox-sheet-guidance">
                {projection.syncGuidance}
            </Text>

            {showSync ? (
                <Pressable
                    accessibilityHint="Sends waiting actions and retries the ones that can be retried"
                    accessibilityLabel="Sync outbox now"
                    accessibilityRole="button"
                    accessibilityState={{ busy: projection.isProcessing }}
                    disabled={projection.isProcessing}
                    onPress={onSyncNow}
                    style={({ pressed }) => [
                        styles.syncButton,
                        projection.isProcessing && styles.busy,
                        pressed && styles.pressed,
                    ]}
                    testID="sheet-sync-now-btn"
                >
                    <Icon color={theme.surfaceDark} name="sync" size={16} />
                    <Text style={styles.syncText}>
                        {projection.isProcessing
                            ? 'Sending…'
                            : canRetry
                              ? 'Retry and sync'
                              : `Sync now (${projection.counts.waiting})`}
                    </Text>
                </Pressable>
            ) : null}
        </View>
    );
};

export interface OutboxFilterTabsProps {
    projection: OutboxProjection;
    active: OutboxFilterTab;
    onChange: (tab: OutboxFilterTab) => void;
}

export const OutboxFilterTabs: React.FC<OutboxFilterTabsProps> = ({
    projection,
    active,
    onChange,
}) => {
    const styles = useThemedStyles(createStyles);
    const { counts } = projection;
    const tabs: Array<{ key: OutboxFilterTab; label: string; count: number }> =
        [
            {
                key: 'all',
                label: 'All',
                count: counts.totalActive + counts.completed,
            },
            { key: 'attention', label: 'Attention', count: counts.attention },
            {
                key: 'waiting',
                label: 'Waiting',
                count: counts.waiting + counts.submitting,
            },
            { key: 'completed', label: 'Synced', count: counts.completed },
        ];

    return (
        <View style={styles.tabs}>
            {tabs.map((tab) => {
                const selected = active === tab.key;

                return (
                    <Pressable
                        accessibilityLabel={`${tab.label}: ${tab.count}`}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        key={tab.key}
                        onPress={() => onChange(tab.key)}
                        style={[styles.tab, selected && styles.tabSelected]}
                        testID={`outbox-filter-${tab.key}`}
                    >
                        <Text
                            numberOfLines={1}
                            style={[
                                styles.tabText,
                                selected && styles.tabTextSelected,
                            ]}
                        >
                            {tab.label} ({tab.count})
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
};

export interface OutboxTelemetryCardProps {
    count: number;
}

/** Background GPS pings are batched automatically; nothing to act on. */
export const OutboxTelemetryCard: React.FC<OutboxTelemetryCardProps> = ({
    count,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);

    return (
        <View style={styles.telemetry} testID="outbox-telemetry-card">
            <View style={styles.row}>
                <Icon color={theme.actionCobalt} name="location" size={18} />
                <Text style={styles.telemetryTitle}>Background GPS</Text>
            </View>
            <Text style={styles.guidance}>
                {count} location ping{count === 1 ? '' : 's'} waiting. They send
                automatically in batches when there is a connection.
            </Text>
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        card: {
            backgroundColor: theme.surface,
            borderRadius: 14,
            borderWidth: 1.5,
            gap: 10,
            marginBottom: 12,
            padding: 14,
        },
        row: {
            alignItems: 'center',
            flexDirection: 'row',
            gap: 8,
        },
        dot: {
            borderRadius: 5,
            height: 10,
            width: 10,
        },
        connection: {
            color: theme.textPrimary,
            flex: 1,
            fontSize: 14,
            fontWeight: '700',
        },
        syncing: {
            color: theme.textPrimary,
            fontSize: 13,
            fontWeight: '500',
        },
        guidance: {
            color: theme.textSecondary,
            fontSize: 14,
            lineHeight: 20,
        },
        syncButton: {
            alignItems: 'center',
            backgroundColor: theme.brandAmber,
            borderRadius: 12,
            flexDirection: 'row',
            gap: 8,
            justifyContent: 'center',
            minHeight: 52,
        },
        syncText: {
            color: theme.surfaceDark,
            fontSize: 15,
            fontWeight: '700',
        },
        busy: {
            opacity: 0.6,
        },
        pressed: {
            opacity: 0.85,
        },
        tabs: {
            flexDirection: 'row',
            gap: 6,
            marginBottom: 12,
        },
        tab: {
            alignItems: 'center',
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderRadius: 10,
            borderWidth: 1,
            flex: 1,
            justifyContent: 'center',
            minHeight: 48,
            paddingHorizontal: 4,
        },
        tabSelected: {
            backgroundColor: theme.brandAmberLight,
            borderColor: theme.brandAmber,
        },
        tabText: {
            color: theme.textSecondary,
            fontSize: 13,
            fontWeight: '500',
        },
        tabTextSelected: {
            color: theme.textPrimary,
            fontWeight: '700',
        },
        telemetry: {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderRadius: 14,
            borderWidth: 1,
            gap: 6,
            marginBottom: 10,
            padding: 14,
        },
        telemetryTitle: {
            color: theme.textPrimary,
            fontSize: 15,
            fontWeight: '700',
        },
    });
