import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import { geohashForLocation } from 'geofire-common';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useAuth } from '@/features/auth/context/AuthContext';
import { useUser } from '@/features/auth/hooks/useUser';
import { useTheme } from '@/context/ThemeContext';
import { createRideRequest } from '@/services/rideMatchingService';
import { MainTabParamList } from '@/types';

type PostRequestNavigationProp = BottomTabNavigationProp<MainTabParamList, 'PostRequest'>;

const PostRequestScreen: React.FC = () => {
  const navigation = useNavigation<PostRequestNavigationProp>();
  const { user } = useAuth();
  const { userProfile } = useUser();
  const { colors } = useTheme();

  // Location states
  const [originAddress, setOriginAddress] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [originCoords, setOriginCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [destCoords, setDestCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);

  // Time states
  const [departureTime, setDepartureTime] = useState(new Date(Date.now() + 30 * 60000)); // 30 mins from now
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [flexibility, setFlexibility] = useState(15); // minutes

  // Request details
  const [lookingForSeats, setLookingForSeats] = useState(1);
  const [maxPricePerSeat, setMaxPricePerSeat] = useState(200);
  const [maxWalkDistance, setMaxWalkDistance] = useState(500); // meters

  // Preferences
  const [genderPreference, setGenderPreference] = useState<'any' | 'female_only' | 'male_only'>('any');
  const [studentVerifiedOnly, setStudentVerifiedOnly] = useState(true);
  const [sameDepartmentPreferred, setSameDepartmentPreferred] = useState(false);

  // UI states
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get current location on mount
  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = async () => {
    try {
      setLoadingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to find your current location.');
        setLoadingLocation(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      // Reverse geocode to get address
      const addresses = await Location.reverseGeocodeAsync(coords);
      if (addresses.length > 0) {
        const addr = addresses[0];
        const formattedAddress = `${addr.street || ''}, ${addr.district || ''}, ${addr.city || ''}`.trim();
        setOriginAddress(formattedAddress || 'Current Location');
        setOriginCoords(coords);
      }

      setLoadingLocation(false);
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Could not get your current location');
      setLoadingLocation(false);
    }
  };

  const handleSetDestinationToAIUB = () => {
    const aiubCoords = {
      latitude: 23.792553,
      longitude: 90.407876,
    };
    setDestinationAddress('AIUB, Kuratoli, Dhaka');
    setDestCoords(aiubCoords);
  };

  const handleTimeChange = (event: any, selectedDate?: Date) => {
    try {
      // Hide picker on Android after any interaction
      if (Platform.OS === 'android') {
        setShowTimePicker(false);
      }
      
      // Update date if one was selected
      // On Android, event can be undefined when clicking OK
      if (selectedDate) {
        // Only skip update if explicitly dismissed
        if (!event || (event && event.type !== 'dismissed')) {
          setDepartureTime(selectedDate);
        }
      }
    } catch (error) {
      console.error('Date picker error:', error);
      if (Platform.OS === 'android') {
        setShowTimePicker(false);
      }
    }
  };

  const validateForm = (): boolean => {
    if (!originAddress || !originCoords) {
      Alert.alert('Missing Information', 'Please set your pickup location');
      return false;
    }

    if (!destinationAddress || !destCoords) {
      Alert.alert('Missing Information', 'Please set your destination');
      return false;
    }

    if (departureTime <= new Date()) {
      Alert.alert('Invalid Time', 'Departure time must be in the future');
      return false;
    }

    if (!userProfile?.isVerified) {
      Alert.alert(
        'Verification Required',
        'Please verify your email before posting ride requests',
        [{ text: 'OK' }]
      );
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm() || !user || !originCoords || !destCoords) return;

    try {
      setIsSubmitting(true);

      // Generate geohashes for location queries
      const originGeohash = geohashForLocation([originCoords.latitude, originCoords.longitude]);
      const destGeohash = geohashForLocation([destCoords.latitude, destCoords.longitude]);

      // Create ride request
      const requestId = await createRideRequest(user.uid, {
        origin: {
          latitude: originCoords.latitude,
          longitude: originCoords.longitude,
          address: originAddress,
          geohash: originGeohash,
        },
        destination: {
          latitude: destCoords.latitude,
          longitude: destCoords.longitude,
          address: destinationAddress,
          geohash: destGeohash,
        },
        departureTime,
        flexibility,
        maxWalkDistance,
        lookingForSeats,
        maxPricePerSeat,
        preferences: {
          genderPreference,
          studentVerifiedOnly,
          sameDepartmentPreferred,
        },
      });

      Alert.alert(
        'Request Posted! 🎉',
        'We\'re searching for compatible ride partners. You\'ll be notified when matches are found.',
        [
          {
            text: 'Find Matches Now',
            onPress: () => navigation.navigate('Home'),
          },
          {
            text: 'View My Requests',
            onPress: () => navigation.navigate('MyRequests'),
          },
        ]
      );

      setIsSubmitting(false);
    } catch (error) {
      console.error('Error creating ride request:', error);
      Alert.alert('Error', 'Failed to post ride request. Please try again.');
      setIsSubmitting(false);
    }
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Find Ride Partner</Text>
        <Text style={styles.subtitle}>
          Share a commercial ride with students going your way
        </Text>
      </View>

      {/* Verification Warning */}
      {!userProfile?.isStudentVerified && (
        <View style={styles.warningCard}>
          <Ionicons name="information-circle" size={20} color="#f59e0b" />
          <Text style={styles.warningText}>
            Verify your student status to access more matches
          </Text>
        </View>
      )}

      {/* Location Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📍 Route</Text>

        {/* Origin */}
        <View style={styles.locationCard}>
          <View style={styles.locationHeader}>
            <Ionicons name="location" size={20} color="#10b981" />
            <Text style={styles.locationLabel}>Pickup Location</Text>
          </View>
          <TextInput
            style={styles.locationInput}
            placeholder="Enter pickup location"
            value={originAddress}
            onChangeText={setOriginAddress}
            editable={!loadingLocation}
          />
          <TouchableOpacity
            style={styles.linkButton}
            onPress={getCurrentLocation}
            disabled={loadingLocation}
          >
            {loadingLocation ? (
              <ActivityIndicator size="small" color="#3182ce" />
            ) : (
              <>
                <Ionicons name="navigate" size={16} color="#3182ce" />
                <Text style={styles.linkButtonText}>Use Current Location</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Destination */}
        <View style={styles.locationCard}>
          <View style={styles.locationHeader}>
            <Ionicons name="flag" size={20} color="#ef4444" />
            <Text style={styles.locationLabel}>Destination</Text>
          </View>
          <TextInput
            style={styles.locationInput}
            placeholder="Enter destination"
            value={destinationAddress}
            onChangeText={setDestinationAddress}
          />
          <TouchableOpacity
            style={styles.linkButton}
            onPress={handleSetDestinationToAIUB}
          >
            <Ionicons name="school" size={16} color="#3182ce" />
            <Text style={styles.linkButtonText}>Set to AIUB</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Time Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🕐 When?</Text>

        <TouchableOpacity
          style={styles.timeCard}
          onPress={() => setShowTimePicker(true)}
        >
          <View style={styles.timeInfo}>
            <Text style={styles.timeDate}>{formatDate(departureTime)}</Text>
            <Text style={styles.timeValue}>{formatTime(departureTime)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#718096" />
        </TouchableOpacity>

        {showTimePicker && (
          <DateTimePicker
            value={departureTime}
            mode="datetime"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleTimeChange}
            minimumDate={new Date()}
          />
        )}

        {/* Flexibility */}
        <View style={styles.flexibilityContainer}>
          <Text style={styles.inputLabel}>Time Flexibility</Text>
          <View style={styles.flexibilityButtons}>
            {[0, 15, 30, 60].map((mins) => (
              <TouchableOpacity
                key={mins}
                style={[
                  styles.flexibilityChip,
                  flexibility === mins && styles.flexibilityChipActive,
                ]}
                onPress={() => setFlexibility(mins)}
              >
                <Text
                  style={[
                    styles.flexibilityChipText,
                    flexibility === mins && styles.flexibilityChipTextActive,
                  ]}
                >
                  {mins === 0 ? 'Exact' : `±${mins} min`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Request Details Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🎯 Details</Text>

        {/* Seats */}
        <View style={styles.detailRow}>
          <Text style={styles.inputLabel}>Seats Needed</Text>
          <View style={styles.counterContainer}>
            <TouchableOpacity
              style={styles.counterButton}
              onPress={() => setLookingForSeats(Math.max(1, lookingForSeats - 1))}
            >
              <Ionicons name="remove" size={20} color="#3182ce" />
            </TouchableOpacity>
            <Text style={styles.counterValue}>{lookingForSeats}</Text>
            <TouchableOpacity
              style={styles.counterButton}
              onPress={() => setLookingForSeats(Math.min(3, lookingForSeats + 1))}
            >
              <Ionicons name="add" size={20} color="#3182ce" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Max Price */}
        <View style={styles.detailRow}>
          <Text style={styles.inputLabel}>Max Price per Seat</Text>
          <View style={styles.priceButtons}>
            {[100, 150, 200, 300].map((price) => (
              <TouchableOpacity
                key={price}
                style={[
                  styles.priceChip,
                  maxPricePerSeat === price && styles.priceChipActive,
                ]}
                onPress={() => setMaxPricePerSeat(price)}
              >
                <Text
                  style={[
                    styles.priceChipText,
                    maxPricePerSeat === price && styles.priceChipTextActive,
                  ]}
                >
                  ৳{price}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Walk Distance */}
        <View style={styles.detailRow}>
          <Text style={styles.inputLabel}>Max Walk to Meetup</Text>
          <View style={styles.priceButtons}>
            {[200, 500, 1000].map((distance) => (
              <TouchableOpacity
                key={distance}
                style={[
                  styles.priceChip,
                  maxWalkDistance === distance && styles.priceChipActive,
                ]}
                onPress={() => setMaxWalkDistance(distance)}
              >
                <Text
                  style={[
                    styles.priceChipText,
                    maxWalkDistance === distance && styles.priceChipTextActive,
                  ]}
                >
                  {distance}m
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Preferences Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⚙️ Preferences</Text>

        {/* Gender Preference */}
        <View style={styles.preferenceRow}>
          <Text style={styles.inputLabel}>Gender Preference</Text>
          <View style={styles.genderButtons}>
            {[
              { value: 'any', label: 'Any' },
              { value: 'female_only', label: 'Female Only' },
              { value: 'male_only', label: 'Male Only' },
            ].map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.genderChip,
                  genderPreference === option.value && styles.genderChipActive,
                ]}
                onPress={() => setGenderPreference(option.value as any)}
              >
                <Text
                  style={[
                    styles.genderChipText,
                    genderPreference === option.value && styles.genderChipTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Toggles */}
        <TouchableOpacity
          style={styles.toggleRow}
          onPress={() => setStudentVerifiedOnly(!studentVerifiedOnly)}
        >
          <View style={styles.toggleInfo}>
            <Text style={styles.toggleLabel}>Student Verified Only</Text>
            <Text style={styles.toggleHelp}>Match only with verified students</Text>
          </View>
          <View style={[styles.toggle, studentVerifiedOnly && styles.toggleActive]}>
            <View style={[styles.toggleThumb, studentVerifiedOnly && styles.toggleThumbActive]} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.toggleRow}
          onPress={() => setSameDepartmentPreferred(!sameDepartmentPreferred)}
        >
          <View style={styles.toggleInfo}>
            <Text style={styles.toggleLabel}>Same Department Preferred</Text>
            <Text style={styles.toggleHelp}>Prefer students from your department</Text>
          </View>
          <View style={[styles.toggle, sameDepartmentPreferred && styles.toggleActive]}>
            <View style={[styles.toggleThumb, sameDepartmentPreferred && styles.toggleThumbActive]} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="search" size={20} color="#fff" />
            <Text style={styles.submitButtonText}>Find Ride Partners</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Info Card */}
      <View style={styles.infoCard}>
        <Ionicons name="information-circle-outline" size={20} color="#3182ce" />
        <Text style={styles.infoText}>
          We'll find students going your way at similar times. Share a commercial ride (Uber/Pathao) 
          and split the cost!
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a365d',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#718096',
    lineHeight: 22,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fcd34d',
  },
  warningText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#92400e',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 12,
  },
  locationCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4a5568',
    marginLeft: 8,
  },
  locationInput: {
    fontSize: 16,
    color: '#1a365d',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  linkButtonText: {
    fontSize: 14,
    color: '#3182ce',
    marginLeft: 4,
    fontWeight: '500',
  },
  timeCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  timeInfo: {
    flex: 1,
  },
  timeDate: {
    fontSize: 14,
    color: '#718096',
    marginBottom: 4,
  },
  timeValue: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a365d',
  },
  flexibilityContainer: {
    marginTop: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4a5568',
    marginBottom: 8,
  },
  flexibilityButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  flexibilityChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f7fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 8,
    marginBottom: 8,
  },
  flexibilityChipActive: {
    backgroundColor: '#3182ce',
    borderColor: '#3182ce',
  },
  flexibilityChipText: {
    fontSize: 14,
    color: '#4a5568',
    fontWeight: '500',
  },
  flexibilityChipTextActive: {
    color: '#fff',
  },
  detailRow: {
    marginBottom: 20,
  },
  counterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  counterButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ebf8ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a365d',
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
  preferenceRow: {
    marginBottom: 20,
  },
  genderButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  genderChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f7fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 8,
    marginBottom: 8,
  },
  genderChipActive: {
    backgroundColor: '#3182ce',
    borderColor: '#3182ce',
  },
  genderChipText: {
    fontSize: 14,
    color: '#4a5568',
    fontWeight: '500',
  },
  genderChipTextActive: {
    color: '#fff',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  toggleInfo: {
    flex: 1,
    marginRight: 12,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 4,
  },
  toggleHelp: {
    fontSize: 12,
    color: '#718096',
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
  submitButton: {
    backgroundColor: '#3182ce',
    paddingVertical: 18,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#3182ce',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  submitButtonDisabled: {
    backgroundColor: '#94a3b8',
    shadowOpacity: 0.1,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
    letterSpacing: 0.3,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#ebf8ff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bee3f8',
  },
  infoText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    color: '#2c5282',
    lineHeight: 18,
  },
});

export default PostRequestScreen;
