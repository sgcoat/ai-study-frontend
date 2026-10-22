import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
}

export function PrimaryButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
}: PrimaryButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' ? styles.secondary : variant === 'danger' ? styles.danger : styles.primary,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? '#5558D9' : '#FFFFFF'} />
      ) : (
        <Text
          style={[
            styles.label,
            variant === 'secondary' ? styles.secondaryLabel : styles.primaryLabel,
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  primary: {
    backgroundColor: '#5B5FEF',
  },
  secondary: {
    backgroundColor: '#ECEEFF',
  },
  danger: { backgroundColor: '#B53247' },
  pressed: {
    opacity: 0.86,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    flexShrink: 1,
  },
  primaryLabel: {
    color: '#FFFFFF',
  },
  secondaryLabel: {
    color: '#4F53D4',
  },
});
