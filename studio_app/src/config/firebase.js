import { initializeApp, getApps } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Firebase configuration - REQUIRES environment variables
// No fallback values - users must provide their own Firebase credentials
const firebaseConfig = {
  apiKey: Constants.expoConfig?.extra?.firebaseApiKey,
  authDomain: Constants.expoConfig?.extra?.firebaseAuthDomain,
  projectId: Constants.expoConfig?.extra?.firebaseProjectId,
  storageBucket: Constants.expoConfig?.extra?.firebaseStorageBucket,
  messagingSenderId: Constants.expoConfig?.extra?.firebaseMessagingSenderId,
  appId: Constants.expoConfig?.extra?.firebaseAppId,
  measurementId: Constants.expoConfig?.extra?.firebaseMeasurementId
};

// Validate Firebase configuration
const validateFirebaseConfig = () => {
  const requiredFields = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'appId'];
  const missingFields = requiredFields.filter(field => !firebaseConfig[field]);

  if (missingFields.length > 0) {
    const error = new Error(
      `Missing required Firebase config fields: ${missingFields.join(', ')}\n\n` +
      `Please ensure .env file exists with all EXPO_PUBLIC_FIREBASE_* variables.\n` +
      `See .env.example for required variables.`
    );
    console.error('❌ Firebase config validation failed:', error.message);
    throw error; // Throw error - no fallback values available
  }
  return true; // Validation passed
};

// Initialize Firebase with error handling
let app;
let auth;
let db;
let storage;

try {
  // Validate config - will throw error if missing required fields
  validateFirebaseConfig();

  // Check if Firebase app is already initialized (prevents duplicate initialization error)
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
    console.log('✅ Firebase app initialized');
  } else {
    app = getApps()[0];
    console.log('✅ Firebase app already initialized, reusing existing instance');
  }

  // Initialize Firebase Auth with AsyncStorage persistence
  // Note: initializeAuth can only be called once per app instance
  // If it fails, the outer try-catch will handle it
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });

  // Initialize other Firebase services
  db = getFirestore(app);
  storage = getStorage(app);

  console.log('✅ Firebase initialized successfully');
  console.log('   Project ID:', firebaseConfig.projectId);
  console.log('   Auth defined:', !!auth);
  console.log('   DB defined:', !!db);
  console.log('   Storage defined:', !!storage);
} catch (error) {
  console.error('❌ FATAL: Firebase initialization failed completely:', error);
  console.error('   Error message:', error.message);
  console.error('   Error stack:', error.stack);
  console.error('   Config used:', {
    apiKey: firebaseConfig.apiKey ? '***' + firebaseConfig.apiKey.slice(-8) : 'MISSING',
    projectId: firebaseConfig.projectId || 'MISSING',
    appId: firebaseConfig.appId ? '***' + firebaseConfig.appId.slice(-8) : 'MISSING'
  });
  // DO NOT throw here - let the app start and ErrorBoundary will catch usage errors
  // The undefined exports will cause errors when used, which ErrorBoundary CAN catch
}

export { app as default, auth, db, storage, firebaseConfig };
