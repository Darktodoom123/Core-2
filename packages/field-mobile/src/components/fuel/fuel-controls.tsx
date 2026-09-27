import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';
import { useTheme } from '../../theme';
import { Icon } from '../common/Icon';
import type { IconName } from '../common/Icon';
import { fuelStyles } from './fuel-styles';

export { fuelStyles } from './fuel-styles';
export { FuelFieldError, FuelLabel, FuelSectionLabel } from './fuel-text';
export {
    FuelPickerRow,
    FuelRadioCard,
    FuelSegmented,
    FuelSheet,
    FuelSheetOption,
    FuelUnitField,
} from './fuel-pickers';

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
        ? theme.brandAmber
        : danger
          ? theme.hazardRed
          : selected
            ? theme.brandAmberLight
            : theme.surface;
    // Gold primary carries dark ink (about 11:1 contrast), matching the web CTA.
    const textColor = primary
        ? theme.surfaceDark
        : filled
          ? theme.textInverse
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
                        fontWeight: selected || filled ? '700' : '500',
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
            <Text style={{ color: theme.textPrimary, fontWeight: '700' }}>
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
                        color={theme.hazardRedText}
                    />
                    <Text style={{ color: theme.hazardRedText, fontSize: 13 }}>
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
    // Border is the solid role color; the icon uses the readable text role.
    const palette: Record<
        BannerTone,
        { bg: string; border: string; icon: string }
    > = {
        info: {
            bg: theme.actionCobaltLight,
            border: theme.actionCobalt,
            icon: theme.actionCobalt,
        },
        success: {
            bg: theme.successEmeraldLight,
            border: theme.successEmerald,
            icon: theme.successEmeraldText,
        },
        warning: {
            bg: theme.warningOrangeLight,
            border: theme.warningOrange,
            icon: theme.warningOrangeText,
        },
        danger: {
            bg: theme.hazardRedLight,
            border: theme.hazardRed,
            icon: theme.hazardRedText,
        },
    };
    const { bg, border, icon } = palette[tone];

    return (
        <View
            accessibilityRole={tone === 'danger' ? 'alert' : undefined}
            accessibilityLiveRegion="polite"
            style={[
                fuelStyles.banner,
                { backgroundColor: bg, borderColor: border },
            ]}
            testID={testID}
        >
            <View style={fuelStyles.bannerRow}>
                <Icon name={BANNER_ICONS[tone]} size={20} color={icon} />
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
                </View>
            </View>
            {/* Actions span the banner's full width under the message. */}
            {children}
        </View>
    );
}

/** Online/offline chip shown at the top of each fuel form. */
export function FuelConnectionPill({ online }: { online: boolean }) {
    const { theme } = useTheme();
    // Offline is a warning state, the same as the home header's pill.
    const fg = online ? theme.successEmerald : theme.warningOrange;

    return (
        <View
            style={[
                fuelStyles.pill,
                {
                    backgroundColor: online
                        ? theme.successEmeraldLight
                        : theme.warningOrangeLight,
                    borderColor: fg,
                    borderWidth: 1,
                },
            ]}
            testID="fuel-connection-pill"
            accessibilityLabel={
                online
                    ? 'Online'
                    : 'Offline. Saved on this device until you reconnect.'
            }
        >
            <View style={[fuelStyles.dot, { backgroundColor: fg }]} />
            <Text style={{ color: theme.textPrimary, fontWeight: '500' }}>
                {online ? 'Online' : 'Offline — saves on this device'}
            </Text>
        </View>
    );
}
