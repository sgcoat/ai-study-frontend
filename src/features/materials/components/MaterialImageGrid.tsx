import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export interface MaterialImageItem {
  id: string;
  uri: string;
}

interface MaterialImageGridProps {
  images: MaterialImageItem[];
  onRemove?: (id: string) => void;
  disabled?: boolean;
  onRefresh?: () => void;
}

export function MaterialThumbnail({
  uri,
  resizeMode = 'cover',
  onRefresh,
}: {
  uri: string;
  resizeMode?: 'cover' | 'contain';
  onRefresh?: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);

  if (failed) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="이미지 불러오기 다시 시도"
        onPress={() => {
          onRefresh?.();
          setLoading(true);
          setFailed(false);
          setRetry((value) => value + 1);
        }}
        style={styles.imageFallback}
      >
        <Text style={styles.fallbackLabel}>불러오기 실패</Text>
        <Text style={styles.retryLabel}>다시 시도</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.imageContainer}>
      <Image
        key={`${uri}-${retry}`}
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        resizeMode={resizeMode}
        onError={() => { setFailed(true); setLoading(false); }}
        onLoadEnd={() => setLoading(false)}
      />
      {loading ? <ActivityIndicator color="#5B5FEF" /> : null}
    </View>
  );
}

export function MaterialImageGrid({ images, onRemove, disabled, onRefresh }: MaterialImageGridProps) {
  const [selected, setSelected] = useState<MaterialImageItem | null>(null);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const previewHeight = Math.max(200, height - insets.top - insets.bottom - 64);
  const selectedId = selected?.id;
  useEffect(() => {
    if (selectedId) setSelected(images.find((image) => image.id === selectedId) ?? null);
  }, [images, selectedId]);

  if (!images.length) return null;
  return (
    <>
      <View style={styles.grid}>
        {images.map((image, index) => (
          <View key={image.id} style={styles.gridItem}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`필기 이미지 ${index + 1} 크게 보기`}
              onPress={() => setSelected(image)}
              style={styles.thumbnail}
            >
              <MaterialThumbnail key={image.uri} uri={image.uri} onRefresh={onRefresh} />
              <View style={styles.numberBadge}>
                <Text style={styles.numberLabel}>{index + 1}</Text>
              </View>
            </Pressable>
            {onRemove ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`필기 이미지 ${index + 1} 삭제`}
                disabled={disabled}
                hitSlop={8}
                onPress={() => onRemove(image.id)}
                style={styles.removeButton}
              >
                <Text style={styles.removeLabel}>×</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
      </View>
      <Modal
        visible={selected !== null}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => setSelected(null)}
      >
        <SafeAreaProvider style={styles.previewScreen}>
          <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={styles.previewScreen}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewTitle}>필기 이미지</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="이미지 닫기"
                onPress={() => setSelected(null)}
                hitSlop={12}
                style={styles.closeButton}
              >
                <Text style={styles.closeLabel}>닫기</Text>
              </Pressable>
            </View>
            <ScrollView
              maximumZoomScale={4}
              minimumZoomScale={1}
              centerContent
              style={styles.previewScroll}
            >
              {selected ? (
                <View style={{ width, height: previewHeight }}>
                  <MaterialThumbnail key={selected.uri} uri={selected.uri} resizeMode="contain" onRefresh={onRefresh} />
                </View>
              ) : null}
            </ScrollView>
          </SafeAreaView>
        </SafeAreaProvider>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridItem: { width: '47.5%' },
  thumbnail: { aspectRatio: 1, borderRadius: 14, overflow: 'hidden' },
  imageContainer: { flex: 1, backgroundColor: '#E9ECF3', alignItems: 'center', justifyContent: 'center' },
  imageFallback: { flex: 1, backgroundColor: '#ECEEFF', alignItems: 'center', justifyContent: 'center', gap: 4 },
  fallbackLabel: { color: '#697488', fontSize: 11 },
  retryLabel: { color: '#5B5FEF', fontSize: 12, fontWeight: '700' },
  numberBadge: { position: 'absolute', bottom: 8, left: 8, backgroundColor: '#172033B3', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  numberLabel: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  removeButton: { position: 'absolute', right: -5, top: -5, width: 28, height: 28, borderRadius: 14, backgroundColor: '#172033', alignItems: 'center', justifyContent: 'center' },
  removeLabel: { color: '#FFFFFF', fontSize: 22, lineHeight: 24 },
  previewScreen: { flex: 1, backgroundColor: '#111827' },
  previewHeader: { height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24 },
  previewTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  closeButton: { minWidth: 64, minHeight: 48, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
    backgroundColor: '#263244', alignItems: 'center', justifyContent: 'center' },
  closeLabel: { color: '#C8CDFF', fontSize: 15, fontWeight: '700' },
  previewScroll: { flex: 1 },
});
