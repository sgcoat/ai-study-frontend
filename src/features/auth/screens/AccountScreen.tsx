import { useEffect, useRef, useState } from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppScreen } from '../../../components/AppScreen';
import { PrimaryButton } from '../../../components/PrimaryButton';
import type { AccountStackParamList } from '../../../navigation/types';
import { getAuthActionErrorMessage, useAuthStore } from '../store/authStore';
import { canCheckSessionExpiry, checkSessionExpiry } from '../services/sessionExpiryCheck';

const privacyUrl = process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL?.trim();
type Props = NativeStackScreenProps<AccountStackParamList, 'AccountHome'>;

export function AccountScreen({ navigation }: Props) {
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const operation = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const handleSignOut = async () => {
    if (operation.current) return;
    operation.current = true;
    setBusy(true); setError(null);
    try { await signOut(); }
    catch (failure) { if (mounted.current) setError(getAuthActionErrorMessage(failure)); }
    finally { operation.current = false; if (mounted.current) setBusy(false); }
  };
  const handleExpiryCheck = async () => {
    if (operation.current) return;
    operation.current = true; setBusy(true); setError(null);
    try { await checkSessionExpiry(); }
    catch (failure) { if (mounted.current) setError(getAuthActionErrorMessage(failure)); }
    finally { operation.current = false; if (mounted.current) setBusy(false); }
  };
  return (
    <AppScreen scrollable>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>ACCOUNT</Text>
        <Text style={styles.title}>내 정보</Text>
        <View style={styles.card}>
          <Text style={styles.label}>로그인 이메일</Text>
          <Text style={styles.email}>{user?.email ?? '-'}</Text>
        </View>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <PrimaryButton title="로그아웃" variant="secondary" loading={busy} onPress={() => void handleSignOut()} />
        {privacyUrl ? <PrimaryButton title="개인정보 처리방침" variant="secondary" disabled={busy}
          onPress={() => { void Linking.openURL(privacyUrl).catch(() => setError('개인정보 처리방침을 열지 못했습니다. 다시 시도해 주세요.')); }} /> : null}
        {canCheckSessionExpiry() ? <View style={styles.card}>
          <Text style={styles.label}>개발용 점검</Text>
          <Text style={styles.description}>현재 기기의 로그인을 만료시켜 다시 로그인하는 흐름을 확인합니다. 작성 중인 자료는 기기에 보관합니다.</Text>
          <PrimaryButton title="로그인 만료 점검" variant="secondary" disabled={busy} onPress={() => {
            Alert.alert('로그인 만료를 점검할까요?', '현재 기기의 로그인을 종료한 뒤 만료 안내를 확인합니다. 같은 이메일로 다시 로그인해 주세요.', [
              { text: '취소', style: 'cancel' }, { text: '점검 시작', onPress: () => { void handleExpiryCheck(); } },
            ]);
          }} />
        </View> : null}
        <View style={styles.deleteCard}>
          <Text style={styles.deleteTitle}>계정 삭제</Text>
          <Text style={styles.description}>등록한 자료, 이미지, 요약, 문제와 학습 기록을 삭제합니다. 삭제한 데이터는 복구할 수 없습니다.</Text>
          <PrimaryButton title="계정 삭제하기" variant="danger" disabled={busy} onPress={() => navigation.navigate('DeleteAccount')} />
        </View>
      </View>
    </AppScreen>
  );
}
const styles = StyleSheet.create({
  content: { paddingTop: 20, gap: 18 },
  eyebrow: { color: '#5B5FEF', fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  title: { color: '#172033', fontSize: 30, fontWeight: '800' },
  card: { backgroundColor: '#FFF', borderRadius: 18, padding: 20, gap: 8 },
  label: { color: '#8992A2', fontSize: 13 },
  email: { color: '#263146', fontSize: 16, fontWeight: '600' },
  deleteCard: { marginTop: 20, padding: 20, borderRadius: 18, gap: 14, backgroundColor: '#FFF4F4' },
  deleteTitle: { color: '#A72F40', fontSize: 18, fontWeight: '700' },
  description: { color: '#697488', fontSize: 14, lineHeight: 22 },
  error: { color: '#C33F4D', fontSize: 14 },
});
