import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiClientError } from '../../../services/apiClient';
import type { FieldApiClient } from '../../../services/apiClient';
import type {
    EquipmentHandoverClaimResponse,
    EquipmentHandoverInitiateData,
    EquipmentHandoverInitiateResponse,
} from '../../../types/index';

export type StartStatus = 'idle' | 'starting' | 'started' | 'error';

const unwrap = (
    res: EquipmentHandoverInitiateResponse,
): EquipmentHandoverInitiateData | null => {
    const data = res?.data ?? res;

    return data && typeof data.pin === 'string' && /^\d{4}$/.test(data.pin)
        ? data
        : null;
};

/** Outgoing side: asks the server for a handover PIN. Never invents one. */
export function useStartHandover(
    apiClient: FieldApiClient | undefined,
    jobId: number | null | undefined,
) {
    const [status, setStatus] = useState<StartStatus>('idle');
    const [handover, setHandover] =
        useState<EquipmentHandoverInitiateData | null>(null);
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;

        return () => {
            mounted.current = false;
        };
    }, []);

    const start = useCallback(async () => {
        if (!apiClient || !jobId) {
            return;
        }

        setStatus('starting');
        setHandover(null);

        try {
            const data = unwrap(
                await apiClient.initiateEquipmentHandover(jobId),
            );

            if (mounted.current) {
                setHandover(data);
                setStatus(data ? 'started' : 'error');
            }
        } catch {
            if (mounted.current) {
                setStatus('error');
            }
        }
    }, [apiClient, jobId]);

    useEffect(() => {
        queueMicrotask(() => void start());
    }, [start]);

    return { status, handover, retry: () => void start() };
}

const claimErrorMessage = (error: unknown): string => {
    if (error instanceof ApiClientError) {
        if (error.isRateLimited) {
            return 'Too many tries. Wait a minute and try again.';
        }

        if (error.status >= 400 && error.status < 500 && error.message) {
            return error.message;
        }
    }

    return "The claim didn't reach the server. Check your connection and try again.";
};

/** Relief side: claims a unit by code and PIN; reports only what the server accepted. */
export function useClaimHandover(apiClient: FieldApiClient | undefined) {
    const [isClaiming, setIsClaiming] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const claim = async (
        assetCode: string,
        pin: string,
    ): Promise<EquipmentHandoverClaimResponse | null> => {
        if (!apiClient) {
            setError('Claiming a unit needs a connection to the server.');

            return null;
        }

        setIsClaiming(true);
        setError(null);

        try {
            return await apiClient.claimEquipmentHandoverByUnit(assetCode, pin);
        } catch (caught) {
            setError(claimErrorMessage(caught));

            return null;
        } finally {
            setIsClaiming(false);
        }
    };

    return { claim, isClaiming, error };
}
