import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useAuth } from '@/features/auth/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { getUserRideRequests } from '@/services/rideMatchingService';
import type { RideRequestType } from '@/types/rideMatching';
import type { MainTabParamList } from '@/types';

type MyRequestsNavigationProp = BottomTabNavigationProp<MainTabParamList, 'MyRequests'>;

const MyRequestsScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation<MyRequestsNavigationProp>();
  const { colors } = useTheme();
  const [filter, setFilter] = useState<'all' | 'searching' | 'matched'>('all');

  const {
    data: requests,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['userRideRequests', user?.uid],
    queryFn: () => getUserRideRequests(user?.uid || ''),
    enabled: !!user?.uid,
    staleTime: 30 * 1000,
  });

  const filteredRequests = requests?.filter((req) => {
    if (filter === 'all') return true;
    return req.status === filter;
  }) || [];

  const formatDateTime = (date: Date) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const reqDate = new Date(date);
    const reqDateOnly = new Date(reqDate.getFullYear(), reqDate.getMonth(), reqDate.getDate());

    let dateStr = '';
    if (reqDateOnly.getTime() === today.getTime()) {
      dateStr = 'Today';
    } else if (reqDateOnly.getTime() === tomorrow.getTime()) {
      dateStr = 'Tomorrow';
    } else {
      dateStr = reqDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    const timeStr = reqDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    return `${dateStr}, ${timeStr}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'searching':
        return '#f59e0b';
      case 'matched':
        return '#10b981';
      case 'riding':
        return '#3182ce';
      case 'completed':
        return '#718096';
      default:
        return '#718096';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'searching':
        return 'search';
      case 'matched':
        return 'checkmark-circle';
      case 'riding':
        return 'car';
      case 'completed':
        return 'checkmark-done';
      default:
        return 'help-circle';
    }
  };

  const renderRequestCard = ({ item }: { item: RideRequestType }) => (
    <TouchableOpacity style={styles.requestCard} activeOpacity={0.7}>
      {/* Status Badge */}
      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
        <Ionicons name={getStatusIcon(item.status)} size={12} color="#fff" />
        <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
      </View>

      {/* Route */}
      <View style={styles.routeContainer}>
        <View style={styles.locationRow}>
          <Ionicons name="location" size={18} color="#10b981" />
          <Text style={styles.locationText} numberOfLines={1}>
            {item.origin.address}
          </Text>
        </View>
        <View style={styles.arrow}>
          <Ionicons name="arrow-down" size={16} color="#718096" />
        </View>
        <View style={styles.locationRow}>
          <Ionicons name="flag" size={18} color="#ef4444" />
          <Text style={styles.locationText} numberOfLines={1}>
            {item.destination.address}
          </Text>
        </View>
      </View>

      {/* Details */}
      <View style={styles.detailsRow}>
        <View style={styles.detailItem}>
          <Ionicons name="time-outline" size={16} color="#718096" />
          <Text style={styles.detailText}>{formatDateTime(item.departureTime)}</Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="people-outline" size={16} color="#718096" />
          <Text style={styles.detailText}>{item.lookingForSeats} seat(s)</Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="cash-outline" size={16} color="#718096" />
          <Text style={styles.detailText}>৳{item.maxPricePerSeat}</Text>
        </View>
      </View>

      {/* Match Info */}
      {item.status === 'matched' && item.matchedWith.length > 0 && (
        <View style={styles.matchInfo}>
          <Ionicons name="people" size={16} color="#10b981" />
          <Text style={styles.matchText}>
            Matched with {item.matchedWith.length} student(s)
          </Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        {item.status === 'searching' && (
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('FindMatches', { requestId: item.id })}
          >
            <Ionicons name="search" size={16} color="#3182ce" />
            <Text style={styles.actionText}>Find Matches</Text>
          </TouchableOpacity>
        )}
        {item.status === 'matched' && item.matchedWith.length > 0 && (
          <TouchableOpacity 
            style={[styles.actionButton, styles.primaryButton]}
            onPress={() => navigation.navigate('MatchDetails', { matchId: item.matchedWith[0] })}
          >
            <Ionicons name="eye" size={16} color="#fff" />
            <Text style={[styles.actionText, { color: '#fff' }]}>View Details</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="ellipsis-horizontal" size={16} color="#718096" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="car-outline" size={64} color="#cbd5e0" />
      <Text style={styles.emptyTitle}>No Ride Requests</Text>
      <Text style={styles.emptyText}>
        {filter === 'searching'
          ? 'No active searches'
          : filter === 'matched'
          ? 'No matches yet'
          : 'Post a ride request to find travel partners'}
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3182ce" />
        <Text style={styles.loadingText}>Loading your requests...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            All ({requests?.length || 0})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'searching' && styles.filterTabActive]}
          onPress={() => setFilter('searching')}
        >
          <Text style={[styles.filterText, filter === 'searching' && styles.filterTextActive]}>
            Searching ({requests?.filter((r) => r.status === 'searching').length || 0})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'matched' && styles.filterTabActive]}
          onPress={() => setFilter('matched')}
        >
          <Text style={[styles.filterText, filter === 'matched' && styles.filterTextActive]}>
            Matched ({requests?.filter((r) => r.status === 'matched').length || 0})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Requests List */}
      <FlatList
        data={filteredRequests}
        renderItem={renderRequestCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContainer,
          filteredRequests.length === 0 && styles.listContainerEmpty,
        ]}
        ListEmptyComponent={renderEmptyState}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        showsVerticalScrollIndicator={false}
      />
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
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  filterTabActive: {
    borderBottomColor: '#3182ce',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#718096',
  },
  filterTextActive: {
    color: '#3182ce',
    fontWeight: '600',
  },
  listContainer: {
    padding: 16,
  },
  listContainerEmpty: {
    flexGrow: 1,
  },
  requestCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.09,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    marginLeft: 4,
  },
  routeContainer: {
    marginBottom: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    flex: 1,
    fontSize: 15,
    color: '#2d3748',
    marginLeft: 8,
    fontWeight: '500',
  },
  arrow: {
    paddingLeft: 4,
    paddingVertical: 2,
  },
  detailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 4,
  },
  detailText: {
    fontSize: 13,
    color: '#718096',
    marginLeft: 4,
  },
  matchInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d1fae5',
    padding: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  matchText: {
    fontSize: 13,
    color: '#065f46',
    fontWeight: '500',
    marginLeft: 6,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f7fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  primaryButton: {
    backgroundColor: '#3182ce',
    borderColor: '#3182ce',
    flex: 1,
    marginRight: 8,
    justifyContent: 'center',
    shadowColor: '#3182ce',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  actionText: {
    fontSize: 13,
    color: '#3182ce',
    fontWeight: '600',
    marginLeft: 4,
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
  },
});

export default MyRequestsScreen;
