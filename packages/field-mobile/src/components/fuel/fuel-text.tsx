import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { Icon } from '../common/Icon';
import { fuelStyles } from './fuel-styles';

export function FuelSectionLabel({
    children,
    required = false,
}: {
    children: string;
    required?: boolean;
}) {
    const { theme } = useTheme();

    return (
        <Text
            style={{
                color: theme.textPrimary,
                fontWeight: '700',
                fontSize: 15,
            }}
        >
            {children}
            {required ? (
                <Text style={{ color: theme.textSecondary, fontWeight: '400' }}>
                    {' '}
                    (required)
                </Text>
            ) : null}
        </Text>
    );
}

/** Field label with a muted "(optional)" suffix, as in the request concept. */
export function FuelLabel({
    children,
    optional = false,
}: {
    children: string;
    optional?: boolean;
}) {
    const { theme } = useTheme();

    return (
        <Text style={{ color: theme.textPrimary, fontWeight: '700' }}>
            {children}
            {optional ? (
                <Text style={{ color: theme.textSecondary, fontWeight: '400' }}>
                    {' '}
                    (optional)
                </Text>
            ) : null}
        </Text>
    );
}

export function FuelFieldError({ message }: { message?: string }) {
    const { theme } = useTheme();

    if (!message) {
        return null;
    }

    return (
        <View style={fuelStyles.inlineRow} accessibilityRole="alert">
            <Icon name="alert-circle" size={16} color={theme.hazardRedText} />
            <Text style={{ color: theme.hazardRedText, fontSize: 13, flex: 1 }}>
                {message}
            </Text>
        </View>
    );
}
