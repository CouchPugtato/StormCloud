import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useMessaging } from '../contexts/MessagingContext';

export default function ChannelDropdown() {
  const { theme } = useTheme();
  const {
    channels,
    activeChannel,
    setActiveChannel,
    notificationSettings,
    getChannelMessages,
  } = useMessaging();
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const getUnreadCount = (channelId) => {
    const messages = getChannelMessages(channelId);
    if (channelId === activeChannel) return 0;
    return Math.floor(Math.random() * 3);
  };

  const getTotalNotifications = () => {
    return channels.reduce((total, channel) => {
      return total + getUnreadCount(channel.id);
    }, 0);
  };

  const activeChannelData = channels.find(channel => channel.id === activeChannel);
  const totalNotifications = getTotalNotifications();

  const renderChannelItem = ({ item }) => {
    const isActive = item.id === activeChannel;
    const unreadCount = getUnreadCount(item.id);
    const hasNotifications = notificationSettings[item.id];

    return (
      <TouchableOpacity
        style={[
          styles.dropdownItem,
          {
            backgroundColor: isActive ? item.color : theme.colors.background,
            borderBottomColor: theme.colors.border,
          },
        ]}
        onPress={() => {
          setActiveChannel(item.id);
          setIsDropdownOpen(false);
        }}
        activeOpacity={0.7}
      >
        <View style={styles.channelInfo}>
          <Text style={[
            styles.channelName,
            {
              color: isActive ? 'white' : theme.colors.text,
            },
          ]}>
            {item.name}
          </Text>
          <Text
            style={[
              styles.channelDescription,
              {
                color: isActive ? 'rgba(255,255,255,0.8)' : theme.colors.textSecondary,
              },
            ]}
          >
            {item.description}
          </Text>
        </View>
        
        <View style={styles.channelMeta}>
          {unreadCount > 0 && (
            <View style={[styles.unreadBadge, { backgroundColor: '#FF4444' }]}>
              <Text style={styles.unreadText}>{unreadCount}</Text>
            </View>
          )}
          {hasNotifications && (
            <Ionicons 
              name="notifications" 
              size={16} 
              color={isActive ? 'white' : theme.colors.primary} 
              style={styles.notificationIcon}
            />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <TouchableOpacity
        style={[
          styles.dropdownButton,
          {
            backgroundColor: theme.colors.background,
            borderColor: theme.colors.border,
          },
        ]}
        onPress={() => setIsDropdownOpen(true)}
        activeOpacity={0.7}
      >
        <View style={styles.buttonContent}>
          <Text
            style={[
              styles.selectedChannelName,
              { color: theme.colors.text },
            ]}
          >
            {activeChannelData?.name || 'Select Channel'}
          </Text>
          
          {totalNotifications > 0 && (
            <View style={[styles.totalNotificationsBadge, { backgroundColor: '#FF4444' }]}>
              <Text style={styles.totalNotificationsText}>{totalNotifications}</Text>
            </View>
          )}
        </View>
        
        <Ionicons
          name={isDropdownOpen ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={theme.colors.text}
        />
      </TouchableOpacity>

      <Modal
        visible={isDropdownOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsDropdownOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsDropdownOpen(false)}
        >
          <View style={[styles.dropdownModal, { backgroundColor: theme.colors.surface }]}>
            <FlatList
              data={channels}
              renderItem={renderChannelItem}
              keyExtractor={(item) => item.id}
              style={styles.dropdownList}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectedChannelName: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  totalNotificationsBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  totalNotificationsText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownModal: {
    width: '80%',
    maxHeight: '60%',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  dropdownList: {
    maxHeight: 300,
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  channelInfo: {
    flex: 1,
  },
  channelName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  channelDescription: {
    fontSize: 14,
    lineHeight: 18,
  },
  channelMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  notificationIcon: {
    marginLeft: 4,
  },
});