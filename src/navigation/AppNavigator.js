import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { OnboardingContext } from '../context/OnboardingContext';
import AuthStack from './AuthStack';
import MainTabs from './MainTabs';
import OnboardingStack from './OnboardingStack';
import { colors, fonts } from '../lib/theme';

export default function AppNavigator() {
  const { session, loading: authLoading } = useAuth();
  const [onboardingComplete, setOnboardingComplete] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    if (session) {
      checkProfile();
    } else {
      setOnboardingComplete(null);
    }
  }, [session]);

  async function checkProfile() {
    setProfileLoading(true);
    const userId = session.user.id;

    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarding_complete')
      .eq('id', userId)
      .single();

    if (!profile) {
      await supabase
        .from('profiles')
        .insert({ id: userId, onboarding_complete: false });
      setOnboardingComplete(false);
    } else {
      setOnboardingComplete(profile.onboarding_complete);
    }

    setProfileLoading(false);
  }

  async function completeOnboarding() {
    const userId = session.user.id;
    await supabase
      .from('profiles')
      .update({ onboarding_complete: true })
      .eq('id', userId);
    setOnboardingComplete(true);
  }

  const isLoading = authLoading || profileLoading || (session && onboardingComplete === null);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!session) return <AuthStack />;

  if (!onboardingComplete) {
    return (
      <OnboardingContext.Provider value={{ completeOnboarding }}>
        <OnboardingStack />
      </OnboardingContext.Provider>
    );
  }

  return <MainTabs />;
}
