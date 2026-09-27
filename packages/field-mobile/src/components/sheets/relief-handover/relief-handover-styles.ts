import { StyleSheet } from 'react-native';
import type { ThemeColors } from '../../../theme';

export const createReliefStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        body: {
            color: theme.textPrimary,
            fontSize: 15,
            lineHeight: 22,
        },
        muted: {
            color: theme.textSecondary,
            fontSize: 14,
            lineHeight: 20,
        },
        label: {
            color: theme.textPrimary,
            fontSize: 14,
            fontWeight: '700',
        },
        input: {
            backgroundColor: theme.surface,
            borderColor: theme.borderStrong,
            borderRadius: 12,
            borderWidth: 1,
            color: theme.textPrimary,
            fontSize: 18,
            fontWeight: '700',
            minHeight: 52,
            paddingHorizontal: 14,
        },
        pinInput: {
            fontFamily: 'monospace',
            letterSpacing: 8,
            textAlign: 'center',
        },
        primary: {
            alignItems: 'center',
            backgroundColor: theme.brandAmber,
            borderRadius: 12,
            flexDirection: 'row',
            gap: 8,
            justifyContent: 'center',
            minHeight: 52,
            paddingHorizontal: 16,
        },
        primaryDisabled: {
            backgroundColor: theme.surfaceHighlight,
        },
        primaryText: {
            color: theme.surfaceDark,
            fontSize: 16,
            fontWeight: '700',
        },
        primaryTextDisabled: {
            color: theme.textSecondary,
        },
        secondary: {
            alignItems: 'center',
            backgroundColor: theme.surface,
            borderColor: theme.borderStrong,
            borderRadius: 12,
            borderWidth: 1,
            flexDirection: 'row',
            gap: 8,
            justifyContent: 'center',
            minHeight: 48,
            paddingHorizontal: 14,
        },
        secondaryText: {
            color: theme.textPrimary,
            fontSize: 14,
            fontWeight: '700',
        },
        notice: {
            backgroundColor: theme.warningOrangeLight,
            borderColor: theme.warningOrange,
            borderRadius: 12,
            borderWidth: 1,
            gap: 8,
            padding: 12,
        },
        noticeText: {
            color: theme.warningOrangeText,
            fontSize: 14,
            fontWeight: '500',
            lineHeight: 20,
        },
        pinRow: {
            flexDirection: 'row',
            gap: 10,
            justifyContent: 'center',
        },
        pinBox: {
            alignItems: 'center',
            backgroundColor: theme.surfaceHighlight,
            borderColor: theme.border,
            borderRadius: 12,
            borderWidth: 1,
            height: 64,
            justifyContent: 'center',
            width: 56,
        },
        pinDigit: {
            color: theme.textPrimary,
            fontFamily: 'monospace',
            fontSize: 30,
            fontWeight: '700',
        },
        stack: {
            gap: 12,
        },
        pressed: {
            transform: [{ scale: 0.985 }],
        },
    });
