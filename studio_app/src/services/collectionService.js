/**
 * Collection Service
 * Handles collection and recipe-collection operations with Firestore
 *
 * Phase 9.2: Collections & Save System - Backend Integration
 * Collections: collections/{collectionId}
 * Junction Table: collection_recipes/{collectionId}_{recipeId}
 * Stats updates handled by Cloud Functions
 */

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  startAfter,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create success response object
 * @private
 */
const _successResponse = (data) => ({
  success: true,
  data,
  error: null,
});

/**
 * Create error response object
 * @private
 */
const _errorResponse = (code, message) => ({
  success: false,
  data: null,
  error: { code, message },
});

/**
 * Generate composite collection_recipe ID: {collectionId}_{recipeId}
 * @private
 */
const _generateCollectionRecipeId = (collectionId, recipeId) => {
  return `${collectionId}_${recipeId}`;
};

/**
 * Validate collection creation parameters
 * @private
 */
const _validateCollectionParams = (userId, name, emoji) => {
  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    throw {
      code: 'collection/invalid-user-id',
      message: 'Valid user ID is required',
    };
  }

  if (!name || typeof name !== 'string' || name.trim() === '') {
    throw {
      code: 'collection/invalid-name',
      message: 'Collection name is required',
    };
  }

  if (!emoji || typeof emoji !== 'string' || emoji.trim() === '') {
    throw {
      code: 'collection/invalid-emoji',
      message: 'Collection emoji is required',
    };
  }
};

/**
 * Validate collection-recipe operation parameters
 * @private
 */
const _validateCollectionRecipeParams = (collectionId, recipeId, userId) => {
  if (!collectionId || typeof collectionId !== 'string' || collectionId.trim() === '') {
    throw {
      code: 'collection/invalid-collection-id',
      message: 'Valid collection ID is required',
    };
  }

  if (!recipeId || typeof recipeId !== 'string' || recipeId.trim() === '') {
    throw {
      code: 'collection/invalid-recipe-id',
      message: 'Valid recipe ID is required',
    };
  }

  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    throw {
      code: 'collection/invalid-user-id',
      message: 'Valid user ID is required',
    };
  }
};

// ============================================================================
// COLLECTION CRUD OPERATIONS
// ============================================================================

/**
 * Create a new collection
 *
 * @param {string} userId - Firebase Auth UID
 * @param {string} name - Collection name
 * @param {string} emoji - Collection emoji
 * @param {string} description - Optional description (default: '')
 * @param {boolean} isDefault - Whether this is the default collection (default: false)
 * @returns {Promise<{success: boolean, data: {collectionId: string, collection: object} | null, error: object | null}>}
 */
const createCollection = async (userId, name, emoji, description = '', isDefault = false) => {
  try {
    // Validate parameters
    _validateCollectionParams(userId, name, emoji);

    // Generate collection ID
    const collectionRef = doc(collection(db, 'collections'));
    const collectionId = collectionRef.id;

    // Create collection document
    const collectionData = {
      collectionId,
      userId,
      name: name.trim(),
      emoji: emoji.trim(),
      description: description.trim(),
      isDefault,
      stats: {
        recipesCount: 0,
      },
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    await setDoc(collectionRef, collectionData);

    console.log(`✅ Collection created: ${name} ${emoji} (${collectionId})`);

    return _successResponse({ collectionId, collection: collectionData });
  } catch (error) {
    console.error('❌ Create collection error:', error);

    if (error.code && error.message) {
      // Validation error
      return _errorResponse(error.code, error.message);
    }

    // Firestore error
    if (error.code === 'permission-denied') {
      return _errorResponse(
        'collection/permission-denied',
        'You do not have permission to create a collection'
      );
    }

    return _errorResponse(
      'collection/create-failed',
      `Failed to create collection: ${error.message}`
    );
  }
};

/**
 * Update collection metadata
 * Note: Cannot update isDefault flag
 *
 * @param {string} collectionId - Collection document ID
 * @param {object} updates - Fields to update (name, emoji, description)
 * @returns {Promise<{success: boolean, data: {updated: boolean} | null, error: object | null}>}
 */
const updateCollection = async (collectionId, updates) => {
  try {
    if (!collectionId || typeof collectionId !== 'string' || collectionId.trim() === '') {
      throw {
        code: 'collection/invalid-collection-id',
        message: 'Valid collection ID is required',
      };
    }

    // Remove fields that shouldn't be updated
    const { collectionId: _, userId: __, isDefault: ___, stats: ____, createdAt: _____, ...allowedUpdates } = updates;

    if (Object.keys(allowedUpdates).length === 0) {
      return _successResponse({ updated: false, message: 'No valid fields to update' });
    }

    // Add updatedAt timestamp
    const updateData = {
      ...allowedUpdates,
      updatedAt: Timestamp.now(),
    };

    const collectionRef = doc(db, 'collections', collectionId);
    await updateDoc(collectionRef, updateData);

    console.log(`✅ Collection updated: ${collectionId}`);

    return _successResponse({ updated: true });
  } catch (error) {
    console.error('❌ Update collection error:', error);

    if (error.code && error.message) {
      // Validation error
      return _errorResponse(error.code, error.message);
    }

    // Firestore error
    if (error.code === 'permission-denied') {
      return _errorResponse(
        'collection/permission-denied',
        'You do not have permission to update this collection'
      );
    }

    if (error.code === 'not-found') {
      return _errorResponse(
        'collection/not-found',
        'Collection not found'
      );
    }

    return _errorResponse(
      'collection/update-failed',
      `Failed to update collection: ${error.message}`
    );
  }
};

/**
 * Delete a collection and cascade delete all collection_recipes
 * Cloud Function (onCollectionDelete) will handle stats updates
 *
 * @param {string} collectionId - Collection document ID
 * @param {string} userId - Firebase Auth UID (required for security rules)
 * @returns {Promise<{success: boolean, data: {deleted: boolean, recipesRemoved: number} | null, error: object | null}>}
 */
const deleteCollection = async (collectionId, userId) => {
  try {
    console.log(`🔍 [DEBUG] deleteCollection called with collectionId: ${collectionId}, userId: ${userId}`);

    if (!collectionId || typeof collectionId !== 'string' || collectionId.trim() === '') {
      throw {
        code: 'collection/invalid-collection-id',
        message: 'Valid collection ID is required',
      };
    }

    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      throw {
        code: 'collection/invalid-user-id',
        message: 'Valid user ID is required',
      };
    }

    // Check if collection exists and is not default
    console.log(`🔍 [DEBUG] Fetching collection document...`);
    const collectionRef = doc(db, 'collections', collectionId);
    const collectionSnap = await getDoc(collectionRef);

    if (!collectionSnap.exists()) {
      console.log(`❌ [DEBUG] Collection not found`);
      return _errorResponse(
        'collection/not-found',
        'Collection not found'
      );
    }

    const collectionData = collectionSnap.data();
    console.log(`✅ [DEBUG] Collection fetched:`, {
      collectionId: collectionData.collectionId,
      userId: collectionData.userId,
      name: collectionData.name,
      isDefault: collectionData.isDefault,
      stats: collectionData.stats
    });

    if (collectionData.isDefault) {
      console.log(`❌ [DEBUG] Cannot delete default collection`);
      return _errorResponse(
        'collection/cannot-delete-default',
        'Cannot delete default collection'
      );
    }

    // Get all collection_recipes for this collection
    // CRITICAL FIX: Add userId filter to satisfy security rules
    console.log(`🔍 [DEBUG] Querying collection_recipes with where('userId', '==', '${userId}') AND where('collectionId', '==', '${collectionId}')`);
    const collectionRecipesQuery = query(
      collection(db, 'collection_recipes'),
      where('userId', '==', userId),
      where('collectionId', '==', collectionId)
    );

    console.log(`🔍 [DEBUG] Executing getDocs on collection_recipes query...`);
    const collectionRecipesSnap = await getDocs(collectionRecipesQuery);
    console.log(`✅ [DEBUG] Found ${collectionRecipesSnap.size} collection_recipes`);

    // Delete all collection_recipes sequentially (not batch)
    // This avoids Firestore security rule issues with batch deletes
    console.log(`🗑️ [DEBUG] Starting to delete ${collectionRecipesSnap.size} collection_recipes...`);
    for (const docSnap of collectionRecipesSnap.docs) {
      const docData = docSnap.data();
      console.log(`🔍 [DEBUG] Deleting collection_recipe ${docSnap.id}:`, {
        collectionId: docData.collectionId,
        recipeId: docData.recipeId,
        userId: docData.userId
      });

      try {
        await deleteDoc(docSnap.ref);
        console.log(`✅ [DEBUG] Successfully deleted collection_recipe ${docSnap.id}`);
      } catch (deleteError) {
        console.error(`❌ [DEBUG] Failed to delete collection_recipe ${docSnap.id}:`, deleteError);
        throw deleteError; // Re-throw to catch in outer try-catch
      }
    }

    // Then delete the collection itself
    console.log(`🗑️ [DEBUG] Deleting collection document ${collectionId}...`);
    try {
      await deleteDoc(collectionRef);
      console.log(`✅ [DEBUG] Successfully deleted collection ${collectionId}`);
    } catch (deleteError) {
      console.error(`❌ [DEBUG] Failed to delete collection ${collectionId}:`, deleteError);
      throw deleteError; // Re-throw to catch in outer try-catch
    }

    const recipesRemoved = collectionRecipesSnap.size;

    console.log(`✅ Collection deleted: ${collectionId} (${recipesRemoved} recipes removed)`);

    return _successResponse({ deleted: true, recipesRemoved });
  } catch (error) {
    console.error('❌ Delete collection error:', error);
    console.error('❌ [DEBUG] Error details:', {
      code: error.code,
      message: error.message,
      name: error.name,
      stack: error.stack
    });

    if (error.code && error.message) {
      // Validation or business logic error
      return _errorResponse(error.code, error.message);
    }

    // Firestore error
    if (error.code === 'permission-denied') {
      return _errorResponse(
        'collection/permission-denied',
        'You do not have permission to delete this collection'
      );
    }

    return _errorResponse(
      'collection/delete-failed',
      `Failed to delete collection: ${error.message}`
    );
  }
};

/**
 * Get user's collections
 * Ordered by createdAt (oldest first)
 *
 * @param {string} userId - Firebase Auth UID
 * @returns {Promise<{success: boolean, data: {collections: Array} | null, error: object | null}>}
 */
const getUserCollections = async (userId) => {
  try {
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      throw {
        code: 'collection/invalid-user-id',
        message: 'Valid user ID is required',
      };
    }

    // Query collections by userId, ordered by createdAt
    const collectionsQuery = query(
      collection(db, 'collections'),
      where('userId', '==', userId),
      orderBy('createdAt', 'asc')
    );

    const collectionsSnap = await getDocs(collectionsQuery);

    const collections = collectionsSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        collectionId: data.collectionId,
        userId: data.userId,
        name: data.name,
        emoji: data.emoji,
        description: data.description,
        isDefault: data.isDefault,
        stats: data.stats,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
    });

    console.log(`✅ Fetched ${collections.length} collections for user ${userId}`);

    return _successResponse({ collections, count: collections.length });
  } catch (error) {
    console.error('❌ Get user collections error:', error);

    if (error.code && error.message) {
      // Validation error
      return _errorResponse(error.code, error.message);
    }

    return _errorResponse(
      'collection/fetch-failed',
      `Failed to fetch collections: ${error.message}`
    );
  }
};

// ============================================================================
// COLLECTION-RECIPE RELATIONSHIP OPERATIONS
// ============================================================================

/**
 * Save a recipe to a collection
 * Creates collection_recipes document with composite key
 * Cloud Function (onCollectionRecipeSave) will update stats
 *
 * @param {string} collectionId - Collection document ID
 * @param {string} recipeId - Recipe document ID
 * @param {string} userId - Firebase Auth UID (for validation)
 * @returns {Promise<{success: boolean, data: {documentId: string, movedFrom: string | null} | null, error: object | null}>}
 */
const saveRecipeToCollection = async (collectionId, recipeId, userId) => {
  try {
    // Validate parameters
    _validateCollectionRecipeParams(collectionId, recipeId, userId);

    // Check if recipe is already saved to another collection
    const existingSaveQuery = query(
      collection(db, 'collection_recipes'),
      where('recipeId', '==', recipeId),
      where('userId', '==', userId)
    );

    const existingSaveSnap = await getDocs(existingSaveQuery);

    let movedFrom = null;

    if (!existingSaveSnap.empty) {
      const existingDoc = existingSaveSnap.docs[0];
      const existingData = existingDoc.data();

      // If already in the same collection, do nothing
      if (existingData.collectionId === collectionId) {
        console.log(`⏭️ Recipe already in collection: ${recipeId}`);
        return _successResponse({
          documentId: existingDoc.id,
          movedFrom: null,
          alreadySaved: true
        });
      }

      // Recipe is in different collection, need to move it
      movedFrom = existingData.collectionId;

      // Delete old collection_recipe document
      await deleteDoc(existingDoc.ref);

      console.log(`🔄 Moving recipe from ${movedFrom} to ${collectionId}`);
    }

    // Generate composite key
    const documentId = _generateCollectionRecipeId(collectionId, recipeId);

    // Create new collection_recipes document
    const collectionRecipeData = {
      documentId,
      collectionId,
      recipeId,
      userId,
      savedAt: Timestamp.now(),
    };

    const collectionRecipeRef = doc(db, 'collection_recipes', documentId);
    await setDoc(collectionRecipeRef, collectionRecipeData);

    console.log(`✅ Recipe saved to collection: ${recipeId} → ${collectionId}`);

    return _successResponse({ documentId, movedFrom, alreadySaved: false });
  } catch (error) {
    console.error('❌ Save recipe to collection error:', error);

    if (error.code && error.message) {
      // Validation error
      return _errorResponse(error.code, error.message);
    }

    // Firestore error
    if (error.code === 'permission-denied') {
      return _errorResponse(
        'collection/permission-denied',
        'You do not have permission to save this recipe'
      );
    }

    return _errorResponse(
      'collection/save-failed',
      `Failed to save recipe to collection: ${error.message}`
    );
  }
};

/**
 * Remove a recipe from its collection
 * Cloud Function (onCollectionRecipeRemove) will update stats
 *
 * @param {string} collectionId - Collection document ID
 * @param {string} recipeId - Recipe document ID
 * @returns {Promise<{success: boolean, data: {removed: boolean} | null, error: object | null}>}
 */
const removeRecipeFromCollection = async (collectionId, recipeId) => {
  try {
    if (!collectionId || typeof collectionId !== 'string' || collectionId.trim() === '') {
      throw {
        code: 'collection/invalid-collection-id',
        message: 'Valid collection ID is required',
      };
    }

    if (!recipeId || typeof recipeId !== 'string' || recipeId.trim() === '') {
      throw {
        code: 'collection/invalid-recipe-id',
        message: 'Valid recipe ID is required',
      };
    }

    // Generate composite key
    const documentId = _generateCollectionRecipeId(collectionId, recipeId);

    // Check if document exists
    const collectionRecipeRef = doc(db, 'collection_recipes', documentId);
    const collectionRecipeSnap = await getDoc(collectionRecipeRef);

    if (!collectionRecipeSnap.exists()) {
      console.log(`⏭️ Recipe not in collection: ${recipeId}`);
      return _successResponse({ removed: false, notInCollection: true });
    }

    // Delete collection_recipes document
    await deleteDoc(collectionRecipeRef);

    console.log(`✅ Recipe removed from collection: ${recipeId} from ${collectionId}`);

    return _successResponse({ removed: true, notInCollection: false });
  } catch (error) {
    console.error('❌ Remove recipe from collection error:', error);

    if (error.code && error.message) {
      // Validation error
      return _errorResponse(error.code, error.message);
    }

    // Firestore error
    if (error.code === 'permission-denied') {
      return _errorResponse(
        'collection/permission-denied',
        'You do not have permission to remove this recipe'
      );
    }

    return _errorResponse(
      'collection/remove-failed',
      `Failed to remove recipe from collection: ${error.message}`
    );
  }
};

/**
 * Get recipes in a collection (paginated)
 *
 * @param {string} collectionId - Collection document ID
 * @param {string} userId - Firebase Auth UID (required for security rules)
 * @param {number} limit - Number of recipes to fetch (default: 20)
 * @param {object} lastVisible - Last document snapshot for pagination (optional)
 * @returns {Promise<{success: boolean, data: {recipeIds: Array, lastVisible: object | null, hasMore: boolean} | null, error: object | null}>}
 */
const getCollectionRecipes = async (collectionId, userId, limit = 20, lastVisible = null) => {
  try {
    if (!collectionId || typeof collectionId !== 'string' || collectionId.trim() === '') {
      throw {
        code: 'collection/invalid-collection-id',
        message: 'Valid collection ID is required',
      };
    }

    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      throw {
        code: 'collection/invalid-user-id',
        message: 'Valid user ID is required',
      };
    }

    // Build query with userId filter (required for security rules)
    let collectionRecipesQuery = query(
      collection(db, 'collection_recipes'),
      where('userId', '==', userId),
      where('collectionId', '==', collectionId),
      orderBy('savedAt', 'desc'),
      firestoreLimit(limit + 1) // Fetch one extra to check if there are more
    );

    // Add pagination
    if (lastVisible) {
      collectionRecipesQuery = query(
        collectionRecipesQuery,
        startAfter(lastVisible)
      );
    }

    const collectionRecipesSnap = await getDocs(collectionRecipesQuery);

    // Check if there are more results
    const hasMore = collectionRecipesSnap.docs.length > limit;

    // Get actual results (exclude the extra one)
    const docs = hasMore
      ? collectionRecipesSnap.docs.slice(0, limit)
      : collectionRecipesSnap.docs;

    const recipeIds = docs.map((doc) => doc.data().recipeId);

    const newLastVisible = docs.length > 0 ? docs[docs.length - 1] : null;

    console.log(`✅ Fetched ${recipeIds.length} recipes from collection ${collectionId}`);

    return _successResponse({
      recipeIds,
      count: recipeIds.length,
      lastVisible: newLastVisible,
      hasMore
    });
  } catch (error) {
    console.error('❌ Get collection recipes error:', error);

    if (error.code && error.message) {
      // Validation error
      return _errorResponse(error.code, error.message);
    }

    return _errorResponse(
      'collection/fetch-failed',
      `Failed to fetch collection recipes: ${error.message}`
    );
  }
};

/**
 * Check if a recipe is saved (returns collectionId or null)
 *
 * @param {string} recipeId - Recipe document ID
 * @param {string} userId - Firebase Auth UID
 * @returns {Promise<{success: boolean, data: {isSaved: boolean, collectionId: string | null} | null, error: object | null}>}
 */
const checkIfSaved = async (recipeId, userId) => {
  try {
    if (!recipeId || typeof recipeId !== 'string' || recipeId.trim() === '') {
      throw {
        code: 'collection/invalid-recipe-id',
        message: 'Valid recipe ID is required',
      };
    }

    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      throw {
        code: 'collection/invalid-user-id',
        message: 'Valid user ID is required',
      };
    }

    // Query for any collection_recipe with this recipeId and userId
    const savedQuery = query(
      collection(db, 'collection_recipes'),
      where('recipeId', '==', recipeId),
      where('userId', '==', userId),
      firestoreLimit(1)
    );

    const savedSnap = await getDocs(savedQuery);

    if (savedSnap.empty) {
      return _successResponse({ isSaved: false, collectionId: null });
    }

    const savedData = savedSnap.docs[0].data();

    return _successResponse({
      isSaved: true,
      collectionId: savedData.collectionId
    });
  } catch (error) {
    console.error('❌ Check if saved error:', error);

    if (error.code && error.message) {
      // Validation error
      return _errorResponse(error.code, error.message);
    }

    return _errorResponse(
      'collection/check-failed',
      `Failed to check if recipe is saved: ${error.message}`
    );
  }
};

/**
 * Get which collection a recipe is saved to
 * Alias for checkIfSaved for API clarity
 *
 * @param {string} recipeId - Recipe document ID
 * @param {string} userId - Firebase Auth UID
 * @returns {Promise<{success: boolean, data: {collectionId: string | null} | null, error: object | null}>}
 */
const getRecipeCollection = async (recipeId, userId) => {
  const result = await checkIfSaved(recipeId, userId);

  if (!result.success) {
    return result;
  }

  return _successResponse({
    collectionId: result.data.collectionId
  });
};

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // Collections CRUD
  createCollection,
  updateCollection,
  deleteCollection,
  getUserCollections,

  // Collection-Recipe Relationship
  saveRecipeToCollection,
  removeRecipeFromCollection,
  getCollectionRecipes,
  checkIfSaved,
  getRecipeCollection,
};
