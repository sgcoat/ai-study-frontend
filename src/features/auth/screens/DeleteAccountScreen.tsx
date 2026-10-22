import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { AppScreen } from '../../../components/AppScreen';
import { FormField } from '../../../components/FormField';
import { PrimaryButton } from '../../../components/PrimaryButton';
import { API_MODE } from '../../../api/transport';
import { requestAccountDeletionCode } from '../api/authApi';
import { codeTiming, useCodeTimer, type CodeTiming } from '../hooks/useCodeTimer';
import { getAuthActionErrorMessage, useAuthStore } from '../store/authStore';

export function DeleteAccountScreen() {
  const user = useAuthStore((state) => state.user);
  const deleteAccount = useAuthStore((state) => state.deleteAccount);
  const [code, setCode] = useState('');
  const [timing, setTiming] = useState<CodeTiming | null>(null);
  const [delivery, setDelivery] = useState<'console' | 'email'>('email');
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { expiresIn, resendIn } = useCodeTimer(timing);

  const sendCode = async () => {
    if (sending || deleting || resendIn > 0) return;
    setSending(true); setError(null);
    try {
      const result = await requestAccountDeletionCode();
      setTiming(codeTiming(result.expiresInSeconds, result.resendAfterSeconds));
      setDelivery(result.deliveryMode ?? 'email'); setCode('');
    } catch (failure) { setError(getAuthActionErrorMessage(failure)); }
    finally { setSending(false); }
  };
  const submit = async () => {
    if (sending || deleting || expiresIn === 0 || !/^\d{6}$/.test(code)) return;
    setDeleting(true); setError(null);
    try { await deleteAccount(code); }
    catch (failure) { setError(getAuthActionErrorMessage(failure)); }
    finally { setDeleting(false); }
  };
  const confirm = () => {
    Alert.alert('계정을 영구 삭제할까요?', '자료, 이미지, 요약, 문제와 학습 기록이 삭제되고 모든 기기에서 로그아웃됩니다. 삭제한 데이터는 복구할 수 없습니다.', [
      { text: '취소', style: 'cancel' },
      { text: '영구 삭제', style: 'destructive', onPress: () => void submit() },
    ]);
  };
  return (
    <AppScreen scrollable edges={['bottom', 'left', 'right']}>
      <View style={styles.content}>
        <Text style={styles.title}>계정 삭제</Text>
        <Text style={styles.description}>등록된 이메일로 삭제 인증 코드를 받아 본인 확인을 진행합니다.</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={styles.warning}>
          <Text style={styles.warningTitle}>삭제되는 데이터</Text>
          <Text style={styles.description}>계정과 로그인 세션, 학습 자료와 이미지, 요약, 문제, 풀이 기록 및 이 기기에 저장된 학습 데이터가 삭제됩니다.</Text>
          <Text style={styles.description}>진행 중인 생성 작업도 취소됩니다. 삭제 후 같은 이메일로 로그인하면 새 계정이 만들어집니다.</Text>
        </View>
        <PrimaryButton title={resendIn > 0 ? `${resendIn}초 후 다시 받기` : timing ? '삭제 인증 코드 다시 받기' : '삭제 인증 코드 받기'}
          variant="secondary" loading={sending} disabled={deleting || resendIn > 0} onPress={() => void sendCode()} />
        {timing ? <>
          <Text style={styles.description}>{delivery === 'console' ? '개발 서버 터미널의 계정 삭제 코드를 입력하세요.' : '이메일로 받은 계정 삭제 코드를 입력하세요. 로그인 코드는 사용할 수 없습니다.'}</Text>
          <FormField label="삭제 인증 코드" keyboardType="number-pad" maxLength={6} autoComplete="one-time-code"
            textContentType="oneTimeCode" value={code} editable={!deleting && !sending}
            onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))} placeholder="6자리 숫자" />
          <Text style={styles.description}>{expiresIn > 0 ? `남은 시간 ${Math.floor(expiresIn / 60)}:${String(expiresIn % 60).padStart(2, '0')}` : '코드가 만료되었습니다. 새 코드를 받아 주세요.'}</Text>
          {API_MODE === 'mock' ? <Text style={styles.description}>개발용 mock 삭제 코드: 123456</Text> : null}
          <PrimaryButton title="계정 영구 삭제" variant="danger" loading={deleting}
            disabled={sending || expiresIn === 0 || !/^\d{6}$/.test(code)} onPress={confirm} />
        </> : null}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      </View>
    </AppScreen>
  );
}
const styles = StyleSheet.create({
  content: { paddingVertical: 12, gap: 18 },
  title: { color: '#172033', fontSize: 28, fontWeight: '800' },
  email: { color: '#343D50', fontSize: 16, fontWeight: '700' },
  description: { color: '#697488', fontSize: 14, lineHeight: 23 },
  warning: { padding: 18, borderRadius: 18, backgroundColor: '#FFF4F4', gap: 12 },
  warningTitle: { color: '#A72F40', fontSize: 16, fontWeight: '700' },
  error: { color: '#C33F4D', fontSize: 14, lineHeight: 22 },
});
