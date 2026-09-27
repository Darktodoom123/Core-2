import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    BackHandler,
    KeyboardAvoidingView,
    Platform,
    RefreshControl,
    ScrollView,
    Text,
    View,
} from 'react-native';
import {
    FuelBanner,
    FuelButton,
    FuelSegmented,
    fuelStyles,
} from '../components/fuel/fuel-controls';
import { FuelEmptyState } from '../components/fuel/fuel-empty-state';
import { FuelLogForm } from '../components/fuel/fuel-log-form';
import {
    FuelRequestDetail,
    FuelRequestListItem,
    QueuedFuelRequestItem,
} from '../components/fuel/fuel-request-detail';
import { FuelRequestForm } from '../components/fuel/fuel-request-form';
import { fuelSections } from '../components/fuel/fuel-sections';
import { TileScreenHeader } from '../components/layout/tile-screen-header';
import { useFuelManagement } from '../hooks/useFuelManagement';
import type { FuelCommandQueue } from '../hooks/useFuelManagement';
import type { FuelDraftStore } from '../storage/fuelDraftStore';
import { useTheme } from '../theme';
import type { FuelApi, MobileFuelRequest } from '../types/fuel';

export interface FuelScreenProps {
    apiClient: FuelApi;
    actorId: number;
    isOnline: boolean | null;
    commandOutbox: FuelCommandQueue;
    isOutboxReady: boolean;
    syncQueue: () => Promise<unknown>;
    onBack: () => void;
    draftStore?: FuelDraftStore;
    /** Opens this request directly, e.g. from a fuel notification tap. */
    initialRequestId?: number | null;
}

function emptyStateFor(
    tab: 'requests' | 'logs',
    hasError: boolean,
    isOnline: boolean,
) {
    if (hasError) {
        return {
            icon: 'cloud' as const,
            title: "Fuel records didn't load",
            body: 'Use Refresh fuel records above when you have signal. Anything saved on this phone is kept.',
        };
    }

    if (!isOnline) {
        return {
            icon: 'cloud' as const,
            title: 'Nothing saved on this phone',
            body: 'Reconnect to load your fuel history.',
        };
    }

    return tab === 'requests'
        ? {
              icon: 'fuel' as const,
              title: 'No fuel requests yet',
              body: 'Tap Request fuel to ask the office for fuel. Approved requests appear here, ready to refuel.',
          }
        : {
              icon: 'clipboard' as const,
              title: 'No refuels recorded yet',
              body: 'After you refuel against an approved request, the record and receipt appear here.',
          };
}

export function FuelScreen({
    apiClient,
    actorId,
    isOnline,
    commandOutbox,
    isOutboxReady,
    syncQueue,
    onBack,
    draftStore,
    initialRequestId = null,
}: FuelScreenProps) {
    const { theme } = useTheme();
    const fuel = useFuelManagement(
        apiClient,
        actorId,
        isOnline,
        commandOutbox,
        isOutboxReady,
        syncQueue,
        draftStore,
    );
    const [tab, setTab] = useState<'requests' | 'logs'>('requests');
    const [creating, setCreating] = useState(false);
    const [selectedId, setSelectedId] = useState<number | null>(
        initialRequestId,
    );
    const [logging, setLogging] = useState(false);
    // Only show the pull-to-refresh spinner for user pulls; background loads use
    // the inline loading text so the spinner never covers the "Request fuel" CTA.
    const [pulling, setPulling] = useState(false);
    const scrollRef = useRef<ScrollView>(null);
    const selected = fuel.requests.find((request) => request.id === selectedId);
    const draft = fuel.draft;
    const locked = fuel.busy || !!draft.pending || !fuel.draftReady;

    useEffect(() => {
        if (initialRequestId !== null) {
            queueMicrotask(() => {
                setSelectedId(initialRequestId);
                setCreating(false);
            });
        }
    }, [initialRequestId]);

    // Hardware back steps out of the form/detail before leaving Fuel. Re-registering
    // on each change keeps this handler ahead of the navigator's.
    useEffect(() => {
        if (!creating && selectedId === null) {
            return;
        }

        const subscription = BackHandler.addEventListener(
            'hardwareBackPress',
            () => {
                if (!fuel.busy) {
                    if (logging) {
                        setLogging(false);
                    } else {
                        setSelectedId(null);
                        setCreating(false);
                    }
                }

                return true;
            },
        );

        return () => subscription.remove();
    }, [creating, selectedId, logging, fuel.busy]);

    const showRequest = (request: MobileFuelRequest) => {
        setSelectedId(request.id);
        setCreating(false);
        setLogging(false);
    };
    const leaveDetail = () => {
        if (logging) {
            setLogging(false);

            return;
        }

        setSelectedId(null);
        setLogging(false);
        setCreating(false);
    };

    const visible = fuel.requests.filter(
        (request) => tab === 'requests' || request.logs.length > 0,
    );
    const sections = fuelSections(tab, visible);
    const hasDraft = Boolean(draft.quantity || draft.purpose || draft.pending);

    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: theme.canvas }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            testID="fuel-management-screen"
        >
            <TileScreenHeader
                category="Fuel"
                title="Fuel Management"
                subtitle="Request fuel, refuel, capture the receipt"
                onBack={
                    fuel.busy
                        ? undefined
                        : creating || selected
                          ? leaveDetail
                          : onBack
                }
            />
            <ScrollView
                ref={scrollRef}
                contentContainerStyle={{
                    paddingHorizontal: 16,
                    paddingTop: 12,
                    paddingBottom: 36,
                    gap: 12,
                }}
                keyboardShouldPersistTaps="handled"
                refreshControl={
                    <RefreshControl
                        refreshing={pulling}
                        onRefresh={() => {
                            setPulling(true);
                            void fuel
                                .refresh()
                                .finally(() => setPulling(false));
                        }}
                        enabled={isOnline === true && !fuel.busy}
                    />
                }
            >
                {isOnline === false && (
                    <FuelBanner
                        tone="info"
                        title="You are offline"
                        message="Requests and refuel logs are saved on this device and sync when the connection returns."
                    />
                )}
                {!isOutboxReady && (
                    <FuelBanner
                        tone="info"
                        message="Preparing secure on-device fuel sync…"
                    />
                )}
                {fuel.error && (
                    <FuelBanner tone="danger" message={fuel.error}>
                        {!creating && isOnline === true && (
                            <FuelButton
                                title="Refresh fuel records"
                                onPress={() => void fuel.refresh()}
                                disabled={fuel.busy}
                            />
                        )}
                    </FuelBanner>
                )}
                {fuel.notice && (
                    <FuelBanner
                        tone={
                            fuel.notice.includes('on this device') ||
                            fuel.notice.includes('queue')
                                ? 'info'
                                : 'success'
                        }
                        message={fuel.notice}
                        testID="fuel-notice"
                    />
                )}
                {fuel.cacheNotice && (
                    <FuelBanner tone="warning" message={fuel.cacheNotice} />
                )}

                {creating ? (
                    <FuelRequestForm
                        draft={draft}
                        options={fuel.options}
                        fieldErrors={fuel.fieldErrors}
                        restoredDraft={fuel.restoredDraft}
                        locked={locked}
                        busy={fuel.busy}
                        isOnline={isOnline === true}
                        canSubmit={
                            fuel.draftReady &&
                            isOutboxReady &&
                            fuel.options?.can_request === true
                        }
                        onChange={fuel.updateDraft}
                        onDiscardDraft={() => void fuel.discardDraft()}
                        onSubmit={() => {
                            void fuel.submit().then((result) => {
                                if (result?.request) {
                                    showRequest(result.request);
                                } else if (result) {
                                    setCreating(false);
                                }
                            });
                        }}
                        onCancel={() => setCreating(false)}
                    />
                ) : selected && logging && selected.can_record ? (
                    <FuelLogForm
                        key={selected.id}
                        request={selected}
                        busy={fuel.busy}
                        isOnline={isOnline === true}
                        outboxReady={isOutboxReady}
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
                ) : selected ? (
                    <FuelRequestDetail
                        request={selected}
                        busy={fuel.busy}
                        withdrawPending={fuel.pendingWithdrawIds.includes(
                            selected.id,
                        )}
                        logPending={fuel.pendingLogIds.includes(selected.id)}
                        onRecord={() => {
                            fuel.dismissNotice();
                            setLogging(true);
                            scrollRef.current?.scrollTo({
                                y: 0,
                                animated: false,
                            });
                        }}
                        onWithdraw={(reason) =>
                            void fuel.withdraw(selected.id, reason)
                        }
                        onResubmit={() => {
                            fuel.updateDraft({
                                quantity: String(selected.quantity_litres),
                                purpose: selected.purpose,
                                fuelType: selected.fuel_type,
                                assetId: selected.operational_asset_id,
                                jobId: selected.dispatch_job_id,
                                urgency: selected.urgency ?? 'normal',
                                levelPercent:
                                    selected.current_fuel_level_percent ?? null,
                            });
                            setCreating(true);
                            setSelectedId(null);
                        }}
                        onBack={leaveDetail}
                    />
                ) : (
                    <View style={{ gap: 12 }}>
                        <FuelButton
                            title={
                                hasDraft
                                    ? 'Continue fuel draft'
                                    : 'Request fuel'
                            }
                            primary
                            onPress={() => setCreating(true)}
                            disabled={
                                fuel.options?.can_request === false ||
                                !fuel.draftReady ||
                                !isOutboxReady ||
                                (fuel.options?.can_request !== true &&
                                    !draft.pending)
                            }
                        />
                        {hasDraft && fuel.draftNotice ? (
                            <Text
                                style={[
                                    fuelStyles.body,
                                    { color: theme.textSecondary },
                                ]}
                            >
                                {fuel.draftNotice}
                            </Text>
                        ) : null}
                        {fuel.options?.can_request === false && (
                            <FuelBanner
                                tone="warning"
                                message="Your account cannot submit fuel requests."
                            />
                        )}

                        <FuelSegmented
                            onChange={setTab}
                            options={[
                                { value: 'requests', label: 'Requests' },
                                { value: 'logs', label: 'Fuel logs' },
                            ]}
                            testIDPrefix="fuel-tab"
                            value={tab}
                        />

                        {tab === 'requests' &&
                            fuel.queuedRequests.map((queued) => (
                                <QueuedFuelRequestItem
                                    key={queued.commandId}
                                    queued={queued}
                                />
                            ))}

                        {fuel.loading && fuel.requests.length === 0 && (
                            <ActivityIndicator accessibilityLabel="Loading fuel requests" />
                        )}

                        {!fuel.loading &&
                            visible.length === 0 &&
                            (tab === 'logs' ||
                                fuel.queuedRequests.length === 0) && (
                                <FuelEmptyState
                                    {...emptyStateFor(
                                        tab,
                                        Boolean(fuel.error),
                                        isOnline === true,
                                    )}
                                />
                            )}

                        {sections.map((section) => (
                            <View
                                key={section.title ?? 'logs'}
                                style={{ gap: 12 }}
                            >
                                {section.title ? (
                                    <Text
                                        accessibilityRole="header"
                                        testID={`fuel-section-${section.title}`}
                                        style={{
                                            color: theme.textPrimary,
                                            fontWeight: '700',
                                            fontSize: 15,
                                        }}
                                    >
                                        {section.title}
                                    </Text>
                                ) : null}
                                {section.requests.map((request) => (
                                    <FuelRequestListItem
                                        key={request.id}
                                        request={request}
                                        onPress={() => {
                                            fuel.dismissNotice();
                                            showRequest(request);
                                        }}
                                    />
                                ))}
                            </View>
                        ))}

                        {fuel.nextPage && (
                            <FuelButton
                                title="Load older requests"
                                onPress={() => void fuel.loadMore()}
                                disabled={fuel.loading || isOnline !== true}
                            />
                        )}
                    </View>
                )}
            </ScrollView>
        </KeyboardAvoidingView>
    );
}
