import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { MaterialCreateScreen } from '../features/materials/screens/MaterialCreateScreen';
import { MaterialDetailScreen } from '../features/materials/screens/MaterialDetailScreen';
import { MaterialEditScreen } from '../features/materials/screens/MaterialEditScreen';
import { MaterialsListScreen } from '../features/materials/screens/MaterialsListScreen';
import { QuestionGenerateScreen } from '../features/questions/screens/QuestionGenerateScreen';
import { QuizSolveScreen } from '../features/questions/screens/QuizSolveScreen';
import { QuizResultScreen } from '../features/questions/screens/QuizResultScreen';
import type { MaterialsStackParamList } from './types';

const Stack = createNativeStackNavigator<MaterialsStackParamList>();

export function MaterialsNavigator() {
  return (
    <Stack.Navigator screenOptions={{
      contentStyle: { backgroundColor: '#F7F8FC' },
      headerStyle: { backgroundColor: '#F7F8FC' },
      headerTintColor: '#172033',
      headerShadowVisible: false,
    }}>
      <Stack.Screen name="MaterialsList" component={MaterialsListScreen} options={{ title: '자료 목록', headerShown: false }} />
      <Stack.Screen name="MaterialCreate" component={MaterialCreateScreen} options={{ title: '자료 등록', gestureEnabled: false }} />
      <Stack.Screen name="MaterialDetail" component={MaterialDetailScreen} options={{ title: '자료 상세' }} />
      <Stack.Screen name="MaterialEdit" component={MaterialEditScreen} options={{ title: '자료 수정', gestureEnabled: false }} />
      <Stack.Screen name="QuestionGenerate" component={QuestionGenerateScreen} options={{ title: '문제 생성' }} />
      <Stack.Screen name="QuizSolve" component={QuizSolveScreen} options={{ title: '문제 풀이' }} />
      <Stack.Screen name="QuizResult" component={QuizResultScreen} options={{ title: '풀이 결과' }} />
    </Stack.Navigator>
  );
}
