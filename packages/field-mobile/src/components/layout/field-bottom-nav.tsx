import React, { useContext } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
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
    const { isDarkHud } = useTheme();

    return (
        <View
            pointerEvents="box-none"
            style={[
                styles.floatingWrapper,
                { paddingBottom: Math.max(16, bottomInset + 4) },
            ]}
        >
            <View
                accessibilityLabel="Field mobile navigation"
                style={[
                    styles.container,
                    isDarkHud && styles.darkContainer,
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
                                    selected && styles.itemSelected,
                                    isDarkHud && selected && styles.darkItemSelected,
                                    pressed && styles.pressed,
                                ]}
                                testID={`bottom-nav-${id}`}
                            >
                                <View style={styles.indicator}>
                                    <Icon
                                        name={iconName}
                                        size={20}
                                        color={
                                            selected
                                                ? (isDarkHud ? '#60A5FA' : colors.primaryDark)
                                                : (isDarkHud ? '#94A3B8' : colors.secondary)
                                        }
                                    />
                                </View>
                                <Text
                                    style={[
                                        styles.label,
                                        selected && styles.labelSelected,
                                        isDarkHud &&
                                            (selected
                                                ? styles.darkLabelSelected
                                                : styles.darkLabel),
                                    ]}
                                >
                                    {label}
                                </Text>
                            </Pressable>
                        </React.Fragment>
                    );
                })}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    floatingWrapper: {
        alignItems: 'center',
        bottom: 0,
        left: 0,
        paddingHorizontal: 16,
        paddingTop: 18,
        pointerEvents: 'box-none',
        position: 'absolute',
        right: 0,
        zIndex: 100,
    },
    container: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: 'rgba(226, 232, 240, 0.95)',
        borderRadius: 36,
        borderWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        maxWidth: 440,
        overflow: 'visible',
        paddingHorizontal: 10,
        paddingVertical: 6,
        width: '100%',
        ...shadows.lg,
        elevation: 10,
    },
    darkContainer: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
    },
    item: {
        alignItems: 'center',
        borderRadius: 22,
        flex: 1,
        justifyContent: 'center',
        marginHorizontal: 2,
        minHeight: 48,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    itemSelected: {
        backgroundColor: colors.primaryLight,
    },
    darkItemSelected: {
        backgroundColor: 'rgba(56, 189, 248, 0.14)',
    },
    sosItem: {
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'visible',
        paddingHorizontal: 6,
    },
    indicator: {
        alignItems: 'center',
        height: 22,
        justifyContent: 'center',
        marginBottom: 2,
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
    darkLabel: {
        color: '#94A3B8',
    },
    darkLabelSelected: {
        color: '#60A5FA',
    },
    pressed: {
        opacity: 0.75,
        transform: [{ scale: 0.96 }],
    },
});
