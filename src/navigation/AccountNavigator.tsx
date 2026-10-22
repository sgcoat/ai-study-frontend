import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AccountScreen } from '../features/auth/screens/AccountScreen';
import { DeleteAccountScreen } from '../features/auth/screens/DeleteAccountScreen';
import type { AccountStackParamList } from './types';

const Stack = createNativeStackNavigator<AccountStackParamList>();
export function AccountNavigator() {
  return (
    <Stack.Navigator screenOptions={{ contentStyle: { backgroundColor: '#F7F8FC' }, headerStyle: { backgroundColor: '#F7F8FC' }, headerTintColor: '#172033', headerShadowVisible: false }}>
      <Stack.Screen name="AccountHome" component={AccountScreen} options={{ title: '내 정보', headerShown: false }} />
      <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} options={{ title: '계정 삭제' }} />
    </Stack.Navigator>
  );
}
