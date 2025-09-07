import React, { createContext, useContext, useState, useEffect } from 'react';

const MessagingContext = createContext();

export const useMessaging = () => {
  const context = useContext(MessagingContext);
  if (!context) {
    throw new Error('useMessaging must be used within a MessagingProvider');
  }
  return context;
};

export const MessagingProvider = ({ children }) => {
  const [currentUser] = useState({
    id: 'user_001',
    name: 'Alex Johnson',
    avatar: null,
  });

  const [channels] = useState([
    {
      id: 'drive',
      name: 'Drive Team',
      description: 'Drive team coordination and strategy',
      color: '#4CAF50',
    },
    {
      id: 'scouting',
      name: 'Scouting',
      description: 'Match analysis and team scouting',
      color: '#2196F3',
    },
    {
      id: 'outreach',
      name: 'Outreach',
      description: 'Community engagement and events',
      color: '#FF9800',
    },
  ]);

  const [activeChannel, setActiveChannel] = useState('drive');
  const [messages, setMessages] = useState({
    drive: [
      {
        id: 'msg_001',
        userId: 'user_002',
        userName: 'Sarah Chen',
        content: 'Ready for autonomous practice at 3 PM?',
        timestamp: new Date(Date.now() - 3600000),
        channelId: 'drive',
      },
      {
        id: 'msg_002',
        userId: 'user_003',
        userName: 'Mike Rodriguez',
        content: 'Yes! Just finished tuning the PID controllers.',
        timestamp: new Date(Date.now() - 3300000),
        channelId: 'drive',
      },
      {
        id: 'msg_003',
        userId: 'user_001',
        userName: 'Alex Johnson',
        content: 'Great! I\'ll bring the field elements.',
        timestamp: new Date(Date.now() - 3000000),
        channelId: 'drive',
      },
    ],
    scouting: [
      {
        id: 'msg_004',
        userId: 'user_004',
        userName: 'Emma Wilson',
        content: 'Team 1234 has a really strong autonomous routine',
        timestamp: new Date(Date.now() - 7200000),
        channelId: 'scouting',
      },
      {
        id: 'msg_005',
        userId: 'user_005',
        userName: 'David Kim',
        content: 'Noted! What\'s their cycle time?',
        timestamp: new Date(Date.now() - 6900000),
        channelId: 'scouting',
      },
    ],
    outreach: [
      {
        id: 'msg_006',
        userId: 'user_006',
        userName: 'Lisa Park',
        content: 'Don\'t forget about the STEM fair next week!',
        timestamp: new Date(Date.now() - 10800000),
        channelId: 'outreach',
      },
    ],
  });

  const [notificationSettings, setNotificationSettings] = useState({
    drive: true,
    scouting: true,
    outreach: false,
  });

  const sendMessage = (content, channelId = activeChannel) => {
    const newMessage = {
      id: `msg_${Date.now()}`,
      userId: currentUser.id,
      userName: currentUser.name,
      content,
      timestamp: new Date(),
      channelId,
    };

    setMessages(prev => ({
      ...prev,
      [channelId]: [...(prev[channelId] || []), newMessage],
    }));
  };

  const toggleNotifications = (channelId) => {
    setNotificationSettings(prev => ({
      ...prev,
      [channelId]: !prev[channelId],
    }));
  };

  const getChannelMessages = (channelId) => {
    return messages[channelId] || [];
  };

  const getActiveChannelData = () => {
    return channels.find(channel => channel.id === activeChannel);
  };

  const value = {
    currentUser,
    channels,
    activeChannel,
    setActiveChannel,
    messages,
    notificationSettings,
    sendMessage,
    toggleNotifications,
    getChannelMessages,
    getActiveChannelData,
  };

  return (
    <MessagingContext.Provider value={value}>
      {children}
    </MessagingContext.Provider>
  );
};