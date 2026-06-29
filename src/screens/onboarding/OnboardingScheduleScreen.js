import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { colors, fonts } from '../../lib/theme';

// ─── Time options ─────────────────────────────────────────────────────────────

const WAKE_OPTIONS = [
  { label: '5 AM', value: 300 },
  { label: '6 AM', value: 360 },
  { label: '7 AM', value: 420 },
  { label: '8 AM', value: 480 },
  { label: '9 AM', value: 540 },
  { label: '10 AM', value: 600 },
];

const SLEEP_OPTIONS = [
  { label: '8 PM', value: 1200 },
  { label: '9 PM', value: 1260 },
  { label: '10 PM', value: 1320 },
  { label: '11 PM', value: 1380 },
  { label: '12 AM', value: 1440 },
  { label: '1 AM',  value: 1500 },
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
  { label: 'None', value: 0  },
  { label: '5 min',  value: 5  },
  { label: '10 min', value: 10 },
  { label: '15 min', value: 15 },
  { label: '20 min', value: 20 },
  { label: '30 min', value: 30 },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function OnboardingScheduleScreen({ navigation }) {
  const [wakeMinutes,      setWakeMinutes]      = useState(420);   // 7 AM
  const [sleepMinutes,     setSleepMinutes]      = useState(1320);  // 10 PM
  const [hasBreakfast,     setHasBreakfast]      = useState(false);
  const [breakfastMinutes, setBreakfastMinutes]  = useState(480);   // 8 AM
  const [hasLunch,         setHasLunch]          = useState(false);
  const [lunchMinutes,     setLunchMinutes]      = useState(720);   // 12 PM
  const [hasDinner,        setHasDinner]         = useState(false);
  const [dinnerMinutes,    setDinnerMinutes]     = useState(1080);  // 6 PM
  const [breakMins,        setBreakMins]         = useState(15);
  const [saving,           setSaving]            = useState(false);

  async function handleContinue() {
    setSaving(true);
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
    navigation.navigate('OnboardingTasks');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.stepLabel}>Step 2 of 3</Text>
        <Text style={styles.title}>Set up your routine</Text>
        <Text style={styles.subtitle}>
          This helps the app suggest a schedule that actually fits your day.
        </Text>

        {/* Wake up */}
        <Section label="When do you wake up?">
          <PillRow
            options={WAKE_OPTIONS}
            value={wakeMinutes}
            onChange={setWakeMinutes}
          />
        </Section>

        {/* Bedtime */}
        <Section label="When do you usually go to sleep?">
          <PillRow
            options={SLEEP_OPTIONS}
            value={sleepMinutes}
            onChange={setSleepMinutes}
          />
        </Section>

        {/* Meals */}
        <Section label="Do you eat meals? (tap to toggle)">
          <MealRow
            emoji="🌅"
            label="Breakfast"
            enabled={hasBreakfast}
            onToggle={() => setHasBreakfast((v) => !v)}
            options={BREAKFAST_OPTIONS}
            value={breakfastMinutes}
            onChange={setBreakfastMinutes}
          />
          <MealRow
            emoji="☀️"
            label="Lunch"
            enabled={hasLunch}
            onToggle={() => setHasLunch((v) => !v)}
            options={LUNCH_OPTIONS}
            value={lunchMinutes}
            onChange={setLunchMinutes}
          />
          <MealRow
            emoji="🌙"
            label="Dinner"
            enabled={hasDinner}
            onToggle={() => setHasDinner((v) => !v)}
            options={DINNER_OPTIONS}
            value={dinnerMinutes}
            onChange={setDinnerMinutes}
          />
        </Section>

        {/* Break time */}
        <Section label="How long of a break between tasks?">
          <PillRow
            options={BREAK_OPTIONS}
            value={breakMins}
            onChange={setBreakMins}
          />
        </Section>

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.continueBtn, saving && { opacity: 0.6 }]}
          onPress={handleContinue}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.continueBtnText}>Continue →</Text>
          }
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('OnboardingTasks')}>
          <Text style={styles.skipText}>Skip for now</Text>
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
  safe:      { flex: 1, backgroundColor: colors.background },
  container: { padding: 24, paddingBottom: 140 },

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
  subtitle: { fontSize: 15, fontFamily: fonts.regular, color: colors.muted, lineHeight: 23, marginBottom: 8 },

  section: { marginTop: 28 },
  sectionLabel: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: colors.text,
    marginBottom: 12,
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
  pillActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  pillText:   { fontSize: 14, fontFamily: fonts.medium, color: colors.muted },
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
  mealEmoji: { fontSize: 20 },
  mealLabel: { flex: 1, fontSize: 16, fontFamily: fonts.semiBold, color: colors.text },
  mealLabelActive: { color: colors.primary },

  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.border,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleActive: { backgroundColor: colors.primary },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
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
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
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
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 20,
    paddingBottom: 36,
    gap: 12,
    alignItems: 'center',
  },
  continueBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
  },
  continueBtnText: { color: '#fff', fontFamily: fonts.bold, fontSize: 16 },
  skipText: { fontSize: 13, fontFamily: fonts.regular, color: colors.muted },
});
