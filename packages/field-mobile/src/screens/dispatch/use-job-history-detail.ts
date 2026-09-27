import { useCallback, useEffect, useRef, useState } from 'react';
import type { FieldApiClient } from '../../services/apiClient';
import type { DispatchJob, JobHistoryDetail } from '../../types/index';

export type JobHistoryDetailStatus = 'loading' | 'loaded' | 'error';

export interface JobHistoryDetailState {
    /** The job the sheet is open for, or null when closed. */
    job: DispatchJob | null;
    detail: JobHistoryDetail | null;
    status: JobHistoryDetailStatus;
    open: (job: DispatchJob) => void;
    close: () => void;
    retry: () => void;
}

/** Loads one finished job's record when the operator opens it. */
export function useJobHistoryDetail(
    apiClient: FieldApiClient | undefined,
): JobHistoryDetailState {
    const [job, setJob] = useState<DispatchJob | null>(null);
    const [detail, setDetail] = useState<JobHistoryDetail | null>(null);
    const [status, setStatus] = useState<JobHistoryDetailStatus>('loading');
    const openJobId = useRef<number | null>(null);

    useEffect(
        () => () => {
            openJobId.current = null;
        },
        [],
    );

    const load = useCallback(
        async (target: DispatchJob) => {
            setStatus('loading');
            setDetail(null);

            if (!apiClient) {
                setStatus('error');

                return;
            }

            try {
                const result = await apiClient.fetchJobHistoryDetail(target.id);

                // Ignore a late answer for a job the operator already left.
                if (openJobId.current === target.id) {
                    setDetail(result);
                    setStatus('loaded');
                }
            } catch {
                if (openJobId.current === target.id) {
                    setStatus('error');
                }
            }
        },
        [apiClient],
    );

    return {
        job,
        detail,
        status,
        open: (target) => {
            openJobId.current = target.id;
            setJob(target);
            void load(target);
        },
        close: () => {
            openJobId.current = null;
            setJob(null);
            setDetail(null);
        },
        retry: () => {
            if (job) {
                void load(job);
            }
        },
    };
}
