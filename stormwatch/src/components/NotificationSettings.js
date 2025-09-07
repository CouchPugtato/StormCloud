import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useMessaging } from '../contexts/MessagingContext';

export default function NotificationSettings({ visible, onClose }) {
  const { theme } = useTheme();
  const {
    channels,
    notificationSettings,
    toggleNotifications,
  } = useMessaging();

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <View style={[styles.modal, { backgroundColor: theme.colors.surface }]}>
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Notification Settings
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
            Choose which channels you want to receive push notifications from.
          </Text>

          {channels.map((channel) => {
            const isEnabled = notificationSettings[channel.id];
            
            return (
              <View
                key={channel.id}
                style={[
                  styles.channelRow,
                  { borderBottomColor: theme.colors.border },
                ]}
              >
                <View style={styles.channelInfo}>
                  <View style={styles.channelHeader}>
                    <Text style={styles.channelIcon}>{channel.icon}</Text>
                    <Text style={[styles.channelName, { color: theme.colors.text }]}>
                      {channel.name}
                    </Text>
                  </View>
                  <Text style={[styles.channelDescription, { color: theme.colors.textSecondary }]}>
                    {channel.description}
                  </Text>
                </View>
                
                <Switch
                  value={isEnabled}
                  onValueChange={() => toggleNotifications(channel.id)}
                  trackColor={{
                    false: theme.colors.border,
                    true: channel.color,
                  }}
                  thumbColor={isEnabled ? 'white' : theme.colors.textSecondary}
                  ios_backgroundColor={theme.colors.border}
                />
              </View>
            );
          })}

          <View style={[styles.infoSection, { backgroundColor: theme.colors.background }]}>
            <Ionicons
              name="information-circle-outline"
              size={20}
              color={theme.colors.primary}
              style={styles.infoIcon}
            />
            <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
              Push notifications require permission from your device settings. 
              Make sure notifications are enabled for StormWatch in your device settings.
            </Text>
          </View>

          <View style={[styles.infoSection, { backgroundColor: theme.colors.background }]}>
            <Ionicons
              name="time-outline"
              size={20}
              color={theme.colors.primary}
              style={styles.infoIcon}
            />
            <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
              Notifications are sent in real-time when team members post messages. 
              You can always check messages manually even with notifications disabled.
            </Text>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modal: {
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  channelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  channelInfo: {
    flex: 1,
    marginRight: 16,
  },
  channelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  channelIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  channelName: {
    fontSize: 16,
    fontWeight: '600',
  },
  channelDescription: {
    fontSize: 14,
    lineHeight: 18,
  },
  infoSection: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  infoIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});