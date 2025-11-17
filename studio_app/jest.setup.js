// Mock Firebase config
jest.mock('./src/config/firebase', () => ({
  db: {},
  auth: {},
  storage: {}
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Suppress console errors/warnings in tests
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn()
};

// Set test timeout
jest.setTimeout(10000);
