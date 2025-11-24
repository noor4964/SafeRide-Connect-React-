import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  sendEmailVerification,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { auth, firestore } from '@/config/firebaseConfig';
import { LoginForm, RegisterForm, User, UserSchema } from '@/types';

export const loginUser = async (data: LoginForm): Promise<FirebaseUser> => {
  if (!auth) {
    throw new Error('Firebase is not configured. Please set USE_FIREBASE = true and add your Firebase credentials in firebaseConfig.ts');
  }
  try {
    const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password);
    return userCredential.user;
  } catch (error: any) {
    throw new Error(error.message || 'Login failed');
  }
};

export const registerUser = async (data: RegisterForm): Promise<FirebaseUser> => {
  if (!auth || !firestore) {
    throw new Error('Firebase is not configured. Please set USE_FIREBASE = true and add your Firebase credentials in firebaseConfig.ts');
  }
  try {
    // Create Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
    const firebaseUser = userCredential.user;

    // Send email verification
    await sendEmailVerification(firebaseUser);

    // Create user profile in Firestore
    const userProfile: Omit<User, 'id'> = {
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      phoneNumber: data.phoneNumber,
      university: data.university,
      isVerified: false,
      isStudentVerified: false, // TODO: Implement student verification
      rating: 0,
      totalRides: 0,
      emergencyContacts: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await setDoc(doc(firestore, 'users', firebaseUser.uid), {
      ...userProfile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return firebaseUser;
  } catch (error: any) {
    throw new Error(error.message || 'Registration failed');
  }
};

export const getUserProfile = async (userId: string): Promise<User | null> => {
  if (!firestore) {
    return null;
  }
  try {
    const userDoc = await getDoc(doc(firestore, 'users', userId));
    
    if (!userDoc.exists()) {
      return null;
    }

    const userData = userDoc.data();
    
    // Convert Firestore timestamps to Date objects
    const userProfile = {
      id: userDoc.id,
      ...userData,
      createdAt: userData.createdAt?.toDate() || new Date(),
      updatedAt: userData.updatedAt?.toDate() || new Date(),
      emailVerifiedAt: userData.emailVerifiedAt?.toDate(),
      studentVerifiedAt: userData.studentVerifiedAt?.toDate(),
      phoneVerifiedAt: userData.phoneVerifiedAt?.toDate(),
    };

    // Validate with Zod schema
    return UserSchema.parse(userProfile);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
};

export const updateUserProfile = async (userId: string, data: Partial<User>): Promise<void> => {
  if (!firestore) {
    throw new Error('Firebase is not configured');
  }
  try {
    const updateData = {
      ...data,
      updatedAt: serverTimestamp(),
    };

    await updateDoc(doc(firestore, 'users', userId), updateData);
  } catch (error: any) {
    throw new Error(error.message || 'Failed to update profile');
  }
};

// Generate random 6-digit OTP
const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send phone verification OTP
export const sendPhoneOTP = async (userId: string, phoneNumber: string): Promise<{ success: boolean; otp?: string }> => {
  if (!firestore) {
    console.warn('Firebase not configured');
    return { success: false };
  }

  try {
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    // Store OTP in Firestore
    await setDoc(doc(firestore, 'phoneVerifications', userId), {
      otp,
      phoneNumber,
      expiresAt,
      createdAt: serverTimestamp(),
      verified: false,
    });

    // In a real app, send SMS via Twilio, AWS SNS, or similar service
    // For development/testing, we return the OTP to display in UI
    console.log(`📱 Phone OTP for ${phoneNumber}: ${otp}`);
    console.log(`⏰ Expires at: ${expiresAt.toLocaleTimeString()}`);
    
    // TODO: Implement actual SMS sending
    // Example: await fetch('https://your-api/send-sms', { method: 'POST', body: JSON.stringify({ phoneNumber, otp }) });

    // Return OTP for development/testing purposes
    return { success: true, otp };
  } catch (error) {
    console.error('Error sending phone OTP:', error);
    throw error;
  }
};

// Verify phone OTP
export const verifyPhoneOTP = async (userId: string, otp: string): Promise<boolean> => {
  if (!firestore) {
    console.warn('Firebase not configured');
    return false;
  }

  try {
    const verificationDoc = await getDoc(doc(firestore, 'phoneVerifications', userId));
    
    if (!verificationDoc.exists()) {
      throw new Error('No verification code found. Please request a new code.');
    }

    const verificationData = verificationDoc.data();
    
    // Check if OTP matches
    if (verificationData.otp !== otp) {
      return false;
    }

    // Check if OTP is expired
    const expiresAt = verificationData.expiresAt.toDate();
    if (new Date() > expiresAt) {
      throw new Error('Verification code has expired. Please request a new code.');
    }

    // Check if already verified
    if (verificationData.verified) {
      throw new Error('This code has already been used.');
    }

    // Mark as verified
    await updateDoc(doc(firestore, 'phoneVerifications', userId), {
      verified: true,
      verifiedAt: serverTimestamp(),
    });

    // Update user profile
    await updateDoc(doc(firestore, 'users', userId), {
      isPhoneVerified: true,
      phoneVerifiedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return true;
  } catch (error) {
    console.error('Error verifying phone OTP:', error);
    throw error;
  }
};

// Send email verification OTP
export const sendEmailOTP = async (userId: string, email: string): Promise<boolean> => {
  if (!firestore) {
    console.warn('Firebase not configured');
    return false;
  }

  try {
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    // Store OTP in Firestore
    await setDoc(doc(firestore, 'emailVerifications', userId), {
      otp,
      email,
      expiresAt,
      createdAt: serverTimestamp(),
      verified: false,
    });

    // In a real app, send email via Cloud Function or email service
    // For now, we'll log it (in production, use SendGrid, AWS SES, etc.)
    console.log(`Email OTP for ${email}: ${otp}`);
    
    // TODO: Implement actual email sending
    // This would typically be done via a Cloud Function to keep credentials secure
    // Example: await fetch('https://your-cloud-function/sendOTP', { method: 'POST', body: JSON.stringify({ email, otp }) });

    return true;
  } catch (error) {
    console.error('Error sending email OTP:', error);
    throw error;
  }
};

// Verify email OTP
export const verifyEmailOTP = async (userId: string, otp: string): Promise<boolean> => {
  if (!firestore) {
    console.warn('Firebase not configured');
    return false;
  }

  try {
    const verificationDoc = await getDoc(doc(firestore, 'emailVerifications', userId));
    
    if (!verificationDoc.exists()) {
      throw new Error('No verification code found. Please request a new code.');
    }

    const verificationData = verificationDoc.data();
    
    // Check if OTP matches
    if (verificationData.otp !== otp) {
      return false;
    }

    // Check if OTP is expired
    const expiresAt = verificationData.expiresAt.toDate();
    if (new Date() > expiresAt) {
      throw new Error('Verification code has expired. Please request a new code.');
    }

    // Check if already verified
    if (verificationData.verified) {
      throw new Error('This code has already been used.');
    }

    // Mark as verified
    await updateDoc(doc(firestore, 'emailVerifications', userId), {
      verified: true,
      verifiedAt: serverTimestamp(),
    });

    // Update user profile
    await updateDoc(doc(firestore, 'users', userId), {
      isVerified: true,
      emailVerifiedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return true;
  } catch (error) {
    console.error('Error verifying email OTP:', error);
    throw error;
  }
};

// Verify student status
export const verifyStudentStatus = async (
  userId: string,
  studentId: string,
  email: string
): Promise<boolean> => {
  if (!firestore) {
    console.warn('Firebase not configured');
    return false;
  }

  try {
    // Extract student ID from email to verify it matches
    const emailStudentId = email.split('@')[0];
    if (emailStudentId !== studentId) {
      throw new Error('Student ID does not match email address');
    }

    // Validate AIUB student ID format
    const studentIdRegex = /^\d{2}-\d{5}-\d{1}$/;
    if (!studentIdRegex.test(studentId)) {
      throw new Error('Invalid student ID format');
    }

    // Update user profile with verified student status
    await updateDoc(doc(firestore, 'users', userId), {
      isStudentVerified: true,
      studentId,
      studentVerifiedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return true;
  } catch (error) {
    console.error('Error verifying student status:', error);
    throw error;
  }
};