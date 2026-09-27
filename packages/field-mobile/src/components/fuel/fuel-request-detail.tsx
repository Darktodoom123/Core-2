import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { QueuedFuelRequest } from '../../hooks/useFuelManagement';
import { useTheme } from '../../theme';
import type { ThemeColors } from '../../theme/tokens';
import { fuelStatusLabels } from '../../types/fuel';
import type { FuelStatus, MobileFuelRequest } from '../../types/fuel';
import { Icon } from '../common/Icon';
import type { IconName } from '../common/Icon';
import { FuelBanner, FuelButton, FuelField, fuelStyles } from './fuel-controls';

export function formatFuelDate(value: string | null | undefined): string {
    return value
        ? new Date(value).toLocaleString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
          })
        : 'Not recorded';
}

interface StatusVisual {
    icon: IconName;
    bg: string;
    border: string;
    iconColor: string;
    text: string;
}

type PillStatus = FuelStatus | 'queued' | 'queued_attention' | 'queued_failed';

/**
 * Role colors for a fuel request. Waiting on the office is neutral, approved
 * is informational cobalt, ready and recorded are green, rejected is red. No
 * status is drawn in brand gold, which is reserved for actions.
 */
function statusVisual(status: PillStatus, theme: ThemeColors): StatusVisual {
    const info = {
        bg: theme.actionCobaltLight,
        border: theme.actionCobalt,
        iconColor: theme.actionCobalt,
        text: theme.textPrimary,
    };
    const success = {
        bg: theme.successEmeraldLight,
        border: theme.successEmerald,
        iconColor: theme.successEmeraldText,
        text: theme.successEmeraldText,
    };
    const neutral = {
        bg: theme.surfaceHighlight,
        border: theme.borderStrong,
        iconColor: theme.textSecondary,
        text: theme.textSecondary,
    };

    switch (status) {
        case 'verified':
            return { ...success, icon: 'fuel' };
        case 'logged':
            return { ...success, icon: 'check-circle' };
        case 'approved':
            return { ...info, icon: 'check' };
        case 'queued':
            return { ...info, icon: 'sync' };
        case 'queued_attention':
            return {
                bg: theme.warningOrangeLight,
                border: theme.warningOrange,
                iconColor: theme.warningOrangeText,
                text: theme.warningOrangeText,
                icon: 'alert',
            };
        case 'rejected':
        case 'queued_failed':
            return {
                bg: theme.hazardRedLight,
                border: theme.hazardRed,
                iconColor: theme.hazardRedText,
                text: theme.hazardRedText,
                icon: 'alert-circle',
            };
        case 'withdrawn':
            return { ...neutral, icon: 'close' };
        default:
            return { ...neutral, icon: 'clock' };
    }
}

const QUEUED_LABELS: Record<string, string> = {
    queued: 'Waiting to sync',
    queued_attention: 'Needs attention',
    queued_failed: 'Not accepted',
};

export function FuelStatusPill({
    status,
    label,
}: {
    status: PillStatus;
    label?: string;
}) {
    const { theme } = useTheme();
    const visual = statusVisual(status, theme);
    const text =
        label ??
        QUEUED_LABELS[status] ??
        fuelStatusLabels[status as FuelStatus];

    return (
        <View
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                alignSelf: 'flex-start',
                backgroundColor: visual.bg,
                borderColor: visual.border,
                borderWidth: 1,
                borderRadius: 999,
                paddingHorizontal: 10,
                paddingVertical: 4,
            }}
            testID={`fuel-status-${status}`}
        >
            <Icon name={visual.icon} size={14} color={visual.iconColor} />
            <Text
                style={{ color: visual.text, fontWeight: '700', fontSize: 13 }}
            >
                {text}
            </Text>
        </View>
    );
}

function UrgencyPill({ urgency }: { urgency?: string }) {
    const { theme } = useTheme();

    if (!urgency || urgency === 'normal') {
        return null;
    }

    const critical = urgency === 'critical';
    const fg = critical ? theme.hazardRedText : theme.warningOrangeText;

    return (
        <View
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                alignSelf: 'flex-start',
                backgroundColor: critical
                    ? theme.hazardRedLight
                    : theme.warningOrangeLight,
                borderColor: critical ? theme.hazardRed : theme.warningOrange,
                borderWidth: 1,
                borderRadius: 999,
                paddingHorizontal: 10,
                paddingVertical: 4,
            }}
        >
            <Icon name="alert" size={14} color={fg} />
            <Text style={{ color: fg, fontWeight: '700', fontSize: 13 }}>
                {critical ? 'Critical' : 'Urgent'}
            </Text>
        </View>
    );
}

const TIMELINE: {
    key: string;
    label: string;
    at: (r: MobileFuelRequest) => string | null | undefined;
}[] = [
    { key: 'submitted', label: 'Submitted', at: (r) => r.created_at },
    { key: 'approved', label: 'Approved by office', at: (r) => r.approved_at },
    { key: 'verified', label: 'Ready to refuel', at: (r) => r.verified_at },
    {
        key: 'logged',
        label: 'Refuel logged',
        at: (r) => r.logs[0]?.recorded_at ?? null,
    },
];

function FuelTimeline({ request }: { request: MobileFuelRequest }) {
    const { theme } = useTheme();
    const closed =
        request.status === 'rejected' || request.status === 'withdrawn';

    return (
        <View style={{ gap: 12 }} testID="fuel-request-timeline">
            {TIMELINE.map((step, index) => {
                const at =
                    closed &&
                    step.key === 'approved' &&
                    request.status === 'rejected'
                        ? null
                        : step.at(request);
                const done = Boolean(at);

                return (
                    <View
                        key={step.key}
                        style={{ flexDirection: 'row', gap: 12 }}
                        accessibilityLabel={`${step.label}: ${done ? formatFuelDate(at) : 'pending'}`}
                    >
                        <View style={{ alignItems: 'center', width: 22 }}>
                            <Icon
                                name={done ? 'check-circle' : 'clock'}
                                size={20}
                                color={
                                    done
                                        ? theme.successEmerald
                                        : theme.textSecondary
                                }
                            />
                            {index < TIMELINE.length - 1 && (
                                <View
                                    style={{
                                        width: 2,
                                        flex: 1,
                                        minHeight: 14,
                                        backgroundColor: done
                                            ? theme.successEmerald
                                            : theme.border,
                                    }}
                                />
                            )}
                        </View>
                        <View style={{ flex: 1, paddingBottom: 2 }}>
                            <Text
                                style={{
                                    color: done
                                        ? theme.textPrimary
                                        : theme.textSecondary,
                                    fontWeight: done ? '700' : '500',
                                    fontSize: 15,
                                }}
                            >
                                {step.label}
                            </Text>
                            {done && (
                                <Text
                                    style={{
                                        color: theme.textSecondary,
                                        fontSize: 13,
                                    }}
                                >
                                    {formatFuelDate(at)}
                                </Text>
                            )}
                        </View>
                    </View>
                );
            })}
        </View>
    );
}

export function FuelRequestListItem({
    request,
    onPress,
}: {
    request: MobileFuelRequest;
    onPress: () => void;
}) {
    const { theme } = useTheme();

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View ${request.reference}`}
            accessibilityHint={`${fuelStatusLabels[request.status]}, ${request.quantity_litres} litres`}
            onPress={onPress}
            testID={`fuel-view-request-${request.id}`}
            style={({ pressed }) => [
                fuelStyles.card,
                {
                    backgroundColor: theme.surface,
                    borderColor:
                        request.status === 'verified'
                            ? theme.successEmerald
                            : theme.border,
                    borderWidth: request.status === 'verified' ? 2 : 1,
                },
                pressed && { opacity: 0.85 },
            ]}
        >
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                <FuelStatusPill status={request.status} />
                <UrgencyPill urgency={request.urgency} />
            </View>
            <Text
                style={{
                    color: theme.textPrimary,
                    fontSize: 17,
                    fontWeight: '700',
                }}
            >
                {request.quantity_litres} L{' '}
                {request.fuel_type === 'diesel' ? 'Diesel' : 'Gasoline'} ·{' '}
                {request.asset?.code ?? 'General use'}
            </Text>
            <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                {request.reference} · {formatFuelDate(request.created_at)}
            </Text>
            {request.status === 'verified' && (
                <Text
                    style={{
                        color: theme.successEmerald,
                        fontWeight: '700',
                        fontSize: 14,
                    }}
                >
                    Ready — refuel, then capture the receipt
                </Text>
            )}
        </Pressable>
    );
}

export function QueuedFuelRequestItem({
    queued,
}: {
    queued: QueuedFuelRequest;
}) {
    const { theme } = useTheme();
    // A failed send is critical (red); a conflict, unresolved or expired
    // command needs the operator's attention (orange).
    const failed = queued.state === 'failed';
    const needsAttention =
        failed ||
        queued.state === 'conflict' ||
        queued.state === 'unresolved' ||
        queued.state === 'expired';
    const syncing = queued.state === 'syncing';
    const pillStatus = failed
        ? 'queued_failed'
        : needsAttention
          ? 'queued_attention'
          : 'queued';
    const borderColor = failed
        ? theme.hazardRed
        : needsAttention
          ? theme.warningOrange
          : theme.actionCobalt;

    return (
        <View
            style={[
                fuelStyles.card,
                {
                    backgroundColor: theme.surface,
                    borderColor,
                    borderStyle: 'dashed',
                },
            ]}
            testID={`fuel-queued-${queued.commandId}`}
            accessibilityLabel={`Fuel request waiting to sync, ${queued.payload.quantity_litres} litres`}
        >
            <FuelStatusPill
                label={syncing ? 'Syncing' : undefined}
                status={pillStatus}
            />
            <Text
                style={{
                    color: theme.textPrimary,
                    fontSize: 17,
                    fontWeight: '700',
                }}
            >
                {queued.payload.quantity_litres} L{' '}
                {queued.payload.fuel_type === 'diesel' ? 'Diesel' : 'Gasoline'}
            </Text>
            <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                {needsAttention && queued.error
                    ? queued.error
                    : syncing
                      ? 'Sending to the office now. Not yet confirmed.'
                      : 'Saved on this device. It sends automatically when you are back online.'}
            </Text>
        </View>
    );
}

export function FuelRequestDetail({
    request,
    busy,
    withdrawPending,
    logPending,
    onRecord,
    onWithdraw,
    onResubmit,
    onBack,
    children,
}: {
    request: MobileFuelRequest;
    busy: boolean;
    withdrawPending: boolean;
    logPending: boolean;
    onRecord: () => void;
    onWithdraw: (reason?: string) => void;
    onResubmit: () => void;
    onBack: () => void;
    children?: React.ReactNode;
}) {
    const { theme } = useTheme();
    const [confirmWithdraw, setConfirmWithdraw] = useState(false);
    const [withdrawReason, setWithdrawReason] = useState('');
    const textStyle = [fuelStyles.body, { color: theme.textPrimary }];

    return (
        <View style={fuelStyles.section} testID="fuel-request-detail">
            <View style={{ gap: 8 }}>
                <View
                    style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}
                >
                    <FuelStatusPill status={request.status} />
                    <UrgencyPill urgency={request.urgency} />
                </View>
                <Text style={[fuelStyles.title, { color: theme.textPrimary }]}>
                    {request.quantity_litres} L{' '}
                    {request.fuel_type === 'diesel' ? 'Diesel' : 'Gasoline'}
                </Text>
                <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                    {request.reference}
                </Text>
            </View>

            <View
                style={[
                    fuelStyles.card,
                    {
                        backgroundColor: theme.surface,
                        borderColor: theme.border,
                    },
                ]}
            >
                <Text style={textStyle}>
                    Equipment:{' '}
                    {request.asset
                        ? `${request.asset.code} · ${request.asset.name}`
                        : 'General use'}
                </Text>
                {request.job?.reference && (
                    <Text style={textStyle}>Job: {request.job.reference}</Text>
                )}
                {request.current_fuel_level_percent !== null &&
                    request.current_fuel_level_percent !== undefined && (
                        <Text style={textStyle}>
                            Tank when requested:{' '}
                            {request.current_fuel_level_percent}%
                        </Text>
                    )}
                {request.needed_by && (
                    <Text style={textStyle}>
                        Needed by: {formatFuelDate(request.needed_by)}
                    </Text>
                )}
                <Text style={textStyle}>Purpose: {request.purpose}</Text>
            </View>

            {request.status === 'rejected' && (
                <FuelBanner
                    tone="danger"
                    title="Declined by the office"
                    message={request.decision_reason ?? 'No reason was given.'}
                >
                    <FuelButton
                        title="Revise & Resubmit"
                        primary
                        onPress={onResubmit}
                        disabled={busy}
                    />
                </FuelBanner>
            )}

            {request.status === 'withdrawn' && (
                <FuelBanner
                    tone="info"
                    title="You withdrew this request"
                    message={request.withdrawal_reason ?? undefined}
                />
            )}

            {request.decision_reason && request.status !== 'rejected' && (
                <FuelBanner
                    tone="info"
                    title="Office note"
                    message={request.decision_reason}
                />
            )}

            {request.status !== 'rejected' &&
                request.status !== 'withdrawn' && (
                    <FuelTimeline request={request} />
                )}

            {logPending && (
                <FuelBanner
                    tone="info"
                    message="Your refuel log is saved on this device and will sync automatically."
                />
            )}

            {request.can_record && !logPending && (
                <FuelButton
                    title="Record refueling"
                    hint="Capture the receipt and litres received"
                    primary
                    onPress={onRecord}
                    disabled={busy}
                />
            )}

            {!request.can_record &&
                ['submitted', 'forwarded', 'approved'].includes(
                    request.status,
                ) && (
                    <Text
                        style={[
                            fuelStyles.body,
                            { color: theme.textSecondary },
                        ]}
                    >
                        The office approves and confirms the allocation before
                        you refuel. You will get a notification when it is
                        ready.
                    </Text>
                )}

            {children}

            {withdrawPending ? (
                <FuelBanner
                    tone="info"
                    message="Withdrawal saved on this device. It will sync when the connection returns."
                />
            ) : (
                request.can_withdraw &&
                (confirmWithdraw ? (
                    <View
                        style={[
                            fuelStyles.card,
                            {
                                backgroundColor: theme.surface,
                                borderColor: theme.hazardRed,
                            },
                        ]}
                    >
                        <FuelField
                            label="Why are you withdrawing? (optional)"
                            value={withdrawReason}
                            onChangeText={setWithdrawReason}
                            maxLength={2000}
                            placeholder="e.g. Refuelled from the site bowser"
                        />
                        <FuelButton
                            title="Confirm withdraw"
                            danger
                            onPress={() => onWithdraw(withdrawReason)}
                            disabled={busy}
                            testID="fuel-confirm-withdraw"
                        />
                        <FuelButton
                            title="Keep request"
                            onPress={() => setConfirmWithdraw(false)}
                            disabled={busy}
                        />
                    </View>
                ) : (
                    <FuelButton
                        title="Withdraw request"
                        onPress={() => setConfirmWithdraw(true)}
                        disabled={busy}
                        testID="fuel-withdraw-request"
                    />
                ))
            )}

            {request.logs.map((log) => (
                <View
                    key={log.id}
                    style={[
                        fuelStyles.card,
                        {
                            backgroundColor: theme.surface,
                            borderColor: theme.border,
                        },
                    ]}
                >
                    <Text
                        style={{
                            color: theme.textPrimary,
                            fontWeight: '700',
                            fontSize: 17,
                        }}
                    >
                        {log.quantity_litres} L received
                    </Text>
                    <Text style={textStyle}>
                        {formatFuelDate(log.recorded_at)}
                    </Text>
                    {log.total_cost !== null && (
                        <Text style={textStyle}>
                            PHP {Number(log.total_cost).toFixed(2)}
                        </Text>
                    )}
                    {log.odometer_km !== null && (
                        <Text style={textStyle}>
                            Odometer: {log.odometer_km} km
                        </Text>
                    )}
                    {log.hour_meter !== null && (
                        <Text style={textStyle}>
                            Engine hours: {log.hour_meter}
                        </Text>
                    )}
                    {log.fuel_station && (
                        <Text style={textStyle}>{log.fuel_station}</Text>
                    )}
                    {log.has_receipt ? (
                        <Text style={textStyle}>
                            Receipt attached
                            {log.receipt_number
                                ? ` · No. ${log.receipt_number}`
                                : ''}
                        </Text>
                    ) : (
                        <Text style={textStyle}>
                            No receipt
                            {log.no_receipt_reason_label
                                ? `: ${log.no_receipt_reason_label}`
                                : ''}
                            {log.requires_receipt_review
                                ? ' · waiting for office review'
                                : log.receipt_reviewed_at
                                  ? ' · reviewed by office'
                                  : ''}
                        </Text>
                    )}
                    {log.is_anomaly && (
                        <Text style={[textStyle, { color: theme.hazardRed }]}>
                            Needs review:{' '}
                            {log.anomaly_reason ??
                                'Consumption variance flagged.'}
                        </Text>
                    )}
                </View>
            ))}

            <FuelButton
                title="Back to requests"
                onPress={onBack}
                disabled={busy}
            />
        </View>
    );
}
