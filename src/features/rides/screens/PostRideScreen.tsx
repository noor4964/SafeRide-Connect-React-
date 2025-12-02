import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { PostRideFormSchema, PostRideForm, LocationWithAddress } from '@/types';
import { useCreateRide } from '@/features/rides/hooks/useRides';
import { geocodeAddress } from '@/utils/locationUtils';
import { MainTabParamList } from '@/types';

type PostRideNavigationProp = BottomTabNavigationProp<MainTabParamList>;

const PostRideScreen: React.FC = () => {
  const navigation = useNavigation<PostRideNavigationProp>();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [originLocation, setOriginLocation] = useState<LocationWithAddress | null>(null);
  const [destinationLocation, setDestinationLocation] = useState<LocationWithAddress | null>(null);

  const createRideMutation = useCreateRide();

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
  } = useForm<PostRideForm>({
    resolver: zodResolver(PostRideFormSchema),
    defaultValues: {
      title: '',
      description: '',
      originAddress: '',
      destinationAddress: '',
      departureTime: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
      availableSeats: 3,
      pricePerSeat: 5,
      smokingAllowed: false,
      petsAllowed: false,
      musicAllowed: true,
      genderPreference: 'any',
      shareLocationWithContacts: true,
      requireVerifiedStudents: false,
    },
  });

  const watchedDepartureTime = watch('departureTime');

  // Auto-fill current location as origin
  useEffect(() => {
    const getCurrentLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({});
          const address = await Location.reverseGeocodeAsync({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
          
          if (address.length > 0) {
            const addr = address[0];
            
            // Filter out Plus Codes (like "RC9F+VXV")
            const isPlusCode = (str: string) => str && str.includes('+');
            
            // Build address from available parts, filtering out empty values and Plus Codes
            const addressParts = [
              !isPlusCode(addr.name) ? addr.name : null,
              addr.street,
              addr.streetNumber,
              addr.district,
              addr.subregion,
              addr.city,
              addr.region,
            ].filter(Boolean);
            
            const currentAddress = addressParts.length > 0
              ? addressParts.slice(0, 3).join(', ')
              : `${location.coords.latitude.toFixed(4)}, ${location.coords.longitude.toFixed(4)}`;
            
            setValue('originAddress', currentAddress);
            setOriginLocation({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              address: currentAddress,
            });
          }
        }
      } catch (error) {
        console.error('Error getting current location:', error);
      }
    };

    getCurrentLocation();
  }, [setValue]);

  const handleAddressBlur = async (field: 'originAddress' | 'destinationAddress', value: string) => {
    if (!value.trim()) return;

    try {
      const location = await geocodeAddress(value);
      if (location) {
        if (field === 'originAddress') {
          setOriginLocation(location);
          console.log('Origin location set:', location);
        } else {
          setDestinationLocation(location);
          console.log('Destination location set:', location);
        }
      } else {
        console.warn(`Failed to geocode ${field}:`, value);
        Alert.alert(
          'Location Not Found',
          `Could not find "${value}". Please enter a more specific address.`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error geocoding address:', error);
      Alert.alert(
        'Geocoding Error',
        'Failed to find location. Please check your address and try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const onSubmit = async (data: PostRideForm) => {
    if (!originLocation || !destinationLocation) {
      Alert.alert('Invalid Addresses', 'Please ensure both origin and destination addresses are valid.');
      return;
    }

    try {
      setIsSubmitting(true);
      
      await createRideMutation.mutateAsync({
        ...data,
        origin: originLocation,
        destination: destinationLocation,
      });

      Alert.alert(
        'Ride Posted!',
        'Your ride has been posted successfully. Students can now request to join your ride.',
        [
          {
            text: 'View Rides',
            onPress: () => {
              reset();
              setOriginLocation(null);
              setDestinationLocation(null);
              navigation.navigate('Home');
            },
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to post ride. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderDateTimePicker = () => {
    if (!showDatePicker && !showTimePicker) return null;

    return (
      <DateTimePicker
        value={watchedDepartureTime}
        mode={showDatePicker ? 'date' : 'time'}
        is24Hour={false}
        display="default"
        minimumDate={new Date()}
        onChange={(event, selectedDate) => {
          setShowDatePicker(false);
          setShowTimePicker(false);
          if (selectedDate) {
            setValue('departureTime', selectedDate);
          }
        }}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Post a New Ride</Text>
            <Text style={styles.subtitle}>
              Share your ride with fellow students and split the cost
            </Text>
          </View>

          {/* Basic Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Basic Information</Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Ride Title</Text>
              <Controller
                control={control}
                name="title"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={[styles.input, errors.title && styles.inputError]}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    placeholder="e.g., Campus to Downtown Mall"
                  />
                )}
              />
              {errors.title && (
                <Text style={styles.errorText}>{errors.title.message}</Text>
              )}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Description (Optional)</Text>
              <Controller
                control={control}
                name="description"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    placeholder="Additional details about your ride..."
                    multiline
                    numberOfLines={3}
                  />
                )}
              />
            </View>
          </View>

          {/* Route Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Route Information</Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>
                <Ionicons name="radio-button-on" size={14} color="#10b981" /> Origin
              </Text>
              <Controller
                control={control}
                name="originAddress"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={[styles.input, errors.originAddress && styles.inputError]}
                    onBlur={(e) => {
                      onBlur();
                      handleAddressBlur('originAddress', value);
                    }}
                    onChangeText={onChange}
                    value={value}
                    placeholder="Enter pickup location"
                  />
                )}
              />
              {errors.originAddress && (
                <Text style={styles.errorText}>{errors.originAddress.message}</Text>
              )}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>
                <Ionicons name="location" size={14} color="#e53e3e" /> Destination
              </Text>
              <Controller
                control={control}
                name="destinationAddress"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={[styles.input, errors.destinationAddress && styles.inputError]}
                    onBlur={(e) => {
                      onBlur();
                      handleAddressBlur('destinationAddress', value);
                    }}
                    onChangeText={onChange}
                    value={value}
                    placeholder="Enter destination"
                  />
                )}
              />
              {errors.destinationAddress && (
                <Text style={styles.errorText}>{errors.destinationAddress.message}</Text>
              )}
            </View>
          </View>

          {/* Date and Time */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Departure Time</Text>
            
            <View style={styles.dateTimeContainer}>
              <TouchableOpacity
                style={styles.dateTimeButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="calendar-outline" size={20} color="#3182ce" />
                <Text style={styles.dateTimeText}>
                  {watchedDepartureTime.toLocaleDateString()}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.dateTimeButton}
                onPress={() => setShowTimePicker(true)}
              >
                <Ionicons name="time-outline" size={20} color="#3182ce" />
                <Text style={styles.dateTimeText}>
                  {watchedDepartureTime.toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </Text>
              </TouchableOpacity>
            </View>
            
            {errors.departureTime && (
              <Text style={styles.errorText}>{errors.departureTime.message}</Text>
            )}
          </View>

          {/* Seats and Price */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Seats & Pricing</Text>
            
            <View style={styles.row}>
              <View style={[styles.inputContainer, styles.halfWidth]}>
                <Text style={styles.label}>Available Seats</Text>
                <Controller
                  control={control}
                  name="availableSeats"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      style={[styles.input, errors.availableSeats && styles.inputError]}
                      onChangeText={(text) => onChange(parseInt(text) || 1)}
                      value={value.toString()}
                      placeholder="3"
                      keyboardType="numeric"
                    />
                  )}
                />
                {errors.availableSeats && (
                  <Text style={styles.errorText}>{errors.availableSeats.message}</Text>
                )}
              </View>
              
              <View style={[styles.inputContainer, styles.halfWidth]}>
                <Text style={styles.label}>Price per Seat ($)</Text>
                <Controller
                  control={control}
                  name="pricePerSeat"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      style={[styles.input, errors.pricePerSeat && styles.inputError]}
                      onChangeText={(text) => onChange(parseFloat(text) || 0)}
                      value={value.toString()}
                      placeholder="5.00"
                      keyboardType="decimal-pad"
                    />
                  )}
                />
                {errors.pricePerSeat && (
                  <Text style={styles.errorText}>{errors.pricePerSeat.message}</Text>
                )}
              </View>
            </View>
          </View>

          {/* Preferences */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ride Preferences</Text>
            
            <View style={styles.switchContainer}>
              <Text style={styles.switchLabel}>Music Allowed</Text>
              <Controller
                control={control}
                name="musicAllowed"
                render={({ field: { onChange, value } }) => (
                  <Switch
                    value={value}
                    onValueChange={onChange}
                    trackColor={{ false: '#e2e8f0', true: '#3182ce' }}
                  />
                )}
              />
            </View>
            
            <View style={styles.switchContainer}>
              <Text style={styles.switchLabel}>Smoking Allowed</Text>
              <Controller
                control={control}
                name="smokingAllowed"
                render={({ field: { onChange, value } }) => (
                  <Switch
                    value={value}
                    onValueChange={onChange}
                    trackColor={{ false: '#e2e8f0', true: '#3182ce' }}
                  />
                )}
              />
            </View>
            
            <View style={styles.switchContainer}>
              <Text style={styles.switchLabel}>Pets Allowed</Text>
              <Controller
                control={control}
                name="petsAllowed"
                render={({ field: { onChange, value } }) => (
                  <Switch
                    value={value}
                    onValueChange={onChange}
                    trackColor={{ false: '#e2e8f0', true: '#3182ce' }}
                  />
                )}
              />
            </View>
          </View>

          {/* Safety Features */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🛡️ Safety Features</Text>
            
            <View style={styles.switchContainer}>
              <View style={styles.switchLabelContainer}>
                <Text style={styles.switchLabel}>Share Location with Emergency Contacts</Text>
                <Text style={styles.switchSubLabel}>Recommended for safety</Text>
              </View>
              <Controller
                control={control}
                name="shareLocationWithContacts"
                render={({ field: { onChange, value } }) => (
                  <Switch
                    value={value}
                    onValueChange={onChange}
                    trackColor={{ false: '#e2e8f0', true: '#10b981' }}
                  />
                )}
              />
            </View>
            
            <View style={styles.switchContainer}>
              <View style={styles.switchLabelContainer}>
                <Text style={styles.switchLabel}>Verified Students Only</Text>
                <Text style={styles.switchSubLabel}>Only students with verified .edu emails</Text>
              </View>
              <Controller
                control={control}
                name="requireVerifiedStudents"
                render={({ field: { onChange, value } }) => (
                  <Switch
                    value={value}
                    onValueChange={onChange}
                    trackColor={{ false: '#e2e8f0', true: '#10b981' }}
                  />
                )}
              />
            </View>
          </View>

          {/* Submit Button */}
          <View style={styles.submitContainer}>
            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
              onPress={handleSubmit(onSubmit)}
              disabled={isSubmitting}
            >
              <Text style={styles.submitButtonText}>
                {isSubmitting ? 'Posting Ride...' : 'Post Ride'}
              </Text>
            </TouchableOpacity>
            
            <Text style={styles.submitNote}>
              Your ride will be visible to other students immediately
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      
      {renderDateTimePicker()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContainer: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  header: {
    paddingVertical: 24,
    alignItems: 'center',
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
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  halfWidth: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#2d3748',
  },
  inputError: {
    borderColor: '#e53e3e',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  errorText: {
    color: '#e53e3e',
    fontSize: 12,
    marginTop: 4,
  },
  dateTimeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  dateTimeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dateTimeText: {
    fontSize: 16,
    color: '#2d3748',
    marginLeft: 12,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
  },
  switchLabelContainer: {
    flex: 1,
  },
  switchLabel: {
    fontSize: 16,
    color: '#2d3748',
    fontWeight: '500',
  },
  switchSubLabel: {
    fontSize: 12,
    color: '#718096',
    marginTop: 2,
  },
  submitContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  submitButton: {
    backgroundColor: '#3182ce',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 48,
    alignItems: 'center',
    marginBottom: 12,
    minWidth: 200,
  },
  submitButtonDisabled: {
    backgroundColor: '#a0aec0',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  submitNote: {
    fontSize: 14,
    color: '#718096',
    textAlign: 'center',
  },
});

export default PostRideScreen;