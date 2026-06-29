import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, fonts } from '../lib/theme';

const ENERGY_COLORS = {
  high:   { bg: colors.energyHighBg,   border: colors.energyHigh,   text: colors.energyHigh   },
  medium: { bg: colors.energyMediumBg, border: colors.energyMedium, text: colors.energyMedium },
  low:    { bg: colors.energyLowBg,    border: colors.energyLow,    text: colors.energyLow    },
};

/** Format "HH:MM:SS" → "9:00 AM" */
function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const period = h < 12 ? 'AM' : 'PM';
  const h12    = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

/** Add durationMinutes to a "HH:MM:SS" string → "HH:MM AM/PM" */
function formatEndTime(timeStr, durationMinutes) {
  if (!timeStr || !durationMinutes) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const totalMins = h * 60 + m + durationMinutes;
  const eh = Math.floor(totalMins / 60) % 24;
  const em = totalMins % 60;
  const period = eh < 12 ? 'AM' : 'PM';
  const h12    = eh === 0 ? 12 : eh > 12 ? eh - 12 : eh;
  return `${h12}:${String(em).padStart(2, '0')} ${period}`;
}

/**
 * Absolutely-positioned task block for the time-block timeline.
 *
 * Props:
 *   task              – the tasks join object ({ title, energy_level, ... })
 *   topOffset         – px from the top of the scroll area (derived from start_time)
 *   height            – px height (derived from estimated_minutes)
 *   isComplete        – bool
 *   startTime         – "HH:MM:SS" string for the start label
 *   durationMinutes   – number of minutes, used to compute end time label
 *   onPress           – () => void
 */
export default function TimeBlock({
  task, topOffset, height, isComplete,
  startTime, durationMinutes, onPress,
}) {
  const palette   = ENERGY_COLORS[task.energy_level] ?? ENERGY_COLORS.medium;
  const minHeight = 44;
  const blockH    = Math.max(height, minHeight);

  const start = formatTime(startTime);
  const end   = formatEndTime(startTime, durationMinutes);
  const timeRange = start && end ? `${start} – ${end}` : start;

  return (
    <TouchableOpacity
      style={[
        styles.block,
        {
          top:             topOffset,
          height:          blockH,
          backgroundColor: isComplete ? colors.background : palette.bg,
          borderLeftColor: palette.border,
          opacity:         isComplete ? 0.55 : 1,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {timeRange ? (
        <Text
          style={[styles.timeRange, { color: isComplete ? colors.muted : palette.border }]}
          numberOfLines={1}
        >
          {timeRange}
        </Text>
      ) : null}
      <Text
        style={[styles.title, { color: isComplete ? colors.muted : palette.text }]}
        numberOfLines={blockH > 56 ? 2 : 1}
      >
        {isComplete ? '✓ ' : ''}{task.title}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  block: {
    position: 'absolute',
    left: 64,
    right: 12,
    borderLeftWidth: 3,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  timeRange: {
    fontSize: 10,
    fontFamily: fonts.semiBold,
    letterSpacing: 0.2,
    marginBottom: 2,
  },
  title: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    lineHeight: 17,
  },
});
