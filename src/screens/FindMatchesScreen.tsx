import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { distanceBetween } from 'geofire-common';
import { useAuth } from '@/features/auth/context/AuthContext';
import { useUser } from '@/features/auth/hooks/useUser';
import { useTheme } from '@/context/ThemeContext';
import { findPotentialMatches, getRideRequest, createMatch } from '@/services/rideMatchingService';
import type { MainTabParamList } from '@/types';
import type { RideRequestType, MatchScore } from '@/types/rideMatching';
import { UserAvatar } from '@/components/UserAvatar';

type FindMatchesRouteProp = RouteProp<{ FindMatches: { requestId: string } }, 'FindMatches'>;
type FindMatchesNavigationProp = BottomTabNavigationProp<MainTabParamList>;

const FindMatchesScreen: React.FC = () => {
  const route = useRoute<FindMatchesRouteProp>();
  const navigation = useNavigation<FindMatchesNavigationProp>();
  const { user } = useAuth();
  const { colors } = useTheme();
  const { userProfile } = useUser();
  const queryClient = useQueryClient();
  const [selectedMatches, setSelectedMatches] = useState<string[]>([]);

  const requestId = route.params?.requestId;

  // Fetch the user's ride request
  const {
    data: myRequest,
    isLoading: loadingRequest,
  } = useQuery({
    queryKey: ['rideRequest', requestId],
    queryFn: () => getRideRequest(requestId),
    enabled: !!requestId,
  });

  // Find potential matches
  const {
    data: matches,
    isLoading: loadingMatches,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['potentialMatches', requestId],
    queryFn: () => findPotentialMatches(requestId),
    enabled: !!requestId,
    staleTime: 30 * 1000,
  });

  // Create match mutation
  const createMatchMutation = useMutation({
    mutationFn: (requestIds: string[]) => createMatch(requestIds),
    onSuccess: (matchId) => {
      queryClient.invalidateQueries({ queryKey: ['rideRequest', requestId] });
      queryClient.invalidateQueries({ queryKey: ['userRideRequests'] });
      
      Alert.alert(
        'Match Created! 🎉',
        'You\'ve been matched! View match details to see participants and coordinate.',
        [
          {
            text: 'View Match',
            onPress: () => {
              navigation.navigate('MatchDetails', { matchId });
            },
          },
          {
            text: 'Later',
            style: 'cancel',
          },
        ]
      );
    },
    onError: (error) => {
      Alert.alert('Error', 'Failed to create match. Please try again.');
      console.error('Match creation error:', error);
    },
  });

  const handleToggleMatch = (matchRequestId: string) => {
    if (selectedMatches.includes(matchRequestId)) {
      setSelectedMatches(selectedMatches.filter((id) => id !== matchRequestId));
    } else {
      setSelectedMatches([...selectedMatches, matchRequestId]);
    }
  };

  const handleCreateMatch = () => {
    if (selectedMatches.length === 0) {
      Alert.alert('No Selection', 'Please select at least one match to continue.');
      return;
    }

    const allRequestIds = [requestId, ...selectedMatches];
    const totalSeats = allRequestIds.length; // Assuming 1 seat per person for now

    Alert.alert(
      'Create Match Group?',
      `Create a group with ${selectedMatches.length} other student${selectedMatches.length > 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create Group',
          onPress: () => createMatchMutation.mutate(allRequestIds),
        },
      ]
    );
  };

  const formatDistance = (meters: number) => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#10b981'; // Green
    if (score >= 60) return '#f59e0b'; // Orange
    return '#ef4444'; // Red
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent Match';
    if (score >= 60) return 'Good Match';
    return 'Fair Match';
  };

  const renderMatchCard = ({ item }: { item: MatchScore & { request?: RideRequestType } }) => {
    const isSelected = selectedMatches.includes(item.requestId);
    const request = item.request;

    if (!request) return null;

    return (
      <TouchableOpacity
        style={[styles.matchCard, isSelected && styles.matchCardSelected]}
        onPress={() => handleToggleMatch(item.requestId)}
        activeOpacity={0.7}
      >
        {/* Selection Indicator */}
        <View style={styles.selectionIndicator}>
          <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
            {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
          </View>
        </View>

        {/* Match Score */}
        <View style={[styles.scoreBadge, { backgroundColor: getScoreColor(item.score) }]}>
          <Text style={styles.scoreText}>{item.score}%</Text>
        </View>

        {/* User Info */}
        <View style={styles.userHeader}>
          <UserAvatar
            imageUrl={request.user?.profileImageUrl}
            name={`${request.user?.firstName} ${request.user?.lastName}`}
            size={48}
            verified={request.user?.isStudentVerified}
          />
          <View style={styles.userInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.userName}>
                {request.user?.firstName} {request.user?.lastName}
              </Text>
            </View>
            {request.user?.department && (
              <Text style={styles.userDepartment}>{request.user.department}</Text>
            )}
          </View>
        </View>

        {/* Match Details */}
        <View style={styles.matchDetails}>
          <Text style={styles.matchLabel}>{getScoreLabel(item.score)}</Text>
          
          <View style={styles.detailRow}>
            <Ionicons name="location" size={14} color="#10b981" />
            <Text style={styles.detailText}>
              Pickup: {formatDistance(item.breakdown.originDistance)} away
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <Ionicons name="flag" size={14} color="#ef4444" />
            <Text style={styles.detailText}>
              Drop-off: {formatDistance(item.breakdown.destinationDistance)} away
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <Ionicons name="time" size={14} color="#3182ce" />
            <Text style={styles.detailText}>
              Time difference: {Math.round(item.breakdown.timeDifference)} mins
            </Text>
          </View>
        </View>

        {/* Preferences Match */}
        {(item.breakdown.preferencesMatch || item.breakdown.departmentMatch) && (
          <View style={styles.bonusSection}>
            {item.breakdown.preferencesMatch && (
              <View style={styles.bonusBadge}>
                <Ionicons name="people" size={12} color="#3182ce" />
                <Text style={styles.bonusText}>Preferences Match</Text>
              </View>
            )}
            {item.breakdown.departmentMatch && (
              <View style={styles.bonusBadge}>
                <Ionicons name="school" size={12} color="#8b5cf6" />
                <Text style={styles.bonusText}>Same Department</Text>
              </View>
            )}
          </View>
        )}

        {/* Route Preview */}
        <View style={styles.routePreview}>
          <Text style={styles.routeText} numberOfLines={1}>
            {request.origin.address}
          </Text>
          <Ionicons name="arrow-forward" size={12} color="#718096" />
          <Text style={styles.routeText} numberOfLines={1}>
            {request.destination.address}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => {
    if (!myRequest) return null;

    return (
      <View style={styles.header}>
        <Text style={styles.title}>Find Ride Partners</Text>
        <Text style={styles.subtitle}>
          Select students to share your ride with
        </Text>

        {/* Your Request Summary */}
        <View style={styles.yourRequestCard}>
          <Text style={styles.yourRequestLabel}>Your Request</Text>
          <View style={styles.routeContainer}>
            <Ionicons name="location" size={16} color="#10b981" />
            <Text style={styles.locationText} numberOfLines={1}>
              {myRequest.origin.address}
            </Text>
          </View>
          <View style={styles.arrow}>
            <Ionicons name="arrow-down" size={14} color="#718096" />
          </View>
          <View style={styles.routeContainer}>
            <Ionicons name="flag" size={16} color="#ef4444" />
            <Text style={styles.locationText} numberOfLines={1}>
              {myRequest.destination.address}
            </Text>
          </View>
          <View style={styles.requestMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={14} color="#718096" />
              <Text style={styles.metaText}>
                {new Date(myRequest.departureTime).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="cash-outline" size={14} color="#718096" />
              <Text style={styles.metaText}>৳{myRequest.maxPricePerSeat}</Text>
            </View>
          </View>
        </View>

        {/* Match Count */}
        {matches && matches.length > 0 && (
          <View style={styles.matchCountContainer}>
            <Ionicons name="people" size={20} color="#3182ce" />
            <Text style={styles.matchCountText}>
              {matches.length} potential match{matches.length !== 1 ? 'es' : ''} found
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="sad-outline" size={64} color="#cbd5e0" />
      <Text style={styles.emptyTitle}>No Matches Found</Text>
      <Text style={styles.emptyText}>
        No compatible ride partners found at this time. Try adjusting your preferences or check back later.
      </Text>
      <TouchableOpacity style={styles.refreshButton} onPress={() => refetch()}>
        <Ionicons name="refresh" size={20} color="#fff" />
        <Text style={styles.refreshButtonText}>Refresh</Text>
      </TouchableOpacity>
    </View>
  );

  const renderFooter = () => {
    if (!matches || matches.length === 0) return null;

    return (
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.createMatchButton,
            (selectedMatches.length === 0 || createMatchMutation.isPending) && styles.createMatchButtonDisabled,
          ]}
          onPress={handleCreateMatch}
          disabled={selectedMatches.length === 0 || createMatchMutation.isPending}
        >
          {createMatchMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="people" size={20} color="#fff" />
              <Text style={styles.createMatchButtonText}>
                Create Match Group ({selectedMatches.length})
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  if (loadingRequest || loadingMatches) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3182ce" />
        <Text style={styles.loadingText}>Finding compatible matches...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={matches}
        renderItem={renderMatchCard}
        keyExtractor={(item) => item.requestId}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={!loadingMatches ? renderEmptyState : null}
        contentContainerStyle={[
          styles.listContainer,
          (!matches || matches.length === 0) && styles.listContainerEmpty,
        ]}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        showsVerticalScrollIndicator={false}
      />
      {renderFooter()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
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
  listContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  listContainerEmpty: {
    flexGrow: 1,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#718096',
    marginBottom: 16,
  },
  yourRequestCard: {
    backgroundColor: '#ebf8ff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#bee3f8',
  },
  yourRequestLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2c5282',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  routeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    flex: 1,
    fontSize: 14,
    color: '#1a365d',
    marginLeft: 8,
    fontWeight: '500',
  },
  arrow: {
    paddingLeft: 4,
    paddingVertical: 2,
  },
  requestMeta: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 13,
    color: '#4a5568',
    marginLeft: 4,
  },
  matchCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  matchCountText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3182ce',
    marginLeft: 8,
  },
  matchCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  matchCardSelected: {
    borderColor: '#3182ce',
    backgroundColor: '#f7fafc',
  },
  selectionIndicator: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#cbd5e0',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#3182ce',
    borderColor: '#3182ce',
  },
  scoreBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  scoreText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 12,
    gap: 12,
  },
  userInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a365d',
  },
  userDepartment: {
    fontSize: 13,
    color: '#718096',
    marginTop: 2,
  },
  matchDetails: {
    marginBottom: 12,
  },
  matchLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailText: {
    fontSize: 13,
    color: '#4a5568',
    marginLeft: 6,
  },
  bonusSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
    gap: 6,
  },
  bonusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  bonusText: {
    fontSize: 11,
    color: '#1e40af',
    marginLeft: 4,
    fontWeight: '500',
  },
  routePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f7fafc',
    padding: 8,
    borderRadius: 8,
    gap: 8,
  },
  routeText: {
    flex: 1,
    fontSize: 12,
    color: '#4a5568',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2d3748',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: '#718096',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3182ce',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  createMatchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3182ce',
    paddingVertical: 16,
    borderRadius: 12,
  },
  createMatchButtonDisabled: {
    backgroundColor: '#cbd5e0',
  },
  createMatchButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default FindMatchesScreen;
