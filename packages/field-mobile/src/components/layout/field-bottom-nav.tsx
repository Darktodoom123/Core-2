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
                            selected && styles.itemSelected,
                            planned && styles.itemPlanned,
                            pressed && styles.pressed,
                        ]}
                        testID={`bottom-nav-${id}`}
                    >
                        <View style={styles.iconWrap}>
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
        alignItems: 'stretch',
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderTopWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingHorizontal: 8,
        paddingTop: 8,
    },
    item: {
        alignItems: 'center',
        borderRadius: 10,
        flex: 1,
        gap: 2,
        justifyContent: 'center',
        minHeight: 56,
        minWidth: 64,
        paddingHorizontal: 4,
        paddingVertical: 5,
    },
    itemSelected: {
        backgroundColor: colors.amberSoft,
    },
    itemPlanned: {
        opacity: 0.72,
    },
    iconWrap: {
        alignItems: 'center',
        height: 22,
        justifyContent: 'center',
        minWidth: 24,
    },
    icon: {
        color: colors.secondary,
        fontSize: 19,
        lineHeight: 22,
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
        fontWeight: '800',
    },
    labelSelected: {
        color: colors.amberDark,
    },
    labelPlanned: {
        color: colors.muted,
    },
    plannedCaption: {
        color: colors.muted,
        fontSize: 9,
        fontWeight: '700',
    },
    pressed: {
        opacity: 0.78,
    },
});
