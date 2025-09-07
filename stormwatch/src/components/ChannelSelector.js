import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useMessaging } from '../contexts/MessagingContext';

export default function ChannelSelector() {
  const { theme } = useTheme();
  const {
    channels,
    activeChannel,
    setActiveChannel,
    notificationSettings,
    toggleNotifications,
    getChannelMessages,
  } = useMessaging();

  const getUnreadCount = (channelId) => {
    const messages = getChannelMessages(channelId);
    // for demo purposes, show unread count for non-active channels
    if (channelId === activeChannel) return 0;
    return Math.floor(Math.random() * 3); // mock unread count
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {channels.map((channel) => {
          const isActive = channel.id === activeChannel;
          const unreadCount = getUnreadCount(channel.id);
          const hasNotifications = notificationSettings[channel.id];

          return (
            <TouchableOpacity
              key={channel.id}
              style={[
                styles.channelItem,
                {
                  backgroundColor: isActive ? channel.color : theme.colors.background,
                  borderColor: isActive ? channel.color : theme.colors.border,
                },
              ]}
              onPress={() => setActiveChannel(channel.id)}
              activeOpacity={0.7}
            >
              <View style={styles.channelHeader}>
                <Text style={styles.channelIcon}>{channel.icon}</Text>
                {unreadCount > 0 && (
                  <View style={[styles.unreadBadge, { backgroundColor: '#FF4444' }]}>
                    <Text style={styles.unreadText}>{unreadCount}</Text>
                  </View>
                )}
              </View>
              
              <Text
                style={[
                  styles.channelName,
                  {
                    color: isActive ? 'white' : theme.colors.text,
                  },
                ]}
                numberOfLines={1}
              >
                {channel.name}
              </Text>
              
              <Text
                style={[
                  styles.channelDescription,
                  {
                    color: isActive ? 'rgba(255,255,255,0.8)' : theme.colors.textSecondary,
                  },
                ]}
                numberOfLines={2}
              >
                {channel.description}
              </Text>

              <TouchableOpacity
                style={styles.notificationToggle}
                onPress={() => toggleNotifications(channel.id)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.notificationIcon}>
                  {hasNotifications ? '🔔' : '🔕'}
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  channelItem: {
    width: 140,
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    position: 'relative',
  },
  channelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  channelIcon: {
    fontSize: 24,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  channelName: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  channelDescription: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 8,
  },
  notificationToggle: {
    position: 'absolute',
    bottom: 8,
    right: 8,
  },
  notificationIcon: {
    fontSize: 16,
  },
});