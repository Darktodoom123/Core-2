import React, { useContext } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { Icon } from '../common/Icon';
import type { IconName } from '../common/Icon';
import { colors, shadows } from '../nativeStyles';
import { EmergencySosButton } from '../sos/emergency-sos-button';

export type FieldNavItem = 'today' | 'route' | 'documents' | 'profile';

export interface FieldBottomNavProps {
    activeItem: FieldNavItem;
    onSelect: (item: FieldNavItem) => void;
    onSosHoldComplete: () => void;
    sosDisabled?: boolean;
}

const items: ReadonlyArray<{
    id: FieldNavItem;
    label: string;
    iconName: IconName;
}> = [
    { id: 'today', label: 'Today', iconName: 'home' },
    { id: 'profile', label: 'Profile', iconName: 'profile' },
];

export const FieldBottomNav: React.FC<FieldBottomNavProps> = ({
    activeItem,
    onSelect,
    onSosHoldComplete,
    sosDisabled = false,
}) => {
    const insets = useContext(SafeAreaInsetsContext);
    const bottomInset = insets?.bottom ?? 0;

    return (
        <View
            accessibilityLabel="Field mobile navigation"
            style={[
                styles.container,
                { paddingBottom: Math.max(10, bottomInset) },
            ]}
            testID="bottom-nav-bar"
        >
            {items.map(({ id, label, iconName }) => {
                const selected = activeItem === id;

                return (
                    <React.Fragment key={id}>
                        {id === 'profile' ? (
                            <View style={styles.sosItem}>
                                <EmergencySosButton
                                    disabled={sosDisabled}
                                    onHoldComplete={onSosHoldComplete}
                                />
                            </View>
                        ) : null}
                        <Pressable
                            accessibilityLabel={label}
                            accessibilityRole="tab"
                            accessibilityState={{ selected }}
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
                                <Icon
                                    name={iconName}
                                    size={22}
                                    color={
                                        selected
                                            ? colors.primaryDark
                                            : colors.secondary
                                    }
                                />
                            </View>
                            <Text
                                style={[
                                    styles.label,
                                    selected && styles.labelSelected,
                                ]}
                            >
                                {label}
                            </Text>
                        </Pressable>
                    </React.Fragment>
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
        paddingHorizontal: 16,
        paddingTop: 8,
        width: '100%',
        ...shadows.lg,
    },
    item: {
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
        minHeight: 52,
        paddingVertical: 4,
    },
    sosItem: {
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
        paddingVertical: 4,
    },
    indicator: {
        alignItems: 'center',
        borderRadius: 20,
        height: 32,
        justifyContent: 'center',
        marginBottom: 2,
        minWidth: 52,
        paddingHorizontal: 10,
    },
    indicatorSelected: {
        backgroundColor: colors.primarySoft,
    },
    label: {
        color: colors.secondary,
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: -0.1,
        textAlign: 'center',
    },
    labelSelected: {
        color: colors.primaryDark,
        fontWeight: '700',
    },
    pressed: {
        opacity: 0.7,
        transform: [{ scale: 0.96 }],
    },
});
