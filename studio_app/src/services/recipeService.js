/**
 * Recipe Service
 * Handles all recipe CRUD operations with Firestore
 *
 * Response Structure (following Phase 5 standard):
 * {
 *   success: boolean,
 *   data: object | null,
 *   error: { code: string, message: string } | null
 * }
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  startAfter,
  increment,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import storageService from './storageService';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create success response
 */
const _successResponse = (data) => ({
  success: true,
  data,
  error: null,
});

/**
 * Create error response
 */
const _errorResponse = (code, message) => ({
  success: false,
  data: null,
  error: { code, message },
});

/**
 * Validate recipe data
 * @param {object} data - Recipe data to validate
 * @param {boolean} isDraft - Whether this is a draft (less strict validation)
 * @throws {object} Error with code and message
 */
const _validateRecipeData = (data, isDraft = false) => {
  const errors = [];

  // Title validation
  if (!data.title || !data.title.trim()) {
    errors.push('Title is required');
  } else if (data.title.length > 80) {
    errors.push('Title must be 80 characters or less');
  }

  // Description validation (optional)
  if (data.description && data.description.length > 500) {
    errors.push('Description must be 500 characters or less');
  }

  // Cover image (required for published, optional for draft)
  if (!isDraft && !data.coverImage) {
    errors.push('Cover image is required for publishing');
  }

  // Difficulty validation
  if (!['Easy', 'Medium', 'Hard'].includes(data.difficulty)) {
    errors.push('Valid difficulty level is required (Easy, Medium, or Hard)');
  }

  // Cooking time validation
  if (!data.cookingTime || data.cookingTime <= 0) {
    errors.push('Valid cooking time is required (must be greater than 0)');
  }

  // Cuisine validation
  if (!data.cuisine || !data.cuisine.trim()) {
    errors.push('Cuisine type is required');
  }

  // Ingredients validation
  if (!data.ingredients || !Array.isArray(data.ingredients) || data.ingredients.length === 0) {
    errors.push('At least one ingredient is required');
  } else {
    data.ingredients.forEach((ing, idx) => {
      if (!ing.name || !ing.name.trim()) {
        errors.push(`Ingredient ${idx + 1} must have a name`);
      }
      // Amount is optional - users can skip it
    });
  }

  // Steps validation
  if (!data.steps || !Array.isArray(data.steps) || data.steps.length === 0) {
    errors.push('At least one cooking step is required');
  } else if (data.steps.length > 10) {
    errors.push('Maximum 10 cooking steps allowed');
  } else {
    data.steps.forEach((step, idx) => {
      if (!step.description || !step.description.trim()) {
        errors.push(`Step ${idx + 1} must have a description`);
      }
    });
  }

  // Author data validation
  if (!data.authorId || !data.authorUsername) {
    errors.push('Author information is required');
  }

  if (errors.length > 0) {
    throw {
      code: 'recipe/validation-failed',
      message: errors.join(', '),
    };
  }
};

/**
 * Transform steps array to add number field
 * @param {array} steps - Steps array from form
 * @returns {array} Transformed steps with number field
 */
const _transformStepsArray = (steps) => {
  return steps.map((step, index) => ({
    number: index + 1,
    description: step.description.trim(),
    image: step.image || null,
  }));
};

/**
 * Clean and prepare recipe data for Firestore
 * @param {object} recipeData - Raw recipe data from form
 * @param {boolean} isDraft - Whether this is a draft
 * @returns {object} Cleaned recipe data
 */
const _prepareRecipeData = (recipeData, isDraft) => {
  return {
    title: recipeData.title.trim(),
    description: recipeData.description ? recipeData.description.trim() : '',
    coverImage: recipeData.coverImage || null,
    difficulty: recipeData.difficulty,
    cookingTime: parseInt(recipeData.cookingTime),
    cuisine: recipeData.cuisine.trim(),
    equipment: recipeData.equipment || [],
    ingredients: recipeData.ingredients.map((ing) => ({
      name: ing.name.trim(),
      amount: ing.amount ? ing.amount.trim() : '',
    })),
    steps: _transformStepsArray(recipeData.steps),
    authorId: recipeData.authorId,
    authorUsername: recipeData.authorUsername,
    authorAvatar: recipeData.authorAvatar || null,
    status: isDraft ? 'draft' : 'published',
    stats: {
      likesCount: 0,
      commentsCount: 0,
      viewsCount: 0,
      savesCount: 0,
    },
    trendingScore: 0,
    lastInteractionAt: Timestamp.now(),
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    publishedAt: isDraft ? null : Timestamp.now(),
  };
};

// ============================================================================
// Public Methods
// ============================================================================

/**
 * Create a new recipe (draft or published)
 * @param {object} recipeData - Recipe data from form
 * @param {boolean} isDraft - Whether to save as draft (default: false)
 * @param {string} recipeId - Optional pre-generated recipe ID (for image upload coordination)
 * @returns {Promise<object>} Response with recipeId and recipe object
 */
export const createRecipe = async (recipeData, isDraft = false, recipeId = null) => {
  try {
    // Validate recipe data
    _validateRecipeData(recipeData, isDraft);

    // Use provided recipeId or generate new one
    const finalRecipeId = recipeId || doc(collection(db, 'recipes')).id;

    // Prepare recipe data
    const preparedData = _prepareRecipeData(recipeData, isDraft);
    preparedData.recipeId = finalRecipeId;

    // Create recipe document
    // Note: Cloud Functions (onRecipeCreate/onRecipeUpdate) handle stats.recipesCount updates
    // - onRecipeCreate: increments when recipe created with status='published'
    // - onRecipeUpdate: increments when draft→published, decrements when published→draft
    const recipeRef = doc(db, 'recipes', finalRecipeId);
    await setDoc(recipeRef, preparedData);

    console.log(
      `✅ Recipe ${isDraft ? 'draft' : 'published'} created: ${finalRecipeId}`
    );

    return _successResponse({
      recipeId: finalRecipeId,
      recipe: preparedData,
    });
  } catch (error) {
    console.error('❌ Create recipe error:', error);

    if (error.code && error.message) {
      // Validation error
      return _errorResponse(error.code, error.message);
    }

    return _errorResponse(
      'recipe/creation-failed',
      `Failed to create recipe: ${error.message}`
    );
  }
};

/**
 * Get a single recipe by ID
 * @param {string} recipeId - Recipe ID to fetch
 * @param {string} currentUserId - Current user ID (optional, for draft access check)
 * @returns {Promise<object>} Response with recipe object
 */
export const getRecipe = async (recipeId, currentUserId = null) => {
  try {
    const recipeRef = doc(db, 'recipes', recipeId);
    const recipeSnap = await getDoc(recipeRef);

    if (!recipeSnap.exists()) {
      return _errorResponse('recipe/not-found', 'Recipe not found');
    }

    const recipeData = recipeSnap.data();

    // Check access permission
    if (recipeData.status === 'draft') {
      if (!currentUserId || currentUserId !== recipeData.authorId) {
        return _errorResponse(
          'recipe/permission-denied',
          'You do not have permission to view this draft'
        );
      }
    }

    return _successResponse({ recipe: recipeData });
  } catch (error) {
    // Silently handle deleted recipes (expected during cascade deletion cleanup)
    if (error.code === 'permission-denied' || error.code === 'not-found') {
      return _errorResponse(error.code, 'Recipe not found or no longer available');
    }

    console.error('❌ Get recipe error:', error);
    return _errorResponse(
      'recipe/fetch-failed',
      `Failed to fetch recipe: ${error.message}`
    );
  }
};

/**
 * Update an existing recipe
 * @param {string} recipeId - Recipe ID to update
 * @param {object} updateData - Data to update
 * @param {string} currentUserId - Current user ID for permission check
 * @returns {Promise<object>} Response with updated recipe
 */
export const updateRecipe = async (recipeId, updateData, currentUserId) => {
  try {
    const recipeRef = doc(db, 'recipes', recipeId);
    const recipeSnap = await getDoc(recipeRef);

    if (!recipeSnap.exists()) {
      return _errorResponse('recipe/not-found', 'Recipe not found');
    }

    const existingRecipe = recipeSnap.data();

    // Permission check
    if (existingRecipe.authorId !== currentUserId) {
      return _errorResponse(
        'recipe/permission-denied',
        'You do not have permission to update this recipe'
      );
    }

    // Prepare update data (filter out protected fields)
    const allowedFields = [
      'title',
      'description',
      'coverImage',
      'difficulty',
      'cookingTime',
      'cuisine',
      'equipment',
      'ingredients',
      'steps',
    ];

    const filteredUpdate = {};
    Object.keys(updateData).forEach((key) => {
      if (allowedFields.includes(key)) {
        filteredUpdate[key] = updateData[key];
      }
    });

    // Transform steps if provided
    if (filteredUpdate.steps) {
      filteredUpdate.steps = _transformStepsArray(filteredUpdate.steps);
    }

    // Add timestamp
    filteredUpdate.updatedAt = Timestamp.now();

    // Update recipe
    await updateDoc(recipeRef, filteredUpdate);

    // Fetch updated recipe
    const updatedSnap = await getDoc(recipeRef);
    const updatedRecipe = updatedSnap.data();

    console.log(`✅ Recipe updated: ${recipeId}`);

    return _successResponse({ recipe: updatedRecipe });
  } catch (error) {
    console.error('❌ Update recipe error:', error);
    return _errorResponse(
      'recipe/update-failed',
      `Failed to update recipe: ${error.message}`
    );
  }
};

/**
 * Publish a draft recipe
 * @param {string} recipeId - Recipe ID to publish
 * @param {string} currentUserId - Current user ID for permission check
 * @returns {Promise<object>} Response with published recipe
 */
export const publishRecipe = async (recipeId, currentUserId) => {
  try {
    const recipeRef = doc(db, 'recipes', recipeId);
    const recipeSnap = await getDoc(recipeRef);

    if (!recipeSnap.exists()) {
      return _errorResponse('recipe/not-found', 'Recipe not found');
    }

    const existingRecipe = recipeSnap.data();

    // Permission check
    if (existingRecipe.authorId !== currentUserId) {
      return _errorResponse(
        'recipe/permission-denied',
        'You do not have permission to publish this recipe'
      );
    }

    // Check if already published
    if (existingRecipe.status === 'published') {
      return _errorResponse('recipe/already-published', 'Recipe is already published');
    }

    // Validate publish requirements (cover image required)
    if (!existingRecipe.coverImage) {
      return _errorResponse(
        'recipe/missing-cover-image',
        'Cover image is required for publishing'
      );
    }

    // Update to published status
    await updateDoc(recipeRef, {
      status: 'published',
      publishedAt: Timestamp.now(),
      lastInteractionAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    // Fetch updated recipe
    const updatedSnap = await getDoc(recipeRef);
    const publishedRecipe = updatedSnap.data();

    console.log(`✅ Recipe published: ${recipeId}`);

    return _successResponse({ recipe: publishedRecipe });
  } catch (error) {
    console.error('❌ Publish recipe error:', error);
    return _errorResponse(
      'recipe/publish-failed',
      `Failed to publish recipe: ${error.message}`
    );
  }
};

/**
 * Delete a recipe and all associated images
 * @param {string} recipeId - Recipe ID to delete
 * @param {string} currentUserId - Current user ID for permission check
 * @returns {Promise<object>} Response with deletion confirmation
 */
export const deleteRecipe = async (recipeId, currentUserId) => {
  try {
    const recipeRef = doc(db, 'recipes', recipeId);
    const recipeSnap = await getDoc(recipeRef);

    if (!recipeSnap.exists()) {
      return _errorResponse('recipe/not-found', 'Recipe not found');
    }

    const existingRecipe = recipeSnap.data();

    // Permission check
    if (existingRecipe.authorId !== currentUserId) {
      return _errorResponse(
        'recipe/permission-denied',
        'You do not have permission to delete this recipe'
      );
    }

    // Delete all recipe images from Storage
    const storageResult = await storageService.deleteRecipeImages(recipeId);
    const deletedImagesCount = storageResult.success ? storageResult.data.deletedCount : 0;

    // Delete recipe document
    // Note: Cloud Function (onRecipeDelete) will handle stats.recipesCount decrement
    // based on recipe status (only decrements if status='published')
    // This prevents double-decrement bug when deleting published recipes
    await deleteDoc(recipeRef);

    console.log(
      `✅ Recipe deleted: ${recipeId} (${deletedImagesCount} images removed)`
    );

    return _successResponse({
      deletedRecipeId: recipeId,
      deletedImagesCount,
    });
  } catch (error) {
    console.error('❌ Delete recipe error:', error);
    return _errorResponse(
      'recipe/deletion-failed',
      `Failed to delete recipe: ${error.message}`
    );
  }
};

/**
 * Get user's recipes with optional status filter
 * @param {string} userId - User ID
 * @param {string} status - Filter by status ('draft', 'published', or null for all)
 * @param {number} pageLimit - Number of recipes per page (default: 20)
 * @param {DocumentSnapshot} lastVisible - Last document from previous page (for pagination)
 * @returns {Promise<object>} Response with recipes array
 */
export const getUserRecipes = async (
  userId,
  status = null,
  pageLimit = 20,
  lastVisible = null
) => {
  try {
    let q;

    if (status === 'published') {
      // Published recipes query
      q = query(
        collection(db, 'recipes'),
        where('authorId', '==', userId),
        where('status', '==', 'published'),
        orderBy('publishedAt', 'desc'),
        limit(pageLimit)
      );
    } else if (status === 'draft') {
      // Draft recipes query
      q = query(
        collection(db, 'recipes'),
        where('authorId', '==', userId),
        where('status', '==', 'draft'),
        orderBy('updatedAt', 'desc'),
        limit(pageLimit)
      );
    } else {
      // All recipes query
      q = query(
        collection(db, 'recipes'),
        where('authorId', '==', userId),
        orderBy('updatedAt', 'desc'),
        limit(pageLimit)
      );
    }

    // Add pagination
    if (lastVisible) {
      q = query(q, startAfter(lastVisible));
    }

    const querySnapshot = await getDocs(q);
    const recipes = [];

    querySnapshot.forEach((doc) => {
      recipes.push(doc.data());
    });

    const newLastVisible =
      querySnapshot.docs.length > 0
        ? querySnapshot.docs[querySnapshot.docs.length - 1]
        : null;

    return _successResponse({
      recipes,
      lastVisible: newLastVisible,
      hasMore: recipes.length === pageLimit,
    });
  } catch (error) {
    console.error('❌ Get user recipes error:', error);
    return _errorResponse(
      'recipe/fetch-failed',
      `Failed to fetch user recipes: ${error.message}`
    );
  }
};

/**
 * Increment view count for a recipe
 * @param {string} recipeId - Recipe ID to increment views
 * @param {string} currentUserId - Current user ID (optional, for author exclusion)
 * @param {string} authorId - Recipe author ID (to exclude author views)
 * @returns {Promise<object>} Response with counted status
 */
export const incrementViewCount = async (recipeId, currentUserId = null, authorId = null) => {
  try {
    // Don't count author's own views
    if (currentUserId && authorId && currentUserId === authorId) {
      console.log('⏭️ Skipping view count (author view)');
      return _successResponse({
        counted: false,
        reason: 'author_view',
        recipeId
      });
    }

    const recipeRef = doc(db, 'recipes', recipeId);
    await updateDoc(recipeRef, {
      'stats.viewsCount': increment(1),
      lastInteractionAt: Timestamp.now(),
    });

    console.log(`✅ View counted: ${recipeId}`);
    return _successResponse({
      counted: true,
      recipeId
    });
  } catch (error) {
    console.error('❌ Increment view count error:', error);
    return _errorResponse(
      'recipe/view-tracking-failed',
      `Failed to track view: ${error.message}`
    );
  }
};

// Export default object with all methods
export default {
  createRecipe,
  getRecipe,
  updateRecipe,
  publishRecipe,
  deleteRecipe,
  getUserRecipes,
  incrementViewCount,
};
