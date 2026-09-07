import React, { useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    RefreshControl,
    ScrollView,
    Text,
    View,
} from 'react-native';
import {
    FuelButton,
    FuelField,
    fuelStyles,
} from '../components/fuel/fuel-controls';
import { FuelLogForm } from '../components/fuel/fuel-log-form';
import { TileScreenHeader } from '../components/layout/tile-screen-header';
import { useFuelManagement } from '../hooks/useFuelManagement';
import type { FuelDraftStore } from '../storage/fuelDraftStore';
import { useTheme } from '../theme';
import { fuelStatusLabels } from '../types/fuel';
import type { FuelApi, MobileFuelRequest } from '../types/fuel';

export interface FuelScreenProps {
    apiClient: FuelApi;
    actorId: number;
    isOnline: boolean | null;
    onBack: () => void;
    draftStore?: FuelDraftStore;
}

export function FuelScreen({
    apiClient,
    actorId,
    isOnline,
    onBack,
    draftStore,
}: FuelScreenProps) {
    const { theme } = useTheme();
    const fuel = useFuelManagement(apiClient, actorId, isOnline, draftStore);
    const [tab, setTab] = useState<'requests' | 'logs'>('requests');
    const [creating, setCreating] = useState(false);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [logging, setLogging] = useState(false);
    const selected = fuel.requests.find((request) => request.id === selectedId);
    const draft = fuel.draft;
    const locked = fuel.busy || !!draft.pending || !fuel.draftReady;
    const textStyle = [fuelStyles.body, { color: theme.textPrimary }];

    const showRequest = (request: MobileFuelRequest) => {
        setSelectedId(request.id);
        setCreating(false);
        setLogging(false);
    };
    const leaveDetail = () => {
        setSelectedId(null);
        setLogging(false);
        setCreating(false);
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: theme.canvas }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <TileScreenHeader
                title="Fuel Management"
                subtitle="Requests, approvals and recorded refueling"
                onBack={
                    fuel.busy
                        ? undefined
                        : creating || selected
                          ? leaveDetail
                          : onBack
                }
            />
            <ScrollView
                contentContainerStyle={{
                    paddingHorizontal: 16,
                    paddingBottom: 36,
                }}
                keyboardShouldPersistTaps="handled"
                refreshControl={
                    <RefreshControl
                        refreshing={fuel.loading}
                        onRefresh={() => void fuel.refresh()}
                        enabled={isOnline === true && !fuel.busy}
                    />
                }
            >
                {isOnline !== true && (
                    <Text style={[textStyle, { paddingVertical: 12 }]}>
                        {isOnline === false
                            ? 'Offline. Requests can be saved as drafts; reconnect to submit or refresh.'
                            : 'Checking connection…'}
                    </Text>
                )}
                {fuel.error && (
                    <View
                        accessibilityRole="alert"
                        style={{ paddingVertical: 12, gap: 8 }}
                    >
                        <Text style={textStyle}>{fuel.error}</Text>
                        <FuelButton
                            title="Refresh fuel records"
                            onPress={() => void fuel.refresh()}
                            disabled={isOnline !== true || fuel.busy}
                        />
                    </View>
                )}
                {fuel.notice && (
                    <Text
                        accessibilityLiveRegion="polite"
                        style={[textStyle, { paddingVertical: 12 }]}
                    >
                        {fuel.notice}
                    </Text>
                )}

                {creating ? (
                    <View style={fuelStyles.section}>
                        <Text
                            style={[
                                fuelStyles.title,
                                { color: theme.textPrimary },
                            ]}
                        >
                            Request fuel
                        </Text>
                        <Text style={textStyle}>{fuel.draftNotice}</Text>
                        {draft.pending && (
                            <Text style={textStyle}>
                                Submission needs confirmation. Retry this saved
                                request to avoid creating a duplicate.
                            </Text>
                        )}
                        <Text style={textStyle}>Equipment (optional)</Text>
                        <View style={fuelStyles.row}>
                            <FuelButton
                                title="No equipment"
                                selected={draft.assetId === null}
                                onPress={() =>
                                    fuel.updateDraft({
                                        assetId: null,
                                        jobId: null,
                                    })
                                }
                                disabled={locked}
                            />
                            {fuel.options?.assets.map((asset) => (
                                <FuelButton
                                    key={asset.id}
                                    title={`${asset.code} · ${asset.name}`}
                                    selected={draft.assetId === asset.id}
                                    onPress={() =>
                                        fuel.updateDraft({
                                            assetId: asset.id,
                                            jobId: null,
                                        })
                                    }
                                    disabled={locked}
                                />
                            ))}
                        </View>
                        {fuel.options?.assets.length === 0 && (
                            <Text style={textStyle}>
                                No equipment is currently assigned. You can
                                submit a general request and describe the need.
                            </Text>
                        )}
                        <Text style={textStyle}>Job (optional)</Text>
                        <View style={fuelStyles.row}>
                            <FuelButton
                                title="No job"
                                selected={draft.jobId === null}
                                onPress={() =>
                                    fuel.updateDraft({ jobId: null })
                                }
                                disabled={locked}
                            />
                            {fuel.options?.jobs
                                .filter(
                                    (job) =>
                                        !draft.assetId ||
                                        job.operational_asset_ids.includes(
                                            draft.assetId,
                                        ),
                                )
                                .map((job) => (
                                    <FuelButton
                                        key={job.id}
                                        title={job.reference}
                                        selected={draft.jobId === job.id}
                                        onPress={() =>
                                            fuel.updateDraft({ jobId: job.id })
                                        }
                                        disabled={locked}
                                    />
                                ))}
                        </View>
                        <FuelField
                            label="Requested quantity (liters)"
                            value={draft.quantity}
                            onChangeText={(quantity) =>
                                fuel.updateDraft({ quantity })
                            }
                            keyboardType="decimal-pad"
                            editable={!locked}
                        />
                        <Text style={textStyle}>Fuel type</Text>
                        <View style={fuelStyles.row}>
                            {(['diesel', 'gasoline'] as const).map((type) => (
                                <FuelButton
                                    key={type}
                                    title={
                                        type === 'diesel'
                                            ? 'Diesel'
                                            : 'Gasoline'
                                    }
                                    selected={draft.fuelType === type}
                                    onPress={() =>
                                        fuel.updateDraft({ fuelType: type })
                                    }
                                    disabled={locked}
                                />
                            ))}
                        </View>
                        <FuelField
                            label="Purpose"
                            value={draft.purpose}
                            onChangeText={(purpose) =>
                                fuel.updateDraft({ purpose })
                            }
                            maxLength={2000}
                            multiline
                            editable={!locked}
                        />
                        <FuelButton
                            title={
                                fuel.busy
                                    ? 'Submitting…'
                                    : draft.pending
                                      ? 'Retry saved request'
                                      : 'Submit fuel request'
                            }
                            primary
                            disabled={
                                fuel.busy ||
                                !fuel.draftReady ||
                                isOnline !== true ||
                                !fuel.options?.can_request
                            }
                            onPress={() => {
                                void fuel.submit().then((request) => {
                                    if (request) {
                                        showRequest(request);
                                    }
                                });
                            }}
                        />
                        <FuelButton
                            title="Back to requests"
                            onPress={() => setCreating(false)}
                            disabled={fuel.busy}
                        />
                    </View>
                ) : selected ? (
                    <View style={fuelStyles.section}>
                        <Text
                            style={[
                                fuelStyles.title,
                                { color: theme.textPrimary },
                            ]}
                        >
                            {selected.reference}
                        </Text>
                        <Text style={textStyle}>
                            {fuelStatusLabels[selected.status]}
                        </Text>
                        <Text style={textStyle}>
                            {selected.quantity_litres} L · {selected.fuel_type}{' '}
                            · {selected.asset?.code ?? 'General request'}
                        </Text>
                        {selected.job?.reference && (
                            <Text style={textStyle}>
                                Job: {selected.job.reference}
                            </Text>
                        )}
                        <Text style={textStyle}>{selected.purpose}</Text>
                        {selected.decision_reason && (
                            <Text style={textStyle}>
                                Office note: {selected.decision_reason}
                            </Text>
                        )}
                        <View style={{ gap: 6 }}>
                            <Text style={textStyle}>
                                Submitted: {formatDate(selected.created_at)}
                            </Text>
                            {selected.reviewed_at && (
                                <Text style={textStyle}>
                                    Forwarded:{' '}
                                    {formatDate(selected.reviewed_at)}
                                </Text>
                            )}
                            {selected.approved_at && (
                                <Text style={textStyle}>
                                    {selected.status === 'rejected'
                                        ? 'Decision'
                                        : 'Approved'}
                                    : {formatDate(selected.approved_at)}
                                </Text>
                            )}
                            {selected.verified_at && (
                                <Text style={textStyle}>
                                    Verified: {formatDate(selected.verified_at)}
                                </Text>
                            )}
                        </View>
                        {selected.status === 'rejected' && (
                            <View style={{ gap: 8, paddingVertical: 8 }}>
                                <Text
                                    style={[
                                        textStyle,
                                        {
                                            color: '#ef4444',
                                            fontWeight: 'bold',
                                        },
                                    ]}
                                >
                                    This fuel request was declined by dispatch.
                                </Text>
                                <FuelButton
                                    title="Revise & Resubmit"
                                    primary
                                    onPress={() => {
                                        fuel.updateDraft({
                                            quantity: String(
                                                selected.quantity_litres,
                                            ),
                                            purpose: selected.purpose,
                                            fuelType: selected.fuel_type,
                                            assetId:
                                                selected.operational_asset_id,
                                            jobId: selected.dispatch_job_id,
                                        });
                                        setCreating(true);
                                        setSelectedId(null);
                                    }}
                                    disabled={fuel.busy}
                                />
                            </View>
                        )}
                        {selected.can_record && !logging && (
                            <FuelButton
                                title="Record refueling"
                                primary
                                onPress={() => setLogging(true)}
                                disabled={fuel.busy}
                            />
                        )}
                        {!selected.can_record &&
                            selected.status !== 'logged' &&
                            selected.status !== 'rejected' && (
                                <Text style={textStyle}>
                                    The office must complete approval and
                                    verification before refueling can be
                                    recorded.
                                </Text>
                            )}
                        {logging && selected.can_record && (
                            <FuelLogForm
                                key={selected.id}
                                request={selected}
                                busy={fuel.busy}
                                isOnline={isOnline === true}
                                onCancel={() => setLogging(false)}
                                onSave={async (payload, receipt) => {
                                    const saved = await fuel.record(
                                        selected.id,
                                        payload,
                                        receipt,
                                    );

                                    if (saved) {
                                        setLogging(false);
                                    }

                                    return saved;
                                }}
                            />
                        )}
                        {selected.logs.map((log) => (
                            <View
                                key={log.id}
                                style={{
                                    gap: 6,
                                    borderTopWidth: 1,
                                    borderColor: theme.border,
                                    paddingTop: 16,
                                }}
                            >
                                <Text
                                    style={[
                                        fuelStyles.title,
                                        { color: theme.textPrimary },
                                    ]}
                                >
                                    {log.quantity_litres} L recorded
                                </Text>
                                <Text style={textStyle}>
                                    {formatDate(log.recorded_at)}
                                </Text>
                                {log.total_cost !== null && (
                                    <Text style={textStyle}>
                                        PHP {Number(log.total_cost).toFixed(2)}
                                    </Text>
                                )}
                                {log.odometer_km !== null && (
                                    <Text style={textStyle}>
                                        Odometer: {log.odometer_km} km
                                    </Text>
                                )}
                                {log.hour_meter !== null && (
                                    <Text style={textStyle}>
                                        Engine hours: {log.hour_meter}
                                    </Text>
                                )}
                                {log.fuel_station && (
                                    <Text style={textStyle}>
                                        {log.fuel_station}
                                    </Text>
                                )}
                                <Text style={textStyle}>
                                    {log.has_receipt
                                        ? 'Receipt attached'
                                        : 'No receipt attached'}
                                </Text>
                                {log.is_anomaly && (
                                    <Text style={textStyle}>
                                        Needs review:{' '}
                                        {log.anomaly_reason ??
                                            'Consumption variance flagged.'}
                                    </Text>
                                )}
                            </View>
                        ))}
                        <FuelButton
                            title="Back to requests"
                            onPress={leaveDetail}
                            disabled={fuel.busy}
                        />
                    </View>
                ) : (
                    <View style={fuelStyles.section}>
                        <FuelButton
                            title={
                                draft.quantity || draft.purpose || draft.pending
                                    ? 'Continue fuel draft'
                                    : 'Request fuel'
                            }
                            primary
                            onPress={() => setCreating(true)}
                            disabled={
                                fuel.options?.can_request === false ||
                                !fuel.draftReady
                            }
                        />
                        {fuel.draftNotice && (
                            <Text style={textStyle}>{fuel.draftNotice}</Text>
                        )}
                        {fuel.options?.can_request === false && (
                            <Text style={textStyle}>
                                Your account cannot submit fuel requests.
                            </Text>
                        )}
                        <View style={fuelStyles.row}>
                            <FuelButton
                                title="Requests"
                                selected={tab === 'requests'}
                                onPress={() => setTab('requests')}
                            />
                            <FuelButton
                                title="Fuel logs"
                                selected={tab === 'logs'}
                                onPress={() => setTab('logs')}
                            />
                        </View>
                        {fuel.loading && fuel.requests.length === 0 && (
                            <ActivityIndicator accessibilityLabel="Loading fuel requests" />
                        )}
                        {!fuel.loading &&
                            !fuel.error &&
                            fuel.requests.filter(
                                (request) =>
                                    tab === 'requests' ||
                                    request.logs.length > 0,
                            ).length === 0 && (
                                <Text style={textStyle}>
                                    {isOnline === true
                                        ? tab === 'requests'
                                            ? 'No fuel requests yet. Submit your first request above.'
                                            : 'No fuel logs in the loaded requests.'
                                        : 'No fuel records loaded. Reconnect to view history.'}
                                </Text>
                            )}
                        {fuel.requests
                            .filter(
                                (request) =>
                                    tab === 'requests' ||
                                    request.logs.length > 0,
                            )
                            .map((request) => (
                                <View
                                    key={request.id}
                                    style={{
                                        paddingVertical: 14,
                                        gap: 8,
                                        borderBottomWidth: 1,
                                        borderColor: theme.border,
                                    }}
                                >
                                    <Text style={textStyle}>
                                        {request.reference} ·{' '}
                                        {fuelStatusLabels[request.status]}
                                    </Text>
                                    <Text style={textStyle}>
                                        {request.asset?.code ??
                                            'General request'}{' '}
                                        · {request.quantity_litres} L{' '}
                                        {request.fuel_type}
                                    </Text>
                                    <Text style={textStyle}>
                                        {formatDate(request.created_at)}
                                    </Text>
                                    <FuelButton
                                        title={`View ${request.reference}`}
                                        onPress={() => showRequest(request)}
                                    />
                                </View>
                            ))}
                        {fuel.nextPage && (
                            <FuelButton
                                title="Load older requests"
                                onPress={() => void fuel.loadMore()}
                                disabled={fuel.loading || isOnline !== true}
                            />
                        )}
                        <FuelButton
                            title="Refresh"
                            onPress={() => void fuel.refresh()}
                            disabled={fuel.loading || isOnline !== true}
                        />
                    </View>
                )}
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

function formatDate(value: string | null): string {
    return value ? new Date(value).toLocaleString() : 'Not recorded';
}
