import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  Linking,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import * as Location from 'expo-location';
import { useAuth } from '@/features/auth/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { MainTabParamList } from '@/types';
import { triggerSOSAlert, sendLocationToEmergencyContacts } from '@/services/safetyService';

type SafetyNavigationProp = BottomTabNavigationProp<MainTabParamList>;

const SafetyScreen: React.FC = () => {
  const navigation = useNavigation<SafetyNavigationProp>();
  const { user, userProfile } = useAuth();
  const { colors } = useTheme();

  const [sosPressed, setSosPressed] = useState(false);
  const [shareLocation, setShareLocation] = useState(false);
  const [autoShareOnRide, setAutoShareOnRide] = useState(true);
  const [pulseAnimation] = useState(new Animated.Value(1));

  // SOS button pulse animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnimation, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnimation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const handleSOSPress = () => {
    if (sosPressed) return;

    Alert.alert(
      '🚨 Emergency SOS',
      'This will immediately alert your emergency contacts and share your location. Continue?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Send SOS',
          style: 'destructive',
          onPress: async () => {
            setSosPressed(true);
            try {
              // Get current location
              const { status } = await Location.requestForegroundPermissionsAsync();
              if (status !== 'granted') {
                Alert.alert('Error', 'Location permission is required for SOS alerts');
                setSosPressed(false);
                return;
              }

              const location = await Location.getCurrentPositionAsync({});
              
              // Trigger SOS alert
              if (user) {
                await triggerSOSAlert(user.uid, {
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude,
                });

                Alert.alert(
                  '✅ SOS Alert Sent',
                  'Your emergency contacts have been notified with your current location.',
                  [{ text: 'OK' }]
                );
              }
            } catch (error: any) {
              console.error('SOS Error:', error);
              Alert.alert('Error', error.message || 'Failed to send SOS alert');
            } finally {
              setSosPressed(false);
            }
          },
        },
      ]
    );
  };

  const handleShareLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Location permission is needed to share your location');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      
      if (user) {
        await sendLocationToEmergencyContacts(user.uid, {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        Alert.alert('✅ Success', 'Your location has been shared with emergency contacts');
        setShareLocation(true);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to share location');
    }
  };

  const handleCall = (number: string) => {
    Linking.openURL(`tel:${number}`);
  };

  const emergencyNumbers = [
    { name: 'Police', number: '999', icon: 'shield-outline' as const, color: '#3182ce' },
    { name: 'Ambulance', number: '199', icon: 'medical-outline' as const, color: '#ef4444' },
    { name: 'Fire Service', number: '9555555', icon: 'flame-outline' as const, color: '#f59e0b' },
    { name: 'RAB', number: '01777-792641', icon: 'shield-checkmark-outline' as const, color: '#8b5cf6' },
  ];

  const hasEmergencyContacts = userProfile?.emergencyContacts && userProfile.emergencyContacts.length > 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="shield-checkmark" size={48} color="#3182ce" />
          <Text style={[styles.title, { color: colors.text }]}>Safety Center</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Your safety is our priority
          </Text>
        </View>

        {/* SOS Button */}
        <Animated.View style={[styles.sosContainer, { transform: [{ scale: pulseAnimation }] }]}>
          <TouchableOpacity
            style={[styles.sosButton, sosPressed && styles.sosButtonPressed]}
            onPress={handleSOSPress}
            disabled={sosPressed}
            activeOpacity={0.8}
          >
            <Ionicons name="alert-circle" size={80} color="#ffffff" />
            <Text style={styles.sosButtonText}>SOS</Text>
            <Text style={styles.sosButtonSubtext}>Tap to alert emergency contacts</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Emergency Contacts Status */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.cardHeader}>
            <Ionicons 
              name={hasEmergencyContacts ? "people" : "people-outline"} 
              size={24} 
              color={hasEmergencyContacts ? "#38a169" : "#f59e0b"} 
            />
            <Text style={[styles.cardTitle, { color: colors.text }]}>Emergency Contacts</Text>
          </View>
          
          {hasEmergencyContacts ? (
            <>
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                {userProfile.emergencyContacts.length} contact(s) will be notified in case of emergency
              </Text>
              <View style={styles.contactsList}>
                {userProfile.emergencyContacts.map((contact, index) => (
                  <View key={index} style={[styles.contactItem, { borderBottomColor: colors.border }]}>
                    <View style={styles.contactInfo}>
                      <Text style={[styles.contactName, { color: colors.text }]}>{contact.name}</Text>
                      <Text style={[styles.contactRelation, { color: colors.textTertiary }]}>
                        {contact.relationship}
                      </Text>
                    </View>
                    <TouchableOpacity 
                      style={styles.callButton}
                      onPress={() => handleCall(contact.phone)}
                    >
                      <Ionicons name="call" size={20} color="#3182ce" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <View style={styles.warningBox}>
              <Ionicons name="warning" size={20} color="#f59e0b" />
              <Text style={styles.warningText}>
                No emergency contacts added. Add contacts to enable safety features.
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.manageButton}
            onPress={() => navigation.navigate('EmergencyContacts')}
          >
            <Ionicons name="settings-outline" size={18} color="#3182ce" />
            <Text style={styles.manageButtonText}>Manage Contacts</Text>
          </TouchableOpacity>
        </View>

        {/* Location Sharing */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="location" size={24} color="#3182ce" />
            <Text style={[styles.cardTitle, { color: colors.text }]}>Location Sharing</Text>
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Share Live Location</Text>
              <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                Share your current location with emergency contacts
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.shareButton, shareLocation && styles.shareButtonActive]}
              onPress={handleShareLocation}
              disabled={!hasEmergencyContacts}
            >
              <Ionicons 
                name={shareLocation ? "radio-button-on" : "radio-button-off"} 
                size={24} 
                color={shareLocation ? "#38a169" : "#94a3b8"} 
              />
              <Text style={[styles.shareButtonText, shareLocation && styles.shareButtonTextActive]}>
                {shareLocation ? 'Sharing' : 'Share Now'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.settingItem, { borderBottomWidth: 0 }]}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Auto-share on Rides</Text>
              <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                Automatically share location during active rides
              </Text>
            </View>
            <Switch
              value={autoShareOnRide}
              onValueChange={setAutoShareOnRide}
              trackColor={{ false: '#cbd5e0', true: '#90cdf4' }}
              thumbColor={autoShareOnRide ? '#3182ce' : '#f4f4f5'}
            />
          </View>
        </View>

        {/* Emergency Hotlines */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="call" size={24} color="#ef4444" />
            <Text style={[styles.cardTitle, { color: colors.text }]}>Emergency Hotlines</Text>
          </View>

          <View style={styles.hotlineGrid}>
            {emergencyNumbers.map((hotline, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.hotlineCard, { borderColor: colors.border }]}
                onPress={() => handleCall(hotline.number)}
              >
                <View style={[styles.hotlineIcon, { backgroundColor: `${hotline.color}20` }]}>
                  <Ionicons name={hotline.icon} size={28} color={hotline.color} />
                </View>
                <Text style={[styles.hotlineName, { color: colors.text }]}>{hotline.name}</Text>
                <Text style={[styles.hotlineNumber, { color: colors.textSecondary }]}>
                  {hotline.number}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Safety Tips */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="information-circle" size={24} color="#3182ce" />
            <Text style={[styles.cardTitle, { color: colors.text }]}>Safety Tips</Text>
          </View>

          <View style={styles.tipsList}>
            {[
              'Always verify rider details before starting',
              'Share trip details with trusted contacts',
              'Meet at well-lit, public locations',
              'Trust your instincts - cancel if uncomfortable',
              'Keep emergency contacts updated',
            ].map((tip, index) => (
              <View key={index} style={styles.tipItem}>
                <Ionicons name="checkmark-circle" size={20} color="#38a169" />
                <Text style={[styles.tipText, { color: colors.textSecondary }]}>{tip}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Ride Verification */}
        <TouchableOpacity
          style={[styles.card, { backgroundColor: colors.surface }]}
          onPress={() => navigation.navigate('RideVerification')}
        >
          <View style={styles.cardHeader}>
            <Ionicons name="key" size={24} color="#8b5cf6" />
            <Text style={[styles.cardTitle, { color: colors.text }]}>Ride Verification Code</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </View>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Use verification codes to confirm rider identity before starting your trip
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a365d',
    marginTop: 12,
  },
  subtitle: {
    fontSize: 15,
    color: '#718096',
    marginTop: 4,
  },
  sosContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  sosButton: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  sosButtonPressed: {
    backgroundColor: '#dc2626',
    transform: [{ scale: 0.95 }],
  },
  sosButtonText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#ffffff',
    marginTop: 8,
  },
  sosButtonSubtext: {
    fontSize: 12,
    color: '#ffffff',
    marginTop: 4,
    opacity: 0.9,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a365d',
    flex: 1,
  },
  infoText: {
    fontSize: 14,
    color: '#718096',
    lineHeight: 20,
    marginBottom: 12,
  },
  contactsList: {
    marginTop: 12,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 2,
  },
  contactRelation: {
    fontSize: 13,
    color: '#a0aec0',
  },
  callButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ebf8ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    padding: 12,
    borderRadius: 8,
    gap: 8,
    marginBottom: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#92400e',
    lineHeight: 18,
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#ebf8ff',
    borderRadius: 8,
    gap: 8,
    marginTop: 8,
  },
  manageButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3182ce',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  settingInfo: {
    flex: 1,
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    color: '#718096',
    lineHeight: 18,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  shareButtonActive: {
    backgroundColor: '#f0fdf4',
  },
  shareButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  shareButtonTextActive: {
    color: '#38a169',
  },
  hotlineGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  hotlineCard: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  hotlineIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ebf8ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  hotlineName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 4,
  },
  hotlineNumber: {
    fontSize: 13,
    color: '#718096',
  },
  tipsList: {
    gap: 12,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: '#4a5568',
    lineHeight: 20,
  },
});

export default SafetyScreen;
