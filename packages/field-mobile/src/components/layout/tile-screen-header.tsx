import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { Icon } from '../common/Icon';
import { colors, shadows } from '../nativeStyles';

export interface TileScreenHeaderProps {
    category?: string;
    title: string;
    subtitle?: string | React.ReactNode;
    onBack?: () => void;
    backTestID?: string;
    backAccessibilityLabel?: string;
    backAccessibilityHint?: string;
    rightElement?: React.ReactNode;
    subtitleNumberOfLines?: number;
    titleTestID?: string;
    testID?: string;
    style?: StyleProp<ViewStyle>;
    categoryColor?: string;
}

export const TileScreenHeader: React.FC<TileScreenHeaderProps> = ({
    category,
    title,
    subtitle,
    onBack,
    backTestID = 'tile-header-back-btn',
    backAccessibilityLabel = 'Back',
    backAccessibilityHint = 'Returns to previous screen',
    rightElement,
    subtitleNumberOfLines = 2,
    titleTestID,
    testID = 'tile-screen-header',
    style,
    categoryColor,
}) => {
    const { isDarkHud } = useTheme();

    return (
        <View
            style={[styles.headerBar, isDarkHud && styles.darkHeaderBar, style]}
            testID={testID}
        >
            <View style={styles.headerContentRow}>
                {onBack ? (
                    <Pressable
                        accessibilityHint={backAccessibilityHint}
                        accessibilityLabel={backAccessibilityLabel}
                        accessibilityRole="button"
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        onPress={onBack}
                        style={({ pressed }) => [
                            styles.backButton,
                            isDarkHud && styles.darkBackButton,
                            pressed && styles.backButtonPressed,
                        ]}
                        testID={backTestID}
                    >
                        <Icon
                            color={isDarkHud ? colors.hudText : colors.text}
                            name="back"
                            size={18}
                        />
                    </Pressable>
                ) : null}

                <View style={styles.titleBlock}>
                    {category ? (
                        <Text
                            numberOfLines={1}
                            style={[
                                styles.categoryText,
                                isDarkHud && styles.darkCategoryText,
                                categoryColor ? { color: categoryColor } : null,
                            ]}
                        >
                            {category}
                        </Text>
                    ) : null}
                    <Text
                        accessibilityRole="header"
                        numberOfLines={2}
                        style={[
                            styles.titleText,
                            isDarkHud && styles.darkTitleText,
                        ]}
                        testID={titleTestID}
                    >
                        {title}
                    </Text>
                    {subtitle ? (
                        typeof subtitle === 'string' ? (
                            <Text
                                numberOfLines={subtitleNumberOfLines}
                                style={[
                                    styles.subtitleText,
                                    isDarkHud && styles.darkSubtitleText,
                                ]}
                            >
                                {subtitle}
                            </Text>
                        ) : (
                            subtitle
                        )
                    ) : null}
                </View>

                {rightElement ? (
                    <View style={styles.rightSlot}>{rightElement}</View>
                ) : null}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    headerBar: {
        backgroundColor: colors.surface,
        borderBottomColor: colors.border,
        borderBottomWidth: 1,
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    darkHeaderBar: {
        backgroundColor: colors.surfaceDark,
        borderBottomColor: colors.hudBorder,
    },
    headerContentRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 12,
    },
    backButton: {
        alignItems: 'center',
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 10,
        borderWidth: 1,
        flexShrink: 0,
        height: 48,
        justifyContent: 'center',
        width: 48,
        ...shadows.sm,
    },
    darkBackButton: {
        backgroundColor: colors.hudSurface,
        borderColor: colors.hudBorder,
    },
    backButtonPressed: {
        opacity: 0.75,
        transform: [{ scale: 0.92 }],
    },
    titleBlock: {
        flex: 1,
        justifyContent: 'center',
        minWidth: 0,
    },
    categoryText: {
        color: colors.amberDark,
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.8,
        marginBottom: 1,
        textTransform: 'uppercase',
    },
    darkCategoryText: {
        color: colors.hudAccent,
    },
    titleText: {
        color: colors.text,
        fontSize: 17,
        fontWeight: '800',
        letterSpacing: -0.3,
        lineHeight: 22,
    },
    darkTitleText: {
        color: colors.hudText,
    },
    subtitleText: {
        color: colors.muted,
        fontSize: 12,
        fontWeight: '500',
        lineHeight: 16,
        marginTop: 1,
    },
    darkSubtitleText: {
        color: colors.hudTextDim,
    },
    rightSlot: {
        alignItems: 'center',
        flexDirection: 'row',
        flexShrink: 0,
        justifyContent: 'flex-end',
    },
});
