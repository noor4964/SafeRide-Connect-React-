import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useUser } from '@/features/auth/hooks/useUser';
import { getRides, getRidesNearLocation } from '@/features/rides/services/ridesService';
import { Ride, Location as LocationType } from '@/types';

// TODO: Create proper RideCard component
const RideCard: React.FC<{ ride: Ride; onPress: () => void }> = ({ ride, onPress }) => {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <TouchableOpacity style={styles.rideCard} onPress={onPress}>
      <View style={styles.rideHeader}>
        <View style={styles.routeContainer}>
          <Text style={styles.routeText} numberOfLines={1}>
            {ride.origin.address} → {ride.destination.address}
          </Text>
        </View>
        <View style={styles.priceContainer}>
          <Text style={styles.priceText}>${ride.pricePerSeat}</Text>
        </View>
      </View>
      
      <View style={styles.rideDetails}>
        <View style={styles.detailItem}>
          <Ionicons name="time-outline" size={16} color="#718096" />
          <Text style={styles.detailText}>{formatDate(ride.departureTime)}</Text>
        </View>
        
        <View style={styles.detailItem}>
          <Ionicons name="people-outline" size={16} color="#718096" />
          <Text style={styles.detailText}>
            {ride.availableSeats} seat{ride.availableSeats !== 1 ? 's' : ''} available
          </Text>
        </View>
      </View>

      {ride.driver && (
        <View style={styles.driverInfo}>
          <View style={styles.driverAvatar}>
            <Text style={styles.driverInitial}>
              {ride.driver.firstName.charAt(0)}
            </Text>
          </View>
          <View style={styles.driverDetails}>
            <Text style={styles.driverName}>
              {ride.driver.firstName} {ride.driver.lastName.charAt(0)}.
            </Text>
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={14} color="#fbbf24" />
              <Text style={styles.ratingText}>
                {ride.driver.rating.toFixed(1)} ({ride.driver.totalRides} rides)
              </Text>
              {ride.driver.isStudentVerified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="shield-checkmark" size={12} color="#10b981" />
                </View>
              )}
            </View>
          </View>
        </View>
      )}

      {/* Safety indicators */}
      <View style={styles.safetyIndicators}>
        {ride.safetyFeatures.requireVerifiedStudents && (
          <View style={styles.safetyBadge}>
            <Ionicons name="shield" size={12} color="#10b981" />
            <Text style={styles.safetyBadgeText}>Students Only</Text>
          </View>
        )}
        {ride.safetyFeatures.shareLocationWithContacts && (
          <View style={styles.safetyBadge}>
            <Ionicons name="location" size={12} color="#3182ce" />
            <Text style={styles.safetyBadgeText}>Location Shared</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const HomeScreen: React.FC = () => {
  const { userProfile } = useUser();
  const [searchQuery, setSearchQuery] = useState('');
  const [userLocation, setUserLocation] = useState<LocationType | null>(null);
  const [locationPermission, setLocationPermission] = useState<boolean>(false);

  // Request location permission and get current location
  useEffect(() => {
    const requestLocationPermission = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          setLocationPermission(true);
          const location = await Location.getCurrentPositionAsync({});
          setUserLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
        } else {
          Alert.alert(
            'Location Permission',
            'Location access is needed to find nearby rides and provide safety features.'
          );
        }
      } catch (error) {
        console.error('Error requesting location:', error);
      }
    };

    requestLocationPermission();
  }, []);

  // Fetch rides based on location or general query
  const {
    data: rides,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['rides', userLocation, searchQuery],
    queryFn: () => {
      if (userLocation && !searchQuery) {
        return getRidesNearLocation(userLocation, 10); // 10km radius
      }
      return getRides({ searchQuery });
    },
    enabled: !!userProfile,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const handleRidePress = (ride: Ride) => {
    // TODO: Navigate to ride details screen
    Alert.alert(
      'Ride Details',
      `From: ${ride.origin.address}\nTo: ${ride.destination.address}\nPrice: $${ride.pricePerSeat}\n\nTODO: Open ride details and request ride functionality.`
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="car-outline" size={64} color="#a0aec0" />
      <Text style={styles.emptyStateTitle}>No rides found</Text>
      <Text style={styles.emptyStateText}>
        {!locationPermission
          ? 'Enable location to find nearby rides'
          : searchQuery
          ? 'Try adjusting your search terms'
          : 'Be the first to post a ride in your area!'
        }
      </Text>
      <TouchableOpacity style={styles.emptyStateButton}>
        <Text style={styles.emptyStateButtonText}>Post a Ride</Text>
      </TouchableOpacity>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.welcomeText}>
        Welcome back, {userProfile?.firstName}!
      </Text>
      
      {/* Student verification reminder */}
      {userProfile && !userProfile.isStudentVerified && (
        <TouchableOpacity style={styles.verificationReminder}>
          <Ionicons name="shield-outline" size={20} color="#f56565" />
          <Text style={styles.verificationText}>
            Verify your student status to access all rides
          </Text>
          <Ionicons name="chevron-forward" size={16} color="#f56565" />
        </TouchableOpacity>
      )}

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#a0aec0" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Where are you going?"
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => setSearchQuery('')}
          >
            <Ionicons name="close-circle" size={20} color="#a0aec0" />
          </TouchableOpacity>
        )}
      </View>

      {/* Quick safety access */}
      <TouchableOpacity style={styles.sosButton}>
        <Ionicons name="shield-checkmark" size={20} color="#ffffff" />
        <Text style={styles.sosButtonText}>Emergency SOS</Text>
      </TouchableOpacity>
    </View>
  );

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error loading rides</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={rides || []}
        renderItem={({ item }) => (
          <RideCard ride={item} onPress={() => handleRidePress(item)} />
        )}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={!isLoading ? renderEmptyState : null}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
        contentContainerStyle={[
          styles.listContainer,
          (!rides || rides.length === 0) && styles.listContainerEmpty,
        ]}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  listContainer: {
    paddingHorizontal: 16,
  },
  listContainerEmpty: {
    flexGrow: 1,
  },
  header: {
    paddingVertical: 20,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a365d',
    marginBottom: 16,
  },
  verificationReminder: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fed7d7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  verificationText: {
    flex: 1,
    color: '#c53030',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#2d3748',
  },
  clearButton: {
    marginLeft: 8,
  },
  sosButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e53e3e',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  sosButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  rideCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  routeContainer: {
    flex: 1,
    marginRight: 12,
  },
  routeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a365d',
  },
  priceContainer: {
    backgroundColor: '#e6fffa',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  priceText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#00a693',
  },
  rideDetails: {
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  detailText: {
    fontSize: 14,
    color: '#718096',
    marginLeft: 8,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  driverAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3182ce',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  driverInitial: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 2,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 12,
    color: '#718096',
    marginLeft: 4,
  },
  verifiedBadge: {
    marginLeft: 8,
  },
  safetyIndicators: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  safetyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 4,
  },
  safetyBadgeText: {
    fontSize: 10,
    color: '#1e40af',
    marginLeft: 4,
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2d3748',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#718096',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyStateButton: {
    backgroundColor: '#3182ce',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyStateButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 18,
    color: '#e53e3e',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#3182ce',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default HomeScreen;