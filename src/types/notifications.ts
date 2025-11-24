import { z } from 'zod';

/**
 * NOTIFICATION SYSTEM TYPES
 * 
 * Handles in-app notifications for ride matches, chat messages,
 * ride updates, and safety alerts
 */

// Notification types
export type NotificationType = 
  | 'match_found'           // New ride match found
  | 'match_confirmed'       // All participants confirmed the match
  | 'match_cancelled'       // Someone cancelled the match
  | 'chat_message'          // New message in group chat
  | 'ride_starting'         // Ride departure time approaching
  | 'ride_completed'        // Ride marked as completed
  | 'payment_reminder'      // Reminder to settle payment
  | 'verification_approved' // Student verification approved
  | 'safety_alert'          // Emergency or safety notification
  | 'system_announcement';  // General system announcements

// Notification priority levels
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

// Notification schema
export const NotificationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  
  // Notification details
  type: z.enum([
    'match_found',
    'match_confirmed',
    'match_cancelled',
    'chat_message',
    'ride_starting',
    'ride_completed',
    'payment_reminder',
    'verification_approved',
    'safety_alert',
    'system_announcement',
  ]),
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
  
  // Content
  title: z.string(),
  body: z.string(),
  
  // Related data (optional based on type)
  data: z.object({
    matchId: z.string().optional(),
    requestId: z.string().optional(),
    chatMessageId: z.string().optional(),
    senderId: z.string().optional(),
    senderName: z.string().optional(),
    alertId: z.string().optional(),
  }).optional(),
  
  // Status
  isRead: z.boolean().default(false),
  isDeleted: z.boolean().default(false),
  
  // Timestamps
  createdAt: z.date(),
  readAt: z.date().optional(),
});

export type NotificationData = z.infer<typeof NotificationSchema>;

// Push notification token schema
export const PushTokenSchema = z.object({
  userId: z.string(),
  token: z.string(),
  platform: z.enum(['ios', 'android', 'web']),
  deviceId: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type PushToken = z.infer<typeof PushTokenSchema>;

// Notification preferences schema
export const NotificationPreferencesSchema = z.object({
  userId: z.string(),
  
  // Enable/disable by type
  matchNotifications: z.boolean().default(true),
  chatNotifications: z.boolean().default(true),
  rideUpdates: z.boolean().default(true),
  safetyAlerts: z.boolean().default(true),
  systemAnnouncements: z.boolean().default(true),
  
  // Delivery methods
  pushEnabled: z.boolean().default(true),
  emailEnabled: z.boolean().default(false),
  
  // Quiet hours
  quietHoursEnabled: z.boolean().default(false),
  quietHoursStart: z.string().optional(), // "22:00"
  quietHoursEnd: z.string().optional(),   // "08:00"
  
  updatedAt: z.date(),
});

export type NotificationPreferences = z.infer<typeof NotificationPreferencesSchema>;

// Notification action types (for navigation after tap)
export type NotificationAction = {
  type: 'navigate';
  screen: string;
  params?: Record<string, any>;
} | {
  type: 'dismiss';
};
