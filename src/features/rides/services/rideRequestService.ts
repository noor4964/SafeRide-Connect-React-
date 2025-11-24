import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  increment,
} from 'firebase/firestore';
import { firestore } from '@/config/firebaseConfig';
import { RideRequest, RideRequestSchema, RequestStatus } from '@/types';
import { getUserProfile } from '@/features/auth/services/userService';

// Create a ride request
export const createRideRequest = async (data: {
  rideId: string;
  passengerId: string;
  seatsRequested: number;
  message?: string;
}): Promise<string> => {
  if (!firestore) {
    throw new Error('Firebase not configured');
  }

  try {
    const requestRef = doc(collection(firestore, 'rideRequests'));
    
    await setDoc(requestRef, {
      rideId: data.rideId,
      passengerId: data.passengerId,
      message: data.message || '',
      seatsRequested: data.seatsRequested,
      status: 'pending' as RequestStatus,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return requestRef.id;
  } catch (error) {
    console.error('Error creating ride request:', error);
    throw error;
  }
};

// Get ride requests for a specific ride (driver view)
export const getRideRequests = async (rideId: string): Promise<RideRequest[]> => {
  if (!firestore) {
    return [];
  }

  try {
    const requestsQuery = query(
      collection(firestore, 'rideRequests'),
      where('rideId', '==', rideId),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(requestsQuery);
    const requests: RideRequest[] = [];

    for (const doc of querySnapshot.docs) {
      const data = doc.data();
      
      // Fetch passenger details
      const passenger = await getUserProfile(data.passengerId);

      requests.push({
        id: doc.id,
        rideId: data.rideId,
        passengerId: data.passengerId,
        passenger,
        message: data.message,
        seatsRequested: data.seatsRequested,
        status: data.status,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      });
    }

    return requests;
  } catch (error) {
    console.error('Error fetching ride requests:', error);
    return [];
  }
};

// Get user's ride requests (passenger view)
export const getUserRideRequests = async (userId: string): Promise<RideRequest[]> => {
  if (!firestore) {
    return [];
  }

  try {
    const requestsQuery = query(
      collection(firestore, 'rideRequests'),
      where('passengerId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(requestsQuery);
    const requests: RideRequest[] = [];

    for (const doc of querySnapshot.docs) {
      const data = doc.data();

      requests.push({
        id: doc.id,
        rideId: data.rideId,
        passengerId: data.passengerId,
        message: data.message,
        seatsRequested: data.seatsRequested,
        status: data.status,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      });
    }

    return requests;
  } catch (error) {
    console.error('Error fetching user ride requests:', error);
    return [];
  }
};

// Accept a ride request
export const acceptRideRequest = async (
  requestId: string,
  rideId: string,
  passengerId: string,
  seatsRequested: number
): Promise<void> => {
  if (!firestore) {
    throw new Error('Firebase not configured');
  }

  try {
    const requestRef = doc(firestore, 'rideRequests', requestId);
    const rideRef = doc(firestore, 'rides', rideId);

    // Get current ride data
    const rideSnap = await getDoc(rideRef);
    if (!rideSnap.exists()) {
      throw new Error('Ride not found');
    }

    const rideData = rideSnap.data();
    
    // Check if enough seats are available
    if (rideData.availableSeats < seatsRequested) {
      throw new Error('Not enough seats available');
    }

    // Update request status
    await updateDoc(requestRef, {
      status: 'accepted',
      updatedAt: serverTimestamp(),
    });

    // Update ride: decrease available seats and add passenger
    const passengerIds = rideData.passengerIds || [];
    if (!passengerIds.includes(passengerId)) {
      passengerIds.push(passengerId);
    }

    await updateDoc(rideRef, {
      availableSeats: increment(-seatsRequested),
      passengerIds,
      updatedAt: serverTimestamp(),
    });

    // Update passenger's total rides count
    const passengerRef = doc(firestore, 'users', passengerId);
    await updateDoc(passengerRef, {
      totalRides: increment(1),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error accepting ride request:', error);
    throw error;
  }
};

// Reject a ride request
export const rejectRideRequest = async (requestId: string): Promise<void> => {
  if (!firestore) {
    throw new Error('Firebase not configured');
  }

  try {
    const requestRef = doc(firestore, 'rideRequests', requestId);

    await updateDoc(requestRef, {
      status: 'rejected',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error rejecting ride request:', error);
    throw error;
  }
};

// Cancel a ride request (passenger cancels)
export const cancelRideRequest = async (requestId: string): Promise<void> => {
  if (!firestore) {
    throw new Error('Firebase not configured');
  }

  try {
    const requestRef = doc(firestore, 'rideRequests', requestId);

    await updateDoc(requestRef, {
      status: 'cancelled',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error cancelling ride request:', error);
    throw error;
  }
};

// Check if user has already requested a ride
export const hasUserRequestedRide = async (
  rideId: string,
  userId: string
): Promise<boolean> => {
  if (!firestore) {
    return false;
  }

  try {
    const requestsQuery = query(
      collection(firestore, 'rideRequests'),
      where('rideId', '==', rideId),
      where('passengerId', '==', userId)
    );

    const querySnapshot = await getDocs(requestsQuery);
    
    // Check if any request exists that's not cancelled or rejected
    return querySnapshot.docs.some(doc => {
      const status = doc.data().status;
      return status === 'pending' || status === 'accepted';
    });
  } catch (error) {
    console.error('Error checking ride request:', error);
    return false;
  }
};

// Get a specific ride request
export const getRideRequest = async (requestId: string): Promise<RideRequest | null> => {
  if (!firestore) {
    return null;
  }

  try {
    const requestRef = doc(firestore, 'rideRequests', requestId);
    const requestSnap = await getDoc(requestRef);

    if (!requestSnap.exists()) {
      return null;
    }

    const data = requestSnap.data();
    const passenger = await getUserProfile(data.passengerId);

    return {
      id: requestSnap.id,
      rideId: data.rideId,
      passengerId: data.passengerId,
      passenger,
      message: data.message,
      seatsRequested: data.seatsRequested,
      status: data.status,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    };
  } catch (error) {
    console.error('Error fetching ride request:', error);
    return null;
  }
};
