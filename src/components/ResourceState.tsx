import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from './PrimaryButton';

interface ResourceStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: string;
}

export function LoadingState({ label = '자료를 불러오고 있어요.' }: { label?: string }) {
  return (
    <View style={styles.container}>
      <ActivityIndicator color="#5B5FEF" size="large" />
      <Text style={styles.description}>{label}</Text>
    </View>
  );
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon = '✦',
}: ResourceStateProps) {
  return (
    <ResourceState
      actionLabel={actionLabel}
      description={description}
      icon={icon}
      onAction={onAction}
      title={title}
    />
  );
}

export function ErrorState({
  title = '자료를 불러오지 못했어요',
  description = '네트워크 연결을 확인한 뒤 다시 시도해 주세요.',
  actionLabel = '다시 시도',
  onAction,
}: ResourceStateProps) {
  return (
    <ResourceState
      actionLabel={actionLabel}
      description={description}
      icon="!"
      onAction={onAction}
      title={title}
    />
  );
}

function ResourceState({
  title,
  description,
  actionLabel,
  onAction,
  icon = '✦',
}: ResourceStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {actionLabel && onAction ? (
        <View style={styles.action}>
          <PrimaryButton onPress={onAction} title={actionLabel} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  iconCircle: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: '#ECEEFF',
    marginBottom: 14,
  },
  icon: {
    color: '#5B5FEF',
    fontSize: 23,
    fontWeight: '700',
  },
  title: {
    color: '#263146',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  description: {
    color: '#758094',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 8,
  },
  action: {
    alignSelf: 'stretch',
    marginTop: 22,
  },
});
