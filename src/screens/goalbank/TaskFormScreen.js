import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import PillSelector from '../../components/PillSelector';
import { colors, fonts } from '../../lib/theme';

// ─── Category tooltip text ────────────────────────────────────────────────────
const CATEGORY_INFO = 'Categories are the areas of focus your tasks belong to — like "Music", "Fitness", or "Work". They help you stay organised in your goal bank.';

// ─── Options ──────────────────────────────────────────────────────────────────

const ENERGY_OPTIONS = [
  {
    value: 'high',
    label: '⚡ High',
    description: 'Creative or cognitively demanding — best when your mind is sharp.\nExamples: coding, writing, composing.',
  },
  {
    value: 'medium',
    label: '🔶 Medium',
    description: 'Practice, learning, or editing — requires focus but not peak mental state.\nExamples: instrument practice, studying, reviewing.',
  },
  {
    value: 'low',
    label: '🌿 Low',
    description: 'Passive or light tasks — good for tired or rest days.\nExamples: reading, watching tutorials, light admin.',
  },
];

const TASK_TYPE_OPTIONS = [
  {
    value: 'one_day',
    label: '📅 One-time',
    description: "Done in a single session. Afterwards you choose when (if ever) to see it again.\nExamples: Clean my room, Call my bank, Meal prep.",
  },
  {
    value: 'recurring',
    label: '🔁 Recurring',
    description: 'An ongoing habit or routine with no end date.\nExamples: Working out, meditating, journaling.',
  },
  {
    value: 'project',
    label: '🏁 Project',
    description: 'Has a finish line you chip away at over multiple sessions.\nExamples: Building an app, writing a book.',
  },
];

const PLANNING_OPTIONS = [
  { value: 'timebox', label: '⏱ Time-box' },
  { value: 'subtasks', label: '📝 Subtasks' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function TaskFormScreen({ route, navigation }) {
  const {
    task,
    defaultCategoryId,
    categories: paramCategories,
    onboardingMode,
    addToToday,
  } = route.params || {};

  // ── Form state ────────────────────────────────────────────────────────────

  const [title, setTitle]               = useState(task?.title || '');
  const [description, setDescription]   = useState(task?.description || '');
  const [selectedCategoryId, setSelectedCategoryId] = useState(
    task?.category_id || defaultCategoryId || null
  );
  const [energyLevel, setEnergyLevel]   = useState(task?.energy_level || 'medium');
  const [taskType, setTaskType]         = useState(task?.task_type || 'recurring');
  const [planningMethod, setPlanningMethod] = useState(
    task?.daily_timebox_minutes ? 'timebox' : 'subtasks'
  );
  const [timeboxMinutes, setTimeboxMinutes] = useState(
    task?.daily_timebox_minutes ? String(task.daily_timebox_minutes) : ''
  );
  const [subtasks, setSubtasks]             = useState([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newSubtaskMins, setNewSubtaskMins]   = useState('');

  // ── Category state ────────────────────────────────────────────────────────

  const [categories, setCategories] = useState(paramCategories || []);
  const [saving, setSaving]         = useState(false);
  const [errors, setErrors]         = useState({});

  // ── Tooltip state ─────────────────────────────────────────────────────────
  const [categoryTooltipVisible, setCategoryTooltipVisible] = useState(false);
  const [taskTypeTooltip, setTaskTypeTooltip] = useState(null); // value of open tooltip

  useEffect(() => {
    if (!paramCategories || paramCategories.length === 0) {
      fetchCategories();
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!task) {
        setTitle('');
        setDescription('');
        setSelectedCategoryId(defaultCategoryId || null);
        setEnergyLevel('medium');
        setTaskType('recurring');
        setPlanningMethod('subtasks');
        setTimeboxMinutes('');
        setSubtasks([]);
        setTaskTypeTooltip(null);
      }
    }, [task, defaultCategoryId])
  );

  async function fetchCategories() {
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .order('name');
    setCategories(data || []);
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    const newErrors = {};
    if (!title.trim())        newErrors.title    = true;
    if (!selectedCategoryId)  newErrors.category = true;
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});

    const payload = {
      title:       title.trim(),
      description: description.trim() || null,
      energy_level: energyLevel,
      task_type:   taskType,
      daily_timebox_minutes:
        taskType === 'project' && planningMethod === 'timebox' && timeboxMinutes
          ? parseInt(timeboxMinutes, 10)
          : null,
    };

    setSaving(true);

    if (task) {
      // Edit existing task
      const { error } = await supabase
        .from('tasks')
        .update(payload)
        .eq('id', task.id);
      if (error) { Alert.alert('Error', error.message); setSaving(false); return; }
    } else {
      // Create new task
      const { data: { user } } = await supabase.auth.getUser();
      const { data: newTask, error } = await supabase
        .from('tasks')
        .insert({
          ...payload,
          category_id: selectedCategoryId,
          user_id:     user.id,
          is_archived: false,
        })
        .select()
        .single();
      if (error) { Alert.alert('Error', error.message); setSaving(false); return; }

      // Subtasks for project type
      if (taskType === 'project' && planningMethod === 'subtasks' && subtasks.length > 0) {
        await supabase.from('subtasks').insert(
          subtasks.map((s) => ({
            task_id:            newTask.id,
            title:              s.title,
            estimated_minutes:  s.minutes || null,
            is_complete:        false,
          }))
        );
      }

      // Add to today's plan if requested
      if (addToToday) {
        await supabase.from('daily_plan_tasks').insert({
          user_id:     user.id,
          task_id:     newTask.id,
          plan_date:   new Date().toISOString().split('T')[0],
          is_complete: false,
          carried_over: false,
        });
      }
    }

    setSaving(false);

    if (onboardingMode) {
      navigation.navigate('OnboardingTasks');
    } else if (addToToday) {
      navigation.navigate('Today');
    } else {
      navigation.goBack();
    }
  }

  // ── Subtask helpers ───────────────────────────────────────────────────────

  function addSubtask() {
    if (!newSubtaskTitle.trim()) return;
    setSubtasks([...subtasks, {
      title:   newSubtaskTitle.trim(),
      minutes: parseInt(newSubtaskMins, 10) || null,
    }]);
    setNewSubtaskTitle('');
    setNewSubtaskMins('');
  }

  function removeSubtask(index) {
    setSubtasks(subtasks.filter((_, i) => i !== index));
  }

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* ── Back button ── */}
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>

          {/* ── 1. Task name ── */}
          <Text style={[styles.label, errors.title && styles.labelError]}>Task Name</Text>
          <TextInput
            style={[styles.input, errors.title && styles.inputError]}
            placeholder="What do you want to work on?"
            placeholderTextColor={colors.muted}
            value={title}
            onChangeText={(v) => { setTitle(v); if (v.trim()) setErrors((e) => ({ ...e, title: undefined })); }}
          />
          {errors.title && <Text style={styles.errorText}>Please enter a task name.</Text>}

          {/* ── 2. Category ── */}
          <View style={styles.labelRow}>
            <Text style={[styles.label, styles.labelInRow, errors.category && styles.labelError]}>Category</Text>
            <TouchableOpacity
              onPress={() => setCategoryTooltipVisible(!categoryTooltipVisible)}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            >
              <Text style={[styles.infoIcon, categoryTooltipVisible && styles.infoIconActive]}>ⓘ</Text>
            </TouchableOpacity>
          </View>
          {categoryTooltipVisible && (
            <View style={styles.tooltip}>
              <Text style={styles.tooltipText}>{CATEGORY_INFO}</Text>
            </View>
          )}
          {categories.length === 0 ? (
            <Text style={styles.emptyCategories}>
              No categories yet. Add one in the Goal Bank first.
            </Text>
          ) : (
            <View style={styles.categoryGrid}>
              {categories.map((cat) => {
                const active = cat.id === selectedCategoryId;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.categoryBtn, active && styles.categoryBtnActive, errors.category && !active && styles.categoryBtnError]}
                    onPress={() => { setSelectedCategoryId(cat.id); setErrors((e) => ({ ...e, category: undefined })); }}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.categoryBtnText, active && styles.categoryBtnTextActive]}>
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {errors.category && <Text style={styles.errorText}>Please select a category.</Text>}

          {/* ── 3. Energy level ── */}
          <Text style={styles.label}>Energy Level</Text>
          <View style={styles.energyRow}>
            {ENERGY_OPTIONS.map((opt) => {
              const active = energyLevel === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.energyBtn, active && styles.energyBtnActive]}
                  onPress={() => setEnergyLevel(opt.value)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.energyBtnText, active && styles.energyBtnTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── 4. Task type (create only) ── */}
          {!task && (
            <>
              <Text style={styles.label}>Task Type</Text>
              <View style={styles.taskTypeGroup}>
                {TASK_TYPE_OPTIONS.map((opt) => {
                  const active = taskType === opt.value;
                  const tipOpen = taskTypeTooltip === opt.value;
                  return (
                    <View key={opt.value}>
                      <TouchableOpacity
                        style={[styles.taskTypeBtn, active && styles.taskTypeBtnActive]}
                        onPress={() => setTaskType(opt.value)}
                        activeOpacity={0.75}
                      >
                        <Text style={[styles.taskTypeBtnText, active && styles.taskTypeBtnTextActive]}>
                          {opt.label}
                        </Text>
                        <View style={styles.taskTypeBtnRight}>
                          {active && <Text style={styles.taskTypeCheck}>✓</Text>}
                          <TouchableOpacity
                            onPress={() => setTaskTypeTooltip(tipOpen ? null : opt.value)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
                          >
                            <Text style={[styles.infoIcon, tipOpen && styles.infoIconActive]}>ⓘ</Text>
                          </TouchableOpacity>
                        </View>
                      </TouchableOpacity>
                      {tipOpen && (
                        <View style={styles.taskTypeTooltip}>
                          <Text style={styles.tooltipText}>{opt.description}</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </>
          )}

          {/* ── Project planning options ── */}
          {taskType === 'project' && (
            <View style={styles.projectSection}>
              <Text style={styles.sublabel}>How do you want to plan this project?</Text>
              <PillSelector
                options={PLANNING_OPTIONS}
                value={planningMethod}
                onChange={setPlanningMethod}
                style={{ marginBottom: 16 }}
              />

              {planningMethod === 'timebox' && (
                <>
                  <Text style={styles.sublabel}>Daily time-box (minutes)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 30"
                    placeholderTextColor={colors.muted}
                    value={timeboxMinutes}
                    onChangeText={setTimeboxMinutes}
                    keyboardType="numeric"
                  />
                </>
              )}

              {planningMethod === 'subtasks' && (
                <>
                  <Text style={styles.sublabel}>Subtasks</Text>
                  {subtasks.map((s, i) => (
                    <View key={i} style={styles.subtaskRow}>
                      <Text style={styles.subtaskTitle} numberOfLines={1}>{s.title}</Text>
                      {s.minutes ? (
                        <Text style={styles.subtaskMins}>{s.minutes} min</Text>
                      ) : null}
                      <TouchableOpacity onPress={() => removeSubtask(i)}>
                        <Text style={styles.subtaskRemove}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                  <View style={styles.addSubtaskRow}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder="Subtask name"
                      placeholderTextColor={colors.muted}
                      value={newSubtaskTitle}
                      onChangeText={setNewSubtaskTitle}
                    />
                    <TextInput
                      style={[styles.input, styles.minsInput]}
                      placeholder="min"
                      placeholderTextColor={colors.muted}
                      value={newSubtaskMins}
                      onChangeText={setNewSubtaskMins}
                      keyboardType="numeric"
                    />
                    <TouchableOpacity style={styles.addSubBtn} onPress={addSubtask}>
                      <Text style={styles.addSubBtnText}>Add</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          )}

          {/* ── Save button ── */}
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>
                {task
                  ? 'Save Changes'
                  : addToToday
                    ? 'Add to Goal Bank & Today'
                    : 'Add to Goal Bank'}
              </Text>
            )}
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: colors.background },
  container: { padding: 20, paddingBottom: 60 },

  // Label row with ⓘ
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 24,
    marginBottom: 10,
  },
  label: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.text,
    marginTop: 24,
    marginBottom: 10,
  },
  // When label is inside a labelRow, suppress its own margins (the row handles them)
  labelInRow: {
    marginTop: 0,
    marginBottom: 0,
  },
  infoIcon: {
    fontSize: 15,
    color: colors.muted,
  },
  infoIconActive: {
    color: colors.primary,
  },
  tooltip: {
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  tooltipText: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.primary,
    lineHeight: 18,
  },

  // Full-width stacked task type buttons
  taskTypeGroup: {
    gap: 8,
  },
  taskTypeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 16,
    backgroundColor: colors.card,
  },
  taskTypeBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  taskTypeBtnText: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: colors.muted,
  },
  taskTypeBtnTextActive: {
    color: colors.primary,
  },
  taskTypeBtnRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  taskTypeCheck: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  taskTypeTooltip: {
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
    marginBottom: 4,
  },

  sublabel: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: colors.muted,
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 13,
    fontSize: 15,
    fontFamily: fonts.regular,
    color: colors.text,
    backgroundColor: colors.card,
  },

  // Back button
  backBtn: { marginBottom: 8 },
  backBtnText: { fontSize: 15, fontFamily: fonts.medium, color: colors.primary },

  // Category buttons
  emptyCategories: { fontSize: 13, fontFamily: fonts.regular, color: colors.muted, marginBottom: 4 },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  categoryBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  categoryBtnText: { fontSize: 14, fontFamily: fonts.medium, color: colors.muted },
  categoryBtnTextActive: { color: colors.primary, fontFamily: fonts.semiBold },

  // Energy row
  energyRow: { flexDirection: 'row', gap: 8 },
  energyBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
  },
  energyBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  energyBtnText: { fontSize: 14, fontFamily: fonts.medium, color: colors.muted },
  energyBtnTextActive: { color: colors.primary, fontFamily: fonts.semiBold },

  // Project section
  projectSection: {
    marginTop: 8,
    padding: 16,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },

  // Subtasks
  subtaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
    gap: 8,
  },
  subtaskTitle:  { flex: 1, fontSize: 14, fontFamily: fonts.regular, color: colors.text },
  subtaskMins:   { fontSize: 12, fontFamily: fonts.regular, color: colors.muted },
  subtaskRemove: { color: colors.danger, fontSize: 16, paddingHorizontal: 4 },
  addSubtaskRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 4 },
  minsInput:     { width: 60 },
  addSubBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  addSubBtnText: { color: '#fff', fontFamily: fonts.bold, fontSize: 14 },

  // Save button
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 32,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText:    { color: '#fff', fontFamily: fonts.bold, fontSize: 16 },
  buttonDisabled: { opacity: 0.6 },

  labelError: { color: colors.danger },
  inputError:  { borderColor: colors.danger, borderWidth: 1.5 },
  categoryBtnError: { borderColor: colors.danger },
  errorText: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.danger,
    marginTop: 4,
    marginBottom: 4,
  },
});
