import React, { useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useTheme } from '../../theme';
import type { SosIncidentCategory } from '../../types/index';
import { Icon } from '../common/Icon';
import type { IconName } from '../common/Icon';
import { colors } from '../nativeStyles';

export interface EmergencyCategoryConfig {
    value: SosIncidentCategory;
    label: string;
    title: string;
    subtitle: string;
    badge: string;
    icon: IconName;
    color: string;
    darkColor: string;
}

export const EMERGENCY_CATEGORIES: EmergencyCategoryConfig[] = [
    {
        value: 'vehicular_accident',
        label: 'Vehicular accident',
        title: 'Vehicular Accident / Collision',
        subtitle: 'Road crash, transit rollover, ground crew impact',
        badge: 'TRANSIT',
        icon: 'truck',
        color: '#DC2626',
        darkColor: '#EF4444',
    },
    {
        value: 'critical_asset_malfunction',
        label: 'Critical asset malfunction',
        title: 'Equipment / Asset Failure',
        subtitle: 'Boom failure, hydraulic burst, brake loss, runaway load',
        badge: 'MACHINERY',
        icon: 'crane',
        color: '#FFBF00',
        darkColor: '#FFBF00',
    },
    {
        value: 'site_accident',
        label: 'Site accident',
        title: 'Site Incident / Worker Injured',
        subtitle: 'Structural collapse, fallen load, personnel injured/trapped',
        badge: 'CASUALTY',
        icon: 'alert-circle',
        color: '#B91C1C',
        darkColor: '#F87171',
    },
    {
        value: 'other_immediate_danger',
        label: 'Other immediate danger',
        title: 'Environmental / Site Hazard',
        subtitle: 'Power line contact, gas leak, fire/smoke, sinkhole',
        badge: 'DANGER',
        icon: 'flash',
        color: '#FFBF00',
        darkColor: '#FFBF00',
    },
];

export interface SituationChipItem {
    id: string;
    label: string;
    icon: IconName;
    emoji?: string;
}

export const SITUATION_CHIPS: SituationChipItem[] = [
    {
        id: 'worker_injured',
        label: 'Worker Injured',
        icon: 'alert-circle',
    },
    {
        id: 'power_line',
        label: 'Power Line Contact',
        icon: 'flash',
    },
    { id: 'tipping_risk', label: 'Tipping Risk', icon: 'crane' },
    {
        id: 'hydraulic_spill',
        label: 'Hydraulic Spill',
        icon: 'fuel',
    },
    { id: 'asset_immobile', label: 'Asset Stuck', icon: 'truck' },
    { id: 'ambulance_needed', label: 'Ambulance', icon: 'alert' },
];

export interface SosCategorySelectorProps {
    value: SosIncidentCategory;
    onChange: (category: SosIncidentCategory) => void;
    disabled?: boolean;
    note?: string;
    onNoteChange?: (note: string) => void;
    selectedChips?: string[];
    onToggleChip?: (chipId: string) => void;
    onTransmitNotes?: () => void;
    isUpdatingNote?: boolean;
    showNotes?: boolean;
}

export const SosCategorySelector: React.FC<SosCategorySelectorProps> = ({
    value,
    onChange,
    disabled = false,
    note: controlledNote,
    onNoteChange,
    selectedChips: controlledChips,
    onToggleChip,
    onTransmitNotes,
    isUpdatingNote = false,
    showNotes = true,
}) => {
    const { isDarkHud } = useTheme();

    // Support uncontrolled fallback if parent doesn't provide note/chips
    const [localNote, setLocalNote] = useState('');
    const [localChips, setLocalChips] = useState<string[]>([]);

    const activeNote =
        controlledNote !== undefined ? controlledNote : localNote;
    const activeChips =
        controlledChips !== undefined ? controlledChips : localChips;

    const handleNoteChange = (text: string) => {
        if (onNoteChange) {
            onNoteChange(text);
        } else {
            setLocalNote(text);
        }
    };

    const handleToggleChip = (chipId: string) => {
        if (onToggleChip) {
            onToggleChip(chipId);
        } else {
            const nextChips = activeChips.includes(chipId)
                ? activeChips.filter((id) => id !== chipId)
                : [...activeChips, chipId];
            setLocalChips(nextChips);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text
                    selectable
                    style={[styles.title, isDarkHud && styles.darkTitle]}
                >
                    Emergency Classification
                </Text>
                <Text
                    selectable
                    style={[styles.helper, isDarkHud && styles.darkHelper]}
                >
                    Select emergency category and situation details before
                    sending to the Operations Manager.
                </Text>
            </View>

            {/* 4 Humanized Emergency Category Cards */}
            <View accessibilityRole="radiogroup" style={styles.options}>
                {EMERGENCY_CATEGORIES.map((category) => {
                    const selected = value === category.value;
                    const accent = isDarkHud
                        ? category.darkColor
                        : category.color;

                    return (
                        <Pressable
                            accessibilityLabel={`${category.label}. ${category.title}: ${category.subtitle}`}
                            accessibilityRole="radio"
                            accessibilityState={{ disabled, selected }}
                            disabled={disabled}
                            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                            key={category.value}
                            onPress={() => onChange(category.value)}
                            style={({ pressed }) => [
                                styles.option,
                                isDarkHud && styles.darkOption,
                                selected &&
                                    (isDarkHud
                                        ? {
                                              borderColor: accent,
                                              backgroundColor: '#1E293B',
                                              borderWidth: 2,
                                          }
                                        : {
                                              borderColor: accent,
                                              backgroundColor: '#FEF2F2',
                                              borderWidth: 2,
                                          }),
                                pressed && styles.optionPressed,
                            ]}
                            testID={`sos-category-${category.value}`}
                        >
                            <View
                                pointerEvents="none"
                                style={styles.cardHeaderRow}
                            >
                                <View style={styles.leadingGroup}>
                                    <View
                                        style={[
                                            styles.iconCircle,
                                            {
                                                backgroundColor: selected
                                                    ? accent
                                                    : isDarkHud
                                                      ? '#334155'
                                                      : category.value ===
                                                          'critical_asset_malfunction'
                                                        ? '#FFF3C4'
                                                        : category.value ===
                                                            'site_accident'
                                                          ? '#FEE2E2'
                                                          : category.value ===
                                                              'other_immediate_danger'
                                                            ? '#FFF3C4'
                                                            : '#FEE2E2',
                                            },
                                        ]}
                                    >
                                        <Icon
                                            color={
                                                selected
                                                    ? '#FFFFFF'
                                                    : isDarkHud
                                                      ? '#CBD5E1'
                                                      : accent
                                            }
                                            name={category.icon}
                                            size={18}
                                        />
                                    </View>
                                    <View
                                        style={[
                                            styles.badgeWrap,
                                            isDarkHud && styles.darkBadgeWrap,
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.badgeText,
                                                {
                                                    color: selected
                                                        ? accent
                                                        : isDarkHud
                                                          ? '#94A3B8'
                                                          : '#475569',
                                                },
                                            ]}
                                        >
                                            {category.badge}
                                        </Text>
                                    </View>
                                    <Text
                                        numberOfLines={1}
                                        style={[
                                            styles.optionTitle,
                                            isDarkHud && styles.darkOptionText,
                                            selected && { color: accent },
                                        ]}
                                    >
                                        {category.title}
                                    </Text>
                                </View>
                                <View
                                    style={[
                                        styles.radio,
                                        isDarkHud && styles.darkRadio,
                                        selected && {
                                            backgroundColor: accent,
                                            borderColor: accent,
                                        },
                                    ]}
                                />
                            </View>

                            <Text
                                pointerEvents="none"
                                style={[
                                    styles.optionSubtitle,
                                    isDarkHud && styles.darkSubtitle,
                                ]}
                            >
                                {category.subtitle}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>

            {/* Situational Quick Chips */}
            <View style={styles.chipsSection}>
                <Text
                    selectable
                    style={[
                        styles.sectionHeaderTitle,
                        isDarkHud && styles.darkSectionTitle,
                    ]}
                >
                    IMMEDIATE HAZARDS (TAP TO TAG)
                </Text>

                <View style={styles.chipContainer}>
                    {SITUATION_CHIPS.map((chip) => {
                        const isChipActive = activeChips.includes(chip.id);

                        return (
                            <Pressable
                                accessibilityLabel={`Situation hazard: ${chip.label}`}
                                accessibilityRole="checkbox"
                                accessibilityState={{
                                    checked: isChipActive,
                                    disabled,
                                }}
                                disabled={disabled}
                                hitSlop={{
                                    top: 4,
                                    bottom: 4,
                                    left: 4,
                                    right: 4,
                                }}
                                key={chip.id}
                                onPress={() => handleToggleChip(chip.id)}
                                style={({ pressed }) => [
                                    styles.chip,
                                    isDarkHud && styles.darkChip,
                                    isChipActive &&
                                        (isDarkHud
                                            ? styles.darkChipActive
                                            : styles.chipActive),
                                    pressed && styles.optionPressed,
                                ]}
                                testID={`sos-chip-${chip.id}`}
                            >
                                <Icon
                                    color={
                                        isChipActive
                                            ? isDarkHud
                                                ? '#FFBF00'
                                                : colors.amberDark
                                            : isDarkHud
                                              ? colors.hudTextDim
                                              : colors.muted
                                    }
                                    name={chip.icon}
                                    size={14}
                                />
                                <Text
                                    pointerEvents="none"
                                    style={[
                                        styles.chipText,
                                        isDarkHud && styles.darkChipText,
                                        isChipActive &&
                                            (isDarkHud
                                                ? styles.darkChipTextActive
                                                : styles.chipTextActive),
                                    ]}
                                >
                                    {chip.label}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>
            </View>

            {/* Situational Notes Area */}
            {showNotes && (
                <View style={styles.notesSection}>
                    <View style={styles.notesHeaderRow}>
                        <Text
                            selectable
                            style={[
                                styles.sectionHeaderTitle,
                                isDarkHud && styles.darkSectionTitle,
                            ]}
                        >
                            SITUATION NOTES FOR RESPONDERS
                        </Text>
                        <Text
                            style={[
                                styles.charCount,
                                isDarkHud && styles.darkHelper,
                            ]}
                        >
                            {activeNote.length}/200 characters
                        </Text>
                    </View>
                    <TextInput
                        accessibilityLabel="Emergency situation notes"
                        editable={!isUpdatingNote}
                        maxLength={200}
                        multiline
                        numberOfLines={3}
                        onChangeText={handleNoteChange}
                        placeholder="Add details (e.g. outrigger sank, operator trapped in cab, 13.8kV power line)..."
                        placeholderTextColor={isDarkHud ? '#64748B' : '#94A3B8'}
                        style={[
                            styles.noteInput,
                            isDarkHud && styles.darkNoteInput,
                        ]}
                        testID="sos-notes-input"
                        value={activeNote}
                    />
                    <Pressable
                        accessibilityLabel="Transmit note update to dispatch"
                        accessibilityRole="button"
                        disabled={isUpdatingNote || !activeNote.trim()}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        onPress={onTransmitNotes || (() => {})}
                        style={({ pressed }) => [
                            styles.transmitBtn,
                            isDarkHud && styles.darkTransmitBtn,
                            (!activeNote.trim() || isUpdatingNote) &&
                                styles.btnDisabled,
                            pressed && styles.optionPressed,
                        ]}
                        testID="sos-send-notes-btn"
                    >
                        {isUpdatingNote ? (
                            <ActivityIndicator color="#FFFFFF" size="small" />
                        ) : (
                            <Text
                                pointerEvents="none"
                                style={[
                                    styles.transmitBtnText,
                                    isDarkHud && styles.darkTransmitBtnText,
                                ]}
                            >
                                Update Dispatch Notes
                            </Text>
                        )}
                    </Pressable>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        gap: 12,
    },
    header: {
        gap: 4,
    },
    title: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '800',
    },
    subSectionTitle: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '800',
        marginBottom: 2,
    },
    helper: {
        color: colors.secondary,
        fontSize: 13,
        lineHeight: 18,
    },
    options: {
        gap: 10,
    },
    option: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 14,
        borderWidth: 1.5,
        gap: 6,
        minHeight: 88,
        padding: 14,
    },
    optionPressed: {
        opacity: 0.85,
    },
    cardHeaderRow: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 2,
    },
    leadingGroup: {
        alignItems: 'center',
        flex: 1,
        flexDirection: 'row',
        gap: 8,
        marginRight: 6,
    },
    iconCircle: {
        alignItems: 'center',
        borderRadius: 15,
        height: 30,
        justifyContent: 'center',
        width: 30,
    },
    badgeWrap: {
        alignSelf: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
        borderRadius: 5,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    darkBadgeWrap: {
        backgroundColor: 'rgba(255, 255, 255, 0.07)',
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    radio: {
        borderColor: colors.borderStrong,
        borderRadius: 10,
        borderWidth: 2,
        height: 20,
        width: 20,
    },
    optionTitle: {
        color: colors.text,
        flexShrink: 1,
        fontSize: 13.5,
        fontWeight: '800',
    },
    optionSubtitle: {
        color: colors.secondary,
        fontSize: 11.5,
        lineHeight: 16,
        paddingLeft: 38,
    },
    sectionHeaderTitle: {
        color: '#0F172A',
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    darkSectionTitle: {
        color: '#F8FAFC',
    },
    chipsSection: {
        gap: 8,
        marginTop: 4,
    },
    chipContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 2,
    },
    chip: {
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderColor: '#E2E8F0',
        borderRadius: 10,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    darkChip: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
    },
    chipActive: {
        backgroundColor: '#FEF2F2',
        borderColor: '#DC2626',
        borderWidth: 1.5,
    },
    darkChipActive: {
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        borderColor: '#EF4444',
        borderWidth: 1.5,
    },
    chipEmoji: {
        fontSize: 14,
    },
    chipText: {
        color: '#334155',
        fontSize: 12,
        fontWeight: '600',
    },
    darkChipText: {
        color: '#CBD5E1',
    },
    chipTextActive: {
        color: '#991B1B',
        fontWeight: '800',
    },
    darkChipTextActive: {
        color: '#FCA5A5',
        fontWeight: '800',
    },
    notesSection: {
        gap: 8,
        marginTop: 4,
    },
    notesHeaderRow: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    noteInput: {
        backgroundColor: '#F8FAFC',
        borderColor: '#E2E8F0',
        borderRadius: 12,
        borderWidth: 1,
        color: colors.text,
        fontSize: 12.5,
        lineHeight: 18,
        minHeight: 70,
        padding: 10,
        textAlignVertical: 'top',
    },
    darkNoteInput: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
        color: '#F8FAFC',
    },
    charCount: {
        color: '#94A3B8',
        fontSize: 11,
        fontVariant: ['tabular-nums'],
    },
    transmitBtn: {
        alignItems: 'center',
        backgroundColor: '#0F172A',
        borderRadius: 12,
        justifyContent: 'center',
        minHeight: 42,
        width: '100%',
    },
    darkTransmitBtn: {
        backgroundColor: '#FFBF00',
    },
    transmitBtnText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '800',
    },
    darkTransmitBtnText: {
        color: '#0F172A',
        fontSize: 13,
        fontWeight: '800',
    },
    btnDisabled: {
        opacity: 0.5,
    },
    darkTitle: {
        color: '#F8FAFC',
    },
    darkHelper: {
        color: '#94A3B8',
    },
    darkSubtitle: {
        color: '#94A3B8',
    },
    darkOption: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
    },
    darkRadio: {
        borderColor: '#64748B',
    },
    darkOptionText: {
        color: '#F8FAFC',
    },
});
