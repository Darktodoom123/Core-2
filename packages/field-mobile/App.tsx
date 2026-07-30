import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/auth/AuthContext';
import type { TokenStorageProvider } from './src/auth/tokenStorage';
import { AppNavigator } from './src/navigation/AppNavigator';

export interface AppProps {
    baseUrl?: string;
    tokenStorage?: TokenStorageProvider;
    fetchFn?: typeof fetch;
}

export const App: React.FC<AppProps> = ({ baseUrl, tokenStorage, fetchFn }) => {
    return (
        <SafeAreaProvider>
            <AuthProvider
                baseUrl={baseUrl}
                tokenStorage={tokenStorage}
                fetchFn={fetchFn}
            >
                <AppNavigator />
            </AuthProvider>
        </SafeAreaProvider>
    );
};

export default App;
