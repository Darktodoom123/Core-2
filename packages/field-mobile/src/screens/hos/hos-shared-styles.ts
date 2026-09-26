import { StyleSheet } from 'react-native';

// Styles shared by more than one HosScreen section.
export const hosSharedStyles = StyleSheet.create({
    sectionCard: {
        backgroundColor: '#FFFFFF',
        borderColor: '#E2E8F0',
        borderRadius: 14,
        borderWidth: 1,
        elevation: 2,
        marginBottom: 16,
        padding: 16,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
    },
    darkSectionCard: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
        shadowColor: '#000000',
        shadowOpacity: 0.25,
        shadowRadius: 6,
    },
    sectionTitle: {
        color: '#0F172A',
        fontSize: 15,
        fontWeight: '800',
        marginBottom: 4,
    },
    darkSectionTitle: {
        color: '#FFFFFF',
    },
    sectionHelper: {
        color: '#64748B',
        fontSize: 12,
        lineHeight: 17,
        marginBottom: 14,
    },
    darkSectionHelper: {
        color: '#94A3B8',
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
