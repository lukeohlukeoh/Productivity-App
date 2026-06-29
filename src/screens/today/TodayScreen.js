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

// ─── Component ────────────────────────────────────────────────────────────────

export default function TodayScreen({ navigation }) {
  const [planTasks, setPlanTasks]         = useState([]);
  const [loading, setLoading]             = useState(true);
  const [currentEnergy, setCurrentEnergy] = useState(null);

  const scrollViewRef   = useRef(null);
  const timelineOffsetY = useRef(0);

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
    setSelectedPickerTask(task);
    setPickerVisible(false);
    // Default schedule: next full hour from now
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

      {/* ── Docked Add button ── */}
      <View style={styles.dock}>
        <TouchableOpacity
          style={styles.dockMainBtn}
          onPress={() => setAddModalVisible(true)}
        >
          <Text style={styles.dockMainText}>＋ TASK</Text>
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
          onPress={handleLogout}
        >
          <Text style={styles.settingsRowText}>Sign out</Text>
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
            style={styles.addModalCancel}
            onPress={() => setAddModalVisible(false)}
          >
            <Text style={styles.addModalCancelText}>Cancel</Text>
          </TouchableOpacity>
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
    paddingBottom: 28,
    gap: 10,
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
