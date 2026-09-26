import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import { createHosSharedStyles } from './hos-shared-styles';
import type { TimelineDayHistory } from './hos-types';

export interface HosDayNavigatorProps {
    historyDays: TimelineDayHistory[];
    selectedDay: TimelineDayHistory;
    selectedDayIndex: number;
    setSelectedDayIndex: React.Dispatch<React.SetStateAction<number>>;
    handlePrevDay: () => void;
    handleNextDay: () => void;
}

export const HosDayNavigator: React.FC<HosDayNavigatorProps> = ({
    historyDays,
    selectedDay,
    selectedDayIndex,
    setSelectedDayIndex,
    handlePrevDay,
    handleNextDay,
}) => {
    const styles = useThemedStyles(createStyles);
    const hosSharedStyles = useThemedStyles(createHosSharedStyles);

    return (
        <View style={[styles.unifiedDateNavContainer]}>
            {/* Stepper Header Row */}
            <View style={styles.stepperHeaderRow}>
                <Pressable
                    testID="hos-prev-day-btn"
                    accessibilityRole="button"
                    accessibilityLabel="View previous day's shift timeline and logs"
                    disabled={selectedDayIndex >= historyDays.length - 1}
                    onPress={handlePrevDay}
                    style={({ pressed }) => [
                        styles.stepperNavBtn,
                        selectedDayIndex >= historyDays.length - 1 &&
                            styles.stepperNavBtnDisabled,
                        pressed && hosSharedStyles.pressed,
                    ]}
                >
                    <Text
                        style={[
                            styles.stepperNavBtnIcon,
                            selectedDayIndex >= historyDays.length - 1 &&
                                styles.stepperNavBtnIconDisabled,
                        ]}
                    >
                        ‹
                    </Text>
                    <Text
                        style={[
                            styles.stepperNavBtnText,
                            selectedDayIndex >= historyDays.length - 1 &&
                                styles.stepperNavBtnTextDisabled,
                        ]}
                    >
                        Prev
                    </Text>
                </Pressable>

                <View style={[styles.stepperCenterPill]}>
                    <Text numberOfLines={1} style={[styles.stepperDayLabel]}>
                        {selectedDay.dayLabel}
                    </Text>
                    <Text numberOfLines={1} style={[styles.stepperDateSub]}>
                        {selectedDay.dateFormatted}
                    </Text>
                </View>

                <Pressable
                    testID="hos-next-day-btn"
                    accessibilityRole="button"
                    accessibilityLabel="View next day's shift timeline and logs"
                    disabled={selectedDayIndex <= 0}
                    onPress={handleNextDay}
                    style={({ pressed }) => [
                        styles.stepperNavBtn,
                        selectedDayIndex <= 0 && styles.stepperNavBtnDisabled,
                        pressed && hosSharedStyles.pressed,
                    ]}
                >
                    <Text
                        style={[
                            styles.stepperNavBtnText,
                            selectedDayIndex <= 0 &&
                                styles.stepperNavBtnTextDisabled,
                        ]}
                    >
                        Next
                    </Text>
                    <Text
                        style={[
                            styles.stepperNavBtnIcon,
                            selectedDayIndex <= 0 &&
                                styles.stepperNavBtnIconDisabled,
                        ]}
                    >
                        ›
                    </Text>
                </Pressable>
            </View>

            {/* Integrated Horizontal Day Ribbon */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.dayPillsScrollContent}
                style={styles.dayPillsScroll}
            >
                {historyDays.map((day, idx) => {
                    const isSelected = idx === selectedDayIndex;

                    return (
                        <Pressable
                            key={day.id}
                            testID={`hos-day-pill-${idx}`}
                            accessibilityRole="button"
                            accessibilityLabel={`Select ${day.dayLabel}`}
                            onPress={() => setSelectedDayIndex(idx)}
                            style={({ pressed }) => [
                                styles.dayPill,
                                isSelected && styles.dayPillSelected,
                                pressed && hosSharedStyles.pressed,
                            ]}
                        >
                            <Text
                                numberOfLines={1}
                                style={[
                                    styles.dayPillText,
                                    isSelected && styles.dayPillTextSelected,
                                ]}
                            >
                                {day.shortDate}
                            </Text>
                        </Pressable>
                    );
                })}
            </ScrollView>
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        dayPill: {
            alignItems: 'center',
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderRadius: 20,
            borderWidth: 1,
            justifyContent: 'center',
            minHeight: 48,
            paddingHorizontal: 12,
            paddingVertical: 6,
        },
        dayPillSelected: {
            backgroundColor: theme.brandAmberLight,
            borderColor: theme.brandAmber,
        },
        dayPillText: {
            color: theme.textSecondary,
            fontSize: 12,
            fontWeight: '700',
        },
        dayPillTextSelected: {
            color: theme.textPrimary,
            fontWeight: '700',
        },
        dayPillsScroll: {
            marginBottom: 2,
        },
        dayPillsScrollContent: {
            flexDirection: 'row',
            gap: 6,
            paddingVertical: 2,
        },
        stepperCenterPill: {
            alignItems: 'center',
            flex: 1,
            paddingHorizontal: 6,
        },
        stepperDateSub: {
            color: theme.textSecondary,
            fontSize: 12,
            fontWeight: '500',
            marginTop: 1,
            textAlign: 'center',
        },
        stepperDayLabel: {
            color: theme.textPrimary,
            fontSize: 13,
            fontWeight: '700',
            textAlign: 'center',
        },
        stepperHeaderRow: {
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: 10,
        },
        stepperNavBtn: {
            alignItems: 'center',
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderRadius: 8,
            borderWidth: 1,
            flexDirection: 'row',
            gap: 3,
            justifyContent: 'center',
            minHeight: 48,
            paddingHorizontal: 10,
            paddingVertical: 6,
        },
        stepperNavBtnDisabled: {
            opacity: 0.35,
        },
        stepperNavBtnIcon: {
            color: theme.brandAmberText,
            fontSize: 16,
            fontWeight: '700',
            lineHeight: 18,
        },
        stepperNavBtnIconDisabled: {
            color: theme.textMuted,
        },
        stepperNavBtnText: {
            color: theme.brandAmberText,
            fontSize: 12,
            fontWeight: '700',
        },
        stepperNavBtnTextDisabled: {
            color: theme.textMuted,
        },
        unifiedDateNavContainer: {
            backgroundColor: theme.surfaceHighlight,
            borderColor: theme.border,
            borderRadius: 14,
            borderWidth: 1,
            marginBottom: 12,
            padding: 10,
        },
    });
