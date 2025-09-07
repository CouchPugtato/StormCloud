import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useMessaging } from '../contexts/MessagingContext';
import { useRealtimeMessaging } from '../hooks/useRealtimeMessaging';
import ChannelDropdown from '../components/ChannelDropdown';
import MessageList from '../components/MessageList';
import MessageInput from '../components/MessageInput';
import NotificationSettings from '../components/NotificationSettings';

export default function CommsScreen({ navigation }) {
  const { theme, isDarkMode } = useTheme();
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  
  useRealtimeMessaging(true);

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <StatusBar style={theme.colors.statusBar} />
      
      {/* Header */}
      <LinearGradient
        colors={isDarkMode ? [theme.colors.primary, '#FF6B6B'] : ['#2196F3', '#1976D2']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Communications</Text>
          </View>
          
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={() => setShowNotificationSettings(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </LinearGradient>
      
      {/* Channel Dropdown */}
      <ChannelDropdown />
      
      {/* Messages */}
      <MessageList />
      
      {/* Message Input */}
      <MessageInput />
      
      {/* Notification Settings Modal */}
      <NotificationSettings
        visible={showNotificationSettings}
        onClose={() => setShowNotificationSettings(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 2,
  },

  notificationButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
});