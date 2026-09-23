import React, { useContext } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { Icon } from '../common/Icon';
import { colors } from '../nativeStyles';
import { EmergencySosButton } from '../sos/emergency-sos-button';

export type FieldNavItem = 'today' | 'route' | 'documents' | 'profile';

export interface FieldBottomNavProps {
    activeItem: FieldNavItem;
    onSelect: (item: FieldNavItem) => void;
    onSosHoldComplete: () => void;
    sosDisabled?: boolean;
}

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
                style={[styles.container, isDarkHud && styles.darkContainer]}
                testID="bottom-nav-bar"
            >
                {/* Today Tab */}
                <Pressable
                    accessibilityLabel="Today"
                    accessibilityRole="tab"
                    accessibilityState={{ selected: activeItem === 'today' }}
                    onPress={() => onSelect('today')}
                    style={({ pressed }) => [
                        styles.item,
                        activeItem === 'today' && styles.itemSelected,
                        isDarkHud &&
                            activeItem === 'today' &&
                            styles.darkItemSelected,
                        pressed && styles.pressed,
                    ]}
                    testID="bottom-nav-today"
                >
                    <View style={styles.indicator}>
                        <Icon
                            color={
                                activeItem === 'today'
                                    ? isDarkHud
                                        ? '#FFBF00'
                                        : '#806000'
                                    : isDarkHud
                                      ? '#94A3B8'
                                      : '#64748B'
                            }
                            name="home"
                            size={20}
                        />
                    </View>
                    <Text
                        style={[
                            styles.label,
                            activeItem === 'today' && styles.labelSelected,
                            isDarkHud &&
                                (activeItem === 'today'
                                    ? styles.darkLabelSelected
                                    : styles.darkLabel),
                        ]}
                    >
                        Today
                    </Text>
                </Pressable>

                {/* Central Floating SOS Control */}
                <View style={styles.sosItem}>
                    <EmergencySosButton
                        disabled={sosDisabled}
                        onHoldComplete={onSosHoldComplete}
                    />
                </View>

                {/* Profile Tab */}
                <Pressable
                    accessibilityLabel="Profile"
                    accessibilityRole="tab"
                    accessibilityState={{
                        selected: activeItem === 'profile',
                    }}
                    onPress={() => onSelect('profile')}
                    style={({ pressed }) => [
                        styles.item,
                        activeItem === 'profile' && styles.itemSelected,
                        isDarkHud &&
                            activeItem === 'profile' &&
                            styles.darkItemSelected,
                        pressed && styles.pressed,
                    ]}
                    testID="bottom-nav-profile"
                >
                    <View style={styles.indicator}>
                        <Icon
                            color={
                                activeItem === 'profile'
                                    ? isDarkHud
                                        ? '#FFBF00'
                                        : '#806000'
                                    : isDarkHud
                                      ? '#94A3B8'
                                      : '#64748B'
                            }
                            name="profile"
                            size={20}
                        />
                    </View>
                    <Text
                        style={[
                            styles.label,
                            activeItem === 'profile' && styles.labelSelected,
                            isDarkHud &&
                                (activeItem === 'profile'
                                    ? styles.darkLabelSelected
                                    : styles.darkLabel),
                        ]}
                    >
                        Profile
                    </Text>
                </Pressable>
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
        paddingTop: 24,
        pointerEvents: 'box-none',
        position: 'absolute',
        right: 0,
        zIndex: 100,
    },
    container: {
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
        borderColor: 'rgba(226, 232, 240, 0.95)',
        borderRadius: 36,
        borderWidth: 1,
        elevation: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        maxWidth: 440,
        overflow: 'visible',
        paddingHorizontal: 10,
        paddingVertical: 6,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        width: '100%',
    },
    darkContainer: {
        backgroundColor: 'rgba(30, 41, 59, 0.96)',
        borderColor: '#334155',
        shadowColor: '#000000',
        shadowOpacity: 0.35,
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
        backgroundColor: 'transparent',
    },
    darkItemSelected: {
        backgroundColor: 'transparent',
    },
    sosItem: {
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'visible',
        paddingHorizontal: 8,
        zIndex: 10,
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
        color: '#FFBF00',
        fontWeight: '700',
    },
    darkLabel: {
        color: '#94A3B8',
    },
    darkLabelSelected: {
        color: '#FFBF00',
    },
    pressed: {
        opacity: 0.75,
        transform: [{ scale: 0.96 }],
    },
});
