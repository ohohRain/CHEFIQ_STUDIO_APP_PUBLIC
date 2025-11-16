import React, { createContext, useState, useEffect, useContext } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';
import {
  signUpWithEmail,
  signInWithEmail,
  signOutUser,
  resetPassword,
  signInWithApple,
  getUserProfile,
} from '../services/authService';

/**
 * Authentication Context
 * Provides global authentication state and functions throughout the app
 */

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Listen to authentication state changes
  useEffect(() => {
    // Guard against undefined auth (can happen if Firebase initialization failed)
    if (!auth) {
      console.error('[AuthContext] Firebase auth not initialized - skipping auth state listener');
      setLoading(false);
      setError('Firebase authentication is not available. Please check your configuration.');
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('Auth state changed:', firebaseUser ? 'User logged in' : 'User logged out');

      if (firebaseUser) {
        setUser(firebaseUser);

        // Fetch user profile from Firestore with retry logic
        // Note: For new Apple Sign-In users, profile creation happens in parallel
        // so we retry to handle the race condition gracefully
        try {
          const profile = await getUserProfile(firebaseUser.uid, true); // Suppress error log on first attempt
          setUserProfile(profile);
          console.log('User profile loaded:', profile.username);
        } catch (error) {
          // First attempt failed (expected for new users during profile creation)
          // Retry after delay to allow profile creation to complete
          await new Promise(resolve => setTimeout(resolve, 300));

          try {
            const profile = await getUserProfile(firebaseUser.uid); // Don't suppress on retry
            setUserProfile(profile);
            console.log('User profile loaded:', profile.username);
          } catch (retryError) {
            // Only log error if retry also fails
            console.error('[AuthContext] Failed to load user profile after retry:', retryError);
            setError(retryError.message);
          }
        }
      } else {
        setUser(null);
        setUserProfile(null);
      }

      setLoading(false);
    });

    // Cleanup subscription
    return () => unsubscribe();
  }, []);

  /**
   * Sign up new user
   * @param {string} email
   * @param {string} password
   * @param {string} fullName
   */
  const signUp = async (email, password, fullName) => {
    try {
      setError(null);
      const result = await signUpWithEmail(email, password, fullName);
      console.log('Sign up successful:', result.profile.username);
      return result;
    } catch (error) {
      console.error('Sign up error:', error.message);
      setError(error.message);
      throw error;
    }
  };

  /**
   * Sign in existing user
   * @param {string} email
   * @param {string} password
   */
  const signIn = async (email, password) => {
    try {
      setError(null);
      const result = await signInWithEmail(email, password);
      console.log('Sign in successful');
      return result;
    } catch (error) {
      console.error('Sign in error:', error.message);
      setError(error.message);
      throw error;
    }
  };

  /**
   * Sign out current user
   */
  const signOut = async () => {
    try {
      setError(null);
      await signOutUser();
      console.log('Sign out successful');
    } catch (error) {
      console.error('Sign out error:', error.message);
      setError(error.message);
      throw error;
    }
  };

  /**
   * Send password reset email
   * @param {string} email
   */
  const forgotPassword = async (email) => {
    try {
      setError(null);
      await resetPassword(email);
      console.log('Password reset email sent to:', email);
    } catch (error) {
      console.error('Password reset error:', error.message);
      setError(error.message);
      throw error;
    }
  };

  /**
   * Sign in with Apple
   * @param {Object} credential - Apple credential from AppleAuthentication.signInAsync
   */
  const appleSignIn = async (credential) => {
    try {
      setError(null);
      const result = await signInWithApple(credential);
      console.log('Apple sign in successful');
      return result;
    } catch (error) {
      console.error('Apple sign in error:', error.message);
      setError(error.message);
      throw error;
    }
  };

  /**
   * Refresh user profile data
   */
  const refreshProfile = async () => {
    if (user) {
      try {
        const profile = await getUserProfile(user.uid);
        setUserProfile(profile);
        console.log('Profile refreshed');
      } catch (error) {
        console.error('Error refreshing profile:', error);
        setError(error.message);
      }
    }
  };

  const value = {
    user,
    userProfile,
    loading,
    error,
    signUp,
    signIn,
    signOut,
    forgotPassword,
    appleSignIn,
    refreshProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Custom hook to use auth context
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
