import { collection, query, where, getDocs, doc, getDoc, updateDoc, deleteDoc, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { firestore as db } from '@/config/firebaseConfig';
import { distanceBetween, geohashQueryBounds } from 'geofire-common';
import type { RideRequestType, RideMatchType, MatchScore, MatchingCriteria } from '@/types/rideMatching';
import { notifyMatchFound } from '@/services/notificationService';
import * as Location from 'expo-location';

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

    // Fetch source user details
    const sourceUserDoc = await getDoc(doc(db, 'users', sourceRequest.userId));
    if (sourceUserDoc.exists()) {
      sourceRequest.user = {
        firstName: sourceUserDoc.data().firstName,
        lastName: sourceUserDoc.data().lastName,
        phoneNumber: sourceUserDoc.data().phoneNumber,
        department: sourceUserDoc.data().department,
        studentId: sourceUserDoc.data().studentId,
        gender: sourceUserDoc.data().gender,
        isStudentVerified: sourceUserDoc.data().isStudentVerified || false,
        profileImageUrl: sourceUserDoc.data().profileImageUrl,
        rating: sourceUserDoc.data().rating || 0,
      };
    }

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
            gender: userDoc.data().gender,
            isStudentVerified: userDoc.data().isStudentVerified || false,
            profileImageUrl: userDoc.data().profileImageUrl,
            rating: userDoc.data().rating || 0,
          };
          
          // Skip if verification requirements are not met
          if (sourceRequest.preferences.studentVerifiedOnly && 
              !candidateRequest.user.isStudentVerified) {
            continue; // Skip unverified students if verification required
          }
          
          if (candidateRequest.preferences.studentVerifiedOnly && 
              !sourceRequest.user?.isStudentVerified) {
            continue; // Skip if candidate requires verification and source isn't verified
          }
        } else {
          continue; // Skip if user not found
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
  // distanceBetween returns kilometers, convert to meters with proper rounding
  const originDistanceKm = distanceBetween(
    [source.origin.latitude, source.origin.longitude],
    [candidate.origin.latitude, candidate.origin.longitude]
  );
  const originDistance = Math.round(originDistanceKm * 1000); // Convert to meters

  breakdown.originDistance = originDistance;

  if (originDistance <= criteria.maxOriginDistance) {
    const originScore = 40 * (1 - originDistance / criteria.maxOriginDistance);
    score += originScore;
  } else {
    return { requestId: candidate.id, score: 0, breakdown }; // Fail fast
  }

  // 2. Destination distance (40 points)
  const destinationDistanceKm = distanceBetween(
    [source.destination.latitude, source.destination.longitude],
    [candidate.destination.latitude, candidate.destination.longitude]
  );
  const destinationDistance = Math.round(destinationDistanceKm * 1000);

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
  let genderMatch = false;

  // Check if either has 'any' preference
  if (source.preferences.genderPreference === 'any' && 
      candidate.preferences.genderPreference === 'any') {
    genderMatch = true;
  }
  // Check if one has 'any' and the other matches
  else if (source.preferences.genderPreference === 'any') {
    // Source accepts anyone, check if candidate's preference matches source's actual gender
    if (candidate.preferences.genderPreference === 'any') {
      genderMatch = true;
    } else if (!source.user?.gender) {
      // No gender specified, allow match
      genderMatch = true;
    } else if (candidate.preferences.genderPreference === source.user.gender + '_only') {
      genderMatch = true;
    }
  }
  else if (candidate.preferences.genderPreference === 'any') {
    // Candidate accepts anyone, check if source's preference matches candidate's actual gender
    if (source.preferences.genderPreference === 'any') {
      genderMatch = true;
    } else if (!candidate.user?.gender) {
      // No gender specified, allow match
      genderMatch = true;
    } else if (source.preferences.genderPreference === candidate.user.gender + '_only') {
      genderMatch = true;
    }
  }
  // Both have specific preferences - check mutual compatibility
  else if (source.preferences.genderPreference === candidate.preferences.genderPreference) {
    // Both want the same gender preference (e.g., both female_only)
    if (source.user?.gender && candidate.user?.gender &&
        source.user.gender === candidate.user.gender) {
      genderMatch = true;
    }
  }

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

// ==================== HELPER FUNCTIONS ====================

const geocodeCoordinates = async (lat: number, lng: number): Promise<string> => {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    if (results.length > 0) {
      const addr = results[0];
      
      // Filter out Plus Codes (contain + symbol)
      const isPlusCode = (str: string) => str && str.includes('+');
      
      const parts = [
        !isPlusCode(addr.name) ? addr.name : null,
        addr.street,
        addr.streetNumber,
        addr.district,
        addr.city,
        addr.region
      ].filter(Boolean);
      return parts.join(', ') || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch (error) {
    console.error('Geocoding error:', error);
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
};

const createNotificationsForUsers = async (
  userIds: string[],
  notification: {
    type: string;
    title: string;
    body: string;
    priority: string;
    data: any;
  }
): Promise<void> => {
  try {
    for (const userId of userIds) {
      await addDoc(collection(db, 'notifications'), {
        userId,
        ...notification,
        isRead: false,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    console.error('Error creating notifications:', error);
  }
};

const notifyMatchCancelled = async (
  userIds: string[],
  matchId: string,
  reason: string
): Promise<void> => {
  await createNotificationsForUsers(userIds, {
    type: 'match_cancelled',
    title: '❌ Match Cancelled',
    body: `Your match was cancelled: ${reason}`,
    priority: 'high',
    data: { matchId },
  });
};

// ==================== CREATE MATCH ====================

export const createMatch = async (
  requestIds: string[],
  creatorUserId?: string
): Promise<string> => {
  try {
    console.log('🔍 Validating requests before creating match...');
    
    // Check for duplicate matches - prevent same request being in multiple active matches
    for (const requestId of requestIds) {
      const requestDoc = await getDoc(doc(db, 'rideRequests', requestId));
      if (requestDoc.exists()) {
        const requestData = requestDoc.data();
        
        // Check if request is not in 'searching' status
        if (requestData.status !== 'searching') {
          console.log(`⚠️ Request ${requestId} status: ${requestData.status}`);
          
          // If matched but match doesn't exist, reset to searching
          if (requestData.status === 'matched' && requestData.matchId) {
            const existingMatchDoc = await getDoc(doc(db, 'rideMatches', requestData.matchId));
            if (!existingMatchDoc.exists()) {
              console.log(`🔄 Resetting orphaned request ${requestId} to searching`);
              await updateDoc(doc(db, 'rideRequests', requestId), {
                status: 'searching',
                matchId: null,
                matchedWith: [],
                updatedAt: serverTimestamp(),
              });
              continue; // Continue with match creation
            }
          }
          
          throw new Error(`Request ${requestId} is already matched or inactive (status: ${requestData.status})`);
        }
        
        // Check if there's an existing active match
        if (requestData.matchId) {
          const existingMatchDoc = await getDoc(doc(db, 'rideMatches', requestData.matchId));
          if (existingMatchDoc.exists()) {
            const matchStatus = existingMatchDoc.data().status;
            if (['pending', 'confirmed', 'riding'].includes(matchStatus)) {
              throw new Error(`Request ${requestId} is already in an active match (status: ${matchStatus})`);
            }
          }
        }
      }
    }

    // Fetch all requests with user data
    const requests: RideRequestType[] = [];
    for (const id of requestIds) {
      const requestDoc = await getDoc(doc(db, 'rideRequests', id));
      if (requestDoc.exists()) {
        const requestData = requestDoc.data();
        const request: RideRequestType = {
          id: requestDoc.id,
          ...requestData,
          departureTime: requestData.departureTime?.toDate(),
        } as RideRequestType;

        // Fetch user details for this request
        try {
          const userDoc = await getDoc(doc(db, 'users', request.userId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            request.user = {
              firstName: userData.firstName || '',
              lastName: userData.lastName || '',
              phoneNumber: userData.phoneNumber || null,
              department: userData.department || null,
              studentId: userData.studentId || null,
              gender: userData.gender || null,
              isStudentVerified: userData.isStudentVerified || false,
              profileImageUrl: userData.profileImageUrl || null,
              rating: userData.rating || 0,
            };
          }
        } catch (error) {
          console.error(`Error fetching user ${request.userId}:`, error);
          // Continue with minimal user data
          request.user = {
            firstName: 'Unknown',
            lastName: 'User',
            phoneNumber: null,
            department: null,
            studentId: null,
            gender: null,
            isStudentVerified: false,
            profileImageUrl: null,
            rating: 0,
          };
        }

        requests.push(request);
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

    // Geocode meeting and dropoff points for accurate addresses
    console.log('🗺️ Geocoding meeting and dropoff points...');
    const [meetingAddress, dropoffAddress] = await Promise.all([
      geocodeCoordinates(meetingPoint.lat, meetingPoint.lng),
      geocodeCoordinates(dropoffPoint.lat, dropoffPoint.lng)
    ]);

    // Calculate earliest departure time
    const departureTime = new Date(Math.min(...requests.map(r => r.departureTime.getTime())));

    // Calculate total seats and estimated cost
    const totalSeats = requests.reduce((sum, r) => sum + r.lookingForSeats, 0);
    const estimatedTotalCost = estimateRideCost(meetingPoint, dropoffPoint, totalSeats);
    const costPerPerson = estimatedTotalCost / requests.length;

    // Create participants array (ensure no undefined values for Firestore)
    const participants = requests.map(r => ({
      userId: r.userId,
      firstName: r.user?.firstName || 'Unknown',
      lastName: r.user?.lastName || 'User',
      phoneNumber: r.user?.phoneNumber || null,
      profileImageUrl: r.user?.profileImageUrl || null,
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
      department: r.user?.department || null,
    }));

    // Create match document (without chatRoomId first)
    const matchRef = await addDoc(collection(db, 'rideMatches'), {
      requestIds,
      participants,
      meetingPoint: {
        latitude: meetingPoint.lat,
        longitude: meetingPoint.lng,
        address: meetingAddress,
      },
      dropoffPoint: {
        latitude: dropoffPoint.lat,
        longitude: dropoffPoint.lng,
        address: dropoffAddress,
      },
      departureTime: Timestamp.fromDate(departureTime),
      estimatedTotalCost,
      costPerPerson,
      finalCostPerPerson: null, // Will be set when all confirm
      totalSeats,
      chatRoomId: '', // Will be updated below with matchRef.id
      status: 'pending',
      confirmations: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Update match with its own ID as chatRoomId
    await updateDoc(doc(db, 'rideMatches', matchRef.id), {
      chatRoomId: matchRef.id,
    });

    // Create initial system message in chat
    // Note: Using creator's userId as senderId to satisfy Firestore rules
    // but marking as 'system' type so UI can display it differently
    console.log('💬 Creating chat room...');
    const participantNames = participants.map(p => p.firstName).join(', ');
    const systemMessageSenderId = creatorUserId || participants[0]?.userId;
    
    console.log('📝 System message sender ID:', systemMessageSenderId);
    console.log('👤 Creator user ID:', creatorUserId);
    
    if (!systemMessageSenderId) {
      console.error('❌ No valid sender ID for system message!');
      throw new Error('Cannot create system message: No valid sender ID');
    }
    
    try {
      await addDoc(collection(db, 'chatMessages'), {
        matchId: matchRef.id,
        senderId: systemMessageSenderId,
        senderName: 'System',
        type: 'system',
        message: `🎉 Match created! ${participants.length} students connected: ${participantNames}. Coordinate your ride here. Meeting at ${meetingAddress}.`,
        timestamp: serverTimestamp(),
        readBy: [],
      });
      console.log('✅ Chat room created successfully');
    } catch (chatError) {
      console.error('❌ Error creating chat message:', chatError);
      console.error('Chat message details:', {
        matchId: matchRef.id,
        senderId: systemMessageSenderId,
        creatorUserId,
        participantsCount: participants.length,
      });
      // Don't fail the entire match creation if chat fails
      // Match is already created, just log the error
    }

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

    console.log('✅ Match created successfully! ID:', matchRef.id);
    console.log('📋 Match details:', {
      id: matchRef.id,
      participantsCount: participants.length,
      status: 'pending',
      meetingAddress: meetingAddress,
    });

    return matchRef.id;
  } catch (error) {
    console.error('❌ Error creating match:', error);
    throw new Error('Failed to create match');
  }
};

// ==================== MATCH EXPIRATION & CLEANUP ====================

/**
 * Check and expire old matches
 * Should be called periodically (e.g., Cloud Function scheduled task)
 */
export const expireOldMatches = async (): Promise<number> => {
  try {
    const now = new Date();
    
    // Query matches that are past their departure time and still pending
    const matchesQuery = query(
      collection(db, 'rideMatches'),
      where('status', '==', 'pending'),
      where('departureTime', '<', Timestamp.fromDate(now))
    );

    const matchesSnapshot = await getDocs(matchesQuery);
    let expiredCount = 0;

    for (const matchDoc of matchesSnapshot.docs) {
      const matchData = matchDoc.data();
      
      // Update match to expired
      await updateDoc(doc(db, 'rideMatches', matchDoc.id), {
        status: 'cancelled',
        updatedAt: serverTimestamp(),
      });

      // Update all associated ride requests back to searching
      for (const requestId of matchData.requestIds) {
        try {
          await updateDoc(doc(db, 'rideRequests', requestId), {
            status: 'searching',
            matchId: null,
            matchedWith: [],
            updatedAt: serverTimestamp(),
          });
        } catch (error) {
          console.error(`Error updating request ${requestId}:`, error);
        }
      }

      // Notify participants
      const userIds = matchData.participants.map((p: any) => p.userId);
      await notifyMatchCancelled(userIds, matchDoc.id, 'Match expired (departure time passed)');
      
      expiredCount++;
    }

    console.log(`✅ Expired ${expiredCount} old matches`);
    return expiredCount;
  } catch (error) {
    console.error('Error expiring matches:', error);
    throw error;
  }
};

/**
 * Check if match confirmation has timed out
 * Call this 30 minutes after match creation
 */
export const checkMatchConfirmationTimeout = async (matchId: string): Promise<void> => {
  try {
    const matchDoc = await getDoc(doc(db, 'rideMatches', matchId));
    if (!matchDoc.exists()) return;

    const matchData = matchDoc.data();
    if (matchData.status !== 'pending') return;

    const createdAt = matchData.createdAt?.toDate();
    const now = new Date();
    
    // 30 minute confirmation window
    const confirmationDeadline = new Date(createdAt.getTime() + 30 * 60 * 1000);

    if (now > confirmationDeadline) {
      const confirmedCount = matchData.confirmations?.length || 0;
      const totalParticipants = matchData.participants.length;

      if (confirmedCount < totalParticipants) {
        // Some participants didn't confirm - cancel match
        await updateDoc(doc(db, 'rideMatches', matchId), {
          status: 'cancelled',
          updatedAt: serverTimestamp(),
        });

        // Notify all participants
        const userIds = matchData.participants.map((p: any) => p.userId);
        await notifyMatchCancelled(
          userIds,
          matchId,
          `Not all participants confirmed in time (${confirmedCount}/${totalParticipants} confirmed)`
        );

        // Reset requests to searching for unconfirmed users
        const confirmedUserIds = matchData.confirmations || [];
        for (let i = 0; i < matchData.requestIds.length; i++) {
          const requestId = matchData.requestIds[i];
          const participant = matchData.participants[i];
          
          if (!confirmedUserIds.includes(participant.userId)) {
            await updateDoc(doc(db, 'rideRequests', requestId), {
              status: 'searching',
              matchId: null,
              matchedWith: [],
              updatedAt: serverTimestamp(),
            });
          }
        }

        console.log(`⏰ Match ${matchId} cancelled due to confirmation timeout`);
      }
    }
  } catch (error) {
    console.error('Error checking confirmation timeout:', error);
    throw error;
  }
};

/**
 * Remove a participant from an existing match
 */
export const leaveMatch = async (matchId: string, userId: string): Promise<void> => {
  try {
    const matchDoc = await getDoc(doc(db, 'rideMatches', matchId));
    if (!matchDoc.exists()) {
      throw new Error('Match not found');
    }

    const matchData = matchDoc.data();
    
    // Don't allow leaving if ride is already in progress or completed
    if (['riding', 'completed'].includes(matchData.status)) {
      throw new Error('Cannot leave match while ride is in progress or completed');
    }

    // Find participant index
    const participantIndex = matchData.participants.findIndex(
      (p: any) => p.userId === userId
    );

    if (participantIndex === -1) {
      throw new Error('You are not a participant in this match');
    }

    // Remove participant
    const updatedParticipants = matchData.participants.filter(
      (p: any) => p.userId !== userId
    );

    // Remove from confirmations
    const updatedConfirmations = (matchData.confirmations || []).filter(
      (id: string) => id !== userId
    );

    // Remove their request ID
    const leavingRequestId = matchData.requestIds[participantIndex];
    const updatedRequestIds = matchData.requestIds.filter(
      (_: string, idx: number) => idx !== participantIndex
    );

    // If only 1 participant left, cancel the match
    if (updatedParticipants.length < 2) {
      await updateDoc(doc(db, 'rideMatches', matchId), {
        status: 'cancelled',
        updatedAt: serverTimestamp(),
      });

      // Reset remaining participant's request to searching
      if (updatedParticipants.length === 1 && updatedRequestIds.length === 1) {
        await updateDoc(doc(db, 'rideRequests', updatedRequestIds[0]), {
          status: 'searching',
          matchId: null,
          matchedWith: [],
          updatedAt: serverTimestamp(),
        });

        // Notify the remaining participant
        await notifyMatchCancelled(
          [updatedParticipants[0].userId],
          matchId,
          'Not enough participants remaining'
        );
      }

      console.log(`❌ Match ${matchId} cancelled - not enough participants`);
    } else {
      // Update match with remaining participants
      const totalSeats = updatedParticipants.reduce(
        (sum: number, p: any) => sum + p.seats,
        0
      );
      
      const estimatedTotalCost = estimateRideCost(
        { lat: matchData.meetingPoint.latitude, lng: matchData.meetingPoint.longitude },
        { lat: matchData.dropoffPoint.latitude, lng: matchData.dropoffPoint.longitude },
        totalSeats
      );

      const costPerPerson = Math.round(estimatedTotalCost / updatedParticipants.length);

      await updateDoc(doc(db, 'rideMatches', matchId), {
        participants: updatedParticipants,
        requestIds: updatedRequestIds,
        confirmations: updatedConfirmations,
        totalSeats,
        estimatedTotalCost,
        costPerPerson,
        updatedAt: serverTimestamp(),
      });

      // Notify remaining participants about the change
      const remainingUserIds = updatedParticipants.map((p: any) => p.userId);
      await createNotificationsForUsers(remainingUserIds, {
        type: 'participant_left',
        title: '⚠️ Participant Left',
        body: `A participant left the match. New cost: ৳${costPerPerson} per person.`,
        priority: 'normal',
        data: { matchId },
      });

      // Get leaving user's name
      const leavingUser = matchData.participants[participantIndex];
      const userName = `${leavingUser.firstName} ${leavingUser.lastName}`;

      // Add system message to chat (use first remaining participant as sender)
      const systemSenderId = updatedParticipants[0]?.userId || userId;
      await addDoc(collection(db, 'chatMessages'), {
        matchId,
        senderId: systemSenderId,
        senderName: 'System',
        type: 'system',
        message: `👋 ${userName} left the match. Cost updated to ৳${costPerPerson} per person (${updatedParticipants.length} participants remaining).`,
        timestamp: serverTimestamp(),
        readBy: [],
      });

      console.log(`👋 User ${userId} left match ${matchId}`);
    }

    // Reset the leaving user's request to searching
    if (leavingRequestId) {
      await updateDoc(doc(db, 'rideRequests', leavingRequestId), {
        status: 'searching',
        matchId: null,
        matchedWith: [],
        updatedAt: serverTimestamp(),
      });
    }

  } catch (error) {
    console.error('Error leaving match:', error);
    throw error;
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
    console.log('🔎 getRideMatch called with matchId:', matchId);
    const matchDoc = await getDoc(doc(db, 'rideMatches', matchId));
    console.log('📄 Match document exists:', matchDoc.exists());
    
    if (!matchDoc.exists()) {
      console.log('❌ Match document not found in Firestore');
      return null;
    }

    const matchData = matchDoc.data();
    console.log('✅ Match document data:', {
      id: matchDoc.id,
      status: matchData.status,
      participantsCount: matchData.participants?.length,
      hasParticipants: !!matchData.participants,
    });

    return {
      id: matchDoc.id,
      ...matchData,
      departureTime: matchData.departureTime?.toDate(),
      createdAt: matchData.createdAt?.toDate(),
      updatedAt: matchData.updatedAt?.toDate(),
    } as RideMatchType;
  } catch (error) {
    console.error('❌ Error getting match:', error);
    return null;
  }
};

/**
 * Delete a ride request
 * Only allows deletion if status is 'searching' (not matched yet)
 */
export const deleteRideRequest = async (requestId: string, userId: string): Promise<void> => {
  try {
    // Get the request first to verify ownership and status
    const requestDoc = await getDoc(doc(db, 'rideRequests', requestId));
    
    if (!requestDoc.exists()) {
      throw new Error('Request not found');
    }

    const requestData = requestDoc.data();
    
    // Verify ownership
    if (requestData.userId !== userId) {
      throw new Error('Unauthorized: You can only delete your own requests');
    }

    // Only allow deletion if status is 'searching'
    if (requestData.status !== 'searching') {
      throw new Error('Cannot delete request: Already matched or in progress');
    }

    // Delete the request
    await deleteDoc(doc(db, 'rideRequests', requestId));
    
    console.log('✅ Request deleted successfully:', requestId);
  } catch (error: any) {
    console.error('Error deleting request:', error);
    throw error;
  }
};

/**
 * Update a ride request
 * Only allows updating if status is 'searching' (not matched yet)
 */
export const updateRideRequest = async (
  requestId: string,
  userId: string,
  updates: {
    departureTime?: Date;
    flexibility?: number;
    maxWalkDistance?: number;
    lookingForSeats?: number;
    maxPricePerSeat?: number;
    preferences?: {
      genderPreference?: 'any' | 'female_only' | 'male_only';
      studentVerifiedOnly?: boolean;
      sameDepartmentPreferred?: boolean;
    };
  }
): Promise<void> => {
  try {
    // Get the request first to verify ownership and status
    const requestDoc = await getDoc(doc(db, 'rideRequests', requestId));
    
    if (!requestDoc.exists()) {
      throw new Error('Request not found');
    }

    const requestData = requestDoc.data();
    
    // Verify ownership
    if (requestData.userId !== userId) {
      throw new Error('Unauthorized: You can only update your own requests');
    }

    // Only allow updates if status is 'searching'
    if (requestData.status !== 'searching') {
      throw new Error('Cannot update request: Already matched or in progress');
    }

    // Prepare update data
    const updateData: any = {
      updatedAt: Timestamp.now(),
    };

    if (updates.departureTime) {
      updateData.departureTime = Timestamp.fromDate(updates.departureTime);
    }
    if (updates.flexibility !== undefined) {
      updateData.flexibility = updates.flexibility;
    }
    if (updates.maxWalkDistance !== undefined) {
      updateData.maxWalkDistance = updates.maxWalkDistance;
    }
    if (updates.lookingForSeats !== undefined) {
      updateData.lookingForSeats = updates.lookingForSeats;
    }
    if (updates.maxPricePerSeat !== undefined) {
      updateData.maxPricePerSeat = updates.maxPricePerSeat;
    }
    if (updates.preferences) {
      updateData.preferences = {
        ...requestData.preferences,
        ...updates.preferences,
      };
    }

    // Update the request
    await updateDoc(doc(db, 'rideRequests', requestId), updateData);
    
    console.log('✅ Request updated successfully:', requestId);
  } catch (error: any) {
    console.error('Error updating request:', error);
    throw error;
  }
};

/**
 * Reset a stuck request back to searching status
 * Use this when a request is marked as "matched" but the match doesn't exist
 */
export const resetStuckRequest = async (requestId: string, userId: string): Promise<void> => {
  try {
    console.log('🔄 Resetting stuck request:', requestId);
    
    const requestDoc = await getDoc(doc(db, 'rideRequests', requestId));
    
    if (!requestDoc.exists()) {
      throw new Error('Request not found');
    }

    const requestData = requestDoc.data();
    
    // Verify ownership
    if (requestData.userId !== userId) {
      throw new Error('Unauthorized: You can only reset your own requests');
    }

    // Reset to searching state
    await updateDoc(doc(db, 'rideRequests', requestId), {
      status: 'searching',
      matchId: null,
      matchedWith: [],
      updatedAt: serverTimestamp(),
    });
    
    console.log('✅ Request reset to searching successfully');
  } catch (error: any) {
    console.error('Error resetting request:', error);
    throw error;
  }
};
