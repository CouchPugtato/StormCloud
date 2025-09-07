import { useEffect, useRef } from 'react';
import { useMessaging } from '../contexts/MessagingContext';

const MOCK_MESSAGES = {
  drive: [
    {
      userId: 'user_002',
      userName: 'Sarah Chen',
      content: 'Just tested the new autonomous routine - looking good!',
    },
    {
      userId: 'user_003',
      userName: 'Mike Rodriguez',
      content: 'Should we adjust the intake speed?',
    },
    {
      userId: 'user_007',
      userName: 'Jordan Lee',
      content: 'Battery voltage is looking stable during high-power maneuvers',
    },
  ],
  scouting: [
    {
      userId: 'user_004',
      userName: 'Emma Wilson',
      content: 'Team 5678 just scored 3 cargo in autonomous!',
    },
    {
      userId: 'user_005',
      userName: 'David Kim',
      content: 'Their climb mechanism is really impressive',
    },
    {
      userId: 'user_008',
      userName: 'Taylor Smith',
      content: 'Adding notes about their defensive strategy',
    },
  ],
  outreach: [
    {
      userId: 'user_006',
      userName: 'Lisa Park',
      content: 'Great turnout at the STEM demo today!',
    },
    {
      userId: 'user_009',
      userName: 'Chris Johnson',
      content: 'The kids loved the robot demonstration',
    },
    {
      userId: 'user_010',
      userName: 'Sam Wilson',
      content: 'Next outreach event is scheduled for next Friday',
    },
  ],
};

export const useRealtimeMessaging = (enabled = true) => {
  const { sendMessage, channels } = useMessaging();
  const intervalRef = useRef(null);
  const messageIndexRef = useRef({
    drive: 0,
    scouting: 0,
    outreach: 0,
  });

  useEffect(() => {
    if (!enabled) return;

    const simulateMessage = () => {
      const channelIds = channels.map(c => c.id);
      const randomChannelId = channelIds[Math.floor(Math.random() * channelIds.length)];
      
      const availableMessages = MOCK_MESSAGES[randomChannelId];
      const currentIndex = messageIndexRef.current[randomChannelId];
      
      if (currentIndex < availableMessages.length) {
        const messageTemplate = availableMessages[currentIndex];
        
        const newMessage = {
          id: `sim_${Date.now()}_${Math.random()}`,
          userId: messageTemplate.userId,
          userName: messageTemplate.userName,
          content: messageTemplate.content,
          timestamp: new Date(),
          channelId: randomChannelId,
        };
        messageIndexRef.current[randomChannelId] = currentIndex + 1;
        
        setTimeout(() => {
          // this would come from a server
          console.log(`Simulated message in ${randomChannelId}:`, newMessage.content);
        }, 100);
      }
    };

    const startSimulation = () => {
      const randomDelay = 10000 + Math.random() * 20000; // 10-30 seconds
      intervalRef.current = setTimeout(() => {
        simulateMessage();
        startSimulation();
      }, randomDelay);
    };

    const initialDelay = setTimeout(() => {
      startSimulation();
    }, 5000);

    return () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
      }
      clearTimeout(initialDelay);
    };
  }, [enabled, channels]);

  const resetSimulation = () => {
    messageIndexRef.current = {
      drive: 0,
      scouting: 0,
      outreach: 0,
    };
  };

  return {
    resetSimulation,
  };
};