import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { hosSharedStyles } from './hos-shared-styles';
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
    const { isDarkHud } = useTheme();

    return (
        <View
            style={[
                styles.unifiedDateNavContainer,
                isDarkHud && styles.darkUnifiedDateNavContainer,
            ]}
        >
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
                        isDarkHud && styles.darkStepperNavBtn,
                        selectedDayIndex >= historyDays.length - 1 &&
                            styles.stepperNavBtnDisabled,
                        pressed && hosSharedStyles.pressed,
                    ]}
                >
                    <Text
                        style={[
                            styles.stepperNavBtnIcon,
                            isDarkHud && styles.darkStepperNavBtnIcon,
                            selectedDayIndex >= historyDays.length - 1 &&
                                styles.stepperNavBtnIconDisabled,
                        ]}
                    >
                        ‹
                    </Text>
                    <Text
                        style={[
                            styles.stepperNavBtnText,
                            isDarkHud && styles.darkStepperNavBtnText,
                            selectedDayIndex >= historyDays.length - 1 &&
                                styles.stepperNavBtnTextDisabled,
                        ]}
                    >
                        Prev
                    </Text>
                </Pressable>

                <View
                    style={[
                        styles.stepperCenterPill,
                        isDarkHud && styles.darkStepperCenterPill,
                    ]}
                >
                    <Text
                        numberOfLines={1}
                        style={[
                            styles.stepperDayLabel,
                            isDarkHud && styles.darkStepperDayLabel,
                        ]}
                    >
                        {selectedDay.dayLabel}
                    </Text>
                    <Text
                        numberOfLines={1}
                        style={[
                            styles.stepperDateSub,
                            isDarkHud && styles.darkStepperDateSub,
                        ]}
                    >
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
                        isDarkHud && styles.darkStepperNavBtn,
                        selectedDayIndex <= 0 && styles.stepperNavBtnDisabled,
                        pressed && hosSharedStyles.pressed,
                    ]}
                >
                    <Text
                        style={[
                            styles.stepperNavBtnText,
                            isDarkHud && styles.darkStepperNavBtnText,
                            selectedDayIndex <= 0 &&
                                styles.stepperNavBtnTextDisabled,
                        ]}
                    >
                        Next
                    </Text>
                    <Text
                        style={[
                            styles.stepperNavBtnIcon,
                            isDarkHud && styles.darkStepperNavBtnIcon,
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
                                isDarkHud && styles.darkDayPill,
                                isSelected &&
                                    (isDarkHud
                                        ? styles.darkDayPillSelected
                                        : styles.dayPillSelected),
                                pressed && hosSharedStyles.pressed,
                            ]}
                        >
                            <Text
                                numberOfLines={1}
                                style={[
                                    styles.dayPillText,
                                    isDarkHud && styles.darkDayPillText,
                                    isSelected &&
                                        (isDarkHud
                                            ? styles.darkDayPillTextSelected
                                            : styles.dayPillTextSelected),
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

const styles = StyleSheet.create({
    darkDayPill: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
    },
    darkDayPillSelected: {
        backgroundColor: '#FFBF00',
        borderColor: '#FFBF00',
    },
    darkDayPillText: {
        color: '#94A3B8',
    },
    darkDayPillTextSelected: {
        color: '#090D16',
        fontWeight: '800',
    },
    darkStepperCenterPill: {},
    darkStepperDateSub: {
        color: '#94A3B8',
    },
    darkStepperDayLabel: {
        color: '#F8FAFC',
    },
    darkStepperNavBtn: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
    },
    darkStepperNavBtnIcon: {
        color: '#FFBF00',
    },
    darkStepperNavBtnText: {
        color: '#FFBF00',
    },
    darkUnifiedDateNavContainer: {
        backgroundColor: '#0F172A',
        borderColor: '#334155',
    },
    dayPill: {
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderColor: '#E2E8F0',
        borderRadius: 20,
        borderWidth: 1,
        justifyContent: 'center',
        minHeight: 32,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    dayPillSelected: {
        backgroundColor: '#0F172A',
        borderColor: '#0F172A',
    },
    dayPillText: {
        color: '#64748B',
        fontSize: 12,
        fontWeight: '700',
    },
    dayPillTextSelected: {
        color: '#FFFFFF',
        fontWeight: '800',
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
        color: '#64748B',
        fontSize: 12,
        fontWeight: '600',
        marginTop: 1,
        textAlign: 'center',
    },
    stepperDayLabel: {
        color: '#0F172A',
        fontSize: 13,
        fontWeight: '800',
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
        backgroundColor: '#FFFFFF',
        borderColor: '#E2E8F0',
        borderRadius: 8,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 3,
        justifyContent: 'center',
        minHeight: 36,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    stepperNavBtnDisabled: {
        opacity: 0.35,
    },
    stepperNavBtnIcon: {
        color: '#FFBF00',
        fontSize: 16,
        fontWeight: '800',
        lineHeight: 18,
    },
    stepperNavBtnIconDisabled: {
        color: '#94A3B8',
    },
    stepperNavBtnText: {
        color: '#FFBF00',
        fontSize: 12,
        fontWeight: '700',
    },
    stepperNavBtnTextDisabled: {
        color: '#94A3B8',
    },
    unifiedDateNavContainer: {
        backgroundColor: '#F8FAFC',
        borderColor: '#E2E8F0',
        borderRadius: 14,
        borderWidth: 1,
        marginBottom: 12,
        padding: 10,
    },
});
