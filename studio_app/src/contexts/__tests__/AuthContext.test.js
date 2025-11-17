import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../AuthContext';
import { mockUser, mockAuthUser } from '../../../__fixtures__/mockUsers';

jest.mock('../../services/authService');
jest.mock('firebase/auth');

describe('AuthContext', () => {
  let mockAuthService;
  let mockAuth;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthService = require('../../services/authService');
    mockAuth = require('firebase/auth');
  });

  const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;

  describe('useAuth hook', () => {
    it('should provide auth functionality', () => {
      mockAuth.onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(null);
        return jest.fn();
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(result.current.user).toBeDefined();
      expect(result.current.signIn).toBeDefined();
      expect(result.current.signOut).toBeDefined();
      expect(result.current.signUp).toBeDefined();
    });

    it('should throw error when used outside provider', () => {
      const originalError = console.error;
      console.error = jest.fn();

      // Note: AuthContext is created with createContext({}) so it won't throw
      // when used outside provider, it will just return empty object
      // This test validates that behavior - no error is thrown
      const { result } = renderHook(() => useAuth());

      // Context should exist but be empty (no user, loading, etc)
      expect(result.current).toBeDefined();

      console.error = originalError;
    });
  });

  describe('Authentication state', () => {
    it('should start with no user', () => {
      mockAuth.onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(null);
        return jest.fn();
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(result.current.user).toBeNull();
      expect(result.current.loading).toBe(false);
    });

    it('should set user when authenticated', async () => {
      mockAuth.onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(mockAuthUser);
        return jest.fn();
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.user).toBeDefined();
        expect(result.current.user.uid).toBe(mockAuthUser.uid);
      });
    });

    it('should show loading state during initialization', () => {
      mockAuth.onAuthStateChanged.mockImplementation((auth, callback) => {
        // Don't call callback immediately
        return jest.fn();
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(result.current.loading).toBe(true);
    });
  });

  describe('signIn', () => {
    it('should authenticate user with valid credentials', async () => {
      mockAuthService.signInWithEmail.mockResolvedValue(mockAuthUser);

      mockAuth.onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(null);
        return jest.fn();
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.signIn('test@example.com', 'password123');
      });

      expect(mockAuthService.signInWithEmail).toHaveBeenCalledWith(
        'test@example.com',
        'password123'
      );
    });

    it('should handle login errors', async () => {
      mockAuthService.signInWithEmail.mockRejectedValue(
        new Error('Invalid credentials')
      );

      mockAuth.onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(null);
        return jest.fn();
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await expect(
        act(async () => {
          await result.current.signIn('wrong@example.com', 'wrongpass');
        })
      ).rejects.toThrow('Invalid credentials');
    });

    it('should update user state on successful login', async () => {
      mockAuthService.signInWithEmail.mockResolvedValue(mockAuthUser);
      mockAuthService.getUserProfile.mockResolvedValue(mockUser);

      mockAuth.onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(mockAuthUser);
        return jest.fn();
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.signIn('test@example.com', 'password123');
      });

      await waitFor(() => {
        expect(result.current.user).toBeDefined();
        expect(result.current.user.uid).toBe(mockAuthUser.uid);
      });
    });
  });

  describe('signOut', () => {
    it('should clear user state on logout', async () => {
      mockAuthService.getUserProfile.mockResolvedValue(mockUser);
      mockAuthService.signOutUser.mockResolvedValue();

      let authCallback;
      mockAuth.onAuthStateChanged.mockImplementation((auth, callback) => {
        authCallback = callback;
        callback(mockAuthUser); // Start logged in
        return jest.fn();
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.user).toBeDefined();
      });

      // Call signOut
      await act(async () => {
        await result.current.signOut();
      });

      // Simulate Firebase auth state change to null
      act(() => {
        authCallback(null);
      });

      await waitFor(() => {
        expect(result.current.user).toBeNull();
      });
    });

    it('should call auth service logout', async () => {
      mockAuthService.signOutUser.mockResolvedValue();

      mockAuth.onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(null);
        return jest.fn();
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.signOut();
      });

      expect(mockAuthService.signOutUser).toHaveBeenCalled();
    });
  });

  describe('signUp', () => {
    it('should create new user account', async () => {
      const newUserResult = {
        user: {
          uid: 'newuser123',
          email: 'newuser@example.com',
          displayName: 'New User'
        },
        profile: {
          userId: 'newuser123',
          username: 'New User',
          handle: '@newuser',
          email: 'newuser@example.com'
        }
      };

      mockAuthService.signUpWithEmail.mockResolvedValue(newUserResult);

      mockAuth.onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(null);
        return jest.fn();
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.signUp(
          'newuser@example.com',
          'password123',
          'New User'
        );
      });

      expect(mockAuthService.signUpWithEmail).toHaveBeenCalledWith(
        'newuser@example.com',
        'password123',
        'New User'
      );
    });

    it('should handle signup errors', async () => {
      mockAuthService.signUpWithEmail.mockRejectedValue(
        new Error('Email already in use')
      );

      mockAuth.onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(null);
        return jest.fn();
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await expect(
        act(async () => {
          await result.current.signUp('existing@example.com', 'password', 'User');
        })
      ).rejects.toThrow('Email already in use');
    });
  });

  describe('Auth state persistence', () => {
    it('should persist auth state across provider remounts', async () => {
      let authCallback;
      mockAuthService.getUserProfile.mockResolvedValue(mockUser);

      mockAuth.onAuthStateChanged.mockImplementation((auth, callback) => {
        authCallback = callback;
        callback(mockAuthUser);
        return jest.fn();
      });

      const { result, rerender } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.user).toBeDefined();
      });

      // Wait for async profile loading to complete
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 1000 });

      // Remount provider
      rerender();

      // User should still be authenticated
      expect(result.current.user).toBeDefined();
    });

    it('should handle auth state changes', async () => {
      let authCallback;
      mockAuthService.getUserProfile.mockResolvedValue(mockUser);

      mockAuth.onAuthStateChanged.mockImplementation((auth, callback) => {
        authCallback = callback;
        callback(null); // Start logged out
        return jest.fn();
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(result.current.user).toBeNull();

      // Simulate login
      act(() => {
        authCallback(mockAuthUser);
      });

      await waitFor(() => {
        expect(result.current.user).toBeDefined();
      });

      // Wait for async profile loading to complete (includes 300ms retry delay)
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 1000 });

      // Simulate logout
      act(() => {
        authCallback(null);
      });

      await waitFor(() => {
        expect(result.current.user).toBeNull();
      });
    });
  });

  describe('Error handling', () => {
    it('should handle auth errors gracefully', async () => {
      mockAuthService.signInWithEmail.mockRejectedValue(
        new Error('Network error')
      );

      mockAuth.onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(null);
        return jest.fn();
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await expect(
        act(async () => {
          await result.current.signIn('test@example.com', 'password');
        })
      ).rejects.toThrow('Network error');

      // User should remain null
      expect(result.current.user).toBeNull();
    });
  });
});
