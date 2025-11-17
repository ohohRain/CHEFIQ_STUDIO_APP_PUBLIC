// Global Firebase Storage mocks
export const getStorage = jest.fn(() => ({}));

export const ref = jest.fn((storage, path) => ({
  _path: path,
  fullPath: path
}));

export const uploadBytesResumable = jest.fn((storageRef, blob, metadata) => {
  const task = {
    on: jest.fn((event, onProgress, onError, onComplete) => {
      // Simulate progress
      setTimeout(() => {
        onProgress({
          bytesTransferred: 50,
          totalBytes: 100
        });
      }, 10);

      setTimeout(() => {
        onProgress({
          bytesTransferred: 100,
          totalBytes: 100
        });
        onComplete();
      }, 20);

      return jest.fn(); // Unsubscribe function
    }),
    snapshot: {
      bytesTransferred: 0,
      totalBytes: 100,
      state: 'running'
    }
  };
  return task;
});

export const getDownloadURL = jest.fn(async (storageRef) => {
  return `https://example.com/storage/${storageRef._path}`;
});

export const deleteObject = jest.fn(async () => {});

export const listAll = jest.fn(async () => ({
  items: [],
  prefixes: []
}));
