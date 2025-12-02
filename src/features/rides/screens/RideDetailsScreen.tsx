import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useAuth } from '@/features/auth/context/AuthContext';
import { Ride, MainTabParamList } from '@/types';
import { createRideRequest, hasUserRequestedRide } from '../services/rideRequestService';

type RideDetailsRouteProp = RouteProp<MainTabParamList, 'RideDetails'>;
type RideDetailsNavigationProp = BottomTabNavigationProp<MainTabParamList>;

const RideDetailsScreen: React.FC = () => {
  const route = useRoute<RideDetailsRouteProp>();
  const navigation = useNavigation<RideDetailsNavigationProp>();
  const { user, userProfile } = useAuth();
  const { ride } = route.params;
  
  const [seatsRequested, setSeatsRequested] = useState(1);
  const [isRequesting, setIsRequesting] = useState(false);
  const [hasRequested, setHasRequested] = useState(false);
  const [isCheckingRequest, setIsCheckingRequest] = useState(true);

  const isDriver = ride.driverId === user?.uid;
  const isVerified = userProfile?.isVerified && userProfile?.isStudentVerified;

  // Check if user has already requested this ride
  useEffect(() => {
    const checkRequest = async () => {
      if (user?.uid && ride.id && !isDriver) {
        try {
          const requested = await hasUserRequestedRide(ride.id, user.uid);
          setHasRequested(requested);
        } catch (error) {
          console.error('Error checking request status:', error);
        } finally {
          setIsCheckingRequest(false);
        }
      } else {
        setIsCheckingRequest(false);
      }
    };
    checkRequest();
  }, [user, ride.id, isDriver]);

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  };

  const handleRequestRide = async () => {
    if (!user || !userProfile) {
      Alert.alert('Error', 'Please login to request a ride');
      return;
    }

    if (!isVerified) {
      Alert.alert(
        'Verification Required',
        'You need to verify your email and student ID before requesting rides.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Verify Now', onPress: () => navigation.navigate('AccountVerification') }
        ]
      );
      return;
    }

    if (ride.safetyFeatures.requireVerifiedStudents && !userProfile.isStudentVerified) {
      Alert.alert(
        'Student Verification Required',
        'This ride requires verified students only. Please complete student verification.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Verify', onPress: () => navigation.navigate('AccountVerification') }
        ]
      );
      return;
    }

    Alert.alert(
      'Request Ride',
      `Request ${seatsRequested} seat(s) for ৳${ride.pricePerSeat * seatsRequested}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              setIsRequesting(true);
              await createRideRequest({
                rideId: ride.id,
                passengerId: user.uid,
                seatsRequested,
                message: '',
              });
              Alert.alert(
                'Request Sent!',
                'Your ride request has been sent to the driver. You will be notified once they respond.',
                [{ text: 'OK', onPress: () => navigation.goBack() }]
              );
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to request ride');
            } finally {
              setIsRequesting(false);
            }
          }
        }
      ]
    );
  };

  const handleCall = () => {
    if (ride.driver?.phoneNumber) {
      Linking.openURL(`tel:${ride.driver.phoneNumber}`);
    }
  };

  const handleOpenMaps = (location: { latitude?: number; longitude?: number; address?: string }, label: string) => {
    if (location.latitude && location.longitude) {
      const url = `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`;
      Linking.openURL(url);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1a365d" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Ride Details</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Route Information */}
        <View style={styles.card}>
          <View style={styles.routeContainer}>
            <View style={styles.routePoint}>
              <View style={styles.originDot} />
              <View style={styles.routeInfo}>
                <Text style={styles.routeLabel}>Pickup</Text>
                <Text style={styles.routeAddress}>{ride.origin.address}</Text>
                <TouchableOpacity
                  onPress={() => handleOpenMaps(ride.origin, 'Pickup')}
                  style={styles.mapLink}
                >
                  <Ionicons name="map-outline" size={16} color="#3182ce" />
                  <Text style={styles.mapLinkText}>Open in Maps</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.routeLine} />

            <View style={styles.routePoint}>
              <View style={styles.destinationDot} />
              <View style={styles.routeInfo}>
                <Text style={styles.routeLabel}>Drop-off</Text>
                <Text style={styles.routeAddress}>{ride.destination.address}</Text>
                <TouchableOpacity
                  onPress={() => handleOpenMaps(ride.destination, 'Drop-off')}
                  style={styles.mapLink}
                >
                  <Ionicons name="map-outline" size={16} color="#3182ce" />
                  <Text style={styles.mapLinkText}>Open in Maps</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* Time & Price */}
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Ionicons name="calendar-outline" size={24} color="#3182ce" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Departure</Text>
                <Text style={styles.infoValue}>{formatDate(ride.departureTime)}</Text>
                <Text style={styles.infoTime}>{formatTime(ride.departureTime)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <View style={styles.priceInfo}>
              <Ionicons name="cash-outline" size={24} color="#38a169" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Price per Seat</Text>
                <Text style={styles.priceValue}>৳{ride.pricePerSeat}</Text>
              </View>
            </View>
            <View style={styles.seatsInfo}>
              <Ionicons name="person-outline" size={24} color="#805ad5" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Available Seats</Text>
                <Text style={styles.seatsValue}>{ride.availableSeats}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Driver Information */}
        {ride.driver && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Driver Information</Text>
            <View style={styles.driverContainer}>
              <View style={styles.driverAvatar}>
                <Text style={styles.driverInitial}>
                  {ride.driver.firstName.charAt(0)}{ride.driver.lastName.charAt(0)}
                </Text>
              </View>
              <View style={styles.driverInfo}>
                <View style={styles.driverNameRow}>
                  <Text style={styles.driverName}>
                    {ride.driver.firstName} {ride.driver.lastName}
                  </Text>
                  {ride.driver.isStudentVerified && (
                    <View style={styles.verifiedBadge}>
                      <Ionicons name="shield-checkmark" size={16} color="#38a169" />
                    </View>
                  )}
                </View>
                <View style={styles.driverStats}>
                  <Ionicons name="star" size={14} color="#fbbf24" />
                  <Text style={styles.driverRating}>
                    {ride.driver.rating.toFixed(1)}
                  </Text>
                  <Text style={styles.driverRides}>
                    • {ride.driver.totalRides} rides
                  </Text>
                </View>
                {ride.driver.studentId && (
                  <Text style={styles.studentId}>Student ID: {ride.driver.studentId}</Text>
                )}
              </View>
              {!isDriver && (
                <TouchableOpacity onPress={handleCall} style={styles.callButton}>
                  <Ionicons name="call" size={20} color="#ffffff" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Preferences */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Ride Preferences</Text>
          <View style={styles.preferencesList}>
            <View style={styles.preferenceItem}>
              <Ionicons
                name={ride.preferences.smokingAllowed ? 'checkmark-circle' : 'close-circle'}
                size={20}
                color={ride.preferences.smokingAllowed ? '#38a169' : '#e53e3e'}
              />
              <Text style={styles.preferenceText}>
                Smoking {ride.preferences.smokingAllowed ? 'Allowed' : 'Not Allowed'}
              </Text>
            </View>
            <View style={styles.preferenceItem}>
              <Ionicons
                name={ride.preferences.petsAllowed ? 'checkmark-circle' : 'close-circle'}
                size={20}
                color={ride.preferences.petsAllowed ? '#38a169' : '#e53e3e'}
              />
              <Text style={styles.preferenceText}>
                Pets {ride.preferences.petsAllowed ? 'Allowed' : 'Not Allowed'}
              </Text>
            </View>
            <View style={styles.preferenceItem}>
              <Ionicons
                name={ride.preferences.musicAllowed ? 'checkmark-circle' : 'close-circle'}
                size={20}
                color={ride.preferences.musicAllowed ? '#38a169' : '#e53e3e'}
              />
              <Text style={styles.preferenceText}>
                Music {ride.preferences.musicAllowed ? 'Allowed' : 'Not Allowed'}
              </Text>
            </View>
            {ride.preferences.genderPreference !== 'any' && (
              <View style={styles.preferenceItem}>
                <Ionicons name="people" size={20} color="#805ad5" />
                <Text style={styles.preferenceText}>
                  {ride.preferences.genderPreference === 'female_only' ? 'Female Only' : 'Male Only'}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Safety Features */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Safety Features</Text>
          <View style={styles.safetyList}>
            {ride.safetyFeatures.requireVerifiedStudents && (
              <View style={styles.safetyItem}>
                <Ionicons name="shield-checkmark" size={20} color="#38a169" />
                <Text style={styles.safetyText}>Verified Students Only</Text>
              </View>
            )}
            {ride.safetyFeatures.shareLocationWithContacts && (
              <View style={styles.safetyItem}>
                <Ionicons name="location" size={20} color="#3182ce" />
                <Text style={styles.safetyText}>Location Shared with Contacts</Text>
              </View>
            )}
            {ride.safetyFeatures.enableSOSButton && (
              <View style={styles.safetyItem}>
                <Ionicons name="warning" size={20} color="#e53e3e" />
                <Text style={styles.safetyText}>Emergency SOS Available</Text>
              </View>
            )}
          </View>
        </View>

        {/* Description */}
        {ride.description && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Special Notes</Text>
            <Text style={styles.description}>{ride.description}</Text>
          </View>
        )}

        {/* Request Button (for passengers) */}
        {!isDriver && (
          <View style={styles.bottomSection}>
            {!hasRequested ? (
              <>
                <View style={styles.seatSelector}>
                  <Text style={styles.seatLabel}>Number of Seats:</Text>
                  <View style={styles.seatButtons}>
                    {[1, 2, 3, 4].map((num) => (
                      <TouchableOpacity
                        key={num}
                        style={[
                          styles.seatButton,
                          seatsRequested === num && styles.seatButtonActive,
                          num > ride.availableSeats && styles.seatButtonDisabled
                        ]}
                        onPress={() => setSeatsRequested(num)}
                        disabled={num > ride.availableSeats}
                      >
                        <Text style={[
                          styles.seatButtonText,
                          seatsRequested === num && styles.seatButtonTextActive
                        ]}>
                          {num}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.totalPrice}>
                  <Text style={styles.totalLabel}>Total Fare:</Text>
                  <Text style={styles.totalValue}>৳{ride.pricePerSeat * seatsRequested}</Text>
                </View>

                <TouchableOpacity
                  style={[styles.requestButton, isRequesting && styles.requestButtonDisabled]}
                  onPress={handleRequestRide}
                  disabled={isRequesting || ride.availableSeats === 0}
                >
                  <Ionicons name="send" size={20} color="#ffffff" />
                  <Text style={styles.requestButtonText}>
                    {isRequesting ? 'Sending Request...' : 'Request to Join Ride'}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.requestedBanner}>
                <Ionicons name="checkmark-circle" size={24} color="#38a169" />
                <Text style={styles.requestedText}>Request Sent - Waiting for Driver</Text>
              </View>
            )}
          </View>
        )}

        {/* Driver View */}
        {isDriver && (
          <View style={styles.driverBanner}>
            <Ionicons name="car" size={24} color="#3182ce" />
            <Text style={styles.driverBannerText}>This is your ride</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a365d',
  },
  placeholder: {
    width: 40,
  },
  card: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 18,
    padding: 22,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  routeContainer: {
    paddingVertical: 8,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  originDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#38a169',
    marginTop: 2,
  },
  destinationDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#e53e3e',
    marginTop: 2,
  },
  routeLine: {
    width: 2,
    height: 40,
    backgroundColor: '#cbd5e0',
    marginLeft: 7,
    marginVertical: 4,
  },
  routeInfo: {
    flex: 1,
    marginLeft: 16,
  },
  routeLabel: {
    fontSize: 12,
    color: '#718096',
    marginBottom: 4,
  },
  routeAddress: {
    fontSize: 16,
    color: '#2d3748',
    fontWeight: '500',
    marginBottom: 8,
  },
  mapLink: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mapLinkText: {
    fontSize: 14,
    color: '#3182ce',
    marginLeft: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoItem: {
    flexDirection: 'row',
    flex: 1,
  },
  infoContent: {
    marginLeft: 12,
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#718096',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    color: '#2d3748',
    fontWeight: '500',
  },
  infoTime: {
    fontSize: 16,
    color: '#3182ce',
    fontWeight: '600',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 16,
  },
  priceInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  seatsInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  priceValue: {
    fontSize: 24,
    color: '#38a169',
    fontWeight: 'bold',
  },
  seatsValue: {
    fontSize: 24,
    color: '#805ad5',
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a365d',
    marginBottom: 16,
  },
  driverContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3182ce',
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverInitial: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  driverInfo: {
    flex: 1,
    marginLeft: 12,
  },
  driverNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d3748',
  },
  verifiedBadge: {
    marginLeft: 8,
  },
  driverStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  driverRating: {
    fontSize: 14,
    color: '#2d3748',
    marginLeft: 4,
  },
  driverRides: {
    fontSize: 14,
    color: '#718096',
    marginLeft: 4,
  },
  studentId: {
    fontSize: 12,
    color: '#718096',
    marginTop: 4,
  },
  callButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#38a169',
    justifyContent: 'center',
    alignItems: 'center',
  },
  preferencesList: {
    gap: 12,
  },
  preferenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  preferenceText: {
    fontSize: 14,
    color: '#2d3748',
    marginLeft: 12,
  },
  safetyList: {
    gap: 12,
  },
  safetyItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  safetyText: {
    fontSize: 14,
    color: '#2d3748',
    marginLeft: 12,
  },
  description: {
    fontSize: 14,
    color: '#4a5568',
    lineHeight: 20,
  },
  bottomSection: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  seatSelector: {
    marginBottom: 16,
  },
  seatLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 12,
  },
  seatButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  seatButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  seatButtonActive: {
    borderColor: '#3182ce',
    backgroundColor: '#ebf8ff',
  },
  seatButtonDisabled: {
    opacity: 0.3,
  },
  seatButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#718096',
  },
  seatButtonTextActive: {
    color: '#3182ce',
  },
  totalPrice: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d3748',
  },
  totalValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#38a169',
  },
  requestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3182ce',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  requestButtonDisabled: {
    backgroundColor: '#a0aec0',
  },
  requestButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  requestedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0fff4',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  requestedText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#38a169',
  },
  driverBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ebf8ff',
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  driverBannerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3182ce',
  },
});

export default RideDetailsScreen;
