import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { colors, fonts } from '../../lib/theme';
import WheelPicker from '../../components/WheelPicker';

// ─── Time options (same as onboarding) ───────────────────────────────────────

const WAKE_OPTIONS = [
  { label: '4:00 AM', value: 240 },
  { label: '4:30 AM', value: 270 },
  { label: '5:00 AM', value: 300 },
  { label: '5:30 AM', value: 330 },
  { label: '6:00 AM', value: 360 },
  { label: '6:30 AM', value: 390 },
  { label: '7:00 AM', value: 420 },
  { label: '7:30 AM', value: 450 },
  { label: '8:00 AM', value: 480 },
  { label: '8:30 AM', value: 510 },
  { label: '9:00 AM', value: 540 },
  { label: '9:30 AM', value: 570 },
  { label: '10:00 AM', value: 600 },
  { label: '10:30 AM', value: 630 },
  { label: '11:00 AM', value: 660 },
  { label: '11:30 AM', value: 690 },
  { label: '12:00 PM', value: 720 },
];

const SLEEP_OPTIONS = [
  { label: '7:00 PM',  value: 1140 },
  { label: '7:30 PM',  value: 1170 },
  { label: '8:00 PM',  value: 1200 },
  { label: '8:30 PM',  value: 1230 },
  { label: '9:00 PM',  value: 1260 },
  { label: '9:30 PM',  value: 1290 },
  { label: '10:00 PM', value: 1320 },
  { label: '10:30 PM', value: 1350 },
  { label: '11:00 PM', value: 1380 },
  { label: '11:30 PM', value: 1410 },
  { label: '12:00 AM', value: 1440 },
  { label: '12:30 AM', value: 1470 },
  { label: '1:00 AM',  value: 1500 },
  { label: '1:30 AM',  value: 1530 },
  { label: '2:00 AM',  value: 1560 },
  { label: '2:30 AM',  value: 1590 },
  { label: '3:00 AM',  value: 1620 },
];

const BREAKFAST_OPTIONS = [
  { label: '6 AM', value: 360 },
  { label: '7 AM', value: 420 },
  { label: '8 AM', value: 480 },
  { label: '9 AM', value: 540 },
  { label: '10 AM', value: 600 },
];

const LUNCH_OPTIONS = [
  { label: '11 AM', value: 660 },
  { label: '12 PM', value: 720 },
  { label: '1 PM',  value: 780 },
  { label: '2 PM',  value: 840 },
];

const DINNER_OPTIONS = [
  { label: '5 PM', value: 1020 },
  { label: '6 PM', value: 1080 },
  { label: '7 PM', value: 1140 },
  { label: '8 PM', value: 1200 },
  { label: '9 PM', value: 1260 },
];

const BREAK_OPTIONS = [
  { label: 'None',    value: 0  },
  { label: '5 min',  value: 5  },
  { label: '10 min', value: 10 },
  { label: '15 min', value: 15 },
  { label: '20 min', value: 20 },
  { label: '30 min', value: 30 },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function EditRoutineScreen({ navigation }) {
  const [loading,          setLoading]          = useState(true);
  const [saving,           setSaving]           = useState(false);
  const [saved,            setSaved]            = useState(false);

  const [wakeMinutes,      setWakeMinutes]      = useState(420);
  const [sleepMinutes,     setSleepMinutes]     = useState(1320);
  const [hasBreakfast,     setHasBreakfast]     = useState(false);
  const [breakfastMinutes, setBreakfastMinutes] = useState(480);
  const [hasLunch,         setHasLunch]         = useState(false);
  const [lunchMinutes,     setLunchMinutes]     = useState(720);
  const [hasDinner,        setHasDinner]        = useState(false);
  const [dinnerMinutes,    setDinnerMinutes]    = useState(1080);
  const [breakMins,        setBreakMins]        = useState(15);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from('profiles')
      .select('wake_minutes, sleep_minutes, breakfast_minutes, lunch_minutes, dinner_minutes, break_minutes')
      .eq('id', user.id)
      .single();

    if (profile) {
      if (profile.wake_minutes  != null) setWakeMinutes(profile.wake_minutes);
      if (profile.sleep_minutes != null) setSleepMinutes(profile.sleep_minutes);
      if (profile.breakfast_minutes != null) {
        setHasBreakfast(true);
        setBreakfastMinutes(profile.breakfast_minutes);
      }
      if (profile.lunch_minutes != null) {
        setHasLunch(true);
        setLunchMinutes(profile.lunch_minutes);
      }
      if (profile.dinner_minutes != null) {
        setHasDinner(true);
        setDinnerMinutes(profile.dinner_minutes);
      }
      if (profile.break_minutes != null) setBreakMins(profile.break_minutes);
    }
    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase
      .from('profiles')
      .update({
        wake_minutes:      wakeMinutes,
        sleep_minutes:     sleepMinutes,
        breakfast_minutes: hasBreakfast ? breakfastMinutes : null,
        lunch_minutes:     hasLunch     ? lunchMinutes     : null,
        dinner_minutes:    hasDinner    ? dinnerMinutes    : null,
        break_minutes:     breakMins,
      })
      .eq('id', user.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        {/* Wake up */}
        <Section label="When do you wake up?">
          <View style={styles.wheelCard}>
            <WheelPicker options={WAKE_OPTIONS} value={wakeMinutes} onChange={setWakeMinutes} />
          </View>
        </Section>

        {/* Bedtime */}
        <Section label="When do you go to sleep?">
          <View style={styles.wheelCard}>
            <WheelPicker options={SLEEP_OPTIONS} value={sleepMinutes} onChange={setSleepMinutes} />
          </View>
        </Section>

        {/* Meals */}
        <Section label="Meals (tap to toggle)">
          <MealRow
            emoji="🌅" label="Breakfast"
            enabled={hasBreakfast} onToggle={() => setHasBreakfast((v) => !v)}
            options={BREAKFAST_OPTIONS} value={breakfastMinutes} onChange={setBreakfastMinutes}
          />
          <MealRow
            emoji="☀️" label="Lunch"
            enabled={hasLunch} onToggle={() => setHasLunch((v) => !v)}
            options={LUNCH_OPTIONS} value={lunchMinutes} onChange={setLunchMinutes}
          />
          <MealRow
            emoji="🌙" label="Dinner"
            enabled={hasDinner} onToggle={() => setHasDinner((v) => !v)}
            options={DINNER_OPTIONS} value={dinnerMinutes} onChange={setDinnerMinutes}
          />
        </Section>

        {/* Break time */}
        <Section label="Break between tasks">
          <PillRow options={BREAK_OPTIONS} value={breakMins} onChange={setBreakMins} />
        </Section>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Save button */}
      <View style={styles.footer}>
        {saved && (
          <Text style={styles.savedText}>Saved!</Text>
        )}
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveBtnText}>Save changes</Text>
          }
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ label, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {children}
    </View>
  );
}

function PillRow({ options, value, onChange }) {
  return (
    <View style={styles.pillRow}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.value}
          style={[styles.pill, value === opt.value && styles.pillActive]}
          onPress={() => onChange(opt.value)}
        >
          <Text style={[styles.pillText, value === opt.value && styles.pillTextActive]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function MealRow({ emoji, label, enabled, onToggle, options, value, onChange }) {
  return (
    <View style={styles.mealBlock}>
      <TouchableOpacity
        style={[styles.mealToggle, enabled && styles.mealToggleActive]}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <Text style={styles.mealEmoji}>{emoji}</Text>
        <Text style={[styles.mealLabel, enabled && styles.mealLabelActive]}>{label}</Text>
        <View style={[styles.toggle, enabled && styles.toggleActive]}>
          <View style={[styles.toggleThumb, enabled && styles.toggleThumbActive]} />
        </View>
      </TouchableOpacity>
      {enabled && (
        <View style={styles.mealTimeRow}>
          <Text style={styles.mealTimeLabel}>What time?</Text>
          <PillRow options={options} value={value} onChange={onChange} />
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  container: { padding: 20, paddingBottom: 40 },

  section: { marginBottom: 28 },
  sectionLabel: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: colors.text,
    marginBottom: 12,
  },

  wheelCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  pillActive:     { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  pillText:       { fontSize: 14, fontFamily: fonts.medium, color: colors.muted },
  pillTextActive: { color: colors.primary, fontFamily: fonts.semiBold },

  mealBlock: {
    backgroundColor: colors.card,
    borderRadius: 14,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  mealToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  mealToggleActive: { backgroundColor: colors.primaryLight },
  mealEmoji:        { fontSize: 20 },
  mealLabel:        { flex: 1, fontSize: 16, fontFamily: fonts.semiBold, color: colors.text },
  mealLabelActive:  { color: colors.primary },

  toggle: {
    width: 44, height: 24, borderRadius: 12,
    backgroundColor: colors.border,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleActive:      { backgroundColor: colors.primary },
  toggleThumb: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleThumbActive: { alignSelf: 'flex-end' },

  mealTimeRow: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  mealTimeLabel: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },

  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 28,
    gap: 8,
    alignItems: 'center',
  },
  savedText: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: colors.primary,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    width: '100%',
  },
  saveBtnText: { color: '#fff', fontFamily: fonts.bold, fontSize: 16 },
});
