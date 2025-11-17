import likeServiceModule from '../likeService';

// Mock Firebase modules
jest.mock('firebase/firestore');
jest.mock('../pendingLikesManager', () => ({
  __esModule: true,
  default: {
    addPending: jest.fn().mockResolvedValue(undefined),
    removePending: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('likeService', () => {
  let mockFirestore;
  const { likeRecipe, unlikeRecipe, checkIfLiked, getUserLikes, getRecipeLikes } = likeServiceModule;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockFirestore = require('firebase/firestore');

    // Mock db import
    jest.mock('../../config/firebase', () => ({
      db: {}
    }));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('likeRecipe', () => {
    it('should successfully like a recipe when not already liked', async () => {
      const userId = 'user123';
      const recipeId = 'recipe456';

      // Mock getDoc to return "not exists" (not liked)
      mockFirestore.getDoc.mockResolvedValue({
        exists: () => false
      });

      mockFirestore.doc.mockReturnValue({
        _path: `likes/${userId}_${recipeId}`
      });

      const result = await likeRecipe(userId, recipeId);

      // Verify success response format
      expect(result.success).toBe(true);
      expect(result.data.likeId).toBe(`${userId}_${recipeId}`);
      expect(result.data.alreadyLiked).toBe(false);
      expect(result.error).toBeNull();

      // Verify setDoc was called to create like
      expect(mockFirestore.setDoc).toHaveBeenCalled();
    });

    it('should handle already liked recipe gracefully', async () => {
      const userId = 'user123';
      const recipeId = 'recipe456';

      // Mock getDoc to return "exists" (already liked)
      mockFirestore.getDoc.mockResolvedValue({
        exists: () => true
      });

      const result = await likeRecipe(userId, recipeId);

      // Verify success response with alreadyLiked flag
      expect(result.success).toBe(true);
      expect(result.data.alreadyLiked).toBe(true);
      expect(result.error).toBeNull();

      // Verify setDoc was NOT called (already liked)
      expect(mockFirestore.setDoc).not.toHaveBeenCalled();
    });

    it('should return error response on Firestore failure', async () => {
      const userId = 'user123';
      const recipeId = 'recipe456';

      // Mock getDoc to throw error
      mockFirestore.getDoc.mockRejectedValue(new Error('Network error'));

      const result = await likeRecipe(userId, recipeId);

      // Verify error response format
      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error).toBeDefined();
      expect(result.error.code).toBe('like/operation-failed');
      expect(result.error.message).toContain('Network error');
    });

    it('should return error for null userId', async () => {
      const result = await likeRecipe(null, 'recipe456');

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('like/invalid-user-id');
    });

    it('should return error for null recipeId', async () => {
      const result = await likeRecipe('user123', null);

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('like/invalid-recipe-id');
    });

    it('should return error for empty string userId', async () => {
      const result = await likeRecipe('', 'recipe456');

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('like/invalid-user-id');
    });

    it('should return error for empty string recipeId', async () => {
      const result = await likeRecipe('user123', '');

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('like/invalid-recipe-id');
    });
  });

  describe('unlikeRecipe', () => {
    it('should successfully unlike a liked recipe', async () => {
      const userId = 'user123';
      const recipeId = 'recipe456';

      // Mock getDoc to return "exists" (liked)
      mockFirestore.getDoc.mockResolvedValue({
        exists: () => true
      });

      const result = await unlikeRecipe(userId, recipeId);

      // Verify success response
      expect(result.success).toBe(true);
      expect(result.data.deleted).toBe(true);
      expect(result.data.notLiked).toBe(false);
      expect(result.error).toBeNull();

      // Verify deleteDoc was called
      expect(mockFirestore.deleteDoc).toHaveBeenCalled();
    });

    it('should handle not-liked recipe gracefully', async () => {
      const userId = 'user123';
      const recipeId = 'recipe456';

      // Mock getDoc to return "not exists" (not liked)
      mockFirestore.getDoc.mockResolvedValue({
        exists: () => false
      });

      const result = await unlikeRecipe(userId, recipeId);

      // Verify success response with notLiked flag
      expect(result.success).toBe(true);
      expect(result.data.deleted).toBe(false);
      expect(result.data.notLiked).toBe(true);
      expect(result.error).toBeNull();

      // Verify deleteDoc was NOT called
      expect(mockFirestore.deleteDoc).not.toHaveBeenCalled();
    });

    it('should return error response on Firestore failure', async () => {
      const userId = 'user123';
      const recipeId = 'recipe456';

      mockFirestore.getDoc.mockRejectedValue(new Error('Network error'));

      const result = await unlikeRecipe(userId, recipeId);

      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error.code).toBe('like/operation-failed');
    });

    it('should return error for invalid parameters', async () => {
      const result1 = await unlikeRecipe(null, 'recipe456');
      expect(result1.success).toBe(false);
      expect(result1.error.code).toBe('like/invalid-user-id');

      const result2 = await unlikeRecipe('user123', null);
      expect(result2.success).toBe(false);
      expect(result2.error.code).toBe('like/invalid-recipe-id');
    });
  });

  describe('checkIfLiked', () => {
    it('should return true when recipe is liked', async () => {
      const userId = 'user123';
      const recipeId = 'recipe456';

      mockFirestore.getDoc.mockResolvedValue({
        exists: () => true
      });

      const result = await checkIfLiked(userId, recipeId);

      expect(result.success).toBe(true);
      expect(result.data.isLiked).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should return false when recipe is not liked', async () => {
      const userId = 'user123';
      const recipeId = 'recipe456';

      mockFirestore.getDoc.mockResolvedValue({
        exists: () => false
      });

      const result = await checkIfLiked(userId, recipeId);

      expect(result.success).toBe(true);
      expect(result.data.isLiked).toBe(false);
      expect(result.error).toBeNull();
    });

    it('should return error for invalid parameters', async () => {
      const result = await checkIfLiked('', 'recipe456');

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('like/invalid-user-id');
    });
  });

  describe('getUserLikes', () => {
    it('should return array of user likes', async () => {
      const userId = 'user123';

      // Mock getDocs to return likes
      mockFirestore.getDocs.mockResolvedValue({
        docs: [
          {
            data: () => ({
              likeId: 'user123_recipe1',
              userId: 'user123',
              recipeId: 'recipe1',
              createdAt: { seconds: 1000 }
            })
          },
          {
            data: () => ({
              likeId: 'user123_recipe2',
              userId: 'user123',
              recipeId: 'recipe2',
              createdAt: { seconds: 2000 }
            })
          }
        ]
      });

      const result = await getUserLikes(userId);

      expect(result.success).toBe(true);
      expect(result.data.likes).toHaveLength(2);
      expect(result.data.count).toBe(2);
      expect(result.data.likes[0].recipeId).toBe('recipe1');
      expect(result.error).toBeNull();
    });

    it('should return empty array when no likes found', async () => {
      const userId = 'user123';

      mockFirestore.getDocs.mockResolvedValue({
        docs: []
      });

      const result = await getUserLikes(userId);

      expect(result.success).toBe(true);
      expect(result.data.likes).toHaveLength(0);
      expect(result.data.count).toBe(0);
      expect(result.error).toBeNull();
    });

    it('should return error for invalid userId', async () => {
      const result = await getUserLikes('');

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('like/invalid-user-id');
    });
  });

  describe('getRecipeLikes', () => {
    it('should return array of recipe likes', async () => {
      const recipeId = 'recipe456';

      mockFirestore.getDocs.mockResolvedValue({
        docs: [
          {
            data: () => ({
              likeId: 'user1_recipe456',
              userId: 'user1',
              recipeId: 'recipe456',
              createdAt: { seconds: 1000 }
            })
          },
          {
            data: () => ({
              likeId: 'user2_recipe456',
              userId: 'user2',
              recipeId: 'recipe456',
              createdAt: { seconds: 2000 }
            })
          }
        ]
      });

      const result = await getRecipeLikes(recipeId);

      expect(result.success).toBe(true);
      expect(result.data.likes).toHaveLength(2);
      expect(result.data.count).toBe(2);
      expect(result.error).toBeNull();
    });

    it('should return empty array when no likes found', async () => {
      const recipeId = 'recipe456';

      mockFirestore.getDocs.mockResolvedValue({
        docs: []
      });

      const result = await getRecipeLikes(recipeId);

      expect(result.success).toBe(true);
      expect(result.data.likes).toHaveLength(0);
      expect(result.data.count).toBe(0);
      expect(result.error).toBeNull();
    });

    it('should return error for invalid recipeId', async () => {
      const result = await getRecipeLikes('');

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('like/invalid-recipe-id');
    });
  });
});
