import * as Location from 'expo-location';
import { geohashForLocation } from 'geofire-common';
import { Location as LocationType, LocationWithAddress } from '@/types';

/**
 * Generate a geohash for a given location
 * Used for efficient proximity-based queries in Firestore
 */
export const generateGeohash = (location: LocationType, precision: number = 9): string => {
  return geohashForLocation([location.latitude, location.longitude], precision);
};

/**
 * Get the user's current location
 */
export const getCurrentLocation = async (): Promise<LocationType | null> => {
  try {
    // Request permission first
    const { status } = await Location.requestForegroundPermissionsAsync();
    
    if (status !== 'granted') {
      throw new Error('Location permission not granted');
    }

    // Get current position
    const locationResult = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    return {
      latitude: locationResult.coords.latitude,
      longitude: locationResult.coords.longitude,
    };
  } catch (error) {
    console.error('Error getting current location:', error);
    return null;
  }
};

/**
 * Get the address for a given location using reverse geocoding
 */
export const getAddressFromLocation = async (location: LocationType): Promise<string> => {
  try {
    const addresses = await Location.reverseGeocodeAsync({
      latitude: location.latitude,
      longitude: location.longitude,
    });

    if (addresses.length > 0) {
      const address = addresses[0];
      const parts = [
        address.streetNumber,
        address.street,
        address.city,
        address.region,
      ].filter(Boolean);
      
      return parts.join(', ');
    }

    return `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
  } catch (error) {
    console.error('Error reverse geocoding:', error);
    return `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
  }
};

/**
 * Get coordinates for a given address using forward geocoding
 */
export const geocodeAddress = async (address: string): Promise<LocationWithAddress | null> => {
  try {
    const locations = await Location.geocodeAsync(address);

    if (locations.length > 0) {
      const location = locations[0];
      return {
        latitude: location.latitude,
        longitude: location.longitude,
        address: address.trim(),
        geohash: generateGeohash({
          latitude: location.latitude,
          longitude: location.longitude,
        }),
      };
    }

    return null;
  } catch (error) {
    console.error('Error geocoding address:', error);
    return null;
  }
};

/**
 * Calculate the distance between two locations using the Haversine formula
 */
export const calculateDistance = (
  loc1: LocationType,
  loc2: LocationType
): number => {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = deg2rad(loc2.latitude - loc1.latitude);
  const dLon = deg2rad(loc2.longitude - loc1.longitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(loc1.latitude)) *
    Math.cos(deg2rad(loc2.latitude)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in km
  return distance;
};

/**
 * Check if a location is within a specified radius of another location
 */
export const isWithinRadius = (
  center: LocationType,
  target: LocationType,
  radiusKm: number
): boolean => {
  const distance = calculateDistance(center, target);
  return distance <= radiusKm;
};

/**
 * Format distance for display
 */
export const formatDistance = (distanceKm: number): string => {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)}m`;
  }
  return `${distanceKm.toFixed(1)}km`;
};

/**
 * Get the bounding box for a location with a given radius
 * Useful for Firestore range queries
 */
export const getBoundingBox = (
  center: LocationType,
  radiusKm: number
): {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
} => {
  const latDelta = radiusKm / 111; // Approximate km per degree latitude
  const lonDelta = radiusKm / (111 * Math.cos(deg2rad(center.latitude))); // Adjust for longitude

  return {
    minLat: center.latitude - latDelta,
    maxLat: center.latitude + latDelta,
    minLon: center.longitude - lonDelta,
    maxLon: center.longitude + lonDelta,
  };
};

/**
 * Check if the user has location permission
 */
export const hasLocationPermission = async (): Promise<boolean> => {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Error checking location permission:', error);
    return false;
  }
};

/**
 * Request location permission from the user
 */
export const requestLocationPermission = async (): Promise<boolean> => {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Error requesting location permission:', error);
    return false;
  }
};

/**
 * Watch user's location for real-time updates
 * Useful for live tracking during rides
 */
export const watchLocation = async (
  callback: (location: LocationType) => void,
  options: {
    accuracy?: Location.Accuracy;
    timeInterval?: number;
    distanceInterval?: number;
  } = {}
): Promise<Location.LocationSubscription | null> => {
  try {
    const hasPermission = await hasLocationPermission();
    if (!hasPermission) {
      const granted = await requestLocationPermission();
      if (!granted) {
        throw new Error('Location permission required for live tracking');
      }
    }

    const subscription = await Location.watchPositionAsync(
      {
        accuracy: options.accuracy || Location.Accuracy.High,
        timeInterval: options.timeInterval || 5000, // 5 seconds
        distanceInterval: options.distanceInterval || 10, // 10 meters
      },
      (locationUpdate) => {
        callback({
          latitude: locationUpdate.coords.latitude,
          longitude: locationUpdate.coords.longitude,
        });
      }
    );

    return subscription;
  } catch (error) {
    console.error('Error setting up location watching:', error);
    return null;
  }
};

/**
 * Check if a location is within campus bounds
 * TODO: Replace with actual campus coordinates
 */
export const isOnCampus = (location: LocationType, campusCenter: LocationType, campusRadiusKm: number = 5): boolean => {
  return isWithinRadius(campusCenter, location, campusRadiusKm);
};

/**
 * Get suggested pickup points near a location
 * TODO: Integrate with campus map data
 */
export const getSuggestedPickupPoints = async (location: LocationType): Promise<LocationWithAddress[]> => {
  // This is a placeholder - in a real app, you'd query a database of
  // popular pickup points, parking lots, etc.
  const suggestions: LocationWithAddress[] = [
    {
      latitude: location.latitude + 0.001,
      longitude: location.longitude + 0.001,
      address: 'Main Campus Parking Lot',
      geohash: generateGeohash({
        latitude: location.latitude + 0.001,
        longitude: location.longitude + 0.001,
      }),
    },
    {
      latitude: location.latitude - 0.001,
      longitude: location.longitude - 0.001,
      address: 'Student Union Building',
      geohash: generateGeohash({
        latitude: location.latitude - 0.001,
        longitude: location.longitude - 0.001,
      }),
    },
  ];

  return suggestions;
};

// Helper functions
function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

// Campus safety zones - TODO: Replace with actual campus data
export const CAMPUS_SAFETY_ZONES = [
  {
    name: 'Main Campus',
    center: { latitude: 40.7589, longitude: -73.9851 }, // Example coordinates
    radiusKm: 2,
  },
  {
    name: 'North Campus',
    center: { latitude: 40.7614, longitude: -73.9776 },
    radiusKm: 1.5,
  },
];

/**
 * Check if a location is in a designated safe zone
 */
export const isInSafeZone = (location: LocationType): boolean => {
  return CAMPUS_SAFETY_ZONES.some(zone =>
    isWithinRadius(zone.center, location, zone.radiusKm)
  );
};