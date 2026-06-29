import { createContext, useContext } from 'react';

export const OnboardingContext = createContext(null);
export const useOnboarding = () => useContext(OnboardingContext);
