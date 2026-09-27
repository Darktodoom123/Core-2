import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FieldApiClient } from '../../services/apiClient';
import type { DvirInspectionRecord } from '../../types/index';
import { mapApiRecordToHistory } from './dvir-history-mapper';

export type DvirHistoryStatus = 'loading' | 'loaded' | 'error';

/**
 * DVIR history from the server, grouped by compliance window. It starts
 * empty: nothing is shown until the server answers, and a failed load is
 * reported as such. Inspections saved on this phone stay visible, marked.
 */
export function useDvirHistory(apiClient: FieldApiClient | undefined) {
    const [history, setHistory] = useState<DvirInspectionRecord[]>([]);
    const [historyStatus, setHistoryStatus] = useState<DvirHistoryStatus>(
        apiClient ? 'loading' : 'error',
    );
    const [syncError, setSyncError] = useState<string | null>(null);
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;

        return () => {
            mounted.current = false;
        };
    }, []);

    const loadHistory = useCallback(async () => {
        if (!apiClient) {
            return;
        }

        try {
            const res = await apiClient.fetchDvirInspections(30);

            if (!mounted.current) {
                return;
            }

            if (!Array.isArray(res?.inspections)) {
                setHistoryStatus('error');

                return;
            }

            const serverRecords = res.inspections.map(mapApiRecordToHistory);
            setHistory((current) => [
                ...current.filter((record) => record.syncState === 'on_phone'),
                ...serverRecords,
            ]);
            setHistoryStatus('loaded');
        } catch {
            if (mounted.current) {
                setHistoryStatus('error');
            }
        }
    }, [apiClient]);

    useEffect(() => {
        queueMicrotask(() => void loadHistory());
    }, [loadHistory]);

    const retryHistory = useCallback(() => {
        setHistoryStatus('loading');
        void loadHistory();
    }, [loadHistory]);

    // Group history records into Today, Past 7 Days (Compliance), and Older (30-Day Archive)
    const { todayRecords, past7DaysRecords, olderRecords } = useMemo(() => {
        const now = new Date();
        const startOfToday = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
        ).getTime();
        const sevenDaysAgo = startOfToday - 7 * 86400000;

        const today: DvirInspectionRecord[] = [];
        const past7Days: DvirInspectionRecord[] = [];
        const older: DvirInspectionRecord[] = [];

        history.forEach((record) => {
            const time = new Date(record.completedAt).getTime();

            if (time >= startOfToday) {
                today.push(record);
            } else if (time >= sevenDaysAgo) {
                past7Days.push(record);
            } else {
                older.push(record);
            }
        });

        return {
            todayRecords: today,
            past7DaysRecords: past7Days,
            olderRecords: older,
        };
    }, [history]);

    return {
        history,
        historyStatus,
        isHistoryLoading: historyStatus === 'loading',
        olderRecords,
        past7DaysRecords,
        retryHistory,
        setHistory,
        setSyncError,
        syncError,
        todayRecords,
    };
}
