import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';

export interface DvirNoticeBannerProps {
    message: string;
    testID: string;
}

/** Blocking notice shown above the form when no asset can be inspected. */
export const DvirNoticeBanner: React.FC<DvirNoticeBannerProps> = ({
    message,
    testID,
}) => {
    const { isDarkHud } = useTheme();

    return (
        <View
            accessibilityRole="alert"
            style={[
                styles.noAssetBanner,
                isDarkHud && styles.darkNoAssetBanner,
            ]}
            testID={testID}
        >
            <Text
                style={[
                    styles.noAssetBannerText,
                    isDarkHud && styles.darkNoAssetBannerText,
                ]}
            >
                {message}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    noAssetBanner: {
        backgroundColor: '#FFF3C4',
        borderColor: '#FFBF00',
        borderRadius: 8,
        borderWidth: 1,
        marginHorizontal: 16,
        marginTop: 10,
        padding: 12,
    },
    darkNoAssetBanner: {
        backgroundColor: '#332800',
        borderColor: '#FFBF00',
    },
    noAssetBannerText: {
        color: '#806000',
        fontSize: 13,
        fontWeight: '600',
        textAlign: 'center',
    },
    darkNoAssetBannerText: {
        color: '#FFBF00',
    },
});
