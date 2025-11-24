import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useAuth } from '@/features/auth/context/AuthContext';
import { sendPhoneOTP, verifyPhoneOTP } from '@/features/auth/services/userService';
import { useTheme } from '@/context/ThemeContext';
import { MainTabParamList } from '@/types';
import { useQueryClient } from '@tanstack/react-query';

type PhoneVerificationRouteProp = RouteProp<MainTabParamList, 'PhoneVerification'>;
type PhoneVerificationNavigationProp = BottomTabNavigationProp<MainTabParamList>;

const PhoneVerificationScreen: React.FC = () => {
  const navigation = useNavigation<PhoneVerificationNavigationProp>();
  const route = useRoute<PhoneVerificationRouteProp>();
  const { user, refreshUserProfile } = useAuth();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const phoneNumber = route.params?.phoneNumber || '';

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);

  const inputRefs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    // Auto-send OTP when screen loads
    handleSendOTP();
  }, []);

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setCanResend(true);
    }
  }, [timer]);

  const handleSendOTP = async () => {
    if (!user) return;

    setResending(true);
    try {
      const result = await sendPhoneOTP(user.uid, phoneNumber);
      if (result.success && result.otp) {
        Alert.alert(
          '📱 Verification Code',
          `Your OTP is: ${result.otp}\n\nThis code will expire in 10 minutes.\n\n(In production, this will be sent via SMS)`,
          [{ text: 'OK' }]
        );
      }
      setTimer(60);
      setCanResend(false);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send verification code');
    } finally {
      setResending(false);
    }
  };

  const handleOtpChange = (text: string, index: number) => {
    // Only allow numbers
    if (text && !/^\d+$/.test(text)) return;

    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    // Auto-focus next input
    if (text && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-verify when all digits are entered
    if (index === 5 && text) {
      const fullOtp = newOtp.join('');
      if (fullOtp.length === 6) {
        handleVerifyOTP(fullOtp);
      }
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOTP = async (otpCode?: string) => {
    if (!user) return;

    const fullOtp = otpCode || otp.join('');
    if (fullOtp.length !== 6) {
      Alert.alert('Error', 'Please enter all 6 digits');
      return;
    }

    setLoading(true);
    try {
      const isValid = await verifyPhoneOTP(user.uid, fullOtp);
      
      if (isValid) {
        // Refresh user profile to get updated verification status
        await refreshUserProfile();
        
        // Invalidate any queries that depend on user profile
        queryClient.invalidateQueries({ queryKey: ['userProfile'] });
        
        Alert.alert(
          '✅ Success',
          'Phone number verified successfully!',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      } else {
        Alert.alert('Error', 'Invalid verification code. Please try again.');
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Verification failed');
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.surface }]}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Phone Verification</Text>
          <View style={styles.backButton} />
        </View>

        <View style={styles.content}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <Ionicons name="phone-portrait" size={48} color="#3182ce" />
            </View>
          </View>

          {/* Title & Description */}
          <Text style={[styles.title, { color: colors.text }]}>Verify Your Phone</Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            We've sent a 6-digit verification code to{'\n'}
            <Text style={styles.phoneNumber}>{phoneNumber}</Text>
          </Text>

          {/* OTP Input */}
          <View style={styles.otpContainer}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => { if (ref) inputRefs.current[index] = ref; }}
                style={[
                  styles.otpInput,
                  { 
                    borderColor: digit ? colors.primary : colors.border,
                    backgroundColor: colors.surface,
                    color: colors.text,
                  }
                ]}
                value={digit}
                onChangeText={(text) => handleOtpChange(text, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                editable={!loading}
              />
            ))}
          </View>

          {/* Timer & Resend */}
          <View style={styles.resendContainer}>
            {!canResend ? (
              <Text style={[styles.timerText, { color: colors.textSecondary }]}>
                Resend code in {timer}s
              </Text>
            ) : (
              <TouchableOpacity 
                onPress={handleSendOTP}
                disabled={resending}
              >
                <Text style={styles.resendText}>
                  {resending ? 'Sending...' : 'Resend Code'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Verify Button */}
          <TouchableOpacity
            style={[
              styles.verifyButton,
              { backgroundColor: otp.join('').length === 6 ? colors.primary : colors.divider }
            ]}
            onPress={() => handleVerifyOTP()}
            disabled={loading || otp.join('').length !== 6}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.verifyButtonText}>Verify Phone Number</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Help Text */}
          <Text style={[styles.helpText, { color: colors.textTertiary }]}>
            Didn't receive the code? Check your phone number or wait for the timer to resend.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a365d',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 24,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#ebf8ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a365d',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    color: '#718096',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  phoneNumber: {
    fontWeight: '700',
    color: '#3182ce',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 24,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderColor: '#cbd5e0',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
    color: '#1a365d',
    textAlign: 'center',
  },
  resendContainer: {
    marginBottom: 32,
    minHeight: 24,
  },
  timerText: {
    fontSize: 14,
    color: '#718096',
    textAlign: 'center',
  },
  resendText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3182ce',
    textAlign: 'center',
  },
  verifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3182ce',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    gap: 8,
    width: '100%',
    shadowColor: '#3182ce',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  verifyButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  helpText: {
    fontSize: 13,
    color: '#a0aec0',
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 20,
  },
});

export default PhoneVerificationScreen;
