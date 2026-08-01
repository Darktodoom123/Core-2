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
