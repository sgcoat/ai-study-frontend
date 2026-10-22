import { useEffect, useMemo, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useIsFocused } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { toApiError } from '../../../api/apiError';
import { PrimaryButton } from '../../../components/PrimaryButton';
import { EmptyState, ErrorState, LoadingState } from '../../../components/ResourceState';
import type { MaterialsStackParamList } from '../../../navigation/types';
import { MaterialCard } from '../components/MaterialCard';
import { useMaterialsQuery } from '../hooks/useMaterials';
import { useAuthStore } from '../../auth/store/authStore';
import { retryPendingMaterialCleanups } from '../services/materialCleanup';
import { useMaterialDraftStore } from '../store/materialDraftStore';
import { discardMaterialDraft } from '../services/materialDraftStorage';

type Props = NativeStackScreenProps<MaterialsStackParamList, 'MaterialsList'>;

export function MaterialsListScreen({ navigation, route }: Props) {
  const owner = useAuthStore((state) => state.user?.id) ?? '';
  const focused = useIsFocused();
  const draft = useMaterialDraftStore((state) => state.summaries[owner]);
  const draftError = useMaterialDraftStore((state) => state.errors[owner]);
  const [cleanupWarning, setCleanupWarning] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [subject, setSubject] = useState<string | undefined>();
  const [knownSubjects, setKnownSubjects] = useState<string[]>([]);
  useEffect(() => {
    if (owner && focused) {
      setCleanupWarning(retryPendingMaterialCleanups(owner));
      useMaterialDraftStore.getState().refresh(owner);
    }
  }, [owner, focused]);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const filters = useMemo(() => ({ query: debouncedSearch || undefined, subject }), [debouncedSearch, subject]);
  const query = useMaterialsQuery(filters);
  useEffect(() => {
    if (!query.data) return;
    const received = query.data.pages.flatMap((page) => page.subjects);
    setKnownSubjects([...new Set(received)].sort());
  }, [query.data]);
  const materials = query.data?.pages.flatMap((page) => page.items) ?? [];
  const subjects = [...new Set([
    ...knownSubjects,
    ...(query.data?.pages.flatMap((page) => page.subjects) ?? []),
    ...(subject ? [subject] : []),
  ])].sort();
  const totalItems = query.data?.pages[0]?.pageInfo.totalItems ?? 0;
  const hasFilters = Boolean(debouncedSearch || subject);
  const goToCreate = () => navigation.navigate('MaterialCreate');
  const discardDraft = () => {
    if (!draft) return;
    Alert.alert('임시 저장본을 삭제할까요?', draft.submission === 'editing'
      ? '작성 중인 내용과 임시 저장한 사진을 지웁니다.'
      : '임시 저장한 내용과 사진을 지웁니다. 이미 등록된 자료가 있다면 자료 목록에 남아 있어요.', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => {
        if (useAuthStore.getState().user?.id !== owner) return;
        try { discardMaterialDraft(owner, draft.id); useMaterialDraftStore.getState().publish(owner, null); }
        catch (error) { Alert.alert('임시 저장본을 삭제하지 못했어요', error instanceof Error ? error.message : '다시 시도해 주세요.'); }
      } },
    ]);
  };

  const resetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setSubject(undefined);
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headingRow}>
          <View>
            <Text style={styles.eyebrow}>MY MATERIALS</Text>
            <Text style={styles.title}>내 자료</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={goToCreate}
            style={({ pressed }) => [styles.createButton, pressed && styles.pressed]}
          >
            <Text style={styles.createLabel}>+ 자료 등록</Text>
          </Pressable>
        </View>
        <TextInput
          accessibilityLabel="자료 검색"
          placeholder="제목, 과목, 내용으로 검색"
          placeholderTextColor="#9AA3B2"
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          spellCheck={false}
          clearButtonMode="while-editing"
          style={styles.search}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.subjects}
          keyboardShouldPersistTaps="handled"
        >
          {[undefined, ...subjects].map((value) => (
            <Pressable
              key={value ?? 'all-subjects'}
              accessibilityRole="button"
              accessibilityState={{ selected: subject === value }}
              onPress={() => setSubject(value)}
              style={[styles.chip, subject === value && styles.selectedChip]}
            >
              <Text style={[styles.chipLabel, subject === value && styles.selectedChipLabel]}>
                {value ?? '전체'}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <Text style={styles.count}>{hasFilters ? '검색 결과' : '저장한 자료'} {totalItems}개</Text>
        {draft ? <View style={styles.draftCard}>
          <View style={styles.draftText}>
            <Text style={styles.draftHeading}>{draft.submission === 'editing' ? '작성 중인 자료가 있어요' : '등록 결과 확인이 남아 있어요'}</Text>
            <Text numberOfLines={1} style={styles.noticeText}>{draft.title.trim() || '제목 없는 자료'}{draft.imageCount ? ` · 사진 ${draft.imageCount}장` : ''}</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={goToCreate} style={styles.draftAction}><Text style={styles.retryText}>{draft.submission === 'editing' ? '이어쓰기' : '확인하기'}</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="임시 저장본 삭제" onPress={discardDraft} style={styles.draftAction}><Text style={styles.errorText}>삭제</Text></Pressable>
        </View> : null}
        {draftError ? <View style={styles.refreshError}>
          <Text accessibilityRole="alert" style={styles.errorText}>{draftError}</Text>
          <Pressable accessibilityRole="button" onPress={goToCreate}><Text style={styles.retryText}>임시 저장본 확인</Text></Pressable>
        </View> : null}
        {route.params?.notice ? <View style={styles.notice}>
          <Text accessibilityLiveRegion="polite" style={styles.noticeText}>{route.params.notice}</Text>
          <Pressable accessibilityRole="button" onPress={() => navigation.setParams({ notice: undefined })}><Text style={styles.retryText}>닫기</Text></Pressable>
        </View> : null}
        {cleanupWarning ? <View style={styles.refreshError}>
          <Text accessibilityRole="alert" style={styles.errorText}>{cleanupWarning}</Text>
          <Pressable accessibilityRole="button" onPress={() => setCleanupWarning(retryPendingMaterialCleanups(owner))}><Text style={styles.retryText}>기기 정보 다시 정리</Text></Pressable>
        </View> : null}
      </View>

      {query.isPending ? (
        <LoadingState />
      ) : query.isError && !query.data ? (
        <ErrorState
          title="자료를 불러오지 못했어요"
          description={toApiError(query.error).message}
          onAction={() => void query.refetch()}
        />
      ) : (
        <FlatList
          data={materials}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MaterialCard
              material={item}
              onPress={() => navigation.navigate('MaterialDetail', { materialId: item.id })}
            />
          )}
          contentContainerStyle={[styles.list, !materials.length && styles.emptyList]}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshing={query.isRefetching}
          onRefresh={() => void query.refetch()}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetching && !query.isFetchNextPageError) {
              void query.fetchNextPage();
            }
          }}
          ListHeaderComponent={query.isRefetchError ? (
            <View style={styles.refreshError}>
              <Text style={styles.errorText}>{toApiError(query.error).message}</Text>
              <Pressable onPress={() => void query.refetch()} accessibilityRole="button">
                <Text style={styles.retryText}>다시 불러오기</Text>
              </Pressable>
            </View>
          ) : null}
          ListEmptyComponent={hasFilters ? (
            <EmptyState
              title="검색 결과가 없어요"
              description="다른 검색어나 과목으로 찾아보세요."
              actionLabel="검색 조건 초기화"
              onAction={resetFilters}
            />
          ) : (
            <EmptyState
              title="첫 자료를 등록해 보세요"
              description="필기를 입력하거나 사진을 첨부해 복습을 시작할 수 있어요."
              actionLabel="자료 등록"
              onAction={goToCreate}
            />
          )}
          ListFooterComponent={query.isFetchingNextPage ? (
            <ActivityIndicator color="#5B5FEF" style={styles.footer} />
          ) : query.isFetchNextPageError ? (
            <View style={styles.footer}>
              <Text style={styles.errorText}>다음 자료를 불러오지 못했어요.</Text>
              <PrimaryButton
                title="다시 시도"
                variant="secondary"
                onPress={() => void query.fetchNextPage()}
              />
            </View>
          ) : null}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F8FC' },
  header: { paddingHorizontal: 24, paddingTop: 20, gap: 16, paddingBottom: 14 },
  headingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  eyebrow: { color: '#5B5FEF', fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 6 },
  title: { color: '#172033', fontSize: 30, fontWeight: '800' },
  createButton: { backgroundColor: '#5B5FEF', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  createLabel: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.8 },
  search: { minHeight: 52, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E1E5ED', borderRadius: 14, paddingHorizontal: 16, fontSize: 15, color: '#172033' },
  subjects: { gap: 8, paddingVertical: 2 },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E1E5ED' },
  selectedChip: { backgroundColor: '#ECEEFF', borderColor: '#B9BCFF' },
  chipLabel: { color: '#758094', fontSize: 13, fontWeight: '600' },
  selectedChipLabel: { color: '#4F53D4' },
  count: { color: '#8992A2', fontSize: 12 },
  list: { paddingHorizontal: 24, paddingBottom: 24 },
  emptyList: { flexGrow: 1 },
  separator: { height: 12 },
  footer: { paddingVertical: 20, gap: 12 },
  refreshError: { backgroundColor: '#FFF0F1', padding: 14, borderRadius: 12, gap: 8, marginBottom: 12 },
  errorText: { color: '#C33F4D', fontSize: 13, lineHeight: 20 },
  retryText: { color: '#5B5FEF', fontSize: 13, fontWeight: '700' },
  notice: { padding: 14, borderRadius: 12, backgroundColor: '#ECEEFF', gap: 8 },
  noticeText: { color: '#4F53D4', fontSize: 13, lineHeight: 20 },
  draftCard: { padding: 14, borderRadius: 12, backgroundColor: '#ECEEFF', flexDirection: 'row', gap: 10, alignItems: 'center' },
  draftText: { flex: 1, gap: 4 }, draftHeading: { color: '#343D50', fontSize: 13, fontWeight: '700' }, draftAction: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 3 },
});
