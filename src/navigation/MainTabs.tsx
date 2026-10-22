import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { RecordsTabScreen } from './MainTabScreens';
import { AccountNavigator } from './AccountNavigator';
import { MaterialsNavigator } from './MaterialsNavigator';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabs() {
  return (
    <Tab.Navigator
      initialRouteName="Materials"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#5B5FEF',
        tabBarInactiveTintColor: '#8791A2',
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        tabBarStyle: {
          paddingTop: 7,
          borderTopColor: '#E9ECF2',
          backgroundColor: '#FFFFFF',
        },
      }}
    >
      <Tab.Screen
        component={MaterialsNavigator}
        name="Materials"
        options={{ tabBarLabel: '자료' }}
      />
      <Tab.Screen
        component={RecordsTabScreen}
        name="Records"
        options={{ tabBarLabel: '학습 기록' }}
      />
      <Tab.Screen
        component={AccountNavigator}
        name="Account"
        options={{ tabBarLabel: '내 정보' }}
      />
    </Tab.Navigator>
  );
}
