import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const EventModeContext = createContext();

export const useEventMode = () => {
  const context = useContext(EventModeContext);
  if (!context) {
    throw new Error('useEventMode must be used within an EventModeProvider');
  }
  return context;
};

export const EventModeProvider = ({ children }) => {
  const [isEventMode, setIsEventMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadEventModeState();
  }, []);

  const loadEventModeState = async () => {
    try {
      try {
        const response = await fetch('http://localhost:8090/api/v1/event-mode');
        if (response.ok) {
          const result = await response.json();
          setIsEventMode(result.event_mode);
          await AsyncStorage.setItem('eventMode', JSON.stringify(result.event_mode));
          console.log('Synced Event Mode state from server:', result.event_mode);
          return;
        }
      } catch (serverError) {
        console.log('Could not sync with server, using local state:', serverError.message);
      }
      
      const savedEventMode = await AsyncStorage.getItem('eventMode');
      if (savedEventMode !== null) {
        setIsEventMode(JSON.parse(savedEventMode));
      }
    } catch (error) {
      console.error('Error loading Event Mode state:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleEventMode = async () => {
    try {
      const newEventMode = !isEventMode;
      
      const response = await fetch('http://localhost:8090/api/v1/event-mode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ event_mode: newEventMode }),
      });
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('Server response:', result.message);
      
      setIsEventMode(newEventMode);
      await AsyncStorage.setItem('eventMode', JSON.stringify(newEventMode));
      
      console.log(`Event Mode ${newEventMode ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error toggling Event Mode:', error);
    }
  };

  const value = {
    isEventMode,
    toggleEventMode,
    isLoading,
  };

  return (
    <EventModeContext.Provider value={value}>
      {children}
    </EventModeContext.Provider>
  );
};