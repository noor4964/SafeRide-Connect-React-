import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/features/auth/context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { MainTabParamList } from '@/types';
import { pickAndUploadProfilePicture } from '@/services/imageUploadService';
import { updateUserProfile } from '@/features/auth/services/userService';
import { useTheme } from '@/context/ThemeContext';

type ProfileScreenNavigationProp = BottomTabNavigationProp<MainTabParamList, 'Profile'>;

const ProfileScreen: React.FC = () => {
  const { user, userProfile, signOut, loading } = useAuth();
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const { themeMode, setThemeMode, colors } = useTheme();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  // Edit mode states
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedFirstName, setEditedFirstName] = useState(userProfile?.firstName || '');
  const [editedLastName, setEditedLastName] = useState(userProfile?.lastName || '');
  const [editedPhoneNumber, setEditedPhoneNumber] = useState(userProfile?.phoneNumber || '');
  const [editedEmail, setEditedEmail] = useState(user?.email || '');

  const handleUploadProfilePicture = async () => {
    if (!user) return;

    setUploadingImage(true);
    try {
      const result = await pickAndUploadProfilePicture(
        user.uid,
        userProfile?.profileImageUrl
      );

      if (result.success && result.url) {
        // Update user profile with new image URL
        await updateUserProfile(user.uid, {
          profileImageUrl: result.url,
        });

        Alert.alert('Success', 'Profile picture updated successfully!');
      } else if (result.error && result.error !== 'Cancelled') {
        Alert.alert('Error', result.error);
      }
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      Alert.alert('Error', 'Failed to upload profile picture');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleEditToggle = () => {
    if (isEditing) {
      // Cancel editing - reset values
      setEditedFirstName(userProfile?.firstName || '');
      setEditedLastName(userProfile?.lastName || '');
      setEditedPhoneNumber(userProfile?.phoneNumber || '');
      setEditedEmail(user?.email || '');
    }
    setIsEditing(!isEditing);
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    // Validation
    if (!editedFirstName.trim() || !editedLastName.trim()) {
      Alert.alert('Error', 'First name and last name are required');
      return;
    }

    if (!editedEmail.trim() || !editedEmail.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    const phoneRegex = /^[0-9]{10,15}$/;
    if (editedPhoneNumber && !phoneRegex.test(editedPhoneNumber.replace(/[\s\-]/g, ''))) {
      Alert.alert('Error', 'Please enter a valid phone number (10-15 digits)');
      return;
    }

    // Check if email changed
    const emailChanged = editedEmail.trim() !== user.email;
    if (emailChanged) {
      Alert.alert(
        'Email Change',
        'Changing your email requires re-authentication. This feature will be available in a future update.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsSaving(true);
    try {
      // Prepare update data
      const updateData: any = {
        firstName: editedFirstName.trim(),
        lastName: editedLastName.trim(),
      };

      // Only update phone number if not verified
      if (!userProfile?.isPhoneVerified) {
        updateData.phoneNumber = editedPhoneNumber.trim();
      }

      // Update profile in Firestore
      await updateUserProfile(user.uid, updateData);

      Alert.alert('Success', 'Profile updated successfully!');
      setIsEditing(false);
    } catch (error: any) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoggingOut(true);
              await signOut();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to logout');
            } finally {
              setIsLoggingOut(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const getInitials = () => {
    if (userProfile?.firstName && userProfile?.lastName) {
      return `${userProfile.firstName[0]}${userProfile.lastName[0]}`.toUpperCase();
    }
    return user?.email?.[0].toUpperCase() || 'U';
  };

  const isStudent = user?.email?.includes('@student.aiub.edu');
  const isFaculty = user?.email?.includes('@aiub.edu') && !isStudent;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Profile Header */}
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <View style={styles.avatarContainer}>
            {userProfile?.profileImageUrl ? (
              <Image
                source={{ uri: userProfile.profileImageUrl }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{getInitials()}</Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.cameraButton}
              onPress={handleUploadProfilePicture}
              disabled={uploadingImage}
            >
              {uploadingImage ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="camera" size={16} color="#fff" />
              )}
            </TouchableOpacity>
            <View style={[styles.badge, isStudent ? styles.studentBadge : styles.facultyBadge]}>
              <Ionicons
                name={isStudent ? 'school' : 'briefcase'}
                size={12}
                color="#ffffff"
              />
            </View>
          </View>

          <Text style={[styles.name, { color: colors.text }]}>
            {userProfile?.firstName} {userProfile?.lastName}
          </Text>
          <Text style={[styles.email, { color: colors.textSecondary }]}>{user?.email}</Text>

          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{userProfile?.totalRides || 0}</Text>
              <Text style={styles.statLabel}>Rides</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {userProfile?.rating ? userProfile.rating.toFixed(1) : '0.0'}
              </Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Ionicons
                name={userProfile?.isVerified ? 'checkmark-circle' : 'close-circle'}
                size={24}
                color={userProfile?.isVerified ? '#38a169' : '#e53e3e'}
              />
              <Text style={styles.statLabel}>
                {userProfile?.isVerified ? 'Verified' : 'Unverified'}
              </Text>
            </View>
          </View>
        </View>

        {/* Profile Information */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Profile Information</Text>
            <TouchableOpacity 
              style={styles.editButton}
              onPress={handleEditToggle}
              disabled={isSaving}
            >
              <Ionicons 
                name={isEditing ? "close" : "create-outline"} 
                size={20} 
                color="#3182ce" 
              />
              <Text style={styles.editButtonText}>{isEditing ? 'Cancel' : 'Edit'}</Text>
            </TouchableOpacity>
          </View>

          {/* First Name */}
          <View style={styles.infoItem}>
            <View style={styles.infoIconContainer}>
              <Ionicons name="person-outline" size={20} color="#3182ce" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>First Name</Text>
              {isEditing ? (
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  value={editedFirstName}
                  onChangeText={setEditedFirstName}
                  placeholder="Enter first name"
                  placeholderTextColor={colors.textTertiary}
                />
              ) : (
                <Text style={styles.infoValue}>{userProfile?.firstName}</Text>
              )}
            </View>
          </View>

          {/* Last Name */}
          <View style={styles.infoItem}>
            <View style={styles.infoIconContainer}>
              <Ionicons name="person-outline" size={20} color="#3182ce" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Last Name</Text>
              {isEditing ? (
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  value={editedLastName}
                  onChangeText={setEditedLastName}
                  placeholder="Enter last name"
                  placeholderTextColor={colors.textTertiary}
                />
              ) : (
                <Text style={styles.infoValue}>{userProfile?.lastName}</Text>
              )}
            </View>
          </View>

          {/* Email */}
          <View style={styles.infoItem}>
            <View style={styles.infoIconContainer}>
              <Ionicons name="mail-outline" size={20} color="#3182ce" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Email</Text>
              {isEditing ? (
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  value={editedEmail}
                  onChangeText={setEditedEmail}
                  placeholder="Enter email"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              ) : (
                <Text style={styles.infoValue}>{user?.email}</Text>
              )}
            </View>
          </View>

          {/* Phone Number */}
          <View style={styles.infoItem}>
            <View style={styles.infoIconContainer}>
              <Ionicons name="call-outline" size={20} color="#3182ce" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Phone Number</Text>
              {isEditing && !userProfile?.isPhoneVerified ? (
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  value={editedPhoneNumber}
                  onChangeText={setEditedPhoneNumber}
                  placeholder="Enter phone number"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="phone-pad"
                />
              ) : (
                <View style={styles.phoneNumberContainer}>
                  <Text style={styles.infoValue}>{userProfile?.phoneNumber || 'Not provided'}</Text>
                  {userProfile?.phoneNumber && !userProfile?.isPhoneVerified && !isEditing && (
                    <TouchableOpacity
                      style={styles.verifyPhoneButton}
                      onPress={() => navigation.navigate('PhoneVerification', { phoneNumber: userProfile.phoneNumber })}
                    >
                      <Text style={styles.verifyPhoneText}>Verify</Text>
                    </TouchableOpacity>
                  )}
                  {userProfile?.isPhoneVerified && (
                    <View style={styles.verifiedBadge}>
                      <Ionicons name="checkmark-circle" size={16} color="#38a169" />
                      <Text style={styles.verifiedText}>Verified</Text>
                    </View>
                  )}
                </View>
              )}
              {isEditing && userProfile?.isPhoneVerified && (
                <Text style={[styles.lockedText, { color: colors.textTertiary }]}>
                  Phone number is verified and cannot be changed
                </Text>
              )}
            </View>
          </View>

          {/* Save Button */}
          {isEditing && (
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSaveProfile}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <View style={styles.infoItem}>
            <View style={styles.infoIconContainer}>
              <Ionicons name="school-outline" size={20} color="#3182ce" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>University</Text>
              <Text style={styles.infoValue}>{userProfile?.university || 'AIUB'}</Text>
            </View>
          </View>

          <View style={styles.infoItem}>
            <View style={styles.infoIconContainer}>
              <Ionicons
                name={isStudent ? 'id-card-outline' : 'briefcase-outline'}
                size={20}
                color="#3182ce"
              />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Account Type</Text>
              <Text style={styles.infoValue}>{isStudent ? 'Student' : 'Faculty'}</Text>
            </View>
          </View>
        </View>

        {/* Safety & Settings */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Safety & Settings</Text>

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => navigation.navigate('AccountVerification')}
          >
            <View style={styles.menuIconContainer}>
              <Ionicons name="shield-checkmark-outline" size={22} color="#3182ce" />
            </View>
            <Text style={styles.menuText}>Account Verification</Text>
            {(!userProfile?.isVerified || !userProfile?.isStudentVerified) && (
              <View style={styles.notificationDot} />
            )}
            <Ionicons name="chevron-forward" size={20} color="#a0aec0" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuIconContainer}>
              <Ionicons name="people-outline" size={22} color="#3182ce" />
            </View>
            <Text style={styles.menuText}>Emergency Contacts</Text>
            <Ionicons name="chevron-forward" size={20} color="#a0aec0" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuIconContainer}>
              <Ionicons name="lock-closed-outline" size={22} color="#3182ce" />
            </View>
            <Text style={styles.menuText}>Privacy Settings</Text>
            <Ionicons name="chevron-forward" size={20} color="#a0aec0" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuIconContainer}>
              <Ionicons name="notifications-outline" size={22} color="#3182ce" />
            </View>
            <Text style={styles.menuText}>Notifications</Text>
            <Ionicons name="chevron-forward" size={20} color="#a0aec0" />
          </TouchableOpacity>

          <View style={styles.menuItem}>
            <View style={styles.menuIconContainer}>
              <Ionicons 
                name={themeMode === 'dark' ? 'moon' : themeMode === 'light' ? 'sunny' : 'contrast-outline'} 
                size={22} 
                color="#3182ce" 
              />
            </View>
            <Text style={[styles.menuText, { color: colors.text }]}>Theme</Text>
            <View style={styles.themeSelector}>
              <TouchableOpacity
                style={[
                  styles.themeOption, 
                  { backgroundColor: colors.divider },
                  themeMode === 'light' && [styles.themeOptionActive, { borderColor: colors.primary }]
                ]}
                onPress={() => setThemeMode('light')}
              >
                <Ionicons name="sunny" size={16} color={themeMode === 'light' ? colors.primary : colors.textTertiary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.themeOption, 
                  { backgroundColor: colors.divider },
                  themeMode === 'system' && [styles.themeOptionActive, { borderColor: colors.primary }]
                ]}
                onPress={() => setThemeMode('system')}
              >
                <Ionicons name="contrast-outline" size={16} color={themeMode === 'system' ? colors.primary : colors.textTertiary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.themeOption, 
                  { backgroundColor: colors.divider },
                  themeMode === 'dark' && [styles.themeOptionActive, { borderColor: colors.primary }]
                ]}
                onPress={() => setThemeMode('dark')}
              >
                <Ionicons name="moon" size={16} color={themeMode === 'dark' ? colors.primary : colors.textTertiary} />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuIconContainer}>
              <Ionicons name="help-circle-outline" size={22} color="#3182ce" />
            </View>
            <Text style={styles.menuText}>Help & Support</Text>
            <Ionicons name="chevron-forward" size={20} color="#a0aec0" />
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          disabled={isLoggingOut}
        >
          <Ionicons name="log-out-outline" size={22} color="#e53e3e" />
          <Text style={styles.logoutText}>
            {isLoggingOut ? 'Logging out...' : 'Logout'}
          </Text>
        </TouchableOpacity>

        {/* App Version */}
        <Text style={styles.versionText}>SafeRide Connect v1.0.0</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#718096',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    backgroundColor: '#ffffff',
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#3182ce',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3182ce',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  badge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  studentBadge: {
    backgroundColor: '#3182ce',
  },
  facultyBadge: {
    backgroundColor: '#805ad5',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a365d',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#718096',
    marginBottom: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    width: '100%',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a365d',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#718096',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e2e8f0',
  },
  section: {
    backgroundColor: '#ffffff',
    marginTop: 16,
    paddingVertical: 20,
    paddingHorizontal: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a365d',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#ebf8ff',
    borderRadius: 8,
    gap: 4,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3182ce',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f7fafc',
  },
  infoIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ebf8ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#718096',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    color: '#2d3748',
    fontWeight: '500',
  },
  phoneNumberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  verifyPhoneButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#3182ce',
    borderRadius: 6,
  },
  verifyPhoneText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#f0fdf4',
    borderRadius: 6,
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#38a169',
  },
  lockedText: {
    fontSize: 13,
    color: '#718096',
    fontStyle: 'italic',
    marginTop: 4,
  },
  input: {
    fontSize: 15,
    color: '#2d3748',
    fontWeight: '500',
    borderWidth: 1,
    borderColor: '#cbd5e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 4,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3182ce',
    marginTop: 16,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#3182ce',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  notificationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f59e0b',
    marginLeft: 'auto',
    marginRight: 8,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ebf8ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuText: {
    flex: 1,
    fontSize: 15,
    color: '#2d3748',
    fontWeight: '500',
  },
  themeSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  themeOption: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  themeOptionActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#3182ce',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: 24,
    marginTop: 24,
    padding: 18,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#ef4444',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  logoutText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ef4444',
    marginLeft: 8,
    letterSpacing: 0.3,
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#a0aec0',
    marginTop: 24,
  },
});

export default ProfileScreen;
