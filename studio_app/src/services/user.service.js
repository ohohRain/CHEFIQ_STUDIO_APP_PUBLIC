import {
  doc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { getUserProfile } from './authService';

/**
 * User Service
 * Handles user profile and recipe queries
 * Schema aligned with database_design.md v3.0
 */

/**
 * Get user's recipes filtered by status
 * @param {string} userId - User ID to query recipes for
 * @param {Object} options - Query options
 * @param {string|null} options.status - Filter by status: 'published', 'draft', or null for all
 * @param {number} options.limit - Maximum number of recipes to return (default: 50)
 * @returns {Promise<Array>} Array of recipe objects
 */
export const getUserRecipes = async (userId, options = {}) => {
  try {
    const { status = null, limit: maxResults = 50 } = options;

    let recipesQuery;

    if (status === 'published') {
      // Published tab: Query published recipes ordered by publishedAt
      // Uses index: (authorId, status, publishedAt DESC)
      recipesQuery = query(
        collection(db, 'recipes'),
        where('authorId', '==', userId),
        where('status', '==', 'published'),
        orderBy('publishedAt', 'desc'),
        limit(maxResults)
      );
    } else if (status === 'draft') {
      // Drafts tab: Query draft recipes ordered by updatedAt
      // Uses index: (authorId, status, updatedAt DESC)
      recipesQuery = query(
        collection(db, 'recipes'),
        where('authorId', '==', userId),
        where('status', '==', 'draft'),
        orderBy('updatedAt', 'desc'),
        limit(maxResults)
      );
    } else {
      // All tab: Query all recipes ordered by updatedAt
      // Uses index: (authorId, updatedAt DESC)
      recipesQuery = query(
        collection(db, 'recipes'),
        where('authorId', '==', userId),
        orderBy('updatedAt', 'desc'),
        limit(maxResults)
      );
    }

    const snapshot = await getDocs(recipesQuery);

    if (snapshot.empty) {
      console.log(`[UserService] No recipes found for user ${userId} with status: ${status || 'all'}`);
      return [];
    }

    // Map Firestore documents to recipe objects
    const recipes = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        recipeId: doc.id,
        title: data.title,
        description: data.description,
        coverImage: data.coverImage,
        imageSource: data.coverImage ? { uri: data.coverImage } : null,
        difficulty: data.difficulty,
        cookingTime: data.cookingTime,
        cuisine: data.cuisine,
        equipment: data.equipment || [],
        ingredients: data.ingredients || [],
        steps: data.steps || [],
        status: data.status,
        authorId: data.authorId,
        authorUsername: data.authorUsername,
        authorAvatar: data.authorAvatar,
        // Stats
        likeCount: data.stats?.likesCount || 0,
        commentCount: data.stats?.commentsCount || 0,
        viewsCount: data.stats?.viewsCount || 0,
        savesCount: data.stats?.savesCount || 0,
        // Timestamps
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        publishedAt: data.publishedAt,
        // Additional UI fields
        aspectRatio: 1.0, // Default aspect ratio for masonry layout
      };
    });

    console.log(`[UserService] Retrieved ${recipes.length} recipes for user ${userId} with status: ${status || 'all'}`);
    return recipes;
  } catch (error) {
    console.error('[UserService] Error getting user recipes:', error);
    throw new Error(`Failed to retrieve recipes: ${error.message}`);
  }
};

/**
 * Get published recipes for a user (convenience function)
 * @param {string} userId - User ID
 * @param {number} maxResults - Maximum number of recipes (default: 50)
 * @returns {Promise<Array>} Array of published recipes
 */
export const getPublishedRecipes = async (userId, maxResults = 50) => {
  return getUserRecipes(userId, { status: 'published', limit: maxResults });
};

/**
 * Get draft recipes for a user (convenience function)
 * @param {string} userId - User ID
 * @param {number} maxResults - Maximum number of recipes (default: 50)
 * @returns {Promise<Array>} Array of draft recipes
 */
export const getDraftRecipes = async (userId, maxResults = 50) => {
  return getUserRecipes(userId, { status: 'draft', limit: maxResults });
};

/**
 * Get all recipes for a user (convenience function)
 * @param {string} userId - User ID
 * @param {number} maxResults - Maximum number of recipes (default: 50)
 * @returns {Promise<Array>} Array of all recipes (published + drafts)
 */
export const getAllRecipes = async (userId, maxResults = 50) => {
  return getUserRecipes(userId, { status: null, limit: maxResults });
};

/**
 * Update user profile information
 * @param {string} userId - User ID
 * @param {Object} updates - Fields to update
 * @param {string} [updates.username] - Display name
 * @param {string} [updates.bio] - Bio text
 * @param {string[]} [updates.tags] - Profile tags (e.g., ["🍳 Chinese Cuisine", "📍 NYC"])
 * @param {string} [updates.avatar] - Avatar URL
 * @returns {Promise<void>}
 */
export const updateUserProfile = async (userId, updates) => {
  try {
    if (!userId) {
      throw new Error('User ID is required');
    }

    if (!updates || Object.keys(updates).length === 0) {
      throw new Error('No updates provided');
    }

    // Prevent updating protected fields
    const allowedFields = ['username', 'bio', 'tags', 'avatar'];
    const filteredUpdates = {};

    Object.keys(updates).forEach((key) => {
      if (allowedFields.includes(key)) {
        filteredUpdates[key] = updates[key];
      } else {
        console.warn(`[UserService] Attempted to update protected field: ${key}`);
      }
    });

    if (Object.keys(filteredUpdates).length === 0) {
      throw new Error('No valid fields to update');
    }

    // Add updatedAt timestamp
    filteredUpdates.updatedAt = serverTimestamp();

    const userDocRef = doc(db, 'users', userId);
    await updateDoc(userDocRef, filteredUpdates);

    console.log('[UserService] User profile updated successfully:', userId);
  } catch (error) {
    console.error('[UserService] Error updating user profile:', error);
    throw new Error(`Failed to update profile: ${error.message}`);
  }
};

/**
 * Get user profile (re-exported from authService for convenience)
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User profile data
 */
export const getProfile = getUserProfile;

/**
 * Calculate formatted stats for display
 * @param {Object} stats - User stats object from Firestore
 * @returns {Object} Formatted stats for UI display
 */
export const formatUserStats = (stats) => {
  if (!stats) {
    return {
      recipes: 0,
      likes: 0,
      views: 0,
      followers: 0,
      following: 0,
    };
  }

  return {
    recipes: stats.recipesCount || 0,
    likes: stats.likesReceived || 0,
    views: stats.viewsReceived || 0,
    followers: stats.followersCount || 0,
    following: stats.followingCount || 0,
  };
};
