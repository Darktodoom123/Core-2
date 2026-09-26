import { useEffect, useMemo, useState } from 'react';
import type { FieldApiClient } from '../../services/apiClient';
import type { DvirInspectionRecord } from '../../types/index';
import { INITIAL_HISTORY } from './dvir-fixtures';
import { mapApiRecordToHistory } from './dvir-history-mapper';

/** Loads DVIR history from the server and groups it by compliance window. */
export function useDvirHistory(apiClient: FieldApiClient | undefined) {
    const [history, setHistory] =
        useState<DvirInspectionRecord[]>(INITIAL_HISTORY);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);
    const [syncError, setSyncError] = useState<string | null>(null);

    useEffect(() => {
        if (!apiClient) {
            return;
        }

        let cancelled = false;

        const load = (): void => {
            setIsHistoryLoading(true);

            apiClient
                .fetchDvirInspections(30)
                .then((res) => {
                    if (cancelled) {
                        return;
                    }

                    if (Array.isArray(res?.inspections)) {
                        setHistory(res.inspections.map(mapApiRecordToHistory));
                        setSyncError(null);
                    }
                })
                .catch(() => {
                    if (cancelled) {
                        return;
                    }

                    setSyncError(
                        'DVIR history could not be loaded. Showing cached records.',
                    );
                })
                .finally(() => {
                    if (!cancelled) {
                        setIsHistoryLoading(false);
                    }
                });
        };

        queueMicrotask(load);

        return () => {
            cancelled = true;
        };
    }, [apiClient]);

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
        isHistoryLoading,
        olderRecords,
        past7DaysRecords,
        setHistory,
        setSyncError,
        syncError,
        todayRecords,
    };
}
