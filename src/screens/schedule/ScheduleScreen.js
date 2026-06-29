import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import EnergyBadge from '../../components/EnergyBadge';
import { colors, fonts } from '../../lib/theme';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayDate() {
  return new Date().toISOString().split('T')[0];
}

/** Formats a Date → "YYYY-MM-DD" */
function toISO(date) {
  return date.toISOString().split('T')[0];
}

/** Returns the Monday of the week containing `date` */
function weekStart(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Generates an array of 7 Date objects starting from `startDate` */
function weekDays(startDate) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    return d;
  });
}

/** Generates a 6-row × 7-col calendar grid for the month containing `date` */
function monthGrid(date) {
  const year  = date.getFullYear();
  const month = date.getMonth();
  const first = new Date(year, month, 1);
  const startDay = first.getDay(); // 0 = Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  // Leading empty cells
  for (let i = 0; i < startDay; i++) cells.push(null);
  // Day cells
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  // Trailing empty cells to complete last row
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

const DAY_LABELS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_LABELS_WEEK  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function ScheduleScreen() {
  const [view, setView] = useState('week'); // 'week' | 'month'
  const [anchor, setAnchor] = useState(new Date()); // reference date for navigation
  const [selectedDate, setSelectedDate] = useState(todayDate());
  const [tasksByDate, setTasksByDate] = useState({}); // { "YYYY-MM-DD": [...] }
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      fetchRange();
    }, [anchor, view])
  );

  // ── Data ───────────────────────────────────────────────────────────────────

  async function fetchRange() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    let startDate, endDate;
    if (view === 'week') {
      const ws = weekStart(anchor);
      startDate = toISO(ws);
      const we = new Date(ws);
      we.setDate(we.getDate() + 6);
      endDate = toISO(we);
    } else {
      const year = anchor.getFullYear();
      const month = anchor.getMonth();
      startDate = toISO(new Date(year, month, 1));
      endDate   = toISO(new Date(year, month + 1, 0));
    }

    const { data, error } = await supabase
      .from('daily_plan_tasks')
      .select('*, tasks(id, title, energy_level, task_type)')
      .eq('user_id', user.id)
      .gte('plan_date', startDate)
      .lte('plan_date', endDate)
      .order('start_time', { ascending: true, nullsFirst: false });

    if (error) {
      Alert.alert('Error', error.message);
      setLoading(false);
      return;
    }

    // Group by date
    const grouped = {};
    for (const item of data || []) {
      if (!grouped[item.plan_date]) grouped[item.plan_date] = [];
      grouped[item.plan_date].push(item);
    }
    setTasksByDate(grouped);
    setLoading(false);
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  function goBack() {
    const d = new Date(anchor);
    if (view === 'week') d.setDate(d.getDate() - 7);
    else d.setMonth(d.getMonth() - 1);
    setAnchor(d);
  }

  function goForward() {
    const d = new Date(anchor);
    if (view === 'week') d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
    setAnchor(d);
  }

  function goToday() {
    setAnchor(new Date());
    setSelectedDate(todayDate());
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const today = todayDate();
  const ws    = weekStart(anchor);
  const days  = weekDays(ws);

  const headerLabel = view === 'week'
    ? (() => {
        const end = new Date(ws);
        end.setDate(end.getDate() + 6);
        const startLabel = ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const endLabel   = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        return `${startLabel} – ${endLabel}`;
      })()
    : `${MONTH_NAMES[anchor.getMonth()]} ${anchor.getFullYear()}`;

  const selectedTasks = tasksByDate[selectedDate] || [];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── View toggle + nav ── */}
      <View style={styles.topBar}>
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, view === 'week' && styles.toggleBtnActive]}
            onPress={() => setView('week')}
          >
            <Text style={[styles.toggleText, view === 'week' && styles.toggleTextActive]}>
              Week
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, view === 'month' && styles.toggleBtnActive]}
            onPress={() => setView('month')}
          >
            <Text style={[styles.toggleText, view === 'month' && styles.toggleTextActive]}>
              Month
            </Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.todayBtn} onPress={goToday}>
          <Text style={styles.todayBtnText}>Today</Text>
        </TouchableOpacity>
      </View>

      {/* ── Period header + arrows ── */}
      <View style={styles.navRow}>
        <TouchableOpacity style={styles.navArrow} onPress={goBack}>
          <Text style={styles.navArrowText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.navLabel}>{headerLabel}</Text>
        <TouchableOpacity style={styles.navArrow} onPress={goForward}>
          <Text style={styles.navArrowText}>›</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Week view ── */}
          {view === 'week' && (
            <View style={styles.weekGrid}>
              {days.map((day) => {
                const iso      = toISO(day);
                const isToday  = iso === today;
                const isSel    = iso === selectedDate;
                const dayTasks = tasksByDate[iso] || [];
                const done     = dayTasks.filter((t) => t.is_complete).length;

                return (
                  <TouchableOpacity
                    key={iso}
                    style={[
                      styles.dayCell,
                      isToday && styles.dayCellToday,
                      isSel && styles.dayCellSelected,
                    ]}
                    onPress={() => setSelectedDate(iso)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.dayCellName, isSel && styles.dayCellNameSel]}>
                      {DAY_LABELS_SHORT[days.indexOf(day)]}
                    </Text>
                    <Text style={[styles.dayCellNum, isToday && styles.dayCellNumToday, isSel && styles.dayCellNumSel]}>
                      {day.getDate()}
                    </Text>
                    {dayTasks.length > 0 && (
                      <View style={styles.dayCellDots}>
                        {dayTasks.slice(0, 3).map((_, i) => (
                          <View
                            key={i}
                            style={[
                              styles.dot,
                              { backgroundColor: i < done ? colors.energyLow : colors.primary },
                            ]}
                          />
                        ))}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* ── Month view ── */}
          {view === 'month' && (
            <View style={styles.monthContainer}>
              {/* Day-of-week header */}
              <View style={styles.monthDowRow}>
                {DAY_LABELS_WEEK.map((d) => (
                  <Text key={d} style={styles.monthDowLabel}>{d}</Text>
                ))}
              </View>

              {/* Grid */}
              <View style={styles.monthGrid}>
                {monthGrid(anchor).map((day, i) => {
                  if (!day) return <View key={`empty-${i}`} style={styles.monthCell} />;
                  const iso      = toISO(day);
                  const isToday  = iso === today;
                  const isSel    = iso === selectedDate;
                  const dayTasks = tasksByDate[iso] || [];
                  const done     = dayTasks.filter((t) => t.is_complete).length;

                  return (
                    <TouchableOpacity
                      key={iso}
                      style={[
                        styles.monthCell,
                        isSel && styles.monthCellSelected,
                      ]}
                      onPress={() => setSelectedDate(iso)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.monthDayNumWrap, isToday && styles.monthDayNumToday]}>
                        <Text style={[styles.monthDayNum, isToday && styles.monthDayNumTodayText]}>
                          {day.getDate()}
                        </Text>
                      </View>
                      {dayTasks.length > 0 && (
                        <View style={styles.monthDots}>
                          {dayTasks.slice(0, 3).map((_, idx) => (
                            <View
                              key={idx}
                              style={[
                                styles.dot,
                                { backgroundColor: idx < done ? colors.energyLow : colors.primary },
                              ]}
                            />
                          ))}
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── Selected day task list ── */}
          <View style={styles.dayDetail}>
            <Text style={styles.dayDetailHeader}>
              {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
                weekday: 'long', month: 'long', day: 'numeric',
              })}
            </Text>

            {selectedTasks.length === 0 ? (
              <View style={styles.emptyDay}>
                <Text style={styles.emptyDayText}>No tasks planned for this day.</Text>
              </View>
            ) : (
              selectedTasks.map((item) => {
                const task = item.tasks;
                if (!task) return null;
                return (
                  <View
                    key={item.id}
                    style={[styles.taskRow, item.is_complete && styles.taskRowDone]}
                  >
                    <View style={styles.taskRowLeft}>
                      <View style={styles.taskRowCheck}>
                        {item.is_complete && <Text style={styles.checkMark}>✓</Text>}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[styles.taskRowTitle, item.is_complete && styles.taskRowTitleDone]}
                          numberOfLines={2}
                        >
                          {task.title}
                        </Text>
                        <View style={styles.taskRowMeta}>
                          <EnergyBadge level={task.energy_level} />
                          {item.start_time ? (
                            <Text style={styles.taskRowTime}>
                              {(() => {
                                const [h, m] = item.start_time.split(':').map(Number);
                                const period = h < 12 ? 'am' : 'pm';
                                const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
                                return `${h12}:${String(m).padStart(2,'0')} ${period}`;
                              })()}
                            </Text>
                          ) : null}
                          {item.estimated_minutes ? (
                            <Text style={styles.taskRowDuration}>
                              {item.estimated_minutes}m
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingBottom: 40 },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  toggleBtn: {
    paddingHorizontal: 18,
    paddingVertical: 7,
  },
  toggleBtnActive: {
    backgroundColor: colors.primary,
  },
  toggleText: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: colors.muted,
  },
  toggleTextActive: { color: '#fff' },
  todayBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  todayBtnText: { fontSize: 13, fontFamily: fonts.semiBold, color: colors.text },

  // Nav row
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.card,
  },
  navArrow: { padding: 8 },
  navArrowText: { fontSize: 22, color: colors.text, fontFamily: fonts.regular },
  navLabel: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: colors.text,
  },

  // Week grid
  weekGrid: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 4,
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
    backgroundColor: colors.card,
  },
  dayCellToday: {
    borderColor: colors.primary,
  },
  dayCellSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  dayCellName: {
    fontSize: 10,
    fontFamily: fonts.semiBold,
    color: colors.muted,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  dayCellNameSel: { color: colors.primary },
  dayCellNum: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.text,
    marginBottom: 4,
  },
  dayCellNumToday: { color: colors.primary },
  dayCellNumSel:   { color: colors.primary },
  dayCellDots: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 2,
  },
  dot: {
    width: 5, height: 5,
    borderRadius: 2.5,
  },

  // Month grid
  monthContainer: { paddingHorizontal: 8, paddingTop: 12 },
  monthDowRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  monthDowLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    fontFamily: fonts.bold,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  monthCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 4,
  },
  monthCellSelected: {
    backgroundColor: colors.primaryLight,
    borderRadius: 8,
  },
  monthDayNumWrap: {
    width: 28, height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthDayNumToday: { backgroundColor: colors.primary },
  monthDayNum: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.text,
  },
  monthDayNumTodayText: { color: '#fff', fontFamily: fonts.bold },
  monthDots: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 2,
  },

  // Day detail
  dayDetail: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  dayDetailHeader: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: colors.text,
    marginBottom: 12,
  },
  emptyDay: { paddingVertical: 20, alignItems: 'center' },
  emptyDayText: { fontSize: 14, fontFamily: fonts.regular, color: colors.muted },

  // Task rows
  taskRow: {
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  taskRowDone: { opacity: 0.6 },
  taskRowLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  taskRowCheck: {
    width: 22, height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.energyLow,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkMark: { fontSize: 12, color: colors.energyLow, fontFamily: fonts.bold },
  taskRowTitle: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: colors.text,
    marginBottom: 6,
  },
  taskRowTitleDone: { textDecorationLine: 'line-through', color: colors.muted },
  taskRowMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  taskRowTime: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.muted,
  },
  taskRowDuration: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.muted,
  },
});
