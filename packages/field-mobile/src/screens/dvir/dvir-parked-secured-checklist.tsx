import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/common/Icon';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import { createDvirSharedStyles } from './dvir-shared-styles';
import type {
    PostTripAnswer,
    PostTripAnswers,
    PostTripCheck,
} from './post-trip-checks';

export interface DvirParkedSecuredChecklistProps {
    checks: PostTripCheck[];
    answers: PostTripAnswers;
    onAnswer: (id: string, answer: PostTripAnswer) => void;
}

/** Shutdown checks for the unit's type, each answered Yes or No. */
export const DvirParkedSecuredChecklist: React.FC<
    DvirParkedSecuredChecklistProps
> = ({ checks, answers, onAnswer }) => {
    const styles = useThemedStyles(createStyles);
    const dvirSharedStyles = useThemedStyles(createDvirSharedStyles);
    const unanswered = checks.filter((check) => !answers[check.id]).length;

    return (
        <View style={styles.card} testID="dvir-parked-secured">
            <Text style={dvirSharedStyles.telemetryHeading}>
                PARKED & SECURED
            </Text>
            <Text style={styles.hint} testID="parked-secured-hint">
                {unanswered > 0
                    ? `Answer each check · ${unanswered} left`
                    : 'All checks answered'}
            </Text>
            {checks.map((check) => (
                <CheckRow
                    answer={answers[check.id]}
                    check={check}
                    key={check.id}
                    onAnswer={onAnswer}
                />
            ))}
        </View>
    );
};

const CheckRow: React.FC<{
    check: PostTripCheck;
    answer?: PostTripAnswer;
    onAnswer: DvirParkedSecuredChecklistProps['onAnswer'];
}> = ({ check, answer, onAnswer }) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const isCritical = check.failStatus === 'critical';

    return (
        <View style={styles.row} testID={`post-trip-check-${check.id}`}>
            <Text style={styles.label}>{check.label}</Text>
            <View accessibilityRole="radiogroup" style={styles.answers}>
                <Pressable
                    accessibilityLabel={`${check.label}: yes`}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: answer === 'yes' }}
                    onPress={() => onAnswer(check.id, 'yes')}
                    style={[
                        styles.answer,
                        answer === 'yes' ? styles.answerYes : null,
                    ]}
                    testID={`post-trip-${check.id}-yes`}
                >
                    {/* Icons mark only the chosen answer, never an unanswered one. */}
                    {answer === 'yes' ? (
                        <Icon
                            color={theme.successEmeraldText}
                            name="check-circle"
                            size={16}
                        />
                    ) : null}
                    <Text
                        style={[
                            styles.answerText,
                            answer === 'yes' ? styles.answerYesText : null,
                        ]}
                    >
                        Yes
                    </Text>
                </Pressable>
                <Pressable
                    accessibilityHint="Reports a defect; the unit will be locked"
                    accessibilityLabel={`${check.label}: no`}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: answer === 'no' }}
                    onPress={() => onAnswer(check.id, 'no')}
                    style={[
                        styles.answer,
                        answer === 'no'
                            ? isCritical
                                ? styles.answerNoCritical
                                : styles.answerNoAttention
                            : null,
                    ]}
                    testID={`post-trip-${check.id}-no`}
                >
                    {answer === 'no' ? (
                        <Icon
                            color={
                                isCritical
                                    ? theme.hazardRedText
                                    : theme.warningOrangeText
                            }
                            name="alert"
                            size={16}
                        />
                    ) : null}
                    <Text
                        style={[
                            styles.answerText,
                            answer === 'no'
                                ? isCritical
                                    ? styles.answerNoCriticalText
                                    : styles.answerNoAttentionText
                                : null,
                        ]}
                    >
                        No
                    </Text>
                </Pressable>
            </View>
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        card: {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderRadius: 12,
            borderWidth: 1,
            gap: 4,
            padding: 14,
        },
        hint: {
            color: theme.textSecondary,
            fontSize: 13,
        },
        row: {
            borderTopColor: theme.border,
            borderTopWidth: 1,
            gap: 8,
            paddingVertical: 12,
        },
        label: {
            color: theme.textPrimary,
            fontSize: 15,
            fontWeight: '500',
        },
        answers: {
            flexDirection: 'row',
            gap: 8,
        },
        answer: {
            alignItems: 'center',
            backgroundColor: theme.surface,
            borderColor: theme.borderStrong,
            borderRadius: 10,
            borderWidth: 1,
            flex: 1,
            flexDirection: 'row',
            gap: 6,
            justifyContent: 'center',
            minHeight: 48,
        },
        answerYes: {
            backgroundColor: theme.successEmeraldLight,
            borderColor: theme.successEmerald,
        },
        answerNoCritical: {
            backgroundColor: theme.hazardRedLight,
            borderColor: theme.hazardRed,
        },
        answerNoAttention: {
            backgroundColor: theme.warningOrangeLight,
            borderColor: theme.warningOrange,
        },
        answerText: {
            color: theme.textPrimary,
            fontSize: 15,
            fontWeight: '700',
        },
        answerYesText: {
            color: theme.successEmeraldText,
        },
        answerNoCriticalText: {
            color: theme.hazardRedText,
        },
        answerNoAttentionText: {
            color: theme.warningOrangeText,
        },
    });
