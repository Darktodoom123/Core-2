import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/auth/AuthContext';
import type { TokenStorageProvider } from './src/auth/tokenStorage';
import type { NetworkMonitor } from './src/connectivity/networkMonitor';
import { AppNavigator } from './src/navigation/AppNavigator';
import type { OutboxRepository } from './src/storage/outboxRepository';
import type { PayloadHasher } from './src/storage/outboxRepository';

export interface AppProps {
    baseUrl?: string;
    tokenStorage?: TokenStorageProvider;
    fetchFn?: typeof fetch;
    networkMonitor?: NetworkMonitor;
    outboxHasher?: PayloadHasher;
    outboxRepository?: OutboxRepository;
}

export const App: React.FC<AppProps> = ({
    baseUrl,
    tokenStorage,
    fetchFn,
    networkMonitor,
    outboxHasher,
    outboxRepository,
}) => {
    return (
        <SafeAreaProvider>
            <AuthProvider
                baseUrl={baseUrl}
                tokenStorage={tokenStorage}
                fetchFn={fetchFn}
            >
                <AppNavigator
                    networkMonitor={networkMonitor}
                    outboxHasher={outboxHasher}
                    outboxRepository={outboxRepository}
                />
            </AuthProvider>
        </SafeAreaProvider>
    );
};

export default App;
