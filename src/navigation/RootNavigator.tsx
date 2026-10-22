import { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';

import { registerUnauthorizedHandler } from '../api/apiClient';
import { EmailLoginScreen } from '../features/auth/screens/EmailLoginScreen';
import { SessionStateScreen } from '../features/auth/screens/SessionStateScreen';
import { VerifyCodeScreen } from '../features/auth/screens/VerifyCodeScreen';
import { useAuthStore } from '../features/auth/store/authStore';
import { MainTabs } from './MainTabs';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const status = useAuthStore((state) => state.status);
  const restoreError = useAuthStore((state) => state.restoreError);
  const restoreSession = useAuthStore((state) => state.restoreSession);
  const signOut = useAuthStore((state) => state.signOut);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (status === 'signedOut') { void queryClient.cancelQueries(); queryClient.clear(); }
  }, [status, queryClient]);

  useEffect(() => {
    const unregisterUnauthorizedHandler = registerUnauthorizedHandler((sessionVersion) => {
      return useAuthStore.getState().handleUnauthorized(sessionVersion);
    });

    void restoreSession();
    return unregisterUnauthorizedHandler;
  }, [restoreSession]);

  if (status === 'restoring') {
    return <SessionStateScreen mode="loading" />;
  }

  if (status === 'restoreError') {
    return (
      <SessionStateScreen
        mode="error"
        message={restoreError}
        onRetry={() => void restoreSession()}
        onSignOut={() => void signOut()}
      />
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        key={status}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#F7F8FC' },
        }}
      >
        {status === 'signedIn' ? (
          <Stack.Screen component={MainTabs} name="MainTabs" />
        ) : (
          <>
            <Stack.Screen component={EmailLoginScreen} name="SignIn" />
            <Stack.Screen component={VerifyCodeScreen} name="VerifyCode" />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
