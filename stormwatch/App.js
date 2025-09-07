import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { ThemeProvider } from './src/contexts/ThemeContext';
import { AuthProvider } from './src/contexts/AuthContext';
import { MessagingProvider } from './src/contexts/MessagingContext';

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <MessagingProvider>
          <SafeAreaProvider>
            <AppNavigator />
            <StatusBar hidden={true} />
          </SafeAreaProvider>
        </MessagingProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
