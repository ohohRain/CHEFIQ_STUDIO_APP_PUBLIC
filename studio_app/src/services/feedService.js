/**
 * Feed Service
 * Handles recipe feed queries for HomeScreen (Following/All/Trending tabs)
 *
 * Phase 10: Home Feed System
 * Collections: recipes (published), follows (for Following feed)
 * Supports cursor-based pagination
 */

import {
  collection,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  getDocs,
  startAfter,
  doc,
  getDoc,
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
 * Generate varied aspect ratios for Pinterest masonry layout
 * Uses deterministic randomness based on recipe ID for consistency
 * @private
 */
const _generateAspectRatio = (recipeId) => {
  // Use recipe ID as seed for deterministic randomness
  let hash = 0;
  for (let i = 0; i < recipeId.length; i++) {
    hash = ((hash << 5) - hash) + recipeId.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Generate pseudo-random number between 0 and 1
  const random = Math.abs(Math.sin(hash)) % 1;

  // Common photo aspect ratios for food photography
  const aspectRatios = [
    0.75,  // 3:4 portrait (tall)
    1.0,   // 1:1 square
    1.0,   // 1:1 square (more common)
    1.33,  // 4:3 landscape (wide)
    0.8,   // Slightly tall
    1.2,   // Slightly wide
  ];

  // Pick aspect ratio based on pseudo-random value
  const index = Math.floor(random * aspectRatios.length);
  return aspectRatios[index];
};

/**
 * Convert Firestore recipe document to app recipe object
 * Maps Firestore field names to app field names for compatibility
 * @private
 */
const _mapRecipeDocument = (doc) => {
  const data = doc.data();

  return {
    // Core recipe fields
    id: data.recipeId,
    recipeId: data.recipeId,
    title: data.title,
    description: data.description || '',

    // Author info (denormalized in recipe document)
    authorId: data.authorId,
    username: data.authorUsername || 'unknown',
    author: {
      userId: data.authorId,
      username: data.authorUsername || 'unknown',
      avatar: data.authorAvatar || null,
    },

    // Stats (from Firestore stats object)
    likeCount: data.stats?.likesCount || 0,
    commentCount: data.stats?.commentsCount || 0,
    viewCount: data.stats?.viewsCount || 0,
    saveCount: data.stats?.savesCount || 0,

    // Images
    coverImage: data.coverImage || null,
    imageSource: data.coverImage ? { uri: data.coverImage } : null,

    // Recipe details
    difficulty: data.difficulty || 'Medium',
    cookingTime: data.cookingTime || 0,
    servings: data.servings || 4,
    cuisine: data.cuisine || '',
    equipment: data.equipment || [],

    // Content
    ingredients: data.ingredients || [],
    steps: data.steps || [],

    // Metadata
    status: data.status,
    trendingScore: data.trendingScore || 0,
    createdAt: data.createdAt,
    publishedAt: data.publishedAt || data.createdAt,
    updatedAt: data.updatedAt,

    // For masonry layout (varied aspect ratios for visual interest)
    aspectRatio: _generateAspectRatio(data.recipeId),
  };
};

/**
 * Split array into chunks of specified size
 * @private
 */
const _chunkArray = (array, chunkSize) => {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
};

// ============================================================================
// FEED QUERY METHODS
// ============================================================================

/**
 * Get "All" feed: All published recipes sorted by newest first
 * Uses publishedAt for ordering (matches Firestore index)
 *
 * @param {number} limit - Number of recipes to fetch (default: 20)
 * @param {object} lastVisible - Last document snapshot for pagination (optional)
 * @returns {Promise<{success: boolean, data: {recipes: Array, lastVisible: object | null, hasMore: boolean} | null, error: object | null}>}
 */
const getAllRecipesFeed = async (limit = 20, lastVisible = null) => {
  try {
    console.log(`🔍 [getAllRecipesFeed] Fetching ${limit} recipes, pagination: ${lastVisible ? 'yes' : 'no'}`);

    // Build query: published recipes ordered by publishedAt DESC
    let feedQuery = query(
      collection(db, 'recipes'),
      where('status', '==', 'published'),
      orderBy('publishedAt', 'desc'),
      firestoreLimit(limit + 1) // Fetch one extra to check if there are more
    );

    // Add pagination cursor if provided
    if (lastVisible) {
      feedQuery = query(feedQuery, startAfter(lastVisible));
    }

    // Execute query
    const querySnapshot = await getDocs(feedQuery);

    // Check if there are more results
    const hasMore = querySnapshot.docs.length > limit;

    // Get actual results (exclude the extra one used for hasMore check)
    const docs = hasMore
      ? querySnapshot.docs.slice(0, limit)
      : querySnapshot.docs;

    // Convert to recipe objects
    const recipes = docs.map(_mapRecipeDocument);

    // Get last document for next pagination
    const newLastVisible = docs.length > 0 ? docs[docs.length - 1] : null;

    console.log(`✅ [getAllRecipesFeed] Fetched ${recipes.length} recipes, hasMore: ${hasMore}`);

    return _successResponse({
      recipes,
      count: recipes.length,
      lastVisible: newLastVisible,
      hasMore
    });
  } catch (error) {
    console.error('❌ [getAllRecipesFeed] Error:', error);

    if (error.code === 'permission-denied') {
      return _errorResponse(
        'feed/permission-denied',
        'You do not have permission to view recipes'
      );
    }

    return _errorResponse(
      'feed/fetch-failed',
      `Failed to fetch recipes: ${error.message}`
    );
  }
};

/**
 * Get "Trending" feed: Published recipes sorted by trendingScore
 * Trending score updated by Phase 11 Cloud Function (daily)
 *
 * @param {number} limit - Number of recipes to fetch (default: 20)
 * @param {object} lastVisible - Last document snapshot for pagination (optional)
 * @returns {Promise<{success: boolean, data: {recipes: Array, lastVisible: object | null, hasMore: boolean} | null, error: object | null}>}
 */
const getTrendingFeed = async (limit = 20, lastVisible = null) => {
  try {
    console.log(`🔍 [getTrendingFeed] Fetching ${limit} trending recipes, pagination: ${lastVisible ? 'yes' : 'no'}`);

    // Build query: published recipes ordered by trendingScore DESC
    let feedQuery = query(
      collection(db, 'recipes'),
      where('status', '==', 'published'),
      orderBy('trendingScore', 'desc'),
      firestoreLimit(limit + 1)
    );

    // Add pagination cursor if provided
    if (lastVisible) {
      feedQuery = query(feedQuery, startAfter(lastVisible));
    }

    // Execute query
    const querySnapshot = await getDocs(feedQuery);

    // Check if there are more results
    const hasMore = querySnapshot.docs.length > limit;

    // Get actual results
    const docs = hasMore
      ? querySnapshot.docs.slice(0, limit)
      : querySnapshot.docs;

    // Convert to recipe objects
    const recipes = docs.map(_mapRecipeDocument);

    // Get last document for next pagination
    const newLastVisible = docs.length > 0 ? docs[docs.length - 1] : null;

    // 📊 LOG TRENDING SCORES FOR DEBUGGING
    console.log(`✅ [getTrendingFeed] Fetched ${recipes.length} trending recipes, hasMore: ${hasMore}`);
    console.log('📊 [getTrendingFeed] Trending Scores Breakdown:');
    recipes.forEach((recipe, index) => {
      const daysSincePublished = recipe.publishedAt
        ? (Date.now() - recipe.publishedAt.toMillis()) / (1000 * 60 * 60 * 24)
        : 0;
      console.log(
        `  ${index + 1}. "${recipe.title}" | ` +
        `Score: ${recipe.trendingScore.toFixed(2)} | ` +
        `Likes: ${recipe.likeCount} | ` +
        `Comments: ${recipe.commentCount} | ` +
        `Views: ${recipe.viewCount} | ` +
        `Days old: ${daysSincePublished.toFixed(1)}`
      );
    });

    return _successResponse({
      recipes,
      count: recipes.length,
      lastVisible: newLastVisible,
      hasMore
    });
  } catch (error) {
    console.error('❌ [getTrendingFeed] Error:', error);

    if (error.code === 'permission-denied') {
      return _errorResponse(
        'feed/permission-denied',
        'You do not have permission to view trending recipes'
      );
    }

    return _errorResponse(
      'feed/fetch-failed',
      `Failed to fetch trending recipes: ${error.message}`
    );
  }
};

/**
 * Get "Following" feed: Recipes from users you follow, sorted by newest first
 * Uses batch queries with Firestore 'in' operator (max 10 authorIds per query)
 *
 * Strategy:
 * 1. Query follows collection for user's following list
 * 2. Split followingIds into chunks of 10 (Firestore 'in' operator limit)
 * 3. Execute parallel queries for each chunk
 * 4. Merge results and sort by publishedAt DESC
 * 5. Return paginated slice
 *
 * @param {string} userId - Firebase Auth UID of current user
 * @param {number} limit - Number of recipes to fetch (default: 20)
 * @param {number} offset - Offset for pagination (simplified pagination for Following feed)
 * @returns {Promise<{success: boolean, data: {recipes: Array, hasMore: boolean, offset: number} | null, error: object | null}>}
 */
const getFollowingFeed = async (userId, limit = 20, offset = 0) => {
  try {
    console.log(`🔍 [getFollowingFeed] Fetching ${limit} recipes for user ${userId}, offset: ${offset}`);

    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      throw {
        code: 'feed/invalid-user-id',
        message: 'Valid user ID is required',
      };
    }

    // STEP 1: Get user's following list from follows collection
    const followsQuery = query(
      collection(db, 'follows'),
      where('followerId', '==', userId),
      orderBy('createdAt', 'desc'),
      firestoreLimit(100) // Limit to first 100 following for performance
    );

    const followsSnapshot = await getDocs(followsQuery);

    // Extract followingIds (users that current user follows)
    const followingIds = followsSnapshot.docs.map(doc => doc.data().followingId);

    console.log(`📋 [getFollowingFeed] User follows ${followingIds.length} users`);

    // EDGE CASE: User follows nobody
    if (followingIds.length === 0) {
      console.log(`ℹ️ [getFollowingFeed] User follows nobody, returning empty feed`);
      return _successResponse({
        recipes: [],
        count: 0,
        hasMore: false,
        offset: 0,
        isEmpty: true,
        emptyReason: 'no_following'
      });
    }

    // STEP 2: Split followingIds into chunks of 10 (Firestore 'in' operator limit)
    const chunks = _chunkArray(followingIds, 10);
    console.log(`🔀 [getFollowingFeed] Split into ${chunks.length} chunks`);

    // STEP 3: Execute parallel queries for each chunk
    const queryPromises = chunks.map(chunk => {
      const chunkQuery = query(
        collection(db, 'recipes'),
        where('status', '==', 'published'),
        where('authorId', 'in', chunk),
        orderBy('publishedAt', 'desc'),
        firestoreLimit(50) // Fetch more from each chunk for better results
      );
      return getDocs(chunkQuery);
    });

    const queryResults = await Promise.all(queryPromises);

    // STEP 4: Merge all results into single array
    let allRecipes = [];
    queryResults.forEach(snapshot => {
      const chunkRecipes = snapshot.docs.map(_mapRecipeDocument);
      allRecipes = allRecipes.concat(chunkRecipes);
    });

    // Sort merged results by publishedAt DESC
    allRecipes.sort((a, b) => {
      const timeA = a.publishedAt?.toMillis() || 0;
      const timeB = b.publishedAt?.toMillis() || 0;
      return timeB - timeA; // DESC
    });

    console.log(`🔀 [getFollowingFeed] Merged ${allRecipes.length} total recipes from all chunks`);

    // STEP 5: Apply pagination with offset
    const startIndex = offset;
    const endIndex = offset + limit;
    const paginatedRecipes = allRecipes.slice(startIndex, endIndex);
    const hasMore = endIndex < allRecipes.length;
    const newOffset = hasMore ? endIndex : offset;

    console.log(`✅ [getFollowingFeed] Returning ${paginatedRecipes.length} recipes, hasMore: ${hasMore}, newOffset: ${newOffset}`);

    return _successResponse({
      recipes: paginatedRecipes,
      count: paginatedRecipes.length,
      hasMore,
      offset: newOffset,
      isEmpty: false
    });
  } catch (error) {
    console.error('❌ [getFollowingFeed] Error:', error);

    if (error.code && error.message) {
      // Validation error
      return _errorResponse(error.code, error.message);
    }

    if (error.code === 'permission-denied') {
      return _errorResponse(
        'feed/permission-denied',
        'You do not have permission to view following feed'
      );
    }

    return _errorResponse(
      'feed/fetch-failed',
      `Failed to fetch following feed: ${error.message}`
    );
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  getAllRecipesFeed,
  getTrendingFeed,
  getFollowingFeed,
};
