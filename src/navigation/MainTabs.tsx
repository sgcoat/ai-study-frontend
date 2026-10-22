import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RecordsTabScreen } from './MainTabScreens';
import { AccountNavigator } from './AccountNavigator';
import { MaterialsNavigator } from './MaterialsNavigator';
import { MainTabIcon } from './MainTabIcon';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabs() {
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  // The bar owns the bottom inset. Keep the icon/label row above Android's
  // gesture handle or three-button navigation, including larger system text.
  const bottomPadding = Math.max(insets.bottom, 12);
  const contentHeight = Math.ceil(64 + 18 * Math.max(0, fontScale - 1));

  return (
    <Tab.Navigator
      initialRouteName="Materials"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarLabelPosition: 'below-icon',
        tabBarIcon: ({ color, size, focused }) => (
          <MainTabIcon name={route.name} color={color} size={size} focused={focused} />
        ),
        tabBarActiveTintColor: '#5B5FEF',
        tabBarInactiveTintColor: '#8791A2',
        tabBarLabelStyle: {
          fontSize: 12,
          lineHeight: 18,
          fontWeight: '600',
          includeFontPadding: false,
        },
        tabBarStyle: {
          height: contentHeight + bottomPadding,
          paddingTop: 6,
          paddingBottom: bottomPadding,
          borderTopColor: '#E9ECF2',
          backgroundColor: '#FFFFFF',
        },
      })}
    >
      <Tab.Screen
        component={MaterialsNavigator}
        name="Materials"
        options={{ tabBarLabel: '자료', tabBarAccessibilityLabel: '자료 목록' }}
      />
      <Tab.Screen
        component={RecordsTabScreen}
        name="Records"
        options={{ tabBarLabel: '학습 기록', tabBarAccessibilityLabel: '학습 기록' }}
      />
      <Tab.Screen
        component={AccountNavigator}
        name="Account"
        options={{ tabBarLabel: '내 정보', tabBarAccessibilityLabel: '내 정보' }}
      />
    </Tab.Navigator>
  );
}
