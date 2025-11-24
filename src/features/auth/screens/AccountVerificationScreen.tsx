import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useAuth } from '@/features/auth/context/AuthContext';
import { auth } from '@/config/firebaseConfig';
import { verifyStudentStatus, sendEmailOTP, verifyEmailOTP } from '@/features/auth/services/userService';
import { MainTabParamList } from '@/types';

type AccountVerificationNavigationProp = BottomTabNavigationProp<MainTabParamList>;

const AccountVerificationScreen: React.FC = () => {
  const navigation = useNavigation<AccountVerificationNavigationProp>();
  const { user, userProfile, refreshUserProfile } = useAuth();
  const [emailOTPSent, setEmailOTPSent] = useState(false);
  const [emailOTP, setEmailOTP] = useState('');
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [isVerifyingStudent, setIsVerifyingStudent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleSendEmailOTP = async () => {
    if (!auth || !user) {
      Alert.alert('Error', 'Please login to verify your email');
      return;
    }

    try {
      const otpSent = await sendEmailOTP(user.uid, user.email || '');
      if (otpSent) {
        setEmailOTPSent(true);
        setCountdown(60); // 60 seconds cooldown
        Alert.alert(
          'OTP Sent',
          'A 6-digit verification code has been sent to your email. Please check your inbox.',
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      if (error.code === 'auth/too-many-requests') {
        Alert.alert('Error', 'Too many requests. Please try again later.');
      } else {
        Alert.alert('Error', error.message || 'Failed to send verification code');
      }
    }
  };

  const handleVerifyEmailOTP = async () => {
    if (!user) {
      Alert.alert('Error', 'Please login first');
      return;
    }

    if (!emailOTP.trim() || emailOTP.length !== 6) {
      Alert.alert('Error', 'Please enter a valid 6-digit code');
      return;
    }

    try {
      setIsVerifyingEmail(true);
      const verified = await verifyEmailOTP(user.uid, emailOTP);
      
      if (verified) {
        await refreshUserProfile();
        Alert.alert(
          'Success!',
          'Your email has been verified successfully.',
          [{ text: 'OK' }]
        );
        setEmailOTP('');
        setEmailOTPSent(false);
      } else {
        Alert.alert(
          'Invalid Code',
          'The verification code is incorrect or has expired. Please try again.'
        );
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to verify email');
    } finally {
      setIsVerifyingEmail(false);
    }
  };

  const handleVerifyStudent = async () => {
    if (!user) {
      Alert.alert('Error', 'Please login first');
      return;
    }

    if (!studentId.trim()) {
      Alert.alert('Error', 'Please enter your student ID');
      return;
    }

    // Validate AIUB student ID format: XX-XXXXX-X
    const studentIdRegex = /^\d{2}-\d{5}-\d{1}$/;
    if (!studentIdRegex.test(studentId)) {
      Alert.alert(
        'Invalid Format',
        'Student ID must be in format: XX-XXXXX-X (e.g., 21-45678-1)'
      );
      return;
    }

    // Extract student ID from email
    const emailStudentId = user.email?.split('@')[0];
    if (emailStudentId !== studentId) {
      Alert.alert(
        'ID Mismatch',
        'Student ID must match your email address'
      );
      return;
    }

    try {
      setIsVerifyingStudent(true);
      const verified = await verifyStudentStatus(user.uid, studentId, user.email || '');
      
      if (verified) {
        await refreshUserProfile();
        Alert.alert(
          'Success!',
          'Your student status has been verified. You can now access all features.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Verification Failed',
          'Unable to verify your student status. Please contact support.'
        );
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to verify student status');
    } finally {
      setIsVerifyingStudent(false);
    }
  };

  const isStudent = user?.email?.includes('@student.aiub.edu');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="shield-checkmark" size={64} color="#3182ce" />
          <Text style={styles.title}>Account Verification</Text>
          <Text style={styles.subtitle}>
            Verify your account to access all SafeRide features
          </Text>
        </View>

        {/* Email Verification Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIconContainer}>
              <Ionicons name="mail" size={24} color="#3182ce" />
            </View>
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle}>Email Verification</Text>
              <Text style={styles.cardSubtitle}>Verify your AIUB email</Text>
            </View>
            {user?.emailVerified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={24} color="#38a169" />
              </View>
            )}
          </View>

          <View style={styles.cardContent}>
            <Text style={styles.email}>{user?.email}</Text>

            {userProfile?.isVerified ? (
              <View style={styles.verifiedContainer}>
                <Ionicons name="checkmark-circle" size={48} color="#38a169" />
                <Text style={styles.verifiedText}>Email Verified</Text>
                <Text style={styles.verifiedSubtext}>Your email has been verified</Text>
              </View>
            ) : (
              <>
                <Text style={styles.infoText}>
                  Enter your AIUB email to receive a 6-digit verification code.
                </Text>

                {!emailOTPSent ? (
                  <TouchableOpacity
                    style={[
                      styles.button,
                      countdown > 0 && styles.buttonDisabled
                    ]}
                    onPress={handleSendEmailOTP}
                    disabled={countdown > 0}
                  >
                    <Ionicons name="mail-outline" size={20} color="#ffffff" />
                    <Text style={styles.buttonText}>
                      {countdown > 0
                        ? `Resend in ${countdown}s`
                        : 'Send Verification Code'}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    <View style={styles.inputContainer}>
                      <Text style={styles.label}>Verification Code</Text>
                      <TextInput
                        style={styles.otpInput}
                        value={emailOTP}
                        onChangeText={setEmailOTP}
                        placeholder="Enter 6-digit code"
                        keyboardType="number-pad"
                        maxLength={6}
                        editable={!isVerifyingEmail}
                      />
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.button,
                        isVerifyingEmail && styles.buttonDisabled
                      ]}
                      onPress={handleVerifyEmailOTP}
                      disabled={isVerifyingEmail}
                    >
                      <Ionicons name="checkmark-circle-outline" size={20} color="#ffffff" />
                      <Text style={styles.buttonText}>
                        {isVerifyingEmail ? 'Verifying...' : 'Verify Email'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.resendLink}
                      onPress={handleSendEmailOTP}
                      disabled={countdown > 0}
                    >
                      <Text style={[styles.resendLinkText, countdown > 0 && styles.resendLinkDisabled]}>
                        {countdown > 0 ? `Resend code in ${countdown}s` : 'Resend code'}
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.infoBox}>
                      <Ionicons name="information-circle" size={20} color="#3182ce" />
                      <Text style={styles.infoBoxText}>
                        Check your email inbox for the 6-digit code. Code expires in 10 minutes.
                      </Text>
                    </View>
                  </>
                )}
              </>
            )}
          </View>
        </View>

        {/* Phone Verification Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIconContainer}>
              <Ionicons name="phone-portrait" size={24} color="#3182ce" />
            </View>
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle}>Phone Verification</Text>
              <Text style={styles.cardSubtitle}>Verify your phone number</Text>
            </View>
            {userProfile?.isPhoneVerified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={24} color="#38a169" />
              </View>
            )}
          </View>

          <View style={styles.cardContent}>
            {userProfile?.isPhoneVerified ? (
              <View style={styles.verifiedContainer}>
                <Ionicons name="checkmark-circle" size={48} color="#38a169" />
                <Text style={styles.verifiedText}>Phone Verified</Text>
                <Text style={styles.verifiedSubtext}>
                  {userProfile.phoneNumber}
                </Text>
              </View>
            ) : (
              <>
                <Text style={styles.infoText}>
                  Verify your phone number to enhance account security and receive ride notifications.
                </Text>

                <Text style={styles.phoneDisplay}>{userProfile?.phoneNumber || 'No phone number'}</Text>

                {userProfile?.phoneNumber ? (
                  <TouchableOpacity
                    style={styles.button}
                    onPress={() => navigation.navigate('PhoneVerification', { phoneNumber: userProfile.phoneNumber })}
                  >
                    <Ionicons name="shield-checkmark-outline" size={20} color="#ffffff" />
                    <Text style={styles.buttonText}>Verify Phone Number</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.warningBox}>
                    <Ionicons name="information-circle" size={20} color="#3182ce" />
                    <Text style={styles.warningBoxText}>
                      Please add your phone number in Profile settings first.
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>
        </View>

        {/* Student Verification Card (only for students) */}
        {isStudent && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIconContainer}>
                <Ionicons name="school" size={24} color="#3182ce" />
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={styles.cardTitle}>Student Verification</Text>
                <Text style={styles.cardSubtitle}>Verify your student status</Text>
              </View>
              {userProfile?.isStudentVerified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={24} color="#38a169" />
                </View>
              )}
            </View>

            <View style={styles.cardContent}>
              {userProfile?.isStudentVerified ? (
                <View style={styles.verifiedContainer}>
                  <Ionicons name="checkmark-circle" size={48} color="#38a169" />
                  <Text style={styles.verifiedText}>Student Verified</Text>
                  <Text style={styles.verifiedSubtext}>
                    Student ID: {userProfile.studentId || 'N/A'}
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={styles.infoText}>
                    Enter your AIUB student ID to verify your student status. This must
                    match your email address.
                  </Text>

                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Student ID</Text>
                    <TextInput
                      style={styles.input}
                      value={studentId}
                      onChangeText={setStudentId}
                      placeholder="21-45678-1"
                      keyboardType="default"
                      autoCapitalize="none"
                      editable={!isVerifyingStudent}
                    />
                    <Text style={styles.helperText}>
                      Format: XX-XXXXX-X (must match your email)
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.button,
                      isVerifyingStudent && styles.buttonDisabled
                    ]}
                    onPress={handleVerifyStudent}
                    disabled={isVerifyingStudent}
                  >
                    <Ionicons name="checkmark-circle-outline" size={20} color="#ffffff" />
                    <Text style={styles.buttonText}>
                      {isVerifyingStudent ? 'Verifying...' : 'Verify Student ID'}
                    </Text>
                  </TouchableOpacity>

                  {!userProfile?.isVerified && (
                    <View style={styles.warningBox}>
                      <Ionicons name="warning" size={20} color="#f59e0b" />
                      <Text style={styles.warningBoxText}>
                        You need to verify your email first before verifying your student
                        status.
                      </Text>
                    </View>
                  )}
                </>
              )}
            </View>
          </View>
        )}

        {/* Faculty Info (for faculty members) */}
        {!isStudent && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIconContainer}>
                <Ionicons name="briefcase" size={24} color="#805ad5" />
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={styles.cardTitle}>Faculty Member</Text>
                <Text style={styles.cardSubtitle}>Automatic verification</Text>
              </View>
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={24} color="#38a169" />
              </View>
            </View>

            <View style={styles.cardContent}>
              <Text style={styles.infoText}>
                As a faculty member, your account is automatically verified once you
                complete email verification.
              </Text>
            </View>
          </View>
        )}

        {/* Benefits Info */}
        <View style={styles.benefitsCard}>
          <Text style={styles.benefitsTitle}>Why Verify Your Account?</Text>
          <View style={styles.benefitItem}>
            <Ionicons name="checkmark-circle" size={20} color="#38a169" />
            <Text style={styles.benefitText}>Post and find rides</Text>
          </View>
          <View style={styles.benefitItem}>
            <Ionicons name="checkmark-circle" size={20} color="#38a169" />
            <Text style={styles.benefitText}>Access emergency SOS features</Text>
          </View>
          <View style={styles.benefitItem}>
            <Ionicons name="checkmark-circle" size={20} color="#38a169" />
            <Text style={styles.benefitText}>Build trust with verification badge</Text>
          </View>
          <View style={styles.benefitItem}>
            <Ionicons name="checkmark-circle" size={20} color="#38a169" />
            <Text style={styles.benefitText}>Enhanced safety and security</Text>
          </View>
        </View>
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
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a365d',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 14,
    color: '#718096',
    textAlign: 'center',
    marginTop: 8,
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
  },
  cardIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ebf8ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a365d',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#718096',
    marginTop: 2,
  },
  verifiedBadge: {
    marginLeft: 8,
  },
  cardContent: {
    paddingTop: 8,
  },
  email: {
    fontSize: 14,
    color: '#2d3748',
    fontWeight: '500',
    marginBottom: 8,
  },
  phoneDisplay: {
    fontSize: 16,
    color: '#2d3748',
    backgroundColor: '#f7fafc',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  infoText: {
    fontSize: 14,
    color: '#4a5568',
    lineHeight: 20,
    marginBottom: 16,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3182ce',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  buttonDisabled: {
    backgroundColor: '#a0aec0',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#ebf8ff',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#3182ce',
  },
  infoBoxText: {
    flex: 1,
    fontSize: 13,
    color: '#2c5282',
    marginLeft: 8,
    lineHeight: 18,
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: '#fffbeb',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
    marginTop: 8,
  },
  warningBoxText: {
    flex: 1,
    fontSize: 13,
    color: '#92400e',
    marginLeft: 8,
    lineHeight: 18,
  },
  verifiedContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  verifiedText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#38a169',
    marginTop: 12,
  },
  verifiedSubtext: {
    fontSize: 14,
    color: '#718096',
    marginTop: 4,
  },
  inputContainer: {
    marginBottom: 16,
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
  otpInput: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#3182ce',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 24,
    color: '#2d3748',
    textAlign: 'center',
    fontWeight: '600',
    letterSpacing: 8,
  },
  helperText: {
    fontSize: 12,
    color: '#718096',
    marginTop: 4,
  },
  resendLink: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  resendLinkText: {
    fontSize: 14,
    color: '#3182ce',
    fontWeight: '600',
  },
  resendLinkDisabled: {
    color: '#a0aec0',
  },
  benefitsCard: {
    backgroundColor: '#f0fff4',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#9ae6b4',
  },
  benefitsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#22543d',
    marginBottom: 12,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  benefitText: {
    fontSize: 14,
    color: '#22543d',
    marginLeft: 8,
  },
});

export default AccountVerificationScreen;
