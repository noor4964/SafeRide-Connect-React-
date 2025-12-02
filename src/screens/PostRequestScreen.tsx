import React, { useState, useEffect, Component } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Pressable,
  Platform,
  ActivityIndicator,
  Alert,
  Keyboard,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { geohashForLocation } from 'geofire-common';
import { useNavigation } from '@react-navigation/native';
import { CustomDateTimePicker } from '../components/CustomDateTimePicker';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useAuth } from '@/features/auth/context/AuthContext';
import { useUser } from '@/features/auth/hooks/useUser';
import { useTheme } from '@/context/ThemeContext';
import { createRideRequest } from '@/services/rideMatchingService';
import { MainTabParamList } from '@/types';
import { useResponsive } from '@/hooks/useResponsive';
import { WebLayout, WebCard } from '@/components/WebLayout';

type PostRequestNavigationProp = BottomTabNavigationProp<MainTabParamList, 'PostRequest'>;

// Error Boundary to catch dismiss-related crashes
class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    // Check if it's a dismiss-related error and ignore it
    if (error.message && error.message.includes('dismiss')) {
      return { hasError: false }; // Don't show error UI for dismiss errors
    }
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // Log dismiss errors silently but don't crash
    if (error.message && error.message.includes('dismiss')) {
      console.log('Dismiss error caught and handled silently:', error.message);
      return;
    }
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ fontSize: 16, textAlign: 'center', color: '#ef4444' }}>
            Something went wrong. Please try again.
          </Text>
        </View>
      );
    }

    return this.props.children;
  }
}

const PostRequestScreen: React.FC = () => {
  const navigation = useNavigation<PostRequestNavigationProp>();
  const { user } = useAuth();
  const { userProfile } = useUser();
  const { colors } = useTheme();
  const { isWeb, isDesktop, responsive } = useResponsive();

  // Location states
  const [originAddress, setOriginAddress] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [originCoords, setOriginCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [destCoords, setDestCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);

  // Time states - Set to current time rounded to next 15 minutes
  const getInitialTime = () => {
    const now = new Date();
    const minutes = now.getMinutes();
    const roundedMinutes = Math.ceil(minutes / 15) * 15;
    now.setMinutes(roundedMinutes);
    now.setSeconds(0);
    now.setMilliseconds(0);
    return now;
  };
  const [departureTime, setDepartureTime] = useState(getInitialTime());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [flexibility, setFlexibility] = useState(15); // minutes
  const [minTimeBuffer, setMinTimeBuffer] = useState(0); // minutes - user configurable minimum time from now

  // Request details
  const [lookingForSeats, setLookingForSeats] = useState(1);
  const [maxPricePerSeat, setMaxPricePerSeat] = useState(200);
  const [customPrice, setCustomPrice] = useState('');
  const [showCustomPrice, setShowCustomPrice] = useState(false);
  const [maxWalkDistance, setMaxWalkDistance] = useState(500); // meters
  const [customDistance, setCustomDistance] = useState('');
  const [showCustomDistance, setShowCustomDistance] = useState(false);
  const [geocodingOrigin, setGeocodingOrigin] = useState(false);
  const [geocodingDest, setGeocodingDest] = useState(false);
  const [originSuggestions, setOriginSuggestions] = useState<Array<{name: string, area: string, coords: {latitude: number, longitude: number}}>>([]);
  const [destSuggestions, setDestSuggestions] = useState<Array<{name: string, area: string, coords: {latitude: number, longitude: number}}>>([]);
  const [showOriginSuggestions, setShowOriginSuggestions] = useState(false);
  const [showDestSuggestions, setShowDestSuggestions] = useState(false);
  const [searchingLocations, setSearchingLocations] = useState(false);
  const [originDebounceTimer, setOriginDebounceTimer] = useState<NodeJS.Timeout | null>(null);
  const [destDebounceTimer, setDestDebounceTimer] = useState<NodeJS.Timeout | null>(null);
  const [recentSearches, setRecentSearches] = useState<Array<{name: string, area: string, coords: {latitude: number, longitude: number}}>>([]);
  const [activeInput, setActiveInput] = useState<'origin' | 'destination' | null>(null);

  // Preferences
  const [genderPreference, setGenderPreference] = useState<'any' | 'female_only' | 'male_only'>('any');
  const [studentVerifiedOnly, setStudentVerifiedOnly] = useState(true);
  const [sameDepartmentPreferred, setSameDepartmentPreferred] = useState(false);

  // UI states
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Safe keyboard dismiss helper
  const safeKeyboardDismiss = () => {
    try {
      if (Keyboard && typeof Keyboard.dismiss === 'function') {
        Keyboard.dismiss();
      }
    } catch (error) {
      console.log('Keyboard dismiss error (safely handled):', error);
    }
  };

  // Get current location on mount
  useEffect(() => {
    // Use setTimeout to avoid any dismiss-related issues during initial render
    const timer = setTimeout(() => {
      getCurrentLocation().catch(err => {
        console.log('Location initialization error:', err);
      });
    }, 100);

    return () => clearTimeout(timer);
  }, []);



  const getCurrentLocation = async () => {
    try {
      setLoadingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        console.log('Location permission denied');
        Alert.alert(
          '📍 Location Permission Required',
          'UniRideConnect needs location access to find your current position and suggest nearby rides.\n\nYou can enable location permission in your device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Open Settings', 
              onPress: () => {
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                } else {
                  Linking.openSettings();
                }
              }
            },
          ]
        );
        setLoadingLocation(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      // Reverse geocode to get address
      const addresses = await Location.reverseGeocodeAsync(coords);
      if (addresses.length > 0) {
        const addr = addresses[0];
        
        // Filter out Plus Codes (like "RC9F+VXV") - they contain + symbol
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
        ].filter(Boolean); // Remove null/undefined/empty values
        
        const formattedAddress = addressParts.length > 0 
          ? addressParts.slice(0, 3).join(', ') // Take first 3 non-empty parts
          : `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
        
        setOriginAddress(formattedAddress);
        setOriginCoords(coords);
        console.log('✅ Current location set:', formattedAddress);
      } else {
        const fallbackAddress = `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
        setOriginAddress(fallbackAddress);
        setOriginCoords(coords);
        console.log('✅ Current location set (coordinates only):', fallbackAddress);
      }

      setLoadingLocation(false);
    } catch (error: any) {
      console.error('Location error:', error);
      Alert.alert(
        'Location Error',
        error.message || 'Failed to get your current location. Please try again or enter manually.',
        [{ text: 'OK' }]
      );
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

  const geocodeOriginAddress = async () => {
    if (!originAddress || originAddress.length < 3) {
      console.log('Origin address too short for geocoding');
      return;
    }
    
    // Note: Geocoding API removed in SDK 49
    // For now, coordinates must be set via "Use Current Location" button
    // Or we can use preset locations
    console.log('ℹ️ Manual coordinate entry required - use "Current Location" button');
  };

  const geocodeDestinationAddress = async () => {
    if (!destinationAddress || destinationAddress.length < 3) {
      console.log('Destination address too short for geocoding');
      return;
    }
    
    // Note: Geocoding API removed in SDK 49
    // For now, use preset locations like "Set to AIUB" button
    console.log('ℹ️ Manual coordinate entry required - use preset location buttons');
  };

  // Note: Hybrid API approach - using TomTom + Nominatim for comprehensive results

  // Quick lookup for common Dhaka locations (instant results)
  const quickLookup: { [key: string]: Array<{name: string, area: string, coords: {latitude: number, longitude: number}}> } = {
    'dhan': [
      { name: 'Dhanmondi', area: 'Dhaka', coords: { latitude: 23.7461, longitude: 90.3742 } },
      { name: 'Dhanmondi 27', area: 'Dhanmondi, Dhaka', coords: { latitude: 23.7504, longitude: 90.3751 } },
      { name: 'Dhanmondi 32', area: 'Dhanmondi, Dhaka', coords: { latitude: 23.7461, longitude: 90.3688 } },
    ],
    'guls': [
      { name: 'Gulshan 1', area: 'Gulshan, Dhaka', coords: { latitude: 23.7808, longitude: 90.4167 } },
      { name: 'Gulshan 2', area: 'Gulshan, Dhaka', coords: { latitude: 23.7925, longitude: 90.4078 } },
      { name: 'Gulshan Circle', area: 'Gulshan, Dhaka', coords: { latitude: 23.7808, longitude: 90.4161 } },
    ],
    'bana': [
      { name: 'Banani', area: 'Dhaka', coords: { latitude: 23.7937, longitude: 90.4066 } },
      { name: 'Banani 11', area: 'Banani, Dhaka', coords: { latitude: 23.7953, longitude: 90.4044 } },
    ],
    'utta': [
      { name: 'Uttara', area: 'Dhaka', coords: { latitude: 23.8759, longitude: 90.3795 } },
      { name: 'Uttara Sector 3', area: 'Uttara, Dhaka', coords: { latitude: 23.8688, longitude: 90.3968 } },
      { name: 'Uttara Sector 7', area: 'Uttara, Dhaka', coords: { latitude: 23.8827, longitude: 90.3968 } },
    ],
    'mirp': [
      { name: 'Mirpur 10', area: 'Mirpur, Dhaka', coords: { latitude: 23.8068, longitude: 90.3684 } },
      { name: 'Mirpur 12', area: 'Mirpur, Dhaka', coords: { latitude: 23.8267, longitude: 90.3696 } },
    ],
    'khil': [
      { name: 'Khilgaon', area: 'Dhaka', coords: { latitude: 23.7523, longitude: 90.4264 } },
      { name: 'Khilgaon Railgate', area: 'Khilgaon, Dhaka', coords: { latitude: 23.7482, longitude: 90.4246 } },
    ],
    'aiub': [
      { name: 'AIUB', area: 'Kuratoli, Dhaka', coords: { latitude: 23.792553, longitude: 90.407876 } },
    ],
    'moti': [
      { name: 'Motijheel', area: 'Dhaka', coords: { latitude: 23.7330, longitude: 90.4172 } },
    ],
    'farm': [
      { name: 'Farmgate', area: 'Dhaka', coords: { latitude: 23.7589, longitude: 90.3876 } },
    ],
    'bash': [
      { name: 'Bashundhara', area: 'Dhaka', coords: { latitude: 23.8225, longitude: 90.4245 } },
      { name: 'Bashundhara R/A', area: 'Bashundhara, Dhaka', coords: { latitude: 23.8237, longitude: 90.4282 } },
    ],
  };

  // Get instant results for common locations
  const getQuickResults = (query: string) => {
    const queryLower = query.toLowerCase().substring(0, 4);
    return quickLookup[queryLower] || [];
  };

  // Search using Nominatim (OpenStreetMap) - Free API
  const searchNominatim = async (query: string) => {
    try {
      console.log('🗺️ Searching Nominatim for:', query);
      
      const url = `https://nominatim.openstreetmap.org/search?` +
        `q=${encodeURIComponent(query)},Dhaka,Bangladesh&` +
        `format=json&` +
        `limit=10&` +
        `addressdetails=1&` +
        `viewbox=90.3,23.7,90.5,23.9&` + // Dhaka bounding box
        `bounded=1`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'UniRideConnect/1.0', // Required by Nominatim
        },
      });
      
      if (!response.ok) {
        console.warn('⚠️ Nominatim API error:', response.status);
        return [];
      }
      
      const data = await response.json();
      console.log('🗺️ Nominatim found', data.length, 'results');
      
      return data.map((result: any) => ({
        name: result.name || result.display_name?.split(',')[0] || 'Unknown',
        area: result.address?.suburb || result.address?.neighbourhood || result.address?.city || 'Dhaka',
        coords: {
          latitude: parseFloat(result.lat),
          longitude: parseFloat(result.lon),
        },
        type: result.type || 'place',
        category: result.category || '',
        source: 'nominatim',
      }));
    } catch (error: any) {
      console.error('❌ Nominatim error:', error.message);
      return [];
    }
  };

  // Search locations using Hybrid approach (TomTom + Nominatim)
  const searchLocationsAPI = async (query: string) => {
    if (!query || query.length < 2) return [];
    
    try {
      console.log('🔍 Starting hybrid search for:', query);
      
      const TOMTOM_API_KEY = 'rnlavze6OF3x2wYhIyWVOycV1y57LATS';
      const DHAKA_CENTER = { lat: 23.8103, lon: 90.4125 };
      
      // TomTom POI Search with better parameters
      const tomtomUrl = `https://api.tomtom.com/search/2/search/${encodeURIComponent(query)}.json?` +
        `key=${TOMTOM_API_KEY}&` +
        `lat=${DHAKA_CENTER.lat}&` +
        `lon=${DHAKA_CENTER.lon}&` +
        `radius=25000&` +
        `countrySet=BD&` +
        `limit=15&` +
        `typeahead=true&` +
        `idxSet=POI,Str,Geo&` +
        `language=en-US&` +
        `bestResult=false`;
      
      console.log('🌐 Fetching from TomTom + Nominatim...');
      
      // Parallel API calls for faster results
      const [tomtomResponse, nominatimResults] = await Promise.all([
        fetch(tomtomUrl).catch(err => {
          console.warn('⚠️ TomTom fetch failed:', err.message);
          return null;
        }),
        searchNominatim(query).catch(err => {
          console.warn('⚠️ Nominatim fetch failed:', err.message);
          return [];
        }),
      ]);
      
      let tomtomResults: any[] = [];
      
      // Process TomTom results
      if (tomtomResponse && tomtomResponse.ok) {
        const tomtomData = await tomtomResponse.json();
        console.log('📍 TomTom found', tomtomData.results?.length || 0, 'results');
        
        if (tomtomData.results && tomtomData.results.length > 0) {
          tomtomResults = tomtomData.results.map((result: any) => ({
            name: result.poi?.name || result.address?.freeformAddress?.split(',')[0] || 'Unknown',
            area: (() => {
              const address = result.address;
              const components = [];
              if (address?.municipalitySubdivision) components.push(address.municipalitySubdivision);
              if (address?.municipality && address.municipality !== address?.municipalitySubdivision) {
                components.push(address.municipality);
              }
              return components.slice(0, 2).join(', ') || address?.localName || 'Dhaka';
            })(),
            coords: {
              latitude: result.position.lat,
              longitude: result.position.lon,
            },
            type: result.type,
            category: result.poi?.categories?.[0] || '',
            source: 'tomtom',
          }));
        }
      } else {
        console.warn('⚠️ TomTom API failed, using Nominatim only');
      }
      
      console.log('🔄 Merging results from APIs + quick lookup...');
      
      // Get quick lookup results for instant suggestions
      const quickResults = getQuickResults(query);
      if (quickResults.length > 0) {
        console.log('⚡ Quick lookup found', quickResults.length, 'instant results');
      }
      
      // Merge results from all sources (quick lookup + TomTom + Nominatim)
      const allResults = [...quickResults, ...tomtomResults, ...nominatimResults];
      console.log('📊 Total raw results:', allResults.length, '(Quick:', quickResults.length, '+ TomTom:', tomtomResults.length, '+ Nominatim:', nominatimResults.length, ')');
      
      // Transform and filter merged results
      let suggestions: Array<{name: string, area: string, coords: {latitude: number, longitude: number}, score: number, distance: number, type: string, category: string, source: string}> = [];
      
      if (allResults.length > 0) {
        const queryLower = query.toLowerCase();
        
        suggestions = allResults
          .map((result: any) => {
            // Calculate distance from Dhaka center (km)
            const distance = Math.sqrt(
              Math.pow((result.coords.latitude - DHAKA_CENTER.lat) * 111, 2) +
              Math.pow((result.coords.longitude - DHAKA_CENTER.lon) * 111, 2)
            );
            
            // Calculate relevance score (0-100)
            let score = 0;
            
            // Base score by source
            if (!result.source) {
              // Quick lookup results (instant, highly relevant)
              score += 20;
            } else if (result.source === 'tomtom') {
              score += 10;
            } else if (result.source === 'nominatim') {
              score += 5;
            }
            
            // Boost score if name matches query closely
            const nameLower = result.name.toLowerCase();
            if (nameLower === queryLower) {
              score += 50; // Exact match
            } else if (nameLower.startsWith(queryLower)) {
              score += 30; // Starts with query
            } else if (nameLower.includes(queryLower)) {
              score += 15; // Contains query
            }
            
            // Boost by type priority
            if (result.type === 'POI' || result.type === 'poi') {
              score += 25;
            } else if (result.type === 'Street' || result.type === 'road' || result.type === 'street') {
              score += 15;
            } else if (result.type === 'amenity') {
              score += 20;
            }
            
            // Boost if has category (indicates specific place)
            if (result.category && result.category.length > 0) {
              score += 10;
            }
            
            // Penalize results far from Dhaka center
            if (distance > 25) {
              score -= 40;
            } else if (distance > 20) {
              score -= 25;
            } else if (distance > 15) {
              score -= 10;
            } else if (distance < 5) {
              score += 10; // Bonus for central locations
            }
            
            return {
              name: result.name,
              area: result.area,
              coords: result.coords,
              score: score,
              distance: distance,
              type: result.type,
              category: result.category,
              source: result.source,
            };
          })
          // Filter out irrelevant results
          .filter((item: any, index: number, self: any[]) => {
            // Remove if too far from Dhaka (>30km)
            if (item.distance > 30) return false;
            
            // Remove if name is generic or empty
            if (item.name === 'Unknown' || item.name.length < 2) return false;
            
            // Remove duplicates - keep first occurrence (by name similarity)
            const duplicateIndex = self.findIndex((other: any) => {
              const isSameName = other.name.toLowerCase() === item.name.toLowerCase();
              const isSameArea = other.area.toLowerCase() === item.area.toLowerCase();
              const isNearby = Math.abs(other.coords.latitude - item.coords.latitude) < 0.001 &&
                              Math.abs(other.coords.longitude - item.coords.longitude) < 0.001;
              
              return (isSameName && isSameArea) || (isSameName && isNearby);
            });
            
            // Keep only the first occurrence
            return duplicateIndex === index;
          })
          // Sort by score (highest first)
          .sort((a: any, b: any) => b.score - a.score)
          // Take top 10 results
          .slice(0, 10);
      }
      
      console.log('✅ Returning', suggestions.length, 'filtered & scored suggestions from hybrid search');
      if (suggestions.length > 0) {
        console.log('📊 Top result:', suggestions[0].name, '- Score:', suggestions[0].score, '- Distance:', suggestions[0].distance.toFixed(1), 'km - Source:', suggestions[0].source);
      }
      
      return suggestions;
      
    } catch (error: any) {
      console.error('❌ TomTom search error for "' + query + '":', error.message || error);
      console.error('Error details:', error);
      
      // Return empty array on error (no local database fallback)
      console.log('↩️ No results available - TomTom API error');
      return [];
    }
  };


  // Save location to recent searches
  const saveToRecentSearches = (location: {name: string, area: string, coords: {latitude: number, longitude: number}}) => {
    setRecentSearches(prev => {
      // Remove if already exists
      const filtered = prev.filter(item => item.name !== location.name);
      // Add to beginning, keep max 5
      return [location, ...filtered].slice(0, 5);
    });
  };

  // Clear origin input
  const clearOriginInput = () => {
    setOriginAddress('');
    setOriginCoords(null);
    setOriginSuggestions([]);
    setShowOriginSuggestions(false);
  };

  // Clear destination input
  const clearDestinationInput = () => {
    setDestinationAddress('');
    setDestCoords(null);
    setDestSuggestions([]);
    setShowDestSuggestions(false);
  };

  // Helper function to get coordinates from address (uses TomTom API)
  const getKnownLocationCoords = async (address: string): Promise<{ latitude: number; longitude: number } | null> => {
    // Try to search via TomTom API
    try {
      const results = await searchLocationsAPI(address);
      if (results.length > 0) {
        return results[0].coords;
      }
    } catch (error) {
      console.error('Error getting coordinates:', error);
    }
    return null;
  };

  const handleTimeChange = (selectedDate: Date) => {
    console.log('Custom picker selectedDate:', selectedDate);
    
    // Apply user-configured minimum time buffer if set
    if (minTimeBuffer > 0) {
      const minTime = new Date(Date.now() + minTimeBuffer * 60 * 1000);
      
      if (selectedDate < minTime) {
        setDepartureTime(minTime);
        console.log(`⚠️ Selected time adjusted to minimum (${minTimeBuffer} min from now):`, minTime);
      } else {
        setDepartureTime(selectedDate);
        console.log('✅ Departure time updated to:', selectedDate);
      }
    } else {
      // No minimum buffer - allow any future time
      setDepartureTime(selectedDate);
      console.log('✅ Departure time updated to:', selectedDate);
    }
  };

  const validateForm = async (): Promise<{ valid: boolean; originCoords: { latitude: number; longitude: number } | null; destCoords: { latitude: number; longitude: number } | null }> => {
    console.log('🔍 Starting form validation...');
    
    if (!originAddress || originAddress.trim().length === 0) {
      Alert.alert('Missing Information', 'Please enter your pickup location.');
      console.warn('❌ Validation failed: No origin address');
      return { valid: false, originCoords: null, destCoords: null };
    }

    if (!destinationAddress || destinationAddress.trim().length === 0) {
      Alert.alert('Missing Information', 'Please enter your destination.');
      console.warn('❌ Validation failed: No destination address');
      return { valid: false, originCoords: null, destCoords: null };
    }

    // Get current coordinates or geocode if missing
    let validOriginCoords = originCoords;
    let validDestCoords = destCoords;

    if (!validOriginCoords) {
      console.log('⚠️ Origin coordinates missing, searching via TomTom...');
      
      // Try to search via TomTom API
      const knownCoords = await getKnownLocationCoords(originAddress);
      if (knownCoords) {
        validOriginCoords = knownCoords;
        setOriginCoords(validOriginCoords);
        console.log('✅ Origin found via TomTom:', validOriginCoords);
      }
      
      if (!validOriginCoords) {
        Alert.alert(
          'Location Required',
          'Please select a location from the suggestions dropdown or use "Current Location" button.',
          [{ text: 'OK' }]
        );
        console.warn('❌ Validation failed: Origin coordinates still missing');
        return { valid: false, originCoords: null, destCoords: null };
      }
    }

    if (!validDestCoords) {
      console.log('⚠️ Destination coordinates missing, searching via TomTom...');
      
      // Try to search via TomTom API
      const knownCoords = await getKnownLocationCoords(destinationAddress);
      if (knownCoords) {
        validDestCoords = knownCoords;
        setDestCoords(validDestCoords);
        console.log('✅ Destination found via TomTom:', validDestCoords);
      }
      
      if (!validDestCoords) {
        Alert.alert(
          'Location Required',
          'Please select a location from the suggestions dropdown or use "Quick select: AIUB" button.',
          [{ text: 'OK' }]
        );
        console.warn('❌ Validation failed: Destination coordinates still missing');
        return { valid: false, originCoords: null, destCoords: null };
      }
    }

    // Check if departure time meets user-configured minimum buffer
    if (minTimeBuffer > 0) {
      const minTime = new Date(Date.now() + minTimeBuffer * 60 * 1000);
      if (departureTime < minTime) {
        Alert.alert(
          'Invalid Time', 
          `Departure time must be at least ${minTimeBuffer} minutes from now.`
        );
        console.warn('❌ Validation failed: Departure time too soon', {
          departureTime: departureTime.toISOString(),
          minTime: minTime.toISOString(),
          bufferMinutes: minTimeBuffer
        });
        return { valid: false, originCoords: null, destCoords: null };
      }
    } else {
      // No minimum buffer - just check it's not in the past
      const now = new Date();
      if (departureTime < now) {
        Alert.alert(
          'Invalid Time', 
          'Departure time cannot be in the past.'
        );
        console.warn('❌ Validation failed: Departure time in past');
        return { valid: false, originCoords: null, destCoords: null };
      }
    }

    if (lookingForSeats < 1 || lookingForSeats > 4) {
      Alert.alert('Invalid Seats', 'Please select between 1 and 4 seats.');
      console.warn('❌ Validation failed: Invalid seat count');
      return { valid: false, originCoords: null, destCoords: null };
    }

    const finalPrice = showCustomPrice && customPrice ? parseInt(customPrice) : maxPricePerSeat;
    if (isNaN(finalPrice) || finalPrice < 50 || finalPrice > 2000) {
      Alert.alert('Invalid Price', 'Price per seat must be between ৳50 and ৳2000.');
      console.warn('❌ Validation failed: Invalid price');
      return { valid: false, originCoords: null, destCoords: null };
    }

    const finalDistance = showCustomDistance && customDistance ? parseInt(customDistance) : maxWalkDistance;
    if (isNaN(finalDistance) || finalDistance < 100 || finalDistance > 5000) {
      Alert.alert('Invalid Distance', 'Walk distance must be between 100m and 5000m.');
      console.warn('❌ Validation failed: Invalid distance');
      return { valid: false, originCoords: null, destCoords: null };
    }

    if (!userProfile?.isVerified) {
      Alert.alert(
        'Email Verification Required',
        'Please verify your email address before posting ride requests. Check your inbox for the verification link.',
        [{ text: 'OK' }]
      );
      console.warn('❌ Validation failed: User email not verified');
      return { valid: false, originCoords: null, destCoords: null };
    }

    console.log('✅ Form validation passed!');
    console.log('📍 Validated coordinates:', { origin: validOriginCoords, dest: validDestCoords });
    return { valid: true, originCoords: validOriginCoords, destCoords: validDestCoords };
  };

  const handleSubmit = async () => {
    console.log('🚀 Submit button clicked');
    console.log('Current form state:', {
      originAddress,
      destinationAddress,
      originCoords,
      destCoords,
      departureTime: departureTime.toISOString(),
      lookingForSeats,
      maxPricePerSeat,
      maxWalkDistance,
    });
    
    // Prevent double submission
    if (isSubmitting) {
      console.warn('⚠️ Already submitting, ignoring duplicate click');
      return;
    }
    
    if (!user) {
      Alert.alert('Authentication Error', 'Please log in to post a ride request.');
      console.error('❌ No user found');
      return;
    }

    setIsSubmitting(true);
    console.log('✅ Submission started, isSubmitting set to true');

    try {
      // Validate form and get validated coordinates
      const validation = await validateForm();
      if (!validation.valid) {
        console.warn('❌ Form validation failed');
        setIsSubmitting(false);
        return;
      }

      // Use validated coordinates (guaranteed to exist)
      const validOriginCoords = validation.originCoords!;
      const validDestCoords = validation.destCoords!;

      console.log('✅ Form validated, creating ride request...');
      console.log('📍 Using coordinates:', { origin: validOriginCoords, dest: validDestCoords });

      // Use custom values if provided
      const finalPrice = showCustomPrice && customPrice ? parseInt(customPrice) : maxPricePerSeat;
      const finalDistance = showCustomDistance && customDistance ? parseInt(customDistance) : maxWalkDistance;

      // Generate geohashes for location queries
      const originGeohash = geohashForLocation([validOriginCoords.latitude, validOriginCoords.longitude]);
      const destGeohash = geohashForLocation([validDestCoords.latitude, validDestCoords.longitude]);

      console.log('📍 Creating request with:', {
        origin: originAddress,
        destination: destinationAddress,
        seats: lookingForSeats,
        price: finalPrice,
        distance: finalDistance,
        time: departureTime.toISOString(),
        originCoords: validOriginCoords,
        destCoords: validDestCoords,
      });

      // Create ride request
      const requestId = await createRideRequest(user.uid, {
        origin: {
          latitude: validOriginCoords.latitude,
          longitude: validOriginCoords.longitude,
          address: originAddress,
          geohash: originGeohash,
        },
        destination: {
          latitude: validDestCoords.latitude,
          longitude: validDestCoords.longitude,
          address: destinationAddress,
          geohash: destGeohash,
        },
        departureTime,
        flexibility,
        maxWalkDistance: finalDistance,
        lookingForSeats,
        maxPricePerSeat: finalPrice,
        preferences: {
          genderPreference,
          studentVerifiedOnly,
          sameDepartmentPreferred,
        },
      });

      console.log('🎉 Request Posted Successfully! RequestId:', requestId);
      
      // Reset submitting state immediately to allow alert to show
      setIsSubmitting(false);
      
      // Reset form to prevent duplicate submissions
      setOriginAddress('');
      setDestinationAddress('');
      setOriginCoords(null);
      setDestCoords(null);
      setDepartureTime(getInitialTime());
      setFlexibility(15);
      setLookingForSeats(1);
      setMaxPricePerSeat(200);
      setCustomPrice('');
      setShowCustomPrice(false);
      setMaxWalkDistance(500);
      setCustomDistance('');
      setShowCustomDistance(false);
      
      // Show success message and navigate
      Alert.alert(
        '✅ Success!',
        `Your ride request has been posted successfully!\n\nWe're now finding students going your way. Tap OK to view potential matches.`,
        [
          {
            text: 'OK',
            onPress: () => {
              console.log('🧭 Navigating to FindMatches with requestId:', requestId);
              // Small delay to ensure alert is dismissed before navigation
              setTimeout(() => {
                navigation.navigate('FindMatches', { requestId });
              }, 100);
            },
          },
        ],
        { cancelable: false }
      );
    } catch (error: any) {
      console.error('❌ Error creating ride request:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack,
      });
      
      setIsSubmitting(false);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to create ride request. Please try again.';
      
      if (error.message?.includes('network') || error.message?.includes('fetch')) {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      } else if (error.message?.includes('permission')) {
        errorMessage = 'You don\'t have permission to create ride requests. Please verify your account.';
      } else if (error.message?.includes('auth')) {
        errorMessage = 'Authentication error. Please log out and log in again.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert(
        '❌ Request Failed',
        errorMessage,
        [
          {
            text: 'Retry',
            onPress: () => {
              console.log('User chose to retry');
              // User can try again
            },
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ]
      );
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
    <ErrorBoundary>
      <WebLayout>
        <ScrollView 
          style={[styles.container, isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }]} 
          contentContainerStyle={[styles.contentContainer, isDesktop && { paddingHorizontal: 32 }]}
        >
          {/* Header */}
          <View style={[styles.header, isDesktop && { paddingTop: 24 }]}>
            <Text style={[styles.title, isDesktop && { fontSize: 36 }]}>Find Ride Partner</Text>
            <Text style={[styles.subtitle, isDesktop && { fontSize: 18 }]}>
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
        <View style={[styles.locationCard, activeInput === 'origin' && styles.locationCardActive]}>
          <View style={styles.locationHeader}>
            <View style={styles.locationIconContainer}>
              <Ionicons name="radio-button-on" size={14} color="#10b981" />
            </View>
            <Text style={styles.locationLabel}>Pickup Location</Text>
            {originAddress.length > 0 && (
              <TouchableOpacity
                onPress={clearOriginInput}
                style={styles.clearButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-circle" size={20} color="#718096" />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.locationInput, activeInput === 'origin' && styles.locationInputActive]}
              placeholder="Where from?"
              placeholderTextColor="#a0aec0"
              value={originAddress}
              onChangeText={(text) => {
                setOriginAddress(text);
                setOriginCoords(null); // Clear coords when typing
                
                // Clear existing timer
                if (originDebounceTimer) {
                  clearTimeout(originDebounceTimer);
                }
                
                if (text.length < 2) {
                  setOriginSuggestions([]);
                  setShowOriginSuggestions(false);
                  setSearchingLocations(false);
                  return;
                }
                
                // Show loading immediately
                setSearchingLocations(true);
                
                // Debounce API call - wait 200ms after user stops typing (optimized)
                const timer = setTimeout(async () => {
                  try {
                    // Search with Hybrid API (minimum 2 characters)
                    const suggestions = await searchLocationsAPI(text);
                    setOriginSuggestions(suggestions);
                    setShowOriginSuggestions(suggestions.length > 0);
                  } catch (error) {
                    console.error('Search error:', error);
                  } finally {
                    setSearchingLocations(false);
                  }
                }, 200);
                
                setOriginDebounceTimer(timer);
              }}
              onFocus={() => {
                setActiveInput('origin');
                // Show recent searches if input is empty
                if (originAddress.length === 0 && recentSearches.length > 0) {
                  setOriginSuggestions(recentSearches);
                  setShowOriginSuggestions(true);
                } else if (originSuggestions.length > 0) {
                  setShowOriginSuggestions(true);
                }
              }}
              onBlur={() => {
                // Don't hide immediately - let Pressable onPress complete first
              }}
              editable={!loadingLocation && !geocodingOrigin}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="search"
            />
            {originCoords && (
              <View style={styles.successIndicator}>
                <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                <Text style={styles.successText}>Location set ({originCoords.latitude.toFixed(4)}, {originCoords.longitude.toFixed(4)})</Text>
              </View>
            )}
            {searchingLocations && originAddress.length >= 2 && !originCoords && (
              <View style={styles.geocodingIndicator}>
                <ActivityIndicator size="small" color="#3182ce" />
                <Text style={styles.geocodingText}>Searching locations...</Text>
              </View>
            )}
            {!originCoords && originAddress.length >= 2 && !showOriginSuggestions && !searchingLocations && originSuggestions.length === 0 && (
              <View style={styles.geocodingIndicator}>
                <Ionicons name="information-circle" size={16} color="#f59e0b" />
                <Text style={styles.geocodingText}>No results found - try different keywords</Text>
              </View>
            )}
          </View>
          {showOriginSuggestions && originSuggestions.length > 0 && (
            <View style={styles.suggestionsContainer}>
              {/* Recent Searches Header */}
              {originAddress.length === 0 && recentSearches.length > 0 && (
                <View style={styles.suggestionSectionHeader}>
                  <Ionicons name="time-outline" size={16} color="#718096" />
                  <Text style={styles.suggestionSectionTitle}>Recent</Text>
                </View>
              )}
              
              {/* Suggestions List */}
              <View style={styles.suggestionsList}>
                {originSuggestions.map((suggestion, index) => (
                  <Pressable
                    key={index}
                    style={({ pressed }) => [
                      styles.suggestionItem,
                      pressed && { backgroundColor: '#f7fafc' }
                    ]}
                    onPress={() => {
                      const fullAddress = suggestion.name + ', ' + suggestion.area;
                      console.log('🔘 Origin pressed:', fullAddress);
                      
                      // Update state immediately
                      setOriginAddress(fullAddress);
                      setOriginCoords(suggestion.coords);
                      setShowOriginSuggestions(false);
                      setOriginSuggestions([]);
                      setActiveInput(null);
                      saveToRecentSearches(suggestion);
                      safeKeyboardDismiss();
                      
                      console.log('✅ Origin selected:', fullAddress, suggestion.coords);
                    }}
                  >
                    <Ionicons 
                      name={originAddress.length === 0 ? "time-outline" : "location-outline"} 
                      size={18} 
                      color="#718096" 
                      style={{ marginRight: 16 }}
                    />
                    <View style={styles.suggestionTextContainer}>
                      <Text style={styles.suggestionName}>{suggestion.name}</Text>
                      <Text style={styles.suggestionArea}>{suggestion.area}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
          {!originCoords && (
            <TouchableOpacity
              style={styles.currentLocationButton}
              onPress={getCurrentLocation}
              disabled={loadingLocation}
            >
              <View style={styles.currentLocationIconContainer}>
                {loadingLocation ? (
                  <ActivityIndicator size="small" color="#3182ce" />
                ) : (
                  <Ionicons name="navigate" size={18} color="#3182ce" />
                )}
              </View>
              <Text style={styles.currentLocationText}>
                {loadingLocation ? 'Getting location...' : 'Use current location'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Destination */}
        <View style={[styles.locationCard, activeInput === 'destination' && styles.locationCardActive]}>
          <View style={styles.locationHeader}>
            <View style={styles.locationIconContainer}>
              <Ionicons name="location" size={14} color="#ef4444" />
            </View>
            <Text style={styles.locationLabel}>Destination</Text>
            {destinationAddress.length > 0 && (
              <TouchableOpacity
                onPress={clearDestinationInput}
                style={styles.clearButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-circle" size={20} color="#718096" />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.locationInput, activeInput === 'destination' && styles.locationInputActive]}
              placeholder="Where to?"
              placeholderTextColor="#a0aec0"
              value={destinationAddress}
              onChangeText={(text) => {
                setDestinationAddress(text);
                setDestCoords(null); // Clear coords when typing
                
                // Clear existing timer
                if (destDebounceTimer) {
                  clearTimeout(destDebounceTimer);
                }
                
                if (text.length < 2) {
                  setDestSuggestions([]);
                  setShowDestSuggestions(false);
                  setSearchingLocations(false);
                  return;
                }
                
                // Show loading immediately
                setSearchingLocations(true);
                
                // Debounce API call - wait 200ms after user stops typing (optimized)
                const timer = setTimeout(async () => {
                  try {
                    // Search with Hybrid API (minimum 2 characters)
                    const suggestions = await searchLocationsAPI(text);
                    setDestSuggestions(suggestions);
                    setShowDestSuggestions(suggestions.length > 0);
                  } catch (error) {
                    console.error('Search error:', error);
                  } finally {
                    setSearchingLocations(false);
                  }
                }, 200);
                
                setDestDebounceTimer(timer);
              }}
              onFocus={() => {
                setActiveInput('destination');
                // Show recent searches if input is empty
                if (destinationAddress.length === 0 && recentSearches.length > 0) {
                  setDestSuggestions(recentSearches);
                  setShowDestSuggestions(true);
                } else if (destSuggestions.length > 0) {
                  setShowDestSuggestions(true);
                }
              }}
              onBlur={() => {
                // Don't hide immediately - let Pressable onPress complete first
              }}
              editable={!geocodingDest}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="search"
            />
            {destCoords && (
              <View style={styles.successIndicator}>
                <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                <Text style={styles.successText}>Location set ({destCoords.latitude.toFixed(4)}, {destCoords.longitude.toFixed(4)})</Text>
              </View>
            )}
            {searchingLocations && destinationAddress.length >= 2 && !destCoords && (
              <View style={styles.geocodingIndicator}>
                <ActivityIndicator size="small" color="#3182ce" />
                <Text style={styles.geocodingText}>Searching locations...</Text>
              </View>
            )}
            {!destCoords && destinationAddress.length >= 2 && !showDestSuggestions && !searchingLocations && destSuggestions.length === 0 && (
              <View style={styles.geocodingIndicator}>
                <Ionicons name="information-circle" size={16} color="#f59e0b" />
                <Text style={styles.geocodingText}>No results found - try different keywords</Text>
              </View>
            )}
          </View>
          {showDestSuggestions && destSuggestions.length > 0 && (
            <View style={styles.suggestionsContainer}>
              {/* Recent Searches Header */}
              {destinationAddress.length === 0 && recentSearches.length > 0 && (
                <View style={styles.suggestionSectionHeader}>
                  <Ionicons name="time-outline" size={16} color="#718096" />
                  <Text style={styles.suggestionSectionTitle}>Recent</Text>
                </View>
              )}
              
              {/* Suggestions List */}
              <View style={styles.suggestionsList}>
                {destSuggestions.map((suggestion, index) => (
                  <Pressable
                    key={index}
                    style={({ pressed }) => [
                      styles.suggestionItem,
                      pressed && { backgroundColor: '#f7fafc' }
                    ]}
                    onPress={() => {
                      const fullAddress = suggestion.name + ', ' + suggestion.area;
                      console.log('🔘 Destination pressed:', fullAddress);
                      
                      // Update state immediately
                      setDestinationAddress(fullAddress);
                      setDestCoords(suggestion.coords);
                      setShowDestSuggestions(false);
                      setDestSuggestions([]);
                      setActiveInput(null);
                      saveToRecentSearches(suggestion);
                      safeKeyboardDismiss();
                      
                      console.log('✅ Destination selected:', fullAddress, suggestion.coords);
                    }}
                  >
                    <Ionicons 
                      name={destinationAddress.length === 0 ? "time-outline" : "location-outline"} 
                      size={18} 
                      color="#718096" 
                      style={{ marginRight: 16 }}
                    />
                    <View style={styles.suggestionTextContainer}>
                      <Text style={styles.suggestionName}>{suggestion.name}</Text>
                      <Text style={styles.suggestionArea}>{suggestion.area}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
          {!destCoords && (
            <TouchableOpacity
              style={styles.quickSelectButton}
              onPress={() => {
                const aiubLocation = {
                  name: 'AIUB',
                  area: 'Kuratoli',
                  coords: { latitude: 23.792553, longitude: 90.407876 }
                };
                setDestinationAddress('AIUB, Kuratoli');
                setDestCoords(aiubLocation.coords);
                saveToRecentSearches(aiubLocation);
              }}
            >
              <View style={styles.quickSelectIconContainer}>
                <Ionicons name="school" size={18} color="#3182ce" />
              </View>
              <Text style={styles.quickSelectText}>Quick select: AIUB</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Time Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🕐 When?</Text>

        {/* Minimum Time Buffer */}
        <View style={styles.bufferContainer}>
          <Text style={styles.inputLabel}>Minimum Time Buffer</Text>
          <View style={styles.bufferButtons}>
            {[0, 5, 10, 15, 30].map((mins) => (
              <TouchableOpacity
                key={mins}
                style={[
                  styles.bufferChip,
                  minTimeBuffer === mins && styles.bufferChipActive,
                ]}
                onPress={() => setMinTimeBuffer(mins)}
              >
                <Text
                  style={[
                    styles.bufferChipText,
                    minTimeBuffer === mins && styles.bufferChipTextActive,
                  ]}
                >
                  {mins === 0 ? 'None' : `${mins} min`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.bufferHelp}>
            {minTimeBuffer === 0 
              ? 'No minimum - you can book rides for any future time'
              : `Prevents booking rides less than ${minTimeBuffer} minutes away`}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.timeCard}
          onPress={() => {
            safeKeyboardDismiss();
            setShowTimePicker(true);
          }}
        >
          <View style={styles.timeInfo}>
            <Text style={styles.timeDate}>{formatDate(departureTime)}</Text>
            <Text style={styles.timeValue}>{formatTime(departureTime)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#718096" />
        </TouchableOpacity>

        <CustomDateTimePicker
          visible={showTimePicker}
          value={departureTime}
          onChange={handleTimeChange}
          onClose={() => setShowTimePicker(false)}
          minimumDate={minTimeBuffer > 0 ? new Date(Date.now() + minTimeBuffer * 60 * 1000) : new Date()}
          maximumDate={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)}
        />

        {/* Quick time shortcuts */}
        <View style={styles.quickTimeContainer}>
          <Text style={styles.inputLabel}>Quick Select:</Text>
          <View style={styles.quickTimeButtons}>
            <TouchableOpacity
              style={styles.quickTimeChip}
              onPress={() => {
                const time = new Date();
                time.setMinutes(time.getMinutes() + 15);
                time.setSeconds(0);
                time.setMilliseconds(0);
                setDepartureTime(time);
                console.log('Quick select: +15 min');
              }}
            >
              <Text style={styles.quickTimeText}>In 15 min</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickTimeChip}
              onPress={() => {
                const time = new Date();
                time.setMinutes(time.getMinutes() + 30);
                time.setSeconds(0);
                time.setMilliseconds(0);
                setDepartureTime(time);
                console.log('Quick select: +30 min');
              }}
            >
              <Text style={styles.quickTimeText}>In 30 min</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickTimeChip}
              onPress={() => {
                const time = new Date();
                time.setHours(time.getHours() + 1);
                time.setMinutes(0);
                time.setSeconds(0);
                time.setMilliseconds(0);
                setDepartureTime(time);
                console.log('Quick select: +1 hour');
              }}
            >
              <Text style={styles.quickTimeText}>In 1 hour</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickTimeChip}
              onPress={() => {
                const time = new Date();
                time.setHours(time.getHours() + 2);
                time.setMinutes(0);
                time.setSeconds(0);
                time.setMilliseconds(0);
                setDepartureTime(time);
                console.log('Quick select: +2 hours');
              }}
            >
              <Text style={styles.quickTimeText}>In 2 hours</Text>
            </TouchableOpacity>
          </View>
        </View>

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
                  maxPricePerSeat === price && !showCustomPrice && styles.priceChipActive,
                ]}
                onPress={() => {
                  setMaxPricePerSeat(price);
                  setShowCustomPrice(false);
                  setCustomPrice('');
                }}
              >
                <Text
                  style={[
                    styles.priceChipText,
                    maxPricePerSeat === price && !showCustomPrice && styles.priceChipTextActive,
                  ]}
                >
                  ৳{price}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[
                styles.priceChip,
                showCustomPrice && styles.priceChipActive,
              ]}
              onPress={() => setShowCustomPrice(true)}
            >
              <Text
                style={[
                  styles.priceChipText,
                  showCustomPrice && styles.priceChipTextActive,
                ]}
              >
                Custom
              </Text>
            </TouchableOpacity>
          </View>
          {showCustomPrice && (
            <View style={styles.customInputContainer}>
              <Text style={styles.customInputLabel}>৳</Text>
              <TextInput
                style={styles.customInput}
                placeholder="Enter amount (50-2000)"
                value={customPrice}
                onChangeText={setCustomPrice}
                keyboardType="numeric"
                maxLength={4}
              />
            </View>
          )}
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
                  maxWalkDistance === distance && !showCustomDistance && styles.priceChipActive,
                ]}
                onPress={() => {
                  setMaxWalkDistance(distance);
                  setShowCustomDistance(false);
                  setCustomDistance('');
                }}
              >
                <Text
                  style={[
                    styles.priceChipText,
                    maxWalkDistance === distance && !showCustomDistance && styles.priceChipTextActive,
                  ]}
                >
                  {distance}m
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[
                styles.priceChip,
                showCustomDistance && styles.priceChipActive,
              ]}
              onPress={() => setShowCustomDistance(true)}
            >
              <Text
                style={[
                  styles.priceChipText,
                  showCustomDistance && styles.priceChipTextActive,
                ]}
              >
                Custom
              </Text>
            </TouchableOpacity>
          </View>
          {showCustomDistance && (
            <View style={styles.customInputContainer}>
              <TextInput
                style={[styles.customInput, { flex: 1 }]}
                placeholder="Enter distance (100-5000)"
                value={customDistance}
                onChangeText={setCustomDistance}
                keyboardType="numeric"
                maxLength={4}
              />
              <Text style={styles.customInputLabel}>meters</Text>
            </View>
          )}
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
        activeOpacity={isSubmitting ? 1 : 0.7}
      >
        {isSubmitting ? (
          <>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={[styles.submitButtonText, { marginLeft: 12 }]}>Creating Request...</Text>
          </>
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
      </WebLayout>
    </ErrorBoundary>
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
    borderWidth: 2,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  locationCardActive: {
    borderColor: '#3182ce',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  locationIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f7fafc',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  locationLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#718096',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  clearButton: {
    padding: 4,
  },
  locationInput: {
    fontSize: 18,
    fontWeight: '500',
    color: '#1a365d',
    paddingVertical: 12,
    paddingHorizontal: 0,
  },
  locationInputActive: {
    fontSize: 18,
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
  datePickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 4,
    textAlign: 'center',
  },
  pickerSubtitle: {
    fontSize: 13,
    color: '#718096',
    marginBottom: 16,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  datePicker: {
    width: '100%',
  },
  pickerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  pickerActionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerCancelButton: {
    backgroundColor: '#f7fafc',
    borderWidth: 1,
    borderColor: '#cbd5e0',
  },
  pickerDoneButton: {
    backgroundColor: '#3182ce',
  },
  pickerCancelText: {
    color: '#4a5568',
    fontSize: 16,
    fontWeight: '600',
  },
  pickerDoneText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  doneButton: {
    backgroundColor: '#3182ce',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
    textAlign: 'center',
  },
  inputContainer: {
    position: 'relative',
  },
  geocodingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  geocodingText: {
    fontSize: 12,
    color: '#718096',
    marginLeft: 6,
    fontStyle: 'italic',
  },
  successIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  successText: {
    fontSize: 12,
    color: '#10b981',
    marginLeft: 6,
    fontWeight: '500',
  },
  customInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    marginTop: 12,
    borderWidth: 2,
    borderColor: '#3182ce',
  },
  customInput: {
    flex: 1,
    fontSize: 16,
    color: '#1a365d',
    paddingVertical: 4,
  },
  customInputLabel: {
    fontSize: 16,
    color: '#4a5568',
    fontWeight: '600',
    marginLeft: 8,
  },
  bufferContainer: {
    marginBottom: 16,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  bufferButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  bufferChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f7fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 8,
    marginBottom: 8,
  },
  bufferChipActive: {
    backgroundColor: '#ebf8ff',
    borderColor: '#3182ce',
  },
  bufferChipText: {
    fontSize: 14,
    color: '#4a5568',
    fontWeight: '500',
  },
  bufferChipTextActive: {
    color: '#3182ce',
    fontWeight: '600',
  },
  bufferHelp: {
    fontSize: 12,
    color: '#718096',
    marginTop: 8,
    fontStyle: 'italic',
  },
  quickTimeContainer: {
    marginBottom: 16,
  },
  quickTimeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4a5568',
    marginBottom: 8,
  },
  quickTimeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  quickTimeChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#ebf8ff',
    borderWidth: 1,
    borderColor: '#3182ce',
    marginRight: 8,
    marginBottom: 8,
  },
  quickTimeText: {
    fontSize: 14,
    color: '#3182ce',
    fontWeight: '600',
  },
  suggestionsContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    maxHeight: 320,
    overflow: 'hidden',
  },
  suggestionSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f7fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  suggestionSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#718096',
    marginLeft: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  suggestionsList: {
    maxHeight: 280,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#fff',
  },
  suggestionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f7fafc',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  suggestionTextContainer: {
    flex: 1,
  },
  suggestionName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1a202c',
    marginBottom: 2,
  },
  suggestionArea: {
    fontSize: 13,
    color: '#718096',
    lineHeight: 18,
  },
  currentLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#ebf8ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bee3f8',
  },
  currentLocationIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  currentLocationText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2c5282',
  },
  quickSelectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#f7fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  quickSelectIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ebf8ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  quickSelectText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2d3748',
  },
});

export default PostRequestScreen;
