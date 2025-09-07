import React, { createContext, useContext, useState, useEffect } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

const lightTheme = {
  mode: 'light',
  colors: {
    primary: '#2196F3',
    secondary: '#1976D2',
    accent: '#2196F3',
    background: '#f8f9fa',
    surface: '#ffffff',
    text: '#212529',
    textSecondary: '#6c757d',
    textTertiary: '#495057',
    border: '#dee2e6',
    borderLight: '#e9ecef',
    shadow: 'rgba(0, 0, 0, 0.1)',
    headerGradient: ['#2196F3', '#1976D2'],
    searchBackground: '#f8f9fa',
    filterChip: '#f8f9fa',
    filterChipSelected: '#2196F3',
    statusBar: 'dark-content',
  },
};

const darkTheme = {
  mode: 'dark',
  colors: {
    primary: '#ef5350',
    secondary: '#d32f2f',
    accent: '#ef5350',
    background: '#121212',
    surface: '#1e1e1e',
    text: '#ffffff',
    textSecondary: '#b0b0b0',
    textTertiary: '#9e9e9e',
    border: '#333333',
    borderLight: '#2a2a2a',
    shadow: 'rgba(0, 0, 0, 0.3)',
    headerGradient: ['#ef5350', '#d32f2f'],
    searchBackground: '#2a2a2a',
    filterChip: '#2a2a2a',
    filterChipSelected: '#ef5350',
    statusBar: 'light-content',
  },
};

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [themePreference, setThemePreference] = useState('system'); // 'light', 'dark', 'system'

  useEffect(() => {
    loadThemePreference();
  }, []);

  useEffect(() => {
    if (themePreference === 'system') {
      const systemColorScheme = Appearance.getColorScheme();
      setIsDarkMode(systemColorScheme === 'dark');

      const subscription = Appearance.addChangeListener(({ colorScheme }) => {
        setIsDarkMode(colorScheme === 'dark');
      });

      return () => subscription?.remove();
    } else {
      setIsDarkMode(themePreference === 'dark');
    }
  }, [themePreference]);

  const loadThemePreference = async () => {
    try {
      const savedPreference = await AsyncStorage.getItem('themePreference');
      if (savedPreference) {
        setThemePreference(savedPreference);
      }
    } catch (error) {
      console.log('Error loading theme preference:', error);
    }
  };

  const saveThemePreference = async (preference) => {
    try {
      await AsyncStorage.setItem('themePreference', preference);
      setThemePreference(preference);
    } catch (error) {
      console.log('Error saving theme preference:', error);
    }
  };

  const toggleTheme = () => {
    const newPreference = isDarkMode ? 'light' : 'dark';
    saveThemePreference(newPreference);
  };

  const setSystemTheme = () => {
    saveThemePreference('system');
  };

  const theme = isDarkMode ? darkTheme : lightTheme;

  const value = {
    theme,
    isDarkMode,
    themePreference,
    toggleTheme,
    setSystemTheme,
    saveThemePreference,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};