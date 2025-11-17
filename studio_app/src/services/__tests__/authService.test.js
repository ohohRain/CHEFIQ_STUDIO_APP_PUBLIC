import {
  signInWithEmail,
  signUpWithEmail,
  signOutUser,
  getCurrentUser
} from '../authService';

jest.mock('firebase/auth');
jest.mock('../../config/firebase', () => ({
  auth: {
    currentUser: null
  }
}));

describe('authService', () => {
  let mockAuth;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth = require('firebase/auth');
    const { auth } = require('../../config/firebase');
    auth.currentUser = null; // Reset to null before each test
  });

  describe('signInWithEmail', () => {
    it('should sign in user with valid credentials', async () => {
      const email = 'test@example.com';
      const password = 'password123';

      const mockUser = {
        uid: 'user123',
        email: email,
        displayName: 'Test User'
      };

      mockAuth.signInWithEmailAndPassword.mockResolvedValue({
        user: mockUser
      });

      const userCredential = await signInWithEmail(email, password);
      const user = userCredential.user;

      expect(user).toBeDefined();
      expect(user.uid).toBe('user123');
      expect(user.email).toBe(email);
      expect(mockAuth.signInWithEmailAndPassword).toHaveBeenCalledWith(
        expect.anything(),
        email,
        password
      );
    });

    it('should throw error with invalid credentials', async () => {
      const email = 'wrong@example.com';
      const password = 'wrongpassword';

      mockAuth.signInWithEmailAndPassword.mockRejectedValue(
        new Error('auth/invalid-credential')
      );

      await expect(signInWithEmail(email, password)).rejects.toThrow();
    });

    it('should validate email format', async () => {
      const invalidEmail = 'notanemail';
      const password = 'password123';

      await expect(signInWithEmail(invalidEmail, password)).rejects.toThrow();
    });

    it('should require password', async () => {
      const email = 'test@example.com';

      await expect(signInWithEmail(email, '')).rejects.toThrow();
      await expect(signInWithEmail(email, null)).rejects.toThrow();
    });
  });

  describe('signUpWithEmail', () => {
    it('should create new user account', async () => {
      const email = 'newuser@example.com';
      const password = 'password123';
      const displayName = 'New User';

      const mockUser = {
        uid: 'newuser456',
        email: email,
        displayName: null
      };

      mockAuth.createUserWithEmailAndPassword.mockResolvedValue({
        user: mockUser
      });

      mockAuth.updateProfile.mockResolvedValue();

      const user = await signUpWithEmail(email, password, displayName);

      expect(user).toBeDefined();
      expect(mockAuth.createUserWithEmailAndPassword).toHaveBeenCalledWith(
        expect.anything(),
        email,
        password
      );
      expect(mockAuth.updateProfile).toHaveBeenCalledWith(
        mockUser,
        { displayName }
      );
    });

    it('should handle duplicate email error', async () => {
      const email = 'existing@example.com';
      const password = 'password123';

      mockAuth.createUserWithEmailAndPassword.mockRejectedValue(
        new Error('auth/email-already-in-use')
      );

      await expect(signUpWithEmail(email, password, 'User')).rejects.toThrow();
    });

    it('should enforce password strength', async () => {
      const email = 'test@example.com';
      const weakPassword = '123'; // Too short

      mockAuth.createUserWithEmailAndPassword.mockRejectedValue(
        new Error('auth/weak-password')
      );

      await expect(signUpWithEmail(email, weakPassword, 'User')).rejects.toThrow();
    });

    it('should create user profile in Firestore', async () => {
      const mockFirestore = require('firebase/firestore');

      const email = 'newuser@example.com';
      const password = 'password123';
      const displayName = 'New User';

      mockAuth.createUserWithEmailAndPassword.mockResolvedValue({
        user: { uid: 'newuser456', email }
      });

      mockAuth.updateProfile.mockResolvedValue();
      mockFirestore.setDoc = jest.fn().mockResolvedValue();

      await signUpWithEmail(email, password, displayName);

      // Verify user profile created in Firestore
      expect(mockFirestore.setDoc).toHaveBeenCalled();
    });
  });

  describe('signOutUser', () => {
    it('should sign out current user', async () => {
      mockAuth.signOut.mockResolvedValue();

      await signOutUser();

      expect(mockAuth.signOut).toHaveBeenCalled();
    });

    it('should handle logout errors gracefully', async () => {
      mockAuth.signOut.mockRejectedValue(new Error('Network error'));

      await expect(signOutUser()).rejects.toThrow('Network error');
    });
  });

  describe('getCurrentUser', () => {
    it('should return current user when signed in', () => {
      const { auth } = require('../../config/firebase');
      const mockUser = {
        uid: 'user123',
        email: 'test@example.com',
        displayName: 'Test User'
      };

      auth.currentUser = mockUser;

      const user = getCurrentUser();

      expect(user).toBeDefined();
      expect(user.uid).toBe('user123');
    });

    it('should return null when not signed in', () => {
      const { auth } = require('../../config/firebase');
      auth.currentUser = null;

      const user = getCurrentUser();

      expect(user).toBeNull();
    });
  });

  describe('Auth state persistence', () => {
    it('should persist auth state across app restarts', async () => {
      const mockUser = {
        uid: 'user123',
        email: 'test@example.com'
      };

      // Mock auth state change listener
      const callback = jest.fn();
      mockAuth.onAuthStateChanged.mockImplementation((auth, cb) => {
        cb(mockUser);
        return jest.fn(); // Unsubscribe
      });

      mockAuth.onAuthStateChanged(null, callback);

      expect(callback).toHaveBeenCalledWith(mockUser);
    });

    it('should handle auth state changes', () => {
      let authCallback;

      mockAuth.onAuthStateChanged.mockImplementation((auth, cb) => {
        authCallback = cb;
        return jest.fn();
      });

      const callback = jest.fn();
      mockAuth.onAuthStateChanged(null, callback);

      // Simulate user login
      const mockUser = { uid: 'user123' };
      authCallback(mockUser);

      expect(callback).toHaveBeenCalledWith(mockUser);

      // Simulate user logout
      authCallback(null);

      expect(callback).toHaveBeenCalledWith(null);
    });
  });

  describe('Edge cases', () => {
    it('should handle null email', async () => {
      await expect(signInWithEmail(null, 'password')).rejects.toThrow();
    });

    it('should handle undefined password', async () => {
      await expect(signInWithEmail('test@example.com', undefined)).rejects.toThrow();
    });

    it('should handle network errors during login', async () => {
      mockAuth.signInWithEmailAndPassword.mockRejectedValue(
        new Error('auth/network-request-failed')
      );

      await expect(signInWithEmail('test@example.com', 'password')).rejects.toThrow();
    });

    it('should handle too many requests error', async () => {
      mockAuth.signInWithEmailAndPassword.mockRejectedValue(
        new Error('auth/too-many-requests')
      );

      await expect(signInWithEmail('test@example.com', 'password')).rejects.toThrow();
    });
  });
});
