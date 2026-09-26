import { StyleSheet } from 'react-native';
import type { ThemeColors } from '../../theme';

// Styles shared by more than one HosScreen section. Use with
// `useThemedStyles(createHosSharedStyles)`.
export const createHosSharedStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        // Resting panel: border only, no shadow (The Border Or Lift Rule).
        sectionCard: {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderRadius: 16,
            borderWidth: 1,
            marginBottom: 16,
            padding: 16,
        },
        sectionTitle: {
            color: theme.textPrimary,
            fontSize: 15,
            fontWeight: '700',
            marginBottom: 4,
        },
        sectionHelper: {
            color: theme.textSecondary,
            fontSize: 12,
            lineHeight: 17,
            marginBottom: 14,
        },
        pressed: {
            opacity: 0.82,
            transform: [{ scale: 0.96 }],
        },
        actionButtonPressed: {
            opacity: 0.88,
            transform: [{ scale: 0.97 }],
        },
    });
