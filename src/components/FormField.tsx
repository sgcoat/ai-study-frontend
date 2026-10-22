import { Keyboard, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

interface FormFieldProps extends TextInputProps {
  label: string;
  error?: string | null;
}

export function FormField({ label, error, style, multiline, autoCapitalize = 'none',
  autoCorrect = false, spellCheck = false, ...inputProps }: FormFieldProps) {
  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {multiline && inputProps.editable !== false ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`${label} 키보드 닫기`}
            onPress={Keyboard.dismiss} style={styles.dismissButton}>
            <Text style={styles.dismissLabel}>키보드 닫기</Text>
          </Pressable>
        ) : null}
      </View>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#9AA3B2"
        multiline={multiline}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        spellCheck={spellCheck}
        returnKeyType={multiline ? 'default' : 'done'}
        submitBehavior={multiline ? 'newline' : 'blurAndSubmit'}
        style={[styles.input, error ? styles.inputError : undefined, style]}
        {...inputProps}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
    minWidth: 0,
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  dismissButton: { minHeight: 44, minWidth: 44, paddingHorizontal: 8, justifyContent: 'center' },
  dismissLabel: { color: '#5B5FEF', fontSize: 13, fontWeight: '600' },
  label: {
    flexShrink: 1,
    color: '#343D50',
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: '#E1E5ED',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    color: '#172033',
    fontSize: 16,
    paddingHorizontal: 16,
  },
  inputError: {
    borderColor: '#DB5260',
  },
  error: {
    color: '#C33F4D',
    fontSize: 13,
  },
});
