import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/common/Icon';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import { createDvirSharedStyles } from './dvir-shared-styles';

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
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const dvirSharedStyles = useThemedStyles(createDvirSharedStyles);

    return (
        <View style={[styles.postTripSecureCard]}>
            <Text style={[dvirSharedStyles.telemetryHeading]}>
                PARKED & SECURED SHUTDOWN CHECKLIST
            </Text>

            <Pressable
                accessibilityRole="checkbox"
                onPress={() => setParkingBrakeSet(!parkingBrakeSet)}
                style={[styles.secureCheckItem]}
                testID="check-parking-brake"
            >
                <Icon
                    color={
                        parkingBrakeSet ? theme.successEmerald : theme.hazardRed
                    }
                    name={parkingBrakeSet ? 'check-circle' : 'alert'}
                    size={18}
                />
                <Text style={[styles.secureCheckLabel]}>
                    Air brake & spring emergency brake fully engaged
                </Text>
            </Pressable>

            <Pressable
                accessibilityRole="checkbox"
                onPress={() => setChocksDeployed(!chocksDeployed)}
                style={[styles.secureCheckItem]}
                testID="check-wheel-chocks"
            >
                <Icon
                    color={
                        chocksDeployed
                            ? theme.successEmerald
                            : theme.warningOrange
                    }
                    name={chocksDeployed ? 'check-circle' : 'alert'}
                    size={18}
                />
                <Text style={[styles.secureCheckLabel]}>
                    Heavy wheel chocks firmly deployed on drive axles
                </Text>
            </Pressable>

            <Pressable
                accessibilityRole="checkbox"
                onPress={() => setOutriggersStowed(!outriggersStowed)}
                style={[styles.secureCheckItem]}
                testID="check-outriggers-stowed"
            >
                <Icon
                    color={
                        outriggersStowed
                            ? theme.successEmerald
                            : theme.hazardRed
                    }
                    name={outriggersStowed ? 'check-circle' : 'alert'}
                    size={18}
                />
                <Text style={[styles.secureCheckLabel]}>
                    Outrigger beams & hydraulic jacks retracted & locked
                </Text>
            </Pressable>
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        postTripSecureCard: {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderRadius: 12,
            borderWidth: 1,
            padding: 14,
        },
        secureCheckItem: {
            alignItems: 'center',
            borderBottomColor: theme.border,
            borderBottomWidth: 1,
            flexDirection: 'row',
            gap: 10,
            minHeight: 48,
            paddingVertical: 10,
        },
        secureCheckLabel: {
            color: theme.textPrimary,
            flex: 1,
            fontSize: 14,
            fontWeight: '500',
        },
    });
