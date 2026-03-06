import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ClerkProvider } from '@clerk/clerk-expo';
import AppNavigator from './src/navigation/AppNavigator';
import { ThemeProvider } from './src/contexts/ThemeContext';
import { AuthProvider } from './src/contexts/AuthContext';
import { MessagingProvider } from './src/contexts/MessagingContext';
import { EventModeProvider } from './src/contexts/EventModeContext';
import { AppAuthProvider } from './src/contexts/AppAuthContext';
import { clerkTokenCache } from './src/utils/clerkTokenCache';

export default function App() {
  const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!clerkPublishableKey) {
    throw new Error('Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY');
  }

  return (
    <ClerkProvider publishableKey={clerkPublishableKey} tokenCache={Platform.OS === 'web' ? undefined : clerkTokenCache}>
      <AppAuthProvider>
        <AuthProvider>
          <ThemeProvider>
            <EventModeProvider>
              <MessagingProvider>
                <SafeAreaProvider>
                  <AppNavigator />
                  <StatusBar hidden={true} />
                </SafeAreaProvider>
              </MessagingProvider>
            </EventModeProvider>
          </ThemeProvider>
        </AuthProvider>
      </AppAuthProvider>
    </ClerkProvider>
  );
}
