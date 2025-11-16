/**
 * View Service
 * Handles recipe view tracking operations
 *
 * Phase 7: View Tracking System (Simplified - Direct Pageview Counting)
 * Direct increment: recipes/{recipeId}/stats.viewsCount
 * No views collection needed - simple pageview counter
 */

import {
  doc,
  updateDoc,
  increment,
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

// ============================================================================
// VIEW TRACKING METHODS
// ============================================================================

/**
 * Track a recipe view (Pageview Counter)
 * Directly increments stats.viewsCount in recipe document
 *
 * Author views are NOT tracked (filtered client-side)
 * No deduplication: Each page load = +1 view (simple pageview counter)
 *
 * @param {string} userId - Firebase Auth UID of viewer
 * @param {string} recipeId - Recipe ID being viewed
 * @param {string} authorId - Recipe author ID (to exclude author views)
 * @returns {Promise<{success: boolean, data: object | null, error: object | null}>}
 */
const trackView = async (userId, recipeId, authorId) => {
  try {
    // Validation
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      throw {
        code: 'view/invalid-user-id',
        message: 'Valid user ID is required',
      };
    }

    if (!recipeId || typeof recipeId !== 'string' || recipeId.trim() === '') {
      throw {
        code: 'view/invalid-recipe-id',
        message: 'Valid recipe ID is required',
      };
    }

    // Don't track author's own views (client-side check)
    if (authorId && userId === authorId) {
      console.log('⏭️ Skipping view count (author viewing own recipe)');
      return _successResponse({
        counted: false,
        reason: 'author_view',
        recipeId,
      });
    }

    // Direct increment of stats.viewsCount
    const recipeRef = doc(db, 'recipes', recipeId);

    console.log(`🔍 [viewService] Incrementing viewsCount for recipe: ${recipeId}`);

    await updateDoc(recipeRef, {
      'stats.viewsCount': increment(1),
    });

    console.log(`✅ View tracked (pageview): ${recipeId}`);

    return _successResponse({
      counted: true,
      recipeId,
    });
  } catch (error) {
    console.error('❌ Track view error:', error);

    // Handle validation errors
    if (error.code && error.message) {
      return _errorResponse(error.code, error.message);
    }

    // Handle Firebase errors
    if (error.code === 'permission-denied') {
      return _errorResponse(
        'view/permission-denied',
        'You do not have permission to increment view count'
      );
    }

    return _errorResponse(
      'view/tracking-failed',
      `Failed to track view: ${error.message}`
    );
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  trackView,
};
