// Mock user data for testing
export const mockUser = {
  uid: 'user123',
  email: 'test@example.com',
  displayName: 'Test User',
  photoURL: 'https://example.com/avatar.jpg',
  bio: 'Love cooking!',
  stats: {
    followers: 100,
    following: 50,
    recipes: 25
  },
  createdAt: new Date('2024-01-01')
};

export const mockUsers = [
  mockUser,
  {
    uid: 'user456',
    email: 'chef@example.com',
    displayName: 'Master Chef',
    photoURL: 'https://example.com/chef.jpg',
    bio: 'Professional chef with 20 years experience',
    stats: {
      followers: 5000,
      following: 200,
      recipes: 150
    },
    createdAt: new Date('2023-01-01')
  },
  {
    uid: 'user789',
    email: 'baker@example.com',
    displayName: 'Baker Bob',
    photoURL: null,
    bio: '',
    stats: {
      followers: 10,
      following: 5,
      recipes: 3
    },
    createdAt: new Date('2024-06-01')
  }
];

export const mockAuthUser = {
  uid: mockUser.uid,
  email: mockUser.email,
  displayName: mockUser.displayName,
  photoURL: mockUser.photoURL,
  emailVerified: true,
  isAnonymous: false
};
