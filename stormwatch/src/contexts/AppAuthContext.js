import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoginScreen from '../screens/LoginScreen';

const AppAuthContext = createContext();

export const useAppAuth = () => {
  const context = useContext(AppAuthContext);
  if (!context) {
    throw new Error('useAppAuth must be used within an AppAuthProvider');
  }
  return context;
};

export const AppAuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const authStatus = await AsyncStorage.getItem('appAuthenticated');
      setIsAuthenticated(authStatus === 'true');
    } catch (error) {
      console.error('Error checking app auth status:', error);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async () => {
    try {
      await AsyncStorage.setItem('appAuthenticated', 'true');
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Error setting app auth status:', error);
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('appAuthenticated');
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Error during app logout:', error);
    }
  };

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <LoginScreen onAuthenticated={login} />;
  }

  return (
    <AppAuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AppAuthContext.Provider>
  );
};