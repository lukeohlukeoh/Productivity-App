import React, { useState, useCallback } from 'react';
import {
  View, Text, SectionList, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import EnergyBadge from '../../components/EnergyBadge';
import { colors, fonts } from '../../lib/theme';

function formatDate(dateStr) {
  const date      = new Date(dateStr + 'T00:00:00');
  const today     = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (dateStr === today.toISOString().split('T')[0])     return 'Today';
  if (dateStr === yesterday.toISOString().split('T')[0]) return 'Yesterday';
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

export default function LogScreen() {
  const [sections, setSections] = useState([]);
  const [loading, setLoading]   = useState(true);

  useFocusEffect(
    useCallback(() => {
      fetchLog();
    }, [])
  );

  async function fetchLog() {
    setLoading(true);
    const { data, error } = await supabase
      .from('task_logs')
      .select('*, tasks(title, energy_level, task_type)')
      .order('completed_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      Alert.alert('Error', error.message);
      setLoading(false);
      return;
    }

    const grouped = {};
    for (const entry of data || []) {
      const date = entry.completed_date;
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(entry);
    }

    const sectionData = Object.keys(grouped).map((date) => ({
      title: formatDate(date),
      date,
      data:  grouped[date],
    }));

    setSections(sectionData);
    setLoading(false);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : sections.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No completed tasks yet</Text>
          <Text style={styles.emptyText}>
            When you mark a task as done in Today's Plan, it will appear here as your personal record.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionCount}>
                {section.data.length} {section.data.length === 1 ? 'task' : 'tasks'}
              </Text>
            </View>
          )}
          renderItem={({ item }) => {
            const task = item.tasks;
            if (!task) return null;
            return (
              <View style={styles.logCard}>
                <View style={styles.logCardLeft}>
                  <Text style={styles.logTitle}>{task.title}</Text>
                  <View style={{ marginTop: 4 }}>
                    <EnergyBadge level={task.energy_level} />
                  </View>
                </View>
                <Text style={styles.checkmark}>✓</Text>
              </View>
            );
          }}
          renderSectionFooter={() => <View style={{ height: 8 }} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list:   { padding: 16, paddingBottom: 40 },
  empty:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { fontSize: 18, fontFamily: fonts.bold, color: colors.text, marginBottom: 8 },
  emptyText:  { fontSize: 14, fontFamily: fonts.regular, color: colors.muted, textAlign: 'center', lineHeight: 20 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginTop: 12,
  },
  sectionTitle: { fontSize: 14, fontFamily: fonts.bold, color: colors.text },
  sectionCount: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted },
  logCard: {
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 14,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  logCardLeft: { flex: 1, marginRight: 12 },
  logTitle:    { fontSize: 15, fontFamily: fonts.semiBold, color: colors.text },
  checkmark:   { fontSize: 18, fontFamily: fonts.bold, color: colors.energyLow },
});
