import type { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  Materials: NavigatorScreenParams<MaterialsStackParamList> | undefined;
  Records: undefined;
  Account: NavigatorScreenParams<AccountStackParamList> | undefined;
};

export type AccountStackParamList = { AccountHome: undefined; DeleteAccount: undefined };

export type MaterialsStackParamList = {
  MaterialsList: { notice?: string } | undefined;
  MaterialCreate: undefined;
  MaterialDetail: { materialId: string; notice?: string; cleanupPending?: boolean };
  MaterialEdit: { materialId: string };
  QuestionGenerate: { materialId: string };
  QuizSolve: { materialId: string; setId: string; sessionId: string };
  QuizResult: { materialId: string; setId: string; sessionId: string };
};

export type RootStackParamList = {
  SignIn: undefined;
  VerifyCode: { email: string };
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
};
