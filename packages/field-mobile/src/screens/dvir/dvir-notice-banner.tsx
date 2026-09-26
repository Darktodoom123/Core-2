import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';

export interface DvirNoticeBannerProps {
    message: string;
    testID: string;
}

/** Blocking warning shown above the form when no asset can be inspected. */
export const DvirNoticeBanner: React.FC<DvirNoticeBannerProps> = ({
    message,
    testID,
}) => {
    const styles = useThemedStyles(createStyles);

    return (
        <View
            accessibilityRole="alert"
            style={[styles.noAssetBanner]}
            testID={testID}
        >
            <Text style={[styles.noAssetBannerText]}>{message}</Text>
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        noAssetBanner: {
            backgroundColor: theme.warningOrangeLight,
            borderColor: theme.warningOrange,
            borderRadius: 12,
            borderWidth: 1,
            marginHorizontal: 16,
            marginTop: 10,
            padding: 12,
        },
        noAssetBannerText: {
            color: theme.warningOrangeText,
            fontSize: 13,
            fontWeight: '600',
            textAlign: 'center',
        },
    });
