import React from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { Icon } from '../../components/common/Icon';
import type { IconName } from '../../components/common/Icon';
import type { FieldApiClient } from '../../services/apiClient';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import { useMySafetyReports } from './use-my-safety-reports';

type Tone = 'success' | 'warning' | 'critical';

const when = (iso: string) =>
    new Date(iso).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });

const StatusPill: React.FC<{ tone: Tone; label: string; testID: string }> = ({
    tone,
    label,
    testID,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const colors = {
        success: [theme.successEmeraldLight, theme.successEmeraldText],
        warning: [theme.warningOrangeLight, theme.warningOrangeText],
        critical: [theme.hazardRedLight, theme.hazardRedText],
    }[tone];
    const icon: IconName =
        tone === 'success'
            ? 'check-circle'
            : tone === 'warning'
              ? 'clock'
              : 'alert';

    return (
        <View
            style={[styles.pill, { backgroundColor: colors[0] }]}
            testID={testID}
        >
            <Icon color={colors[1]} name={icon} size={13} />
            <Text style={[styles.pillText, { color: colors[1] }]}>{label}</Text>
        </View>
    );
};

/**
 * Safety → Your reports: what the operator reported and what became of it.
 * Server records only; the outbox list above covers what is still on the phone.
 */
export const MySafetyReportsList: React.FC<{
    apiClient?: FieldApiClient;
}> = ({ apiClient }) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const { reports, status, retry } = useMySafetyReports(apiClient);

    return (
        <View style={styles.root}>
            <Text accessibilityRole="header" style={styles.sectionLabel}>
                Your reports
            </Text>

            {status === 'loading' ? (
                <View accessibilityLiveRegion="polite" style={styles.row}>
                    <ActivityIndicator color={theme.textSecondary} />
                    <Text style={styles.muted}>
                        Loading your safety reports…
                    </Text>
                </View>
            ) : null}

            {status === 'error' ? (
                <View accessibilityRole="alert" style={styles.error}>
                    <Text style={styles.errorTitle}>
                        Your safety reports didn't load
                    </Text>
                    {apiClient ? (
                        <Pressable
                            accessibilityRole="button"
                            onPress={retry}
                            style={({ pressed }) => [
                                styles.retry,
                                pressed && styles.pressed,
                            ]}
                            testID="my-safety-reports-retry"
                        >
                            <Icon
                                color={theme.textPrimary}
                                name="sync"
                                size={16}
                            />
                            <Text style={styles.retryText}>Try again</Text>
                        </Pressable>
                    ) : null}
                </View>
            ) : null}

            {status === 'loaded' && reports ? (
                reports.hazards.length === 0 &&
                reports.work_stoppages.length === 0 ? (
                    <Text style={styles.muted}>
                        No safety reports from you in the last 30 days
                    </Text>
                ) : (
                    <View style={styles.list} testID="my-safety-reports">
                        <Text style={styles.window}>Last 30 days</Text>
                        {reports.work_stoppages.map((notice) => (
                            <View
                                key={`s-${notice.id}`}
                                style={styles.card}
                                testID={`my-stoppage-${notice.id}`}
                            >
                                <View style={styles.cardTop}>
                                    <Text style={styles.code}>
                                        {notice.notice_number}
                                    </Text>
                                    <StatusPill
                                        label={
                                            notice.is_active
                                                ? 'Stop-work active'
                                                : 'Lifted'
                                        }
                                        testID={`my-stoppage-status-${notice.id}`}
                                        tone={
                                            notice.is_active
                                                ? 'critical'
                                                : 'success'
                                        }
                                    />
                                </View>
                                <Text style={styles.title}>
                                    {notice.reason}
                                </Text>
                                <Text style={styles.muted}>
                                    {notice.affected_area} · Issued{' '}
                                    {when(notice.issued_at)}
                                </Text>
                                {!notice.is_active && notice.lifted_at ? (
                                    <Text style={styles.body}>
                                        Lifted {when(notice.lifted_at)}
                                        {notice.lift_reason
                                            ? ` · ${notice.lift_reason}`
                                            : ''}
                                    </Text>
                                ) : null}
                            </View>
                        ))}
                        {reports.hazards.map((hazard) => {
                            const isFixed = hazard.status === 'rectified';

                            return (
                                <View
                                    key={`h-${hazard.id}`}
                                    style={styles.card}
                                    testID={`my-hazard-${hazard.id}`}
                                >
                                    <View style={styles.cardTop}>
                                        <Text style={styles.code}>
                                            {hazard.ticket_code}
                                        </Text>
                                        <StatusPill
                                            label={isFixed ? 'Fixed' : 'Open'}
                                            testID={`my-hazard-status-${hazard.id}`}
                                            tone={
                                                isFixed ? 'success' : 'warning'
                                            }
                                        />
                                    </View>
                                    <Text style={styles.title}>
                                        Hazard · {hazard.severity} severity
                                    </Text>
                                    <Text style={styles.muted}>
                                        {hazard.project_site} · Reported{' '}
                                        {when(hazard.reported_at)}
                                    </Text>
                                    {isFixed &&
                                    (hazard.rectified_at ||
                                        hazard.rectification_notes) ? (
                                        <Text style={styles.body}>
                                            {hazard.rectified_at
                                                ? `Fixed ${when(hazard.rectified_at)}`
                                                : 'Fixed'}
                                            {hazard.rectification_notes
                                                ? ` · ${hazard.rectification_notes}`
                                                : ''}
                                        </Text>
                                    ) : null}
                                </View>
                            );
                        })}
                    </View>
                )
            ) : null}
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        root: {
            gap: 10,
            marginTop: 8,
        },
        sectionLabel: {
            color: theme.textSecondary,
            fontSize: 13,
            fontWeight: '700',
            letterSpacing: 0.4,
            textTransform: 'uppercase',
        },
        window: {
            color: theme.textSecondary,
            fontSize: 12,
            fontWeight: '700',
        },
        list: {
            gap: 10,
        },
        row: {
            alignItems: 'center',
            flexDirection: 'row',
            gap: 8,
        },
        card: {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderRadius: 14,
            borderWidth: 1,
            gap: 4,
            padding: 14,
        },
        cardTop: {
            alignItems: 'center',
            flexDirection: 'row',
            gap: 8,
            justifyContent: 'space-between',
        },
        code: {
            color: theme.textPrimary,
            fontFamily: 'monospace',
            fontSize: 13,
            fontWeight: '700',
        },
        title: {
            color: theme.textPrimary,
            fontSize: 15,
            fontWeight: '700',
        },
        body: {
            color: theme.textPrimary,
            fontSize: 14,
            lineHeight: 20,
        },
        muted: {
            color: theme.textSecondary,
            fontSize: 14,
            lineHeight: 20,
        },
        pill: {
            alignItems: 'center',
            borderRadius: 999,
            flexDirection: 'row',
            gap: 4,
            paddingHorizontal: 8,
            paddingVertical: 3,
        },
        pillText: {
            fontSize: 12,
            fontWeight: '700',
        },
        error: {
            backgroundColor: theme.warningOrangeLight,
            borderColor: theme.warningOrange,
            borderRadius: 14,
            borderWidth: 1,
            gap: 8,
            padding: 14,
        },
        errorTitle: {
            color: theme.warningOrangeText,
            fontSize: 15,
            fontWeight: '700',
        },
        retry: {
            alignItems: 'center',
            backgroundColor: theme.surface,
            borderColor: theme.borderStrong,
            borderRadius: 12,
            borderWidth: 1,
            flexDirection: 'row',
            gap: 8,
            justifyContent: 'center',
            minHeight: 48,
        },
        retryText: {
            color: theme.textPrimary,
            fontSize: 14,
            fontWeight: '700',
        },
        pressed: {
            transform: [{ scale: 0.985 }],
        },
    });
