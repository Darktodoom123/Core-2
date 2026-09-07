import NetInfo from '@react-native-community/netinfo';

export interface NetworkAvailability {
    isConnected: boolean | null;
    isInternetReachable: boolean | null;
}

export type NetworkListener = (isOnline: boolean) => void;

export interface NetworkMonitor {
    fetchIsOnline(): Promise<boolean>;
    subscribe(listener: NetworkListener): () => void;
}

function isOnline(state: NetworkAvailability): boolean {
    return state.isConnected === true && state.isInternetReachable !== false;
}

export class NetInfoNetworkMonitor implements NetworkMonitor {
    public async fetchIsOnline(): Promise<boolean> {
        return isOnline(await NetInfo.fetch());
    }

    public subscribe(listener: NetworkListener): () => void {
        return NetInfo.addEventListener((state) => listener(isOnline(state)));
    }
}

export const defaultNetworkMonitor: NetworkMonitor =
    new NetInfoNetworkMonitor();

const FETCH_ERROR_PATTERNS = [
    /fetch failed/i,
    /connectexception/i,
    /failed to connect/i,
    /network request failed/i,
    /network error/i,
    /networkerror/i,
    /failed to fetch/i,
    /load failed/i,
    /connection refused/i,
    /connection reset/i,
    /connection timed out/i,
    /could not connect/i,
    /unable to resolve host/i,
    /unknownhostexception/i,
    /sockettimeoutexception/i,
    /socket hang up/i,
    /is offline/i,
    /device is offline/i,
    /appears to be offline/i,
    /server is offline/i,
    /went offline/i,
    /err_connection_/i,
    /err_internet_/i,
    /err_name_not_resolved/i,
    /econnrefused/i,
    /ehostunreach/i,
    /etimedout/i,
    /enotfound/i,
];

export function isFetchError(err: unknown): boolean {
    if (!err) {
        return false;
    }

    if (err instanceof TypeError) {
        return true;
    }

    const message =
        typeof err === 'string'
            ? err
            : err instanceof Error
              ? err.message
              : typeof err === 'object' && err !== null && 'message' in err
                ? String((err as { message: unknown }).message)
                : String(err);

    return FETCH_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}
