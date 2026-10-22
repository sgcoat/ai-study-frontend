import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { API_MODE } from '../../../api/transport';
import { AppScreen } from '../../../components/AppScreen';
import { FormField } from '../../../components/FormField';
import { PrimaryButton } from '../../../components/PrimaryButton';
import type { RootStackParamList } from '../../../navigation/types';
import { getAuthActionErrorMessage, useAuthStore } from '../store/authStore';
import { useCodeTimer } from '../hooks/useCodeTimer';

type Props = NativeStackScreenProps<RootStackParamList, 'VerifyCode'>;

export function VerifyCodeScreen({ navigation, route }: Props) {
  const verifyCode = useAuthStore((state) => state.verifyCode);
  const requestCode = useAuthStore((state) => state.requestCode);
  const codeDelivery = useAuthStore((state) => state.codeDelivery);
  const timing = useAuthStore((state) => state.codeTiming);
  const { expiresIn, resendIn } = useCodeTimer(timing);
  const [code, setCode] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const handleVerify = async () => {
    if (isVerifying || isResending || (timing !== null && expiresIn === 0)) return;
    if (!/^\d{6}$/.test(code)) {
      setErrorMessage('인증 코드 6자리를 입력해 주세요.');
      return;
    }

    setErrorMessage(null);
    setIsVerifying(true);
    try {
      await verifyCode(route.params.email, code);
    } catch (error) {
      setErrorMessage(getAuthActionErrorMessage(error));
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (resendIn || isResending || isVerifying) return;
    setErrorMessage(null);
    setIsResending(true);
    try {
      await requestCode(route.params.email);
      setCode('');
    } catch (error) {
      setErrorMessage(getAuthActionErrorMessage(error));
    } finally {
      setIsResending(false);
    }
  };

  return (
    <AppScreen scrollable>
      <View style={styles.content}>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Text style={styles.backLabel}>‹  이메일 변경</Text>
        </Pressable>

        <Text style={styles.eyebrow}>EMAIL VERIFICATION</Text>
        <Text style={styles.title}>인증 코드를{ '\n' }입력해 주세요</Text>
        <Text style={styles.description}>
          <Text style={styles.email}>{route.params.email}</Text>
          {'\n'}{codeDelivery === 'console' ? '개발 서버 터미널에 표시된 6자리 코드를 입력해 주세요.' : '이메일로 전송한 6자리 코드를 입력해 주세요.'}
          {codeDelivery === 'email' && API_MODE === 'http' ? '\n메일이 보이지 않으면 스팸함도 확인해 주세요.' : null}
        </Text>

        <View style={styles.form}>
          <FormField
            autoComplete="one-time-code"
            autoFocus
            error={errorMessage}
            keyboardType="number-pad"
            label="인증 코드"
            maxLength={6}
            onChangeText={(value) => {
              setCode(value.replace(/\D/g, '').slice(0, 6));
              if (errorMessage) setErrorMessage(null);
            }}
            onSubmitEditing={() => void handleVerify()}
            placeholder="6자리 숫자"
            textContentType="oneTimeCode"
            value={code}
          />
          {API_MODE === 'mock' ? (
            <Text style={styles.mockHint}>개발용 mock 코드: 123456</Text>
          ) : null}
          <PrimaryButton
            loading={isVerifying}
            disabled={isResending || (timing !== null && expiresIn === 0)}
            onPress={() => void handleVerify()}
            title="확인하고 계속하기"
          />
          <Pressable
            accessibilityRole="button"
            disabled={isResending || isVerifying || resendIn > 0}
            onPress={() => void handleResend()}
            style={styles.resendButton}
          >
            <Text style={styles.resendText}>
              {isResending ? '코드 전송 중…' : resendIn > 0 ? `${resendIn}초 후 다시 받기` : '인증 코드 다시 받기'}
            </Text>
          </Pressable>
          <Text style={styles.mockHint}>
            {timing && expiresIn > 0 ? `남은 시간 ${Math.floor(expiresIn / 60)}:${String(expiresIn % 60).padStart(2, '0')}` : '코드가 만료되었습니다. 새 코드를 받아 주세요.'}
          </Text>
        </View>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 28,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 36,
    paddingVertical: 8,
  },
  backLabel: {
    color: '#5B5FEF',
    fontSize: 15,
    fontWeight: '600',
  },
  eyebrow: {
    color: '#5B5FEF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  title: {
    color: '#172033',
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 40,
  },
  description: {
    color: '#697488',
    fontSize: 15,
    lineHeight: 24,
    marginTop: 14,
  },
  email: {
    color: '#343D50',
    fontWeight: '700',
  },
  form: {
    gap: 18,
    marginTop: 36,
  },
  mockHint: {
    color: '#717B8F',
    fontSize: 13,
    marginTop: -8,
  },
  resendButton: {
    alignSelf: 'center',
    padding: 10,
  },
  resendText: {
    color: '#5B5FEF',
    fontSize: 14,
    fontWeight: '600',
  },
});
