import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '../lib/theme';

const config = {
  high:   { label: 'High Energy',  color: colors.energyHigh,   bg: colors.energyHighBg   },
  medium: { label: 'Med Energy',   color: colors.energyMedium, bg: colors.energyMediumBg },
  low:    { label: 'Low Energy',   color: colors.energyLow,    bg: colors.energyLowBg    },
};

export default function EnergyBadge({ level }) {
  const { label, color, bg } = config[level] || config.medium;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
  },
});
