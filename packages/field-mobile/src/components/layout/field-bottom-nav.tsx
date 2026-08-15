import React, { useContext } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { colors } from '../nativeStyles';

export type FieldNavItem = 'today' | 'route' | 'profile';

export interface FieldBottomNavProps {
    activeItem: FieldNavItem;
    onSelect: (item: FieldNavItem) => void;
}

const items: ReadonlyArray<{
    id: FieldNavItem;
    label: string;
    icon: string;
    planned?: boolean;
}> = [
    { id: 'today', label: 'Today', icon: '▦' },
    { id: 'route', label: 'Route', icon: '⌖', planned: true },
    { id: 'profile', label: 'Profile', icon: '○' },
];

export const FieldBottomNav: React.FC<FieldBottomNavProps> = ({
    activeItem,
    onSelect,
}) => {
    const insets = useContext(SafeAreaInsetsContext);
    const bottomInset = insets?.bottom ?? 0;

    return (
        <View
            accessibilityLabel="Field mobile navigation"
            style={[
                styles.container,
                { paddingBottom: Math.max(8, bottomInset) },
            ]}
            testID="bottom-nav-bar"
        >
            {items.map(({ id, label, icon, planned }) => {
                const selected = activeItem === id;

                return (
                    <Pressable
                        accessibilityHint={
                            planned
                                ? 'Planned capability. Route data is not available yet.'
                                : undefined
                        }
                        accessibilityLabel={`${label}${planned ? ', planned' : ''}`}
                        accessibilityRole="tab"
                        accessibilityState={{ selected }}
                        key={id}
                        onPress={() => onSelect(id)}
                        style={({ pressed }) => [
                            styles.item,
                            pressed && styles.pressed,
                        ]}
                        testID={`bottom-nav-${id}`}
                    >
                        <View
                            style={[
                                styles.indicator,
                                selected && styles.indicatorSelected,
                            ]}
                        >
                            <Text
                                style={[
                                    styles.icon,
                                    selected && styles.iconSelected,
                                    planned && styles.iconPlanned,
                                ]}
                            >
                                {icon}
                            </Text>
                        </View>
                        <Text
                            style={[
                                styles.label,
                                selected && styles.labelSelected,
                                planned && styles.labelPlanned,
                            ]}
                        >
                            {label}
                        </Text>
                        {planned ? (
                            <Text style={styles.plannedCaption}>Planned</Text>
                        ) : null}
                    </Pressable>
                );
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderTopWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingHorizontal: 12,
        paddingTop: 8,
        width: '100%',
    },
    item: {
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
        minHeight: 52,
        paddingVertical: 4,
    },
    indicator: {
        alignItems: 'center',
        borderRadius: 16,
        height: 32,
        justifyContent: 'center',
        marginBottom: 3,
        minWidth: 56,
        paddingHorizontal: 12,
    },
    indicatorSelected: {
        backgroundColor: colors.amberSoft,
    },
    icon: {
        color: colors.secondary,
        fontSize: 18,
        lineHeight: 20,
    },
    iconSelected: {
        color: colors.amberDark,
    },
    iconPlanned: {
        color: colors.muted,
    },
    label: {
        color: colors.secondary,
        fontSize: 11,
        fontWeight: '700',
        textAlign: 'center',
    },
    labelSelected: {
        color: colors.amberDark,
        fontWeight: '800',
    },
    labelPlanned: {
        color: colors.muted,
    },
    plannedCaption: {
        color: colors.muted,
        fontSize: 9,
        fontWeight: '700',
        marginTop: 1,
    },
    pressed: {
        opacity: 0.72,
    },
});
