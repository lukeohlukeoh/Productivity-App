import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import TaskCard from '../../components/TaskCard';
import SwipeableRow from '../../components/SwipeableRow';
import { colors, fonts } from '../../lib/theme';

export default function CategoryScreen({ route, navigation }) {
  const { categoryId, categoryName } = route.params;
  const [tasks, setTasks]   = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      fetchTasks();
    }, [])
  );

  async function fetchTasks() {
    setLoading(true);
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('category_id', categoryId)
      .eq('is_archived', false)
      .order('created_at', { ascending: false });
    if (error) Alert.alert('Error', error.message);
    else setTasks(data || []);
    setLoading(false);
  }

  async function archiveTask(task) {
    Alert.alert(
      'Remove task?',
      `"${task.title}" will be removed from your goal bank. Past log entries will be kept.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('tasks')
              .update({ is_archived: true })
              .eq('id', task.id);
            if (error) Alert.alert('Error', error.message);
            else fetchTasks();
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No tasks yet</Text>
              <Text style={styles.emptyText}>
                Tap the button below to add your first task to "{categoryName}".
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <SwipeableRow
              onEdit={() => navigation.navigate('TaskForm', { task: item, defaultCategoryId: categoryId })}
              onDelete={() => archiveTask(item)}
            >
              <TouchableOpacity
                onPress={() => navigation.navigate('TaskForm', { task: item, defaultCategoryId: categoryId })}
                activeOpacity={0.7}
              >
                <TaskCard task={item} />
              </TouchableOpacity>
            </SwipeableRow>
          )}
        />
      )}

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate('TaskForm', { defaultCategoryId: categoryId })}
        >
          <Text style={styles.fabText}>+ Add Task</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list:   { padding: 16, paddingBottom: 20 },
  empty:  { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontFamily: fonts.bold, color: colors.text, marginBottom: 8 },
  emptyText:  { fontSize: 14, fontFamily: fonts.regular, color: colors.muted, textAlign: 'center', lineHeight: 20 },
  footer: {
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },
  fab: {
    backgroundColor: colors.primary,
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: { color: '#fff', fontFamily: fonts.bold, fontSize: 16 },
});
