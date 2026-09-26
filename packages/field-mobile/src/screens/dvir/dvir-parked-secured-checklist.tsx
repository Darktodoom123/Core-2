import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/common/Icon';
import { colors } from '../../components/nativeStyles';
import { useTheme } from '../../theme';
import { dvirSharedStyles } from './dvir-shared-styles';

export interface DvirParkedSecuredChecklistProps {
    chocksDeployed: boolean;
    outriggersStowed: boolean;
    parkingBrakeSet: boolean;
    setChocksDeployed: React.Dispatch<React.SetStateAction<boolean>>;
    setOutriggersStowed: React.Dispatch<React.SetStateAction<boolean>>;
    setParkingBrakeSet: React.Dispatch<React.SetStateAction<boolean>>;
}

export const DvirParkedSecuredChecklist: React.FC<
    DvirParkedSecuredChecklistProps
> = ({
    chocksDeployed,
    outriggersStowed,
    parkingBrakeSet,
    setChocksDeployed,
    setOutriggersStowed,
    setParkingBrakeSet,
}) => {
    const { isDarkHud } = useTheme();

    return (
        <View
            style={[
                styles.postTripSecureCard,
                isDarkHud && styles.darkPostTripSecureCard,
            ]}
        >
            <Text
                style={[
                    dvirSharedStyles.telemetryHeading,
                    isDarkHud && dvirSharedStyles.darkTelemetryHeading,
                ]}
            >
                PARKED & SECURED SHUTDOWN CHECKLIST
            </Text>

            <Pressable
                accessibilityRole="checkbox"
                onPress={() => setParkingBrakeSet(!parkingBrakeSet)}
                style={[
                    styles.secureCheckItem,
                    isDarkHud && styles.darkSecureCheckItem,
                ]}
                testID="check-parking-brake"
            >
                <Icon
                    color={
                        parkingBrakeSet
                            ? isDarkHud
                                ? '#10B981'
                                : colors.green
                            : isDarkHud
                              ? '#64748B'
                              : '#CBD5E1'
                    }
                    name={parkingBrakeSet ? 'check-circle' : 'alert'}
                    size={18}
                />
                <Text
                    style={[
                        styles.secureCheckLabel,
                        isDarkHud && styles.darkSecureCheckLabel,
                    ]}
                >
                    Air brake & spring emergency brake fully engaged
                </Text>
            </Pressable>

            <Pressable
                accessibilityRole="checkbox"
                onPress={() => setChocksDeployed(!chocksDeployed)}
                style={[
                    styles.secureCheckItem,
                    isDarkHud && styles.darkSecureCheckItem,
                ]}
                testID="check-wheel-chocks"
            >
                <Icon
                    color={
                        chocksDeployed
                            ? isDarkHud
                                ? '#10B981'
                                : colors.green
                            : isDarkHud
                              ? '#64748B'
                              : '#CBD5E1'
                    }
                    name={chocksDeployed ? 'check-circle' : 'alert'}
                    size={18}
                />
                <Text
                    style={[
                        styles.secureCheckLabel,
                        isDarkHud && styles.darkSecureCheckLabel,
                    ]}
                >
                    Heavy wheel chocks firmly deployed on drive axles
                </Text>
            </Pressable>

            <Pressable
                accessibilityRole="checkbox"
                onPress={() => setOutriggersStowed(!outriggersStowed)}
                style={[
                    styles.secureCheckItem,
                    isDarkHud && styles.darkSecureCheckItem,
                ]}
                testID="check-outriggers-stowed"
            >
                <Icon
                    color={
                        outriggersStowed
                            ? isDarkHud
                                ? '#10B981'
                                : colors.green
                            : isDarkHud
                              ? '#64748B'
                              : '#CBD5E1'
                    }
                    name={outriggersStowed ? 'check-circle' : 'alert'}
                    size={18}
                />
                <Text
                    style={[
                        styles.secureCheckLabel,
                        isDarkHud && styles.darkSecureCheckLabel,
                    ]}
                >
                    Outrigger beams & hydraulic jacks retracted & locked
                </Text>
            </Pressable>
        </View>
    );
};

const styles = StyleSheet.create({
    darkPostTripSecureCard: {
        backgroundColor: '#0F1A2E',
        borderColor: '#1E293B',
    },
    darkSecureCheckItem: {
        borderBottomColor: '#1E293B',
    },
    darkSecureCheckLabel: {
        color: '#E2E8F0',
    },
    postTripSecureCard: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 12,
        borderWidth: 1,
        padding: 14,
    },
    secureCheckItem: {
        alignItems: 'center',
        borderBottomColor: colors.border,
        borderBottomWidth: 1,
        flexDirection: 'row',
        gap: 10,
        paddingVertical: 10,
    },
    secureCheckLabel: {
        color: colors.text,
        flex: 1,
        fontSize: 13,
        fontWeight: '600',
    },
});
