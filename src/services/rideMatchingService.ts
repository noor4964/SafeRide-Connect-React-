import { collection, query, where, getDocs, doc, getDoc, updateDoc, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { firestore as db } from '@/config/firebaseConfig';
import { distanceBetween, geohashQueryBounds } from 'geofire-common';
import type { RideRequestType, RideMatchType, MatchScore, MatchingCriteria } from '@/types/rideMatching';
import { notifyMatchFound } from '@/services/notificationService';

/**
 * RIDE MATCHING SERVICE
 * 
 * Finds compatible ride partners for students going in the same direction
 */

// ==================== CREATE RIDE REQUEST ====================

export const createRideRequest = async (
  userId: string,
  requestData: {
    origin: { latitude: number; longitude: number; address: string; geohash: string };
    destination: { latitude: number; longitude: number; address: string; geohash: string };
    departureTime: Date;
    flexibility: number;
    maxWalkDistance: number;
    lookingForSeats: number;
    maxPricePerSeat: number;
    preferences: {
      genderPreference: 'any' | 'female_only' | 'male_only';
      studentVerifiedOnly: boolean;
      sameDepartmentPreferred: boolean;
    };
  }
): Promise<string> => {
  try {
    const expiresAt = new Date(requestData.departureTime);
    expiresAt.setMinutes(expiresAt.getMinutes() + requestData.flexibility);

    const requestRef = await addDoc(collection(db, 'rideRequests'), {
      userId,
      ...requestData,
      status: 'searching',
      matchedWith: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      expiresAt: Timestamp.fromDate(expiresAt),
    });

    return requestRef.id;
  } catch (error) {
    console.error('Error creating ride request:', error);
    throw new Error('Failed to create ride request');
  }
};

// ==================== FIND POTENTIAL MATCHES ====================

export const findPotentialMatches = async (
  requestId: string,
  criteria: MatchingCriteria = {
    maxOriginDistance: 500, // 500m
    maxDestinationDistance: 1000, // 1km
    maxTimeDifference: 30, // 30 minutes
    minMatchScore: 60, // 60%
  }
): Promise<(MatchScore & { request: RideRequestType })[]> => {
  try {
    // Get the source request
    const requestDoc = await getDoc(doc(db, 'rideRequests', requestId));
    if (!requestDoc.exists()) {
      throw new Error('Ride request not found');
    }

    const sourceRequest = {
      id: requestDoc.id,
      ...requestDoc.data(),
      departureTime: requestDoc.data().departureTime?.toDate(),
    } as RideRequestType;

    // Query for nearby origin requests using geohash
    const originBounds = geohashQueryBounds(
      [sourceRequest.origin.latitude, sourceRequest.origin.longitude],
      criteria.maxOriginDistance
    );

    const potentialMatches: (MatchScore & { request: RideRequestType })[] = [];

    for (const bound of originBounds) {
      const q = query(
        collection(db, 'rideRequests'),
        where('origin.geohash', '>=', bound[0]),
        where('origin.geohash', '<=', bound[1]),
        where('status', '==', 'searching')
      );

      const querySnapshot = await getDocs(q);

      for (const docSnapshot of querySnapshot.docs) {
        // Skip self
        if (docSnapshot.id === requestId) continue;

        const candidateRequest = {
          id: docSnapshot.id,
          ...docSnapshot.data(),
          departureTime: docSnapshot.data().departureTime?.toDate(),
        } as RideRequestType;

        // Fetch user details
        const userDoc = await getDoc(doc(db, 'users', candidateRequest.userId));
        if (userDoc.exists()) {
          candidateRequest.user = {
            firstName: userDoc.data().firstName,
            lastName: userDoc.data().lastName,
            phoneNumber: userDoc.data().phoneNumber,
            department: userDoc.data().department,
            studentId: userDoc.data().studentId,
            isStudentVerified: userDoc.data().isStudentVerified || false,
            profileImageUrl: userDoc.data().profileImageUrl,
            rating: userDoc.data().rating || 0,
          };
        }

        // Calculate match score
        const score = calculateMatchScore(sourceRequest, candidateRequest, criteria);

        if (score.score >= criteria.minMatchScore) {
          potentialMatches.push({
            ...score,
            request: candidateRequest,
          });
        }
      }
    }

    // Sort by score (highest first)
    potentialMatches.sort((a, b) => b.score - a.score);

    return potentialMatches;
  } catch (error) {
    console.error('Error finding matches:', error);
    throw new Error('Failed to find potential matches');
  }
};

// ==================== CALCULATE MATCH SCORE ====================

const calculateMatchScore = (
  source: RideRequestType,
  candidate: RideRequestType,
  criteria: MatchingCriteria
): MatchScore => {
  let score = 0;
  const breakdown = {
    originDistance: 0,
    destinationDistance: 0,
    timeDifference: 0,
    preferencesMatch: false,
    departmentMatch: false,
  };

  // 1. Origin distance (40 points)
  const originDistance = distanceBetween(
    [source.origin.latitude, source.origin.longitude],
    [candidate.origin.latitude, candidate.origin.longitude]
  ) * 1000; // Convert to meters

  breakdown.originDistance = originDistance;

  if (originDistance <= criteria.maxOriginDistance) {
    const originScore = 40 * (1 - originDistance / criteria.maxOriginDistance);
    score += originScore;
  } else {
    return { requestId: candidate.id, score: 0, breakdown }; // Fail fast
  }

  // 2. Destination distance (40 points)
  const destinationDistance = distanceBetween(
    [source.destination.latitude, source.destination.longitude],
    [candidate.destination.latitude, candidate.destination.longitude]
  ) * 1000;

  breakdown.destinationDistance = destinationDistance;

  if (destinationDistance <= criteria.maxDestinationDistance) {
    const destinationScore = 40 * (1 - destinationDistance / criteria.maxDestinationDistance);
    score += destinationScore;
  } else {
    return { requestId: candidate.id, score: 0, breakdown };
  }

  // 3. Time difference (10 points)
  const timeDifference = Math.abs(
    source.departureTime.getTime() - candidate.departureTime.getTime()
  ) / (1000 * 60); // Minutes

  breakdown.timeDifference = timeDifference;

  const maxTime = Math.max(source.flexibility, candidate.flexibility);
  if (timeDifference <= maxTime) {
    const timeScore = 10 * (1 - timeDifference / maxTime);
    score += timeScore;
  }

  // 4. Preferences match (5 points)
  const genderMatch = 
    source.preferences.genderPreference === 'any' ||
    candidate.preferences.genderPreference === 'any' ||
    source.preferences.genderPreference === candidate.preferences.genderPreference;

  breakdown.preferencesMatch = genderMatch;
  if (genderMatch) {
    score += 5;
  }

  // 5. Same department (5 points bonus)
  if (
    source.preferences.sameDepartmentPreferred &&
    candidate.preferences.sameDepartmentPreferred &&
    source.user?.department &&
    candidate.user?.department &&
    source.user.department === candidate.user.department
  ) {
    breakdown.departmentMatch = true;
    score += 5;
  }

  return {
    requestId: candidate.id,
    score: Math.round(score),
    breakdown,
  };
};

// ==================== CREATE MATCH ====================

export const createMatch = async (
  requestIds: string[]
): Promise<string> => {
  try {
    // Fetch all requests
    const requests: RideRequestType[] = [];
    for (const id of requestIds) {
      const requestDoc = await getDoc(doc(db, 'rideRequests', id));
      if (requestDoc.exists()) {
        requests.push({
          id: requestDoc.id,
          ...requestDoc.data(),
          departureTime: requestDoc.data().departureTime?.toDate(),
        } as RideRequestType);
      }
    }

    if (requests.length < 2) {
      throw new Error('At least 2 requests required for a match');
    }

    // Calculate meeting point (centroid of origins)
    const meetingPoint = calculateCentroid(
      requests.map(r => ({ lat: r.origin.latitude, lng: r.origin.longitude }))
    );

    // Calculate drop-off point (centroid of destinations)
    const dropoffPoint = calculateCentroid(
      requests.map(r => ({ lat: r.destination.latitude, lng: r.destination.longitude }))
    );

    // Calculate earliest departure time
    const departureTime = new Date(Math.min(...requests.map(r => r.departureTime.getTime())));

    // Calculate total seats and estimated cost
    const totalSeats = requests.reduce((sum, r) => sum + r.lookingForSeats, 0);
    const estimatedTotalCost = estimateRideCost(meetingPoint, dropoffPoint, totalSeats);
    const costPerPerson = estimatedTotalCost / requests.length;

    // Create participants array
    const participants = requests.map(r => ({
      userId: r.userId,
      firstName: r.user?.firstName || '',
      lastName: r.user?.lastName || '',
      phoneNumber: r.user?.phoneNumber,
      profileImageUrl: r.user?.profileImageUrl,
      pickupLocation: {
        latitude: r.origin.latitude,
        longitude: r.origin.longitude,
        address: r.origin.address,
      },
      dropoffLocation: {
        latitude: r.destination.latitude,
        longitude: r.destination.longitude,
        address: r.destination.address,
      },
      seats: r.lookingForSeats,
      isStudentVerified: r.user?.isStudentVerified || false,
      department: r.user?.department,
    }));

    // Create match document
    const matchRef = await addDoc(collection(db, 'rideMatches'), {
      requestIds,
      participants,
      meetingPoint: {
        latitude: meetingPoint.lat,
        longitude: meetingPoint.lng,
        address: requests[0].origin.address, // Use first request's address for now
      },
      dropoffPoint: {
        latitude: dropoffPoint.lat,
        longitude: dropoffPoint.lng,
        address: requests[0].destination.address,
      },
      departureTime: Timestamp.fromDate(departureTime),
      estimatedTotalCost,
      costPerPerson,
      totalSeats,
      chatRoomId: '', // Will be created separately
      status: 'pending',
      confirmations: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Update all requests to matched status
    for (const requestId of requestIds) {
      await updateDoc(doc(db, 'rideRequests', requestId), {
        status: 'matched',
        matchId: matchRef.id,
        matchedWith: requestIds.filter(id => id !== requestId),
        updatedAt: serverTimestamp(),
      });
    }

    // Send notifications to all participants
    try {
      const userIds = participants.map(p => p.userId);
      const participantNames = participants.map(p => `${p.firstName} ${p.lastName}`);
      await notifyMatchFound(userIds, matchRef.id, participantNames);
    } catch (error) {
      console.error('Error sending match notifications:', error);
      // Don't fail the match creation if notifications fail
    }

    return matchRef.id;
  } catch (error) {
    console.error('Error creating match:', error);
    throw new Error('Failed to create match');
  }
};

// ==================== HELPER FUNCTIONS ====================

const calculateCentroid = (points: { lat: number; lng: number }[]) => {
  const sum = points.reduce(
    (acc, point) => ({
      lat: acc.lat + point.lat,
      lng: acc.lng + point.lng,
    }),
    { lat: 0, lng: 0 }
  );

  return {
    lat: sum.lat / points.length,
    lng: sum.lng / points.length,
  };
};

const estimateRideCost = (
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  seats: number
): number => {
  // Simple distance-based cost estimation
  // In production, integrate with Uber/Pathao API for real estimates
  const distanceKm = distanceBetween(
    [origin.lat, origin.lng],
    [destination.lat, destination.lng]
  );

  // Base fare + per km rate
  const baseFare = 50; // BDT
  const perKmRate = 30; // BDT
  const estimatedCost = baseFare + (distanceKm * perKmRate);

  // Adjust for vehicle type based on seats
  const multiplier = seats <= 3 ? 1 : 1.5; // Larger vehicle for 4+ seats

  return Math.round(estimatedCost * multiplier);
};

// ==================== GET FUNCTIONS ====================

export const getRideRequest = async (requestId: string): Promise<RideRequestType | null> => {
  try {
    const requestDoc = await getDoc(doc(db, 'rideRequests', requestId));
    if (!requestDoc.exists()) return null;

    return {
      id: requestDoc.id,
      ...requestDoc.data(),
      departureTime: requestDoc.data().departureTime?.toDate(),
      createdAt: requestDoc.data().createdAt?.toDate(),
      updatedAt: requestDoc.data().updatedAt?.toDate(),
      expiresAt: requestDoc.data().expiresAt?.toDate(),
    } as RideRequestType;
  } catch (error) {
    console.error('Error getting ride request:', error);
    return null;
  }
};

export const getUserRideRequests = async (userId: string): Promise<RideRequestType[]> => {
  try {
    const q = query(
      collection(db, 'rideRequests'),
      where('userId', '==', userId),
      where('status', 'in', ['searching', 'matched', 'riding'])
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      departureTime: doc.data().departureTime?.toDate(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
      expiresAt: doc.data().expiresAt?.toDate(),
    })) as RideRequestType[];
  } catch (error) {
    console.error('Error getting user requests:', error);
    return [];
  }
};

export const getRideMatch = async (matchId: string): Promise<RideMatchType | null> => {
  try {
    const matchDoc = await getDoc(doc(db, 'rideMatches', matchId));
    if (!matchDoc.exists()) return null;

    return {
      id: matchDoc.id,
      ...matchDoc.data(),
      departureTime: matchDoc.data().departureTime?.toDate(),
      createdAt: matchDoc.data().createdAt?.toDate(),
      updatedAt: matchDoc.data().updatedAt?.toDate(),
    } as RideMatchType;
  } catch (error) {
    console.error('Error getting match:', error);
    return null;
  }
};
