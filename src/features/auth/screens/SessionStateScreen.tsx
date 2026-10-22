import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '../../../components/AppScreen';
import { PrimaryButton } from '../../../components/PrimaryButton';

interface SessionStateScreenProps {
  mode: 'loading' | 'error';
  message?: string | null;
  onRetry?: () => void;
  onSignOut?: () => void;
}

export function SessionStateScreen({
  mode,
  message,
  onRetry,
  onSignOut,
}: SessionStateScreenProps) {
  return (
    <AppScreen>
      <View style={styles.content}>
        {mode === 'loading' ? (
          <ActivityIndicator color="#5B5FEF" size="large" />
        ) : (
          <Text style={styles.errorMark}>!</Text>
        )}
        <Text style={styles.title}>
          {mode === 'loading' ? '로그인 상태를 확인하고 있어요' : '로그인 상태를 확인하지 못했어요'}
        </Text>
        {mode === 'error' ? (
          <>
            <Text style={styles.description}>
              {message || '네트워크 연결을 확인한 뒤 다시 시도해 주세요.'}
            </Text>
            <View style={styles.actions}>
              <PrimaryButton title="다시 시도" onPress={onRetry ?? (() => undefined)} />
              <PrimaryButton
                title="로그인 화면으로 이동"
                onPress={onSignOut ?? (() => undefined)}
                variant="secondary"
              />
            </View>
          </>
        ) : (
          <Text style={styles.description}>잠시만 기다려 주세요.</Text>
        )}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  errorMark: {
    width: 42,
    height: 42,
    overflow: 'hidden',
    borderRadius: 21,
    backgroundColor: '#FFF0F1',
    color: '#C33F4D',
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 42,
  },
  title: {
    color: '#172033',
    fontSize: 19,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
  },
  description: {
    color: '#697488',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  actions: {
    alignSelf: 'stretch',
    gap: 12,
    marginTop: 12,
  },
});
