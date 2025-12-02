import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { WebCompatibleMap, WebCompatibleMarker, PROVIDER_GOOGLE } from '@/components/WebCompatibleMap';
import { useAuth } from '@/features/auth/context/AuthContext';
import { getRideMatch, leaveMatch } from '@/services/rideMatchingService';
import { updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { firestore as db } from '@/config/firebaseConfig';
import type { MainTabParamList } from '@/types';
import type { RideMatchType } from '@/types/rideMatching';
import { UserAvatar } from '@/components/UserAvatar';
import { useTheme } from '@/context/ThemeContext';

type MatchDetailsRouteProp = RouteProp<{ MatchDetails: { matchId: string } }, 'MatchDetails'>;
type MatchDetailsNavigationProp = BottomTabNavigationProp<MainTabParamList>;

const MatchDetailsScreen: React.FC = () => {
  const route = useRoute<MatchDetailsRouteProp>();
  const navigation = useNavigation<MatchDetailsNavigationProp>();
  const { user } = useAuth();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const matchId = route.params?.matchId;

  const [mapReady, setMapReady] = useState(false);

  // Fetch match details
  const {
    data: match,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['rideMatch', matchId],
    queryFn: async () => {
      console.log('🔍 Fetching match details for:', matchId);
      const result = await getRideMatch(matchId);
      console.log('📦 Match data received:', result ? 'Success' : 'Null', result?.participants?.length, 'participants');
      return result;
    },
    enabled: !!matchId,
    staleTime: 10 * 1000,
    refetchInterval: 10 * 1000, // Poll every 10 seconds
    retry: 3, // Retry up to 3 times
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff: 1s, 2s, 4s
  });

  // Debug logging
  useEffect(() => {
    console.log('Match Details Screen - matchId:', matchId);
    console.log('Match Details Screen - isLoading:', isLoading);
    console.log('Match Details Screen - match:', match ? 'exists' : 'null');
    console.log('Match Details Screen - error:', error);
  }, [matchId, isLoading, match, error]);

  const currentUserParticipant = match?.participants.find(
    (p) => p.userId === user?.uid
  );

  const hasConfirmed = match?.confirmations?.includes(user?.uid || '');

  // Confirm match mutation
  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!match || !user) throw new Error('Missing data');
      
      const updatedConfirmations = [...(match.confirmations || [])];
      if (!updatedConfirmations.includes(user.uid)) {
        updatedConfirmations.push(user.uid);
      }

      // Update status to confirmed if all participants have confirmed
      const allConfirmed = updatedConfirmations.length === match.participants.length;
      
      const updateData: any = {
        confirmations: updatedConfirmations,
        status: allConfirmed ? 'confirmed' : match.status,
        updatedAt: serverTimestamp(),
      };

      // If all confirmed, finalize cost and set confirmation timestamp
      if (allConfirmed) {
        updateData.finalCostPerPerson = match.costPerPerson;
        updateData.confirmedAt = serverTimestamp();
      }
      
      await updateDoc(doc(db, 'rideMatches', matchId), updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rideMatch', matchId] });
      queryClient.invalidateQueries({ queryKey: ['userRideRequests'] });
      Alert.alert('Confirmed!', 'You\'ve confirmed this match.');
    },
    onError: () => {
      Alert.alert('Error', 'Failed to confirm match. Please try again.');
    },
  });

  // Leave match mutation
  const leaveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('User not found');
      await leaveMatch(matchId, user.uid);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rideMatch', matchId] });
      queryClient.invalidateQueries({ queryKey: ['userRideRequests'] });
      Alert.alert(
        'Left Match',
        'You have left this match. Your request is now searching for new matches.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to leave match. Please try again.');
    },
  });

  const handleLeaveMatch = () => {
    Alert.alert(
      'Leave Match?',
      'Are you sure you want to leave this match? Other participants will be notified and the cost will be recalculated.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => leaveMutation.mutate(),
        },
      ]
    );
  };

  const handleCallParticipant = (phoneNumber?: string) => {
    if (!phoneNumber) {
      Alert.alert('No Phone Number', 'This user hasn\'t provided a phone number.');
      return;
    }
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const handleOpenMap = (latitude: number, longitude: number, label: string) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    Linking.openURL(url);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (date: Date) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3182ce" />
        <Text style={styles.loadingText}>Loading match details...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="alert-circle" size={48} color="#ef4444" />
        <Text style={[styles.loadingText, { color: '#ef4444', marginTop: 16 }]}>
          Failed to load match details
        </Text>
        <TouchableOpacity
          style={[styles.confirmButton, { marginTop: 16, paddingHorizontal: 24 }]}
          onPress={() => refetch()}
        >
          <Text style={styles.confirmButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!match) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="alert-circle" size={48} color="#f59e0b" />
        <Text style={[styles.loadingText, { color: '#f59e0b', marginTop: 16 }]}>
          Match not found
        </Text>
        <TouchableOpacity
          style={[styles.confirmButton, { marginTop: 16, paddingHorizontal: 24 }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.confirmButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const allConfirmed = match.confirmations?.length === match.participants.length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Status Banner */}
      {match.status === 'confirmed' && (
        <View style={styles.statusBanner}>
          <Ionicons name="checkmark-circle" size={24} color="#10b981" />
          <Text style={styles.statusBannerText}>Match Confirmed! 🎉</Text>
        </View>
      )}

      {match.status === 'pending' && !allConfirmed && (
        <View style={[styles.statusBanner, { backgroundColor: '#fef3c7' }]}>
          <Ionicons name="time" size={24} color="#f59e0b" />
          <Text style={[styles.statusBannerText, { color: '#92400e' }]}>
            Waiting for confirmations ({match.confirmations?.length || 0}/{match.participants.length})
          </Text>
        </View>
      )}

      {/* Map */}
      <View style={styles.mapContainer}>
        <WebCompatibleMap
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={{
            latitude: match.meetingPoint.latitude,
            longitude: match.meetingPoint.longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          }}
          onMapReady={() => setMapReady(true)}
          fallbackMessage="🗺️ Interactive map available on mobile"
          fallbackButton={{
            text: "Open in Google Maps",
            onPress: () => {
              const url = `https://www.google.com/maps/dir/${match.meetingPoint.latitude},${match.meetingPoint.longitude}/${match.dropoffPoint.latitude},${match.dropoffPoint.longitude}`;
              if (typeof window !== 'undefined') {
                window.open(url, '_blank');
              }
            }
          }}
        >
          {/* Meeting Point */}
          <WebCompatibleMarker
            coordinate={{
              latitude: match.meetingPoint.latitude,
              longitude: match.meetingPoint.longitude,
            }}
            title="Meeting Point"
            description={match.meetingPoint.address}
          >
            <View style={styles.meetingMarker}>
              <Ionicons name="location" size={24} color="#10b981" />
            </View>
          </WebCompatibleMarker>

          {/* Drop-off Point */}
          <WebCompatibleMarker
            coordinate={{
              latitude: match.dropoffPoint.latitude,
              longitude: match.dropoffPoint.longitude,
            }}
            title="Drop-off Point"
            description={match.dropoffPoint.address}
          >
            <View style={styles.dropoffMarker}>
              <Ionicons name="flag" size={24} color="#ef4444" />
            </View>
          </WebCompatibleMarker>
        </WebCompatibleMap>
      </View>

      {/* Participants */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>👥 Participants ({match.participants.length})</Text>
        
        {match.participants.map((participant, index) => {
          const isCurrentUser = participant.userId === user?.uid;
          const hasConfirmed = match.confirmations?.includes(participant.userId);

          return (
            <View key={participant.userId} style={styles.participantCard}>
              <View style={styles.participantHeader}>
                <UserAvatar
                  imageUrl={participant.profileImageUrl}
                  name={`${participant.firstName} ${participant.lastName}`}
                  size={48}
                  verified={participant.isStudentVerified}
                />
                
                <View style={styles.participantInfo}>
                  <View style={styles.participantNameRow}>
                    <Text style={styles.participantName}>
                      {participant.firstName} {participant.lastName}
                      {isCurrentUser && <Text style={styles.youBadge}> (You)</Text>}
                    </Text>
                    {hasConfirmed && (
                      <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                    )}
                  </View>
                  {participant.department && (
                    <Text style={styles.participantDepartment}>{participant.department}</Text>
                  )}
                </View>

                {!isCurrentUser && participant.phoneNumber && (
                  <TouchableOpacity
                    style={styles.callButton}
                    onPress={() => handleCallParticipant(participant.phoneNumber)}
                  >
                    <Ionicons name="call" size={20} color="#3182ce" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Participant Locations */}
              <View style={styles.participantLocations}>
                <View style={styles.locationItem}>
                  <Ionicons name="location" size={14} color="#10b981" />
                  <Text style={styles.locationText} numberOfLines={1}>
                    {participant.pickupLocation.address}
                  </Text>
                </View>
                <View style={styles.locationItem}>
                  <Ionicons name="flag" size={14} color="#ef4444" />
                  <Text style={styles.locationText} numberOfLines={1}>
                    {participant.dropoffLocation.address}
                  </Text>
                </View>
              </View>

              <View style={styles.participantMeta}>
                <View style={styles.metaChip}>
                  <Ionicons name="people" size={12} color="#3182ce" />
                  <Text style={styles.metaChipText}>{participant.seats} seat(s)</Text>
                </View>
                {!hasConfirmed && (
                  <View style={[styles.metaChip, { backgroundColor: '#fef3c7' }]}>
                    <Ionicons name="time" size={12} color="#f59e0b" />
                    <Text style={[styles.metaChipText, { color: '#92400e' }]}>Pending</Text>
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </View>

      {/* Meeting Details */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📍 Meeting Point</Text>
        <TouchableOpacity
          style={styles.locationCard}
          onPress={() =>
            handleOpenMap(
              match.meetingPoint.latitude,
              match.meetingPoint.longitude,
              'Meeting Point'
            )
          }
        >
          <View style={styles.locationCardHeader}>
            <Ionicons name="location" size={20} color="#10b981" />
            <Text style={styles.locationCardTitle}>Pickup Location</Text>
            <Ionicons name="open-outline" size={16} color="#3182ce" />
          </View>
          <Text style={styles.locationCardAddress}>{match.meetingPoint.address}</Text>
          {match.meetingPoint.description && (
            <Text style={styles.locationCardDescription}>{match.meetingPoint.description}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.locationCard}
          onPress={() =>
            handleOpenMap(
              match.dropoffPoint.latitude,
              match.dropoffPoint.longitude,
              'Drop-off Point'
            )
          }
        >
          <View style={styles.locationCardHeader}>
            <Ionicons name="flag" size={20} color="#ef4444" />
            <Text style={styles.locationCardTitle}>Drop-off Location</Text>
            <Ionicons name="open-outline" size={16} color="#3182ce" />
          </View>
          <Text style={styles.locationCardAddress}>{match.dropoffPoint.address}</Text>
        </TouchableOpacity>
      </View>

      {/* Time & Cost */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⏰ Details</Text>
        
        <View style={styles.detailsGrid}>
          <View style={styles.detailCard}>
            <Ionicons name="time-outline" size={24} color="#3182ce" />
            <Text style={styles.detailLabel}>Departure</Text>
            <Text style={styles.detailValue}>
              {formatDate(match.departureTime)}
            </Text>
            <Text style={styles.detailSubvalue}>
              {formatTime(match.departureTime)}
            </Text>
          </View>

          <View style={styles.detailCard}>
            <Ionicons name="cash-outline" size={24} color="#10b981" />
            <Text style={styles.detailLabel}>Your Share</Text>
            <Text style={styles.detailValue}>৳{match.costPerPerson}</Text>
            <Text style={styles.detailSubvalue}>
              ৳{match.estimatedTotalCost} total
            </Text>
          </View>

          <View style={styles.detailCard}>
            <Ionicons name="car-outline" size={24} color="#8b5cf6" />
            <Text style={styles.detailLabel}>Seats</Text>
            <Text style={styles.detailValue}>{match.totalSeats}</Text>
            <Text style={styles.detailSubvalue}>
              {match.rideProvider || 'Uber/Pathao'}
            </Text>
          </View>
        </View>
      </View>

      {/* Ride Booking Info */}
      {match.bookingId && (
        <View style={styles.bookingCard}>
          <Ionicons name="checkmark-circle" size={24} color="#10b981" />
          <View style={styles.bookingInfo}>
            <Text style={styles.bookingTitle}>Ride Booked!</Text>
            <Text style={styles.bookingId}>Booking ID: {match.bookingId}</Text>
            {match.driverInfo && (
              <Text style={styles.bookingDriver}>
                Driver: {match.driverInfo.name} • {match.driverInfo.vehicleNumber}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionSection}>
        {!hasConfirmed && match.status === 'pending' && (
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={() => confirmMutation.mutate()}
            disabled={confirmMutation.isPending}
          >
            {confirmMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.confirmButtonText}>Confirm Match</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {hasConfirmed && (
          <View style={styles.confirmedBadge}>
            <Ionicons name="checkmark-circle" size={20} color="#10b981" />
            <Text style={styles.confirmedText}>You've confirmed this match</Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.chatButton}
          onPress={() => navigation.navigate('GroupChat', { matchId })}
        >
          <Ionicons name="chatbubbles" size={20} color="#fff" />
          <Text style={styles.chatButtonText}>Open Group Chat</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.shareButton}
          onPress={() => {
            Alert.alert('Share Details', 'Share ride details with emergency contacts');
          }}
        >
          <Ionicons name="share-social" size={20} color="#3182ce" />
          <Text style={styles.shareButtonText}>Share with Emergency Contacts</Text>
        </TouchableOpacity>

        {/* Leave Match Button (only if not completed/riding) */}
        {match.status !== 'completed' && match.status !== 'riding' && (
          <TouchableOpacity
            style={styles.leaveButton}
            onPress={handleLeaveMatch}
            disabled={leaveMutation.isPending}
          >
            {leaveMutation.isPending ? (
              <ActivityIndicator color="#ef4444" size="small" />
            ) : (
              <>
                <Ionicons name="exit-outline" size={20} color="#ef4444" />
                <Text style={styles.leaveButtonText}>Leave Match</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Safety Tips */}
      <View style={styles.safetyCard}>
        <Ionicons name="shield-checkmark" size={20} color="#10b981" />
        <View style={styles.safetyContent}>
          <Text style={styles.safetyTitle}>Safety Tips</Text>
          <Text style={styles.safetyText}>
            • Verify student IDs before meeting{'\n'}
            • Meet in well-lit public areas{'\n'}
            • Share ride details with emergency contacts{'\n'}
            • Keep location sharing on during ride
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  contentContainer: {
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#718096',
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d1fae5',
    padding: 16,
    gap: 12,
  },
  statusBannerText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#065f46',
  },
  mapContainer: {
    height: 250,
    backgroundColor: '#e2e8f0',
  },
  map: {
    flex: 1,
  },
  meetingMarker: {
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#10b981',
  },
  dropoffMarker: {
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#ef4444',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a365d',
    marginBottom: 12,
  },
  participantCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  participantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  participantInfo: {
    flex: 1,
    marginLeft: 12,
  },
  participantNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a365d',
  },
  youBadge: {
    color: '#3182ce',
    fontSize: 14,
  },
  participantDepartment: {
    fontSize: 13,
    color: '#718096',
    marginTop: 2,
  },
  callButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ebf8ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  participantLocations: {
    marginBottom: 8,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  locationText: {
    flex: 1,
    fontSize: 13,
    color: '#4a5568',
    marginLeft: 6,
  },
  participantMeta: {
    flexDirection: 'row',
    gap: 8,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ebf8ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  metaChipText: {
    fontSize: 11,
    color: '#2c5282',
    fontWeight: '500',
  },
  locationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  locationCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  locationCardTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#2d3748',
  },
  locationCardAddress: {
    fontSize: 15,
    color: '#1a365d',
    fontWeight: '500',
    marginBottom: 4,
  },
  locationCardDescription: {
    fontSize: 13,
    color: '#718096',
  },
  detailsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  detailCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  detailLabel: {
    fontSize: 12,
    color: '#718096',
    marginTop: 8,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a365d',
  },
  detailSubvalue: {
    fontSize: 11,
    color: '#a0aec0',
  },
  bookingCard: {
    flexDirection: 'row',
    backgroundColor: '#d1fae5',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  bookingInfo: {
    flex: 1,
  },
  bookingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#065f46',
    marginBottom: 4,
  },
  bookingId: {
    fontSize: 14,
    color: '#047857',
    marginBottom: 2,
  },
  bookingDriver: {
    fontSize: 13,
    color: '#059669',
  },
  actionSection: {
    padding: 16,
    paddingTop: 0,
    gap: 12,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    paddingVertical: 18,
    borderRadius: 14,
    gap: 8,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  confirmedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d1fae5',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  confirmedText: {
    color: '#065f46',
    fontSize: 16,
    fontWeight: '600',
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3182ce',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  chatButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3182ce',
    gap: 8,
  },
  shareButtonText: {
    color: '#3182ce',
    fontSize: 16,
    fontWeight: '600',
  },
  safetyCard: {
    flexDirection: 'row',
    backgroundColor: '#f0fdf4',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#86efac',
    gap: 12,
  },
  safetyContent: {
    flex: 1,
  },
  safetyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#065f46',
    marginBottom: 8,
  },
  safetyText: {
    fontSize: 13,
    color: '#047857',
    lineHeight: 20,
  },
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ef4444',
    gap: 8,
    marginTop: 8,
  },
  leaveButtonText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default MatchDetailsScreen;
