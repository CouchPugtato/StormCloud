import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useMessaging } from '../contexts/MessagingContext';

const { width } = Dimensions.get('window');

export default function MessageList() {
  const { theme } = useTheme();
  const { currentUser, activeChannel, getChannelMessages } = useMessaging();
  const flatListRef = useRef(null);
  
  const messages = getChannelMessages(activeChannel);

  useEffect(() => {
    // auto scroll to bottom when new messages arrive
    if (messages.length > 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const formatTime = (timestamp) => {
    const now = new Date();
    const messageTime = new Date(timestamp);
    const diffInHours = (now - messageTime) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      const minutes = Math.floor((now - messageTime) / (1000 * 60));
      return minutes < 1 ? 'Just now' : `${minutes}m ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      return messageTime.toLocaleDateString();
    }
  };

  const renderMessage = ({ item, index }) => {
    const isCurrentUser = item.userId === currentUser.id;
    const prevMessage = index > 0 ? messages[index - 1] : null;
    const showUserInfo = !prevMessage || prevMessage.userId !== item.userId;

    return (
      <View style={styles.messageContainer}>
        <View
          style={[
            styles.messageBubble,
            {
              backgroundColor: isCurrentUser
                ? theme.colors.primary
                : theme.colors.surface,
              alignSelf: isCurrentUser ? 'flex-end' : 'flex-start',
              borderColor: theme.colors.border,
            },
          ]}
        >
          {showUserInfo && !isCurrentUser && (
            <Text style={[styles.userName, { color: theme.colors.primary }]}>
              {item.userName}
            </Text>
          )}
          
          <Text
            style={[
              styles.messageText,
              {
                color: isCurrentUser ? 'white' : theme.colors.text,
              },
            ]}
          >
            {item.content}
          </Text>
          
          <Text
            style={[
              styles.timestamp,
              {
                color: isCurrentUser
                  ? 'rgba(255,255,255,0.7)'
                  : theme.colors.textSecondary,
                alignSelf: isCurrentUser ? 'flex-end' : 'flex-start',
              },
            ]}
          >
            {formatTime(item.timestamp)}
          </Text>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>💬</Text>
      <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
        No messages yet
      </Text>
      <Text style={[styles.emptySubtext, { color: theme.colors.textSecondary }]}>
        Start the conversation!
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          messages.length === 0 && styles.emptyListContent,
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmptyState}
        onContentSizeChange={() => {
          if (messages.length > 0) {
            flatListRef.current?.scrollToEnd({ animated: false });
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  emptyListContent: {
    flex: 1,
    justifyContent: 'center',
  },
  messageContainer: {
    marginVertical: 4,
  },
  messageBubble: {
    maxWidth: width * 0.75,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  userName: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
    marginBottom: 4,
  },
  timestamp: {
    fontSize: 11,
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
  },
});