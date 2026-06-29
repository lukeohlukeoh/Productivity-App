import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import OnboardingCategoriesScreen from '../screens/onboarding/OnboardingCategoriesScreen';
import OnboardingScheduleScreen from '../screens/onboarding/OnboardingScheduleScreen';
import OnboardingTasksScreen from '../screens/onboarding/OnboardingTasksScreen';
import TaskFormScreen from '../screens/goalbank/TaskFormScreen';
import { colors } from '../lib/theme';

const Stack = createNativeStackNavigator();

export default function OnboardingStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.primary,
        headerTitleStyle: { fontWeight: '700', color: colors.text },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="OnboardingCategories"
        component={OnboardingCategoriesScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="OnboardingSchedule"
        component={OnboardingScheduleScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="OnboardingTasks"
        component={OnboardingTasksScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="OnboardingTaskForm"
        component={TaskFormScreen}
        options={{ title: 'New Task' }}
      />
    </Stack.Navigator>
  );
}
