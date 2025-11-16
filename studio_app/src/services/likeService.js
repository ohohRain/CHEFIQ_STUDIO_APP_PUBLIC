/**
 * Like Service
 * Handles recipe like/unlike operations with Firestore
 *
 * Phase 8: Like System
 * Collection: likes/{userId}_{recipeId}
 * Stats updates handled by Cloud Functions (onLikeCreate, onLikeDelete)
 *
 * Phase 8.5: Optimistic UI Tracking
 * Integrates with PendingLikesManager for cross-screen consistency
 */

import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import pendingLikesManager from './pendingLikesManager';

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
 * Generate composite like ID: {userId}_{recipeId}
 * @private
 */
const _generateLikeId = (userId, recipeId) => {
  return `${userId}_${recipeId}`;
};

/**
 * Validate like operation parameters
 * @private
 */
const _validateLikeParams = (userId, recipeId) => {
  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    throw {
      code: 'like/invalid-user-id',
      message: 'Valid user ID is required',
    };
  }

  if (!recipeId || typeof recipeId !== 'string' || recipeId.trim() === '') {
    throw {
      code: 'like/invalid-recipe-id',
      message: 'Valid recipe ID is required',
    };
  }
};

// ============================================================================
// MAIN SERVICE METHODS
// ============================================================================

/**
 * Like a recipe
 * Creates a like document in Firestore
 * Cloud Function (onLikeCreate) will automatically update recipe.stats.likesCount
 *
 * @param {string} userId - Firebase Auth UID of user liking the recipe
 * @param {string} recipeId - Recipe document ID
 * @returns {Promise<{success: boolean, data: {likeId: string} | null, error: object | null}>}
 */
const likeRecipe = async (userId, recipeId) => {
  try {
    // Validate parameters
    _validateLikeParams(userId, recipeId);

    // Generate composite key
    const likeId = _generateLikeId(userId, recipeId);

    // Check if already liked
    const likeRef = doc(db, 'likes', likeId);
    const likeSnap = await getDoc(likeRef);

    if (likeSnap.exists()) {
      console.log(`⏭️ Recipe already liked: ${recipeId}`);
      // Still record as pending in case UI state was lost
      await pendingLikesManager.addPending(userId, recipeId, 'like');
      return _successResponse({ likeId, alreadyLiked: true });
    }

    // 🎯 OPTIMISTIC TRACKING: Record pending operation BEFORE Firestore write
    await pendingLikesManager.addPending(userId, recipeId, 'like');

    // Create like document
    const likeData = {
      likeId,
      userId,
      recipeId,
      createdAt: Timestamp.now(),
    };

    await setDoc(likeRef, likeData);

    console.log(`✅ Recipe liked: ${recipeId} by ${userId}`);

    // 🧹 CLEANUP: Clear pending operation after Cloud Function likely completed
    // Use setTimeout to give Cloud Function time to process (~2s delay)
    setTimeout(async () => {
      await pendingLikesManager.removePending(recipeId);
      console.log(`🧹 Cleared pending like for recipe ${recipeId}`);
    }, 2000);

    return _successResponse({ likeId, alreadyLiked: false });
  } catch (error) {
    console.error('❌ Like recipe error:', error);

    // 🔄 ROLLBACK: Remove pending operation on error
    await pendingLikesManager.removePending(recipeId);

    if (error.code && error.message) {
      // Validation error
      return _errorResponse(error.code, error.message);
    }

    // Firestore error
    if (error.code === 'permission-denied') {
      return _errorResponse(
        'like/permission-denied',
        'You do not have permission to like this recipe'
      );
    }

    return _errorResponse(
      'like/operation-failed',
      `Failed to like recipe: ${error.message}`
    );
  }
};

/**
 * Unlike a recipe
 * Deletes the like document from Firestore
 * Cloud Function (onLikeDelete) will automatically update recipe.stats.likesCount
 *
 * @param {string} userId - Firebase Auth UID of user unliking the recipe
 * @param {string} recipeId - Recipe document ID
 * @returns {Promise<{success: boolean, data: {deleted: boolean} | null, error: object | null}>}
 */
const unlikeRecipe = async (userId, recipeId) => {
  try {
    // Validate parameters
    _validateLikeParams(userId, recipeId);

    // Generate composite key
    const likeId = _generateLikeId(userId, recipeId);

    // Check if like exists
    const likeRef = doc(db, 'likes', likeId);
    const likeSnap = await getDoc(likeRef);

    if (!likeSnap.exists()) {
      console.log(`⏭️ Recipe not liked, nothing to unlike: ${recipeId}`);
      // Still record as pending in case UI state was lost
      await pendingLikesManager.addPending(userId, recipeId, 'unlike');
      return _successResponse({ deleted: false, notLiked: true });
    }

    // 🎯 OPTIMISTIC TRACKING: Record pending operation BEFORE Firestore delete
    await pendingLikesManager.addPending(userId, recipeId, 'unlike');

    // Delete like document
    await deleteDoc(likeRef);

    console.log(`✅ Recipe unliked: ${recipeId} by ${userId}`);

    // 🧹 CLEANUP: Clear pending operation after Cloud Function likely completed
    // Use setTimeout to give Cloud Function time to process (~2s delay)
    setTimeout(async () => {
      await pendingLikesManager.removePending(recipeId);
      console.log(`🧹 Cleared pending unlike for recipe ${recipeId}`);
    }, 2000);

    return _successResponse({ deleted: true, notLiked: false });
  } catch (error) {
    console.error('❌ Unlike recipe error:', error);

    // 🔄 ROLLBACK: Remove pending operation on error
    await pendingLikesManager.removePending(recipeId);

    if (error.code && error.message) {
      // Validation error
      return _errorResponse(error.code, error.message);
    }

    // Firestore error
    if (error.code === 'permission-denied') {
      return _errorResponse(
        'like/permission-denied',
        'You do not have permission to unlike this recipe'
      );
    }

    return _errorResponse(
      'like/operation-failed',
      `Failed to unlike recipe: ${error.message}`
    );
  }
};

/**
 * Check if user has liked a recipe
 *
 * @param {string} userId - Firebase Auth UID
 * @param {string} recipeId - Recipe document ID
 * @returns {Promise<{success: boolean, data: {isLiked: boolean} | null, error: object | null}>}
 */
const checkIfLiked = async (userId, recipeId) => {
  try {
    // Validate parameters
    _validateLikeParams(userId, recipeId);

    // Generate composite key
    const likeId = _generateLikeId(userId, recipeId);

    // Check if like document exists
    const likeRef = doc(db, 'likes', likeId);
    const likeSnap = await getDoc(likeRef);

    const isLiked = likeSnap.exists();

    return _successResponse({ isLiked });
  } catch (error) {
    console.error('❌ Check if liked error:', error);

    if (error.code && error.message) {
      // Validation error
      return _errorResponse(error.code, error.message);
    }

    return _errorResponse(
      'like/check-failed',
      `Failed to check like status: ${error.message}`
    );
  }
};

/**
 * Get recipes a user has liked
 * Used for HomeScreen to show liked recipes
 *
 * @param {string} userId - Firebase Auth UID
 * @param {number} limit - Maximum number of likes to fetch (default: 100)
 * @returns {Promise<{success: boolean, data: {likes: Array} | null, error: object | null}>}
 */
const getUserLikes = async (userId, limit = 100) => {
  try {
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      throw {
        code: 'like/invalid-user-id',
        message: 'Valid user ID is required',
      };
    }

    // Query likes by userId, ordered by most recent
    const likesQuery = query(
      collection(db, 'likes'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      firestoreLimit(limit)
    );

    const likesSnapshot = await getDocs(likesQuery);

    const likes = likesSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        likeId: data.likeId,
        userId: data.userId,
        recipeId: data.recipeId,
        createdAt: data.createdAt,
      };
    });

    console.log(`✅ Fetched ${likes.length} likes for user ${userId}`);

    return _successResponse({ likes, count: likes.length });
  } catch (error) {
    console.error('❌ Get user likes error:', error);

    if (error.code && error.message) {
      // Validation error
      return _errorResponse(error.code, error.message);
    }

    return _errorResponse(
      'like/fetch-failed',
      `Failed to fetch user likes: ${error.message}`
    );
  }
};

/**
 * Get users who liked a recipe
 * Used for showing who liked a recipe (future feature)
 *
 * @param {string} recipeId - Recipe document ID
 * @param {number} limit - Maximum number of likes to fetch (default: 20)
 * @returns {Promise<{success: boolean, data: {likes: Array} | null, error: object | null}>}
 */
const getRecipeLikes = async (recipeId, limit = 20) => {
  try {
    if (!recipeId || typeof recipeId !== 'string' || recipeId.trim() === '') {
      throw {
        code: 'like/invalid-recipe-id',
        message: 'Valid recipe ID is required',
      };
    }

    // Query likes by recipeId, ordered by most recent
    const likesQuery = query(
      collection(db, 'likes'),
      where('recipeId', '==', recipeId),
      orderBy('createdAt', 'desc'),
      firestoreLimit(limit)
    );

    const likesSnapshot = await getDocs(likesQuery);

    const likes = likesSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        likeId: data.likeId,
        userId: data.userId,
        recipeId: data.recipeId,
        createdAt: data.createdAt,
      };
    });

    console.log(`✅ Fetched ${likes.length} likes for recipe ${recipeId}`);

    return _successResponse({ likes, count: likes.length });
  } catch (error) {
    console.error('❌ Get recipe likes error:', error);

    if (error.code && error.message) {
      // Validation error
      return _errorResponse(error.code, error.message);
    }

    return _errorResponse(
      'like/fetch-failed',
      `Failed to fetch recipe likes: ${error.message}`
    );
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  likeRecipe,
  unlikeRecipe,
  checkIfLiked,
  getUserLikes,
  getRecipeLikes,
};
