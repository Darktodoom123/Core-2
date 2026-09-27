import React, {
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';
import {
    Animated,
    Modal,
    PanResponder,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { projectOutbox } from '../../services/outboxProjection';
import type {
    OutboxItemDisplay,
    OutboxProjection,
} from '../../services/outboxProjection';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import type { OutboxCommand } from '../../types/index';
import { Icon } from '../common/Icon';
import { OutboxDiscardDialog } from './outbox/outbox-discard-dialog';
import { OutboxItemCard } from './outbox/outbox-item-card';
import type { OutboxItemCardProps } from './outbox/outbox-item-card';
import {
    OutboxFilterTabs,
    OutboxSummary,
    OutboxTelemetryCard,
} from './outbox/outbox-summary';
import type { OutboxFilterTab } from './outbox/outbox-summary';

export interface OutboxStatusSheetProps {
    visible: boolean;
    onClose: () => void;
    commands: OutboxCommand[];
    isOnline: boolean | null;
    isAuthenticated?: boolean;
    lastSuccessfulSyncAt?: string | null;
    userName?: string | null;
    userRole?: string | null;
    onSyncNow?: () => void;
    onRetryCommand?: (commandId: string) => void;
    onDiscardCommand?: (commandId: string) => void;
    onAcceptServerState?: (commandId: string) => void;
    onRetryNewVersion?: (commandId: string, newVersion: number) => void;
    onSignIn?: () => void;
    onRecaptureAttachment?: (commandId: string, oldUri: string) => void;
}

const EMPTY_COPY: Record<OutboxFilterTab | 'clear', [string, string]> = {
    clear: [
        'Nothing waiting to send',
        'Inspections, handovers and other field actions have all reached dispatch.',
    ],
    attention: [
        'No actions require attention',
        'Everything saved is sending normally.',
    ],
    waiting: [
        'Nothing waiting',
        'There are no actions saved on this phone waiting to send.',
    ],
    completed: [
        'Nothing sent recently',
        'Actions appear here after dispatch receives them.',
    ],
    all: ['', ''],
};

/**
 * Everything saved on this phone that has not yet reached dispatch, and what
 * to do about each item. Opened from the header status pill.
 */
export const OutboxStatusSheet: React.FC<OutboxStatusSheetProps> = ({
    visible,
    onClose,
    commands,
    isOnline,
    isAuthenticated = true,
    lastSuccessfulSyncAt,
    userName,
    userRole,
    onSyncNow,
    onRetryCommand,
    onDiscardCommand,
    onAcceptServerState,
    onRetryNewVersion,
    onSignIn,
    onRecaptureAttachment,
}) => {
    const { theme, isDarkHud } = useTheme();
    const styles = useThemedStyles(createStyles);
    const insets = useContext(SafeAreaInsetsContext);
    const bottomInset = insets?.bottom ?? 0;
    const [activeFilter, setActiveFilter] = useState<OutboxFilterTab>('all');
    const [commandToDiscard, setCommandToDiscard] =
        useState<OutboxItemDisplay | null>(null);

    const projection: OutboxProjection = useMemo(
        () =>
            projectOutbox(
                commands,
                isOnline,
                isAuthenticated,
                undefined,
                lastSuccessfulSyncAt,
            ),
        [commands, isOnline, isAuthenticated, lastSuccessfulSyncAt],
    );

    const panY = useMemo(() => new Animated.Value(0), []);

    useEffect(() => {
        if (visible) {
            panY.setValue(0);
        }
    }, [visible, panY]);

    const handleClose = useCallback(() => {
        setActiveFilter('all');
        setCommandToDiscard(null);
        onClose();
    }, [onClose]);

    const panResponder = useMemo(
        () =>
            PanResponder.create({
                onStartShouldSetPanResponder: () => false,
                onMoveShouldSetPanResponder: (_, gestureState) =>
                    gestureState.dy > 8 && Math.abs(gestureState.dx) < 20,
                onPanResponderMove: (_, gestureState) => {
                    if (gestureState.dy > 0) {
                        panY.setValue(gestureState.dy);
                    }
                },
                onPanResponderRelease: (_, gestureState) => {
                    if (gestureState.dy > 80 || gestureState.vy > 0.5) {
                        Animated.timing(panY, {
                            duration: 150,
                            toValue: 500,
                            useNativeDriver: true,
                        }).start(() => {
                            handleClose();
                            panY.setValue(0);
                        });
                    } else {
                        Animated.spring(panY, {
                            bounciness: 4,
                            toValue: 0,
                            useNativeDriver: true,
                        }).start();
                    }
                },
            }),
        [handleClose, panY],
    );

    const scrimOpacity = panY.interpolate({
        inputRange: [0, 250],
        outputRange: [isDarkHud ? 0.75 : 0.45, 0],
        extrapolate: 'clamp',
    });

    const show = (tab: OutboxFilterTab) =>
        activeFilter === 'all' || activeFilter === tab;
    const attention = show('attention') ? projection.sections.attention : [];
    const active = show('waiting') ? projection.sections.active : [];
    const completed = show('completed')
        ? projection.sections.recentCompleted
        : [];
    const telemetry = show('waiting') ? projection.sections.telemetry : null;
    const isEmptyView =
        attention.length === 0 &&
        active.length === 0 &&
        completed.length === 0 &&
        !telemetry;
    const [emptyTitle, emptyBody] =
        EMPTY_COPY[
            projection.counts.totalActive === 0 ? 'clear' : activeFilter
        ];

    const cardHandlers: Omit<OutboxItemCardProps, 'item' | 'onPromptDiscard'> =
        {
            onAcceptServerState,
            onRecaptureAttachment,
            onRetryCommand,
            onRetryNewVersion,
            onSignIn,
        };

    const renderSection = (
        items: OutboxItemDisplay[],
        heading: string,
        testID: string,
    ) =>
        items.length > 0 ? (
            <View style={styles.section} testID={testID}>
                <Text style={styles.sectionHeader}>{heading}</Text>
                {items.map((item) => (
                    <OutboxItemCard
                        {...cardHandlers}
                        item={item}
                        key={item.id}
                        onPromptDiscard={() => setCommandToDiscard(item)}
                    />
                ))}
            </View>
        ) : null;

    return (
        <Modal
            animationType="slide"
            onRequestClose={handleClose}
            statusBarTranslucent
            transparent
            visible={visible}
        >
            <View
                accessibilityViewIsModal
                style={styles.modalRoot}
                testID="outbox-status-sheet"
            >
                <Animated.View
                    style={[
                        StyleSheet.absoluteFill,
                        {
                            backgroundColor: theme.surfaceDark,
                            opacity: scrimOpacity,
                        },
                    ]}
                >
                    <Pressable
                        accessibilityLabel="Close outbox sheet backdrop"
                        accessibilityRole="button"
                        onPress={handleClose}
                        style={StyleSheet.absoluteFill}
                        testID="outbox-sheet-dismiss"
                    />
                </Animated.View>

                <Animated.View
                    style={[
                        styles.sheet,
                        {
                            paddingBottom: Math.max(24, bottomInset + 16),
                            transform: [{ translateY: panY }],
                        },
                    ]}
                >
                    <View {...panResponder.panHandlers} style={styles.dragZone}>
                        <View style={styles.handle} />
                        <View style={styles.headerRow}>
                            <View style={styles.headerIcon}>
                                <Icon
                                    color={theme.textPrimary}
                                    name="sync"
                                    size={20}
                                />
                            </View>
                            <View style={styles.headerText}>
                                <Text
                                    accessibilityRole="header"
                                    style={styles.title}
                                >
                                    Saved actions
                                </Text>
                                <Text style={styles.subtitle}>
                                    {userName ? `${userName} · ` : ''}
                                    {userRole || 'Field Operator'}
                                </Text>
                            </View>
                            <Pressable
                                accessibilityHint="Closes saved actions"
                                accessibilityLabel="Close outbox sheet"
                                accessibilityRole="button"
                                onPress={handleClose}
                                style={({ pressed }) => [
                                    styles.closeButton,
                                    pressed && styles.pressed,
                                ]}
                                testID="outbox-sheet-close-btn"
                            >
                                <Icon
                                    color={theme.textSecondary}
                                    name="close"
                                    size={20}
                                />
                            </Pressable>
                        </View>
                    </View>

                    <View style={styles.body}>
                        <OutboxSummary
                            isOnline={isOnline}
                            onSyncNow={onSyncNow}
                            projection={projection}
                        />
                        <OutboxFilterTabs
                            active={activeFilter}
                            onChange={setActiveFilter}
                            projection={projection}
                        />
                    </View>

                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        style={styles.scrollView}
                        testID="outbox-items-list"
                    >
                        {isEmptyView ? (
                            <View
                                style={styles.emptyState}
                                testID="outbox-empty-state"
                            >
                                <Icon
                                    color={theme.successEmeraldText}
                                    name="check-circle"
                                    size={32}
                                />
                                <Text style={styles.emptyTitle}>
                                    {emptyTitle}
                                </Text>
                                <Text style={styles.emptyBody}>
                                    {emptyBody}
                                </Text>
                            </View>
                        ) : null}

                        {renderSection(
                            attention,
                            'NEEDS ATTENTION',
                            'outbox-section-attention',
                        )}
                        {renderSection(
                            active,
                            'WAITING AND SENDING',
                            'outbox-section-active',
                        )}
                        {telemetry ? (
                            <OutboxTelemetryCard count={telemetry.count} />
                        ) : null}
                        {renderSection(
                            completed,
                            'RECENTLY SYNCED',
                            'outbox-section-completed',
                        )}
                    </ScrollView>
                </Animated.View>

                {commandToDiscard ? (
                    <OutboxDiscardDialog
                        item={commandToDiscard}
                        onCancel={() => setCommandToDiscard(null)}
                        onConfirm={() => {
                            onDiscardCommand?.(commandToDiscard.id);
                            setCommandToDiscard(null);
                        }}
                    />
                ) : null}
            </View>
        </Modal>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        modalRoot: {
            flex: 1,
            justifyContent: 'flex-end',
        },
        // Floating layer: carries the shadow.
        sheet: {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            borderTopWidth: 1,
            elevation: 16,
            maxHeight: '90%',
            minHeight: '50%',
            overflow: 'hidden',
        },
        dragZone: {
            paddingBottom: 12,
            paddingHorizontal: 18,
            paddingTop: 10,
        },
        handle: {
            alignSelf: 'center',
            backgroundColor: theme.borderStrong,
            borderRadius: 3,
            height: 5,
            marginBottom: 12,
            width: 40,
        },
        headerRow: {
            alignItems: 'center',
            flexDirection: 'row',
            gap: 12,
        },
        headerIcon: {
            alignItems: 'center',
            backgroundColor: theme.surfaceHighlight,
            borderRadius: 12,
            height: 44,
            justifyContent: 'center',
            width: 44,
        },
        headerText: {
            flex: 1,
            minWidth: 0,
        },
        title: {
            color: theme.textPrimary,
            fontSize: 19,
            fontWeight: '700',
        },
        subtitle: {
            color: theme.textSecondary,
            fontSize: 13,
            marginTop: 2,
        },
        closeButton: {
            alignItems: 'center',
            backgroundColor: theme.surfaceHighlight,
            borderRadius: 24,
            height: 48,
            justifyContent: 'center',
            width: 48,
        },
        pressed: {
            opacity: 0.8,
        },
        body: {
            paddingHorizontal: 18,
        },
        scrollView: {
            flexGrow: 0,
        },
        scrollContent: {
            paddingBottom: 12,
            paddingHorizontal: 18,
        },
        section: {
            marginBottom: 8,
        },
        sectionHeader: {
            color: theme.textSecondary,
            fontSize: 12,
            fontWeight: '700',
            letterSpacing: 0.6,
            marginBottom: 8,
        },
        emptyState: {
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 16,
            paddingVertical: 28,
        },
        emptyTitle: {
            color: theme.textPrimary,
            fontSize: 16,
            fontWeight: '700',
            textAlign: 'center',
        },
        emptyBody: {
            color: theme.textSecondary,
            fontSize: 14,
            lineHeight: 20,
            textAlign: 'center',
        },
    });
