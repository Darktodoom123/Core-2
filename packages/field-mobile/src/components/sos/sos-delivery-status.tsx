import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { SosDeliveryState } from '../../types/index';
import { Icon } from '../common/Icon';
import { colors } from '../nativeStyles';

const STATUS_COPY: Record<
    SosDeliveryState,
    { icon: 'alert' | 'check' | 'sync' | 'clock'; label: string; tone: string }
> = {
    preparing: { icon: 'clock', label: 'Preparing', tone: colors.warningDark },
    sending: { icon: 'sync', label: 'Sending', tone: colors.warningDark },
    delivered: { icon: 'check', label: 'Delivered', tone: colors.greenDark },
    acknowledged: {
        icon: 'check',
        label: 'Acknowledged',
        tone: colors.greenDark,
    },
    escalated: { icon: 'alert', label: 'Escalated', tone: colors.redDark },
    not_delivered_offline: {
        icon: 'alert',
        label: 'Not delivered — offline',
        tone: colors.redDark,
    },
    retrying: { icon: 'sync', label: 'Retrying', tone: colors.warningDark },
    expired: {
        icon: 'alert',
        label: 'Expired — not delivered',
        tone: colors.redDark,
    },
    resolved: { icon: 'check', label: 'Resolved', tone: colors.greenDark },
    cancelled: { icon: 'check', label: 'Cancelled', tone: colors.secondary },
};

export const SosDeliveryStatus: React.FC<{
    state: SosDeliveryState;
    detail?: string | null;
}> = ({ state, detail }) => {
    const copy = STATUS_COPY[state];

    return (
        <View
            accessible
            accessibilityLiveRegion="assertive"
            accessibilityRole="summary"
            style={[styles.container, { borderColor: copy.tone }]}
            testID="sos-delivery-status"
        >
            <View style={[styles.mark, { backgroundColor: copy.tone }]}>
                <Icon color={colors.white} name={copy.icon} size={14} />
            </View>
            <View style={styles.copy}>
                <Text selectable style={[styles.label, { color: copy.tone }]}>
                    {copy.label}
                </Text>
                {detail ? (
                    <Text selectable style={styles.detail}>
                        {detail}
                    </Text>
                ) : null}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 10,
        padding: 12,
    },
    mark: {
        alignItems: 'center',
        borderRadius: 12,
        height: 28,
        justifyContent: 'center',
        width: 28,
    },
    copy: {
        flex: 1,
        gap: 2,
    },
    label: {
        fontSize: 15,
        fontWeight: '800',
    },
    detail: {
        color: colors.secondary,
        fontSize: 13,
        lineHeight: 18,
    },
});
