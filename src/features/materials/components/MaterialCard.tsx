import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { LearningMaterial } from '../../../types';
import { resolveMaterialImageUri } from '../utils/imageUri';
import { MaterialThumbnail } from './MaterialImageGrid';

interface MaterialCardProps {
  material: LearningMaterial;
  onPress: () => void;
}

export function MaterialCard({ material, onPress }: MaterialCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${material.subject}, ${material.title}, 자료 상세 보기`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.textContent}>
        <Text style={styles.subject} numberOfLines={1}>{material.subject}</Text>
        <Text style={styles.title} numberOfLines={2}>{material.title}</Text>
        <Text style={styles.preview} numberOfLines={2}>
          {material.content.trim() || '이미지로 등록한 필기 자료입니다.'}
        </Text>
        <View style={styles.meta}>
          <Text style={styles.metaLabel}>{material.isPublic ? '공개 자료' : '비공개 자료'}</Text>
          {material.imagePaths.length ? (
            <Text style={styles.metaLabel}>이미지 {material.imagePaths.length}장</Text>
          ) : null}
        </View>
      </View>
      {material.imagePaths[0] ? (
        <View style={styles.thumbnail}>
          <MaterialThumbnail
            key={material.imagePaths[0]}
            uri={resolveMaterialImageUri(material.imagePaths[0])}
          />
        </View>
      ) : (
        <View style={styles.mark}><Text style={styles.markLabel}>≡</Text></View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: 20, backgroundColor: '#FFFFFF', borderRadius: 20, flexDirection: 'row', gap: 14, borderWidth: 1, borderColor: '#EDF0F5' },
  pressed: { opacity: 0.8 },
  textContent: { flex: 1, gap: 8 },
  subject: { color: '#5B5FEF', fontSize: 12, fontWeight: '700' },
  title: { color: '#172033', fontSize: 17, fontWeight: '700', lineHeight: 24 },
  preview: { color: '#758094', fontSize: 13, lineHeight: 20 },
  meta: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: 2 },
  metaLabel: { color: '#8A94A5', fontSize: 11 },
  thumbnail: { width: 76, height: 94, borderRadius: 12, overflow: 'hidden' },
  mark: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#F0F1FF', alignItems: 'center', justifyContent: 'center' },
  markLabel: { color: '#5B5FEF', fontSize: 27 },
});
