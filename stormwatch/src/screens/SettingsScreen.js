import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Platform,
  Alert,
  TextInput,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useEventMode } from '../contexts/EventModeContext';
import { useAuth } from '../contexts/AuthContext';
import { getApiBaseURL } from '../utils/config';
import { registerForPushNotifications, unregisterNativePush, unregisterWebPush } from '../utils/pushNotifications';
import apiService from '../utils/apiService';

export default function SettingsScreen() {
  const { theme, isDarkMode, themePreference, toggleTheme, setSystemTheme } = useTheme();
  const { isEventMode, toggleEventMode } = useEventMode();
  const { user } = useAuth();
  
  const [settings, setSettings] = useState({
    notifications: false,
  });
  const [pushBusy, setPushBusy] = useState(false);
  const [pushStatusText, setPushStatusText] = useState('Push notifications are enabled for this device.');

  const [twitchUrl, setTwitchUrl] = useState('');
  const [isEditingTwitch, setIsEditingTwitch] = useState(false);

  useEffect(() => {
    fetchTwitchUrl();
  }, []);

  const fetchTwitchUrl = async () => {
    try {
      const response = await fetch(`${getApiBaseURL()}/app-settings`);
      const data = await response.json();
      setTwitchUrl(data.twitch_channel_url || '');
    } catch (error) {
      console.error('Error fetching Twitch URL:', error);
    }
  };

  const toggleSetting = (key) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const getPushUserID = () => {
    return user?.id || 'anonymous';
  };

  const togglePushNotifications = async () => {
    if (pushBusy) {
      return;
    }
    const nextEnabled = !settings.notifications;
    setPushBusy(true);
    try {
      if (nextEnabled) {
        const result = await registerForPushNotifications(getPushUserID());
        if (!result.ok) {
          showInfo('Push Notifications', result.error || 'Unable to enable push notifications.');
          return;
        }
        setPushStatusText('Push notifications are enabled for this device.');
      } else {
        if (Platform.OS === 'web') {
          await unregisterWebPush(getPushUserID());
        } else {
          await unregisterNativePush(getPushUserID());
        }
        setPushStatusText('Push notifications are disabled for this browser/device session.');
      }
      setSettings(prev => ({ ...prev, notifications: nextEnabled }));
    } catch (error) {
      console.error('Push toggle failed:', error);
      showInfo('Push Notifications', 'Unable to update push notification settings.');
    } finally {
      setPushBusy(false);
    }
  };

  const sendTestNotification = async () => {
    try {
      const payload = {
        user_id: getPushUserID(),
        title: 'StormCloud Test',
        body: 'Push notifications are working.',
        url: '/',
      };
      const result = await apiService.sendTestPush(payload);
      if (result.ok) {
        showInfo('Test Notification', `Sent. Web: ${result.web_sent}, Mobile: ${result.expo_sent}`);
      } else {
        showInfo('Test Notification', `Partially failed. Web error: ${result.web_error || 'none'}, Mobile error: ${result.expo_error || 'none'}`);
      }
    } catch (error) {
      console.error('Failed to send test notification:', error);
      showInfo('Test Notification', 'Failed to send test notification.');
    }
  };

  const showInfo = (title, message) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message, [{ text: 'OK' }]);
    }
  };

  const showTwitchUrlInput = () => {
    if (Platform.OS === 'web') {
      const newUrl = window.prompt('Enter Twitch Channel URL:', twitchUrl);
      if (newUrl !== null) {
        setTwitchUrl(newUrl);
        showInfo('Success', 'Twitch channel URL updated successfully!');
      }
    } else {
      Alert.prompt(
        'Twitch Channel URL',
        'Enter the Twitch channel URL:',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Save',
            onPress: (newUrl) => {
              if (newUrl !== undefined) {
                setTwitchUrl(newUrl);
                showInfo('Success', 'Twitch channel URL updated successfully!');
              }
            },
          },
        ],
        'plain-text',
        twitchUrl
      );
    }
  };

  const settingsGroups = [
    {
      title: 'Preferences',
      items: [
        {
          key: 'notifications',
          title: 'Push Notifications',
          subtitle: pushStatusText,
          icon: 'notifications',
          type: 'toggle',
          value: settings.notifications,
          onToggle: togglePushNotifications,
        },
        {
          key: 'pushTest',
          title: 'Send Test Notification',
          subtitle: 'Send a test to this user on web and mobile tokens',
          icon: 'paper-plane',
          type: 'info',
          onPress: sendTestNotification,
          disabled: pushBusy,
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
  ];

  const renderSettingItem = (item) => {
    const isDisabled = item.disabled;
    const switchTrackOff = theme.colors.border;
    const switchTrackOn = theme.colors.primary;
    const switchThumbOff = isDarkMode ? theme.colors.textSecondary : '#FFFFFF';
    const switchThumbOn = '#FFFFFF';
    
    return (
      <TouchableOpacity
        key={item.key}
        style={[styles.settingItem, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.borderLight }, isDisabled && styles.disabledItem]}
        onPress={item.onPress}
        disabled={item.type === 'toggle' || isDisabled}
        activeOpacity={item.type === 'info' || item.type === 'input' ? 0.7 : 1}
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
              trackColor={{ false: switchTrackOff, true: switchTrackOn }}
              thumbColor={item.value ? switchThumbOn : switchThumbOff}
              ios_backgroundColor={switchTrackOff}
              style={styles.themeSwitch}
              disabled={isDisabled}
            />
          ) : item.type === 'input' ? (
            <Ionicons name="create-outline" size={20} color={theme.colors.textSecondary} />
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
          Customize your StormCloud experience
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
            StormCloud Demo
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
    paddingTop: Platform.OS === 'ios' ? 40 : 20,
    paddingBottom: 30,
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
  themeSwitch: {
    transform: [{ scaleX: 1.05 }, { scaleY: 1.05 }],
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
