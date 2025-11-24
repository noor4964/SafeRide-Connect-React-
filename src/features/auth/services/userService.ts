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

// TODO: Implement student verification
export const verifyStudentStatus = async (userId: string, studentId: string, universityEmail: string): Promise<boolean> => {
  // This is a placeholder for student verification logic
  // In a real app, this would integrate with university systems or use a third-party verification service
  
  try {
    // For now, just check if email ends with .edu
    const isEduEmail = universityEmail.endsWith('.edu');
    
    if (isEduEmail) {
      await updateUserProfile(userId, {
        studentId,
        isStudentVerified: true,
        updatedAt: new Date(),
      });
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Student verification error:', error);
    return false;
  }
};