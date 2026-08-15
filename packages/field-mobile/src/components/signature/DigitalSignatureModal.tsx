import React, { useRef, useState } from 'react';
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
import { colors, sharedStyles } from '../nativeStyles';

export interface SignaturePoint {
    x: number;
    y: number;
}

export type SignatureStroke = SignaturePoint[];

export interface DigitalSignatureData {
    signerName: string;
    signerRole: string;
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
    const [strokes, setStrokes] = useState<SignatureStroke[]>([]);
    const currentStrokeRef = useRef<SignatureStroke>([]);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: (evt) => {
                const { locationX, locationY } = evt.nativeEvent;
                currentStrokeRef.current = [{ x: locationX, y: locationY }];
                setStrokes((prev) => [...prev, [{ x: locationX, y: locationY }]]);
            },
            onPanResponderMove: (evt) => {
                const { locationX, locationY } = evt.nativeEvent;
                const point = { x: locationX, y: locationY };
                currentStrokeRef.current.push(point);
                setStrokes((prev) => {
                    if (prev.length === 0) return [[point]];
                    const lastIdx = prev.length - 1;
                    const updated = [...prev];
                    updated[lastIdx] = [...updated[lastIdx], point];
                    return updated;
                });
            },
            onPanResponderRelease: () => {
                currentStrokeRef.current = [];
            },
        }),
    ).current;

    const handleClear = () => {
        setStrokes([]);
        currentStrokeRef.current = [];
    };

    const handleUndo = () => {
        setStrokes((prev) => prev.slice(0, -1));
    };

    const totalPoints = strokes.reduce((acc, s) => acc + s.length, 0);
    const hasSignature = totalPoints >= 4;
    const canSubmit = signerName.trim().length > 0 && hasSignature;

    const handleSubmit = () => {
        if (!canSubmit) return;

        onConfirmSignature({
            signerName: signerName.trim(),
            signerRole: signerRole.trim() || 'Site Representative',
            strokes,
            pointCount: totalPoints,
            signedAt: new Date().toISOString(),
        });
        handleClear();
        setSignerName('');
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
                                <Text style={styles.closeIcon}>✕</Text>
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
                                style={styles.input}
                                value={signerName}
                                testID={`${testID}-name-input`}
                            />

                            <Text style={styles.label}>Signer Role / Title</Text>
                            <TextInput
                                accessibilityLabel="Signer role"
                                onChangeText={setSignerRole}
                                placeholder="e.g. Site Supervisor / Project Manager"
                                style={styles.input}
                                value={signerRole}
                                testID={`${testID}-role-input`}
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
                                            strokes.length === 0 && styles.btnDisabled,
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
                                            strokes.length === 0 && styles.btnDisabled,
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
                                        <Text style={styles.placeholderText}>
                                            ✍️ Sign on the line above
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
                                By signing, the client representative verifies that the
                                scheduled operations and site deliverables for{' '}
                                <Text style={{ fontWeight: '800' }}>{jobReference}</Text>{' '}
                                have been completed safely and satisfactorily.
                            </Text>

                            <Pressable
                                accessibilityLabel="Confirm signature and complete job"
                                accessibilityRole="button"
                                accessibilityState={{ disabled: !canSubmit }}
                                disabled={!canSubmit}
                                onPress={handleSubmit}
                                style={({ pressed }) => [
                                    sharedStyles.button,
                                    styles.submitButton,
                                    !canSubmit && styles.submitDisabled,
                                    pressed && canSubmit && styles.pressed,
                                ]}
                                testID={`${testID}-submit`}
                            >
                                <Text style={sharedStyles.buttonText}>
                                    ✓ Confirm & Complete Job
                                </Text>
                            </Pressable>
                        </View>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        flex: 1,
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '92%',
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 36,
    },
    header: {
        alignItems: 'flex-start',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    title: {
        color: colors.text,
        fontSize: 18,
        fontWeight: '900',
    },
    subtitle: {
        color: colors.secondary,
        fontSize: 13,
        fontWeight: '700',
        marginTop: 2,
    },
    closeButton: {
        alignItems: 'center',
        backgroundColor: colors.surfaceMuted,
        borderRadius: 16,
        height: 32,
        justifyContent: 'center',
        width: 32,
    },
    closeIcon: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '800',
    },
    formSection: {
        gap: 8,
        marginBottom: 14,
    },
    label: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '800',
    },
    input: {
        backgroundColor: colors.surface,
        borderColor: colors.borderStrong,
        borderRadius: 8,
        borderWidth: 1,
        color: colors.text,
        fontSize: 14,
        minHeight: 48,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    canvasSection: {
        marginTop: 6,
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
        borderColor: colors.border,
        borderRadius: 6,
        borderWidth: 1,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    canvasActionText: {
        color: colors.secondary,
        fontSize: 12,
        fontWeight: '700',
    },
    btnDisabled: {
        opacity: 0.4,
    },
    canvas: {
        backgroundColor: colors.surfaceMuted,
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
        height: '100%',
        justifyContent: 'center',
        position: 'absolute',
        width: '100%',
    },
    placeholderText: {
        color: colors.muted,
        fontSize: 14,
        fontWeight: '700',
    },
    strokePoint: {
        backgroundColor: colors.text,
        borderRadius: 2,
        height: 4,
        position: 'absolute',
        width: 4,
    },
    signatureLine: {
        backgroundColor: colors.borderStrong,
        bottom: 36,
        height: 1,
        left: 20,
        position: 'absolute',
        right: 20,
    },
    footerSection: {
        marginTop: 16,
    },
    legalNotice: {
        color: colors.muted,
        fontSize: 11,
        lineHeight: 16,
        marginBottom: 12,
        textAlign: 'center',
    },
    submitButton: {
        backgroundColor: colors.green,
        minHeight: 52,
        width: '100%',
    },
    submitDisabled: {
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderWidth: 1,
    },
    pressed: {
        opacity: 0.78,
    },
});
