import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useMessaging } from '../contexts/MessagingContext';

export default function MessageInput() {
  const { theme } = useTheme();
  const { sendMessage, activeChannel } = useMessaging();
  const [message, setMessage] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const handleSend = () => {
    const trimmedMessage = message.trim();
    if (trimmedMessage.length > 0) {
      sendMessage(trimmedMessage, activeChannel);
      setMessage('');
      Keyboard.dismiss();
    }
  };

  const handleSubmitEditing = () => {
    handleSend();
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
        },
      ]}
    >
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: theme.colors.background,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <TextInput
          style={[
            styles.textInput,
            {
              color: theme.colors.text,
            },
          ]}
          value={message}
          onChangeText={setMessage}
          placeholder="Type a message..."
          placeholderTextColor={theme.colors.textSecondary}
          multiline
          maxLength={500}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onSubmitEditing={handleSubmitEditing}
          blurOnSubmit={false}
          returnKeyType="send"
          enablesReturnKeyAutomatically
          selectionColor={theme.colors.primary}
        />
        
        <TouchableOpacity
          style={[
            styles.sendButton,
            {
              backgroundColor:
                message.trim().length > 0
                  ? theme.colors.primary
                  : theme.colors.textSecondary,
            },
          ]}
          onPress={handleSend}
          disabled={message.trim().length === 0}
          activeOpacity={0.7}
        >
          <Ionicons
            name="send"
            size={20}
            color="white"
          />
        </TouchableOpacity>
      </View>
      
      {message.length > 400 && (
        <View style={styles.characterCount}>
          <Text
            style={[
              styles.characterCountText,
              {
                color:
                  message.length > 450
                    ? '#FF4444'
                    : theme.colors.textSecondary,
              },
            ]}
          >
            {message.length}/500
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    ...Platform.select({
      ios: {
        paddingBottom: 34, // account for home indicator on iOS
      },
      android: {
        paddingBottom: 12,
      },
    }),
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 48,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    lineHeight: 20,
    maxHeight: 100,
    paddingVertical: 8,
    paddingRight: 12,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  characterCount: {
    alignItems: 'flex-end',
    marginTop: 4,
  },
  characterCountText: {
    fontSize: 12,
  },
});