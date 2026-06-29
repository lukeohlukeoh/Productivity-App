import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, Modal, FlatList, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import EnergyBadge from '../../components/EnergyBadge';
import BottomSheet from '../../components/BottomSheet';
import TimeBlock from '../../components/TimeBlock';
import { colors, fonts } from '../../lib/theme';

// ─── Constants ───────────────────────────────────────────────────────────────

const PX_PER_MINUTE = 1.5;   // how many pixels per minute on the timeline
const HOUR_START    = 6;     // timeline starts at 6 AM
const HOUR_END      = 23;    // timeline ends at 11 PM
const TOTAL_MINUTES = (HOUR_END - HOUR_START) * 60;
const TIMELINE_HEIGHT = TOTAL_MINUTES * PX_PER_MINUTE;
const HOUR_COL_WIDTH  = 52;

const ENERGY_OPTIONS = [
  { value: 'high',   emoji: '🔴', label: 'High'   },
  { value: 'medium', emoji: '🟡', label: 'Medium' },
  { value: 'low',    emoji: '🟢', label: 'Low'    },
];

const ENERGY_COLORS = {
  high:   { bg: colors.energyHighBg,   border: colors.energyHigh,   text: colors.energyHigh   },
  medium: { bg: colors.energyMediumBg, border: colors.energyMedium, text: colors.energyMedium },
  low:    { bg: colors.energyLowBg,    border: colors.energyLow,    text: colors.energyLow    },
};

const SNOOZE_OPTIONS = [
  { label: 'Snooze 3 days',  days: 3  },
  { label: 'Snooze 1 week',  days: 7  },
  { label: 'Snooze 1 month', days: 30 },
];

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

/** "HH:MM:SS" → minutes since midnight */
function timeToMinutes(timeStr) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

/** minutes since midnight → "HH:MM:00" */
function minutesToTime(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

/** minutes since midnight → top-offset px on timeline */
function minutesToY(minutes) {
  return (minutes - HOUR_START * 60) * PX_PER_MINUTE;
}

/** Generate hour labels for the timeline */
function hourLabels() {
  const labels = [];
  for (let h = HOUR_START; h <= HOUR_END; h++) {
    const label = h === 12 ? '12pm' : h < 12 ? `${h}am` : `${h - 12}pm`;
    labels.push({ h, label });
  }
  return labels;
}

const todayLabel = new Date().toLocaleDateString('en-US', {
  weekday: 'long', month: 'long', day: 'numeric',
});

/** minutes since midnight → "9:00 AM" display string */
function formatDisplayTime(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayH}:${String(m).padStart(2, '0')} ${suffix}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TodayScreen({ navigation }) {
  const [planTasks, setPlanTasks]         = useState([]);
  const [loading, setLoading]             = useState(true);
  const [currentEnergy, setCurrentEnergy] = useState(null);

  const scrollViewRef          = useRef(null);
  const timelineOffsetY        = useRef(0);
  const schedulePreviewScrollRef = useRef(null);

  // Energy check-in sheet
  const [energySheetVisible, setEnergySheetVisible] = useState(false);

  // Settings / logout sheet
  const [settingsSheetVisible, setSettingsSheetVisible] = useState(false);

  // Goal-bank picker sheet
  const [pickerVisible, setPickerVisible]   = useState(false);
  const [pickerTasks, setPickerTasks]       = useState([]);
  const [pickerSearch, setPickerSearch]     = useState('');
  const [pickerLoading, setPickerLoading]   = useState(false);
  const [selectedPickerTask, setSelectedPickerTask] = useState(null);

  // Start-time + duration sheet (shown after picking a task from bank)
  const [scheduleSheetVisible, setScheduleSheetVisible] = useState(false);
  const [scheduleHour,   setScheduleHour]   = useState(9);
  const [scheduleMinute, setScheduleMinute] = useState(0);
  const [scheduleDuration, setScheduleDuration] = useState(30);

  // Add-task choice modal
  const [addModalVisible, setAddModalVisible] = useState(false);

  // AI recommendations
  const [aiSheetVisible, setAiSheetVisible]       = useState(false);
  const [aiRecommendations, setAiRecommendations] = useState([]);
  const [aiLoading, setAiLoading]                 = useState(false);
  const [aiError, setAiError]                     = useState(null);

  // Full-day schedule suggestion
  const [schedulePreviewVisible, setSchedulePreviewVisible] = useState(false);
  const [suggestedSchedule, setSuggestedSchedule]           = useState([]);
  const [scheduleLoading, setScheduleLoading]               = useState(false);
  const [scheduleError, setScheduleError]                   = useState(null);
  const [swappingSlotIndex, setSwappingSlotIndex]           = useState(null);

  // Snooze modal (shown after completing a one-time task)
  const [snoozeModalVisible, setSnoozeModalVisible] = useState(false);
  const [snoozeTask, setSnoozeTask] = useState(null);

  // ── Data loading ───────────────────────────────────────────────────────────

  useFocusEffect(
    useCallback(() => {
      loadToday();
    }, [])
  );

  useEffect(() => {
    if (!loading && scrollViewRef.current) {
      const now = new Date();
      const mins = now.getHours() * 60 + now.getMinutes();
      const clampedMins = Math.max(HOUR_START * 60, Math.min(HOUR_END * 60, mins));
      const y = timelineOffsetY.current + minutesToY(clampedMins) - 100;
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: Math.max(0, y), animated: false });
      }, 50);
    }
  }, [loading]);

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

    if (!incomplete?.length) return;

    const { data: alreadyToday } = await supabase
      .from('daily_plan_tasks')
      .select('task_id')
      .eq('user_id', user.id)
      .eq('plan_date', todayDate());

    const todayIds = new Set((alreadyToday || []).map((t) => t.task_id));
    const toCarry  = incomplete.filter((t) => !todayIds.has(t.task_id));
    if (!toCarry.length) return;

    await supabase.from('daily_plan_tasks').insert(
      toCarry.map((t) => ({
        user_id:            user.id,
        task_id:            t.task_id,
        plan_date:          todayDate(),
        estimated_minutes:  t.estimated_minutes,
        is_complete:        false,
        carried_over:       true,
        start_time:         null, // carried tasks land in unscheduled list
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
      .order('start_time', { ascending: true, nullsFirst: false });
    if (error) Alert.alert('Error', error.message);
    else setPlanTasks(data || []);
  }

  // ── Task actions ───────────────────────────────────────────────────────────

  async function markComplete(planTask) {
    const { error } = await supabase
      .from('daily_plan_tasks')
      .update({ is_complete: true })
      .eq('id', planTask.id);
    if (error) { Alert.alert('Error', error.message); return; }

    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('task_logs').insert({
      user_id:        user.id,
      task_id:        planTask.task_id,
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

  // ── Snooze ─────────────────────────────────────────────────────────────────

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

  // ── Goal-bank picker ───────────────────────────────────────────────────────

  async function openPicker() {
    setPickerVisible(true);
    setPickerSearch('');
    setSelectedPickerTask(null);
    setPickerLoading(true);

    const { data: { user } } = await supabase.auth.getUser();

    // Tasks already in today's plan
    const { data: todayPlan } = await supabase
      .from('daily_plan_tasks')
      .select('task_id')
      .eq('user_id', user.id)
      .eq('plan_date', todayDate());
    const todayIds = new Set((todayPlan || []).map((t) => t.task_id));

    // All non-archived tasks belonging to the user's categories
    const { data, error } = await supabase
      .from('tasks')
      .select('id, title, energy_level, task_type, daily_timebox_minutes, categories(name)')
      .eq('is_archived', false)
      .order('title', { ascending: true });

    if (error) Alert.alert('Error', error.message);
    else setPickerTasks((data || []).filter((t) => !todayIds.has(t.id)));

    setPickerLoading(false);
  }

  function openNewTaskForm() {
    navigation.navigate('GoalBank', {
      screen: 'TaskForm',
      params: {},
    });
  }

  function onPickerSelect(task) {
    setPickerVisible(false);

    // Swap mode: replace a slot in the suggested schedule
    if (swappingSlotIndex !== null) {
      setSuggestedSchedule((prev) =>
        prev.map((slot, i) =>
          i === swappingSlotIndex
            ? { ...slot, task, reason: 'Manually swapped' }
            : slot
        )
      );
      setSwappingSlotIndex(null);
      setSchedulePreviewVisible(true);
      return;
    }

    // Normal mode: open time/duration picker
    setSelectedPickerTask(task);
    const now = new Date();
    setScheduleHour(now.getHours() + 1 > 22 ? 22 : now.getHours() + 1);
    setScheduleMinute(0);
    setScheduleDuration(task.daily_timebox_minutes || 30);
    setScheduleSheetVisible(true);
  }

  async function confirmSchedule() {
    if (!selectedPickerTask) return;
    setScheduleSheetVisible(false);

    const { data: { user } } = await supabase.auth.getUser();
    const startTime = minutesToTime(scheduleHour * 60 + scheduleMinute);

    const { error } = await supabase.from('daily_plan_tasks').insert({
      user_id:           user.id,
      task_id:           selectedPickerTask.id,
      plan_date:         todayDate(),
      estimated_minutes: scheduleDuration,
      is_complete:       false,
      carried_over:      false,
      start_time:        startTime,
    });

    if (error) Alert.alert('Error', error.message);
    else fetchTodayPlan();
    setSelectedPickerTask(null);
  }

  // ── Settings / logout ──────────────────────────────────────────────────────

  async function handleLogout() {
    setSettingsSheetVisible(false);
    await supabase.auth.signOut();
  }

  // ── Shared scoring logic ──────────────────────────────────────────────────

  async function loadScoredTasks(user, today) {
    const { data: todayPlan } = await supabase
      .from('daily_plan_tasks')
      .select('task_id')
      .eq('user_id', user.id)
      .eq('plan_date', today);

    const todayTaskIds = new Set((todayPlan || []).map((t) => t.task_id));

    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('id, title, energy_level, task_type, daily_timebox_minutes, categories(name)')
      .eq('is_archived', false)
      .or(`snooze_until.is.null,snooze_until.lte.${today}`);

    if (tasksError) throw tasksError;

    const availableTasks = (tasks || []).filter((t) => !todayTaskIds.has(t.id));

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { data: logs } = await supabase
      .from('task_logs')
      .select('task_id, completed_date')
      .eq('user_id', user.id)
      .gte('completed_date', thirtyDaysAgo.toISOString().split('T')[0])
      .order('completed_date', { ascending: false });

    const lastDoneMap = {};
    for (const log of (logs || [])) {
      if (!lastDoneMap[log.task_id]) lastDoneMap[log.task_id] = log.completed_date;
    }

    const ENERGY_LEVELS = ['low', 'medium', 'high'];

    const scored = availableTasks.map((task) => {
      let score = 0;
      const reasons = [];

      const taskEnergy = task.energy_level || 'medium';
      if (currentEnergy) {
        if (taskEnergy === currentEnergy) {
          score += 40;
          reasons.push(`matches your ${currentEnergy} energy`);
        } else {
          const diff = Math.abs(
            ENERGY_LEVELS.indexOf(taskEnergy) - ENERGY_LEVELS.indexOf(currentEnergy)
          );
          if (diff === 1) score += 15;
        }
      } else {
        score += 20;
      }

      const lastDone = lastDoneMap[task.id];
      if (!lastDone) {
        score += 30;
        reasons.push("you've never done this one");
      } else {
        const daysSince = Math.floor(
          (new Date(today) - new Date(lastDone)) / (1000 * 60 * 60 * 24)
        );
        if (daysSince >= 7)       { score += 25; reasons.push(`last done ${daysSince} days ago`); }
        else if (daysSince >= 4)  { score += 15; reasons.push(`last done ${daysSince} days ago`); }
        else                      { score += 5;  reasons.push(`last done ${daysSince} day${daysSince === 1 ? '' : 's'} ago`); }
      }

      if (task.task_type === 'recurring') score += 10;
      score += Math.random() * 5;

      const reason = reasons.length
        ? reasons[0][0].toUpperCase() + reasons[0].slice(1) +
          (reasons[1] ? ` · ${reasons[1]}` : '')
        : 'Good fit for today';

      return { task, score, reason };
    });

    return scored.sort((a, b) => b.score - a.score);
  }

  // ── "Suggest my day" (pick individual tasks) ──────────────────────────────

  async function fetchSuggestions() {
    setAddModalVisible(false);
    setAiSheetVisible(true);
    setAiLoading(true);
    setAiError(null);
    setAiRecommendations([]);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const scored = await loadScoredTasks(user, todayDate());

      setAiRecommendations(
        scored.slice(0, 5).map(({ task, reason }) => ({ task_id: task.id, reason, task }))
      );
    } catch (err) {
      setAiError(err.message || 'Could not load suggestions. Try again.');
    }

    setAiLoading(false);
  }

  // ── "Suggest a schedule" (full planned day) ───────────────────────────────

  async function suggestFullSchedule() {
    setSchedulePreviewVisible(true);
    setScheduleLoading(true);
    setScheduleError(null);
    setSuggestedSchedule([]);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const today = todayDate();
      const [candidates, { data: profile }] = await Promise.all([
        loadScoredTasks(user, today),
        supabase
          .from('profiles')
          .select('wake_minutes, sleep_minutes, breakfast_minutes, lunch_minutes, dinner_minutes, break_minutes')
          .eq('id', user.id)
          .single(),
      ]);

      // Bounds from user's routine (fall back to sensible defaults)
      const now = new Date();
      const currentMins = now.getHours() * 60 + now.getMinutes();
      const wakeMin  = profile?.wake_minutes  ?? 8 * 60;
      const sleepMin = profile?.sleep_minutes ?? 21 * 60;
      const breakMin = profile?.break_minutes ?? 15;
      const START_MIN = Math.max(wakeMin, Math.ceil(currentMins / 30) * 30);
      const END_MIN   = sleepMin;

      // Meal windows to block out (30 min each)
      const mealBlocks = [
        profile?.breakfast_minutes,
        profile?.lunch_minutes,
        profile?.dinner_minutes,
      ]
        .filter((t) => t != null)
        .map((t) => ({ start: t, end: t + 30 }));

      function advancePastMeals(cursor) {
        let c = cursor;
        for (const meal of mealBlocks) {
          if (c >= meal.start && c < meal.end) c = meal.end;
        }
        return c;
      }

      function overlapsMeal(start, duration) {
        const end = start + duration;
        return mealBlocks.some((m) => start < m.end && end > m.start);
      }

      function idealEnergyAt(mins) {
        if (mins < 12 * 60) return 'high';
        if (mins < 17 * 60) return 'medium';
        return 'low';
      }

      const remaining = [...candidates];
      const slots = [];
      let cursor = advancePastMeals(START_MIN);

      while (cursor < END_MIN && slots.length < 6 && remaining.length > 0) {
        cursor = advancePastMeals(cursor);
        if (cursor >= END_MIN) break;

        const ideal = idealEnergyAt(cursor);
        remaining.sort((a, b) => {
          const aBonus = (a.task.energy_level || 'medium') === ideal ? 20 : 0;
          const bBonus = (b.task.energy_level || 'medium') === ideal ? 20 : 0;
          return (b.score + bBonus) - (a.score + aBonus);
        });

        const pick = remaining.shift();
        const duration = pick.task.daily_timebox_minutes || 30;

        if (cursor + duration > END_MIN || overlapsMeal(cursor, duration)) {
          cursor += 30;
          remaining.unshift(pick);
          continue;
        }

        slots.push({ task: pick.task, startMinutes: cursor, duration, reason: pick.reason });
        cursor += duration + breakMin;
      }

      setSuggestedSchedule(slots);

      // Auto-scroll timeline to just before the first task
      if (slots.length > 0) {
        setTimeout(() => {
          const y = Math.max(0, minutesToY(slots[0].startMinutes) - 80);
          schedulePreviewScrollRef.current?.scrollTo({ y, animated: false });
        }, 100);
      }
    } catch (err) {
      setScheduleError(err.message || 'Could not build a schedule. Try again.');
    }

    setScheduleLoading(false);
  }

  async function confirmSuggestedSchedule() {
    setSchedulePreviewVisible(false);
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from('daily_plan_tasks').insert(
      suggestedSchedule.map((slot) => ({
        user_id:           user.id,
        task_id:           slot.task.id,
        plan_date:         todayDate(),
        estimated_minutes: slot.duration,
        is_complete:       false,
        carried_over:      false,
        start_time:        minutesToTime(slot.startMinutes),
      }))
    );

    if (error) Alert.alert('Error', error.message);
    else { fetchTodayPlan(); setSuggestedSchedule([]); }
  }

  // ── Derived data ───────────────────────────────────────────────────────────

  const scheduled   = planTasks.filter((t) => t.start_time);
  const unscheduled = planTasks.filter((t) => !t.start_time);

  const filteredPickerTasks = pickerTasks.filter((t) =>
    t.title.toLowerCase().includes(pickerSearch.toLowerCase())
  );

  // ── Render helpers ─────────────────────────────────────────────────────────

  function renderUnscheduledCard(item) {
    const task = item.tasks;
    if (!task) return null;
    return (
      <View key={item.id} style={styles.unscheduledCard}>
        <View style={styles.unscheduledLeft}>
          <Text
            style={[styles.unscheduledTitle, item.is_complete && styles.strikethrough]}
            numberOfLines={2}
          >
            {task.title}
          </Text>
          <View style={styles.unscheduledMeta}>
            <EnergyBadge level={task.energy_level} />
            {item.carried_over && (
              <View style={styles.carriedBadge}>
                <Text style={styles.carriedText}>carried over</Text>
              </View>
            )}
            {task.task_type === 'one_day' && (
              <View style={styles.oneDayBadge}>
                <Text style={styles.oneDayText}>one-time</Text>
              </View>
            )}
          </View>
          {item.estimated_minutes ? (
            <Text style={styles.durationText}>~{item.estimated_minutes} min</Text>
          ) : null}
        </View>
        <View style={styles.unscheduledActions}>
          <TouchableOpacity
            style={[styles.doneBtn, item.is_complete && styles.doneBtnActive]}
            onPress={() => item.is_complete ? markIncomplete(item) : markComplete(item)}
          >
            <Text style={[styles.doneBtnText, item.is_complete && styles.doneBtnTextActive]}>
              {item.is_complete ? '✓' : 'Done'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => removePlanTask(item)}>
            <Text style={styles.removeText}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.avatarBtn}
          onPress={() => setSettingsSheetVisible(true)}
        >
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitial}>U</Text>
          </View>
          <Text style={styles.avatarLabel}>User</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.energyBtn}
          onPress={() => setEnergySheetVisible(true)}
        >
          <Text style={styles.energyBtnText}>
            {currentEnergy
              ? `${ENERGY_OPTIONS.find((e) => e.value === currentEnergy)?.emoji} ${ENERGY_OPTIONS.find((e) => e.value === currentEnergy)?.label}`
              : 'How are you feeling?'}
          </Text>
        </TouchableOpacity>
      </View>

      {scheduled.length === 0 && unscheduled.length === 0 && !loading && (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>What would you like to{'\n'}do today?</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Unscheduled section ── */}
          {unscheduled.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Unscheduled</Text>
              {unscheduled.map((item) => renderUnscheduledCard(item))}
            </View>
          )}

          {/* ── Timeline ── */}
          <Text style={styles.sectionLabel}>
            {unscheduled.length > 0 ? 'Schedule' : 'Today\'s schedule'}
          </Text>

          {/* Timeline grid */}
          <View
            style={[styles.timeline, { height: TIMELINE_HEIGHT }]}
            onLayout={(e) => { timelineOffsetY.current = e.nativeEvent.layout.y; }}
          >
            {/* Hour lines + labels */}
            {hourLabels().map(({ h, label }) => {
              const y = (h - HOUR_START) * 60 * PX_PER_MINUTE;
              return (
                <View key={h} style={[styles.hourRow, { top: y }]}>
                  <Text style={styles.hourLabel}>{label}</Text>
                  <View style={styles.hourLine} />
                </View>
              );
            })}

            {/* Current time indicator */}
            {(() => {
              const now = new Date();
              const mins = now.getHours() * 60 + now.getMinutes();
              if (mins < HOUR_START * 60 || mins > HOUR_END * 60) return null;
              const y = minutesToY(mins);
              return (
                <View style={[styles.nowLine, { top: y }]}>
                  <View style={styles.nowDot} />
                  <View style={styles.nowBar} />
                </View>
              );
            })()}

            {/* Scheduled task blocks */}
            {scheduled.map((item) => {
              if (!item.tasks) return null;
              const startMins   = timeToMinutes(item.start_time);
              const duration    = item.estimated_minutes || 30;
              const topOffset   = minutesToY(startMins);
              const blockHeight = duration * PX_PER_MINUTE;

              return (
                <TimeBlock
                  key={item.id}
                  task={item.tasks}
                  topOffset={topOffset}
                  height={blockHeight}
                  isComplete={item.is_complete}
                  startTime={item.start_time}
                  durationMinutes={duration}
                  onPress={() =>
                    Alert.alert(item.tasks.title, 'What would you like to do?', [
                      {
                        text: item.is_complete ? 'Mark Incomplete' : 'Mark Done',
                        onPress: () =>
                          item.is_complete ? markIncomplete(item) : markComplete(item),
                      },
                      {
                        text: 'Remove from today',
                        style: 'destructive',
                        onPress: () => removePlanTask(item),
                      },
                      { text: 'Cancel', style: 'cancel' },
                    ])
                  }
                />
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* ── Docked buttons ── */}
      <View style={styles.dock}>
        <TouchableOpacity
          style={styles.dockMainBtn}
          onPress={() => setAddModalVisible(true)}
        >
          <Text style={styles.dockMainText}>＋ TASK</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.dockSecondBtn}
          onPress={suggestFullSchedule}
        >
          <Text style={styles.dockSecondText}>✨ Suggest a schedule</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.dockViewLink}
          onPress={() => navigation.navigate('Schedule')}
        >
          <Text style={styles.dockViewLinkText}>View scheduled tasks</Text>
        </TouchableOpacity>
      </View>

      {/* ── Energy check-in sheet ── */}
      <BottomSheet
        visible={energySheetVisible}
        onClose={() => setEnergySheetVisible(false)}
      >
        <Text style={styles.sheetTitle}>How's your energy right now?</Text>
        <Text style={styles.sheetSub}>This helps you pick tasks that match how you feel.</Text>
        {ENERGY_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[
              styles.energyOption,
              currentEnergy === opt.value && styles.energyOptionActive,
            ]}
            onPress={() => {
              setCurrentEnergy(opt.value);
              setEnergySheetVisible(false);
            }}
          >
            <Text style={styles.energyOptionEmoji}>{opt.emoji}</Text>
            <Text style={[
              styles.energyOptionLabel,
              currentEnergy === opt.value && styles.energyOptionLabelActive,
            ]}>
              {opt.label} energy
            </Text>
            {currentEnergy === opt.value && (
              <Text style={styles.energyOptionCheck}>✓</Text>
            )}
          </TouchableOpacity>
        ))}
      </BottomSheet>

      {/* ── Settings sheet ── */}
      <BottomSheet
        visible={settingsSheetVisible}
        onClose={() => setSettingsSheetVisible(false)}
      >
        <Text style={styles.sheetTitle}>Account</Text>
        <TouchableOpacity
          style={styles.settingsRow}
          onPress={() => {
            setSettingsSheetVisible(false);
            navigation.navigate('EditRoutine');
          }}
        >
          <Text style={styles.settingsRowText}>Edit my routine</Text>
          <Text style={styles.settingsRowChevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.settingsRow, styles.settingsRowLast]}
          onPress={handleLogout}
        >
          <Text style={[styles.settingsRowText, styles.settingsRowDanger]}>Sign out</Text>
          <Text style={styles.settingsRowChevron}>›</Text>
        </TouchableOpacity>
      </BottomSheet>

      {/* ── Goal-bank picker sheet ── */}
      <Modal
        visible={pickerVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setPickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => setPickerVisible(false)}
        />
        <View style={styles.pickerSheet}>
          <View style={styles.pickerHandle} />
          <Text style={styles.sheetTitle}>Pick from goal bank</Text>

          <TextInput
            style={styles.pickerSearch}
            placeholder="Search tasks…"
            placeholderTextColor={colors.muted}
            value={pickerSearch}
            onChangeText={setPickerSearch}
            autoCorrect={false}
          />

          {pickerLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
          ) : (
            <FlatList
              data={filteredPickerTasks}
              keyExtractor={(t) => t.id}
              style={styles.pickerList}
              ListEmptyComponent={
                <Text style={styles.pickerEmpty}>No tasks found. Create one with "+ New".</Text>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.pickerItem}
                  onPress={() => onPickerSelect(item)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickerItemTitle}>{item.title}</Text>
                    {item.categories?.name ? (
                      <Text style={styles.pickerItemCat}>{item.categories.name}</Text>
                    ) : null}
                  </View>
                  <EnergyBadge level={item.energy_level} />
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </Modal>

      {/* ── Schedule sheet (after picking a task) ── */}
      <BottomSheet
        visible={scheduleSheetVisible}
        onClose={() => setScheduleSheetVisible(false)}
      >
        <Text style={styles.sheetTitle}>
          {selectedPickerTask?.title}
        </Text>
        <Text style={styles.sheetSub}>Set a start time and duration</Text>

        {/* Start time picker row */}
        <Text style={styles.scheduleLabel}>Start time</Text>
        <View style={styles.timeRow}>
          {/* Hours */}
          <ScrollView
            style={styles.timePicker}
            showsVerticalScrollIndicator={false}
          >
            {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => i + HOUR_START).map((h) => (
              <TouchableOpacity
                key={h}
                style={[styles.timeItem, scheduleHour === h && styles.timeItemActive]}
                onPress={() => setScheduleHour(h)}
              >
                <Text style={[styles.timeItemText, scheduleHour === h && styles.timeItemTextActive]}>
                  {h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Minutes */}
          <ScrollView
            style={styles.timePicker}
            showsVerticalScrollIndicator={false}
          >
            {[0, 15, 30, 45].map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.timeItem, scheduleMinute === m && styles.timeItemActive]}
                onPress={() => setScheduleMinute(m)}
              >
                <Text style={[styles.timeItemText, scheduleMinute === m && styles.timeItemTextActive]}>
                  :{String(m).padStart(2, '0')}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Duration */}
        <View style={styles.scheduleLabelRow}>
          <Text style={styles.scheduleLabel}>Duration</Text>
          {selectedPickerTask?.daily_timebox_minutes && scheduleDuration === selectedPickerTask.daily_timebox_minutes && (
            <Text style={styles.preferredLabel}>your preferred</Text>
          )}
        </View>
        <View style={styles.durationRow}>
          {DURATION_OPTIONS.map((d) => (
            <TouchableOpacity
              key={d}
              style={[styles.durationPill, scheduleDuration === d && styles.durationPillActive]}
              onPress={() => setScheduleDuration(d)}
            >
              <Text style={[styles.durationPillText, scheduleDuration === d && styles.durationPillTextActive]}>
                {d < 60 ? `${d}m` : `${d / 60}h`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.confirmBtn} onPress={confirmSchedule}>
          <Text style={styles.confirmBtnText}>Add to today</Text>
        </TouchableOpacity>
      </BottomSheet>

      {/* ── Add task choice modal ── */}
      <Modal visible={addModalVisible} animationType="fade" transparent>
        <TouchableOpacity
          style={styles.addModalOverlay}
          activeOpacity={1}
          onPress={() => setAddModalVisible(false)}
        />
        <View style={styles.addModalSheet}>
          <View style={styles.addModalHandle} />
          <Text style={styles.addModalTitle}>Add a task</Text>
          <TouchableOpacity
            style={styles.addModalOption}
            onPress={() => { setAddModalVisible(false); openPicker(); }}
          >
            <Text style={styles.addModalOptionIcon}>📋</Text>
            <View style={styles.addModalOptionText}>
              <Text style={styles.addModalOptionLabel}>Add existing task</Text>
              <Text style={styles.addModalOptionSub}>Pick from your goal bank</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addModalOption}
            onPress={() => { setAddModalVisible(false); openNewTaskForm(); }}
          >
            <Text style={styles.addModalOptionIcon}>✏️</Text>
            <View style={styles.addModalOptionText}>
              <Text style={styles.addModalOptionLabel}>Create new task</Text>
              <Text style={styles.addModalOptionSub}>Add something new to your goal bank</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addModalOption}
            onPress={fetchSuggestions}
          >
            <Text style={styles.addModalOptionIcon}>✨</Text>
            <View style={styles.addModalOptionText}>
              <Text style={styles.addModalOptionLabel}>Suggest my day</Text>
              <Text style={styles.addModalOptionSub}>Smart picks based on your energy and history</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addModalCancel}
            onPress={() => setAddModalVisible(false)}
          >
            <Text style={styles.addModalCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ── Suggestions sheet ── */}
      <BottomSheet
        visible={aiSheetVisible}
        onClose={() => setAiSheetVisible(false)}
        style={{ maxHeight: '85%' }}
      >
        <Text style={styles.sheetTitle}>Suggested for Today</Text>
        <Text style={styles.sheetSub}>
          {currentEnergy
            ? `Based on your ${currentEnergy} energy and recent history`
            : 'Based on your goal bank and recent history'}
        </Text>

        {aiLoading ? (
          <View style={styles.aiLoadingBox}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.aiLoadingText}>Finding your best tasks...</Text>
          </View>
        ) : aiError ? (
          <View style={styles.aiErrorBox}>
            <Text style={styles.aiErrorText}>{aiError}</Text>
            <TouchableOpacity onPress={fetchSuggestions} style={styles.aiRetryBtn}>
              <Text style={styles.aiRetryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : aiRecommendations.length === 0 ? (
          <Text style={styles.aiEmptyText}>
            No suggestions available. Add more tasks to your goal bank!
          </Text>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
            {aiRecommendations.map((rec) => (
              <View key={rec.task_id} style={styles.aiRecCard}>
                <View style={styles.aiRecContent}>
                  <Text style={styles.aiRecTitle}>{rec.task?.title}</Text>
                  <Text style={styles.aiRecReason}>{rec.reason}</Text>
                  <View style={styles.aiRecMeta}>
                    <EnergyBadge level={rec.task?.energy_level} />
                    {rec.task?.categories?.name ? (
                      <Text style={styles.aiRecCat}>{rec.task.categories.name}</Text>
                    ) : null}
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.aiAddBtn}
                  onPress={() => {
                    setAiSheetVisible(false);
                    onPickerSelect(rec.task);
                  }}
                >
                  <Text style={styles.aiAddBtnText}>Add</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={styles.aiRefreshBtn} onPress={fetchSuggestions}>
              <Text style={styles.aiRefreshText}>Different picks</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </BottomSheet>

      {/* ── Schedule preview pop-out ── */}
      <Modal
        visible={schedulePreviewVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setSchedulePreviewVisible(false)}
      >
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => setSchedulePreviewVisible(false)}
        />
        <View style={styles.schedulePreviewSheet}>
          {/* Handle + header */}
          <View style={styles.pickerHandle} />
          <View style={styles.schedulePreviewHeader}>
            <View>
              <Text style={styles.sheetTitle}>Suggested Schedule</Text>
              <Text style={styles.schedulePreviewSub}>{todayLabel}</Text>
            </View>
            <TouchableOpacity
              style={styles.schedulePreviewClose}
              onPress={() => setSchedulePreviewVisible(false)}
            >
              <Text style={styles.schedulePreviewCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          {scheduleLoading ? (
            <View style={styles.aiLoadingBox}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.aiLoadingText}>Building your day...</Text>
            </View>
          ) : scheduleError ? (
            <View style={styles.aiErrorBox}>
              <Text style={styles.aiErrorText}>{scheduleError}</Text>
              <TouchableOpacity onPress={suggestFullSchedule} style={styles.aiRetryBtn}>
                <Text style={styles.aiRetryText}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : suggestedSchedule.length === 0 ? (
            <View style={styles.aiLoadingBox}>
              <Text style={styles.aiEmptyText}>
                Add more tasks to your goal bank to get a schedule suggestion!
              </Text>
            </View>
          ) : (
            <>
              {/* Timeline */}
              <ScrollView
                ref={schedulePreviewScrollRef}
                style={styles.schedulePreviewScroll}
                contentContainerStyle={{ paddingBottom: 16 }}
                showsVerticalScrollIndicator={false}
              >
                <View style={[styles.timeline, { height: TIMELINE_HEIGHT, marginHorizontal: 16, marginTop: 8 }]}>
                  {hourLabels().map(({ h, label }) => {
                    const y = (h - HOUR_START) * 60 * PX_PER_MINUTE;
                    return (
                      <View key={h} style={[styles.hourRow, { top: y }]}>
                        <Text style={styles.hourLabel}>{label}</Text>
                        <View style={styles.hourLine} />
                      </View>
                    );
                  })}

                  {(() => {
                    const now = new Date();
                    const mins = now.getHours() * 60 + now.getMinutes();
                    if (mins < HOUR_START * 60 || mins > HOUR_END * 60) return null;
                    return (
                      <View style={[styles.nowLine, { top: minutesToY(mins) }]}>
                        <View style={styles.nowDot} />
                        <View style={styles.nowBar} />
                      </View>
                    );
                  })()}

                  {suggestedSchedule.map((slot, index) => {
                    const topOffset   = minutesToY(slot.startMinutes);
                    const blockHeight = Math.max(slot.duration * PX_PER_MINUTE, 52);
                    const palette     = ENERGY_COLORS[slot.task.energy_level] ?? ENERGY_COLORS.medium;
                    return (
                      <View
                        key={`${slot.task.id}-${index}`}
                        style={[
                          styles.suggestedBlock,
                          { top: topOffset, height: blockHeight, backgroundColor: palette.bg, borderLeftColor: palette.border },
                        ]}
                      >
                        <Text style={[styles.suggestedBlockTime, { color: palette.border }]}>
                          {formatDisplayTime(slot.startMinutes)} – {formatDisplayTime(slot.startMinutes + slot.duration)}
                        </Text>
                        <Text
                          style={[styles.suggestedBlockTitle, { color: palette.text }]}
                          numberOfLines={blockHeight > 64 ? 2 : 1}
                        >
                          {slot.task.title}
                        </Text>
                        <TouchableOpacity
                          style={styles.swapChip}
                          onPress={() => {
                            setSwappingSlotIndex(index);
                            setSchedulePreviewVisible(false);
                            openPicker();
                          }}
                        >
                          <Text style={styles.swapChipText}>swap</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>

              {/* Footer */}
              <View style={styles.schedulePreviewFooter}>
                <TouchableOpacity style={styles.confirmBtn} onPress={confirmSuggestedSchedule}>
                  <Text style={styles.confirmBtnText}>Confirm schedule</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.addModalCancel} onPress={() => setSchedulePreviewVisible(false)}>
                  <Text style={styles.addModalCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </Modal>

      {/* ── Snooze modal (one-time tasks) ── */}
      <Modal visible={snoozeModalVisible} animationType="fade" transparent>
        <View style={styles.snoozeOverlay}>
          <View style={styles.snoozeSheet}>
            <Text style={styles.snoozeTitle}>Nice work! ✓</Text>
            <Text style={styles.snoozeTaskName}>{snoozeTask?.tasks?.title}</Text>
            <Text style={styles.snoozeSub}>
              This is a one-time task. Want to be reminded again?
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  avatarBtn: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarCircle: {
    width: 38, height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontSize: 16, fontFamily: fonts.bold, color: '#fff' },
  avatarLabel: { fontSize: 15, fontFamily: fonts.semiBold, color: colors.text },
  energyBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  energyBtnText: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: colors.primary,
  },

  // Scroll / sections
  scroll: { paddingBottom: 120 },
  section: { paddingHorizontal: 16, paddingTop: 16 },
  sectionLabel: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginTop: 16,
    paddingHorizontal: 16,
  },

  // Empty state
  emptyBox: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 36 },
  emptyTitle: {
    fontSize: 24,
    fontFamily: fonts.bold,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 32,
  },

  // Unscheduled cards
  unscheduledCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  unscheduledLeft:    { flex: 1 },
  unscheduledTitle:   { fontSize: 15, fontFamily: fonts.semiBold, color: colors.text, marginBottom: 6 },
  strikethrough:      { textDecorationLine: 'line-through', color: colors.muted },
  unscheduledMeta:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  durationText:       { fontSize: 12, fontFamily: fonts.regular, color: colors.muted },
  carriedBadge:       { backgroundColor: '#FEF3C7', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  carriedText:        { fontSize: 10, fontFamily: fonts.semiBold, color: '#92400E' },
  oneDayBadge:        { backgroundColor: colors.primaryLight, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  oneDayText:         { fontSize: 10, fontFamily: fonts.bold, color: colors.primary },
  unscheduledActions: { flexDirection: 'column', alignItems: 'center', gap: 10, marginLeft: 12 },
  doneBtn: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: 8,
    paddingVertical: 6, paddingHorizontal: 12,
  },
  doneBtnActive: { backgroundColor: colors.energyLow, borderColor: colors.energyLow },
  doneBtnText:   { fontSize: 13, fontFamily: fonts.semiBold, color: colors.muted },
  doneBtnTextActive: { color: '#fff' },
  removeText:    { fontSize: 16, color: colors.muted },

  // Timeline
  timeline: {
    marginHorizontal: 16,
    marginTop: 4,
    position: 'relative',
  },
  hourRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  hourLabel: {
    width: HOUR_COL_WIDTH,
    fontSize: 11,
    fontFamily: fonts.medium,
    color: colors.muted,
    textAlign: 'right',
    paddingRight: 10,
  },
  hourLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  nowLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  nowDot: {
    width: 8, height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginLeft: HOUR_COL_WIDTH - 4,
  },
  nowBar: {
    flex: 1,
    height: 2,
    backgroundColor: colors.primary,
  },

  // Docked bar
  dock: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 48,
    gap: 10,
  },
  dockSecondBtn: {
    width: '100%',
    borderRadius: 50,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  dockSecondText: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: colors.primary,
    letterSpacing: 0.3,
  },

  dockMainBtn: {
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  dockMainText: { fontSize: 15, fontFamily: fonts.bold, color: '#fff', letterSpacing: 0.8 },
  dockViewLink: { paddingVertical: 2 },
  dockViewLinkText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.muted,
    textDecorationLine: 'underline',
  },

  // Sheet common
  sheetTitle: { fontSize: 18, fontFamily: fonts.bold, color: colors.text, marginBottom: 4 },
  sheetSub:   { fontSize: 13, fontFamily: fonts.regular, color: colors.muted, marginBottom: 20 },
  scheduleLabel: {
    fontSize: 12, fontFamily: fonts.semiBold, color: colors.muted,
    marginBottom: 8, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.4,
  },
  scheduleLabelRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  preferredLabel: {
    fontSize: 11, fontFamily: fonts.medium, color: colors.primary,
    marginBottom: 8, marginTop: 4,
  },

  // Energy sheet
  energyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border,
    gap: 12,
  },
  energyOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  energyOptionEmoji: { fontSize: 22 },
  energyOptionLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: colors.text,
  },
  energyOptionLabelActive: { color: colors.primary },
  energyOptionCheck: { fontSize: 16, color: colors.primary, fontFamily: fonts.bold },

  // Settings sheet
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingsRowText:    { fontSize: 16, fontFamily: fonts.medium, color: colors.text },
  settingsRowChevron: { fontSize: 20, color: colors.muted },
  settingsRowLast:    { borderBottomWidth: 0 },
  settingsRowDanger:  { color: colors.error || '#E53935' },

  // Picker sheet
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  pickerSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  pickerHandle: {
    width: 40, height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 20,
  },
  pickerSearch: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    fontFamily: fonts.regular,
    color: colors.text,
    backgroundColor: colors.background,
    marginBottom: 12,
  },
  pickerList:  { maxHeight: 340 },
  pickerEmpty: { fontSize: 14, fontFamily: fonts.regular, color: colors.muted, textAlign: 'center', marginTop: 20 },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  pickerItemTitle: { fontSize: 15, fontFamily: fonts.semiBold, color: colors.text },
  pickerItemCat:   { fontSize: 12, fontFamily: fonts.regular, color: colors.muted, marginTop: 2 },

  // Schedule sheet
  timeRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  timePicker: {
    flex: 1,
    maxHeight: 160,
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timeItem: {
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  timeItemActive: { backgroundColor: colors.primaryLight },
  timeItemText:   { fontSize: 14, fontFamily: fonts.medium, color: colors.muted },
  timeItemTextActive: { color: colors.primary, fontFamily: fonts.semiBold },
  durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  durationPill: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.background,
  },
  durationPillActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  durationPillText:   { fontSize: 13, fontFamily: fonts.medium, color: colors.muted },
  durationPillTextActive: { color: colors.primary, fontFamily: fonts.semiBold },
  confirmBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  confirmBtnText: { fontSize: 16, fontFamily: fonts.bold, color: '#fff' },

  // Add task modal
  addModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  addModalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 44,
  },
  addModalHandle: {
    width: 40, height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 20,
  },
  addModalTitle: {
    fontSize: 18, fontFamily: fonts.bold, color: colors.text, marginBottom: 16,
  },
  addModalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 14,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  addModalOptionIcon: { fontSize: 24 },
  addModalOptionText: { flex: 1 },
  addModalOptionLabel: { fontSize: 15, fontFamily: fonts.semiBold, color: colors.text },
  addModalOptionSub:   { fontSize: 12, fontFamily: fonts.regular, color: colors.muted, marginTop: 2 },
  addModalCancel: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  addModalCancelText: { fontSize: 15, fontFamily: fonts.medium, color: colors.muted },

  // Schedule preview (pop-out sheet)
  schedulePreviewSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 0,
    maxHeight: '85%',
  },
  schedulePreviewHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  schedulePreviewSub: { fontSize: 13, fontFamily: fonts.regular, color: colors.muted, marginTop: 2 },
  schedulePreviewClose: { padding: 4 },
  schedulePreviewCloseText: { fontSize: 18, color: colors.muted },
  schedulePreviewScroll: { maxHeight: '100%' },
  schedulePreviewFooter: {
    paddingTop: 12,
    paddingBottom: 28,
    gap: 8,
  },
  suggestedBlock: {
    position: 'absolute',
    left: 64,
    right: 12,
    borderLeftWidth: 3,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  suggestedBlockTime: { fontSize: 10, fontFamily: fonts.semiBold, letterSpacing: 0.2, marginBottom: 2 },
  suggestedBlockTitle: { fontSize: 13, fontFamily: fonts.semiBold, lineHeight: 17 },
  swapChip: {
    position: 'absolute',
    top: 6,
    right: 8,
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  swapChipText: { fontSize: 10, fontFamily: fonts.semiBold, color: colors.muted },

  // AI recommendations sheet
  aiLoadingBox:   { alignItems: 'center', paddingVertical: 40 },
  aiLoadingText:  { marginTop: 14, fontSize: 14, fontFamily: fonts.regular, color: colors.muted },
  aiErrorBox:     { alignItems: 'center', paddingVertical: 24 },
  aiErrorText:    { fontSize: 14, fontFamily: fonts.regular, color: '#ef4444', textAlign: 'center', marginBottom: 12 },
  aiRetryBtn:     { paddingVertical: 8, paddingHorizontal: 20 },
  aiRetryText:    { fontSize: 15, fontFamily: fonts.semiBold, color: colors.primary },
  aiEmptyText:    { fontSize: 14, fontFamily: fonts.regular, color: colors.muted, textAlign: 'center', paddingVertical: 24 },
  aiRecCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 12, marginBottom: 10,
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
  },
  aiRecContent:   { flex: 1 },
  aiRecTitle:     { fontSize: 15, fontFamily: fonts.semiBold, color: colors.text, marginBottom: 4 },
  aiRecReason:    { fontSize: 12, fontFamily: fonts.regular, color: colors.muted, lineHeight: 18, marginBottom: 6 },
  aiRecMeta:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aiRecCat:       { fontSize: 11, fontFamily: fonts.regular, color: colors.muted },
  aiAddBtn:       { backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  aiAddBtnText:   { fontSize: 14, fontFamily: fonts.bold, color: '#fff' },
  aiRefreshBtn:   { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  aiRefreshText:  { fontSize: 14, fontFamily: fonts.medium, color: colors.muted, textDecorationLine: 'underline' },

  // Snooze modal
  snoozeOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  snoozeSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, paddingBottom: 44,
  },
  snoozeTitle:    { fontSize: 20, fontFamily: fonts.bold, color: colors.text, marginBottom: 4 },
  snoozeTaskName: { fontSize: 16, fontFamily: fonts.bold, color: colors.text, marginBottom: 8 },
  snoozeSub:      { fontSize: 14, fontFamily: fonts.regular, color: colors.muted, marginBottom: 16 },
  snoozeOption: {
    padding: 16, borderRadius: 10,
    backgroundColor: colors.background,
    alignItems: 'center', marginBottom: 8,
  },
  snoozeOptionText: { fontSize: 15, fontFamily: fonts.semiBold, color: colors.primary },
});
