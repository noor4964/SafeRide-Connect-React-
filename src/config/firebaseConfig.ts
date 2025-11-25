import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Set to true to use Firebase, false to use development mode without Firebase
const USE_FIREBASE = true;

// Firebase configuration from Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyBq9rjFqt6i5Te4PcIWI4XBjCpuCvVSyVo",
  authDomain: "saferide-connect-83fb4.firebaseapp.com",
  projectId: "saferide-connect-83fb4",
  storageBucket: "saferide-connect-83fb4.appspot.com",
  messagingSenderId: "932746991564",
  appId: "1:932746991564:web:1fe8c69d19a57bc3686f69",
  measurementId: "G-9X8MDELHQF"
};

// Initialize Firebase only if enabled
let app: any = null;
let auth: any = null;
let firestore: any = null;
let storage: any = null;

if (USE_FIREBASE) {
  try {
    // Initialize Firebase app if not already initialized
    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApps()[0];
    }
    
    // Initialize Firebase Auth with AsyncStorage persistence
    // Using dynamic import to handle React Native environment
    try {
      const { initializeAuth, getReactNativePersistence } = require('firebase/auth');
      auth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage)
      });
    } catch (authError: any) {
      // Fallback: if persistence setup fails, use regular getAuth
      if (authError.code === 'auth/already-initialized') {
        const { getAuth } = require('firebase/auth');
        auth = getAuth(app);
      } else {
        const { getAuth } = require('firebase/auth');
        auth = getAuth(app);
        console.warn('Using Firebase Auth without persistence:', authError.message);
      }
    }
    
    // Initialize Firestore
    firestore = getFirestore(app);
    
    // Initialize Firebase Storage with explicit bucket
    try {
      storage = getStorage(app);
      console.log('✅ Firebase Storage initialized:', storage.app.options.storageBucket);
    } catch (storageError: any) {
      console.error('❌ Storage initialization error:', storageError);
      // Storage might not be enabled - will fail gracefully in upload service
    }
    
    console.log('✅ Firebase initialized successfully');
  } catch (error: any) {
    console.error('❌ Firebase initialization error:', error);
    // Try to recover
    if (app) {
      const { getAuth } = require('firebase/auth');
      auth = getAuth(app);
      firestore = getFirestore(app);
      storage = getStorage(app);
      console.log('✅ Firebase partially initialized');
    }
  }
} else {
  // Development mode without Firebase
  console.log('🔧 Running in development mode without Firebase');
}

// For development only - connect to Firestore emulator
// Uncomment the lines below if you're using Firebase emulator
// if (__DEV__) {
//   connectFirestoreEmulator(firestore, 'localhost', 8080);
// }

export { auth, firestore, storage };
export default app;