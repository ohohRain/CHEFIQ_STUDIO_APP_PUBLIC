// Global Firebase Auth mocks
export const getAuth = jest.fn(() => ({
  currentUser: null
}));

export const signInWithEmailAndPassword = jest.fn(async (auth, email, password) => ({
  user: {
    uid: 'mock-user-123',
    email: email,
    displayName: 'Test User',
    photoURL: null
  }
}));

export const createUserWithEmailAndPassword = jest.fn(async (auth, email, password) => ({
  user: {
    uid: 'mock-user-456',
    email: email,
    displayName: null,
    photoURL: null
  }
}));

export const signOut = jest.fn(async () => {});

export const updateProfile = jest.fn(async () => {});

export const onAuthStateChanged = jest.fn((auth, callback) => {
  // Call callback with null (no user) by default
  callback(null);
  // Return unsubscribe function
  return jest.fn();
});

export const GoogleAuthProvider = jest.fn(() => ({
  addScope: jest.fn(),
  setCustomParameters: jest.fn()
}));

export const signInWithCredential = jest.fn(async () => ({
  user: {
    uid: 'google-user-789',
    email: 'google@example.com',
    displayName: 'Google User',
    photoURL: 'https://example.com/photo.jpg'
  }
}));
