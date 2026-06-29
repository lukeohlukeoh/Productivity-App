import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, fonts } from '../lib/theme';

/**
 * Reusable pill-button selector with optional ⓘ tooltip.
 *
 * Props:
 *   options  – array of { value, label, description? }
 *   value    – currently selected value
 *   onChange – (value) => void
 *   style    – optional wrapper style
 */
export default function PillSelector({ options, value, onChange, style }) {
  const [tooltip, setTooltip] = useState(null); // value of option whose tip is shown

  function toggleTooltip(optValue) {
    setTooltip((prev) => (prev === optValue ? null : optValue));
  }

  return (
    <View style={[styles.wrapper, style]}>
      <View style={styles.row}>
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <View key={opt.value} style={styles.pillGroup}>
              <TouchableOpacity
                style={[styles.pill, active && styles.pillActive]}
                onPress={() => {
                  onChange(opt.value);
                  if (tooltip === opt.value) setTooltip(null);
                }}
                activeOpacity={0.75}
              >
                <Text style={[styles.pillText, active && styles.pillTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>

              {opt.description ? (
                <TouchableOpacity
                  style={styles.infoBtn}
                  onPress={() => toggleTooltip(opt.value)}
                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                >
                  <Text style={[styles.infoIcon, tooltip === opt.value && styles.infoIconActive]}>
                    ⓘ
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })}
      </View>

      {/* Tooltip panel — shown below the row */}
      {tooltip !== null && (() => {
        const opt = options.find((o) => o.value === tooltip);
        if (!opt?.description) return null;
        return (
          <View style={styles.tooltip}>
            <Text style={styles.tooltipText}>{opt.description}</Text>
          </View>
        );
      })()}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {},
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pillGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  pillActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  pillText: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.muted,
  },
  pillTextActive: {
    color: colors.primary,
    fontFamily: fonts.semiBold,
  },
  infoBtn: {
    paddingHorizontal: 2,
  },
  infoIcon: {
    fontSize: 14,
    color: colors.muted,
  },
  infoIconActive: {
    color: colors.primary,
  },
  tooltip: {
    marginTop: 10,
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
    padding: 12,
  },
  tooltipText: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.primary,
    lineHeight: 18,
  },
});
