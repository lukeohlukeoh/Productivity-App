import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useOnboarding } from '../../context/OnboardingContext';
import EnergyBadge from '../../components/EnergyBadge';
import { colors, fonts } from '../../lib/theme';

export default function OnboardingTasksScreen({ navigation }) {
  const { completeOnboarding } = useOnboarding();
  const [tasks, setTasks]         = useState([]);
  const [categories, setCategories] = useState([]);
  const [completing, setCompleting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser();
    const [{ data: cats }, { data: taskData }] = await Promise.all([
      supabase.from('categories').select('*').eq('user_id', user.id).order('name'),
      supabase
        .from('tasks')
        .select('*, categories(name)')
        .eq('user_id', user.id)
        .eq('is_archived', false)
        .order('created_at'),
    ]);
    setCategories(cats || []);
    setTasks(taskData || []);
  }

  async function handleComplete() {
    setCompleting(true);
    await completeOnboarding();
  }

  function goToTaskForm(preselectedType) {
    navigation.navigate('OnboardingTaskForm', {
      categories,
      preselectedType,
      onboardingMode: true,
    });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.stepLabel}>Step 3 of 3</Text>
        <Text style={styles.title}>Add tasks to your goal bank</Text>
        <Text style={styles.subtitle}>
          Your goal bank is where all your tasks live. Each day you pick from it to build your plan.
          Add a few now, or jump straight in — you can always add more later.
        </Text>

        <Text style={styles.sectionLabel}>What kind of task do you want to add?</Text>

        {/* One-day task */}
        <TouchableOpacity
          style={styles.typeCard}
          onPress={() => goToTaskForm('one_day')}
          activeOpacity={0.75}
        >
          <Text style={styles.typeEmoji}>📅</Text>
          <View style={styles.typeCardBody}>
            <Text style={styles.typeTitle}>One-Time Task</Text>
            <Text style={styles.typeDesc}>
              Done in a single session. After completing it you choose to snooze it for later or mark it done for good.
            </Text>
            <Text style={styles.typeExample}>e.g. Clean my room, Call my bank, Meal prep</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        {/* Recurring task */}
        <TouchableOpacity
          style={styles.typeCard}
          onPress={() => goToTaskForm('recurring')}
          activeOpacity={0.75}
        >
          <Text style={styles.typeEmoji}>🔁</Text>
          <View style={styles.typeCardBody}>
            <Text style={styles.typeTitle}>Recurring Task</Text>
            <Text style={styles.typeDesc}>
              An ongoing habit or routine — either with no finish line, or a project working toward a specific goal.
            </Text>
            <Text style={styles.typeExample}>e.g. Meditate daily, Build my app, Practice piano</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        {/* Tasks added so far */}
        {tasks.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 28 }]}>Added so far</Text>
            {tasks.map((task) => (
              <View key={task.id} style={styles.taskPreviewCard}>
                <View style={styles.taskPreviewLeft}>
                  <Text style={styles.taskPreviewTitle}>{task.title}</Text>
                  <Text style={styles.taskPreviewCat}>{task.categories?.name}</Text>
                </View>
                <EnergyBadge level={task.energy_level} />
              </View>
            ))}
          </>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.continueBtn, completing && { opacity: 0.6 }]}
          onPress={handleComplete}
          disabled={completing}
        >
          {completing
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.continueBtnText}>Go to my planner →</Text>
          }
        </TouchableOpacity>
        <Text style={styles.skipHint}>
          {tasks.length === 0
            ? 'You can skip this and add tasks anytime from the Goal Bank tab.'
            : `${tasks.length} task${tasks.length === 1 ? '' : 's'} added — you can always add more later.`}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: colors.background },
  container: { padding: 24 },
  stepLabel: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 32,
    marginBottom: 10,
  },
  title:    { fontSize: 28, fontFamily: fonts.extraBold, color: colors.text, marginBottom: 10 },
  subtitle: { fontSize: 15, fontFamily: fonts.regular, color: colors.muted, lineHeight: 23, marginBottom: 28 },
  sectionLabel: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  typeCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  typeEmoji:    { fontSize: 28, marginRight: 14, marginTop: 1 },
  typeCardBody: { flex: 1 },
  typeTitle:    { fontSize: 17, fontFamily: fonts.bold, color: colors.text, marginBottom: 5 },
  typeDesc:     { fontSize: 13, fontFamily: fonts.regular, color: colors.muted, lineHeight: 19, marginBottom: 5 },
  typeExample:  { fontSize: 12, fontFamily: fonts.regular, color: colors.primary, fontStyle: 'italic' },
  chevron:      { fontSize: 24, color: colors.muted, alignSelf: 'center', marginLeft: 8 },
  taskPreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  taskPreviewLeft:  { flex: 1, marginRight: 10 },
  taskPreviewTitle: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.text },
  taskPreviewCat:   { fontSize: 12, fontFamily: fonts.regular, color: colors.muted, marginTop: 2 },
  footer: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 20,
    paddingBottom: 36,
  },
  continueBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  continueBtnText: { color: '#fff', fontFamily: fonts.bold, fontSize: 16 },
  skipHint: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted, textAlign: 'center' },
});
