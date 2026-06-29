import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import EnergyBadge from './EnergyBadge';
import { colors, fonts } from '../lib/theme';

export default function TaskCard({ task, onPress, rightAction }) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.top}>
        <Text style={styles.title} numberOfLines={1}>{task.title}</Text>
        {task.task_type === 'project' && (
          <View style={styles.typeBadge}>
            <Text style={styles.typeText}>Project</Text>
          </View>
        )}
      </View>

      {task.description ? (
        <Text style={styles.description} numberOfLines={2}>{task.description}</Text>
      ) : null}

      <View style={styles.bottom}>
        <EnergyBadge level={task.energy_level} />
        {rightAction && <View>{rightAction}</View>}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: colors.text,
    flex: 1,
    marginRight: 8,
  },
  typeBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  typeText: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
    color: colors.primary,
  },
  description: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.muted,
    marginBottom: 8,
    lineHeight: 18,
  },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
});
