// Global Firestore SDK mocks
export const getFirestore = jest.fn(() => ({}));

export const collection = jest.fn((db, collectionName) => ({
  _collectionName: collectionName
}));

export const doc = jest.fn((db, ...pathSegments) => ({
  _path: pathSegments.join('/'),
  id: pathSegments[pathSegments.length - 1]
}));

export const getDoc = jest.fn(async (docRef) => ({
  exists: () => false,
  data: () => null,
  id: docRef.id
}));

export const getDocs = jest.fn(async () => ({
  docs: [],
  empty: true,
  size: 0
}));

export const setDoc = jest.fn(async () => {});

export const updateDoc = jest.fn(async () => {});

export const deleteDoc = jest.fn(async () => {});

export const query = jest.fn((...args) => ({
  _type: 'query',
  _args: args
}));

export const where = jest.fn((field, operator, value) => ({
  _type: 'where',
  field,
  operator,
  value
}));

export const orderBy = jest.fn((field, direction = 'asc') => ({
  _type: 'orderBy',
  field,
  direction
}));

export const limit = jest.fn((count) => ({
  _type: 'limit',
  count
}));

export const startAfter = jest.fn((...args) => ({
  _type: 'startAfter',
  args
}));

export const increment = jest.fn((n) => n);

export const arrayUnion = jest.fn((...elements) => ({
  _type: 'arrayUnion',
  elements
}));

export const arrayRemove = jest.fn((...elements) => ({
  _type: 'arrayRemove',
  elements
}));

export const serverTimestamp = jest.fn(() => new Date());

export const Timestamp = {
  now: jest.fn(() => ({
    toDate: () => new Date()
  })),
  fromDate: jest.fn((date) => ({
    toDate: () => date
  }))
};
