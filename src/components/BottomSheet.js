import React from 'react';
import { Modal, View, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../lib/theme';

/**
 * Reusable slide-up bottom sheet wrapper.
 *
 * Props:
 *   visible   – boolean
 *   onClose   – called when backdrop or close handle is tapped
 *   children  – content rendered inside the sheet
 *   style     – optional extra style for the sheet panel
 */
export default function BottomSheet({ visible, onClose, children, style }) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      />
      <View style={[styles.sheet, style]}>
        {/* Drag handle */}
        <View style={styles.handle} />
        {children}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 20,
  },
});
