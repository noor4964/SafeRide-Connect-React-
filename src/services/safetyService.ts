import { 
  collection, 
  addDoc, 
  updateDoc,
  doc, 
  serverTimestamp,
  query,
  where,
  getDocs,
  getDoc,
} from 'firebase/firestore';
import { firestore } from '@/config/firebaseConfig';
import { sendNotification } from './notificationService';
import * as SMS from 'expo-sms';
import { Linking } from 'react-native';

export interface EmergencyContact {
  name: string;
  phone: string;
  relationship: string;
}

export interface Location {
  latitude: number;
  longitude: number;
}

export interface SOSAlert {
  id?: string;
  userId: string;
  location: Location;
  timestamp: Date;
  status: 'active' | 'resolved' | 'cancelled';
  type: 'sos' | 'panic' | 'suspicious';
  additionalInfo?: string;
}

// Trigger SOS Alert
export const triggerSOSAlert = async (
  userId: string,
  location: Location,
  additionalInfo?: string
): Promise<string> => {
  if (!firestore) {
    throw new Error('Firebase not configured');
  }

  try {
    // Create SOS alert in Firestore
    const alertData: any = {
      userId,
      location,
      status: 'active',
      type: 'sos',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // Only add additionalInfo if it's provided
    if (additionalInfo) {
      alertData.additionalInfo = additionalInfo;
    }

    const alertRef = await addDoc(collection(firestore, 'sosAlerts'), alertData);

    // Get user profile for emergency contacts
    const userDoc = await getDoc(doc(firestore, 'users', userId));
    const userData = userDoc.data();

    if (userData?.emergencyContacts && userData.emergencyContacts.length > 0) {
      // Send notifications to emergency contacts
      await Promise.all(
        userData.emergencyContacts.map((contact: EmergencyContact) =>
          notifyEmergencyContact(contact, userData, location, alertRef.id)
        )
      );
    }

    console.log('🚨 SOS Alert created:', alertRef.id);
    return alertRef.id;
  } catch (error) {
    console.error('Error triggering SOS alert:', error);
    throw error;
  }
};

// Notify emergency contact
const notifyEmergencyContact = async (
  contact: EmergencyContact,
  userData: any,
  location: Location,
  alertId: string
) => {
  const userName = `${userData.firstName} ${userData.lastName}`;
  const googleMapsLink = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
  
  const message = `🚨 EMERGENCY ALERT!\n\n${userName} has triggered an SOS alert.\n\nLocation: ${googleMapsLink}\n\nTime: ${new Date().toLocaleString()}\n\nThis is an automated emergency alert from UniRide Connect.`;

  try {
    // Check if SMS is available
    const isAvailable = await SMS.isAvailableAsync();
    
    if (isAvailable) {
      // Send SMS (this will open SMS app in development)
      await SMS.sendSMSAsync([contact.phone], message);
    } else {
      // Fallback: Log to console (in production, use SMS gateway API)
      console.log(`📱 SMS to ${contact.name} (${contact.phone}):\n${message}`);
    }

    // Also create in-app notification if contact is a user
    const contactQuery = query(
      collection(firestore, 'users'),
      where('phoneNumber', '==', contact.phone)
    );
    const contactDocs = await getDocs(contactQuery);

    if (!contactDocs.empty) {
      const contactUserId = contactDocs.docs[0].id;
      await sendNotification(contactUserId, {
        title: '🚨 Emergency Alert',
        body: `${userName} needs help! Tap to view location.`,
        data: {
          type: 'sos_alert',
          alertId,
          location: JSON.stringify(location),
        },
      });
    }
  } catch (error) {
    console.error('Error notifying emergency contact:', error);
  }
};

// Send location to emergency contacts
export const sendLocationToEmergencyContacts = async (
  userId: string,
  location: Location
): Promise<void> => {
  if (!firestore) {
    throw new Error('Firebase not configured');
  }

  try {
    // Get user profile
    const userDoc = await getDoc(doc(firestore, 'users', userId));
    const userData = userDoc.data();

    if (!userData?.emergencyContacts || userData.emergencyContacts.length === 0) {
      throw new Error('No emergency contacts found');
    }

    const userName = `${userData.firstName} ${userData.lastName}`;
    const googleMapsLink = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
    
    const message = `📍 Location Update from ${userName}\n\nCurrent location: ${googleMapsLink}\n\nTime: ${new Date().toLocaleString()}\n\nShared via UniRide Connect`;

    // Send to all emergency contacts
    await Promise.all(
      userData.emergencyContacts.map(async (contact: EmergencyContact) => {
        try {
          console.log(`📍 Sharing location with ${contact.name} (${contact.phone})`);
          
          // In production, use SMS gateway API
          // For now, log to console
          console.log(message);

          // Check if contact is a user and send in-app notification
          const contactQuery = query(
            collection(firestore, 'users'),
            where('phoneNumber', '==', contact.phone)
          );
          const contactDocs = await getDocs(contactQuery);

          if (!contactDocs.empty) {
            const contactUserId = contactDocs.docs[0].id;
            await sendNotification(contactUserId, {
              title: '📍 Location Shared',
              body: `${userName} shared their location with you`,
              data: {
                type: 'location_share',
                location: JSON.stringify(location),
              },
            });
          }
        } catch (error) {
          console.error(`Error sharing with ${contact.name}:`, error);
        }
      })
    );
  } catch (error) {
    console.error('Error sending location:', error);
    throw error;
  }
};

// Resolve SOS Alert
export const resolveSOSAlert = async (alertId: string): Promise<void> => {
  if (!firestore) {
    throw new Error('Firebase not configured');
  }

  try {
    await updateDoc(doc(firestore, 'sosAlerts', alertId), {
      status: 'resolved',
      resolvedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    console.log('✅ SOS Alert resolved:', alertId);
  } catch (error) {
    console.error('Error resolving SOS alert:', error);
    throw error;
  }
};

// Cancel SOS Alert
export const cancelSOSAlert = async (alertId: string): Promise<void> => {
  if (!firestore) {
    throw new Error('Firebase not configured');
  }

  try {
    await updateDoc(doc(firestore, 'sosAlerts', alertId), {
      status: 'cancelled',
      cancelledAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    console.log('❌ SOS Alert cancelled:', alertId);
  } catch (error) {
    console.error('Error cancelling SOS alert:', error);
    throw error;
  }
};

// Get active SOS alerts for user
export const getActiveSOSAlerts = async (userId: string): Promise<SOSAlert[]> => {
  if (!firestore) {
    return [];
  }

  try {
    const alertsQuery = query(
      collection(firestore, 'sosAlerts'),
      where('userId', '==', userId),
      where('status', '==', 'active')
    );

    const alertsSnapshot = await getDocs(alertsQuery);
    
    return alertsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: data.userId,
        location: data.location,
        timestamp: data.createdAt?.toDate() || new Date(),
        status: data.status,
        type: data.type,
        additionalInfo: data.additionalInfo,
      };
    });
  } catch (error) {
    console.error('Error getting SOS alerts:', error);
    return [];
  }
};

// Generate ride verification code
export const generateRideVerificationCode = (): string => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

// Store ride verification code
export const storeRideVerificationCode = async (
  rideId: string,
  code: string,
  userId: string
): Promise<void> => {
  if (!firestore) {
    throw new Error('Firebase not configured');
  }

  try {
    await addDoc(collection(firestore, 'rideVerifications'), {
      rideId,
      code,
      userId,
      verified: false,
      createdAt: serverTimestamp(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
    });

    console.log(`🔑 Verification code generated for ride ${rideId}: ${code}`);
  } catch (error) {
    console.error('Error storing verification code:', error);
    throw error;
  }
};

// Verify ride code
export const verifyRideCode = async (
  rideId: string,
  code: string
): Promise<boolean> => {
  if (!firestore) {
    throw new Error('Firebase not configured');
  }

  try {
    const verificationQuery = query(
      collection(firestore, 'rideVerifications'),
      where('rideId', '==', rideId),
      where('code', '==', code),
      where('verified', '==', false)
    );

    const verificationDocs = await getDocs(verificationQuery);

    if (verificationDocs.empty) {
      return false;
    }

    const verificationDoc = verificationDocs.docs[0];
    const data = verificationDoc.data();

    // Check if expired
    const expiresAt = data.expiresAt.toDate();
    if (new Date() > expiresAt) {
      return false;
    }

    // Mark as verified
    await updateDoc(doc(firestore, 'rideVerifications', verificationDoc.id), {
      verified: true,
      verifiedAt: serverTimestamp(),
    });

    console.log(`✅ Ride code verified for ${rideId}`);
    return true;
  } catch (error) {
    console.error('Error verifying ride code:', error);
    return false;
  }
};

// Call emergency number
export const callEmergency = async (number: string): Promise<void> => {
  try {
    const url = `tel:${number}`;
    const canOpen = await Linking.canOpenURL(url);
    
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      throw new Error('Cannot make phone calls on this device');
    }
  } catch (error) {
    console.error('Error calling emergency number:', error);
    throw error;
  }
};
