import React from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';

// Dynamic import for react-native-maps to avoid web bundling issues
let MapView: any, Marker: any, PROVIDER_GOOGLE: any, Callout: any;

// Only import maps on native platforms using dynamic import to avoid bundler parsing
const loadMapsComponents = () => {
  if (Platform.OS !== 'web') {
    try {
      // This dynamic require won't be parsed by web bundler
      const mapsModule = 'react-native-maps';
      const Maps = eval(`require('${mapsModule}')`);
      MapView = Maps.default;
      Marker = Maps.Marker;
      PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
      Callout = Maps.Callout;
    } catch (error) {
      console.warn('react-native-maps not available');
    }
  }
};

// Initialize maps components
loadMapsComponents();

interface WebCompatibleMapProps {
  style?: any;
  initialRegion?: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  region?: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  showsUserLocation?: boolean;
  showsMyLocationButton?: boolean;
  provider?: any;
  onMapReady?: () => void;
  children?: React.ReactNode;
  fallbackMessage?: string;
  fallbackButton?: {
    text: string;
    onPress: () => void;
  };
}

export const WebCompatibleMap: React.FC<WebCompatibleMapProps> = ({
  style,
  initialRegion,
  region,
  showsUserLocation,
  showsMyLocationButton,
  provider,
  onMapReady,
  children,
  fallbackMessage = "🗺️ Interactive map available on mobile app",
  fallbackButton,
}) => {
  if (Platform.OS === 'web') {
    return (
      <View style={[style, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f0f0' }]}>
        <Text style={{ fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 8 }}>
          {fallbackMessage}
        </Text>
        {fallbackButton && (
          <TouchableOpacity 
            style={{ marginTop: 12, padding: 12, backgroundColor: '#3182ce', borderRadius: 6 }}
            onPress={fallbackButton.onPress}
          >
            <Text style={{ color: 'white', fontSize: 14 }}>{fallbackButton.text}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if (!MapView) {
    return (
      <View style={[style, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f0f0' }]}>
        <Text style={{ fontSize: 16, color: '#666' }}>Map not available</Text>
      </View>
    );
  }

  return (
    <MapView
      style={style}
      initialRegion={initialRegion}
      region={region}
      showsUserLocation={showsUserLocation}
      showsMyLocationButton={showsMyLocationButton}
      provider={provider}
      onMapReady={onMapReady}
    >
      {children}
    </MapView>
  );
};

interface WebCompatibleMarkerProps {
  coordinate: {
    latitude: number;
    longitude: number;
  };
  title?: string;
  description?: string;
  onCalloutPress?: () => void;
  children?: React.ReactNode;
}

export const WebCompatibleMarker: React.FC<WebCompatibleMarkerProps> = ({
  coordinate,
  title,
  description,
  onCalloutPress,
  children,
}) => {
  if (Platform.OS === 'web' || !Marker) {
    return null;
  }

  return (
    <Marker
      coordinate={coordinate}
      title={title}
      description={description}
      onCalloutPress={onCalloutPress}
    >
      {children}
    </Marker>
  );
};

interface WebCompatibleCalloutProps {
  children: React.ReactNode;
}

export const WebCompatibleCallout: React.FC<WebCompatibleCalloutProps> = ({ children }) => {
  if (Platform.OS === 'web' || !Callout) {
    return null;
  }

  return <Callout>{children}</Callout>;
};

export { PROVIDER_GOOGLE };