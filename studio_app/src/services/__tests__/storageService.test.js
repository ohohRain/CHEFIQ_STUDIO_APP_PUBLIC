import storageServiceModule from '../storageService';

jest.mock('firebase/storage');

describe('storageService', () => {
  let mockStorage;
  const {
    uploadRecipeCoverImage,
    uploadRecipeStepImage,
    uploadUserAvatar,
    deleteRecipeImages,
    deleteUserAvatar,
    deleteImage
  } = storageServiceModule;

  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage = require('firebase/storage');

    // Mock storage import
    jest.mock('../../config/firebase', () => ({
      storage: {}
    }));

    // Mock global fetch
    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete global.fetch;
  });

  describe('uploadRecipeCoverImage', () => {
    const createMockUploadTask = (shouldFail = false, errorType = null) => ({
      on: jest.fn((event, onProgress, onError, onComplete) => {
        if (shouldFail) {
          const error = new Error('Upload failed');
          if (errorType) {
            error.code = errorType;
          }
          onError(error);
        } else {
          onProgress({ bytesTransferred: 50, totalBytes: 100 });
          onProgress({ bytesTransferred: 100, totalBytes: 100 });
          onComplete();
        }
        return jest.fn();
      }),
      snapshot: { ref: {} }
    });

    it('should successfully upload recipe cover image', async () => {
      const recipeId = 'recipe123';
      const imageUri = 'file://image.jpg';
      const expectedURL = 'https://example.com/storage/cover.jpg';

      // Mock fetch for URI to Blob conversion
      global.fetch.mockResolvedValue({
        blob: () => Promise.resolve(new Blob(['image data'], { type: 'image/jpeg', size: 1024 }))
      });

      mockStorage.ref.mockReturnValue({});
      mockStorage.uploadBytesResumable.mockReturnValue(createMockUploadTask(false));
      mockStorage.getDownloadURL.mockResolvedValue(expectedURL);

      const result = await uploadRecipeCoverImage(recipeId, imageUri);

      expect(result.success).toBe(true);
      expect(result.data.downloadURL).toBe(expectedURL);
      expect(result.data.storagePath).toContain(`recipes/${recipeId}/cover_`);
      expect(result.error).toBeNull();
    });

    it('should track upload progress', async () => {
      const recipeId = 'recipe123';
      const imageUri = 'file://image.jpg';
      const progressCallback = jest.fn();

      global.fetch.mockResolvedValue({
        blob: () => Promise.resolve(new Blob(['image data'], { type: 'image/jpeg', size: 1024 }))
      });

      mockStorage.ref.mockReturnValue({});
      mockStorage.uploadBytesResumable.mockReturnValue(createMockUploadTask(false));
      mockStorage.getDownloadURL.mockResolvedValue('https://example.com/image.jpg');

      await uploadRecipeCoverImage(recipeId, imageUri, progressCallback);

      expect(progressCallback).toHaveBeenCalledWith(0.5); // 50/100
      expect(progressCallback).toHaveBeenCalledWith(1.0); // 100/100
    });

    it('should return error for missing recipe ID', async () => {
      const result = await uploadRecipeCoverImage('', 'file://image.jpg');

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('storage/invalid-recipe-id');
    });

    it('should return error for null recipe ID', async () => {
      const result = await uploadRecipeCoverImage(null, 'file://image.jpg');

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('storage/invalid-recipe-id');
    });

    it('should return error for missing image URI', async () => {
      const result = await uploadRecipeCoverImage('recipe123', '');

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('storage/invalid-uri');
    });

    it('should return error for invalid URI format', async () => {
      const result = await uploadRecipeCoverImage('recipe123', 'not-a-valid-uri');

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('storage/invalid-format');
    });

    it('should return error for file too large', async () => {
      const recipeId = 'recipe123';
      const imageUri = 'file://large-image.jpg';

      // Mock blob larger than MAX_FILE_SIZE (10MB)
      global.fetch.mockResolvedValue({
        blob: () => Promise.resolve(new Blob(['x'.repeat(11 * 1024 * 1024)], { type: 'image/jpeg' }))
      });

      const result = await uploadRecipeCoverImage(recipeId, imageUri);

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('storage/file-too-large');
      expect(result.error.message).toContain('10MB');
    });

    it('should handle permission denied errors', async () => {
      const recipeId = 'recipe123';
      const imageUri = 'file://image.jpg';

      global.fetch.mockResolvedValue({
        blob: () => Promise.resolve(new Blob(['image data'], { type: 'image/jpeg', size: 1024 }))
      });

      mockStorage.ref.mockReturnValue({});
      mockStorage.uploadBytesResumable.mockReturnValue(createMockUploadTask(true, 'storage/unauthorized'));

      const result = await uploadRecipeCoverImage(recipeId, imageUri);

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('storage/permission-denied');
    });

    it('should handle quota exceeded errors', async () => {
      const recipeId = 'recipe123';
      const imageUri = 'file://image.jpg';

      global.fetch.mockResolvedValue({
        blob: () => Promise.resolve(new Blob(['image data'], { type: 'image/jpeg', size: 1024 }))
      });

      mockStorage.ref.mockReturnValue({});
      mockStorage.uploadBytesResumable.mockReturnValue(createMockUploadTask(true, 'storage/quota-exceeded'));

      const result = await uploadRecipeCoverImage(recipeId, imageUri);

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('storage/quota-exceeded');
    });
  });

  describe('uploadRecipeStepImage', () => {
    const createMockUploadTask = () => ({
      on: jest.fn((event, onProgress, onError, onComplete) => {
        onComplete();
        return jest.fn();
      }),
      snapshot: { ref: {} }
    });

    it('should successfully upload step image', async () => {
      const recipeId = 'recipe123';
      const stepIndex = 2;
      const imageUri = 'file://step.jpg';
      const expectedURL = 'https://example.com/storage/step.jpg';

      global.fetch.mockResolvedValue({
        blob: () => Promise.resolve(new Blob(['image data'], { type: 'image/jpeg', size: 1024 }))
      });

      mockStorage.ref.mockReturnValue({});
      mockStorage.uploadBytesResumable.mockReturnValue(createMockUploadTask());
      mockStorage.getDownloadURL.mockResolvedValue(expectedURL);

      const result = await uploadRecipeStepImage(recipeId, stepIndex, imageUri);

      expect(result.success).toBe(true);
      expect(result.data.downloadURL).toBe(expectedURL);
      expect(result.data.storagePath).toContain(`recipes/${recipeId}/step_${stepIndex}_`);
      expect(result.error).toBeNull();
    });

    it('should return error for invalid step index', async () => {
      const result = await uploadRecipeStepImage('recipe123', -1, 'file://image.jpg');

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('storage/invalid-step-index');
    });

    it('should return error for non-number step index', async () => {
      const result = await uploadRecipeStepImage('recipe123', 'not-a-number', 'file://image.jpg');

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('storage/invalid-step-index');
    });
  });

  describe('uploadUserAvatar', () => {
    const createMockUploadTask = () => ({
      on: jest.fn((event, onProgress, onError, onComplete) => {
        onComplete();
        return jest.fn();
      }),
      snapshot: { ref: {} }
    });

    it('should successfully upload user avatar', async () => {
      const userId = 'user123';
      const imageUri = 'file://avatar.jpg';
      const expectedURL = 'https://example.com/storage/avatar.jpg';

      global.fetch.mockResolvedValue({
        blob: () => Promise.resolve(new Blob(['image data'], { type: 'image/jpeg', size: 1024 }))
      });

      mockStorage.ref.mockReturnValue({});
      mockStorage.uploadBytesResumable.mockReturnValue(createMockUploadTask());
      mockStorage.getDownloadURL.mockResolvedValue(expectedURL);

      const result = await uploadUserAvatar(userId, imageUri);

      expect(result.success).toBe(true);
      expect(result.data.downloadURL).toBe(expectedURL);
      expect(result.data.storagePath).toContain(`avatars/${userId}/avatar_`);
      expect(result.error).toBeNull();
    });

    it('should return error for missing user ID', async () => {
      const result = await uploadUserAvatar('', 'file://avatar.jpg');

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('storage/invalid-user-id');
    });

    it('should return error for null user ID', async () => {
      const result = await uploadUserAvatar(null, 'file://avatar.jpg');

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('storage/invalid-user-id');
    });
  });

  describe('deleteRecipeImages', () => {
    it('should successfully delete all recipe images', async () => {
      const recipeId = 'recipe123';

      mockStorage.ref.mockReturnValue({});
      mockStorage.listAll.mockResolvedValue({
        items: [
          { fullPath: 'recipes/recipe123/cover.jpg' },
          { fullPath: 'recipes/recipe123/step_0.jpg' },
          { fullPath: 'recipes/recipe123/step_1.jpg' }
        ]
      });
      mockStorage.deleteObject.mockResolvedValue();

      const result = await deleteRecipeImages(recipeId);

      expect(result.success).toBe(true);
      expect(result.data.deletedCount).toBe(3);
      expect(result.error).toBeNull();

      expect(mockStorage.deleteObject).toHaveBeenCalledTimes(3);
    });

    it('should return success with zero count when folder not found', async () => {
      const recipeId = 'recipe123';

      mockStorage.ref.mockReturnValue({});
      const notFoundError = new Error('Not found');
      notFoundError.code = 'storage/object-not-found';
      mockStorage.listAll.mockRejectedValue(notFoundError);

      const result = await deleteRecipeImages(recipeId);

      expect(result.success).toBe(true);
      expect(result.data.deletedCount).toBe(0);
      expect(result.error).toBeNull();
    });

    it('should return error for missing recipe ID', async () => {
      const result = await deleteRecipeImages('');

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('storage/invalid-recipe-id');
    });

    it('should handle deletion errors', async () => {
      const recipeId = 'recipe123';

      mockStorage.ref.mockReturnValue({});
      mockStorage.listAll.mockRejectedValue(new Error('Network error'));

      const result = await deleteRecipeImages(recipeId);

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('storage/delete-failed');
    });
  });

  describe('deleteUserAvatar', () => {
    it('should successfully delete user avatar', async () => {
      const userId = 'user123';

      mockStorage.ref.mockReturnValue({});
      mockStorage.listAll.mockResolvedValue({
        items: [
          { fullPath: 'avatars/user123/avatar.jpg' }
        ]
      });
      mockStorage.deleteObject.mockResolvedValue();

      const result = await deleteUserAvatar(userId);

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
      expect(result.error).toBeNull();

      expect(mockStorage.deleteObject).toHaveBeenCalledTimes(1);
    });

    it('should return success when avatar folder not found', async () => {
      const userId = 'user123';

      mockStorage.ref.mockReturnValue({});
      const notFoundError = new Error('Not found');
      notFoundError.code = 'storage/object-not-found';
      mockStorage.listAll.mockRejectedValue(notFoundError);

      const result = await deleteUserAvatar(userId);

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
      expect(result.error).toBeNull();
    });

    it('should return error for missing user ID', async () => {
      const result = await deleteUserAvatar('');

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('storage/invalid-user-id');
    });
  });

  describe('deleteImage', () => {
    it('should successfully delete specific image', async () => {
      const storagePath = 'recipes/recipe123/cover.jpg';

      mockStorage.ref.mockReturnValue({});
      mockStorage.deleteObject.mockResolvedValue();

      const result = await deleteImage(storagePath);

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
      expect(result.error).toBeNull();

      expect(mockStorage.deleteObject).toHaveBeenCalled();
    });

    it('should return success when image not found', async () => {
      const storagePath = 'recipes/recipe123/nonexistent.jpg';

      mockStorage.ref.mockReturnValue({});
      const notFoundError = new Error('Not found');
      notFoundError.code = 'storage/object-not-found';
      mockStorage.deleteObject.mockRejectedValue(notFoundError);

      const result = await deleteImage(storagePath);

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
      expect(result.error).toBeNull();
    });

    it('should return error for missing storage path', async () => {
      const result = await deleteImage('');

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('storage/invalid-path');
    });

    it('should return error for null storage path', async () => {
      const result = await deleteImage(null);

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('storage/invalid-path');
    });

    it('should handle deletion errors', async () => {
      const storagePath = 'recipes/recipe123/cover.jpg';

      mockStorage.ref.mockReturnValue({});
      mockStorage.deleteObject.mockRejectedValue(new Error('Permission denied'));

      const result = await deleteImage(storagePath);

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('storage/delete-failed');
    });
  });
});
