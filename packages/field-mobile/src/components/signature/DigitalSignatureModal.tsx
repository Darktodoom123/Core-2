import React, { useMemo, useState } from 'react';
import {
    Modal,
    PanResponder,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { Icon } from '../common/Icon';
import { colors, shadows } from '../nativeStyles';

export interface SignaturePoint {
    x: number;
    y: number;
}

export type SignatureStroke = SignaturePoint[];

export interface DigitalSignatureData {
    signerName: string;
    signerRole: string;
    workSummary?: string;
    endingMeterValue?: number | null;
    meterType?: string;
    strokes: SignatureStroke[];
    pointCount: number;
    signedAt: string;
}

export interface DigitalSignatureModalProps {
    visible: boolean;
    jobReference: string;
    clientName?: string;
    onClose: () => void;
    onConfirmSignature: (data: DigitalSignatureData) => void;
    testID?: string;
}

export const DigitalSignatureModal: React.FC<DigitalSignatureModalProps> = ({
    visible,
    jobReference,
    clientName = 'Client Representative',
    onClose,
    onConfirmSignature,
    testID = 'digital-signature-modal',
}) => {
    const [signerName, setSignerName] = useState('');
    const [signerRole, setSignerRole] = useState('Site Supervisor');
    const [workSummary, setWorkSummary] = useState(
        'Dispatched operational tasks and crane lifts completed safely per site plan.',
    );
    const [endingMeterValue, setEndingMeterValue] = useState('');
    const [meterType, setMeterType] = useState('odometer_km');
    const [strokes, setStrokes] = useState<SignatureStroke[]>([]);

    const panResponder = useMemo(
        () =>
            PanResponder.create({
                onStartShouldSetPanResponder: () => true,
                onMoveShouldSetPanResponder: () => true,
                onPanResponderGrant: (evt) => {
                    const { locationX, locationY } = evt.nativeEvent;
                    setStrokes((prev) => [
                        ...prev,
                        [{ x: locationX, y: locationY }],
                    ]);
                },
                onPanResponderMove: (evt) => {
                    const { locationX, locationY } = evt.nativeEvent;
                    const point = { x: locationX, y: locationY };
                    setStrokes((prev) => {
                        if (prev.length === 0) {
                            return [[point]];
                        }

                        const lastIdx = prev.length - 1;
                        const updated = [...prev];
                        updated[lastIdx] = [...updated[lastIdx], point];

                        return updated;
                    });
                },
                onPanResponderRelease: () => {},
            }),
        [],
    );

    const handleClear = () => {
        setStrokes([]);
    };

    const handleUndo = () => {
        setStrokes((prev) => prev.slice(0, -1));
    };

    const totalPoints = strokes.reduce((acc, s) => acc + s.length, 0);
    const hasSignature = totalPoints >= 4;
    const canSubmit = signerName.trim().length > 0 && hasSignature;

    const handleSubmit = () => {
        if (!canSubmit) {
            return;
        }

        const meterNum = endingMeterValue.trim()
            ? parseFloat(endingMeterValue.trim())
            : null;

        onConfirmSignature({
            signerName: signerName.trim(),
            signerRole: signerRole.trim() || 'Site Representative',
            workSummary: workSummary.trim(),
            endingMeterValue: Number.isNaN(meterNum) ? null : meterNum,
            meterType,
            strokes,
            pointCount: totalPoints,
            signedAt: new Date().toISOString(),
        });
        handleClear();
        setSignerName('');
        setEndingMeterValue('');
    };

    return (
        <Modal
            animationType="slide"
            transparent
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay} testID={testID}>
                <View style={styles.modalContent}>
                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Header */}
                        <View style={styles.header}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.title}>
                                    Client Sign-Off & Job Completion
                                </Text>
                                <Text style={styles.subtitle}>
                                    Job Ref: {jobReference} · {clientName}
                                </Text>
                            </View>
                            <Pressable
                                accessibilityLabel="Close signature modal"
                                accessibilityRole="button"
                                onPress={onClose}
                                style={({ pressed }) => [
                                    styles.closeButton,
                                    pressed && styles.pressed,
                                ]}
                                testID={`${testID}-close`}
                            >
                                <Icon
                                    name="close"
                                    size={20}
                                    color={colors.secondary}
                                />
                            </Pressable>
                        </View>

                        {/* Signer Info Form */}
                        <View style={styles.formSection}>
                            <Text style={styles.label}>
                                Signer Full Name (Required)
                            </Text>
                            <TextInput
                                accessibilityLabel="Signer full name"
                                onChangeText={setSignerName}
                                placeholder="e.g. John Doe"
                                placeholderTextColor={colors.muted}
                                style={styles.input}
                                value={signerName}
                                testID={`${testID}-name-input`}
                            />

                            <Text style={styles.label}>
                                Signer Role / Title
                            </Text>
                            <TextInput
                                accessibilityLabel="Signer role"
                                onChangeText={setSignerRole}
                                placeholder="e.g. Site Supervisor / Project Manager"
                                placeholderTextColor={colors.muted}
                                style={styles.input}
                                value={signerRole}
                                testID={`${testID}-role-input`}
                            />

                            <Text style={styles.label}>Work Summary</Text>
                            <TextInput
                                accessibilityLabel="Work summary"
                                multiline
                                numberOfLines={2}
                                onChangeText={setWorkSummary}
                                placeholder="Brief overview of completed operational tasks"
                                placeholderTextColor={colors.muted}
                                style={[styles.input, { minHeight: 60 }]}
                                value={workSummary}
                                testID={`${testID}-summary-input`}
                            />

                            <Text style={styles.label}>
                                Ending Meter Reading (Optional)
                            </Text>
                            <View
                                style={{
                                    flexDirection: 'row',
                                    gap: 8,
                                    marginBottom: 6,
                                }}
                            >
                                <Pressable
                                    accessibilityLabel="Select Odometer (km)"
                                    accessibilityRole="button"
                                    onPress={() => setMeterType('odometer_km')}
                                    style={[
                                        styles.canvasActionBtn,
                                        meterType === 'odometer_km' && {
                                            backgroundColor: colors.amber,
                                        },
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.canvasActionText,
                                            meterType === 'odometer_km' && {
                                                color: '#0f172a',
                                                fontWeight: '700',
                                            },
                                        ]}
                                    >
                                        Odometer (km)
                                    </Text>
                                </Pressable>
                                <Pressable
                                    accessibilityLabel="Select Engine Hours"
                                    accessibilityRole="button"
                                    onPress={() => setMeterType('engine_hours')}
                                    style={[
                                        styles.canvasActionBtn,
                                        meterType === 'engine_hours' && {
                                            backgroundColor: colors.amber,
                                        },
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.canvasActionText,
                                            meterType === 'engine_hours' && {
                                                color: '#0f172a',
                                                fontWeight: '700',
                                            },
                                        ]}
                                    >
                                        Engine Hours (hrs)
                                    </Text>
                                </Pressable>
                            </View>
                            <TextInput
                                accessibilityLabel="Ending meter reading"
                                keyboardType="numeric"
                                onChangeText={setEndingMeterValue}
                                placeholder={
                                    meterType === 'odometer_km'
                                        ? 'e.g. 50125.5 km'
                                        : 'e.g. 1420.5 hrs'
                                }
                                placeholderTextColor={colors.muted}
                                style={styles.input}
                                value={endingMeterValue}
                                testID={`${testID}-meter-input`}
                            />
                        </View>

                        {/* Signature Drawing Canvas Area */}
                        <View style={styles.canvasSection}>
                            <View style={styles.canvasHeader}>
                                <Text style={styles.label}>
                                    Sign Below with Finger or Stylus
                                </Text>
                                <View style={styles.canvasActions}>
                                    <Pressable
                                        accessibilityLabel="Undo last signature stroke"
                                        accessibilityRole="button"
                                        disabled={strokes.length === 0}
                                        onPress={handleUndo}
                                        style={({ pressed }) => [
                                            styles.canvasActionBtn,
                                            strokes.length === 0 &&
                                                styles.btnDisabled,
                                            pressed && styles.pressed,
                                        ]}
                                        testID={`${testID}-undo`}
                                    >
                                        <Text style={styles.canvasActionText}>
                                            Undo
                                        </Text>
                                    </Pressable>
                                    <Pressable
                                        accessibilityLabel="Clear signature"
                                        accessibilityRole="button"
                                        disabled={strokes.length === 0}
                                        onPress={handleClear}
                                        style={({ pressed }) => [
                                            styles.canvasActionBtn,
                                            strokes.length === 0 &&
                                                styles.btnDisabled,
                                            pressed && styles.pressed,
                                        ]}
                                        testID={`${testID}-clear`}
                                    >
                                        <Text style={styles.canvasActionText}>
                                            Clear
                                        </Text>
                                    </Pressable>
                                </View>
                            </View>

                            <View
                                {...panResponder.panHandlers}
                                style={styles.canvas}
                                testID={`${testID}-canvas`}
                            >
                                {strokes.length === 0 ? (
                                    <View
                                        pointerEvents="none"
                                        style={styles.canvasPlaceholder}
                                    >
                                        <Icon
                                            name="signature"
                                            size={22}
                                            color={colors.muted}
                                        />
                                        <Text style={styles.placeholderText}>
                                            Sign on the line above
                                        </Text>
                                    </View>
                                ) : null}

                                {/* Render Stroke Points */}
                                {strokes.map((stroke, strokeIdx) => (
                                    <React.Fragment key={`stroke-${strokeIdx}`}>
                                        {stroke.map((point, pointIdx) => (
                                            <View
                                                key={`pt-${strokeIdx}-${pointIdx}`}
                                                style={[
                                                    styles.strokePoint,
                                                    {
                                                        left: point.x - 2,
                                                        top: point.y - 2,
                                                    },
                                                ]}
                                            />
                                        ))}
                                    </React.Fragment>
                                ))}

                                <View style={styles.signatureLine} />
                            </View>
                        </View>

                        {/* Confirmation & Submission */}
                        <View style={styles.footerSection}>
                            <Text style={styles.legalNotice}>
                                By signing, the client representative verifies
                                that the dispatched tasks and crane operations
                                were completed safely and in accordance with
                                site requirements.
                            </Text>

                            <View style={styles.actionRow}>
                                <Pressable
                                    accessibilityLabel="Cancel signature"
                                    accessibilityRole="button"
                                    onPress={onClose}
                                    style={({ pressed }) => [
                                        styles.cancelButton,
                                        pressed && styles.pressed,
                                    ]}
                                    testID={`${testID}-cancel`}
                                >
                                    <Text style={styles.cancelButtonText}>
                                        Cancel
                                    </Text>
                                </Pressable>

                                <Pressable
                                    accessibilityLabel="Confirm signature and complete job"
                                    accessibilityRole="button"
                                    accessibilityState={{
                                        disabled: !canSubmit,
                                    }}
                                    disabled={!canSubmit}
                                    onPress={handleSubmit}
                                    style={({ pressed }) => [
                                        styles.submitButton,
                                        !canSubmit &&
                                            styles.submitButtonDisabled,
                                        pressed && canSubmit && styles.pressed,
                                    ]}
                                    testID={`${testID}-submit`}
                                >
                                    <Icon
                                        name="check"
                                        size={18}
                                        color={
                                            canSubmit ? '#0f172a' : colors.muted
                                        }
                                    />
                                    <Text
                                        style={[
                                            styles.submitButtonText,
                                            !canSubmit &&
                                                styles.submitButtonTextDisabled,
                                        ]}
                                    >
                                        Sign & Complete Job
                                    </Text>
                                </Pressable>
                            </View>
                        </View>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        alignItems: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        flex: 1,
        justifyContent: 'center',
        padding: 16,
    },
    modalContent: {
        backgroundColor: colors.surface,
        borderRadius: 20,
        maxHeight: '90%',
        maxWidth: 580,
        overflow: 'hidden',
        width: '100%',
        ...shadows.lg,
    },
    scrollContent: {
        padding: 20,
    },
    header: {
        alignItems: 'flex-start',
        borderBottomColor: colors.border,
        borderBottomWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingBottom: 14,
    },
    title: {
        color: colors.text,
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: -0.3,
    },
    subtitle: {
        color: colors.secondary,
        fontSize: 13,
        marginTop: 3,
    },
    closeButton: {
        alignItems: 'center',
        backgroundColor: colors.surfaceMuted,
        borderRadius: 16,
        height: 32,
        justifyContent: 'center',
        width: 32,
    },
    formSection: {
        gap: 6,
        marginVertical: 14,
    },
    label: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '600',
        marginTop: 4,
    },
    input: {
        backgroundColor: colors.surface,
        borderColor: colors.borderStrong,
        borderRadius: 10,
        borderWidth: 1,
        color: colors.text,
        fontSize: 14,
        minHeight: 44,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    canvasSection: {
        marginTop: 8,
    },
    canvasHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    canvasActions: {
        flexDirection: 'row',
        gap: 8,
    },
    canvasActionBtn: {
        backgroundColor: colors.surfaceMuted,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    btnDisabled: {
        opacity: 0.4,
    },
    canvasActionText: {
        color: colors.secondary,
        fontSize: 12,
        fontWeight: '600',
    },
    canvas: {
        backgroundColor: '#ffffff',
        borderColor: colors.borderStrong,
        borderRadius: 12,
        borderWidth: 1.5,
        height: 180,
        overflow: 'hidden',
        position: 'relative',
        width: '100%',
    },
    canvasPlaceholder: {
        alignItems: 'center',
        bottom: 0,
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'center',
        left: 0,
        position: 'absolute',
        right: 0,
        top: 0,
    },
    placeholderText: {
        color: colors.muted,
        fontSize: 14,
        fontWeight: '500',
    },
    strokePoint: {
        backgroundColor: '#0f172a',
        borderRadius: 3,
        height: 5,
        position: 'absolute',
        width: 5,
    },
    signatureLine: {
        backgroundColor: colors.border,
        bottom: 36,
        height: 1,
        left: 16,
        position: 'absolute',
        right: 16,
    },
    footerSection: {
        marginTop: 14,
    },
    legalNotice: {
        color: colors.muted,
        fontSize: 11,
        lineHeight: 16,
        marginBottom: 16,
    },
    actionRow: {
        flexDirection: 'row',
        gap: 10,
        justifyContent: 'flex-end',
    },
    cancelButton: {
        alignItems: 'center',
        backgroundColor: colors.surfaceMuted,
        borderRadius: 10,
        justifyContent: 'center',
        minHeight: 46,
        paddingHorizontal: 16,
    },
    cancelButtonText: {
        color: colors.secondary,
        fontSize: 14,
        fontWeight: '600',
    },
    submitButton: {
        alignItems: 'center',
        backgroundColor: colors.amber,
        borderRadius: 10,
        flexDirection: 'row',
        gap: 6,
        justifyContent: 'center',
        minHeight: 46,
        paddingHorizontal: 18,
        ...shadows.sm,
    },
    submitButtonDisabled: {
        backgroundColor: colors.border,
        opacity: 0.6,
    },
    submitButtonText: {
        color: '#0f172a',
        fontSize: 14,
        fontWeight: '700',
    },
    submitButtonTextDisabled: {
        color: colors.muted,
    },
    pressed: {
        opacity: 0.75,
        transform: [{ scale: 0.985 }],
    },
});
