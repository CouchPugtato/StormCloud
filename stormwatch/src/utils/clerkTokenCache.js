import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY_PREFIX = 'stormwatch_clerk_token_';

export const clerkTokenCache = {
  async getToken(key) {
    try {
      return await SecureStore.getItemAsync(`${TOKEN_KEY_PREFIX}${key}`);
    } catch (error) {
      console.error('Failed to read auth token from secure store:', error);
      return null;
    }
  },
  async saveToken(key, value) {
    try {
      await SecureStore.setItemAsync(`${TOKEN_KEY_PREFIX}${key}`, value);
    } catch (error) {
      console.error('Failed to save auth token to secure store:', error);
    }
  },
};
