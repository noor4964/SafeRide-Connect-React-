import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/features/auth/context/AuthContext';
import { useUser } from '@/features/auth/hooks/useUser';
import { useNavigation } from '@react-navigation/native';
import { useResponsive } from '@/hooks/useResponsive';

export const WebHeader: React.FC = () => {
  const { user, signOut } = useAuth();
  const { userProfile } = useUser();
  const navigation = useNavigation();
  const { isWeb, isDesktop } = useResponsive();

  if (!isWeb || !isDesktop) return null;

  return (
    <View style={styles.header}>
      <View style={styles.container}>
        {/* Logo */}
        <View style={styles.logoSection}>
          <View style={styles.logoIcon}>
            <Text style={styles.logoEmoji}>🚗</Text>
          </View>
          <View>
            <Text style={styles.logoText}>SafeRide Connect</Text>
            <Text style={styles.logoSubtext}>Student Ride Sharing</Text>
          </View>
        </View>

        {/* Navigation Links */}
        <View style={styles.navLinks}>
          <TouchableOpacity 
            style={styles.navLink}
            onPress={() => navigation.navigate('Home' as never)}
          >
            <Ionicons name="home-outline" size={20} color="#4a5568" />
            <Text style={styles.navLinkText}>Home</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.navLink}
            onPress={() => navigation.navigate('PostRequest' as never)}
          >
            <Ionicons name="add-circle-outline" size={20} color="#4a5568" />
            <Text style={styles.navLinkText}>Post Request</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.navLink}
            onPress={() => navigation.navigate('MyRequests' as never)}
          >
            <Ionicons name="list-outline" size={20} color="#4a5568" />
            <Text style={styles.navLinkText}>My Requests</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.navLink}
            onPress={() => navigation.navigate('Safety' as never)}
          >
            <Ionicons name="shield-checkmark-outline" size={20} color="#4a5568" />
            <Text style={styles.navLinkText}>Safety</Text>
          </TouchableOpacity>
        </View>

        {/* User Section */}
        <View style={styles.userSection}>
          <TouchableOpacity 
            style={styles.notificationButton}
            onPress={() => navigation.navigate('Notifications' as never)}
          >
            <Ionicons name="notifications-outline" size={24} color="#4a5568" />
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>3</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.userButton}
            onPress={() => navigation.navigate('Profile' as never)}
          >
            <View style={styles.userAvatar}>
              <Text style={styles.userInitial}>
                {userProfile?.firstName?.charAt(0) || 'U'}
              </Text>
            </View>
            <Text style={styles.userName}>
              {userProfile?.firstName || 'User'}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#718096" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 12,
    ...(Platform.OS === 'web' && {
      position: 'sticky' as any,
      top: 0,
      zIndex: 1000,
    }),
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 1400,
    marginHorizontal: 'auto',
    paddingHorizontal: 24,
    width: '100%',
  },
  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#3182ce',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoEmoji: {
    fontSize: 24,
  },
  logoText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a365d',
  },
  logoSubtext: {
    fontSize: 12,
    color: '#718096',
  },
  navLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    justifyContent: 'center',
  },
  navLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer' as any,
      transition: 'background-color 0.2s',
    }),
  },
  navLinkText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4a5568',
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  notificationButton: {
    padding: 8,
    borderRadius: 8,
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  userButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...(Platform.OS === 'web' && {
      cursor: 'pointer' as any,
    }),
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3182ce',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInitial: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  userName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1a365d',
  },
});
