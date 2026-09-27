import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/common/Icon';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import type { EndShiftStep } from './hos-end-shift';

export interface HosEndShiftNoticeProps {
    assetCode: string;
    step: EndShiftStep;
}

/** Says, before confirming, what ending the shift does to the linked machine. */
export const HosEndShiftNotice: React.FC<HosEndShiftNoticeProps> = ({
    assetCode,
    step,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const done = step === 'release';

    return (
        <View
            style={[styles.card, done ? styles.cardDone : null]}
            testID="hos-end-shift-notice"
        >
            <Icon
                color={done ? theme.successEmeraldText : theme.textPrimary}
                name={done ? 'check-circle' : 'crane'}
                size={20}
            />
            <View style={styles.copy}>
                <Text style={styles.title}>
                    {done
                        ? 'Post-trip inspection done'
                        : `You're linked to ${assetCode}`}
                </Text>
                <Text style={styles.body}>
                    {done
                        ? `Ending your shift releases ${assetCode} and turns off tracking.`
                        : `Do the post-trip inspection first. Then ${assetCode} is released and your shift ends.`}
                </Text>
            </View>
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        card: {
            alignItems: 'flex-start',
            backgroundColor: theme.surfaceHighlight,
            borderColor: theme.borderStrong,
            borderRadius: 12,
            borderWidth: 1,
            flexDirection: 'row',
            gap: 10,
            marginBottom: 16,
            padding: 14,
        },
        cardDone: {
            backgroundColor: theme.successEmeraldLight,
            borderColor: theme.successEmerald,
        },
        copy: {
            flex: 1,
            gap: 4,
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
    });
