import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, Modal, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import EnergyBadge from '../../components/EnergyBadge';
import { colors } from '../../lib/theme';

function todayDate() {
  return new Date().toISOString().split('T')[0];
}

function yesterdayDate() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

const SNOOZE_OPTIONS = [
  { label: 'Snooze 3 days', days: 3 },
  { label: 'Snooze 1 week', days: 7 },
  { label: 'Snooze 1 month', days: 30 },
];

export default function TodayScreen({ navigation }) {
  const [planTasks, setPlanTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [snoozeModalVisible, setSnoozeModalVisible] = useState(false);
  const [snoozeTask, setSnoozeTask] = useState(null);

  useFocusEffect(
    useCallback(() => {
      loadToday();
    }, [])
  );

  async function loadToday() {
    setLoading(true);
    await carryOverYesterday();
    await fetchTodayPlan();
    setLoading(false);
  }

  async function carryOverYesterday() {
    const { data: { user } } = await supabase.auth.getUser();

    const { data: incomplete } = await supabase
      .from('daily_plan_tasks')
      .select('*')
      .eq('user_id', user.id)
      .eq('plan_date', yesterdayDate())
      .eq('is_complete', false);

    if (!incomplete || incomplete.length === 0) return;

    const { data: alreadyToday } = await supabase
      .from('daily_plan_tasks')
      .select('task_id')
      .eq('user_id', user.id)
      .eq('plan_date', todayDate());

    const todayTaskIds = new Set((alreadyToday || []).map((t) => t.task_id));
    const toCarry = incomplete.filter((t) => !todayTaskIds.has(t.task_id));
    if (toCarry.length === 0) return;

    await supabase.from('daily_plan_tasks').insert(
      toCarry.map((t) => ({
        user_id: user.id,
        task_id: t.task_id,
        plan_date: todayDate(),
        estimated_minutes: t.estimated_minutes,
        is_complete: false,
        carried_over: true,
      }))
    );
  }

  async function fetchTodayPlan() {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('daily_plan_tasks')
      .select('*, tasks(id, title, energy_level, task_type)')
      .eq('user_id', user.id)
      .eq('plan_date', todayDate())
      .order('created_at', { ascending: true });
    if (error) Alert.alert('Error', error.message);
    else setPlanTasks(data || []);
  }

  async function markComplete(planTask) {
    const { error } = await supabase
      .from('daily_plan_tasks')
      .update({ is_complete: true })
      .eq('id', planTask.id);
    if (error) { Alert.alert('Error', error.message); return; }

    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('task_logs').insert({
      user_id: user.id,
      task_id: planTask.task_id,
      completed_date: todayDate(),
    });

    fetchTodayPlan();

    if (planTask.tasks?.task_type === 'one_day') {
      setSnoozeTask(planTask);
      setSnoozeModalVisible(true);
    }
  }

  async function markIncomplete(planTask) {
    await supabase
      .from('daily_plan_tasks')
      .update({ is_complete: false })
      .eq('id', planTask.id);
    await supabase
      .from('task_logs')
      .delete()
      .eq('task_id', planTask.task_id)
      .eq('completed_date', todayDate());
    fetchTodayPlan();
  }

  async function handleSnooze(days) {
    if (!snoozeTask) return;
    setSnoozeModalVisible(false);
    await supabase
      .from('tasks')
      .update({ snooze_until: addDays(days) })
      .eq('id', snoozeTask.task_id);
    setSnoozeTask(null);
  }

  async function handleDoneForGood() {
    if (!snoozeTask) return;
    setSnoozeModalVisible(false);
    await supabase
      .from('tasks')
      .update({ is_archived: true })
      .eq('id', snoozeTask.task_id);
    setSnoozeTask(null);
  }

  async function removePlanTask(planTask) {
    Alert.alert(
      'Remove from today?',
      "This task will be removed from today's plan but stays in your goal bank.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('daily_plan_tasks').delete().eq('id', planTask.id);
            fetchTodayPlan();
          },
        },
      ]
    );
  }

  function openTaskForm() {
    // Navigate into the GoalBank stack's TaskForm with addToToday flag
    navigation.navigate('GoalBank', {
      screen: 'TaskForm',
      params: { addToToday: true },
    });
  }

  const incomplete = planTasks.filter((t) => !t.is_complete);
  const complete = planTasks.filter((t) => t.is_complete);
  const carriedOver = incomplete.filter((t) => t.carried_over);
  const fresh = incomplete.filter((t) => !t.carried_over);

  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  function renderPlanTask(item, showCarriedBadge) {
    const task = item.tasks;
    if (!task) return null;

    return (
      <View key={item.id} style={styles.planCard}>
        <View style={styles.planCardTop}>
          <View style={styles.planCardInfo}>
            <View style={styles.planCardTitleRow}>
              <Text
                style={[styles.planCardTitle, item.is_complete && styles.strikethrough]}
                numberOfLines={2}
              >
                {task.title}
              </Text>
              {task.task_type === 'one_day' && (
                <View style={styles.oneDayBadge}>
                  <Text style={styles.oneDayBadgeText}>one-time</Text>
                </View>
              )}
              {showCarriedBadge && (
                <View style={styles.carriedBadge}>
                  <Text style={styles.carriedText}>carried over</Text>
                </View>
              )}
            </View>
            {item.estimated_minutes ? (
              <Text style={styles.estimateText}>~{item.estimated_minutes} min planned</Text>
            ) : null}
            <View style={{ marginTop: 6 }}>
              <EnergyBadge level={task.energy_level} />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.doneBtn, item.is_complete && styles.doneBtnActive]}
            onPress={() => item.is_complete ? markIncomplete(item) : markComplete(item)}
          >
            <Text style={[styles.doneBtnText, item.is_complete && styles.doneBtnTextActive]}>
              {item.is_complete ? '✓ Done' : 'Mark Done'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => removePlanTask(item)} style={styles.removeBtn}>
          <Text style={styles.removeBtnText}>Remove from today</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.dateLabel}>{todayLabel}</Text>

          {planTasks.length === 0 && (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No tasks planned yet</Text>
              <Text style={styles.emptyText}>
                Tap the button below to create a task and add it to today's plan.
              </Text>
            </View>
          )}

          {carriedOver.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Carried over from yesterday</Text>
              {carriedOver.map((item) => renderPlanTask(item, true))}
            </>
          )}

          {fresh.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Today's tasks</Text>
              {fresh.map((item) => renderPlanTask(item, false))}
            </>
          )}

          {complete.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Completed today 🎉</Text>
              {complete.map((item) => renderPlanTask(item, false))}
            </>
          )}
        </ScrollView>
      )}

      <TouchableOpacity style={styles.fab} onPress={openTaskForm}>
        <Text style={styles.fabText}>+ Add Task</Text>
      </TouchableOpacity>

      {/* Snooze Modal — shown after completing a one-time task */}
      <Modal visible={snoozeModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Nice work! ✓</Text>
            <Text style={styles.snoozeTaskName}>{snoozeTask?.tasks?.title}</Text>
            <Text style={styles.modalSub}>
              This is a one-time task. Want to be reminded of it again?
            </Text>

            {SNOOZE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.days}
                style={styles.snoozeOption}
                onPress={() => handleSnooze(opt.days)}
              >
                <Text style={styles.snoozeOptionText}>{opt.label}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={[styles.snoozeOption, { backgroundColor: 'transparent', marginTop: 4 }]}
              onPress={handleDoneForGood}
            >
              <Text style={[styles.snoozeOptionText, { color: colors.muted }]}>
                No, I'm done with this
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 16, paddingBottom: 100 },
  dateLabel: {
    fontSize: 13,
    color: colors.muted,
    fontWeight: '600',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  empty: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 8 },
  emptyText: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 16,
  },
  planCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  planCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  planCardInfo: { flex: 1 },
  planCardTitleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  planCardTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  strikethrough: { textDecorationLine: 'line-through', color: colors.muted },
  oneDayBadge: {
    backgroundColor: colors.primaryLight,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  oneDayBadgeText: { fontSize: 10, color: colors.primary, fontWeight: '700' },
  carriedBadge: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  carriedText: { fontSize: 10, color: '#92400E', fontWeight: '600' },
  estimateText: { fontSize: 12, color: colors.muted, marginTop: 2 },
  doneBtn: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  doneBtnActive: { backgroundColor: colors.energyLow, borderColor: colors.energyLow },
  doneBtnText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  doneBtnTextActive: { color: '#fff' },
  removeBtn: { marginTop: 10, alignSelf: 'flex-start' },
  removeBtnText: { fontSize: 12, color: colors.muted, textDecorationLine: 'underline' },
  fab: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    backgroundColor: colors.primary,
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 28,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 44,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 4 },
  modalSub: { fontSize: 14, color: colors.muted, marginBottom: 16 },
  snoozeTaskName: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 8 },
  snoozeOption: {
    padding: 16,
    borderRadius: 10,
    backgroundColor: colors.background,
    alignItems: 'center',
    marginBottom: 8,
  },
  snoozeOptionText: { fontSize: 15, fontWeight: '600', color: colors.primary },
});
