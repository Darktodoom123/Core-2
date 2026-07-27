import React from 'react';
import { AuthProvider } from './src/auth/AuthContext.js';
import type { TokenStorageProvider } from './src/auth/tokenStorage.js';
import { AppNavigator } from './src/navigation/AppNavigator.js';

export interface AppProps {
  baseUrl?: string;
  tokenStorage?: TokenStorageProvider;
  fetchFn?: typeof fetch;
  initialToken?: string | null;
}

export const App: React.FC<AppProps> = ({
  baseUrl,
  tokenStorage,
  fetchFn,
  initialToken,
}) => {
  return (
    <AuthProvider
      baseUrl={baseUrl}
      tokenStorage={tokenStorage}
      fetchFn={fetchFn}
      initialToken={initialToken}
    >
      <AppNavigator />
    </AuthProvider>
  );
};

export default App;
