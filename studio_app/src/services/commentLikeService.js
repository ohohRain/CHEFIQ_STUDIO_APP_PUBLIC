/**
 * Comment Like Service
 * Handles comment like/unlike operations with Firestore
 *
 * Phase 12: Comment System
 * Collection: comment_likes/{userId}_{commentId}
 * Stats updates handled by Cloud Functions (onCommentLikeCreate, onCommentLikeDelete)
 *
 * Architecture: Mirrors likeService.js exactly for consistency
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
 * Generate composite like ID: {userId}_{commentId}
 * @private
 */
const _generateLikeId = (userId, commentId) => {
  return `${userId}_${commentId}`;
};

/**
 * Validate comment like operation parameters
 * @private
 */
const _validateLikeParams = (userId, commentId) => {
  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    throw {
      code: 'comment-like/invalid-user-id',
      message: 'Valid user ID is required',
    };
  }

  if (!commentId || typeof commentId !== 'string' || commentId.trim() === '') {
    throw {
      code: 'comment-like/invalid-comment-id',
      message: 'Valid comment ID is required',
    };
  }
};

// ============================================================================
// MAIN SERVICE METHODS
// ============================================================================

/**
 * Like a comment
 * Creates a like document in Firestore
 * Cloud Function (onCommentLikeCreate) will automatically update comment.stats.likesCount
 *
 * @param {string} userId - Firebase Auth UID of user liking the comment
 * @param {string} commentId - Comment document ID
 * @returns {Promise<{success: boolean, data: {likeId: string} | null, error: object | null}>}
 */
const likeComment = async (userId, commentId) => {
  try {
    // Validate parameters
    _validateLikeParams(userId, commentId);

    // Generate composite key
    const likeId = _generateLikeId(userId, commentId);

    // Check if already liked
    const likeRef = doc(db, 'comment_likes', likeId);
    const likeSnap = await getDoc(likeRef);

    if (likeSnap.exists()) {
      console.log(`⏭️ Comment already liked: ${commentId}`);
      return _successResponse({ likeId, alreadyLiked: true });
    }

    // Create like document
    const likeData = {
      likeId,
      userId,
      commentId,
      createdAt: Timestamp.now(),
    };

    await setDoc(likeRef, likeData);

    console.log(`✅ Comment liked: ${commentId} by ${userId}`);

    return _successResponse({ likeId, alreadyLiked: false });
  } catch (error) {
    console.error('❌ Like comment error:', error);

    if (error.code && error.message) {
      // Validation error
      return _errorResponse(error.code, error.message);
    }

    // Firestore error
    if (error.code === 'permission-denied') {
      return _errorResponse(
        'comment-like/permission-denied',
        'You do not have permission to like this comment'
      );
    }

    return _errorResponse(
      'comment-like/operation-failed',
      `Failed to like comment: ${error.message}`
    );
  }
};

/**
 * Unlike a comment
 * Deletes the like document from Firestore
 * Cloud Function (onCommentLikeDelete) will automatically update comment.stats.likesCount
 *
 * @param {string} userId - Firebase Auth UID of user unliking the comment
 * @param {string} commentId - Comment document ID
 * @returns {Promise<{success: boolean, data: {deleted: boolean} | null, error: object | null}>}
 */
const unlikeComment = async (userId, commentId) => {
  try {
    // Validate parameters
    _validateLikeParams(userId, commentId);

    // Generate composite key
    const likeId = _generateLikeId(userId, commentId);

    // Check if like exists
    const likeRef = doc(db, 'comment_likes', likeId);
    const likeSnap = await getDoc(likeRef);

    if (!likeSnap.exists()) {
      console.log(`⏭️ Comment not liked, nothing to unlike: ${commentId}`);
      return _successResponse({ deleted: false, notLiked: true });
    }

    // Delete like document
    await deleteDoc(likeRef);

    console.log(`✅ Comment unliked: ${commentId} by ${userId}`);

    return _successResponse({ deleted: true, notLiked: false });
  } catch (error) {
    console.error('❌ Unlike comment error:', error);

    if (error.code && error.message) {
      // Validation error
      return _errorResponse(error.code, error.message);
    }

    // Firestore error
    if (error.code === 'permission-denied') {
      return _errorResponse(
        'comment-like/permission-denied',
        'You do not have permission to unlike this comment'
      );
    }

    return _errorResponse(
      'comment-like/operation-failed',
      `Failed to unlike comment: ${error.message}`
    );
  }
};

/**
 * Check if user has liked a comment
 *
 * @param {string} userId - Firebase Auth UID
 * @param {string} commentId - Comment document ID
 * @returns {Promise<{success: boolean, data: {isLiked: boolean} | null, error: object | null}>}
 */
const checkCommentLiked = async (userId, commentId) => {
  try {
    // Validate parameters
    _validateLikeParams(userId, commentId);

    // Generate composite key
    const likeId = _generateLikeId(userId, commentId);

    // Check if like document exists
    const likeRef = doc(db, 'comment_likes', likeId);
    const likeSnap = await getDoc(likeRef);

    const isLiked = likeSnap.exists();

    return _successResponse({ isLiked });
  } catch (error) {
    console.error('❌ Check comment liked error:', error);

    if (error.code && error.message) {
      // Validation error
      return _errorResponse(error.code, error.message);
    }

    return _errorResponse(
      'comment-like/check-failed',
      `Failed to check like status: ${error.message}`
    );
  }
};

/**
 * Get comments a user has liked
 * Used for profile or analytics features
 *
 * @param {string} userId - Firebase Auth UID
 * @param {number} limit - Maximum number of likes to fetch (default: 100)
 * @returns {Promise<{success: boolean, data: {likes: Array} | null, error: object | null}>}
 */
const getUserCommentLikes = async (userId, limit = 100) => {
  try {
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      throw {
        code: 'comment-like/invalid-user-id',
        message: 'Valid user ID is required',
      };
    }

    // Query likes by userId, ordered by most recent
    const likesQuery = query(
      collection(db, 'comment_likes'),
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
        commentId: data.commentId,
        createdAt: data.createdAt,
      };
    });

    console.log(`✅ Fetched ${likes.length} comment likes for user ${userId}`);

    return _successResponse({ likes, count: likes.length });
  } catch (error) {
    console.error('❌ Get user comment likes error:', error);

    if (error.code && error.message) {
      // Validation error
      return _errorResponse(error.code, error.message);
    }

    return _errorResponse(
      'comment-like/fetch-failed',
      `Failed to fetch user comment likes: ${error.message}`
    );
  }
};

/**
 * Get comment like count
 * Typically stats.likesCount from comment document is used,
 * but this can be used for verification or when comment document is unavailable
 *
 * @param {string} commentId - Comment document ID
 * @returns {Promise<{success: boolean, data: {count: number} | null, error: object | null}>}
 */
const getCommentLikeCount = async (commentId) => {
  try {
    if (!commentId || typeof commentId !== 'string' || commentId.trim() === '') {
      throw {
        code: 'comment-like/invalid-comment-id',
        message: 'Valid comment ID is required',
      };
    }

    // Query likes by commentId
    const likesQuery = query(
      collection(db, 'comment_likes'),
      where('commentId', '==', commentId)
    );

    const likesSnapshot = await getDocs(likesQuery);
    const count = likesSnapshot.size;

    console.log(`✅ Comment ${commentId} has ${count} likes`);

    return _successResponse({ count });
  } catch (error) {
    console.error('❌ Get comment like count error:', error);

    if (error.code && error.message) {
      // Validation error
      return _errorResponse(error.code, error.message);
    }

    return _errorResponse(
      'comment-like/fetch-failed',
      `Failed to fetch comment like count: ${error.message}`
    );
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  likeComment,
  unlikeComment,
  checkCommentLiked,
  getUserCommentLikes,
  getCommentLikeCount,
};
