import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { SosIncidentCategory } from '../../types/index';
import { colors } from '../nativeStyles';

const CATEGORIES: Array<{ value: SosIncidentCategory; label: string }> = [
    { value: 'vehicular_accident', label: 'Vehicular accident' },
    { value: 'site_accident', label: 'Site accident' },
    {
        value: 'critical_asset_malfunction',
        label: 'Critical asset malfunction',
    },
    { value: 'other_immediate_danger', label: 'Other immediate danger' },
];

export const SosCategorySelector: React.FC<{
    value: SosIncidentCategory;
    onChange: (category: SosIncidentCategory) => void;
    disabled?: boolean;
}> = ({ value, onChange, disabled = false }) => (
    <View accessibilityRole="radiogroup" style={styles.container}>
        <Text selectable style={styles.title}>
            What happened?
        </Text>
        <Text selectable style={styles.helper}>
            Classification is optional and does not delay the alert.
        </Text>
        <View style={styles.options}>
            {CATEGORIES.map((category) => {
                const selected = value === category.value;

                return (
                    <Pressable
                        accessibilityLabel={category.label}
                        accessibilityRole="radio"
                        accessibilityState={{ disabled, selected }}
                        disabled={disabled}
                        key={category.value}
                        onPress={() => onChange(category.value)}
                        style={({ pressed }) => [
                            styles.option,
                            selected && styles.optionSelected,
                            pressed && styles.optionPressed,
                        ]}
                    >
                        <View
                            style={[
                                styles.radio,
                                selected && styles.radioSelected,
                            ]}
                        />
                        <Text selectable style={styles.optionText}>
                            {category.label}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    </View>
);

const styles = StyleSheet.create({
    container: {
        gap: 8,
    },
    title: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '800',
    },
    helper: {
        color: colors.secondary,
        fontSize: 13,
        lineHeight: 18,
    },
    options: {
        gap: 8,
    },
    option: {
        alignItems: 'center',
        borderColor: colors.border,
        borderRadius: 10,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 10,
        minHeight: 48,
        paddingHorizontal: 12,
    },
    optionSelected: {
        backgroundColor: colors.redLight,
        borderColor: colors.red,
    },
    optionPressed: {
        opacity: 0.8,
    },
    radio: {
        borderColor: colors.borderStrong,
        borderRadius: 10,
        borderWidth: 2,
        height: 20,
        width: 20,
    },
    radioSelected: {
        backgroundColor: colors.red,
        borderColor: colors.redDark,
    },
    optionText: {
        color: colors.text,
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
    },
});
