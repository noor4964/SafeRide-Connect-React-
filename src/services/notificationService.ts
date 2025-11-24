import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  serverTimestamp,
  onSnapshot,
  Timestamp,
  QuerySnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { firestore } from '@/config/firebaseConfig';
import type { 
  NotificationData, 
  NotificationType, 
  NotificationPriority,
  NotificationPreferences,
  PushToken,
} from '@/types/notifications';
import { sendPushNotificationToUsers } from '@/services/pushNotificationService';

/**
 * NOTIFICATION SERVICE
 * 
 * Handles creating, fetching, and managing in-app notifications
 * Uses Firestore for storage and real-time updates
 */

// ==================== CREATE NOTIFICATION ====================

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  priority?: NotificationPriority;
  data?: {
    matchId?: string;
    requestId?: string;
    chatMessageId?: string;
    senderId?: string;
    senderName?: string;
    alertId?: string;
  };
}

export const createNotification = async (
  params: CreateNotificationParams
): Promise<string> => {
  if (!firestore) {
    throw new Error('Firestore not initialized');
  }

  try {
    const notificationData = {
      userId: params.userId,
      type: params.type,
      priority: params.priority || 'normal',
      title: params.title,
      body: params.body,
      data: params.data || {},
      isRead: false,
      isDeleted: false,
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(
      collection(firestore, 'notifications'),
      notificationData
    );

    console.log('✅ Notification created:', docRef.id);

    // Send push notification (don't await, don't block)
    sendPushNotificationToUsers([params.userId], {
      title: params.title,
      body: params.body,
      data: { notificationId: docRef.id, ...params.data },
      priority: params.priority === 'urgent' ? 'high' : 'default',
    }).catch(err => console.error('Push notification failed:', err));

    return docRef.id;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

// ==================== BULK CREATE NOTIFICATIONS ====================

export const createNotificationsForUsers = async (
  userIds: string[],
  params: Omit<CreateNotificationParams, 'userId'>
): Promise<string[]> => {
  if (!firestore) {
    throw new Error('Firestore not initialized');
  }

  try {
    const notificationIds: string[] = [];

    // Create notification for each user
    for (const userId of userIds) {
      const notificationId = await createNotification({
        ...params,
        userId,
      });
      notificationIds.push(notificationId);
    }

    console.log(`✅ Created ${notificationIds.length} notifications`);
    return notificationIds;
  } catch (error) {
    console.error('Error creating bulk notifications:', error);
    throw error;
  }
};

// ==================== GET USER NOTIFICATIONS ====================

export const getUserNotifications = async (
  userId: string,
  limitCount: number = 50
): Promise<NotificationData[]> => {
  if (!firestore) {
    throw new Error('Firestore not initialized');
  }

  try {
    const q = query(
      collection(firestore, 'notifications'),
      where('userId', '==', userId),
      where('isDeleted', '==', false),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    
    const notifications: NotificationData[] = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(),
        readAt: (data.readAt as Timestamp)?.toDate(),
      } as NotificationData;
    });

    return notifications;
  } catch (error) {
    console.error('Error fetching notifications:', error);
    throw error;
  }
};

// ==================== GET UNREAD COUNT ====================

export const getUnreadNotificationCount = async (
  userId: string
): Promise<number> => {
  if (!firestore) {
    throw new Error('Firestore not initialized');
  }

  try {
    const q = query(
      collection(firestore, 'notifications'),
      where('userId', '==', userId),
      where('isRead', '==', false),
      where('isDeleted', '==', false)
    );

    const snapshot = await getDocs(q);
    return snapshot.size;
  } catch (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }
};

// ==================== MARK AS READ ====================

export const markNotificationAsRead = async (
  notificationId: string
): Promise<void> => {
  if (!firestore) {
    throw new Error('Firestore not initialized');
  }

  try {
    const notificationRef = doc(firestore, 'notifications', notificationId);
    await updateDoc(notificationRef, {
      isRead: true,
      readAt: serverTimestamp(),
    });

    console.log('✅ Notification marked as read:', notificationId);
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
};

// ==================== MARK ALL AS READ ====================

export const markAllNotificationsAsRead = async (
  userId: string
): Promise<void> => {
  if (!firestore) {
    throw new Error('Firestore not initialized');
  }

  try {
    const q = query(
      collection(firestore, 'notifications'),
      where('userId', '==', userId),
      where('isRead', '==', false)
    );

    const snapshot = await getDocs(q);
    
    const updatePromises = snapshot.docs.map(doc =>
      updateDoc(doc.ref, {
        isRead: true,
        readAt: serverTimestamp(),
      })
    );

    await Promise.all(updatePromises);
    console.log(`✅ Marked ${snapshot.size} notifications as read`);
  } catch (error) {
    console.error('Error marking all as read:', error);
    throw error;
  }
};

// ==================== DELETE NOTIFICATION ====================

export const deleteNotification = async (
  notificationId: string
): Promise<void> => {
  if (!firestore) {
    throw new Error('Firestore not initialized');
  }

  try {
    const notificationRef = doc(firestore, 'notifications', notificationId);
    await updateDoc(notificationRef, {
      isDeleted: true,
    });

    console.log('✅ Notification deleted:', notificationId);
  } catch (error) {
    console.error('Error deleting notification:', error);
    throw error;
  }
};

// ==================== REAL-TIME LISTENER ====================

export const subscribeToUserNotifications = (
  userId: string,
  callback: (notifications: NotificationData[]) => void
): Unsubscribe => {
  if (!firestore) {
    throw new Error('Firestore not initialized');
  }

  try {
    const q = query(
      collection(firestore, 'notifications'),
      where('userId', '==', userId),
      where('isDeleted', '==', false),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot: QuerySnapshot) => {
        const notifications: NotificationData[] = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(),
            readAt: (data.readAt as Timestamp)?.toDate(),
          } as NotificationData;
        });

        callback(notifications);
      },
      (error) => {
        console.error('Error in notification listener:', error);
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error('Error setting up notification listener:', error);
    throw error;
  }
};

// ==================== NOTIFICATION PREFERENCES ====================

export const getUserNotificationPreferences = async (
  userId: string
): Promise<NotificationPreferences | null> => {
  if (!firestore) {
    throw new Error('Firestore not initialized');
  }

  try {
    const docRef = doc(firestore, 'notificationPreferences', userId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data();
    return {
      ...data,
      updatedAt: (data.updatedAt as Timestamp)?.toDate() || new Date(),
    } as NotificationPreferences;
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    return null;
  }
};

export const updateNotificationPreferences = async (
  userId: string,
  preferences: Partial<NotificationPreferences>
): Promise<void> => {
  if (!firestore) {
    throw new Error('Firestore not initialized');
  }

  try {
    const docRef = doc(firestore, 'notificationPreferences', userId);
    await updateDoc(docRef, {
      ...preferences,
      updatedAt: serverTimestamp(),
    });

    console.log('✅ Notification preferences updated');
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    throw error;
  }
};

// ==================== HELPER: CREATE MATCH NOTIFICATION ====================

export const notifyMatchFound = async (
  userIds: string[],
  matchId: string,
  participantNames: string[]
): Promise<void> => {
  const participantList = participantNames.slice(0, 3).join(', ');
  const others = participantNames.length > 3 ? ` +${participantNames.length - 3} others` : '';

  await createNotificationsForUsers(userIds, {
    type: 'match_found',
    title: '🎉 Ride Match Found!',
    body: `You've been matched with ${participantList}${others} for your ride.`,
    priority: 'high',
    data: { matchId },
  });
};

export const notifyMatchConfirmed = async (
  userIds: string[],
  matchId: string
): Promise<void> => {
  await createNotificationsForUsers(userIds, {
    type: 'match_confirmed',
    title: '✅ Match Confirmed!',
    body: 'All participants have confirmed. Time to coordinate your ride!',
    priority: 'high',
    data: { matchId },
  });
};

export const notifyMatchCancelled = async (
  userIds: string[],
  matchId: string,
  cancelledBy: string
): Promise<void> => {
  await createNotificationsForUsers(userIds, {
    type: 'match_cancelled',
    title: '❌ Match Cancelled',
    body: `${cancelledBy} cancelled the ride match.`,
    priority: 'normal',
    data: { matchId },
  });
};

// ==================== HELPER: CREATE CHAT NOTIFICATION ====================

export const notifyNewChatMessage = async (
  recipientIds: string[],
  senderId: string,
  senderName: string,
  matchId: string,
  messagePreview: string
): Promise<void> => {
  // Don't notify the sender
  const recipients = recipientIds.filter(id => id !== senderId);

  if (recipients.length === 0) return;

  await createNotificationsForUsers(recipients, {
    type: 'chat_message',
    title: `💬 ${senderName}`,
    body: messagePreview.length > 50 
      ? `${messagePreview.substring(0, 50)}...` 
      : messagePreview,
    priority: 'normal',
    data: { matchId, senderId, senderName },
  });
};

// ==================== HELPER: RIDE REMINDERS ====================

export const notifyRideStarting = async (
  userIds: string[],
  matchId: string,
  minutesUntilDeparture: number
): Promise<void> => {
  await createNotificationsForUsers(userIds, {
    type: 'ride_starting',
    title: '🚗 Ride Starting Soon',
    body: `Your ride departs in ${minutesUntilDeparture} minutes. Get ready!`,
    priority: 'high',
    data: { matchId },
  });
};

export const notifySafetyAlert = async (
  userId: string,
  alertMessage: string,
  alertId?: string
): Promise<void> => {
  await createNotification({
    userId,
    type: 'safety_alert',
    title: '🚨 Safety Alert',
    body: alertMessage,
    priority: 'urgent',
    data: { alertId },
  });
};

// Alias for backward compatibility with safetyService
export const sendNotification = async (
  userId: string,
  notification: { title: string; body: string; data?: Record<string, any> }
): Promise<void> => {
  await createNotification({
    userId,
    type: 'safety_alert',
    title: notification.title,
    body: notification.body,
    priority: 'high',
    data: notification.data,
  });
};
