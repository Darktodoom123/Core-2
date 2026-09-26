import React, { useState } from 'react';
import { Text, View } from 'react-native';
import type { FuelFieldErrors } from '../../hooks/useFuelManagement';
import { defaultFuelContext } from '../../hooks/useFuelManagement';
import type { FuelDraft } from '../../storage/fuelDraftStore';
import { useTheme } from '../../theme';
import { fuelUrgencyOptions } from '../../types/fuel';
import type { FuelOptions } from '../../types/fuel';
import {
    FuelBanner,
    FuelButton,
    FuelConnectionPill,
    FuelField,
    FuelLabel,
    FuelPickerRow,
    FuelRadioCard,
    FuelSegmented,
    FuelSheet,
    FuelSheetOption,
    FuelUnitField,
    fuelStyles,
} from './fuel-controls';

const PURPOSE_MAX = 500;

const NEEDED_BY_CHOICES: {
    key: string;
    label: string;
    at: () => string | null;
}[] = [
    { key: 'none', label: 'No deadline', at: () => null },
    {
        key: '1h',
        label: 'Within 1 hour',
        at: () => new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    },
    {
        key: '3h',
        label: 'Within 3 hours',
        at: () => new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    },
    {
        key: 'tomorrow',
        label: 'Tomorrow 7 AM',
        at: () => {
            const next = new Date();
            next.setDate(next.getDate() + 1);
            next.setHours(7, 0, 0, 0);

            return next.toISOString();
        },
    },
];

type Sheet = 'asset' | 'job' | 'neededBy' | null;

function formatSavedAt(value: string | null): string {
    if (!value) {
        return 'an earlier session';
    }

    return new Date(value).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

function formatNeededBy(value: string): string {
    return new Date(value).toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

/** Accepts digits only and clamps to the server's 0–100 range. */
function parseLevel(text: string): number | null {
    const digits = text.replace(/[^0-9]/g, '');

    if (digits === '') {
        return null;
    }

    return Math.min(100, Number(digits));
}

export function FuelRequestForm({
    draft,
    options,
    fieldErrors,
    restoredDraft,
    locked,
    busy,
    canSubmit,
    isOnline,
    onChange,
    onDiscardDraft,
    onSubmit,
    onCancel,
}: {
    draft: FuelDraft;
    options: FuelOptions | null;
    fieldErrors: FuelFieldErrors;
    restoredDraft: { savedAt: string | null } | null;
    locked: boolean;
    busy: boolean;
    canSubmit: boolean;
    isOnline: boolean;
    onChange: (patch: Partial<FuelDraft>) => void;
    onDiscardDraft: () => void;
    onSubmit: () => void;
    onCancel: () => void;
}) {
    const { theme } = useTheme();
    const [sheet, setSheet] = useState<Sheet>(null);
    const defaults = defaultFuelContext(options);
    const assets = options?.assets ?? [];
    const jobs = (options?.jobs ?? []).filter(
        (job) =>
            !draft.assetId || job.operational_asset_ids.includes(draft.assetId),
    );
    const selectedAsset = assets.find((asset) => asset.id === draft.assetId);
    const selectedJob = jobs.find((job) => job.id === draft.jobId);
    const assetCode = (id: number | null) =>
        assets.find((asset) => asset.id === id)?.code ?? null;
    const draftDiffersFromAssignment =
        restoredDraft !== null &&
        defaults.assetId !== null &&
        draft.assetId !== defaults.assetId;
    // Quick picks resolve to a timestamp, so remember which pick produced the
    // stored value; a restored draft with another time shows no pick selected.
    const [neededByPick, setNeededByPick] = useState<{
        key: string;
        at: string | null;
    } | null>(null);
    const neededByKey = !draft.neededBy
        ? 'none'
        : neededByPick?.at === draft.neededBy
          ? neededByPick.key
          : 'custom';
    const close = () => setSheet(null);

    return (
        <View style={fuelStyles.section} testID="fuel-request-form">
            <Text
                style={[fuelStyles.title, { color: theme.textPrimary }]}
                accessibilityRole="header"
            >
                Request fuel
            </Text>
            <FuelConnectionPill online={isOnline} />

            {restoredDraft && (
                <FuelBanner
                    tone="warning"
                    title={`Restored draft from ${formatSavedAt(restoredDraft.savedAt)}`}
                    message={
                        draftDiffersFromAssignment
                            ? `This draft is for ${assetCode(draft.assetId) ?? 'no equipment'}, but your current unit is ${assetCode(defaults.assetId)}. Check before sending.`
                            : 'Check the details before sending, or start over.'
                    }
                    testID="fuel-restored-draft-banner"
                >
                    <FuelButton
                        title="Discard draft"
                        onPress={onDiscardDraft}
                        disabled={locked}
                        testID="fuel-discard-draft"
                    />
                </FuelBanner>
            )}

            {draft.pending && (
                <FuelBanner
                    tone="info"
                    message="This request was already saved for sending. Retry it to avoid creating a duplicate."
                />
            )}

            <View style={{ gap: 10 }}>
                <Text style={[styles.group, { color: theme.textPrimary }]}>
                    Equipment and job
                </Text>
                <FuelPickerRow
                    icon="crane"
                    label="Equipment"
                    optional
                    value={
                        selectedAsset
                            ? `${selectedAsset.code} · ${selectedAsset.name}`
                            : 'No equipment (general use)'
                    }
                    placeholder="Choose equipment"
                    hint={
                        selectedAsset && selectedAsset.id === defaults.assetId
                            ? 'Your current unit'
                            : undefined
                    }
                    onPress={() => setSheet('asset')}
                    disabled={locked}
                    testID="fuel-asset-picker"
                />
                {assets.length === 0 && (
                    <Text
                        style={[
                            fuelStyles.body,
                            { color: theme.textSecondary },
                        ]}
                    >
                        No equipment is assigned to you right now. You can send
                        a general request and describe the need.
                    </Text>
                )}
                {jobs.length > 0 && (
                    <FuelPickerRow
                        icon="clipboard"
                        label="Job"
                        optional
                        value={
                            selectedJob
                                ? `${selectedJob.reference} · ${selectedJob.title}`
                                : 'No job'
                        }
                        placeholder="Choose job"
                        hint={
                            selectedJob && selectedJob.id === defaults.jobId
                                ? 'Current job'
                                : undefined
                        }
                        onPress={() => setSheet('job')}
                        disabled={locked}
                        testID="fuel-job-picker"
                    />
                )}
            </View>

            <View style={{ gap: 14 }}>
                <Text style={[styles.group, { color: theme.textPrimary }]}>
                    Fuel needed
                </Text>
                <FuelUnitField
                    label="Requested quantity (liters)"
                    unit="L"
                    value={draft.quantity}
                    onChangeText={(quantity) => onChange({ quantity })}
                    keyboardType="decimal-pad"
                    editable={!locked}
                    error={fieldErrors.quantity}
                    placeholder="e.g. 80"
                />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                    {(['diesel', 'gasoline'] as const).map((type) => (
                        <FuelRadioCard
                            key={type}
                            icon="fuel"
                            title={type === 'diesel' ? 'Diesel' : 'Gasoline'}
                            selected={draft.fuelType === type}
                            onPress={() => onChange({ fuelType: type })}
                            disabled={locked}
                            testID={`fuel-type-${type}`}
                        />
                    ))}
                </View>

                <View style={fuelStyles.field}>
                    <FuelLabel>Urgency</FuelLabel>
                    <FuelSegmented
                        options={fuelUrgencyOptions}
                        value={draft.urgency ?? 'normal'}
                        onChange={(urgency) => onChange({ urgency })}
                        disabled={locked}
                        testIDPrefix="fuel-urgency"
                    />
                    <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                        {
                            fuelUrgencyOptions.find(
                                (option) =>
                                    option.value ===
                                    (draft.urgency ?? 'normal'),
                            )?.hint
                        }
                    </Text>
                </View>

                <FuelPickerRow
                    icon="clock"
                    label="Needed by"
                    optional
                    value={
                        draft.neededBy ? formatNeededBy(draft.neededBy) : null
                    }
                    placeholder="Choose date & time"
                    onPress={() => setSheet('neededBy')}
                    disabled={locked}
                    testID="fuel-needed-by-picker"
                />

                <FuelUnitField
                    label="Current fuel level"
                    optional
                    prefix="%"
                    value={
                        draft.levelPercent === null ||
                        draft.levelPercent === undefined
                            ? ''
                            : String(draft.levelPercent)
                    }
                    onChangeText={(text) =>
                        onChange({ levelPercent: parseLevel(text) })
                    }
                    keyboardType="number-pad"
                    maxLength={3}
                    editable={!locked}
                    placeholder="Enter %"
                    helper="Estimate from the gauge, 0–100."
                />

                <View style={fuelStyles.field}>
                    <FuelField
                        label="Purpose"
                        value={draft.purpose}
                        onChangeText={(purpose) => onChange({ purpose })}
                        maxLength={PURPOSE_MAX}
                        multiline
                        editable={!locked}
                        error={fieldErrors.purpose}
                        placeholder="e.g. Refuel crane for afternoon lift"
                        style={{ minHeight: 88, textAlignVertical: 'top' }}
                    />
                    <Text
                        style={{
                            color: theme.textSecondary,
                            fontSize: 12,
                            textAlign: 'right',
                        }}
                    >
                        {draft.purpose.length}/{PURPOSE_MAX}
                    </Text>
                </View>
            </View>

            <View style={{ gap: 10 }}>
                <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                    {isOnline
                        ? 'Sent to the office for review.'
                        : 'Saved on this device and sent to the office for review when you reconnect.'}
                </Text>
                <FuelButton
                    title={
                        busy
                            ? 'Submitting…'
                            : draft.pending
                              ? 'Retry saved request'
                              : 'Submit fuel request'
                    }
                    primary
                    disabled={busy || !canSubmit}
                    onPress={onSubmit}
                    testID="fuel-submit-request-button"
                />
                <FuelButton
                    title="Back to requests"
                    onPress={onCancel}
                    disabled={busy}
                />
            </View>

            <FuelSheet
                visible={sheet === 'asset'}
                title="Choose equipment"
                onClose={close}
                testID="fuel-asset-sheet"
            >
                {assets.map((asset) => (
                    <FuelSheetOption
                        key={asset.id}
                        title={`${asset.code} · ${asset.name}`}
                        hint={
                            asset.id === defaults.assetId
                                ? 'Your current unit'
                                : undefined
                        }
                        selected={draft.assetId === asset.id}
                        onPress={() => {
                            onChange({ assetId: asset.id, jobId: null });
                            close();
                        }}
                        testID={`fuel-asset-${asset.id}`}
                    />
                ))}
                <FuelSheetOption
                    title="No equipment (general use)"
                    selected={draft.assetId === null}
                    onPress={() => {
                        onChange({ assetId: null, jobId: null });
                        close();
                    }}
                />
            </FuelSheet>

            <FuelSheet
                visible={sheet === 'job'}
                title="Choose job"
                onClose={close}
                testID="fuel-job-sheet"
            >
                {jobs.map((job) => (
                    <FuelSheetOption
                        key={job.id}
                        title={job.reference}
                        hint={
                            job.id === defaults.jobId
                                ? `Current job · ${job.title}`
                                : job.title
                        }
                        selected={draft.jobId === job.id}
                        onPress={() => {
                            onChange({ jobId: job.id });
                            close();
                        }}
                    />
                ))}
                <FuelSheetOption
                    title="No job"
                    selected={draft.jobId === null}
                    onPress={() => {
                        onChange({ jobId: null });
                        close();
                    }}
                />
            </FuelSheet>

            <FuelSheet
                visible={sheet === 'neededBy'}
                title="Needed by"
                onClose={close}
                testID="fuel-needed-by-sheet"
            >
                {NEEDED_BY_CHOICES.map((choice) => (
                    <FuelSheetOption
                        key={choice.key}
                        title={choice.label}
                        selected={neededByKey === choice.key}
                        onPress={() => {
                            const at = choice.at();
                            setNeededByPick({ key: choice.key, at });
                            onChange({ neededBy: at });
                            close();
                        }}
                        testID={`fuel-needed-by-${choice.key}`}
                    />
                ))}
            </FuelSheet>
        </View>
    );
}

const styles = {
    group: { fontSize: 17, fontWeight: '700' as const },
};
