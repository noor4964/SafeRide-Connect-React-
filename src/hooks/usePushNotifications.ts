import { useEffect, useState, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '@/types';
import {
  registerForPushNotifications,
  deletePushToken,
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener,
  setBadgeCount,
  clearBadge,
} from '@/services/pushNotificationService';

/**
 * PUSH NOTIFICATION HOOK
 * 
 * Manages push notification registration, listeners, and navigation
 * Use in App.tsx or main layout component
 */

type NavigationProp = BottomTabNavigationProp<MainTabParamList>;

interface UsePushNotificationsOptions {
  userId?: string;
  unreadCount?: number;
}

export const usePushNotifications = (options: UsePushNotificationsOptions) => {
  const { userId, unreadCount = 0 } = options;
  const navigation = useNavigation<NavigationProp>();
  
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);

  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  // Register for push notifications on mount
  useEffect(() => {
    if (!userId) return;

    const register = async () => {
      try {
        const token = await registerForPushNotifications(userId);
        
        if (token) {
          setExpoPushToken(token);
          setIsRegistered(true);
          console.log('✅ Push notifications registered');
        } else {
          setError('Push notifications not available in Expo Go');
          console.log('ℹ️ Push notifications disabled (Expo Go limitation)');
          console.log('ℹ️ In-app notifications will continue to work normally');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        console.error('❌ Push notification registration failed:', err);
      }
    };

    register();

    // Cleanup: Remove token on unmount
    return () => {
      if (expoPushToken && userId) {
        deletePushToken(expoPushToken).catch(err =>
          console.error('Error deleting push token:', err)
        );
      }
    };
  }, [userId]);

  // Setup notification listeners
  useEffect(() => {
    // Listener for notifications received while app is in foreground
    notificationListener.current = addNotificationReceivedListener(notification => {
      console.log('📩 Notification received:', notification);
      
      // Update badge count
      if (Platform.OS === 'ios') {
        setBadgeCount(unreadCount + 1);
      }
    });

    // Listener for user tapping on notification
    responseListener.current = addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      console.log('👆 Notification tapped:', data);

      // Navigate based on notification data
      handleNotificationNavigation(data);
    });

    // Cleanup listeners
    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [unreadCount, navigation]);

  // Update badge count when unread count changes
  useEffect(() => {
    if (Platform.OS === 'ios') {
      setBadgeCount(unreadCount);
    }
  }, [unreadCount]);

  // Handle navigation based on notification data
  const handleNotificationNavigation = (data: Record<string, any>) => {
    try {
      // Match Details
      if (data.matchId) {
        navigation.navigate('MatchDetails', { matchId: data.matchId });
        return;
      }

      // Find Matches
      if (data.requestId) {
        navigation.navigate('FindMatches', { requestId: data.requestId });
        return;
      }

      // Default to Notifications screen
      navigation.navigate('Notifications');
    } catch (err) {
      console.error('Error navigating from notification:', err);
    }
  };

  // Clear all notifications and badge
  const clearAllNotifications = async () => {
    try {
      await Notifications.dismissAllNotificationsAsync();
      await clearBadge();
      console.log('✅ All notifications cleared');
    } catch (err) {
      console.error('Error clearing notifications:', err);
    }
  };

  return {
    expoPushToken,
    isRegistered,
    error,
    clearAllNotifications,
  };
};

// ==================== GET LAST NOTIFICATION DATA ====================

export const getLastNotificationResponse = async (): Promise<Record<string, any> | null> => {
  try {
    const response = await Notifications.getLastNotificationResponseAsync();
    return response?.notification.request.content.data || null;
  } catch (error) {
    console.error('Error getting last notification:', error);
    return null;
  }
};
