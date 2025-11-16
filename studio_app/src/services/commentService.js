/**
 * Comment Service
 * Handles comment CRUD operations with Firestore
 *
 * Phase 12: Comment System
 * Collection: comments/{commentId}
 * Stats updates handled by Cloud Functions (onCommentCreate, onCommentDelete)
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
  addDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_COMMENT_LENGTH = 1000;

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
 * Validate comment content
 * @private
 */
const _validateContent = (content) => {
  if (!content || typeof content !== 'string' || content.trim() === '') {
    throw {
      code: 'comment/invalid-content',
      message: 'Comment content cannot be empty',
    };
  }

  if (content.length > MAX_COMMENT_LENGTH) {
    throw {
      code: 'comment/content-too-long',
      message: `Comment must be less than ${MAX_COMMENT_LENGTH} characters`,
    };
  }
};

/**
 * Validate comment parameters
 * @private
 */
const _validateCommentParams = (recipeId, content) => {
  if (!recipeId || typeof recipeId !== 'string' || recipeId.trim() === '') {
    throw {
      code: 'comment/invalid-recipe-id',
      message: 'Valid recipe ID is required',
    };
  }

  _validateContent(content);
};

// ============================================================================
// MAIN SERVICE METHODS
// ============================================================================

/**
 * Get comments for a recipe (flat structure, no nested replies)
 *
 * @param {string} recipeId - Recipe document ID
 * @param {number} limit - Maximum number of comments to fetch (default: 20)
 * @returns {Promise<{success: boolean, data: {comments: Array} | null, error: object | null}>}
 */
const getComments = async (recipeId, limit = 20) => {
  try {
    if (!recipeId || typeof recipeId !== 'string' || recipeId.trim() === '') {
      throw {
        code: 'comment/invalid-recipe-id',
        message: 'Valid recipe ID is required',
      };
    }

    // Query all comments for recipe (flat structure)
    const commentsQuery = query(
      collection(db, 'comments'),
      where('recipeId', '==', recipeId),
      orderBy('createdAt', 'desc'),
      firestoreLimit(limit)
    );

    const commentsSnapshot = await getDocs(commentsQuery);

    const comments = commentsSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        commentId: doc.id,
        recipeId: data.recipeId,
        authorId: data.authorId,
        authorUsername: data.authorUsername,
        authorAvatar: data.authorAvatar,
        content: data.content,
        stats: data.stats || { likesCount: 0 },
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
    });

    console.log(`✅ Fetched ${comments.length} comments for recipe ${recipeId}`);

    return _successResponse({ comments, count: comments.length });
  } catch (error) {
    console.error('❌ Get comments error:', error);

    if (error.code && error.message) {
      return _errorResponse(error.code, error.message);
    }

    return _errorResponse(
      'comment/fetch-failed',
      `Failed to fetch comments: ${error.message}`
    );
  }
};

/**
 * Create a comment on a recipe
 * Cloud Function (onCommentCreate) will automatically:
 * - Increment recipe.stats.commentsCount
 * - Create notification for recipe author
 *
 * @param {string} recipeId - Recipe document ID
 * @param {string} content - Comment text (max 1000 chars)
 * @param {object} userProfile - Current user profile {userId, username, avatar}
 * @returns {Promise<{success: boolean, data: {commentId: string} | null, error: object | null}>}
 */
const createComment = async (recipeId, content, userProfile) => {
  try {
    // Validate parameters
    _validateCommentParams(recipeId, content);

    if (!userProfile || !userProfile.userId) {
      throw {
        code: 'comment/invalid-user',
        message: 'User profile is required to create comment',
      };
    }

    // Create comment document with denormalized author info
    const commentData = {
      recipeId,
      authorId: userProfile.userId,
      authorUsername: userProfile.username || 'Anonymous',
      authorAvatar: userProfile.avatar || null,
      content: content.trim(),
      stats: {
        likesCount: 0,
      },
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const commentRef = await addDoc(collection(db, 'comments'), commentData);

    console.log(`✅ Comment created: ${commentRef.id} on recipe ${recipeId}`);

    return _successResponse({ commentId: commentRef.id });
  } catch (error) {
    console.error('❌ Create comment error:', error);

    if (error.code && error.message) {
      return _errorResponse(error.code, error.message);
    }

    if (error.code === 'permission-denied') {
      return _errorResponse(
        'comment/permission-denied',
        'You do not have permission to create comments'
      );
    }

    return _errorResponse(
      'comment/operation-failed',
      `Failed to create comment: ${error.message}`
    );
  }
};

/**
 * Delete a comment (owner only)
 * Cloud Function (onCommentDelete) will automatically:
 * - Decrement recipe.stats.commentsCount
 * - Delete all likes for this comment
 *
 * @param {string} commentId - Comment document ID
 * @param {string} userId - Current user ID (for ownership validation)
 * @returns {Promise<{success: boolean, data: {deleted: boolean} | null, error: object | null}>}
 */
const deleteComment = async (commentId, userId) => {
  try {
    if (!commentId || typeof commentId !== 'string' || commentId.trim() === '') {
      throw {
        code: 'comment/invalid-comment-id',
        message: 'Valid comment ID is required',
      };
    }

    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      throw {
        code: 'comment/invalid-user-id',
        message: 'Valid user ID is required',
      };
    }

    // Get comment to verify ownership
    const commentRef = doc(db, 'comments', commentId);
    const commentSnap = await getDoc(commentRef);

    if (!commentSnap.exists()) {
      throw {
        code: 'comment/not-found',
        message: 'Comment does not exist',
      };
    }

    const commentData = commentSnap.data();

    // Verify ownership
    if (commentData.authorId !== userId) {
      throw {
        code: 'comment/permission-denied',
        message: 'You can only delete your own comments',
      };
    }

    // Delete comment
    await deleteDoc(commentRef);

    console.log(`✅ Comment deleted: ${commentId} by user ${userId}`);

    return _successResponse({ deleted: true });
  } catch (error) {
    console.error('❌ Delete comment error:', error);

    if (error.code && error.message) {
      return _errorResponse(error.code, error.message);
    }

    if (error.code === 'permission-denied') {
      return _errorResponse(
        'comment/permission-denied',
        'You do not have permission to delete this comment'
      );
    }

    return _errorResponse(
      'comment/operation-failed',
      `Failed to delete comment: ${error.message}`
    );
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  getComments,
  createComment,
  deleteComment,
  MAX_COMMENT_LENGTH,
};
