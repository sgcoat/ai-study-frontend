import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type SafeAreaEdge = 'top' | 'bottom' | 'left' | 'right';

interface AppScreenProps extends PropsWithChildren {
  scrollable?: boolean;
  edges?: SafeAreaEdge[];
}

export function AppScreen({
  children,
  scrollable = false,
  edges = ['top', 'bottom'],
}: AppScreenProps) {
  return (
    <SafeAreaView edges={edges} style={styles.safeArea}>
      {scrollable ? (
        <ScrollView
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={styles.content}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F8FC',
  },
  content: {
    flex: 1,
    padding: 24,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
});
