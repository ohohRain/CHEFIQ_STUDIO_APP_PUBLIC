import recipeServiceModule from '../recipeService';

jest.mock('firebase/firestore');
jest.mock('../storageService', () => ({
  __esModule: true,
  default: {
    deleteRecipeImages: jest.fn().mockResolvedValue({
      success: true,
      data: { deletedCount: 0 }
    })
  }
}));

describe('recipeService', () => {
  let mockFirestore;
  const {
    createRecipe,
    getRecipe,
    updateRecipe,
    publishRecipe,
    deleteRecipe,
    getUserRecipes,
    incrementViewCount
  } = recipeServiceModule;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFirestore = require('firebase/firestore');

    // Mock db import
    jest.mock('../../config/firebase', () => ({
      db: {}
    }));
  });

  describe('createRecipe', () => {
    const validRecipeData = {
      title: 'Test Recipe',
      description: 'A delicious test recipe',
      coverImage: 'https://example.com/cover.jpg',
      difficulty: 'Easy',
      cookingTime: 30,
      cuisine: 'Italian',
      equipment: ['Oven', 'Pan'],
      ingredients: [{ name: 'Flour', amount: '2 cups' }],
      steps: [{ description: 'Mix ingredients' }],
      authorId: 'user123',
      authorUsername: 'Test User',
      authorAvatar: null
    };

    it('should successfully create a published recipe', async () => {
      mockFirestore.doc.mockReturnValue({ id: 'newRecipeId' });
      mockFirestore.collection.mockReturnValue({});
      mockFirestore.setDoc.mockResolvedValue();

      const result = await createRecipe(validRecipeData, false);

      expect(result.success).toBe(true);
      expect(result.data.recipeId).toBeDefined();
      expect(result.data.recipe).toBeDefined();
      expect(result.data.recipe.status).toBe('published');
      expect(result.error).toBeNull();

      expect(mockFirestore.setDoc).toHaveBeenCalled();
    });

    it('should successfully create a draft recipe', async () => {
      mockFirestore.doc.mockReturnValue({ id: 'draftRecipeId' });
      mockFirestore.collection.mockReturnValue({});
      mockFirestore.setDoc.mockResolvedValue();

      const draftData = { ...validRecipeData, coverImage: null };
      const result = await createRecipe(draftData, true);

      expect(result.success).toBe(true);
      expect(result.data.recipe.status).toBe('draft');
      expect(result.error).toBeNull();
    });

    it('should initialize stats to zero', async () => {
      mockFirestore.doc.mockReturnValue({ id: 'newRecipeId' });
      mockFirestore.collection.mockReturnValue({});
      mockFirestore.setDoc.mockResolvedValue();

      await createRecipe(validRecipeData, false);

      const setDocCall = mockFirestore.setDoc.mock.calls[0][1];
      expect(setDocCall.stats).toEqual({
        likesCount: 0,
        commentsCount: 0,
        viewsCount: 0,
        savesCount: 0
      });
    });

    it('should return error for missing title', async () => {
      const invalidData = { ...validRecipeData, title: '' };

      const result = await createRecipe(invalidData, false);

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('recipe/validation-failed');
      expect(result.error.message).toContain('Title is required');
    });

    it('should return error for missing cover image on published recipe', async () => {
      const invalidData = { ...validRecipeData, coverImage: null };

      const result = await createRecipe(invalidData, false);

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('recipe/validation-failed');
      expect(result.error.message).toContain('Cover image is required for publishing');
    });

    it('should return error for invalid difficulty', async () => {
      const invalidData = { ...validRecipeData, difficulty: 'VeryHard' };

      const result = await createRecipe(invalidData, false);

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('recipe/validation-failed');
      expect(result.error.message).toContain('Valid difficulty level is required');
    });

    it('should return error for empty ingredients array', async () => {
      const invalidData = { ...validRecipeData, ingredients: [] };

      const result = await createRecipe(invalidData, false);

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('recipe/validation-failed');
      expect(result.error.message).toContain('At least one ingredient is required');
    });

    it('should return error for empty steps array', async () => {
      const invalidData = { ...validRecipeData, steps: [] };

      const result = await createRecipe(invalidData, false);

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('recipe/validation-failed');
      expect(result.error.message).toContain('At least one cooking step is required');
    });

    it('should return error on Firestore failure', async () => {
      mockFirestore.doc.mockReturnValue({ id: 'newRecipeId' });
      mockFirestore.collection.mockReturnValue({});
      mockFirestore.setDoc.mockRejectedValue(new Error('Network error'));

      const result = await createRecipe(validRecipeData, false);

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('recipe/creation-failed');
      expect(result.error.message).toContain('Network error');
    });
  });

  describe('getRecipe', () => {
    it('should return recipe data when found', async () => {
      const recipeId = 'recipe123';
      const mockRecipeData = {
        recipeId,
        title: 'Test Recipe',
        status: 'published'
      };

      mockFirestore.doc.mockReturnValue({});
      mockFirestore.getDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockRecipeData
      });

      const result = await getRecipe(recipeId);

      expect(result.success).toBe(true);
      expect(result.data.recipe).toEqual(mockRecipeData);
      expect(result.error).toBeNull();
    });

    it('should return error when recipe not found', async () => {
      const recipeId = 'nonexistent';

      mockFirestore.doc.mockReturnValue({});
      mockFirestore.getDoc.mockResolvedValue({
        exists: () => false
      });

      const result = await getRecipe(recipeId);

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('recipe/not-found');
    });

    it('should return error for unauthorized draft access', async () => {
      const recipeId = 'draft123';
      const mockDraftData = {
        recipeId,
        title: 'Draft Recipe',
        status: 'draft',
        authorId: 'user456'
      };

      mockFirestore.doc.mockReturnValue({});
      mockFirestore.getDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockDraftData
      });

      const result = await getRecipe(recipeId, 'user789');

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('recipe/permission-denied');
    });

    it('should allow author to access own draft', async () => {
      const recipeId = 'draft123';
      const mockDraftData = {
        recipeId,
        title: 'Draft Recipe',
        status: 'draft',
        authorId: 'user456'
      };

      mockFirestore.doc.mockReturnValue({});
      mockFirestore.getDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockDraftData
      });

      const result = await getRecipe(recipeId, 'user456');

      expect(result.success).toBe(true);
      expect(result.data.recipe).toEqual(mockDraftData);
    });
  });

  describe('updateRecipe', () => {
    it('should successfully update recipe', async () => {
      const recipeId = 'recipe123';
      const updates = { title: 'Updated Title', description: 'New description' };
      const mockExistingRecipe = {
        recipeId,
        authorId: 'user123',
        title: 'Old Title'
      };
      const mockUpdatedRecipe = {
        ...mockExistingRecipe,
        ...updates
      };

      mockFirestore.doc.mockReturnValue({});
      mockFirestore.getDoc
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => mockExistingRecipe
        })
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => mockUpdatedRecipe
        });
      mockFirestore.updateDoc.mockResolvedValue();

      const result = await updateRecipe(recipeId, updates, 'user123');

      expect(result.success).toBe(true);
      expect(result.data.recipe.title).toBe('Updated Title');
      expect(result.error).toBeNull();
    });

    it('should return error when recipe not found', async () => {
      mockFirestore.doc.mockReturnValue({});
      mockFirestore.getDoc.mockResolvedValue({
        exists: () => false
      });

      const result = await updateRecipe('nonexistent', { title: 'New' }, 'user123');

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('recipe/not-found');
    });

    it('should return error for unauthorized update', async () => {
      const mockExistingRecipe = {
        recipeId: 'recipe123',
        authorId: 'user456',
        title: 'Test'
      };

      mockFirestore.doc.mockReturnValue({});
      mockFirestore.getDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockExistingRecipe
      });

      const result = await updateRecipe('recipe123', { title: 'New' }, 'user789');

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('recipe/permission-denied');
    });
  });

  describe('publishRecipe', () => {
    it('should successfully publish draft recipe', async () => {
      const recipeId = 'draft123';
      const mockDraftRecipe = {
        recipeId,
        status: 'draft',
        authorId: 'user123',
        coverImage: 'https://example.com/cover.jpg'
      };
      const mockPublishedRecipe = {
        ...mockDraftRecipe,
        status: 'published'
      };

      mockFirestore.doc.mockReturnValue({});
      mockFirestore.getDoc
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => mockDraftRecipe
        })
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => mockPublishedRecipe
        });
      mockFirestore.updateDoc.mockResolvedValue();

      const result = await publishRecipe(recipeId, 'user123');

      expect(result.success).toBe(true);
      expect(result.data.recipe.status).toBe('published');
      expect(result.error).toBeNull();
    });

    it('should return error when recipe not found', async () => {
      mockFirestore.doc.mockReturnValue({});
      mockFirestore.getDoc.mockResolvedValue({
        exists: () => false
      });

      const result = await publishRecipe('nonexistent', 'user123');

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('recipe/not-found');
    });

    it('should return error for unauthorized publish', async () => {
      const mockDraftRecipe = {
        recipeId: 'draft123',
        status: 'draft',
        authorId: 'user456',
        coverImage: 'https://example.com/cover.jpg'
      };

      mockFirestore.doc.mockReturnValue({});
      mockFirestore.getDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockDraftRecipe
      });

      const result = await publishRecipe('draft123', 'user789');

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('recipe/permission-denied');
    });

    it('should return error when already published', async () => {
      const mockPublishedRecipe = {
        recipeId: 'recipe123',
        status: 'published',
        authorId: 'user123'
      };

      mockFirestore.doc.mockReturnValue({});
      mockFirestore.getDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockPublishedRecipe
      });

      const result = await publishRecipe('recipe123', 'user123');

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('recipe/already-published');
    });

    it('should return error when cover image missing', async () => {
      const mockDraftRecipe = {
        recipeId: 'draft123',
        status: 'draft',
        authorId: 'user123',
        coverImage: null
      };

      mockFirestore.doc.mockReturnValue({});
      mockFirestore.getDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockDraftRecipe
      });

      const result = await publishRecipe('draft123', 'user123');

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('recipe/missing-cover-image');
    });
  });

  describe('deleteRecipe', () => {
    it('should successfully delete recipe', async () => {
      const recipeId = 'recipe123';
      const mockRecipe = {
        recipeId,
        authorId: 'user123',
        title: 'Test Recipe'
      };

      const mockStorageService = require('../storageService').default;
      mockStorageService.deleteRecipeImages.mockResolvedValue({
        success: true,
        data: { deletedCount: 3 }
      });

      mockFirestore.doc.mockReturnValue({});
      mockFirestore.getDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockRecipe
      });
      mockFirestore.deleteDoc.mockResolvedValue();

      const result = await deleteRecipe(recipeId, 'user123');

      expect(result.success).toBe(true);
      expect(result.data.deletedRecipeId).toBe(recipeId);
      expect(result.data.deletedImagesCount).toBe(3);
      expect(result.error).toBeNull();

      expect(mockFirestore.deleteDoc).toHaveBeenCalled();
    });

    it('should return error when recipe not found', async () => {
      mockFirestore.doc.mockReturnValue({});
      mockFirestore.getDoc.mockResolvedValue({
        exists: () => false
      });

      const result = await deleteRecipe('nonexistent', 'user123');

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('recipe/not-found');
    });

    it('should return error for unauthorized delete', async () => {
      const mockRecipe = {
        recipeId: 'recipe123',
        authorId: 'user456'
      };

      mockFirestore.doc.mockReturnValue({});
      mockFirestore.getDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockRecipe
      });

      const result = await deleteRecipe('recipe123', 'user789');

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('recipe/permission-denied');
    });
  });

  describe('getUserRecipes', () => {
    it('should return all recipes for a user', async () => {
      const userId = 'user123';
      const mockRecipes = [
        { recipeId: 'recipe1', title: 'Recipe 1' },
        { recipeId: 'recipe2', title: 'Recipe 2' }
      ];

      mockFirestore.collection.mockReturnValue({});
      mockFirestore.query.mockReturnValue({});
      const mockDocs = mockRecipes.map(r => ({
        data: () => r
      }));
      mockDocs.length = mockRecipes.length;
      mockFirestore.getDocs.mockResolvedValue({
        docs: mockDocs,
        forEach: (callback) => mockDocs.forEach(callback)
      });

      mockFirestore.where = jest.fn().mockReturnValue({});
      mockFirestore.orderBy = jest.fn().mockReturnValue({});
      mockFirestore.limit = jest.fn().mockReturnValue({});

      const result = await getUserRecipes(userId);

      if (!result.success) {
        console.log('getUserRecipes error:', result.error);
      }

      expect(result.success).toBe(true);
      expect(result.data.recipes).toHaveLength(2);
      expect(result.data.hasMore).toBe(false); // 2 < 20 (pageLimit)
      expect(result.error).toBeNull();
      expect(mockFirestore.where).toHaveBeenCalledWith('authorId', '==', userId);
    });

    it('should filter by published status', async () => {
      const userId = 'user123';

      mockFirestore.collection.mockReturnValue({});
      mockFirestore.query.mockReturnValue({});
      const emptyDocs = [];
      mockFirestore.getDocs.mockResolvedValue({
        docs: emptyDocs,
        forEach: (callback) => emptyDocs.forEach(callback)
      });

      await getUserRecipes(userId, 'published');

      expect(mockFirestore.where).toHaveBeenCalledWith('status', '==', 'published');
    });

    it('should filter by draft status', async () => {
      const userId = 'user123';

      mockFirestore.collection.mockReturnValue({});
      mockFirestore.query.mockReturnValue({});
      const emptyDocs = [];
      mockFirestore.getDocs.mockResolvedValue({
        docs: emptyDocs,
        forEach: (callback) => emptyDocs.forEach(callback)
      });

      await getUserRecipes(userId, 'draft');

      expect(mockFirestore.where).toHaveBeenCalledWith('status', '==', 'draft');
    });

    it('should return empty array when no recipes found', async () => {
      const userId = 'user123';

      mockFirestore.collection.mockReturnValue({});
      mockFirestore.query.mockReturnValue({});
      const emptyDocs = [];
      emptyDocs.length = 0;
      mockFirestore.getDocs.mockResolvedValue({
        docs: emptyDocs,
        forEach: (callback) => emptyDocs.forEach(callback)
      });

      const result = await getUserRecipes(userId);

      expect(result.success).toBe(true);
      expect(result.data.recipes).toEqual([]);
      expect(result.error).toBeNull();
    });
  });

  describe('incrementViewCount', () => {
    it('should increment view count for non-author', async () => {
      const recipeId = 'recipe123';
      const userId = 'user456';
      const authorId = 'user123';

      mockFirestore.doc.mockReturnValue({});
      mockFirestore.updateDoc.mockResolvedValue();

      const result = await incrementViewCount(recipeId, userId, authorId);

      expect(result.success).toBe(true);
      expect(result.data.counted).toBe(true);
      expect(result.error).toBeNull();

      expect(mockFirestore.updateDoc).toHaveBeenCalled();
      expect(mockFirestore.increment).toHaveBeenCalledWith(1);
    });

    it('should not count view for author viewing own recipe', async () => {
      const recipeId = 'recipe123';
      const userId = 'user123';
      const authorId = 'user123';

      const result = await incrementViewCount(recipeId, userId, authorId);

      expect(result.success).toBe(true);
      expect(result.data.counted).toBe(false);
      expect(result.data.reason).toBe('author_view');
      expect(result.error).toBeNull();

      expect(mockFirestore.updateDoc).not.toHaveBeenCalled();
    });

    it('should handle Firestore error', async () => {
      const recipeId = 'recipe123';

      mockFirestore.doc.mockReturnValue({});
      mockFirestore.updateDoc.mockRejectedValue(new Error('Network error'));

      const result = await incrementViewCount(recipeId, 'user456', 'user123');

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('recipe/view-tracking-failed');
      expect(result.error.message).toContain('Network error');
    });
  });
});
