import React from 'react';
import {
    Modal,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from 'react-native';
import type { TextInputProps } from 'react-native';
import { useTheme } from '../../theme';
import { Icon } from '../common/Icon';
import type { IconName } from '../common/Icon';
import { fuelStyles } from './fuel-styles';
import { FuelFieldError, FuelLabel } from './fuel-text';

/** A tappable row that opens a picker sheet (equipment, job, needed-by). */
export function FuelPickerRow({
    icon,
    label,
    optional = false,
    value,
    placeholder,
    hint,
    onPress,
    disabled = false,
    error,
    testID,
}: {
    icon: IconName;
    label: string;
    optional?: boolean;
    value: string | null;
    placeholder: string;
    hint?: string;
    onPress: () => void;
    disabled?: boolean;
    error?: string;
    testID?: string;
}) {
    const { theme } = useTheme();

    return (
        <View style={{ gap: 6 }}>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${label}: ${value ?? placeholder}`}
                accessibilityHint={hint}
                accessibilityState={{ disabled }}
                disabled={disabled}
                onPress={onPress}
                testID={testID}
                style={({ pressed }) => [
                    fuelStyles.pickerRow,
                    {
                        backgroundColor: theme.surface,
                        borderColor: error ? theme.hazardRed : theme.border,
                        borderWidth: error ? 2 : 1,
                    },
                    (pressed || disabled) && {
                        opacity: disabled ? 0.5 : 0.85,
                    },
                ]}
            >
                <Icon name={icon} size={22} color={theme.textPrimary} />
                <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                        {label}
                        {optional ? ' (optional)' : ''}
                    </Text>
                    <Text
                        style={{
                            color: value
                                ? theme.textPrimary
                                : theme.textSecondary,
                            fontSize: 16,
                            fontWeight: value ? '600' : '400',
                        }}
                        numberOfLines={2}
                    >
                        {value ?? placeholder}
                    </Text>
                    {hint ? (
                        <Text
                            style={{
                                color: theme.successEmerald,
                                fontSize: 12,
                                fontWeight: '700',
                            }}
                        >
                            {hint}
                        </Text>
                    ) : null}
                </View>
                <Icon
                    name="chevron-right"
                    size={20}
                    color={theme.textSecondary}
                />
            </Pressable>
            <FuelFieldError message={error} />
        </View>
    );
}

/** Bottom sheet used by the picker rows. */
export function FuelSheet({
    visible,
    title,
    onClose,
    children,
    testID,
}: {
    visible: boolean;
    title: string;
    onClose: () => void;
    children: React.ReactNode;
    testID?: string;
}) {
    const { theme } = useTheme();

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={fuelStyles.sheetBackdrop}>
                <View
                    pointerEvents="none"
                    style={[
                        fuelStyles.scrim,
                        { backgroundColor: theme.surfaceDark },
                    ]}
                />
                <Pressable
                    style={{ flex: 1 }}
                    onPress={onClose}
                    accessibilityLabel="Dismiss"
                />
                <View
                    style={[
                        fuelStyles.sheet,
                        { backgroundColor: theme.surface },
                    ]}
                    testID={testID}
                >
                    <View style={fuelStyles.sheetHeader}>
                        <Text
                            style={[
                                fuelStyles.title,
                                { color: theme.textPrimary, flex: 1 },
                            ]}
                            accessibilityRole="header"
                        >
                            {title}
                        </Text>
                        <Pressable
                            onPress={onClose}
                            accessibilityRole="button"
                            accessibilityLabel={`Close ${title}`}
                            style={fuelStyles.iconButton}
                        >
                            <Icon
                                name="close"
                                size={22}
                                color={theme.textPrimary}
                            />
                        </Pressable>
                    </View>
                    <ScrollView contentContainerStyle={{ gap: 8 }}>
                        {children}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

function RadioDot({ selected }: { selected: boolean }) {
    const { theme } = useTheme();

    return (
        <View
            style={[
                fuelStyles.radio,
                {
                    borderColor: selected
                        ? theme.brandAmberText
                        : theme.borderStrong,
                },
            ]}
        >
            {selected ? (
                <View
                    style={[
                        fuelStyles.radioInner,
                        { backgroundColor: theme.brandAmberText },
                    ]}
                />
            ) : null}
        </View>
    );
}

/** One choice inside a FuelSheet, with a radio indicator. */
export function FuelSheetOption({
    title,
    hint,
    selected,
    onPress,
    testID,
}: {
    title: string;
    hint?: string;
    selected: boolean;
    onPress: () => void;
    testID?: string;
}) {
    const { theme } = useTheme();

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={title}
            accessibilityHint={hint}
            accessibilityState={{ selected }}
            onPress={onPress}
            testID={testID}
            style={({ pressed }) => [
                fuelStyles.pickerRow,
                {
                    backgroundColor: selected
                        ? theme.brandAmberLight
                        : theme.surface,
                    borderColor: selected ? theme.brandAmber : theme.border,
                    borderWidth: selected ? 2 : 1,
                },
                pressed && { opacity: 0.85 },
            ]}
        >
            <View style={{ flex: 1, gap: 2 }}>
                <Text
                    style={{
                        color: theme.textPrimary,
                        fontSize: 16,
                        fontWeight: selected ? '700' : '600',
                    }}
                >
                    {title}
                </Text>
                {hint ? (
                    <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                        {hint}
                    </Text>
                ) : null}
            </View>
            <RadioDot selected={selected} />
        </Pressable>
    );
}

/** Numeric input with a unit box (L) or a leading symbol (%). */
export function FuelUnitField({
    label,
    optional = false,
    unit,
    prefix,
    error,
    helper,
    ...props
}: TextInputProps & {
    label: string;
    optional?: boolean;
    unit?: string;
    prefix?: string;
    error?: string;
    helper?: string;
}) {
    const { theme } = useTheme();

    return (
        <View style={fuelStyles.field}>
            <FuelLabel optional={optional}>{label}</FuelLabel>
            <View
                style={[
                    fuelStyles.unitRow,
                    {
                        backgroundColor: theme.surface,
                        borderColor: error ? theme.hazardRed : theme.border,
                        borderWidth: error ? 2 : 1,
                    },
                ]}
            >
                {prefix ? (
                    <Text
                        style={{
                            color: theme.textPrimary,
                            fontWeight: '700',
                            fontSize: 16,
                            paddingLeft: 14,
                        }}
                    >
                        {prefix}
                    </Text>
                ) : null}
                <TextInput
                    accessibilityLabel={label}
                    accessibilityHint={error ?? helper}
                    placeholderTextColor={theme.textSecondary}
                    {...props}
                    style={[
                        fuelStyles.unitInput,
                        { color: theme.textPrimary },
                        props.style,
                    ]}
                />
                {unit ? (
                    <View
                        style={[
                            fuelStyles.unitBox,
                            {
                                borderLeftColor: theme.border,
                                backgroundColor: theme.canvas,
                            },
                        ]}
                    >
                        <Text
                            style={{
                                color: theme.textPrimary,
                                fontWeight: '700',
                            }}
                        >
                            {unit}
                        </Text>
                    </View>
                ) : null}
            </View>
            {error ? (
                <FuelFieldError message={error} />
            ) : helper ? (
                <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                    {helper}
                </Text>
            ) : null}
        </View>
    );
}

/** Equal-width segmented choice (urgency). */
export function FuelSegmented<T extends string>({
    options,
    value,
    onChange,
    disabled = false,
    testIDPrefix,
}: {
    options: { value: T; label: string; hint?: string }[];
    value: T;
    onChange: (value: T) => void;
    disabled?: boolean;
    testIDPrefix: string;
}) {
    const { theme } = useTheme();

    return (
        <View
            style={[
                fuelStyles.segmented,
                { borderColor: theme.border, backgroundColor: theme.surface },
            ]}
        >
            {options.map((option, index) => {
                const selected = option.value === value;

                return (
                    <Pressable
                        key={option.value}
                        accessibilityRole="button"
                        accessibilityLabel={option.label}
                        accessibilityHint={option.hint}
                        accessibilityState={{ selected, disabled }}
                        disabled={disabled}
                        onPress={() => onChange(option.value)}
                        testID={`${testIDPrefix}-${option.value}`}
                        style={[
                            fuelStyles.segment,
                            index > 0 && {
                                borderLeftWidth: 1,
                                borderLeftColor: theme.border,
                            },
                            selected && {
                                backgroundColor: theme.brandAmberLight,
                            },
                        ]}
                    >
                        <Text
                            style={{
                                color: theme.textPrimary,
                                fontWeight: selected ? '700' : '500',
                                fontSize: 15,
                            }}
                        >
                            {option.label}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

/** Card-style radio (fuel type). */
export function FuelRadioCard({
    icon,
    title,
    selected,
    onPress,
    disabled = false,
    testID,
}: {
    icon: IconName;
    title: string;
    selected: boolean;
    onPress: () => void;
    disabled?: boolean;
    testID?: string;
}) {
    const { theme } = useTheme();

    return (
        <Pressable
            accessibilityRole="radio"
            accessibilityLabel={title}
            accessibilityState={{ selected, checked: selected, disabled }}
            disabled={disabled}
            onPress={onPress}
            testID={testID}
            style={[
                fuelStyles.radioCard,
                {
                    backgroundColor: selected
                        ? theme.brandAmberLight
                        : theme.surface,
                    borderColor: selected ? theme.brandAmber : theme.border,
                    borderWidth: selected ? 2 : 1,
                },
            ]}
        >
            <Icon name={icon} size={20} color={theme.textPrimary} />
            <Text
                style={{
                    flex: 1,
                    color: theme.textPrimary,
                    fontWeight: selected ? '700' : '500',
                    fontSize: 15,
                }}
            >
                {title}
            </Text>
            <RadioDot selected={selected} />
        </Pressable>
    );
}
