import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  startAt,
  endAt,
} from 'firebase/firestore';
import { firestore } from '@/config/firebaseConfig';
import { Ride, RideSchema, PostRideForm, LocationWithAddress, Location } from '@/types';
import { generateGeohash } from '@/utils/locationUtils';

const RIDES_COLLECTION = 'rides';

export interface CreateRideData extends PostRideForm {
  origin: LocationWithAddress;
  destination: LocationWithAddress;
}

export interface GetRidesParams {
  searchQuery?: string;
  limit?: number;
  driverId?: string;
  status?: string;
}

export const createRide = async (data: CreateRideData, driverId: string): Promise<string> => {
  try {
    // Generate geohashes for both origin and destination
    const originGeohash = generateGeohash(data.origin);
    const destinationGeohash = generateGeohash(data.destination);

    const rideData = {
      driverId,
      title: data.title,
      description: data.description || '',
      origin: {
        ...data.origin,
        geohash: originGeohash,
      },
      destination: {
        ...data.destination,
        geohash: destinationGeohash,
      },
      departureTime: Timestamp.fromDate(data.departureTime),
      availableSeats: data.availableSeats,
      pricePerSeat: data.pricePerSeat,
      status: 'active',
      preferences: {
        smokingAllowed: data.smokingAllowed,
        petsAllowed: data.petsAllowed,
        musicAllowed: data.musicAllowed,
        genderPreference: data.genderPreference,
      },
      safetyFeatures: {
        shareLocationWithContacts: data.shareLocationWithContacts,
        requireVerifiedStudents: data.requireVerifiedStudents,
        enableSOSButton: true, // Always enabled for safety
      },
      passengerIds: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(firestore, RIDES_COLLECTION), rideData);
    return docRef.id;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to create ride');
  }
};

export const getRide = async (rideId: string): Promise<Ride | null> => {
  try {
    const rideDoc = await getDoc(doc(firestore, RIDES_COLLECTION, rideId));
    
    if (!rideDoc.exists()) {
      return null;
    }

    const rideData = rideDoc.data();
    
    // Convert Firestore timestamps to Date objects
    const ride = {
      id: rideDoc.id,
      ...rideData,
      departureTime: rideData.departureTime?.toDate() || new Date(),
      createdAt: rideData.createdAt?.toDate() || new Date(),
      updatedAt: rideData.updatedAt?.toDate() || new Date(),
    };

    return RideSchema.parse(ride);
  } catch (error) {
    console.error('Error fetching ride:', error);
    return null;
  }
};

export const getRides = async (params: GetRidesParams = {}): Promise<Ride[]> => {
  try {
    const {
      searchQuery,
      limit: limitCount = 20,
      driverId,
      status = 'active',
    } = params;

    let rideQuery = query(collection(firestore, RIDES_COLLECTION));

    // Filter by status
    rideQuery = query(rideQuery, where('status', '==', status));

    // Filter by driver if specified
    if (driverId) {
      rideQuery = query(rideQuery, where('driverId', '==', driverId));
    }

    // Filter by search query (searching in title and origin/destination addresses)
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      // Note: Firestore doesn't support full-text search natively
      // In a production app, consider using Algolia or Elasticsearch
      // For now, we'll do a basic search on the client side after fetching
    }

    // Order by departure time (soonest first)
    rideQuery = query(rideQuery, orderBy('departureTime', 'asc'));

    // Apply limit
    rideQuery = query(rideQuery, limit(limitCount));

    const querySnapshot = await getDocs(rideQuery);
    const rides: Ride[] = [];

    querySnapshot.forEach((doc) => {
      try {
        const rideData = doc.data();
        
        // Convert Firestore timestamps to Date objects
        const ride = {
          id: doc.id,
          ...rideData,
          departureTime: rideData.departureTime?.toDate() || new Date(),
          createdAt: rideData.createdAt?.toDate() || new Date(),
          updatedAt: rideData.updatedAt?.toDate() || new Date(),
        } as any;

        // Client-side search filtering if search query provided
        if (searchQuery) {
          const searchLower = searchQuery.toLowerCase();
          const matchesSearch = 
            ride.title?.toLowerCase().includes(searchLower) ||
            ride.origin?.address?.toLowerCase().includes(searchLower) ||
            ride.destination?.address?.toLowerCase().includes(searchLower);
          
          if (!matchesSearch) {
            return; // Skip this ride
          }
        }

        const validatedRide = RideSchema.parse(ride);
        rides.push(validatedRide);
      } catch (error) {
        console.error('Error parsing ride:', error);
      }
    });

    return rides;
  } catch (error) {
    console.error('Error fetching rides:', error);
    return [];
  }
};

export const getRidesNearLocation = async (
  location: Location,
  radiusKm: number = 10,
  limitCount: number = 20
): Promise<Ride[]> => {
  try {
    // Generate geohash bounds for the specified radius
    const centerGeohash = generateGeohash(location);
    // More forgiving precision calculation
    // 5 chars ≈ ±2.4km, 4 chars ≈ ±20km, 6 chars ≈ ±0.6km
    const precision = radiusKm <= 2 ? 6 : radiusKm <= 10 ? 5 : 4;
    const geohashPrefix = centerGeohash.substring(0, precision);
    
    // Query rides where origin geohash starts with the prefix
    const ridesQuery = query(
      collection(firestore, RIDES_COLLECTION),
      where('status', '==', 'active'),
      where('origin.geohash', '>=', geohashPrefix),
      where('origin.geohash', '<=', geohashPrefix + '\uf8ff'),
      orderBy('origin.geohash'),
      orderBy('departureTime', 'asc'),
      limit(limitCount * 2) // Fetch more to account for filtering
    );

    const querySnapshot = await getDocs(ridesQuery);
    const rides: Ride[] = [];

    querySnapshot.forEach((doc) => {
      try {
        const rideData = doc.data();
        
        const ride = {
          id: doc.id,
          ...rideData,
          departureTime: rideData.departureTime?.toDate() || new Date(),
          createdAt: rideData.createdAt?.toDate() || new Date(),
          updatedAt: rideData.updatedAt?.toDate() || new Date(),
        } as any;

        // Additional distance filtering (more precise than geohash)
        const distance = calculateDistance(
          location.latitude,
          location.longitude,
          ride.origin?.latitude || 0,
          ride.origin?.longitude || 0
        );

        if (distance <= radiusKm) {
          const validatedRide = RideSchema.parse(ride);
          rides.push(validatedRide);
        }
      } catch (error) {
        console.error('Error parsing ride:', error);
      }
    });

    return rides.slice(0, limitCount);
  } catch (error) {
    console.error('Error fetching rides near location:', error);
    return [];
  }
};

export const updateRide = async (
  rideId: string,
  updates: Partial<Omit<Ride, 'id' | 'createdAt'>>
): Promise<void> => {
  try {
    const updateData = {
      ...updates,
      updatedAt: serverTimestamp(),
    };

    // Convert Date objects to Firestore Timestamps if present
    if (updates.departureTime) {
      (updateData as any).departureTime = Timestamp.fromDate(updates.departureTime);
    }

    await updateDoc(doc(firestore, RIDES_COLLECTION, rideId), updateData);
  } catch (error: any) {
    throw new Error(error.message || 'Failed to update ride');
  }
};

export const deleteRide = async (rideId: string): Promise<void> => {
  try {
    await deleteDoc(doc(firestore, RIDES_COLLECTION, rideId));
  } catch (error: any) {
    throw new Error(error.message || 'Failed to delete ride');
  }
};

export const cancelRide = async (rideId: string): Promise<void> => {
  try {
    await updateRide(rideId, { status: 'cancelled' });
  } catch (error: any) {
    throw new Error(error.message || 'Failed to cancel ride');
  }
};

export const addPassengerToRide = async (rideId: string, passengerId: string): Promise<void> => {
  try {
    const ride = await getRide(rideId);
    if (!ride) {
      throw new Error('Ride not found');
    }

    if (ride.passengerIds.includes(passengerId)) {
      throw new Error('Passenger already added to this ride');
    }

    if (ride.passengerIds.length >= ride.availableSeats) {
      throw new Error('No available seats');
    }

    const updatedPassengerIds = [...ride.passengerIds, passengerId];
    await updateRide(rideId, { passengerIds: updatedPassengerIds });
  } catch (error: any) {
    throw new Error(error.message || 'Failed to add passenger to ride');
  }
};

export const removePassengerFromRide = async (rideId: string, passengerId: string): Promise<void> => {
  try {
    const ride = await getRide(rideId);
    if (!ride) {
      throw new Error('Ride not found');
    }

    const updatedPassengerIds = ride.passengerIds.filter(id => id !== passengerId);
    await updateRide(rideId, { passengerIds: updatedPassengerIds });
  } catch (error: any) {
    throw new Error(error.message || 'Failed to remove passenger from ride');
  }
};

// Helper function to calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}