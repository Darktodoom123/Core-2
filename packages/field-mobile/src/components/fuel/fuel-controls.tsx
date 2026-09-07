import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';
import { useTheme } from '../../theme';
import { colors } from '../nativeStyles';

export function FuelButton({
    title,
    onPress,
    disabled = false,
    primary = false,
    selected,
    testID,
}: {
    title: string;
    onPress: () => void;
    disabled?: boolean;
    primary?: boolean;
    selected?: boolean;
    testID?: string;
}) {
    const { theme } = useTheme();

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={title}
            accessibilityState={{
                disabled,
                ...(selected !== undefined ? { selected } : {}),
            }}
            disabled={disabled}
            onPress={onPress}
            testID={testID}
            style={({ pressed }) => [
                fuelStyles.button,
                {
                    borderColor: selected ? theme.brandAmber : theme.border,
                    backgroundColor: primary ? colors.amberDark : theme.surface,
                },
                (pressed || disabled) && { opacity: disabled ? 0.5 : 0.75 },
            ]}
        >
            <Text
                style={{
                    color: primary ? colors.white : theme.textPrimary,
                    fontWeight: '600',
                    fontSize: 14,
                }}
            >
                {title}
            </Text>
        </Pressable>
    );
}

export function FuelField({
    label,
    ...props
}: TextInputProps & { label: string }) {
    const { theme } = useTheme();

    return (
        <View style={fuelStyles.field}>
            <Text style={{ color: theme.textPrimary, fontWeight: '600' }}>
                {label}
            </Text>
            <TextInput
                accessibilityLabel={label}
                placeholderTextColor={theme.textSecondary}
                {...props}
                style={[
                    fuelStyles.input,
                    {
                        color: theme.textPrimary,
                        backgroundColor: theme.surface,
                        borderColor: theme.border,
                    },
                    props.style,
                ]}
            />
        </View>
    );
}

export const fuelStyles = StyleSheet.create({
    button: {
        minHeight: 44,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderWidth: 1,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    field: { gap: 7 },
    input: {
        minHeight: 48,
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
    },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    section: { gap: 16, paddingVertical: 18 },
    title: { fontSize: 20, fontWeight: '700' },
    body: { fontSize: 14, lineHeight: 21 },
});
