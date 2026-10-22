import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { toApiError } from '../../../api/apiError';
import { API_MODE } from '../../../api/transport';
import { PrimaryButton } from '../../../components/PrimaryButton';
import { useMaterialSummary } from '../hooks/useMaterialSummary';
import { SummaryContent } from './SummaryContent';

export function SummaryPanel({ materialId }: { materialId: string }) {
  const state = useMaterialSummary(materialId);
  const { summary, snapshot, job, session, mutation } = state;

  let content;
  if (summary) {
    content = <SummaryContent summary={summary} />;
  } else if (state.restoreError) {
    content = (
      <PanelMessage
        title="요약 작업을 복원하지 못했어요"
        description={state.restoreError}
        action="다시 확인"
        onAction={state.restoreSession}
      />
    );
  } else if (mutation.isPending) {
    content = <PendingMessage title="요약 요청을 확인하고 있어요" description="저장된 요약과 진행 중인 작업을 먼저 확인합니다." />;
  } else if (mutation.isError) {
    content = (
      <PanelMessage
        title="요약 요청을 완료하지 못했어요"
        description={toApiError(mutation.error).message}
        action={session?.jobId ? '상태 다시 확인' : '요청 다시 확인'}
        loading={state.refreshing}
        onAction={session?.jobId ? () => void state.refreshStatus() : () => void state.generate()}
      />
    );
  } else if (job.isError && session?.jobId) {
    content = (
      <PanelMessage
        title="진행 상태를 확인하지 못했어요"
        description={`${toApiError(job.error).message}\n기존 작업의 상태를 다시 확인할 수 있어요.`}
        action="상태 다시 확인"
        loading={state.refreshing}
        onAction={() => void state.refreshStatus()}
      />
    );
  } else if (job.data?.status === 'FAILED') {
    content = (
      <PanelMessage
        title="요약 생성에 실패했어요"
        description={job.data.error?.message ?? '다시 시도해 주세요.'}
        action="요약 다시 생성"
        onAction={() => void state.generate(true)}
      />
    );
  } else if (session?.jobId && state.monitoringPaused) {
    content = (
      <PanelMessage
        title="요약이 아직 처리 중이에요"
        description="처리 시간이 길어지고 있어요. 기존 작업의 상태를 다시 확인해 주세요."
        action="상태 다시 확인"
        loading={state.refreshing}
        onAction={() => void state.refreshStatus()}
      />
    );
  } else if (session?.jobId) {
    content = <PendingMessage
      title={job.data?.status === 'QUEUED' ? '요약 작업 대기 중' : '요약을 만들고 있어요'}
      description="다른 자료를 보고 돌아와도 작업 상태를 이어서 확인할 수 있어요."
    />;
  } else if (session?.requestKey) {
    content = (
      <PanelMessage
        title="이전 요청의 결과를 확인해 주세요"
        description="요약 요청의 응답을 확인하지 못했어요. 이전 요청을 이어서 확인할 수 있어요."
        action="요청 확인"
        onAction={() => void state.generate()}
      />
    );
  } else if (snapshot.isPending || session === undefined) {
    content = <PendingMessage title="저장된 요약을 확인하고 있어요" />;
  } else if (snapshot.isError) {
    content = (
      <PanelMessage
        title="저장된 요약을 불러오지 못했어요"
        description={toApiError(snapshot.error).message}
        action="다시 불러오기"
        loading={state.refreshing}
        onAction={() => void state.refreshStatus()}
      />
    );
  } else {
    content = (
      <View style={styles.message}>
        <Text style={styles.description}>필기에서 핵심 개념과 주요 용어를 정리해 복습해 보세요.</Text>
        <PrimaryButton title="요약 생성" onPress={() => void state.generate()} />
      </View>
    );
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>AI 학습 요약</Text>
      {API_MODE === 'mock' || summary?.modelInfo.startsWith('mock') ? <Text style={styles.mockLabel}>개발용 예시 · 실제 AI 호출 없음</Text> : null}
      {content}
    </View>
  );
}

function PendingMessage({ title, description }: { title: string; description?: string }) {
  return (
    <View style={styles.message} accessibilityLiveRegion="polite">
      <View style={styles.pendingRow}>
        <ActivityIndicator color="#5B5FEF" />
        <Text style={styles.messageTitle}>{title}</Text>
      </View>
      {description ? <Text style={styles.description}>{description}</Text> : null}
    </View>
  );
}

function PanelMessage({ title, description, action, loading, onAction }: {
  title: string;
  description: string;
  action: string;
  loading?: boolean;
  onAction: () => void;
}) {
  return (
    <View style={styles.message}>
      <Text accessibilityRole="alert" style={styles.messageTitle}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      <PrimaryButton title={action} onPress={onAction} loading={loading} variant="secondary" />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, gap: 18, borderWidth: 1, borderColor: '#E5E7FF' },
  heading: { color: '#263146', fontSize: 19, fontWeight: '800' },
  mockLabel: { color: '#8A6A30', fontSize: 11, lineHeight: 18, marginTop: -10 },
  message: { gap: 14 },
  pendingRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  messageTitle: { color: '#4F53D4', fontSize: 14, fontWeight: '700', flexShrink: 1 },
  description: { color: '#758094', fontSize: 13, lineHeight: 22 },
});
