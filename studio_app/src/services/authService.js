import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  OAuthProvider,
  signInWithCredential,
} from 'firebase/auth';
import { doc, setDoc, getDoc, query, collection, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

/**
 * Authentication Service
 * Handles all Firebase authentication operations
 * Schema aligned with database_design.md v3.0
 */

/**
 * Generate unique handle from full name
 * @param {string} fullName - User's full name
 * @returns {Promise<string>} Unique handle with @ prefix
 */
const generateUniqueHandle = async (fullName) => {
  // Convert to lowercase, remove spaces and special characters
  let baseHandle = fullName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

  // Try base handle first
  let handle = `@${baseHandle}`;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 10;

  while (!isUnique && attempts < maxAttempts) {
    // Check if handle exists in Firestore
    const handleQuery = query(
      collection(db, 'users'),
      where('handle', '==', handle)
    );
    const snapshot = await getDocs(handleQuery);

    if (snapshot.empty) {
      isUnique = true;
    } else {
      // Append random 2-digit number
      const randomNum = Math.floor(Math.random() * 100);
      handle = `@${baseHandle}${randomNum}`;
      attempts++;
    }
  }

  // Fallback: use timestamp if all attempts failed
  if (!isUnique) {
    handle = `@${baseHandle}${Date.now().toString().slice(-4)}`;
  }

  return handle;
};

/**
 * Sign up a new user with email and password
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @param {string} fullName - User's full name
 * @returns {Promise<object>} User credentials and profile
 */
export const signUpWithEmail = async (email, password, fullName) => {
  try {
    // Create user account with Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Update user profile with display name
    await updateProfile(user, {
      displayName: fullName,
    });

    // Generate unique handle
    const handle = await generateUniqueHandle(fullName);

    // Create user document in Firestore (aligned with database_design.md)
    await setDoc(doc(db, 'users', user.uid), {
      userId: user.uid,
      username: fullName,
      handle: handle,
      email: email,
      avatar: null,
      bio: '',
      tags: [],
      stats: {
        recipesCount: 0,
        likesReceived: 0,
        viewsReceived: 0,
        followersCount: 0,
        followingCount: 0,
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    console.log('[Auth] User profile created with handle:', handle);

    return {
      user,
      profile: {
        userId: user.uid,
        username: fullName,
        handle: handle,
        email: email,
      },
    };
  } catch (error) {
    console.error('Error signing up:', error);
    throw handleAuthError(error);
  }
};

/**
 * Sign in existing user with email and password
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @returns {Promise<object>} User credentials
 */
export const signInWithEmail = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential;
  } catch (error) {
    console.error('Error signing in:', error);
    throw handleAuthError(error);
  }
};

/**
 * Sign out current user from Firebase
 * @returns {Promise<void>}
 */
export const signOutUser = async () => {
  try {
    console.log('[Auth] Starting sign out process');
    await signOut(auth);
    console.log('[Auth] Sign out successful');
  } catch (error) {
    console.error('Error signing out:', error);
    throw handleAuthError(error);
  }
};

/**
 * Send password reset email
 * @param {string} email - User's email
 * @returns {Promise<void>}
 */
export const resetPassword = async (email) => {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw handleAuthError(error);
  }
};

/**
 * Sign in with Apple
 * @param {Object} credential - Apple credential from AppleAuthentication.signInAsync
 */
export const signInWithApple = async (credential) => {
  try {
    console.log('[AppleSignIn] Starting Apple authentication process');

    if (!credential || !credential.identityToken) {
      throw new Error('No valid Apple credential provided');
    }

    // Create a Firebase credential from the Apple ID token
    const provider = new OAuthProvider('apple.com');
    const firebaseCredential = provider.credential({
      idToken: credential.identityToken,
    });

    // Sign in to Firebase
    const userCredential = await signInWithCredential(auth, firebaseCredential);
    const user = userCredential.user;

    if (!user) {
      throw new Error('Failed to get user data from Firebase');
    }

    console.log('[AppleSignIn] Firebase sign-in successful');

    // Check if user document exists
    const userDocRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      // New user: Create profile in Firestore
      console.log('[AppleSignIn] Creating new user profile in Firestore');

      // Extract name from Apple credential (may be null if user hides)
      const fullName = credential.fullName;
      const displayName = fullName?.givenName 
        ? `${fullName.givenName} ${fullName.familyName || ''}`.trim()
        : 'Apple User';

      // Generate unique handle
      const handle = await generateUniqueHandle(displayName);

      // Create user document
      await setDoc(userDocRef, {
        userId: user.uid,
        username: displayName,
        handle: handle,
        email: user.email || credential.email || null,
        avatar: null, // Apple doesn't provide photo
        bio: '',
        tags: [],
        stats: {
          recipesCount: 0,
          likesReceived: 0,
          viewsReceived: 0,
          followersCount: 0,
          followingCount: 0,
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      console.log('[AppleSignIn] User profile created with handle:', handle);
    }

    console.log('[AppleSignIn] Authentication complete for:', user.email);
    return userCredential;

  } catch (error) {
    console.error('[AppleSignIn] Error during Apple Sign-In:', error);
    throw handleAuthError(error);
  }
};

/**
 * Get user profile from Firestore
 * @param {string} uid - User ID
 * @param {boolean} suppressErrorLog - Suppress error logging (for retry scenarios)
 * @returns {Promise<object>} User profile data
 */
export const getUserProfile = async (uid, suppressErrorLog = false) => {
  try {
    const userDocRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
      return userDoc.data();
    } else {
      throw new Error('User profile not found');
    }
  } catch (error) {
    // Only log error if not suppressed (allows retry logic to be silent)
    if (!suppressErrorLog) {
      console.error('Error getting user profile:', error);
    }
    throw error;
  }
};

/**
 * Get current authenticated user
 * @returns {object|null} Current user or null
 */
export const getCurrentUser = () => {
  return auth.currentUser;
};

/**
 * Handle Firebase auth errors and return user-friendly messages
 * @param {Error} error - Firebase error object
 * @returns {Error} Error with user-friendly message
 */
const handleAuthError = (error) => {
  let message = 'An error occurred. Please try again.';

  switch (error.code) {
    case 'auth/email-already-in-use':
      message = 'This email is already registered. Please sign in instead.';
      break;
    case 'auth/invalid-email':
      message = 'Invalid email address.';
      break;
    case 'auth/operation-not-allowed':
      message = 'Operation not allowed. Please contact support.';
      break;
    case 'auth/weak-password':
      message = 'Password is too weak. Use at least 6 characters.';
      break;
    case 'auth/user-disabled':
      message = 'This account has been disabled.';
      break;
    case 'auth/user-not-found':
      message = 'No account found with this email.';
      break;
    case 'auth/wrong-password':
      message = 'Incorrect password.';
      break;
    case 'auth/invalid-credential':
      message = 'Invalid credentials. Please check your email and password.';
      break;
    case 'auth/too-many-requests':
      message = 'Too many failed attempts. Please try again later.';
      break;
    case 'auth/network-request-failed':
      message = 'Network error. Please check your connection.';
      break;
    default:
      message = error.message || 'An error occurred. Please try again.';
  }

  const friendlyError = new Error(message);
  friendlyError.code = error.code;
  return friendlyError;
};
