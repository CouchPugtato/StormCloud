import { Platform } from 'react-native';

export const getApiBaseURL = () => {
  const envBase = typeof process !== 'undefined' && process.env && process.env.EXPO_PUBLIC_API_BASE_URL;
  if (envBase && envBase.trim() !== '') {
    return envBase.trim();
  }
  // Default for web: use relative path so same-origin deployments work
  if (Platform.OS === 'web') {
    return '/api';
  }
  // Default for native/dev
  return 'http://localhost:8090/api/v1';
};

export default { getApiBaseURL };