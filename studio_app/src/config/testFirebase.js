// Simple Firebase connection test
import { auth, db, storage } from './firebase';

export const testFirebaseConnection = () => {
  console.log('🔥 Testing Firebase connection...');

  try {
    // Test Auth
    if (auth) {
      console.log('✅ Firebase Auth initialized');
      console.log('   Current user:', auth.currentUser ? 'Logged in' : 'Not logged in');
    } else {
      console.log('❌ Firebase Auth NOT initialized');
    }

    // Test Firestore
    if (db) {
      console.log('✅ Firestore Database initialized');
      console.log('   Project ID:', db.app.options.projectId);
    } else {
      console.log('❌ Firestore NOT initialized');
    }

    // Test Storage
    if (storage) {
      console.log('✅ Cloud Storage initialized');
      console.log('   Storage bucket:', storage.app.options.storageBucket);
    } else {
      console.log('❌ Cloud Storage NOT initialized');
    }

    console.log('🎉 Firebase initialization complete!');
    return true;
  } catch (error) {
    console.error('❌ Firebase connection error:', error.message);
    return false;
  }
};
