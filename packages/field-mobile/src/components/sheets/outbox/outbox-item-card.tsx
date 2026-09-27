import React from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import type { OutboxItemDisplay } from '../../../services/outboxProjection';
import { useTheme, useThemedStyles } from '../../../theme';
import type { ThemeColors } from '../../../theme';
import { Icon } from '../../common/Icon';
import type { IconName } from '../../common/Icon';
import { outboxItemTone, outboxToneColors } from './outbox-tone';

export interface OutboxItemCardProps {
    item: OutboxItemDisplay;
    onRetryCommand?: (commandId: string) => void;
    onPromptDiscard: () => void;
    onAcceptServerState?: (commandId: string) => void;
    onRetryNewVersion?: (commandId: string, newVersion: number) => void;
    onSignIn?: () => void;
    onRecaptureAttachment?: (commandId: string, oldUri: string) => void;
}

interface NoticeProps {
    icon: IconName;
    color: string;
    text: string;
    testID?: string;
}

const Notice: React.FC<NoticeProps> = ({ icon, color, text, testID }) => {
    const styles = useThemedStyles(createStyles);

    return (
        <View style={styles.notice} testID={testID}>
            <Icon color={color} name={icon} size={14} />
            <Text style={[styles.noticeText, { color }]}>{text}</Text>
        </View>
    );
};

/**
 * One saved action. Its border and badge say what the operator must do; the
 * card body is always the neutral surface so long lists stay readable.
 */
export const OutboxItemCard: React.FC<OutboxItemCardProps> = ({
    item,
    onRetryCommand,
    onPromptDiscard,
    onAcceptServerState,
    onRetryNewVersion,
    onSignIn,
    onRecaptureAttachment,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const tone = outboxToneColors(theme, outboxItemTone(item));
    const isUnresolved = item.state === 'unresolved';
    const isSyncing = item.state === 'syncing';
    const isCompleted = item.state === 'completed';
    const needsAction =
        item.state === 'failed' ||
        isUnresolved ||
        item.isConflict ||
        item.state === 'expired';
    const showActions =
        (item.retryable ||
            item.canDiscard ||
            item.isConflict ||
            item.isAuthenticationRequired) &&
        !isSyncing &&
        !isCompleted;

    return (
        <View
            accessibilityRole={needsAction ? 'alert' : undefined}
            style={[styles.card, { borderColor: tone.border }]}
            testID={`outbox-item-${item.id}`}
        >
            <View style={styles.headerRow}>
                <View style={styles.titleBlock}>
                    <Text style={styles.title}>{item.title}</Text>
                    <Text style={styles.reference}>
                        {item.reference}
                        {item.attachmentCount > 0
                            ? ` · ${item.attachmentCount} photo${item.attachmentCount === 1 ? '' : 's'}`
                            : ''}
                    </Text>
                </View>
                <View
                    style={[
                        styles.badge,
                        {
                            backgroundColor: tone.background,
                            borderColor: tone.border,
                        },
                    ]}
                >
                    {isSyncing ? (
                        <ActivityIndicator color={tone.icon} size="small" />
                    ) : null}
                    <Text style={[styles.badgeText, { color: tone.text }]}>
                        {item.stateLabel}
                    </Text>
                </View>
            </View>

            {item.explanation ? (
                <Text style={styles.explanation}>{item.explanation}</Text>
            ) : null}

            {item.isConflict &&
            item.serverReference &&
            item.serverStatusLabel ? (
                <Text style={styles.meta} testID={`server-state-${item.id}`}>
                    Server state: {item.serverReference} —{' '}
                    {item.serverStatusLabel}
                </Text>
            ) : null}
            {item.isConflict && item.isCancelledOnServer ? (
                <Notice
                    color={theme.hazardRedText}
                    icon="close"
                    testID={`server-cancelled-notice-${item.id}`}
                    text="Job was cancelled on the server. This action cannot be retried."
                />
            ) : null}
            {item.isConflict && item.isCompletedOnServer ? (
                <Notice
                    color={theme.textSecondary}
                    icon="check-circle"
                    testID={`server-completed-notice-${item.id}`}
                    text="Job was completed on the server. This action cannot be retried."
                />
            ) : null}

            {item.isMissingAttachments && item.missingAttachmentUri ? (
                <Notice
                    color={theme.hazardRedText}
                    icon="camera"
                    testID={`missing-attachment-notice-${item.id}`}
                    text={`Missing file: ${item.missingAttachmentUri}`}
                />
            ) : null}

            {/* Unresolved items already explain this in their explanation. */}
            {item.isUncertainOutcome && !isUnresolved ? (
                <Notice
                    color={theme.warningOrangeText}
                    icon="alert"
                    testID={`uncertain-outcome-banner-${item.id}`}
                    text={
                        isUnresolved
                            ? 'Server outcome unresolved: reconcile the original command before changing or discarding its evidence.'
                            : 'Server outcome uncertain: timed out before central acknowledgement.'
                    }
                />
            ) : null}

            {!item.canDiscard && item.discardBlockReason && needsAction ? (
                <Notice
                    color={theme.textSecondary}
                    icon="shield"
                    testID={`discard-blocked-notice-${item.id}`}
                    text={item.discardBlockReason}
                />
            ) : null}

            {isSyncing && item.stage ? (
                <Text style={styles.meta}>{item.stage}</Text>
            ) : null}

            <View style={styles.metaRow}>
                <Text style={styles.meta}>
                    Created: {item.formattedCreatedAt}
                </Text>
                {item.attempts > 0 ? (
                    <Text style={styles.meta}>Attempts: {item.attempts}</Text>
                ) : null}
                {item.completedAt ? (
                    <Text style={styles.meta}>
                        Synced: {item.formattedCompletedAt}
                    </Text>
                ) : null}
            </View>

            {showActions ? (
                <View style={styles.actionsRow}>
                    {item.retryable && onRetryCommand ? (
                        <Pressable
                            accessibilityLabel={`Retry ${item.title}`}
                            accessibilityRole="button"
                            onPress={() => onRetryCommand(item.id)}
                            style={({ pressed }) => [
                                styles.button,
                                styles.secondaryButton,
                                pressed && styles.pressed,
                            ]}
                            testID={`outbox-retry-${item.id}`}
                        >
                            <Icon
                                color={theme.textPrimary}
                                name="sync"
                                size={16}
                            />
                            <Text style={styles.secondaryText}>Retry</Text>
                        </Pressable>
                    ) : null}

                    {item.isConflict && onAcceptServerState ? (
                        <Pressable
                            accessibilityLabel="Accept server state"
                            accessibilityRole="button"
                            onPress={() => onAcceptServerState(item.id)}
                            style={({ pressed }) => [
                                styles.button,
                                styles.secondaryButton,
                                pressed && styles.pressed,
                            ]}
                            testID={`outbox-accept-server-${item.id}`}
                        >
                            <Text style={styles.secondaryText}>
                                Accept Server
                            </Text>
                        </Pressable>
                    ) : null}

                    {item.isConflict &&
                    onRetryNewVersion &&
                    item.canRetryWithVersion &&
                    item.currentVersion ? (
                        <Pressable
                            accessibilityLabel="Retry with newer version"
                            accessibilityRole="button"
                            onPress={() =>
                                onRetryNewVersion(item.id, item.currentVersion!)
                            }
                            style={({ pressed }) => [
                                styles.button,
                                styles.secondaryButton,
                                pressed && styles.pressed,
                            ]}
                            testID={`outbox-retry-version-${item.id}`}
                        >
                            <Text style={styles.secondaryText}>
                                Retry v{item.currentVersion}
                            </Text>
                        </Pressable>
                    ) : null}

                    {item.isMissingAttachments &&
                    !isUnresolved &&
                    item.missingAttachmentUri &&
                    onRecaptureAttachment ? (
                        <Pressable
                            accessibilityLabel="Recapture missing photo"
                            accessibilityRole="button"
                            onPress={() =>
                                onRecaptureAttachment(
                                    item.id,
                                    item.missingAttachmentUri!,
                                )
                            }
                            style={({ pressed }) => [
                                styles.button,
                                styles.secondaryButton,
                                pressed && styles.pressed,
                            ]}
                            testID={`outbox-recapture-${item.id}`}
                        >
                            <Icon
                                color={theme.textPrimary}
                                name="camera"
                                size={16}
                            />
                            <Text style={styles.secondaryText}>
                                Recapture Photo
                            </Text>
                        </Pressable>
                    ) : null}

                    {item.isAuthenticationRequired && onSignIn ? (
                        <Pressable
                            accessibilityLabel="Sign in to re-authenticate"
                            accessibilityRole="button"
                            onPress={onSignIn}
                            style={({ pressed }) => [
                                styles.button,
                                styles.secondaryButton,
                                pressed && styles.pressed,
                            ]}
                            testID={`outbox-signin-${item.id}`}
                        >
                            <Text style={styles.secondaryText}>Sign In</Text>
                        </Pressable>
                    ) : null}

                    {item.canDiscard ? (
                        <Pressable
                            accessibilityLabel={`Discard ${item.title}`}
                            accessibilityRole="button"
                            onPress={onPromptDiscard}
                            style={({ pressed }) => [
                                styles.button,
                                styles.discardButton,
                                pressed && styles.pressed,
                            ]}
                            testID={`outbox-discard-${item.id}`}
                        >
                            <Text style={styles.discardText}>Discard</Text>
                        </Pressable>
                    ) : null}
                </View>
            ) : null}
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        card: {
            backgroundColor: theme.surface,
            borderRadius: 14,
            borderWidth: 1.5,
            gap: 8,
            marginBottom: 10,
            padding: 14,
        },
        headerRow: {
            alignItems: 'flex-start',
            flexDirection: 'row',
            gap: 8,
            justifyContent: 'space-between',
        },
        titleBlock: {
            flex: 1,
            minWidth: 0,
        },
        title: {
            color: theme.textPrimary,
            fontSize: 15,
            fontWeight: '700',
        },
        reference: {
            color: theme.textSecondary,
            fontSize: 13,
            marginTop: 2,
        },
        badge: {
            alignItems: 'center',
            borderRadius: 12,
            borderWidth: 1,
            flexDirection: 'row',
            flexShrink: 0,
            gap: 4,
            paddingHorizontal: 8,
            paddingVertical: 3,
        },
        badgeText: {
            fontSize: 12,
            fontWeight: '700',
        },
        explanation: {
            color: theme.textPrimary,
            fontSize: 14,
            lineHeight: 20,
        },
        notice: {
            alignItems: 'flex-start',
            flexDirection: 'row',
            gap: 6,
        },
        noticeText: {
            flex: 1,
            fontSize: 13,
            lineHeight: 18,
        },
        metaRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 12,
        },
        meta: {
            color: theme.textSecondary,
            fontSize: 12,
        },
        actionsRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            marginTop: 4,
        },
        button: {
            alignItems: 'center',
            borderRadius: 10,
            flexDirection: 'row',
            gap: 6,
            justifyContent: 'center',
            minHeight: 48,
            paddingHorizontal: 14,
        },
        secondaryButton: {
            backgroundColor: theme.surface,
            borderColor: theme.borderStrong,
            borderWidth: 1,
        },
        secondaryText: {
            color: theme.textPrimary,
            fontSize: 14,
            fontWeight: '700',
        },
        discardButton: {
            backgroundColor: theme.surface,
            borderColor: theme.hazardRed,
            borderWidth: 1,
        },
        discardText: {
            color: theme.hazardRedText,
            fontSize: 14,
            fontWeight: '700',
        },
        pressed: {
            opacity: 0.8,
        },
    });
