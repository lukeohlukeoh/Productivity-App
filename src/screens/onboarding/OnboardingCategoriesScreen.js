import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  TextInput, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { colors, fonts } from '../../lib/theme';

const MIN_CATEGORIES = 3;

export default function OnboardingCategoriesScreen({ navigation }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName]             = useState('');
  const [saving, setSaving]         = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  async function fetchCategories() {
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at');
    setCategories(data || []);
    setLoading(false);
  }

  function openModal() {
    setName('');
    setModalVisible(true);
  }

  async function saveCategory() {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter a name for this category.');
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('categories')
      .insert({ name: name.trim(), user_id: user.id });
    setSaving(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setModalVisible(false);
    fetchCategories();
  }

  const remaining  = Math.max(0, MIN_CATEGORIES - categories.length);
  const canContinue = categories.length >= MIN_CATEGORIES;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.stepLabel}>Step 1 of 3</Text>
        <Text style={styles.title}>Create your categories</Text>
        <Text style={styles.subtitle}>
          Categories are the buckets your tasks live in — like "Music", "Fitness", or "Work".
          You need at least {MIN_CATEGORIES} to get started.
        </Text>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
        ) : (
          <>
            {categories.length > 0 && (
              <View style={styles.categoryList}>
                {categories.map((cat, index) => (
                  <View
                    key={cat.id}
                    style={[
                      styles.catRow,
                      index < categories.length - 1 && styles.catRowBorder,
                    ]}
                  >
                    <View style={styles.dot} />
                    <Text style={styles.catName}>{cat.name}</Text>
                  </View>
                ))}
              </View>
            )}

            {remaining > 0 && (
              <Text style={styles.remainingText}>
                {remaining} more {remaining === 1 ? 'category' : 'categories'} needed to continue
              </Text>
            )}

            <TouchableOpacity style={styles.addBtn} onPress={openModal}>
              <Text style={styles.addBtnText}>+ Add Category</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.continueBtn, !canContinue && styles.continueBtnDisabled]}
          onPress={() => navigation.navigate('OnboardingSchedule')}
          disabled={!canContinue}
        >
          <Text style={[styles.continueBtnText, !canContinue && styles.continueBtnTextDisabled]}>
            Continue →
          </Text>
        </TouchableOpacity>
      </View>

      {/* Add Category Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New Category</Text>

            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Music, Fitness, Work"
              placeholderTextColor={colors.muted}
              value={name}
              onChangeText={setName}
              autoFocus
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={saveCategory}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.saveText}>Add</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

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
  subtitle: { fontSize: 15, fontFamily: fonts.regular, color: colors.muted, lineHeight: 23, marginBottom: 32 },
  categoryList: {
    backgroundColor: colors.card,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 10,
  },
  catRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  dot:     { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  catName: { flex: 1, fontSize: 15, fontFamily: fonts.semiBold, color: colors.text },
  remainingText: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.muted,
    textAlign: 'center',
    marginBottom: 14,
  },
  addBtn: {
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  addBtnText: { color: colors.primary, fontFamily: fonts.bold, fontSize: 15 },
  footer: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 20,
    paddingBottom: 36,
  },
  continueBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  continueBtnDisabled:     { backgroundColor: colors.border },
  continueBtnText:         { color: '#fff', fontFamily: fonts.bold, fontSize: 16 },
  continueBtnTextDisabled: { color: colors.muted },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 44,
  },
  modalTitle: { fontSize: 20, fontFamily: fonts.bold, color: colors.text, marginBottom: 20 },
  label:      { fontSize: 13, fontFamily: fonts.semiBold, color: colors.text, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    fontFamily: fonts.regular,
    color: colors.text,
    marginBottom: 24,
    backgroundColor: colors.background,
  },
  modalActions: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  cancelText: { color: colors.muted, fontFamily: fonts.semiBold, fontSize: 15 },
  saveBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  saveText: { color: '#fff', fontFamily: fonts.bold, fontSize: 15 },
});
