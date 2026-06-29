import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '../lib/theme';

export default function CategoryCard({ category }) {
  return (
    <View style={styles.card}>
      <Text style={styles.name}>{category.name}</Text>
      <Text style={styles.chevron}>›</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  name: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: colors.text,
  },
  chevron: {
    fontSize: 20,
    fontFamily: fonts.regular,
    color: colors.muted,
  },
});
