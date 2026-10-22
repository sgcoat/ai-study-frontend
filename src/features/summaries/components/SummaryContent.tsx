import { StyleSheet, Text, View } from 'react-native';

import type { Summary } from '../../../types';

export function SummaryContent({ summary }: { summary: Summary }) {
  const structured = summary.structuredContent;
  const hasStructured = structured && (structured.coreConcepts.length || structured.keyTerms.length || structured.sections.length);
  return (
    <View style={styles.content}>
      <View style={styles.savedBadge}><Text style={styles.savedLabel}>저장된 요약</Text></View>
      {hasStructured ? (
        <>
          {structured.coreConcepts.length ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>핵심 개념</Text>
              {structured.coreConcepts.map((concept, index) => (
                <View key={index} style={styles.conceptRow}>
                  <Text style={styles.number}>{String(index + 1).padStart(2, '0')}</Text>
                  <Text selectable style={styles.concept}>{concept}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {structured.keyTerms.length ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>주요 용어</Text>
              {structured.keyTerms.map((item, index) => (
                <View key={index} style={styles.termCard}>
                  <Text selectable style={styles.term}>{item.term}</Text>
                  <Text selectable style={styles.body}>{item.definition}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {structured.sections.length ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>내용 정리</Text>
              {structured.sections.map((section, index) => (
                <View key={index} style={styles.sectionCard}>
                  <Text selectable style={styles.sectionHeading}>{section.title}</Text>
                  {section.content ? <Text selectable style={styles.body}>{section.content}</Text> : null}
                  {section.bulletPoints?.map((point, pointIndex) => (
                    <View key={pointIndex} style={styles.bulletRow}>
                      <Text style={styles.bullet}>•</Text><Text selectable style={styles.bulletText}>{point}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          ) : null}
        </>
      ) : <Text selectable style={styles.body}>{summary.content}</Text>}
      <Text style={styles.metadata}>{new Date(summary.createdAt).toLocaleDateString('ko-KR')} · {summary.modelInfo}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 22 },
  savedBadge: { alignSelf: 'flex-start', backgroundColor: '#E6F6EE', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
  savedLabel: { color: '#237753', fontSize: 11, fontWeight: '700' },
  section: { gap: 12 },
  sectionTitle: { color: '#263146', fontSize: 15, fontWeight: '800' },
  conceptRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', backgroundColor: '#F0F1FF', padding: 14, borderRadius: 12 },
  number: { color: '#5B5FEF', fontSize: 14, fontWeight: '800', lineHeight: 23 },
  concept: { flex: 1, color: '#414A6A', fontSize: 14, lineHeight: 23 },
  termCard: { gap: 6, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#EDF0F5' },
  term: { color: '#5B5FEF', fontSize: 14, fontWeight: '700' },
  body: { color: '#59647A', fontSize: 14, lineHeight: 24 },
  sectionCard: { gap: 10 },
  sectionHeading: { color: '#343D50', fontSize: 14, fontWeight: '700' },
  bulletRow: { flexDirection: 'row', gap: 8 },
  bullet: { color: '#5B5FEF', fontSize: 15, lineHeight: 24 },
  bulletText: { flex: 1, color: '#59647A', fontSize: 14, lineHeight: 24 },
  metadata: { color: '#8992A2', fontSize: 11, lineHeight: 18 },
});
