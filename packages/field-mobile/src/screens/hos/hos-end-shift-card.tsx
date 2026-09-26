import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/common/Icon';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import type { DutyStatus, ShiftInfo } from '../../types/index';
import { createHosSharedStyles } from './hos-shared-styles';

export interface HosEndShiftCardProps {
    executeDutyUpdate: (statusToSet?: DutyStatus) => Promise<void>;
    linkedAssetCode: string | null;
    onEndShift: (() => void) | undefined;
    onToggleShift: ((nextStatus: 'on_shift' | 'off_shift') => void) | undefined;
    selectedStatus: DutyStatus;
    setSafeguardModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setSelectedStatus: (status: DutyStatus) => void;
    shiftInfo: ShiftInfo;
}

export const HosEndShiftCard: React.FC<HosEndShiftCardProps> = ({
    executeDutyUpdate,
    linkedAssetCode,
    onEndShift,
    onToggleShift,
    selectedStatus,
    setSafeguardModalOpen,
    setSelectedStatus,
    shiftInfo,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const hosSharedStyles = useThemedStyles(createHosSharedStyles);

    return (
        <View
            style={[hosSharedStyles.sectionCard, styles.endShiftCard]}
            testID="hos-end-shift-card"
        >
            <View style={styles.endShiftHeaderRow}>
                <View style={[styles.endShiftIconBadge]}>
                    <Icon color={theme.textPrimary} name="power" size={20} />
                </View>
                <View style={styles.endShiftHeaderCopy}>
                    <Text
                        accessibilityRole="header"
                        style={[hosSharedStyles.sectionTitle]}
                    >
                        END SHIFT &amp; CLOCK OUT
                    </Text>
                    <Text style={[hosSharedStyles.sectionHelper]}>
                        Compliant DOLE-OSHC &amp; DOT ELD shift closure.
                        Releases linked equipment proxy and begins mandatory
                        10-hour daily rest period.
                    </Text>
                </View>
            </View>

            {linkedAssetCode ? (
                <View style={[styles.linkedAssetPill]}>
                    <Icon color={theme.textSecondary} name="crane" size={14} />
                    <Text style={[styles.linkedAssetPillText]}>
                        Linked Equipment: {linkedAssetCode}
                    </Text>
                </View>
            ) : null}

            {selectedStatus === 'off_duty' ||
            shiftInfo.status === 'off_shift' ? (
                <View
                    style={[styles.shiftCompletedNotice]}
                    testID="shift-completed-notice"
                >
                    <Icon
                        color={theme.successEmerald}
                        name="check-circle"
                        size={18}
                    />
                    <Text style={[styles.shiftCompletedNoticeText]}>
                        Shift Closed &amp; Off Duty · 10h Daily Rest Active
                    </Text>
                </View>
            ) : (
                <Pressable
                    accessibilityLabel="End shift and clock out"
                    accessibilityRole="button"
                    onPress={() => {
                        if (linkedAssetCode) {
                            setSafeguardModalOpen(true);
                        } else {
                            setSelectedStatus('off_duty');
                            executeDutyUpdate('off_duty');
                            onToggleShift?.('off_shift');
                            onEndShift?.();
                        }
                    }}
                    style={({ pressed }) => [
                        styles.endShiftBtn,
                        pressed && hosSharedStyles.actionButtonPressed,
                    ]}
                    testID="hos-end-shift-btn"
                >
                    <Icon color={theme.surfaceDark} name="power" size={18} />
                    <Text style={styles.endShiftBtnText}>
                        End Shift &amp; Clock Out
                    </Text>
                </Pressable>
            )}
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        endShiftBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            backgroundColor: theme.brandAmber,
            borderRadius: 12,
            minHeight: 52,
        },
        endShiftBtnText: {
            color: theme.surfaceDark,
            fontSize: 15,
            fontWeight: '700',
            letterSpacing: 0.2,
        },
        endShiftCard: {
            borderColor: theme.border,
            borderWidth: 1,
        },
        endShiftHeaderCopy: {
            flex: 1,
        },
        endShiftHeaderRow: {
            flexDirection: 'row',
            gap: 12,
            alignItems: 'flex-start',
            marginBottom: 12,
        },
        endShiftIconBadge: {
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: theme.surfaceHighlight,
            alignItems: 'center',
            justifyContent: 'center',
        },
        linkedAssetPill: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            alignSelf: 'flex-start',
            backgroundColor: theme.surfaceHighlight,
            borderColor: theme.border,
            borderWidth: 1,
            borderRadius: 9999,
            paddingHorizontal: 10,
            paddingVertical: 4,
            marginBottom: 14,
        },
        linkedAssetPillText: {
            color: theme.textPrimary,
            fontSize: 12,
            fontWeight: '700',
        },
        shiftCompletedNotice: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: theme.successEmeraldLight,
            borderColor: theme.successEmerald,
            borderWidth: 1,
            borderRadius: 12,
            padding: 12,
        },
        shiftCompletedNoticeText: {
            color: theme.successEmeraldText,
            fontSize: 13,
            fontWeight: '700',
        },
    });
