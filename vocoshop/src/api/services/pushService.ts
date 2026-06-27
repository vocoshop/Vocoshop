import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

// Use the same base URL as the main API
import { API_BASE } from "../api";

const pushApi = axios.create({
  baseURL: `${API_BASE}/api`,
  timeout: 15000,
});

pushApi.interceptors.request.use(async (config: any) => {
  const token = await AsyncStorage.getItem("token");
  if (token) config.headers = { ...(config.headers || {}), Authorization: `Bearer ${token}` };
  return config;
});

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldShowAlert: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const PushService = {
  async requestPermissions(): Promise<boolean> {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;

    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  },

  async getPushToken(): Promise<string | null> {
    try {
      const { data: token } = await Notifications.getExpoPushTokenAsync({
        projectId: '919b0a70-eae9-414a-8493-c0197daa9337',
      });
      return token || null;
    } catch (e) {
      console.log('❌ getPushToken error:', e);
      return null;
    }
  },

  async registerToken(token: string): Promise<void> {
    try {
      const authToken = await AsyncStorage.getItem("token");
      if (!authToken) return;
      await pushApi.post('/push/register', { token, platform: Platform.OS });
    } catch (e) {
      console.log('❌ registerToken error:', e);
    }
  },

  async unregisterToken(token: string): Promise<void> {
    try {
      await pushApi.post('/push/unregister', { token });
    } catch (e) {
      console.log('❌ unregisterToken error:', e);
    }
  },

  async setup(): Promise<string | null> {
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) return null;

    const pushToken = await this.getPushToken();
    if (pushToken) {
      await this.registerToken(pushToken);
    }

    return pushToken;
  },

  async cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  },

  async scheduleReminder(title: string, body: string, triggerSeconds: number): Promise<string> {
    const id = await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: triggerSeconds },
    });
    return id;
  },

  async cancelScheduled(id: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(id);
  },
};