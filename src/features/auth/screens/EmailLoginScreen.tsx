import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppScreen } from '../../../components/AppScreen';
import { FormField } from '../../../components/FormField';
import { PrimaryButton } from '../../../components/PrimaryButton';
import { getAuthActionErrorMessage, useAuthStore } from '../store/authStore';
import type { RootStackParamList } from '../../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'SignIn'>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EmailLoginScreen({ navigation }: Props) {
  const requestCode = useAuthStore((state) => state.requestCode);
  const notice = useAuthStore((state) => state.notice);
  const [email, setEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRequestCode = async () => {
    if (isSubmitting) return;
    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setErrorMessage('올바른 이메일 주소를 입력해 주세요.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await requestCode(normalizedEmail);
      navigation.navigate('VerifyCode', { email: normalizedEmail });
    } catch (error) {
      setErrorMessage(getAuthActionErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}
    >
      <AppScreen scrollable>
        <View style={styles.content}>
          <View style={styles.brandMark}>
            <Text style={styles.brandMarkText}>S</Text>
          </View>
          <Text style={styles.eyebrow}>AI STUDY</Text>
          <Text style={styles.title}>공부한 내용을{ '\n' }더 오래 기억하도록</Text>
          <Text style={styles.description}>
            이메일로 받은 인증 코드로 간편하게 시작하세요.
          </Text>

          <View style={styles.form}>
            {notice ? <Text accessibilityRole="alert" style={styles.footnote}>{notice}</Text> : null}
            <FormField
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              error={errorMessage}
              keyboardType="email-address"
              label="이메일"
              onChangeText={(value) => {
                setEmail(value);
                if (errorMessage) setErrorMessage(null);
              }}
              onSubmitEditing={() => void handleRequestCode()}
              placeholder="name@example.com"
              returnKeyType="send"
              textContentType="emailAddress"
              value={email}
            />
            <PrimaryButton
              loading={isSubmitting}
              onPress={() => void handleRequestCode()}
              title="인증 코드 받기"
            />
            <Text style={styles.footnote}>
              비밀번호 없이 이메일 인증으로 로그인합니다.
            </Text>
          </View>
        </View>
      </AppScreen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 28,
  },
  brandMark: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: '#5B5FEF',
    marginBottom: 24,
  },
  brandMarkText: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '800',
  },
  eyebrow: {
    color: '#5B5FEF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 12,
  },
  title: {
    color: '#172033',
    fontSize: 31,
    fontWeight: '800',
    lineHeight: 41,
  },
  description: {
    color: '#697488',
    fontSize: 15,
    lineHeight: 23,
    marginTop: 12,
  },
  form: {
    gap: 18,
    marginTop: 38,
  },
  footnote: {
    color: '#8A93A3',
    fontSize: 13,
    textAlign: 'center',
    marginTop: -4,
  },
});
