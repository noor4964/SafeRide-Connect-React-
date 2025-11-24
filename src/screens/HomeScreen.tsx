import React, { useState, useEffect, useMemo } from 'react';
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
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import MapView, { Marker, PROVIDER_GOOGLE, Callout } from 'react-native-maps';
import { distanceBetween } from 'geofire-common';
import { useUser } from '@/features/auth/hooks/useUser';
import { useAuth } from '@/features/auth/context/AuthContext';
import { getRides, getRidesNearLocation } from '@/features/rides/services/ridesService';
import { Ride, Location as LocationType, MainTabParamList } from '@/types';
import { useTheme } from '@/context/ThemeContext';

type HomeScreenNavigationProp = BottomTabNavigationProp<MainTabParamList, 'Home'>;

// TODO: Create proper RideCard component
const RideCard: React.FC<{ ride: Ride; onPress: () => void; userLocation?: LocationType }> = ({ ride, onPress, userLocation }) => {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  };

  const calculateDistance = () => {
    if (!userLocation) return null;
    const distanceKm = distanceBetween(
      [userLocation.latitude, userLocation.longitude],
      [ride.origin.latitude, ride.origin.longitude]
    );
    return distanceKm < 1 ? `${(distanceKm * 1000).toFixed(0)}m` : `${distanceKm.toFixed(1)}km`;
  };

  const distance = calculateDistance();

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

        {distance && (
          <View style={styles.detailItem}>
            <Ionicons name="location-outline" size={16} color="#10b981" />
            <Text style={[styles.detailText, { color: '#10b981' }]}>{distance} away</Text>
          </View>
        )}
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
  const { user } = useAuth();
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const { colors } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [userLocation, setUserLocation] = useState<LocationType | null>(null);
  const [locationPermission, setLocationPermission] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    genderPreference: 'any' as 'any' | 'female_only' | 'male_only',
    verifiedOnly: false,
    maxPrice: 1000,
  });

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

  // Real-time rides with location-based sorting
  const {
    data: rides,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['rides', userLocation, searchQuery],
    queryFn: () => {
      if (userLocation && !searchQuery) {
        return getRidesNearLocation(userLocation, 15); // 15km radius
      }
      return getRides({ searchQuery });
    },
    enabled: !!userProfile,
    staleTime: 30 * 1000, // 30 seconds for real-time feel
    refetchInterval: 30 * 1000, // Auto-refetch every 30 seconds
  });

  // Filter and sort rides
  const filteredRides = useMemo(() => {
    if (!rides) return [];
    
    let filtered = rides.filter((ride) => {
      // Gender filter
      if (filters.genderPreference !== 'any' && ride.preferences.genderPreference !== filters.genderPreference) {
        return false;
      }
      
      // Verified only filter
      if (filters.verifiedOnly && !ride.driver?.isStudentVerified) {
        return false;
      }
      
      // Max price filter
      if (ride.pricePerSeat > filters.maxPrice) {
        return false;
      }
      
      return true;
    });
    
    // Sort by distance if user location available
    if (userLocation) {
      filtered = filtered.sort((a, b) => {
        const distA = distanceBetween(
          [userLocation.latitude, userLocation.longitude],
          [a.origin.latitude, a.origin.longitude]
        );
        const distB = distanceBetween(
          [userLocation.latitude, userLocation.longitude],
          [b.origin.latitude, b.origin.longitude]
        );
        return distA - distB;
      });
    }
    
    return filtered;
  }, [rides, filters, userLocation]);

  const handleRidePress = (ride: Ride) => {
    navigation.navigate('RideDetails', { ride });
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
          : ''
        }
      </Text>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.welcomeText}>
        Welcome back, {userProfile?.firstName}!
      </Text>
      
      {/* Email and Student verification reminder */}
      {(!userProfile?.isVerified || !userProfile?.isStudentVerified) && (
        <TouchableOpacity 
          style={styles.verificationReminder}
          onPress={() => navigation.navigate('AccountVerification')}
          activeOpacity={0.7}
        >
          <Ionicons name="shield-outline" size={20} color="#f56565" />
          <Text style={styles.verificationText}>
            {!userProfile?.isVerified && !userProfile?.isStudentVerified
              ? 'Verify your email and student status to unlock all features'
              : !userProfile?.isVerified
              ? 'Verify your email to unlock all features'
              : 'Verify your student status to access all rides'}
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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* View Toggle and Filter Buttons */}
      <View style={styles.actionBar}>
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.viewButton, viewMode === 'list' && styles.viewButtonActive]}
            onPress={() => setViewMode('list')}
          >
            <Ionicons name="list" size={20} color={viewMode === 'list' ? '#fff' : '#718096'} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewButton, viewMode === 'map' && styles.viewButtonActive]}
            onPress={() => setViewMode('map')}
          >
            <Ionicons name="map" size={20} color={viewMode === 'map' ? '#fff' : '#718096'} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilters(true)}
        >
          <Ionicons name="options" size={20} color="#3182ce" />
          <Text style={styles.filterButtonText}>Filters</Text>
        </TouchableOpacity>
      </View>

      {/* List View */}
      {viewMode === 'list' && (
        <FlatList
          data={filteredRides}
          renderItem={({ item }) => (
            <RideCard ride={item} onPress={() => handleRidePress(item)} userLocation={userLocation || undefined} />
          )}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={!isLoading ? renderEmptyState : null}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refetch} />
          }
          contentContainerStyle={[
            styles.listContainer,
            (!filteredRides || filteredRides.length === 0) && styles.listContainerEmpty,
          ]}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Map View */}
      {viewMode === 'map' && userLocation && (
        <MapView
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={{
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
            latitudeDelta: 0.1,
            longitudeDelta: 0.1,
          }}
          showsUserLocation
          showsMyLocationButton
        >
          {filteredRides.map((ride) => (
            <Marker
              key={ride.id}
              coordinate={{
                latitude: ride.origin.latitude,
                longitude: ride.origin.longitude,
              }}
              title={`${ride.origin.address} → ${ride.destination.address}`}
              description={`$${ride.pricePerSeat} • ${ride.availableSeats} seats`}
              onCalloutPress={() => handleRidePress(ride)}
            >
              <View style={styles.markerContainer}>
                <Ionicons name="car" size={24} color="#3182ce" />
              </View>
              <Callout>
                <View style={styles.calloutContainer}>
                  <Text style={styles.calloutTitle}>
                    {ride.origin.address} → {ride.destination.address}
                  </Text>
                  <Text style={styles.calloutPrice}>${ride.pricePerSeat}/seat</Text>
                  <Text style={styles.calloutSeats}>{ride.availableSeats} seats available</Text>
                </View>
              </Callout>
            </Marker>
          ))}
        </MapView>
      )}

      {/* Filter Modal */}
      <Modal
        visible={showFilters}
        animationType="slide"
        transparent
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter Rides</Text>
              <TouchableOpacity onPress={() => setShowFilters(false)}>
                <Ionicons name="close" size={24} color="#1a365d" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              {/* Gender Preference */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Gender Preference</Text>
                <View style={styles.filterButtons}>
                  <TouchableOpacity
                    style={[styles.filterChip, filters.genderPreference === 'any' && styles.filterChipActive]}
                    onPress={() => setFilters({ ...filters, genderPreference: 'any' })}
                  >
                    <Text style={[styles.filterChipText, filters.genderPreference === 'any' && styles.filterChipTextActive]}>
                      Any
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.filterChip, filters.genderPreference === 'female_only' && styles.filterChipActive]}
                    onPress={() => setFilters({ ...filters, genderPreference: 'female_only' })}
                  >
                    <Text style={[styles.filterChipText, filters.genderPreference === 'female_only' && styles.filterChipTextActive]}>
                      Female Only
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.filterChip, filters.genderPreference === 'male_only' && styles.filterChipActive]}
                    onPress={() => setFilters({ ...filters, genderPreference: 'male_only' })}
                  >
                    <Text style={[styles.filterChipText, filters.genderPreference === 'male_only' && styles.filterChipTextActive]}>
                      Male Only
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Verified Drivers Only */}
              <View style={styles.filterSection}>
                <View style={styles.filterRow}>
                  <View>
                    <Text style={styles.filterLabel}>Verified Drivers Only</Text>
                    <Text style={styles.filterHelp}>Show only student-verified drivers</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.toggle, filters.verifiedOnly && styles.toggleActive]}
                    onPress={() => setFilters({ ...filters, verifiedOnly: !filters.verifiedOnly })}
                  >
                    <View style={[styles.toggleThumb, filters.verifiedOnly && styles.toggleThumbActive]} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Max Price */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Maximum Price per Seat</Text>
                <Text style={styles.priceValue}>${filters.maxPrice}</Text>
                <View style={styles.priceButtons}>
                  {[200, 500, 1000, 2000].map((price) => (
                    <TouchableOpacity
                      key={price}
                      style={[styles.priceChip, filters.maxPrice === price && styles.priceChipActive]}
                      onPress={() => setFilters({ ...filters, maxPrice: price })}
                    >
                      <Text style={[styles.priceChipText, filters.maxPrice === price && styles.priceChipTextActive]}>
                        ${price}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Reset Button */}
              <TouchableOpacity
                style={styles.resetButton}
                onPress={() => setFilters({
                  genderPreference: 'any',
                  verifiedOnly: false,
                  maxPrice: 1000,
                })}
              >
                <Text style={styles.resetButtonText}>Reset Filters</Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.applyButton}
                onPress={() => setShowFilters(false)}
              >
                <Text style={styles.applyButtonText}>
                  Apply Filters ({filteredRides.length} rides)
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingVertical: 24,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
    letterSpacing: -0.5,
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
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginBottom: 16,
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f1f5f9',
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
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#f1f5f9',
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
    color: '#0f172a',
    lineHeight: 22,
  },
  priceContainer: {
    backgroundColor: '#d1fae5',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  priceText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#047857',
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
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: '#f7fafc',
    borderRadius: 8,
    padding: 2,
  },
  viewButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  viewButtonActive: {
    backgroundColor: '#3182ce',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#ebf8ff',
    borderRadius: 8,
  },
  filterButtonText: {
    color: '#3182ce',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  map: {
    flex: 1,
  },
  markerContainer: {
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#3182ce',
  },
  calloutContainer: {
    padding: 8,
    minWidth: 200,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a365d',
    marginBottom: 4,
  },
  calloutPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3182ce',
    marginBottom: 2,
  },
  calloutSeats: {
    fontSize: 12,
    color: '#718096',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a365d',
  },
  modalContent: {
    padding: 20,
  },
  filterSection: {
    marginBottom: 24,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 12,
  },
  filterHelp: {
    fontSize: 12,
    color: '#718096',
    marginTop: 2,
  },
  filterButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f7fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 8,
    marginBottom: 8,
  },
  filterChipActive: {
    backgroundColor: '#3182ce',
    borderColor: '#3182ce',
  },
  filterChipText: {
    fontSize: 14,
    color: '#4a5568',
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#cbd5e0',
    padding: 2,
  },
  toggleActive: {
    backgroundColor: '#48bb78',
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  toggleThumbActive: {
    marginLeft: 22,
  },
  priceValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3182ce',
    marginBottom: 12,
  },
  priceButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  priceChip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f7fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 8,
    marginBottom: 8,
  },
  priceChipActive: {
    backgroundColor: '#ebf8ff',
    borderColor: '#3182ce',
  },
  priceChipText: {
    fontSize: 16,
    color: '#4a5568',
    fontWeight: '600',
  },
  priceChipTextActive: {
    color: '#3182ce',
  },
  resetButton: {
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    marginTop: 8,
  },
  resetButtonText: {
    fontSize: 16,
    color: '#718096',
    fontWeight: '600',
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  applyButton: {
    backgroundColor: '#3182ce',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default HomeScreen;