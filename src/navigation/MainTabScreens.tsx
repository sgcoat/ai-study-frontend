import { StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '../components/AppScreen';

export function RecordsTabScreen() {
  return (
    <PlaceholderScreen
      eyebrow="STUDY RECORDS"
      title="학습 기록"
      description="문제 풀이 기록 화면은 이후 단계에서 연결합니다."
    />
  );
}

function PlaceholderScreen({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <AppScreen>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.placeholderCard}>
          <Text style={styles.placeholderMark}>✦</Text>
          <Text style={styles.description}>{description}</Text>
        </View>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingTop: 20,
    gap: 16,
  },
  eyebrow: {
    color: '#5B5FEF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  title: {
    color: '#172033',
    fontSize: 30,
    fontWeight: '800',
  },
  placeholderCard: {
    minHeight: 190,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    padding: 24,
    marginTop: 12,
  },
  placeholderMark: {
    color: '#5B5FEF',
    fontSize: 28,
  },
  description: {
    color: '#697488',
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
  },
});
