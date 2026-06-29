import React, { useRef, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Platform } from 'react-native';
import { colors, fonts } from '../lib/theme';

const ITEM_H  = 46;
const VISIBLE = 5;
const PAD     = Math.floor(VISIBLE / 2); // 2 items above & below center

export default function WheelPicker({ options, value, onChange }) {
  const ref     = useRef(null);
  const initIdx = Math.max(0, options.findIndex((o) => o.value === value));
  const [liveIdx, setLiveIdx] = useState(initIdx);

  useEffect(() => {
    const t = setTimeout(() => {
      ref.current?.scrollTo({ y: initIdx * ITEM_H, animated: false });
    }, 80);
    return () => clearTimeout(t);
  }, []);

  // When the controlled `value` changes externally, scroll to match
  useEffect(() => {
    const i = options.findIndex((o) => o.value === value);
    if (i !== -1 && i !== liveIdx) {
      setLiveIdx(i);
      ref.current?.scrollTo({ y: i * ITEM_H, animated: true });
    }
  }, [value]);

  function handleScroll(e) {
    const i = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
    setLiveIdx(Math.max(0, Math.min(options.length - 1, i)));
  }

  function handleScrollEnd(e) {
    const i       = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
    const clamped = Math.max(0, Math.min(options.length - 1, i));
    ref.current?.scrollTo({ y: clamped * ITEM_H, animated: true });
    setLiveIdx(clamped);
    onChange(options[clamped].value);
  }

  // Gradient overlay — uses CSS backgroundImage on web, plain bg on native
  const BG = colors.card; // matches the card background these pickers sit inside
  const fadeTopStyle  = Platform.OS === 'web'
    ? { backgroundImage: `linear-gradient(to bottom, ${BG} 15%, transparent)` }
    : { backgroundColor: BG, opacity: 0.85 };
  const fadeBottomStyle = Platform.OS === 'web'
    ? { backgroundImage: `linear-gradient(to top, ${BG} 15%, transparent)` }
    : { backgroundColor: BG, opacity: 0.85 };

  return (
    <View style={styles.root}>
      {/* Selection highlight bar */}
      <View style={styles.selectionBar} />

      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={handleScrollEnd}
        contentContainerStyle={{ paddingVertical: PAD * ITEM_H }}
      >
        {options.map((opt, i) => {
          const dist     = Math.abs(i - liveIdx);
          const selected = dist === 0;
          const near     = dist === 1;
          const far      = dist >= 2;
          return (
            <View key={opt.value} style={styles.item}>
              <Text
                style={[
                  styles.itemText,
                  selected && styles.itemSelected,
                  near     && styles.itemNear,
                  far      && styles.itemFar,
                ]}
              >
                {opt.label}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      {/* Fade overlays */}
      <View style={[styles.fade, styles.fadeTop,    fadeTopStyle]}    pointerEvents="none" />
      <View style={[styles.fade, styles.fadeBottom, fadeBottomStyle]} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    height: ITEM_H * VISIBLE,
    overflow: 'hidden',
    position: 'relative',
  },
  selectionBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: ITEM_H * PAD,
    height: ITEM_H,
    backgroundColor: colors.primaryLight,
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 10,
    zIndex: 0,
  },
  item: {
    height: ITEM_H,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  itemText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.muted,
  },
  itemSelected: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.primary,
  },
  itemNear: {
    fontSize: 17,
    opacity: 0.55,
  },
  itemFar: {
    fontSize: 14,
    opacity: 0.25,
  },
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: PAD * ITEM_H,
    zIndex: 2,
  },
  fadeTop:    { top: 0 },
  fadeBottom: { bottom: 0 },
});
