import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme, useThemedStyles } from '../../../theme';
import type { ThemeColors } from '../../../theme';
import { Icon } from '../../common/Icon';

export interface DvirDefectNoticeProps {
    onOpenDvir?: () => void;
}

/**
 * Shown when an equipment delay is chosen: a delay report explains a hold-up
 * to dispatch but is not a defect report and never triggers a safety lockout.
 */
export const DvirDefectNotice: React.FC<DvirDefectNoticeProps> = ({
    onOpenDvir,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);

    return (
        <View style={styles.noticeBox} testID="dvir-cross-reference-notice">
            <View style={styles.noticeHeader}>
                <Icon
                    color={theme.warningOrangeText}
                    name="alert-circle"
                    size={16}
                />
                <Text style={styles.noticeTitle}>Equipment Defect Notice</Text>
            </View>
            <Text style={styles.noticeBody}>
                Reporting a delay explains operational hold-up to dispatch. A
                delay report does NOT replace a DVIR defect report and will not
                trigger a safety lockout.
            </Text>
            {onOpenDvir ? (
                <Pressable
                    accessibilityLabel="Open DVIR walkaround inspection"
                    accessibilityRole="button"
                    onPress={onOpenDvir}
                    style={styles.linkBtn}
                    testID="go-to-dvir-btn"
                >
                    <Icon
                        color={theme.textPrimary}
                        name="shield-check"
                        size={16}
                    />
                    <Text style={styles.linkBtnText}>
                        Go to DVIR Pre/Post-Trip Inspection
                    </Text>
                </Pressable>
            ) : null}
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        noticeBox: {
            backgroundColor: theme.warningOrangeLight,
            borderColor: theme.warningOrange,
            borderRadius: 10,
            borderWidth: 1,
            marginTop: 12,
            padding: 12,
        },
        noticeHeader: {
            alignItems: 'center',
            flexDirection: 'row',
            gap: 6,
            marginBottom: 4,
        },
        noticeTitle: {
            color: theme.warningOrangeText,
            fontSize: 13,
            fontWeight: '700',
        },
        noticeBody: {
            color: theme.textPrimary,
            fontSize: 13,
            lineHeight: 18,
        },
        linkBtn: {
            alignItems: 'center',
            backgroundColor: theme.surface,
            borderColor: theme.borderStrong,
            borderRadius: 10,
            borderWidth: 1,
            flexDirection: 'row',
            gap: 6,
            justifyContent: 'center',
            marginTop: 10,
            minHeight: 48,
            paddingHorizontal: 12,
        },
        linkBtnText: {
            color: theme.textPrimary,
            fontSize: 14,
            fontWeight: '700',
        },
    });
