import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Alert, Modal, TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import CategoryCard from '../../components/CategoryCard';
import { colors, fonts } from '../../lib/theme';

export default function GoalBankScreen({ navigation }) {
  const [categories, setCategories]       = useState([]);
  const [loading, setLoading]             = useState(true);
  const [modalVisible, setModalVisible]   = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [name, setName]                   = useState('');
  const [saving, setSaving]               = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchCategories();
    }, [])
  );

  async function fetchCategories() {
    setLoading(true);
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true });
    if (error) Alert.alert('Error', error.message);
    else setCategories(data || []);
    setLoading(false);
  }

  function openAddModal() {
    setEditingCategory(null);
    setName('');
    setModalVisible(true);
  }

  function openEditModal(category) {
    setEditingCategory(category);
    setName(category.name);
    setModalVisible(true);
  }

  async function saveCategory() {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter a category name.');
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (editingCategory) {
      const { error } = await supabase
        .from('categories')
        .update({ name: name.trim() })
        .eq('id', editingCategory.id);
      if (error) Alert.alert('Error', error.message);
    } else {
      const { error } = await supabase
        .from('categories')
        .insert({ name: name.trim(), user_id: user.id });
      if (error) Alert.alert('Error', error.message);
    }
    setSaving(false);
    setModalVisible(false);
    fetchCategories();
  }

  async function deleteCategory(category) {
    Alert.alert(
      'Delete category?',
      `"${category.name}" and all its tasks will be removed. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('categories')
              .delete()
              .eq('id', category.id);
            if (error) Alert.alert('Error', error.message);
            else fetchCategories();
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={categories}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No categories yet</Text>
              <Text style={styles.emptyText}>
                Add a category first — like "Music", "Fitness", or "Work" — then start adding tasks to it.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onLongPress={() =>
                Alert.alert(item.name, 'What would you like to do?', [
                  { text: 'Rename', onPress: () => openEditModal(item) },
                  { text: 'Delete', style: 'destructive', onPress: () => deleteCategory(item) },
                  { text: 'Cancel', style: 'cancel' },
                ])
              }
              onPress={() =>
                navigation.navigate('Category', {
                  categoryId:   item.id,
                  categoryName: item.name,
                })
              }
              activeOpacity={0.7}
            >
              <CategoryCard category={item} />
            </TouchableOpacity>
          )}
        />
      )}

      {/* Bottom actions */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.addTaskBtn}
          onPress={() => navigation.navigate('TaskForm', {})}
        >
          <Text style={styles.addTaskText}>+ Add Task</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.addCategoryLink} onPress={openAddModal}>
          <Text style={styles.addCategoryLinkText}>+ New Category</Text>
        </TouchableOpacity>
      </View>

      {/* Add / Rename Category Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editingCategory ? 'Rename Category' : 'New Category'}
            </Text>

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
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.buttonDisabled]}
                onPress={saveCategory}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.saveText}>Save</Text>
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
  safe:   { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list:   { padding: 16, paddingBottom: 140 },
  empty:  { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontFamily: fonts.bold, color: colors.text, marginBottom: 8 },
  emptyText:  { fontSize: 14, fontFamily: fonts.regular, color: colors.muted, textAlign: 'center', lineHeight: 20 },
  footer: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 28,
    alignItems: 'center',
    gap: 10,
  },
  addTaskBtn: {
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  addTaskText:          { color: '#fff', fontFamily: fonts.bold, fontSize: 16 },
  addCategoryLink:      { paddingVertical: 4 },
  addCategoryLinkText:  { color: colors.muted, fontFamily: fonts.semiBold, fontSize: 14 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
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
  saveText:       { color: '#fff', fontFamily: fonts.bold, fontSize: 15 },
  buttonDisabled: { opacity: 0.6 },
});
