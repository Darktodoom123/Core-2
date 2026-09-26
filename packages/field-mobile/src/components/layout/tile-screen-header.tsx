import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import { Icon } from '../common/Icon';

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
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);

    return (
        <View style={[styles.headerBar, style]} testID={testID}>
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
                            pressed && styles.backButtonPressed,
                        ]}
                        testID={backTestID}
                    >
                        <Icon color={theme.textPrimary} name="back" size={18} />
                    </Pressable>
                ) : null}

                <View style={styles.titleBlock}>
                    {category ? (
                        <Text numberOfLines={1} style={styles.categoryText}>
                            {category}
                        </Text>
                    ) : null}
                    <Text
                        accessibilityRole="header"
                        numberOfLines={2}
                        style={styles.titleText}
                        testID={titleTestID}
                    >
                        {title}
                    </Text>
                    {subtitle ? (
                        typeof subtitle === 'string' ? (
                            <Text
                                numberOfLines={subtitleNumberOfLines}
                                style={styles.subtitleText}
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

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        headerBar: {
            backgroundColor: theme.surface,
            borderBottomColor: theme.border,
            borderBottomWidth: 1,
            paddingHorizontal: 16,
            paddingVertical: 10,
        },
        headerContentRow: {
            alignItems: 'center',
            flexDirection: 'row',
            gap: 12,
        },
        // Resting control: border only, no shadow.
        backButton: {
            alignItems: 'center',
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderRadius: 12,
            borderWidth: 1,
            flexShrink: 0,
            height: 48,
            justifyContent: 'center',
            width: 48,
        },
        backButtonPressed: {
            opacity: 0.75,
            transform: [{ scale: 0.96 }],
        },
        titleBlock: {
            flex: 1,
            justifyContent: 'center',
            minWidth: 0,
        },
        // Eyebrow label is wayfinding, not an action, so it stays ink.
        categoryText: {
            color: theme.textSecondary,
            fontSize: 12,
            fontWeight: '700',
            letterSpacing: 0.8,
            marginBottom: 1,
            textTransform: 'uppercase',
        },
        titleText: {
            color: theme.textPrimary,
            fontSize: 17,
            fontWeight: '700',
            letterSpacing: -0.3,
            lineHeight: 22,
        },
        subtitleText: {
            color: theme.textSecondary,
            fontSize: 12,
            fontWeight: '500',
            lineHeight: 16,
            marginTop: 1,
        },
        rightSlot: {
            alignItems: 'center',
            flexDirection: 'row',
            flexShrink: 0,
            justifyContent: 'flex-end',
        },
    });
