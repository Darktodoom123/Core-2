import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/common/Icon';
import { useTheme } from '../../theme';
import type { DutyStatus, ShiftInfo } from '../../types/index';
import { hosSharedStyles } from './hos-shared-styles';

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
    const { isDarkHud } = useTheme();

    return (
        <View
            style={[
                hosSharedStyles.sectionCard,
                styles.endShiftCard,
                isDarkHud && hosSharedStyles.darkSectionCard,
                isDarkHud && styles.darkEndShiftCard,
            ]}
            testID="hos-end-shift-card"
        >
            <View style={styles.endShiftHeaderRow}>
                <View
                    style={[
                        styles.endShiftIconBadge,
                        isDarkHud && styles.darkEndShiftIconBadge,
                    ]}
                >
                    <Icon
                        color={isDarkHud ? '#F87171' : '#DC2626'}
                        name="power"
                        size={20}
                    />
                </View>
                <View style={styles.endShiftHeaderCopy}>
                    <Text
                        accessibilityRole="header"
                        style={[
                            hosSharedStyles.sectionTitle,
                            isDarkHud && hosSharedStyles.darkSectionTitle,
                        ]}
                    >
                        END SHIFT &amp; CLOCK OUT
                    </Text>
                    <Text
                        style={[
                            hosSharedStyles.sectionHelper,
                            isDarkHud && hosSharedStyles.darkSectionHelper,
                        ]}
                    >
                        Compliant DOLE-OSHC &amp; DOT ELD shift closure.
                        Releases linked equipment proxy and begins mandatory
                        10-hour daily rest period.
                    </Text>
                </View>
            </View>

            {linkedAssetCode ? (
                <View
                    style={[
                        styles.linkedAssetPill,
                        isDarkHud && styles.darkLinkedAssetPill,
                    ]}
                >
                    <Icon
                        color={isDarkHud ? '#FFBF00' : '#806000'}
                        name="crane"
                        size={14}
                    />
                    <Text
                        style={[
                            styles.linkedAssetPillText,
                            isDarkHud && styles.darkLinkedAssetPillText,
                        ]}
                    >
                        Linked Equipment: {linkedAssetCode}
                    </Text>
                </View>
            ) : null}

            {selectedStatus === 'off_duty' ||
            shiftInfo.status === 'off_shift' ? (
                <View
                    style={[
                        styles.shiftCompletedNotice,
                        isDarkHud && styles.darkShiftCompletedNotice,
                    ]}
                    testID="shift-completed-notice"
                >
                    <Icon
                        color={isDarkHud ? '#34D399' : '#059669'}
                        name="check-circle"
                        size={18}
                    />
                    <Text
                        style={[
                            styles.shiftCompletedNoticeText,
                            isDarkHud && styles.darkShiftCompletedNoticeText,
                        ]}
                    >
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
                        isDarkHud && styles.darkEndShiftBtn,
                        pressed && hosSharedStyles.actionButtonPressed,
                    ]}
                    testID="hos-end-shift-btn"
                >
                    <Icon color="#FFFFFF" name="power" size={18} />
                    <Text style={styles.endShiftBtnText}>
                        End Shift &amp; Clock Out
                    </Text>
                </Pressable>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    darkEndShiftBtn: {
        backgroundColor: '#B91C1C',
    },
    darkEndShiftCard: {
        borderColor: 'rgba(239, 68, 68, 0.4)',
    },
    darkEndShiftIconBadge: {
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
    },
    darkLinkedAssetPill: {
        backgroundColor: 'rgba(255, 191, 0, 0.15)',
        borderColor: 'rgba(255, 191, 0, 0.3)',
    },
    darkLinkedAssetPillText: {
        color: '#FFBF00',
    },
    darkShiftCompletedNotice: {
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        borderColor: 'rgba(16, 185, 129, 0.3)',
    },
    darkShiftCompletedNoticeText: {
        color: '#34D399',
    },
    endShiftBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#DC2626',
        borderRadius: 12,
        paddingVertical: 14,
    },
    endShiftBtnText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
    endShiftCard: {
        borderColor: '#FECACA',
        borderWidth: 1.5,
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
        backgroundColor: '#FEE2E2',
        alignItems: 'center',
        justifyContent: 'center',
    },
    linkedAssetPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
        backgroundColor: '#FFF3C4',
        borderColor: '#FFF3C4',
        borderWidth: 1,
        borderRadius: 9999,
        paddingHorizontal: 10,
        paddingVertical: 4,
        marginBottom: 14,
    },
    linkedAssetPillText: {
        color: '#806000',
        fontSize: 12,
        fontWeight: '700',
    },
    shiftCompletedNotice: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#ECFDF5',
        borderColor: '#A7F3D0',
        borderWidth: 1,
        borderRadius: 10,
        padding: 12,
    },
    shiftCompletedNoticeText: {
        color: '#065F46',
        fontSize: 13,
        fontWeight: '700',
    },
});
