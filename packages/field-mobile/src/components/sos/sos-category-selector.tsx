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

const NOTE_MAX_LENGTH = 200;

export interface EmergencyCategoryConfig {
    value: SosIncidentCategory;
    label: string;
    title: string;
    subtitle: string;
    badge: string;
    icon: IconName;
    /** Light-mode accent; dark enough to carry white icons and borders. */
    color: string;
    /** Light-mode selected card background. */
    tint: string;
    darkColor: string;
    /** Icon color on a filled dark-mode accent. */
    darkOnColor: string;
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
        tint: '#FEF2F2',
        darkColor: '#EF4444',
        darkOnColor: '#FFFFFF',
    },
    {
        value: 'critical_asset_malfunction',
        label: 'Critical asset malfunction',
        title: 'Equipment / Asset Failure',
        subtitle: 'Boom failure, hydraulic burst, brake loss, runaway load',
        badge: 'MACHINERY',
        icon: 'crane',
        color: '#B38A00',
        tint: '#FFFBEB',
        darkColor: '#FFBF00',
        darkOnColor: '#0F172A',
    },
    {
        value: 'site_accident',
        label: 'Site accident',
        title: 'Site Incident / Worker Injured',
        subtitle: 'Structural collapse, fallen load, personnel injured/trapped',
        badge: 'CASUALTY',
        icon: 'alert-circle',
        color: '#B91C1C',
        tint: '#FEF2F2',
        darkColor: '#F87171',
        darkOnColor: '#0F172A',
    },
    {
        value: 'other_immediate_danger',
        label: 'Other immediate danger',
        title: 'Environmental / Site Hazard',
        subtitle: 'Power line contact, gas leak, fire/smoke, sinkhole',
        badge: 'DANGER',
        icon: 'flash',
        color: '#B38A00',
        tint: '#FFFBEB',
        darkColor: '#FFBF00',
        darkOnColor: '#0F172A',
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
    const [noteFocused, setNoteFocused] = useState(false);

    // Support uncontrolled fallback if parent doesn't provide note/chips
    const [localNote, setLocalNote] = useState('');
    const [localChips, setLocalChips] = useState<string[]>([]);

    const activeNote =
        controlledNote !== undefined ? controlledNote : localNote;
    const activeChips =
        controlledChips !== undefined ? controlledChips : localChips;
    const nearNoteLimit = activeNote.length >= NOTE_MAX_LENGTH - 20;

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
                <View style={styles.titleRow}>
                    <Text
                        selectable
                        style={[styles.title, isDarkHud && styles.darkTitle]}
                    >
                        Emergency Classification
                    </Text>
                    <View
                        style={[
                            styles.optionalTag,
                            isDarkHud && styles.darkOptionalTag,
                        ]}
                    >
                        <Text
                            style={[
                                styles.optionalTagText,
                                isDarkHud && styles.darkHelper,
                            ]}
                        >
                            OPTIONAL
                        </Text>
                    </View>
                </View>
                <Text
                    selectable
                    style={[styles.helper, isDarkHud && styles.darkHelper]}
                >
                    Select emergency category and situation details before
                    sending to the Operations Manager.
                </Text>
            </View>

            {/* Emergency category cards */}
            <View accessibilityRole="radiogroup" style={styles.options}>
                {EMERGENCY_CATEGORIES.map((category) => {
                    const selected = value === category.value;
                    const accent = isDarkHud
                        ? category.darkColor
                        : category.color;
                    const onAccent = isDarkHud
                        ? category.darkOnColor
                        : '#FFFFFF';

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
                                selected && {
                                    backgroundColor: isDarkHud
                                        ? '#1E293B'
                                        : category.tint,
                                    borderColor: accent,
                                },
                                pressed && styles.optionPressed,
                            ]}
                            testID={`sos-category-${category.value}`}
                        >
                            <View
                                pointerEvents="none"
                                style={[
                                    styles.iconCircle,
                                    {
                                        backgroundColor: selected
                                            ? accent
                                            : isDarkHud
                                              ? '#334155'
                                              : category.tint,
                                    },
                                ]}
                            >
                                <Icon
                                    color={
                                        selected
                                            ? onAccent
                                            : isDarkHud
                                              ? '#CBD5E1'
                                              : accent
                                    }
                                    name={category.icon}
                                    size={20}
                                />
                            </View>

                            <View pointerEvents="none" style={styles.optionCopy}>
                                <Text
                                    numberOfLines={2}
                                    style={[
                                        styles.optionTitle,
                                        isDarkHud && styles.darkOptionText,
                                    ]}
                                >
                                    {category.title}
                                </Text>
                                <Text
                                    style={[
                                        styles.optionSubtitle,
                                        isDarkHud && styles.darkSubtitle,
                                    ]}
                                >
                                    {category.subtitle}
                                </Text>
                            </View>

                            <View
                                pointerEvents="none"
                                style={[
                                    styles.radio,
                                    isDarkHud && styles.darkRadio,
                                    selected && {
                                        backgroundColor: accent,
                                        borderColor: accent,
                                    },
                                ]}
                            >
                                {selected ? (
                                    <Icon
                                        color={onAccent}
                                        name="check"
                                        size={14}
                                    />
                                ) : null}
                            </View>
                        </Pressable>
                    );
                })}
            </View>

            {/* Situational quick chips */}
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
                                                ? '#FCA5A5'
                                                : colors.redDark
                                            : isDarkHud
                                              ? colors.hudTextDim
                                              : colors.muted
                                    }
                                    name={isChipActive ? 'check' : chip.icon}
                                    size={16}
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

            {/* Situational notes */}
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
                                nearNoteLimit && styles.charCountWarn,
                            ]}
                        >
                            {`${activeNote.length}/${NOTE_MAX_LENGTH} characters`}
                        </Text>
                    </View>
                    <TextInput
                        accessibilityLabel="Emergency situation notes"
                        editable={!isUpdatingNote}
                        maxLength={NOTE_MAX_LENGTH}
                        multiline
                        numberOfLines={3}
                        onBlur={() => setNoteFocused(false)}
                        onChangeText={handleNoteChange}
                        onFocus={() => setNoteFocused(true)}
                        placeholder="Add details (e.g. outrigger sank, operator trapped in cab, 13.8kV power line)..."
                        placeholderTextColor={isDarkHud ? '#64748B' : '#94A3B8'}
                        style={[
                            styles.noteInput,
                            isDarkHud && styles.darkNoteInput,
                            noteFocused &&
                                (isDarkHud
                                    ? styles.darkNoteInputFocused
                                    : styles.noteInputFocused),
                        ]}
                        testID="sos-notes-input"
                        value={activeNote}
                    />
                    {onTransmitNotes ? (
                        <Pressable
                            accessibilityLabel="Transmit note update to dispatch"
                            accessibilityRole="button"
                            accessibilityState={{
                                busy: isUpdatingNote,
                                disabled: isUpdatingNote || !activeNote.trim(),
                            }}
                            disabled={isUpdatingNote || !activeNote.trim()}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            onPress={onTransmitNotes}
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
                                <ActivityIndicator
                                    color={isDarkHud ? '#0F172A' : '#FFFFFF'}
                                    size="small"
                                />
                            ) : (
                                <>
                                    <Icon
                                        color={
                                            isDarkHud ? '#0F172A' : '#FFFFFF'
                                        }
                                        name="message"
                                        size={16}
                                    />
                                    <Text
                                        pointerEvents="none"
                                        style={[
                                            styles.transmitBtnText,
                                            isDarkHud &&
                                                styles.darkTransmitBtnText,
                                        ]}
                                    >
                                        Update Dispatch Notes
                                    </Text>
                                </>
                            )}
                        </Pressable>
                    ) : (
                        <Text
                            style={[
                                styles.notesHint,
                                isDarkHud && styles.darkHelper,
                            ]}
                        >
                            Notes and hazard tags are sent with the alert.
                        </Text>
                    )}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        gap: 14,
    },
    header: {
        gap: 4,
    },
    titleRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 8,
    },
    title: {
        color: colors.text,
        fontSize: 17,
        fontWeight: '800',
    },
    optionalTag: {
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 6,
        borderWidth: 1,
        paddingHorizontal: 6,
        paddingVertical: 1,
    },
    darkOptionalTag: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
    },
    optionalTagText: {
        color: colors.secondary,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.6,
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
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 14,
        borderWidth: 2,
        flexDirection: 'row',
        gap: 12,
        minHeight: 76,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    optionPressed: {
        opacity: 0.85,
    },
    iconCircle: {
        alignItems: 'center',
        borderRadius: 20,
        height: 40,
        justifyContent: 'center',
        width: 40,
    },
    optionCopy: {
        flex: 1,
        gap: 3,
    },
    radio: {
        alignItems: 'center',
        borderColor: colors.borderStrong,
        borderRadius: 12,
        borderWidth: 2,
        height: 24,
        justifyContent: 'center',
        width: 24,
    },
    optionTitle: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '800',
        lineHeight: 20,
    },
    optionSubtitle: {
        color: colors.secondary,
        fontSize: 13,
        lineHeight: 18,
    },
    sectionHeaderTitle: {
        color: '#0F172A',
        flexShrink: 1,
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
    },
    chip: {
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderColor: '#CBD5E1',
        borderRadius: 999,
        borderWidth: 1.5,
        flexDirection: 'row',
        gap: 6,
        minHeight: 44,
        paddingHorizontal: 14,
    },
    darkChip: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
    },
    chipActive: {
        backgroundColor: '#FEF2F2',
        borderColor: '#DC2626',
    },
    darkChipActive: {
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        borderColor: '#EF4444',
    },
    chipText: {
        color: '#334155',
        fontSize: 14,
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
        gap: 8,
        justifyContent: 'space-between',
    },
    noteInput: {
        backgroundColor: '#FFFFFF',
        borderColor: '#CBD5E1',
        borderRadius: 12,
        borderWidth: 1.5,
        color: colors.text,
        fontSize: 15,
        lineHeight: 21,
        minHeight: 96,
        padding: 12,
        textAlignVertical: 'top',
    },
    noteInputFocused: {
        borderColor: '#DC2626',
    },
    darkNoteInput: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
        color: '#F8FAFC',
    },
    darkNoteInputFocused: {
        borderColor: '#EF4444',
    },
    charCount: {
        color: '#64748B',
        fontSize: 12,
        fontVariant: ['tabular-nums'],
    },
    charCountWarn: {
        color: colors.redDark,
        fontWeight: '700',
    },
    notesHint: {
        color: colors.secondary,
        fontSize: 12,
        lineHeight: 17,
    },
    transmitBtn: {
        alignItems: 'center',
        backgroundColor: '#0F172A',
        borderRadius: 12,
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'center',
        minHeight: 48,
        width: '100%',
    },
    darkTransmitBtn: {
        backgroundColor: '#FFBF00',
    },
    transmitBtnText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '800',
    },
    darkTransmitBtnText: {
        color: '#0F172A',
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
