import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/auth/AuthContext';
import type { TokenStorageProvider } from './src/auth/tokenStorage';
import type { NetworkMonitor } from './src/connectivity/networkMonitor';
import { AppNavigator } from './src/navigation/AppNavigator';
import type { OutboxRepository } from './src/storage/outboxRepository';

export interface AppProps {
    baseUrl?: string;
    tokenStorage?: TokenStorageProvider;
    fetchFn?: typeof fetch;
    networkMonitor?: NetworkMonitor;
    outboxRepository?: OutboxRepository;
}

export const App: React.FC<AppProps> = ({
    baseUrl,
    tokenStorage,
    fetchFn,
    networkMonitor,
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
                    outboxRepository={outboxRepository}
                />
            </AuthProvider>
        </SafeAreaProvider>
    );
};

export default App;
