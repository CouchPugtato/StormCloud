import { Platform } from 'react-native';

const normalizeEnv = (value) => {
  const normalized = (value || '').trim().toLowerCase();
  return normalized === 'production' ? 'production' : 'development';
};

const isLocalWebHost = () => {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.location) {
    return false;
  }

  const hostname = (window.location.hostname || '').trim().toLowerCase();
  return hostname === 'localhost' || hostname === '127.0.0.1';
};

export const getAppEnv = () => {
  const envValue = typeof process !== 'undefined' && process.env && process.env.EXPO_PUBLIC_APP_ENV;
  const normalizedEnv = normalizeEnv(envValue);

  if (Platform.OS === 'web' && !isLocalWebHost()) {
    return 'production';
  }

  return normalizedEnv;
};

export const getApiBaseURL = () => {
  const envBase = typeof process !== 'undefined' && process.env && process.env.EXPO_PUBLIC_API_BASE_URL;
  if (envBase && envBase.trim() !== '') {
    return envBase.trim();
  }

  const appEnv = getAppEnv();
  const env = typeof process !== 'undefined' && process.env ? process.env : {};

  if (appEnv === 'production') {
    if (Platform.OS === 'web') {
      return '/api';
    }
    if (env.EXPO_PUBLIC_PROD_API_BASE_URL && env.EXPO_PUBLIC_PROD_API_BASE_URL.trim() !== '') {
      return env.EXPO_PUBLIC_PROD_API_BASE_URL.trim();
    }
    return 'https://redstormcloud.com/api';
  }

  if (env.EXPO_PUBLIC_DEV_API_BASE_URL && env.EXPO_PUBLIC_DEV_API_BASE_URL.trim() !== '') {
    return env.EXPO_PUBLIC_DEV_API_BASE_URL.trim();
  }
  return 'http://localhost:8080/api';
};

export default { getApiBaseURL, getAppEnv };
