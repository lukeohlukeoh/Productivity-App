import React from 'react';
import { View, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors, fonts } from '../lib/theme';

import GoalBankScreen    from '../screens/goalbank/GoalBankScreen';
import CategoryScreen    from '../screens/goalbank/CategoryScreen';
import TaskFormScreen    from '../screens/goalbank/TaskFormScreen';
import TodayScreen       from '../screens/today/TodayScreen';
import EditRoutineScreen from '../screens/today/EditRoutineScreen';
import ScheduleScreen    from '../screens/schedule/ScheduleScreen';

const Tab           = createBottomTabNavigator();
const GoalBankStack = createNativeStackNavigator();
const TodayStack    = createNativeStackNavigator();

function TodayNavigator() {
  return (
    <TodayStack.Navigator
      screenOptions={{
        headerStyle:      { backgroundColor: colors.background },
        headerTintColor:  colors.primary,
        headerTitleStyle: { fontFamily: fonts.bold, fontSize: 17, color: colors.text },
        headerShadowVisible: false,
        headerBackTitle:  'Today',
      }}
    >
      <TodayStack.Screen
        name="TodayHome"
        component={TodayScreen}
        options={{ headerShown: false }}
      />
      <TodayStack.Screen
        name="EditRoutine"
        component={EditRoutineScreen}
        options={{ title: 'My Routine' }}
      />
    </TodayStack.Navigator>
  );
}

function GoalBankNavigator() {
  return (
    <GoalBankStack.Navigator
      screenOptions={{
        headerStyle:      { backgroundColor: colors.card },
        headerTintColor:  colors.text,
        headerTitleStyle: { fontFamily: fonts.bold, fontSize: 17 },
        headerShadowVisible: true,
      }}
    >
      <GoalBankStack.Screen
        name="GoalBankHome"
        component={GoalBankScreen}
        options={{ title: 'Goal Bank' }}
      />
      <GoalBankStack.Screen
        name="Category"
        component={CategoryScreen}
        options={({ route }) => ({ title: route.params?.categoryName || 'Category' })}
      />
      <GoalBankStack.Screen
        name="TaskForm"
        component={TaskFormScreen}
        options={({ route }) => ({ title: route.params?.task ? 'Edit Task' : 'New Task' })}
      />
    </GoalBankStack.Navigator>
  );
}

function TabIcon({ focused }) {
  return (
    <View style={[styles.tabDot, focused && styles.tabDotActive]} />
  );
}

export default function MainTabs() {
  return (
    <Tab.Navigator
      initialRouteName="Today"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor:   colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor:  colors.border,
          borderTopWidth:  1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: fonts.semiBold,
        },
        tabBarIcon: ({ focused }) => <TabIcon focused={focused} />,
      })}
    >
      <Tab.Screen name="Today"    component={TodayNavigator}    />
      <Tab.Screen
        name="GoalBank"
        component={GoalBankNavigator}
        options={{ headerShown: false, tabBarLabel: 'Goal Bank' }}
      />
      <Tab.Screen name="Schedule" component={ScheduleScreen}    />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.muted,
    opacity: 0.35,
  },
  tabDotActive: {
    backgroundColor: colors.primary,
    opacity: 1,
  },
});
