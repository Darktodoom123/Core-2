import { StyleSheet } from 'react-native';
import type { ThemeColors } from '../../theme';

// Styles shared by more than one DvirScreen section. Use with
// `useThemedStyles(createDvirSharedStyles)`.
export const createDvirSharedStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        formSection: {
            marginBottom: 4,
        },
        formSectionTitle: {
            color: theme.textPrimary,
            fontSize: 17,
            fontWeight: '700',
            letterSpacing: 0.1,
        },
        historyList: {
            gap: 10,
        },
        historyMeta: {
            color: theme.textSecondary,
            fontSize: 12,
            marginTop: 2,
        },
        pressed: {
            opacity: 0.82,
            transform: [{ scale: 0.96 }],
        },
        // "Required" is guidance, not an error, so it is not red.
        requiredBadge: {
            color: theme.textSecondary,
            fontSize: 13,
            fontWeight: '700',
            marginBottom: 10,
            marginTop: 2,
        },
        telemetryCard: {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderRadius: 12,
            borderWidth: 1,
            padding: 14,
        },
        telemetryHeading: {
            color: theme.textSecondary,
            fontSize: 12,
            fontWeight: '700',
            letterSpacing: 0.5,
            marginBottom: 10,
        },
        timelineSection: {
            gap: 8,
        },
        toggleCard: {
            alignItems: 'center',
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderRadius: 12,
            borderWidth: 1.5,
            flex: 1,
            justifyContent: 'center',
            minHeight: 52,
            paddingHorizontal: 12,
        },
        // Selected choice: Signal Gold Soft with a gold edge and ink text.
        toggleCardActive: {
            backgroundColor: theme.brandAmberLight,
            borderColor: theme.brandAmber,
            borderWidth: 2,
        },
        toggleCardText: {
            color: theme.textPrimary,
            fontSize: 15,
            fontWeight: '700',
        },
        toggleCardTextActive: {
            color: theme.textPrimary,
        },
        toggleRow: {
            flexDirection: 'row',
            gap: 12,
        },
    });
