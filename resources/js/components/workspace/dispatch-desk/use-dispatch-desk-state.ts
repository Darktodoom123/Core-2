import { router } from '@inertiajs/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isValidLocalDateKey, localDateKey } from '@/lib/date-utils';
import type {
    DispatchDeskMode,
    DispatchDeskPeriod,
    DispatchDeskUrlState,
    DispatchDeskView,
    DispatchSourceFilter,
} from './types';

const DESK_KEYS = [
    'dispatch_view',
    'dispatch_mode',
    'dispatch_period',
    'dispatch_date',
    'dispatch_q',
    'dispatch_source',
    'dispatch_attention',
    'dispatch_job',
    'dispatch_intake',
    'dispatch_intake_mode',
] as const;

function firstString(value: string | null): string {
    return value?.trim() ?? '';
}

function parseView(value: string | null): DispatchDeskView {
    if (
        value === 'incoming' ||
        value === 'in-progress' ||
        value === 'history'
    ) {
        return value;
    }

    return 'schedule';
}

function parseMode(value: string | null): DispatchDeskMode {
    if (value === 'calendar' || value === 'resources') {
        return value;
    }

    return 'list';
}

function parsePeriod(value: string | null): DispatchDeskPeriod {
    if (value === 'week' || value === 'month') {
        return value;
    }

    return 'day';
}

function parseSource(value: string | null): DispatchSourceFilter {
    if (
        value === 'service_request' ||
        value === 'rental_reservation' ||
        value === 'sales_order' ||
        value === 'manual'
    ) {
        return value;
    }

    return 'all';
}

function parseIntakeMode(
    value: string | null,
): DispatchDeskUrlState['intakeMode'] {
    if (value === 'service' || value === 'rental' || value === 'sale') {
        return value;
    }

    return null;
}

export function readDispatchDeskState(
    search: string,
    initialServiceRequestId?: number | null,
): DispatchDeskUrlState {
    const params = new URLSearchParams(search);
    const legacyTab = params.get('dispatch_tab');
    const legacyProjectPlans = legacyTab === 'project-plans';
    const date = firstString(params.get('dispatch_date'));
    const selected = Number.parseInt(
        firstString(params.get('dispatch_job')),
        10,
    );
    const serviceRequest = Number.parseInt(
        firstString(params.get('serviceRequestId')),
        10,
    );
    const hasServiceRequest =
        Boolean(initialServiceRequestId) ||
        (Number.isFinite(serviceRequest) && serviceRequest > 0);
    const hasExplicitView =
        params.has('dispatch_view') || params.has('dispatch_tab');
    const hasExplicitIntake = params.has('dispatch_intake');

    return {
        view: hasExplicitView
            ? parseView(
                  params.get('dispatch_view') ?? params.get('dispatch_tab'),
              )
            : hasServiceRequest
              ? 'incoming'
              : 'schedule',
        mode: legacyProjectPlans
            ? 'resources'
            : parseMode(params.get('dispatch_mode')),
        period: parsePeriod(params.get('dispatch_period')),
        date: isValidLocalDateKey(date) ? date : localDateKey(new Date()),
        query: firstString(params.get('dispatch_q') ?? params.get('search')),
        source: parseSource(params.get('dispatch_source')),
        attentionOnly: params.get('dispatch_attention') === '1',
        selectedJobId:
            Number.isFinite(selected) && selected > 0 ? selected : null,
        showIntake: hasExplicitIntake
            ? params.get('dispatch_intake') === '1'
            : hasServiceRequest && !hasExplicitView,
        intakeMode: parseIntakeMode(params.get('dispatch_intake_mode')),
    };
}

function writeStateToUrl(state: DispatchDeskUrlState) {
    if (typeof window === 'undefined') {
        return;
    }

    const url = new URL(window.location.href);
    const params = url.searchParams;

    params.set('dispatch_view', state.view);
    params.set('dispatch_mode', state.mode);
    params.set('dispatch_period', state.period);
    params.set('dispatch_date', state.date);

    const values: Array<[string, string, boolean]> = [
        ['dispatch_q', state.query, state.query.length > 0],
        ['dispatch_source', state.source, state.source !== 'all'],
        ['dispatch_attention', '1', state.attentionOnly],
        [
            'dispatch_job',
            state.selectedJobId ? String(state.selectedJobId) : '',
            state.selectedJobId !== null,
        ],
        ['dispatch_intake', '1', state.showIntake],
        [
            'dispatch_intake_mode',
            state.intakeMode ?? '',
            state.intakeMode !== null,
        ],
    ];

    values.forEach(([key, value, shouldSet]) => {
        if (shouldSet) {
            params.set(key, value);
        } else {
            params.delete(key);
        }
    });

    // Keep the legacy project-plans URL readable while normalizing the active desk state.
    params.delete('dispatch_tab');
    const nextUrl = `${url.pathname}${params.toString() ? `?${params.toString()}` : ''}${url.hash}`;

    router.replace({
        url: nextUrl,
        preserveScroll: true,
        preserveState: true,
    });
}

function searchFromUrl(url: string | undefined): string {
    if (url) {
        try {
            return new URL(url, window.location.origin).search;
        } catch {
            return url.includes('?') ? `?${url.split('?')[1]}` : '';
        }
    }

    return typeof window === 'undefined' ? '' : window.location.search;
}

export function useDispatchDeskState(
    initialServiceRequestId?: number | null,
    currentUrl?: string,
) {
    const resolvedUrl = currentUrl ?? '';
    const [state, setState] = useState<DispatchDeskUrlState>(() =>
        readDispatchDeskState(
            searchFromUrl(resolvedUrl || undefined),
            initialServiceRequestId,
        ),
    );
    const stateRef = useRef(state);
    const urlRef = useRef(resolvedUrl);

    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    useEffect(() => {
        if (resolvedUrl === urlRef.current) {
            return;
        }

        urlRef.current = resolvedUrl;
        const next = readDispatchDeskState(
            searchFromUrl(resolvedUrl || undefined),
            initialServiceRequestId,
        );
        stateRef.current = next;
        setState(next);
    }, [initialServiceRequestId, resolvedUrl]);

    useEffect(() => {
        const onPopState = () => {
            const next = readDispatchDeskState(
                typeof window === 'undefined' ? '' : window.location.search,
                initialServiceRequestId,
            );
            stateRef.current = next;
            setState(next);
        };

        window.addEventListener('popstate', onPopState);

        return () => window.removeEventListener('popstate', onPopState);
    }, [initialServiceRequestId]);

    const update = useCallback((patch: Partial<DispatchDeskUrlState>) => {
        const next = { ...stateRef.current, ...patch };
        stateRef.current = next;
        setState(next);
        writeStateToUrl(next);
    }, []);

    return useMemo(
        () => ({
            state,
            setView: (view: DispatchDeskView) => update({ view }),
            setMode: (mode: DispatchDeskMode) => update({ mode }),
            setPeriod: (period: DispatchDeskPeriod) => update({ period }),
            setDate: (date: string) => {
                if (isValidLocalDateKey(date)) {
                    update({ date });
                }
            },
            setQuery: (query: string) => update({ query }),
            setSource: (source: DispatchSourceFilter) => update({ source }),
            setAttentionOnly: (attentionOnly: boolean) =>
                update({ attentionOnly }),
            setSelectedJobId: (selectedJobId: number | null) =>
                update({ selectedJobId }),
            setShowIntake: (showIntake: boolean) => update({ showIntake }),
            setIntakeMode: (intakeMode: DispatchDeskUrlState['intakeMode']) =>
                update({ intakeMode }),
        }),
        [state, update],
    );
}

export const dispatchDeskUrlKeys = DESK_KEYS;
