import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from './apiService';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const NATIVE_PUSH_TOKEN_KEY = 'stormwatch_native_push_token';

function base64UrlToUint8Array(base64UrlString) {
  const padding = '='.repeat((4 - (base64UrlString.length % 4)) % 4);
  const base64 = (base64UrlString + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export async function registerForPushNotifications(userId = 'anonymous') {
  if (Platform.OS === 'web') {
    return registerWebPush(userId);
  }
  return registerNativePush(userId);
}

export async function unregisterWebPush(userId = 'anonymous') {
  if (Platform.OS !== 'web') return { ok: true, skipped: true };
  if (!('serviceWorker' in navigator)) return { ok: false, error: 'serviceWorker unsupported' };

  const registration = await navigator.serviceWorker.getRegistration('/service-worker.js');
  if (!registration) return { ok: true, skipped: true };

  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return { ok: true, skipped: true };

  await apiService.unsubscribeWebPush({
    user_id: userId,
    endpoint: subscription.endpoint,
  });
  await subscription.unsubscribe();
  return { ok: true };
}

export async function unregisterNativePush(userId = 'anonymous') {
  if (Platform.OS === 'web') return { ok: true, skipped: true };
  const token = await AsyncStorage.getItem(NATIVE_PUSH_TOKEN_KEY);
  if (!token) {
    await apiService.unregisterDeviceToken({
      user_id: userId,
      platform: Platform.OS,
    });
    return { ok: true, skipped: true };
  }

  await apiService.unregisterDeviceToken({
    user_id: userId,
    token,
  });
  await AsyncStorage.removeItem(NATIVE_PUSH_TOKEN_KEY);
  return { ok: true };
}

async function registerWebPush(userId) {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { ok: false, error: 'web environment unavailable' };
  }
  if (!('serviceWorker' in navigator)) {
    return { ok: false, error: 'serviceWorker unsupported' };
  }
  if (!('PushManager' in window)) {
    return { ok: false, error: 'PushManager unsupported' };
  }
  if (!('Notification' in window)) {
    return { ok: false, error: 'Notification unsupported' };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { ok: false, error: 'notification permission denied' };
  }

  const registration = await navigator.serviceWorker.register('/service-worker.js');
  const publicKey = await apiService.getPushPublicKey();
  const appServerKey = base64UrlToUint8Array(publicKey.public_key);

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: appServerKey,
    });
  }

  const subscriptionJson = subscription.toJSON();
  await apiService.subscribeWebPush({
    user_id: userId,
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscriptionJson.keys?.p256dh || '',
      auth: subscriptionJson.keys?.auth || '',
    },
    platform: 'web',
  });

  return { ok: true, platform: 'web', endpoint: subscription.endpoint };
}

async function registerNativePush(userId) {
  if (!Device.isDevice) {
    return { ok: false, error: 'push requires physical device' };
  }

  const existing = await Notifications.getPermissionsAsync();
  let finalStatus = existing.status;
  if (finalStatus !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    finalStatus = requested.status;
  }
  if (finalStatus !== 'granted') {
    return { ok: false, error: 'notification permission denied' };
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2196F3',
    });
  }

  const tokenResponse = await Notifications.getExpoPushTokenAsync();
  const token = tokenResponse.data;
  await AsyncStorage.setItem(NATIVE_PUSH_TOKEN_KEY, token);
  await apiService.registerDeviceToken({
    user_id: userId,
    platform: Platform.OS,
    token,
  });

  return { ok: true, platform: Platform.OS, token };
}
