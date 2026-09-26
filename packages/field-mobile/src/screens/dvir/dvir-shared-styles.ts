import { StyleSheet } from 'react-native';
import { colors } from '../../components/nativeStyles';

// Styles shared by more than one DvirScreen section.
export const dvirSharedStyles = StyleSheet.create({
    darkFormSectionTitle: {
        color: '#FFFFFF',
    },
    darkHistoryAsset: {
        color: '#CBD5E1',
    },
    darkTelemetryCard: {
        backgroundColor: '#0F1A2E',
        borderColor: '#1E293B',
    },
    darkTelemetryHeading: {
        color: '#94A3B8',
    },
    darkToggleCard: {
        backgroundColor: '#101A2E',
        borderColor: '#1E3254',
    },
    darkToggleCardActive: {
        backgroundColor: '#332800',
        borderColor: '#FFBF00',
        borderWidth: 2,
    },
    darkToggleCardText: {
        color: '#CBD5E1',
    },
    darkToggleCardTextActive: {
        color: '#FFBF00',
        fontWeight: '800',
    },
    formSection: {
        marginBottom: 4,
    },
    formSectionTitle: {
        color: colors.text,
        fontSize: 17,
        fontWeight: '800',
        letterSpacing: 0.1,
    },
    historyList: {
        gap: 10,
    },
    historyMeta: {
        color: colors.textSecondary,
        fontSize: 12,
        marginTop: 2,
    },
    pressed: {
        opacity: 0.82,
        transform: [{ scale: 0.96 }],
    },
    requiredBadge: {
        color: '#EF4444',
        fontSize: 13,
        fontWeight: '700',
        marginBottom: 10,
        marginTop: 2,
    },
    telemetryCard: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 12,
        borderWidth: 1,
        padding: 14,
    },
    telemetryHeading: {
        color: colors.textSecondary,
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0.5,
        marginBottom: 10,
    },
    timelineSection: {
        gap: 8,
    },
    toggleCard: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 10,
        borderWidth: 1.5,
        flex: 1,
        justifyContent: 'center',
        minHeight: 52,
        paddingHorizontal: 12,
    },
    toggleCardActive: {
        backgroundColor: colors.amberLight,
        borderColor: colors.primaryBorder,
        borderWidth: 2,
    },
    toggleCardText: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '700',
    },
    toggleCardTextActive: {
        color: colors.amberDark,
        fontWeight: '800',
    },
    toggleRow: {
        flexDirection: 'row',
        gap: 12,
    },
});
