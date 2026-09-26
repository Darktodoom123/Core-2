import React from 'react';
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import type { TextInputProps } from 'react-native';
import { useTheme } from '../../theme';
import { Icon } from '../common/Icon';
import type { IconName } from '../common/Icon';
import { colors } from '../nativeStyles';

export function FuelButton({
    title,
    onPress,
    disabled = false,
    primary = false,
    danger = false,
    selected,
    hint,
    testID,
}: {
    title: string;
    onPress: () => void;
    disabled?: boolean;
    primary?: boolean;
    danger?: boolean;
    selected?: boolean;
    /** Secondary line under the title (e.g. "Work is stopped"). */
    hint?: string;
    testID?: string;
}) {
    const { theme } = useTheme();
    const filled = primary || danger;
    const backgroundColor = primary
        ? colors.primary
        : danger
          ? theme.hazardRed
          : selected
            ? theme.brandAmberLight
            : theme.surface;
    // Gold primary carries dark ink (about 11:1 contrast), matching the web CTA.
    const textColor = primary
        ? colors.text
        : filled
          ? colors.white
          : theme.textPrimary;

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={title}
            accessibilityHint={hint}
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
                    borderColor: selected
                        ? theme.brandAmber
                        : filled
                          ? backgroundColor
                          : theme.borderStrong,
                    borderWidth: selected ? 2 : 1,
                    backgroundColor,
                },
                (pressed || disabled) && { opacity: disabled ? 0.5 : 0.8 },
            ]}
        >
            <View style={fuelStyles.buttonRow}>
                {selected ? (
                    <Icon name="check-circle" size={18} color={textColor} />
                ) : null}
                <Text
                    style={{
                        color: textColor,
                        fontWeight: selected || filled ? '700' : '600',
                        fontSize: 15,
                    }}
                >
                    {title}
                </Text>
            </View>
            {hint ? (
                <Text
                    style={{
                        color: filled ? textColor : theme.textSecondary,
                        fontSize: 12,
                        marginTop: 2,
                    }}
                >
                    {hint}
                </Text>
            ) : null}
        </Pressable>
    );
}

export function FuelField({
    label,
    error,
    helper,
    ...props
}: TextInputProps & { label: string; error?: string; helper?: string }) {
    const { theme } = useTheme();
    // "Name (optional)" renders the suffix muted, matching FuelLabel.
    const optional = label.endsWith(' (optional)');

    return (
        <View style={fuelStyles.field}>
            <Text style={{ color: theme.textPrimary, fontWeight: '600' }}>
                {optional ? label.slice(0, -' (optional)'.length) : label}
                {optional ? (
                    <Text
                        style={{
                            color: theme.textSecondary,
                            fontWeight: '400',
                        }}
                    >
                        {' '}
                        (optional)
                    </Text>
                ) : null}
            </Text>
            <TextInput
                accessibilityLabel={label}
                accessibilityHint={error ?? helper}
                placeholderTextColor={theme.textSecondary}
                {...props}
                style={[
                    fuelStyles.input,
                    {
                        color: theme.textPrimary,
                        backgroundColor: theme.surface,
                        borderColor: error ? theme.hazardRed : theme.border,
                        borderWidth: error ? 2 : 1,
                    },
                    props.style,
                ]}
            />
            {error ? (
                <View style={fuelStyles.inlineRow} accessibilityRole="alert">
                    <Icon
                        name="alert-circle"
                        size={16}
                        color={theme.hazardRed}
                    />
                    <Text style={{ color: theme.hazardRed, fontSize: 13 }}>
                        {error}
                    </Text>
                </View>
            ) : helper ? (
                <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                    {helper}
                </Text>
            ) : null}
        </View>
    );
}

type BannerTone = 'info' | 'success' | 'warning' | 'danger';

const BANNER_ICONS: Record<BannerTone, IconName> = {
    info: 'sync',
    success: 'check-circle',
    warning: 'alert',
    danger: 'alert-circle',
};

export function FuelBanner({
    tone,
    title,
    message,
    children,
    testID,
}: {
    tone: BannerTone;
    title?: string;
    message?: string;
    children?: React.ReactNode;
    testID?: string;
}) {
    const { theme } = useTheme();
    const palette: Record<BannerTone, { bg: string; fg: string }> = {
        info: { bg: theme.actionCobaltLight, fg: theme.actionCobalt },
        success: { bg: theme.successEmeraldLight, fg: theme.successEmerald },
        warning: { bg: theme.brandAmberLight, fg: colors.amberDark },
        danger: { bg: theme.hazardRedLight, fg: theme.hazardRed },
    };
    const { bg, fg } = palette[tone];

    return (
        <View
            accessibilityRole={tone === 'danger' ? 'alert' : undefined}
            accessibilityLiveRegion="polite"
            style={[
                fuelStyles.banner,
                { backgroundColor: bg, borderColor: fg },
            ]}
            testID={testID}
        >
            <Icon
                name={BANNER_ICONS[tone]}
                size={20}
                color={theme.mode === 'dark_hud' ? theme.textPrimary : fg}
            />
            <View style={{ flex: 1, gap: 4 }}>
                {title ? (
                    <Text
                        style={{
                            color: theme.textPrimary,
                            fontWeight: '700',
                            fontSize: 15,
                        }}
                    >
                        {title}
                    </Text>
                ) : null}
                {message ? (
                    <Text
                        style={{
                            color: theme.textPrimary,
                            fontSize: 14,
                            lineHeight: 20,
                        }}
                    >
                        {message}
                    </Text>
                ) : null}
                {children}
            </View>
        </View>
    );
}

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
        <Text style={{ color: theme.textPrimary, fontWeight: '600' }}>
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
            <Icon name="alert-circle" size={16} color={theme.hazardRed} />
            <Text style={{ color: theme.hazardRed, fontSize: 13, flex: 1 }}>
                {message}
            </Text>
        </View>
    );
}

/** Online/offline chip shown at the top of each fuel form. */
export function FuelConnectionPill({ online }: { online: boolean }) {
    const { theme } = useTheme();
    const fg = online ? theme.successEmerald : theme.actionCobalt;

    return (
        <View
            style={[
                fuelStyles.pill,
                {
                    backgroundColor: online
                        ? theme.successEmeraldLight
                        : theme.actionCobaltLight,
                },
            ]}
            accessibilityLabel={
                online
                    ? 'Online'
                    : 'Offline. Saved on this device until you reconnect.'
            }
        >
            <View style={[fuelStyles.dot, { backgroundColor: fg }]} />
            <Text style={{ color: theme.textPrimary, fontWeight: '600' }}>
                {online ? 'Online' : 'Offline — saves on this device'}
            </Text>
        </View>
    );
}

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
                                fontWeight: '600',
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
                        ? colors.accentBorder
                        : theme.borderStrong,
                },
            ]}
        >
            {selected ? (
                <View
                    style={[
                        fuelStyles.radioInner,
                        { backgroundColor: colors.accentBorder },
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

export const fuelStyles = StyleSheet.create({
    button: {
        minHeight: 52,
        minWidth: 56,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    field: { gap: 8 },
    input: {
        minHeight: 52,
        borderRadius: 10,
        padding: 14,
        fontSize: 16,
    },
    inlineRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    section: { gap: 18, paddingVertical: 18 },
    title: { fontSize: 20, fontWeight: '700' },
    body: { fontSize: 14, lineHeight: 21 },
    banner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        padding: 14,
        borderRadius: 12,
        borderLeftWidth: 4,
    },
    card: {
        borderRadius: 14,
        borderWidth: 1,
        padding: 16,
        gap: 10,
    },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        alignSelf: 'stretch',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
    },
    dot: { width: 8, height: 8, borderRadius: 4 },
    pickerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: 60,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 12,
    },
    sheetBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
    },
    sheet: {
        maxHeight: '75%',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 16,
        paddingBottom: 28,
        gap: 12,
    },
    sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    iconButton: {
        width: 48,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
    },
    radio: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioInner: { width: 10, height: 10, borderRadius: 5 },
    unitRow: {
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 52,
        borderRadius: 10,
        overflow: 'hidden',
    },
    unitInput: { flex: 1, paddingHorizontal: 14, fontSize: 17, minHeight: 50 },
    unitBox: {
        alignSelf: 'stretch',
        minWidth: 52,
        alignItems: 'center',
        justifyContent: 'center',
        borderLeftWidth: 1,
    },
    segmented: {
        flexDirection: 'row',
        borderWidth: 1,
        borderRadius: 10,
        overflow: 'hidden',
    },
    segment: {
        flex: 1,
        minHeight: 48,
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioCard: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        minHeight: 52,
        paddingHorizontal: 14,
        borderRadius: 12,
    },
});
