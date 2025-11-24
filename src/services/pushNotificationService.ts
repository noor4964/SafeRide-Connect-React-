import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { collection, doc, setDoc, deleteDoc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { firestore } from '@/config/firebaseConfig';
import type { PushToken } from '@/types/notifications';

/**
 * PUSH NOTIFICATION SERVICE
 * 
 * Handles device token registration, push notification permissions,
 * and sending push notifications via Expo Push Service
 */

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ==================== REGISTER FOR PUSH NOTIFICATIONS ====================

export const registerForPushNotifications = async (
  userId: string
): Promise<string | null> => {
  try {
    // Check if device is physical (push notifications don't work on emulators)
    if (!Device.isDevice) {
      console.log('⚠️ Push notifications only work on physical devices');
      return null;
    }

    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permissions if not granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('❌ Push notification permissions denied');
      return null;
    }

    // Get push notification token
    // Note: Push notifications are NOT supported in Expo Go (SDK 53+)
    // You need a development build or standalone app
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync();
      const token = tokenData.data;

      console.log('✅ Push token obtained:', token);

      // Save token to Firestore
      await savePushToken(userId, token);

      return token;
    } catch (tokenError: any) {
      // Handle Expo Go limitation gracefully
      if (tokenError.message?.includes('Expo Go') || tokenError.message?.includes('projectId')) {
        console.log('ℹ️ Push notifications are not available in Expo Go (SDK 53+)');
        console.log('ℹ️ In-app notifications will work, but push notifications require a development build');
        console.log('ℹ️ Learn more: https://docs.expo.dev/develop/development-builds/introduction/');
        return null;
      }
      throw tokenError;
    }
  } catch (error) {
    console.error('Error registering for push notifications:', error);
    return null;
  }
};

// ==================== SAVE TOKEN TO FIRESTORE ====================

export const savePushToken = async (
  userId: string,
  token: string
): Promise<void> => {
  if (!firestore) {
    throw new Error('Firestore not initialized');
  }

  try {
    const platform = Platform.OS as 'ios' | 'android' | 'web';
    const deviceId = Device.modelName || 'unknown';

    const tokenData: Omit<PushToken, 'createdAt' | 'updatedAt'> & {
      createdAt: any;
      updatedAt: any;
    } = {
      userId,
      token,
      platform,
      deviceId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // Use token as document ID to avoid duplicates
    const tokenRef = doc(firestore, 'pushTokens', token);
    await setDoc(tokenRef, tokenData);

    console.log('✅ Push token saved to Firestore');
  } catch (error) {
    console.error('Error saving push token:', error);
    throw error;
  }
};

// ==================== DELETE TOKEN ====================

export const deletePushToken = async (token: string): Promise<void> => {
  if (!firestore) {
    throw new Error('Firestore not initialized');
  }

  try {
    const tokenRef = doc(firestore, 'pushTokens', token);
    await deleteDoc(tokenRef);
    console.log('✅ Push token deleted from Firestore');
  } catch (error) {
    console.error('Error deleting push token:', error);
    throw error;
  }
};

// ==================== GET USER TOKENS ====================

export const getUserPushTokens = async (
  userId: string
): Promise<string[]> => {
  if (!firestore) {
    throw new Error('Firestore not initialized');
  }

  try {
    const q = query(
      collection(firestore, 'pushTokens'),
      where('userId', '==', userId)
    );

    const snapshot = await getDocs(q);
    const tokens: string[] = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      tokens.push(data.token);
    });

    return tokens;
  } catch (error) {
    console.error('Error fetching user push tokens:', error);
    return [];
  }
};

// ==================== GET TOKENS FOR MULTIPLE USERS ====================

export const getTokensForUsers = async (
  userIds: string[]
): Promise<string[]> => {
  if (!firestore || userIds.length === 0) {
    return [];
  }

  try {
    // Firestore 'in' queries limited to 10 items, so batch them
    const batchSize = 10;
    const batches: string[][] = [];
    
    for (let i = 0; i < userIds.length; i += batchSize) {
      batches.push(userIds.slice(i, i + batchSize));
    }

    const allTokens: string[] = [];

    for (const batch of batches) {
      const q = query(
        collection(firestore, 'pushTokens'),
        where('userId', 'in', batch)
      );

      const snapshot = await getDocs(q);
      snapshot.forEach(doc => {
        const data = doc.data();
        allTokens.push(data.token);
      });
    }

    return allTokens;
  } catch (error) {
    console.error('Error fetching tokens for users:', error);
    return [];
  }
};

// ==================== SEND PUSH NOTIFICATION ====================

interface PushNotificationData {
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: string;
  badge?: number;
  priority?: 'default' | 'normal' | 'high';
}

export const sendPushNotification = async (
  tokens: string[],
  notification: PushNotificationData
): Promise<void> => {
  if (tokens.length === 0) {
    console.log('⚠️ No tokens to send push notification to');
    return;
  }

  try {
    const messages = tokens.map(token => ({
      to: token,
      sound: notification.sound || 'default',
      title: notification.title,
      body: notification.body,
      data: notification.data || {},
      badge: notification.badge,
      priority: notification.priority || 'high',
    }));

    // Send via Expo Push API
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json();
    
    if (result.errors) {
      console.error('❌ Push notification errors:', result.errors);
    } else {
      console.log('✅ Push notifications sent:', result.data);
    }
  } catch (error) {
    console.error('Error sending push notification:', error);
    throw error;
  }
};

// ==================== SEND TO USERS ====================

export const sendPushNotificationToUsers = async (
  userIds: string[],
  notification: PushNotificationData
): Promise<void> => {
  try {
    const tokens = await getTokensForUsers(userIds);
    
    if (tokens.length === 0) {
      console.log('⚠️ No push tokens found for users');
      return;
    }

    await sendPushNotification(tokens, notification);
  } catch (error) {
    console.error('Error sending push notification to users:', error);
    throw error;
  }
};

// ==================== NOTIFICATION LISTENERS ====================

export type NotificationListener = (
  notification: Notifications.Notification
) => void;

export type NotificationResponseListener = (
  response: Notifications.NotificationResponse
) => void;

export const addNotificationReceivedListener = (
  listener: NotificationListener
): Notifications.Subscription => {
  return Notifications.addNotificationReceivedListener(listener);
};

export const addNotificationResponseReceivedListener = (
  listener: NotificationResponseListener
): Notifications.Subscription => {
  return Notifications.addNotificationResponseReceivedListener(listener);
};

// ==================== SCHEDULED NOTIFICATIONS ====================

export const scheduleLocalNotification = async (
  title: string,
  body: string,
  trigger: Notifications.NotificationTriggerInput,
  data?: Record<string, any>
): Promise<string> => {
  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: 'default',
      },
      trigger,
    });

    console.log('✅ Local notification scheduled:', notificationId);
    return notificationId;
  } catch (error) {
    console.error('Error scheduling local notification:', error);
    throw error;
  }
};

export const cancelScheduledNotification = async (
  notificationId: string
): Promise<void> => {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    console.log('✅ Scheduled notification cancelled:', notificationId);
  } catch (error) {
    console.error('Error cancelling scheduled notification:', error);
    throw error;
  }
};

export const cancelAllScheduledNotifications = async (): Promise<void> => {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('✅ All scheduled notifications cancelled');
  } catch (error) {
    console.error('Error cancelling all scheduled notifications:', error);
    throw error;
  }
};

// ==================== HELPER: SCHEDULE RIDE REMINDER ====================

export const scheduleRideReminder = async (
  matchId: string,
  departureTime: Date,
  minutesBefore: number = 15
): Promise<string | null> => {
  try {
    const reminderTime = new Date(departureTime.getTime() - minutesBefore * 60000);
    const now = new Date();

    if (reminderTime <= now) {
      console.log('⚠️ Reminder time is in the past, skipping');
      return null;
    }

    const notificationId = await scheduleLocalNotification(
      '🚗 Ride Starting Soon',
      `Your ride departs in ${minutesBefore} minutes. Get ready!`,
      { type: 'date', date: reminderTime } as Notifications.DateTriggerInput,
      { matchId, type: 'ride_reminder' }
    );

    return notificationId;
  } catch (error) {
    console.error('Error scheduling ride reminder:', error);
    return null;
  }
};

// ==================== BADGE MANAGEMENT ====================

export const setBadgeCount = async (count: number): Promise<void> => {
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch (error) {
    console.error('Error setting badge count:', error);
  }
};

export const getBadgeCount = async (): Promise<number> => {
  try {
    return await Notifications.getBadgeCountAsync();
  } catch (error) {
    console.error('Error getting badge count:', error);
    return 0;
  }
};

export const clearBadge = async (): Promise<void> => {
  try {
    await Notifications.setBadgeCountAsync(0);
  } catch (error) {
    console.error('Error clearing badge:', error);
  }
};
