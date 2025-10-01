import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Platform,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useEventMode } from '../contexts/EventModeContext';

export default function SettingsScreen() {
  const { theme, isDarkMode, themePreference, toggleTheme, setSystemTheme } = useTheme();
  const { isEventMode, toggleEventMode } = useEventMode();
  
  const [settings, setSettings] = useState({
    notifications: true,
    autoUpdate: true,
    analytics: false,
    crashReporting: true,
  });

  const toggleSetting = (key) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const showInfo = (title, message) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message, [{ text: 'OK' }]);
    }
  };

  const settingsGroups = [
    {
      title: 'Preferences',
      items: [
        {
          key: 'notifications',
          title: 'Push Notifications',
          subtitle: 'Receive updates and alerts',
          icon: 'notifications',
          type: 'toggle',
          value: settings.notifications,
        },
        {
          key: 'darkMode',
          title: 'Dark Mode',
          subtitle: themePreference === 'system' ? 'Following system preference' : (isDarkMode ? 'Dark theme enabled' : 'Light theme enabled'),
          icon: isDarkMode ? 'moon' : 'sunny',
          type: 'toggle',
          value: isDarkMode,
          onToggle: toggleTheme,
        },
        {
          key: 'systemTheme',
          title: 'Use System Theme',
          subtitle: 'Follow device theme settings',
          icon: 'phone-portrait',
          type: 'toggle',
          value: themePreference === 'system',
          onToggle: () => {
            if (themePreference === 'system') {
              toggleTheme();
            } else {
              setSystemTheme();
            }
          },
        },
        {
          key: 'autoUpdate',
          title: 'Auto Update',
          subtitle: 'Automatically update the app',
          icon: 'refresh-circle',
          type: 'toggle',
          value: settings.autoUpdate,
        },
        {
          key: 'eventMode',
          title: 'Event Mode',
          subtitle: isEventMode ? 'Server updates every 3 minutes' : 'Normal update schedule (every 2 hours)',
          icon: 'flash',
          type: 'toggle',
          value: isEventMode,
          onToggle: toggleEventMode,
        },
      ],
    },
    {
      title: 'Privacy & Data',
      items: [
        {
          key: 'analytics',
          title: 'Analytics',
          subtitle: 'Help improve the app with usage data',
          icon: 'analytics',
          type: 'toggle',
          value: settings.analytics,
        },
        {
          key: 'crashReporting',
          title: 'Crash Reporting',
          subtitle: 'Send crash reports to developers',
          icon: 'bug',
          type: 'toggle',
          value: settings.crashReporting,
        },
      ],
    },
    {
      title: 'About',
      items: [
        {
          key: 'version',
          title: 'App Version',
          subtitle: '1.0.0 (Demo)',
          icon: 'information-circle',
          type: 'info',
          onPress: () => showInfo(
            'App Version',
            'StormWatch v1.0.0\n\nThis is a React Native cross-platform demo application showcasing modern mobile development practices.'
          ),
        },
        {
          key: 'platform',
          title: 'Platform Info',
          subtitle: `Running on ${Platform.OS.charAt(0).toUpperCase() + Platform.OS.slice(1)}`,
          icon: 'phone-portrait',
          type: 'info',
          onPress: () => showInfo(
            'Platform Information',
            `Platform: ${Platform.OS}\nVersion: ${Platform.Version}\n\nThis app runs natively on iOS and Android, and as a web application in browsers.`
          ),
        },
        {
          key: 'help',
          title: 'Help & Support',
          subtitle: 'Get help and contact support',
          icon: 'help-circle',
          type: 'info',
          onPress: () => showInfo(
            'Help & Support',
            'For help with this demo app:\n\n• Check the README file\n• Review the source code\n• Visit the React Native documentation\n\nThis is a demonstration app for educational purposes.'
          ),
        },
        {
          key: 'privacy',
          title: 'Privacy Policy',
          subtitle: 'View our privacy policy',
          icon: 'shield-checkmark',
          type: 'info',
          onPress: () => showInfo(
            'Privacy Policy',
            'This is a demo application.\n\nNo personal data is collected or transmitted. All settings and preferences are stored locally on your device.'
          ),
        },
      ],
    },
  ];

  const renderSettingItem = (item) => {
    const isDisabled = item.disabled;
    
    return (
      <TouchableOpacity
        key={item.key}
        style={[styles.settingItem, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.borderLight }, isDisabled && styles.disabledItem]}
        onPress={item.onPress}
        disabled={item.type === 'toggle' || isDisabled}
        activeOpacity={item.type === 'info' ? 0.7 : 1}
      >
        <View style={styles.settingLeft}>
          <View style={[styles.settingIcon, { backgroundColor: isDarkMode ? theme.colors.border : '#f0f8ff' }, isDisabled && styles.disabledIcon]}>
            <Ionicons 
              name={item.icon} 
              size={22} 
              color={isDisabled ? theme.colors.textSecondary : theme.colors.accent} 
            />
          </View>
          <View style={styles.settingText}>
            <Text style={[styles.settingTitle, { color: theme.colors.text }, isDisabled && styles.disabledText]}>
              {item.title}
            </Text>
            <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }, isDisabled && styles.disabledText]}>
              {item.subtitle}
            </Text>
          </View>
        </View>
        
        <View style={styles.settingRight}>
          {item.type === 'toggle' ? (
            <Switch
              value={item.value}
              onValueChange={() => {
                if (!isDisabled) {
                  if (item.onToggle) {
                    item.onToggle();
                  } else {
                    toggleSetting(item.key);
                  }
                }
              }}
              trackColor={{ false: theme.colors.border, true: theme.colors.accent + '80' }}
              thumbColor={item.value ? theme.colors.accent : theme.colors.textSecondary}
              disabled={isDisabled}
            />
          ) : (
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderSettingsGroup = (group, index) => (
    <View key={index} style={styles.settingsGroup}>
      <Text style={[styles.groupTitle, { color: theme.colors.text }]}>{group.title}</Text>
      <View style={[styles.groupContainer, { backgroundColor: theme.colors.surface, shadowColor: theme.colors.shadow }]}>
        {group.items.map(renderSettingItem)}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar style={theme.colors.statusBar} />
      
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Settings</Text>
        <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
          Customize your StormWatch experience
        </Text>
      </View>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {settingsGroups.map(renderSettingsGroup)}
        
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.colors.textSecondary }]}>
            StormWatch Demo • React Native Cross-Platform
          </Text>
          <Text style={[styles.footerSubtext, { color: theme.colors.textTertiary }]}>
            Showcasing modern mobile development practices
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  settingsGroup: {
    marginBottom: 30,
  },
  groupTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    marginLeft: 4,
  },
  groupContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    elevation: 3,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f8ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  settingRight: {
    marginLeft: 12,
  },
  disabledItem: {
    opacity: 0.6,
  },
  disabledIcon: {
    backgroundColor: '#f5f5f5',
  },
  disabledText: {
    color: '#ccc',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  footerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  footerSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});