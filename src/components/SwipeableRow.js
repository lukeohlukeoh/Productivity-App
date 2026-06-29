import React, { useRef } from 'react';
import {
  Animated, View, Text, TouchableOpacity,
  PanResponder, StyleSheet,
} from 'react-native';
import { colors, fonts } from '../lib/theme';

const ACTION_WIDTH = 144; // 72px per button

export default function SwipeableRow({ children, onEdit, onDelete }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpen     = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      // Only claim horizontal gestures that are clearly horizontal
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > Math.abs(g.dy) * 2 && Math.abs(g.dx) > 8,
      onPanResponderMove: (_, g) => {
        const base = isOpen.current ? -ACTION_WIDTH : 0;
        translateX.setValue(Math.max(-ACTION_WIDTH, Math.min(0, base + g.dx)));
      },
      onPanResponderRelease: (_, g) => {
        const threshold = ACTION_WIDTH / 3;
        if (!isOpen.current && g.dx < -threshold) {
          snap(-ACTION_WIDTH, true);
        } else if (isOpen.current && g.dx > threshold) {
          snap(0, false);
        } else {
          snap(isOpen.current ? -ACTION_WIDTH : 0, isOpen.current);
        }
      },
    })
  ).current;

  function snap(toValue, openState) {
    Animated.spring(translateX, {
      toValue,
      useNativeDriver: true,
      tension: 120,
      friction: 10,
    }).start(() => { isOpen.current = openState; });
  }

  function close() { snap(0, false); }

  return (
    <View style={styles.container}>
      {/* Action buttons revealed behind the card */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => { close(); onEdit?.(); }}
          activeOpacity={0.85}
        >
          <Text style={styles.actionText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => { close(); onDelete?.(); }}
          activeOpacity={0.85}
        >
          <Text style={styles.actionText}>Delete</Text>
        </TouchableOpacity>
      </View>

      {/* Card — slides left to reveal actions */}
      <Animated.View
        style={{ transform: [{ translateX }], backgroundColor: '#F9FAFB' }}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  actions: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: ACTION_WIDTH,
    flexDirection: 'row',
  },
  editBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtn: {
    flex: 1,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  actionText: {
    color: '#fff',
    fontFamily: fonts.bold,
    fontSize: 14,
  },
});
