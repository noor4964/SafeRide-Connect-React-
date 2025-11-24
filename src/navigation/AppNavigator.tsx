import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/features/auth/context/AuthContext';
import { RootStackParamList, AuthStackParamList, MainTabParamList } from '@/types';
import { subscribeToUserNotifications } from '@/services/notificationService';
import { usePushNotifications } from '@/hooks/usePushNotifications';

// Import screens
import LoginScreen from '@/features/auth/screens/LoginScreen';
import RegisterScreen from '@/features/auth/screens/RegisterScreen';
import ProfileScreen from '@/features/auth/screens/ProfileScreen';
import AccountVerificationScreen from '@/features/auth/screens/AccountVerificationScreen';
import PhoneVerificationScreen from '@/features/auth/screens/PhoneVerificationScreen';
import HomeScreen from '@/screens/HomeScreen';
import PostRequestScreen from '@/screens/PostRequestScreen';
import MyRequestsScreen from '@/screens/MyRequestsScreen';
import NotificationsScreen from '@/screens/NotificationsScreen';
import FindMatchesScreen from '@/screens/FindMatchesScreen';
import MatchDetailsScreen from '@/screens/MatchDetailsScreen';
import GroupChatScreen from '@/screens/GroupChatScreen';
import RideDetailsScreen from '@/features/rides/screens/RideDetailsScreen';
import SafetyScreen from '@/screens/SafetyScreen';
import EmergencyContactsScreen from '@/screens/EmergencyContactsScreen';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainTab = createBottomTabNavigator<MainTabParamList>();

// Auth Stack Navigator
const AuthStackNavigator: React.FC = () => {
  return (
    <AuthStack.Navigator 
      screenOptions={{ 
        headerShown: false,
        gestureEnabled: true,
        gestureDirection: 'horizontal',
      }}
    >
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
};

// Placeholder for RideVerification screen
const RideVerificationScreen: React.FC = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <Text>Ride Verification - Coming Soon</Text>
  </View>
);

// Main Tab Navigator
const MainTabNavigator: React.FC = () => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  // Subscribe to notifications for badge count
  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToUserNotifications(user.uid, (notifications) => {
      const unread = notifications.filter(n => !n.isRead).length;
      setUnreadCount(unread);
    });

    return () => unsubscribe();
  }, [user]);

  // Register for push notifications
  const { expoPushToken, isRegistered } = usePushNotifications({
    userId: user?.uid,
    unreadCount,
  });

  // Log push notification status
  useEffect(() => {
    if (isRegistered && expoPushToken) {
      console.log('🔔 Push notifications enabled:', expoPushToken.substring(0, 20) + '...');
    }
  }, [isRegistered, expoPushToken]);

  return (
    <MainTab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          switch (route.name) {
            case 'Home':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'PostRequest':
              iconName = focused ? 'add-circle' : 'add-circle-outline';
              break;
            case 'MyRequests':
              iconName = focused ? 'list' : 'list-outline';
              break;
            case 'Notifications':
              iconName = focused ? 'notifications' : 'notifications-outline';
              break;
            case 'Safety':
              iconName = focused ? 'shield-checkmark' : 'shield-checkmark-outline';
              break;
            case 'Profile':
              iconName = focused ? 'person' : 'person-outline';
              break;
            default:
              iconName = 'help-circle-outline';
          }

          // Add badge for notifications
          if (route.name === 'Notifications' && unreadCount > 0) {
            return (
              <View>
                <Ionicons name={iconName} size={size} color={color} />
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              </View>
            );
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#3182ce',
        tabBarInactiveTintColor: '#718096',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#e2e8f0',
          paddingBottom: 8,
          paddingTop: 8,
          height: 84,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        headerStyle: {
          backgroundColor: '#ffffff',
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: '#e2e8f0',
        },
        headerTitleStyle: {
          fontSize: 18,
          fontWeight: '600',
          color: '#1a365d',
        },
      })}
    >
      <MainTab.Screen 
        name="Home" 
        component={HomeScreen} 
        options={{ title: 'Find Partners' }}
      />
      <MainTab.Screen 
        name="PostRequest" 
        component={PostRequestScreen} 
        options={{ title: 'Post Request' }}
      />
      <MainTab.Screen 
        name="MyRequests" 
        component={MyRequestsScreen} 
        options={{ title: 'My Requests' }}
      />
      <MainTab.Screen 
        name="Notifications" 
        component={NotificationsScreen} 
        options={{ title: 'Notifications' }}
      />
      <MainTab.Screen 
        name="Safety" 
        component={SafetyScreen} 
        options={{ title: 'Safety' }}
      />
      <MainTab.Screen 
        name="Profile" 
        component={ProfileScreen} 
        options={{ title: 'Profile' }}
      />
      <MainTab.Screen 
        name="AccountVerification" 
        component={AccountVerificationScreen} 
        options={{ 
          title: 'Verify Account',
          tabBarButton: () => null, // Hide from tab bar
        }}
      />
      <MainTab.Screen 
        name="PhoneVerification" 
        component={PhoneVerificationScreen} 
        options={{ 
          title: 'Phone Verification',
          tabBarButton: () => null, // Hide from tab bar
        }}
      />
      <MainTab.Screen 
        name="EmergencyContacts" 
        component={EmergencyContactsScreen} 
        options={{ 
          title: 'Emergency Contacts',
          tabBarButton: () => null, // Hide from tab bar
        }}
      />
      <MainTab.Screen 
        name="RideVerification" 
        component={RideVerificationScreen} 
        options={{ 
          title: 'Ride Verification',
          tabBarButton: () => null, // Hide from tab bar
        }}
      />
      <MainTab.Screen 
        name="RideDetails" 
        component={RideDetailsScreen} 
        options={{ 
          title: 'Ride Details',
          tabBarButton: () => null, // Hide from tab bar
        }}
      />
      <MainTab.Screen 
        name="FindMatches" 
        component={FindMatchesScreen} 
        options={{ 
          title: 'Find Matches',
          tabBarButton: () => null, // Hide from tab bar
        }}
      />
      <MainTab.Screen 
        name="MatchDetails" 
        component={MatchDetailsScreen} 
        options={{ 
          title: 'Match Details',
          tabBarButton: () => null, // Hide from tab bar
        }}
      />
      <MainTab.Screen 
        name="GroupChat" 
        component={GroupChatScreen} 
        options={{ 
          title: 'Group Chat',
          tabBarButton: () => null, // Hide from tab bar
        }}
      />
    </MainTab.Navigator>
  );
};

// Root Navigator
const AppNavigator: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    // TODO: Add proper loading screen
    return null;
  }

  return (
    <NavigationContainer>
      <RootStack.Navigator 
        screenOptions={{ headerShown: false }}
        initialRouteName={user ? 'Main' : 'Auth'}
      >
        {user ? (
          <RootStack.Screen name="Main" component={MainTabNavigator} />
        ) : (
          <RootStack.Screen name="Auth" component={AuthStackNavigator} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    right: -10,
    top: -4,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
});

export default AppNavigator;