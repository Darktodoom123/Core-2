import React, { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { PhotoAttachmentPicker } from '../components/attachments/PhotoAttachmentPicker';
import type { PhotoAttachment } from '../components/attachments/PhotoAttachmentPicker';
import { colors } from '../components/nativeStyles';
import { nativeLocationAdapter } from '../native/locationAdapter';
import { durableAttachmentStorage } from '../services/durableAttachmentStorage';
import type {
    OutboxCommand,
    SafetyHazardCommandPayload,
    WorkStoppageCommandPayload,
} from '../types';

type SafetyMode = 'home' | 'hazard' | 'stop-work';
type HazardSeverity = SafetyHazardCommandPayload['severity'];

interface CapturedLocation {
    latitude: number;
    longitude: number;
    accuracyMetres: number | null;
    observedAt: string;
    source: string;
}

export interface FieldSafetyScreenProps {
    actorId?: number;
    activeSite?: string | null;
    isOnline?: boolean | null;
    commands: OutboxCommand[];
    onBack: () => void;
    onReportHazard: (payload: SafetyHazardCommandPayload) => Promise<string>;
    onIssueWorkStoppage: (
        payload: WorkStoppageCommandPayload,
    ) => Promise<string>;
    onRetryCommand?: (commandId: string) => void;
}

const severityOptions: Array<{ value: HazardSeverity; label: string }> = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'critical', label: 'Critical' },
];

const categoryOptions = [
    { value: 'rigging_tackle', label: 'Rigging' },
    { value: 'equipment', label: 'Equipment' },
    { value: 'site_environment', label: 'Site' },
    { value: 'electrical', label: 'Electrical' },
    { value: 'other', label: 'Other' },
];

export function FieldSafetyScreen({
    actorId,
    activeSite,
    isOnline,
    commands,
    onBack,
    onReportHazard,
    onIssueWorkStoppage,
    onRetryCommand,
}: FieldSafetyScreenProps) {
    const [mode, setMode] = useState<SafetyMode>('home');
    const [projectSite, setProjectSite] = useState<string | null>(null);
    const projectSiteValue = projectSite ?? activeSite ?? '';
    const [area, setArea] = useState('');
    const [description, setDescription] = useState('');
    const [correctiveAction, setCorrectiveAction] = useState('');
    const [reason, setReason] = useState('');
    const [category, setCategory] = useState('equipment');
    const [severity, setSeverity] = useState<HazardSeverity>('medium');
    const [photos, setPhotos] = useState<PhotoAttachment[]>([]);
    const [location, setLocation] = useState<CapturedLocation | null>(null);
    const [capturingLocation, setCapturingLocation] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pendingCommandId, setPendingCommandId] = useState<string | null>(
        null,
    );

    const safetyCommands = useMemo(
        () =>
            [...commands]
                .filter(
                    (command) =>
                        command.type === 'report_safety_hazard' ||
                        command.type === 'issue_work_stoppage',
                )
                .sort((left, right) =>
                    right.createdAt.localeCompare(left.createdAt),
                ),
        [commands],
    );

    const currentCommand = pendingCommandId
        ? commands.find((command) => command.id === pendingCommandId)
        : undefined;

    const captureLocation = async () => {
        setCapturingLocation(true);
        setError(null);

        try {
            const snapshot = await nativeLocationAdapter.getCurrentLocation();
            setLocation({
                latitude: snapshot.latitude,
                longitude: snapshot.longitude,
                accuracyMetres: snapshot.accuracyMetres ?? null,
                observedAt: snapshot.observedAt ?? new Date().toISOString(),
                source: snapshot.source ?? 'unknown',
            });
        } catch (captureError) {
            setError(
                captureError instanceof Error
                    ? `${captureError.message} You can still report the site and area manually.`
                    : 'GPS is unavailable. Enter the site and area manually.',
            );
        } finally {
            setCapturingLocation(false);
        }
    };

    const submitHazard = async () => {
        if (
            !projectSiteValue.trim() ||
            !area.trim() ||
            description.trim().length < 10 ||
            correctiveAction.trim().length < 5
        ) {
            setError(
                'Enter a site, location, at least 10 characters describing what happened, and the corrective action needed.',
            );

            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            const durablePhotos = [];

            if (photos.length > 0 && !actorId) {
                throw new Error('Sign in again before adding photo evidence.');
            }

            for (const photo of photos) {
                const stored =
                    await durableAttachmentStorage.saveAttachmentDurably(
                        {
                            uri: photo.uri,
                            base64: photo.base64,
                            fileName: photo.fileName,
                        },
                        actorId!,
                    );
                durablePhotos.push({
                    uri: stored.uri,
                    fileName: stored.fileName,
                    fileSize: stored.fileSize ?? photo.fileSize,
                });
            }

            const commandId = await onReportHazard({
                project_site: projectSiteValue.trim(),
                category,
                severity,
                description: description.trim(),
                location_detail: area.trim(),
                corrective_action_required: correctiveAction.trim(),
                location_latitude: location?.latitude ?? null,
                location_longitude: location?.longitude ?? null,
                location_accuracy_metres: location?.accuracyMetres ?? null,
                location_observed_at: location?.observedAt ?? null,
                ...(durablePhotos.length > 0 ? { photos: durablePhotos } : {}),
            });
            setPendingCommandId(commandId);
            setMode('home');
            setDescription('');
            setCorrectiveAction('');
            setArea('');
            setPhotos([]);
        } catch (submitError) {
            setError(
                submitError instanceof Error
                    ? submitError.message
                    : 'The report could not be saved. Try again.',
            );
        } finally {
            setSubmitting(false);
        }
    };

    const submitStopWork = async () => {
        if (
            !projectSiteValue.trim() ||
            !area.trim() ||
            reason.trim().length < 10
        ) {
            setError(
                'Enter the site, affected area, and at least 10 characters explaining why work must stop.',
            );

            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            const commandId = await onIssueWorkStoppage({
                project_site: projectSiteValue.trim(),
                affected_area: area.trim(),
                reason: reason.trim(),
            });
            setPendingCommandId(commandId);
            setMode('home');
            setReason('');
            setArea('');
        } catch (submitError) {
            setError(
                submitError instanceof Error
                    ? submitError.message
                    : 'The stop-work order could not be saved. Keep work stopped and contact the Operations Manager directly.',
            );
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <View style={styles.root}>
            <View style={styles.header}>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Back"
                    onPress={
                        mode === 'home'
                            ? onBack
                            : () => {
                                  setMode('home');
                                  setError(null);
                              }
                    }
                    style={styles.backButton}
                >
                    <Text style={styles.backText}>‹</Text>
                </Pressable>
                <View style={styles.headerCopy}>
                    <Text style={styles.eyebrow}>FIELD SAFETY</Text>
                    <Text accessibilityRole="header" style={styles.title}>
                        Safety and hazards
                    </Text>
                </View>
            </View>

            {isOnline === false && (
                <View
                    accessibilityLiveRegion="assertive"
                    accessibilityRole="alert"
                    style={styles.offlineNotice}
                    testID="safety-offline-notice"
                >
                    <Text style={styles.offlineTitle}>You’re offline</Text>
                    <Text style={styles.offlineText}>
                        For immediate danger, stop work now and tell your
                        supervisor by radio. Orders and reports stay on this
                        device until they sync; the Operations Manager has not
                        received them yet.
                    </Text>
                </View>
            )}

            {error && (
                <Text accessibilityRole="alert" style={styles.error}>
                    {error}
                </Text>
            )}

            {currentCommand && mode !== 'home' && (
                <CommandStatus
                    command={currentCommand}
                    onRetry={onRetryCommand}
                />
            )}

            {mode === 'home' ? (
                <ScrollView contentContainerStyle={styles.content}>
                    <View style={styles.urgentCard}>
                        <Text style={styles.urgentEyebrow}>
                            IMMEDIATE DANGER
                        </Text>
                        <Text style={styles.cardTitle}>Stop unsafe work</Text>
                        <Text style={styles.bodyText}>
                            Use this when you see an immediate risk. The site
                            remains stopped until an Operations Manager records
                            a verified lift.
                        </Text>
                        <Pressable
                            accessibilityRole="button"
                            onPress={() => {
                                setMode('stop-work');
                                setError(null);
                                setArea('');
                            }}
                            style={styles.stopButton}
                            testID="open-stop-work-form"
                        >
                            <Text style={styles.stopButtonText}>
                                Issue stop-work order
                            </Text>
                        </Pressable>
                    </View>

                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>
                            Report a hazard or near-miss
                        </Text>
                        <Text style={styles.bodyText}>
                            Record what happened, where it happened, and the
                            action needed to make the area safe.
                        </Text>
                        <Pressable
                            accessibilityRole="button"
                            onPress={() => {
                                setMode('hazard');
                                setError(null);
                                setArea('');
                            }}
                            style={styles.secondaryButton}
                            testID="open-hazard-form"
                        >
                            <Text style={styles.secondaryButtonText}>
                                Start hazard report
                            </Text>
                        </Pressable>
                    </View>

                    <Text style={styles.sectionLabel}>Recent safety sync</Text>
                    {safetyCommands.length === 0 ? (
                        <Text style={styles.emptyText}>
                            Safety reports you submit will appear here.
                        </Text>
                    ) : (
                        safetyCommands
                            .slice(0, 4)
                            .map((command) => (
                                <CommandStatus
                                    key={command.id}
                                    command={command}
                                    onRetry={onRetryCommand}
                                />
                            ))
                    )}
                </ScrollView>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                >
                    {mode === 'stop-work' ? (
                        <View style={styles.urgentCard}>
                            <Text style={styles.urgentEyebrow}>
                                WORK MUST STOP
                            </Text>
                            <Text style={styles.cardTitle}>
                                Describe the danger
                            </Text>
                            <Text style={styles.bodyText}>
                                Keep work stopped in the affected area while
                                this order is sent and until an Operations
                                Manager confirms it can resume.
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>
                                Describe the hazard
                            </Text>
                            <Text style={styles.bodyText}>
                                If this is an immediate danger, stop work first
                                using the red action on the Safety screen.
                            </Text>
                        </View>
                    )}

                    <LabeledInput
                        label="Project site"
                        value={projectSiteValue}
                        onChangeText={setProjectSite}
                        placeholder="Site or project name"
                        testID="safety-project-site"
                    />
                    <LabeledInput
                        label={
                            mode === 'stop-work'
                                ? 'Affected area'
                                : 'Where did it happen?'
                        }
                        value={area}
                        onChangeText={setArea}
                        placeholder="Building, floor, grid, or work zone"
                        testID="safety-area"
                    />

                    <Pressable
                        accessibilityRole="button"
                        disabled={capturingLocation}
                        onPress={() => void captureLocation()}
                        style={styles.locationButton}
                        testID="capture-safety-location"
                    >
                        {capturingLocation ? (
                            <ActivityIndicator color={colors.blue} />
                        ) : (
                            <Text style={styles.locationButtonText}>
                                {location
                                    ? 'Update GPS location'
                                    : 'Add current GPS location (optional)'}
                            </Text>
                        )}
                    </Pressable>
                    {location && (
                        <Text
                            accessibilityLiveRegion="polite"
                            style={styles.locationSummary}
                        >
                            Location saved · {location.latitude.toFixed(5)},{' '}
                            {location.longitude.toFixed(5)} ·{' '}
                            {location.accuracyMetres === null
                                ? 'accuracy unavailable'
                                : `±${Math.round(location.accuracyMetres)} m`}
                        </Text>
                    )}

                    {mode === 'hazard' && (
                        <PhotoAttachmentPicker
                            attachments={photos}
                            maxCount={4}
                            onAddAttachment={(photo) =>
                                setPhotos((current) => [...current, photo])
                            }
                            onRemoveAttachment={(index) =>
                                setPhotos((current) =>
                                    current.filter(
                                        (_, photoIndex) => photoIndex !== index,
                                    ),
                                )
                            }
                            testID="safety-hazard-photo-picker"
                            title="Hazard evidence photos"
                            helperText="Add up to four clear photos. They stay on this device until the report syncs."
                        />
                    )}

                    {mode === 'stop-work' ? (
                        <LabeledInput
                            label="Why must work stop?"
                            value={reason}
                            onChangeText={setReason}
                            placeholder="Describe the immediate danger"
                            multiline
                            minLength={10}
                            testID="stop-work-reason"
                        />
                    ) : (
                        <>
                            <Text style={styles.inputLabel}>
                                Hazard category
                            </Text>
                            <View style={styles.optionRow}>
                                {categoryOptions.map((option) => (
                                    <ChoiceButton
                                        key={option.value}
                                        label={option.label}
                                        selected={category === option.value}
                                        onPress={() =>
                                            setCategory(option.value)
                                        }
                                        testID={`hazard-category-${option.value}`}
                                    />
                                ))}
                            </View>
                            <Text style={styles.inputLabel}>Severity</Text>
                            <View style={styles.optionRow}>
                                {severityOptions.map((option) => (
                                    <ChoiceButton
                                        key={option.value}
                                        label={option.label}
                                        selected={severity === option.value}
                                        onPress={() =>
                                            setSeverity(option.value)
                                        }
                                        testID={`hazard-severity-${option.value}`}
                                    />
                                ))}
                            </View>
                            {severity === 'critical' && (
                                <Text style={styles.criticalHint}>
                                    Critical hazards may need an immediate
                                    stop-work order. Return to Safety and issue
                                    one if work is unsafe.
                                </Text>
                            )}
                            <LabeledInput
                                label="What happened?"
                                value={description}
                                onChangeText={setDescription}
                                placeholder="Describe what you observed"
                                multiline
                                minLength={10}
                                testID="hazard-description"
                            />
                            <LabeledInput
                                label="Corrective action needed"
                                value={correctiveAction}
                                onChangeText={setCorrectiveAction}
                                placeholder="What should be fixed or checked?"
                                multiline
                                minLength={5}
                                testID="hazard-corrective-action"
                            />
                        </>
                    )}

                    <Pressable
                        accessibilityRole="button"
                        disabled={submitting}
                        onPress={() =>
                            void (mode === 'stop-work'
                                ? submitStopWork()
                                : submitHazard())
                        }
                        style={[
                            mode === 'stop-work'
                                ? styles.stopButton
                                : styles.submitButton,
                            submitting && styles.disabledButton,
                        ]}
                        testID={
                            mode === 'stop-work'
                                ? 'submit-stop-work'
                                : 'submit-hazard'
                        }
                    >
                        {submitting ? (
                            <ActivityIndicator color={colors.white} />
                        ) : (
                            <Text style={styles.stopButtonText}>
                                {mode === 'stop-work'
                                    ? 'Issue stop-work order'
                                    : 'Save hazard report'}
                            </Text>
                        )}
                    </Pressable>
                    {isOnline === false && (
                        <Text style={styles.pendingHint}>
                            This will be queued on the device. Contact your
                            supervisor directly until the order is confirmed as
                            sent.
                        </Text>
                    )}
                </ScrollView>
            )}
        </View>
    );
}

function LabeledInput({
    label,
    value,
    onChangeText,
    placeholder,
    multiline = false,
    testID,
}: {
    label: string;
    value: string;
    onChangeText: (value: string) => void;
    placeholder: string;
    multiline?: boolean;
    minLength?: number;
    testID: string;
}) {
    return (
        <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{label}</Text>
            <TextInput
                accessibilityLabel={label}
                maxLength={multiline ? 2000 : 255}
                multiline={multiline}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={colors.muted}
                style={[styles.input, multiline && styles.multilineInput]}
                testID={testID}
                textAlignVertical={multiline ? 'top' : 'center'}
                value={value}
            />
        </View>
    );
}

function ChoiceButton({
    label,
    selected,
    onPress,
    testID,
}: {
    label: string;
    selected: boolean;
    onPress: () => void;
    testID: string;
}) {
    return (
        <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={onPress}
            style={[styles.choiceButton, selected && styles.choiceSelected]}
            testID={testID}
        >
            <Text
                style={[
                    styles.choiceText,
                    selected && styles.choiceTextSelected,
                ]}
            >
                {label}
            </Text>
        </Pressable>
    );
}

function CommandStatus({
    command,
    onRetry,
}: {
    command: OutboxCommand;
    onRetry?: (commandId: string) => void;
}) {
    const isOrder = command.type === 'issue_work_stoppage';
    const site =
        typeof command.payload.project_site === 'string'
            ? command.payload.project_site
            : 'Work site';
    const complete = command.state === 'completed';
    const failed =
        command.state === 'failed' ||
        command.state === 'conflict' ||
        command.state === 'unresolved';
    const message = complete
        ? isOrder
            ? 'Order sent to Operations. Keep work stopped until a manager lifts it.'
            : 'Hazard report sent to Operations.'
        : failed
          ? (command.error?.message ??
            'Could not sync. Keep work stopped and contact Operations directly.')
          : isOrder
            ? 'Waiting for server confirmation. Keep work stopped until the order is sent and a manager lifts it.'
            : 'Waiting to sync with Operations.';

    return (
        <View
            accessibilityLiveRegion="polite"
            style={[
                styles.commandCard,
                complete
                    ? styles.commandComplete
                    : failed
                      ? styles.commandFailed
                      : null,
            ]}
        >
            <Text style={styles.commandTitle}>
                {isOrder ? 'Stop-work order' : 'Hazard report'} · {site}
            </Text>
            <Text style={styles.commandText}>{message}</Text>
            {failed && onRetry && (
                <Pressable
                    accessibilityRole="button"
                    onPress={() => onRetry(command.id)}
                    style={styles.retryButton}
                >
                    <Text style={styles.retryButtonText}>Retry sync</Text>
                </Pressable>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    header: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 12,
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 12,
    },
    backButton: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 14,
        borderWidth: 1,
        height: 48,
        justifyContent: 'center',
        width: 48,
    },
    backText: { color: colors.text, fontSize: 32, lineHeight: 36 },
    headerCopy: { flex: 1 },
    eyebrow: {
        color: colors.redDark,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 1.1,
    },
    title: {
        color: colors.text,
        fontSize: 23,
        fontWeight: '800',
        marginTop: 2,
    },
    offlineNotice: {
        backgroundColor: colors.warningLight,
        borderColor: colors.warningBorder,
        borderRadius: 12,
        borderWidth: 1,
        marginHorizontal: 16,
        marginBottom: 8,
        padding: 12,
    },
    offlineTitle: {
        color: colors.warningDark,
        fontSize: 14,
        fontWeight: '800',
    },
    offlineText: {
        color: colors.text,
        fontSize: 13,
        lineHeight: 19,
        marginTop: 4,
    },
    error: {
        backgroundColor: colors.redLight,
        borderColor: colors.redBorder,
        borderRadius: 10,
        borderWidth: 1,
        color: colors.redDark,
        marginHorizontal: 16,
        marginTop: 4,
        padding: 10,
    },
    content: { gap: 14, padding: 16, paddingBottom: 36 },
    urgentCard: {
        backgroundColor: colors.redLight,
        borderColor: colors.redBorder,
        borderRadius: 16,
        borderWidth: 1,
        padding: 16,
    },
    urgentEyebrow: {
        color: colors.redDark,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 1,
    },
    card: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 16,
        borderWidth: 1,
        padding: 16,
    },
    cardTitle: {
        color: colors.text,
        fontSize: 18,
        fontWeight: '800',
        marginTop: 4,
    },
    bodyText: {
        color: colors.textSecondary,
        fontSize: 14,
        lineHeight: 20,
        marginTop: 8,
    },
    stopButton: {
        alignItems: 'center',
        backgroundColor: colors.redDark,
        borderRadius: 12,
        justifyContent: 'center',
        minHeight: 54,
        marginTop: 14,
        paddingHorizontal: 16,
    },
    stopButtonText: {
        color: colors.white,
        fontSize: 15,
        fontWeight: '800',
        textAlign: 'center',
    },
    secondaryButton: {
        alignItems: 'center',
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.borderStrong,
        borderRadius: 12,
        borderWidth: 1,
        justifyContent: 'center',
        minHeight: 52,
        marginTop: 14,
        paddingHorizontal: 16,
    },
    secondaryButtonText: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '700',
    },
    sectionLabel: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '800',
        marginTop: 4,
    },
    emptyText: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
    inputGroup: { gap: 6 },
    inputLabel: { color: colors.text, fontSize: 14, fontWeight: '700' },
    input: {
        backgroundColor: colors.surface,
        borderColor: colors.borderStrong,
        borderRadius: 10,
        borderWidth: 1,
        color: colors.text,
        fontSize: 16,
        minHeight: 50,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    multilineInput: { minHeight: 110, paddingTop: 12 },
    locationButton: {
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: colors.blueLight,
        borderColor: colors.blueBorder,
        borderRadius: 10,
        borderWidth: 1,
        justifyContent: 'center',
        minHeight: 44,
        paddingHorizontal: 12,
    },
    locationButtonText: {
        color: colors.blueDark,
        fontSize: 13,
        fontWeight: '700',
    },
    locationSummary: { color: colors.greenDark, fontSize: 12, lineHeight: 18 },
    optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    choiceButton: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.borderStrong,
        borderRadius: 10,
        borderWidth: 1,
        justifyContent: 'center',
        minHeight: 44,
        minWidth: 66,
        paddingHorizontal: 11,
    },
    choiceSelected: {
        backgroundColor: colors.primaryLight,
        borderColor: colors.primaryBorder,
    },
    choiceText: {
        color: colors.textSecondary,
        fontSize: 13,
        fontWeight: '700',
    },
    choiceTextSelected: { color: colors.primaryDark },
    criticalHint: {
        backgroundColor: colors.warningLight,
        borderColor: colors.warningBorder,
        borderRadius: 10,
        borderWidth: 1,
        color: colors.warningDark,
        fontSize: 13,
        lineHeight: 19,
        padding: 10,
    },
    submitButton: {
        alignItems: 'center',
        backgroundColor: colors.primaryDark,
        borderRadius: 12,
        justifyContent: 'center',
        minHeight: 54,
        marginTop: 4,
        paddingHorizontal: 16,
    },
    disabledButton: { opacity: 0.55 },
    pendingHint: { color: colors.warningDark, fontSize: 12, lineHeight: 18 },
    commandCard: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 12,
        borderWidth: 1,
        gap: 4,
        padding: 12,
    },
    commandComplete: {
        backgroundColor: colors.greenLight,
        borderColor: colors.greenBorder,
    },
    commandFailed: {
        backgroundColor: colors.redLight,
        borderColor: colors.redBorder,
    },
    commandTitle: { color: colors.text, fontSize: 13, fontWeight: '800' },
    commandText: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
    retryButton: {
        alignSelf: 'flex-start',
        backgroundColor: colors.surface,
        borderColor: colors.borderStrong,
        borderRadius: 8,
        borderWidth: 1,
        marginTop: 5,
        minHeight: 40,
        justifyContent: 'center',
        paddingHorizontal: 12,
    },
    retryButtonText: { color: colors.text, fontSize: 13, fontWeight: '700' },
});
