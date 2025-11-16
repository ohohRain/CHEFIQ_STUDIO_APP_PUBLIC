// ============================================================================
// Search Service
// ============================================================================
// Implements recipe and user search functionality
// - Recipe search: Client-side filtering with caching (MVP approach)
// - User search: Firestore prefix matching
// See: design/pages/Page11_SearchResults.md

import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  startAt,
  endAt,
  limit,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// ============================================================================
// Cache Management
// ============================================================================

let recipeCache = null;
let cacheTimestamp = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Clear recipe cache (call when recipes are created/deleted)
 */
export const clearRecipeCache = () => {
  recipeCache = null;
  cacheTimestamp = null;
  console.log('🗑️ Recipe cache cleared');
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Transform Firestore recipe document to app recipe object
 * Maps Firestore field names to match HomeScreen UI component expectations
 * @private
 */
const _mapRecipeDocument = (data) => {
  return {
    // Core recipe fields
    id: data.recipeId || data.id,
    recipeId: data.recipeId || data.id,
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

    // For masonry layout (default aspect ratio)
    aspectRatio: 1.0,
  };
};

/**
 * Fetch all published recipes from Firestore (with caching)
 * @returns {Promise<Array>} Array of recipe objects
 */
const fetchAllRecipes = async () => {
  // Check cache validity
  if (recipeCache && cacheTimestamp && Date.now() - cacheTimestamp < CACHE_TTL) {
    console.log('✅ Using cached recipes');
    return recipeCache;
  }

  try {
    const recipesRef = collection(db, 'recipes');
    const q = query(
      recipesRef,
      where('status', '==', 'published'),
      orderBy('publishedAt', 'desc')
    );

    const snapshot = await getDocs(q);
    const recipes = snapshot.docs.map((doc) => _mapRecipeDocument(doc.data()));

    // Update cache
    recipeCache = recipes;
    cacheTimestamp = Date.now();

    console.log(`✅ Fetched ${recipes.length} recipes for search (cached for 5 min)`);
    return recipes;
  } catch (error) {
    console.error('❌ Failed to fetch recipes:', error);
    throw error;
  }
};

/**
 * Create success response
 */
const _successResponse = (data) => ({
  success: true,
  data,
});

/**
 * Create error response
 */
const _errorResponse = (code, message) => ({
  success: false,
  error: { code, message },
});

// ============================================================================
// Public Methods
// ============================================================================

/**
 * Search recipes by keyword matching
 * Searches in: title, description, ingredients, cuisine
 * @param {string} searchQuery - Search query string
 * @param {object} filters - Filter options { difficulty: [], equipment: [], cuisineType: [] }
 * @returns {Promise<object>} Response with recipes array and total count
 */
export const searchRecipes = async (searchQuery, filters = {}) => {
  try {
    const query = searchQuery.toLowerCase().trim();

    // Minimum query length
    if (query.length < 2) {
      return _errorResponse(
        'search/query-too-short',
        'Search query must be at least 2 characters'
      );
    }

    // Fetch all recipes (from cache if available)
    const allRecipes = await fetchAllRecipes();

    // Split query into keywords
    const keywords = query.split(' ').filter((k) => k.length > 0);

    // Filter by keyword matching
    let results = allRecipes.filter((recipe) => {
      // Build searchable text from recipe fields
      const searchableText = [
        recipe.title?.toLowerCase() || '',
        recipe.description?.toLowerCase() || '',
        recipe.cuisine?.toLowerCase() || '',
        ...(recipe.ingredients?.map((i) => i.name.toLowerCase()) || []),
      ].join(' ');

      // Check if ALL keywords exist in searchable text
      return keywords.every((keyword) => searchableText.includes(keyword));
    });

    // Apply filters
    if (filters.difficulty && filters.difficulty.length > 0) {
      results = results.filter((recipe) =>
        filters.difficulty.includes(recipe.difficulty)
      );
    }

    if (filters.equipment && filters.equipment.length > 0) {
      results = results.filter((recipe) =>
        recipe.equipment?.some((eq) => filters.equipment.includes(eq))
      );
    }

    if (filters.cuisineType && filters.cuisineType.length > 0) {
      results = results.filter((recipe) =>
        filters.cuisineType.includes(recipe.cuisine)
      );
    }

    console.log(`🔍 Found ${results.length} recipes for "${searchQuery}"`);

    return _successResponse({
      recipes: results,
      total: results.length,
    });
  } catch (error) {
    console.error('❌ Recipe search failed:', error);
    return _errorResponse(
      error.code || 'search/failed',
      error.message || 'Search failed. Please try again.'
    );
  }
};

/**
 * Search users by username or handle using Firestore prefix matching
 * Uses client-side filtering for case-insensitive username search
 * @param {string} searchQuery - Search query string
 * @param {number} pageSize - Number of results to return (default: 20)
 * @returns {Promise<object>} Response with users array and total count
 */
export const searchUsers = async (searchQuery, pageSize = 20) => {
  try {
    const queryText = searchQuery.toLowerCase().trim();

    // Minimum query length
    if (queryText.length < 2) {
      return _errorResponse(
        'search/query-too-short',
        'Search query must be at least 2 characters'
      );
    }

    const usersRef = collection(db, 'users');
    const userMap = new Map();

    // Strategy 1: Search by handle (with @ prefix) - Firestore query
    // Handles are always lowercase, so this works with startAt/endAt
    const handleWithAt = '@' + queryText;
    const handleQuery = query(
      usersRef,
      orderBy('handle'),
      startAt(handleWithAt),
      endAt(handleWithAt + '\uf8ff'),
      limit(pageSize)
    );

    const handleSnapshot = await getDocs(handleQuery);

    handleSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      userMap.set(doc.id, {
        userId: doc.id,
        username: data.username,
        handle: data.handle,
        avatar: data.avatar || null,
        bio: data.bio || '',
        tags: data.tags || [],
        // Extract followersCount from nested stats object
        followersCount: data.stats?.followersCount || 0,
        recipesCount: data.stats?.recipesCount || 0,
      });
    });

    // Strategy 2: Search by username - Fetch all users and filter client-side
    // This is a temporary MVP solution. For production, add a 'usernameLower' field
    // to Firestore and index it for efficient case-insensitive queries.
    const allUsersQuery = query(usersRef, limit(100)); // Fetch first 100 users
    const allUsersSnapshot = await getDocs(allUsersQuery);

    allUsersSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      const usernameLower = (data.username || '').toLowerCase();

      // Client-side case-insensitive prefix matching on username
      if (usernameLower.startsWith(queryText) && !userMap.has(doc.id)) {
        userMap.set(doc.id, {
          userId: doc.id,
          username: data.username,
          handle: data.handle,
          avatar: data.avatar || null,
          bio: data.bio || '',
          tags: data.tags || [],
          // Extract followersCount from nested stats object
          followersCount: data.stats?.followersCount || 0,
          recipesCount: data.stats?.recipesCount || 0,
        });
      }
    });

    // Limit results to pageSize
    const results = Array.from(userMap.values()).slice(0, pageSize);

    console.log(`🔍 Found ${results.length} users for "${searchQuery}"`);

    return _successResponse({
      users: results,
      total: results.length,
    });
  } catch (error) {
    console.error('❌ User search failed:', error);
    return _errorResponse(
      error.code || 'search/failed',
      error.message || 'User search failed. Please try again.'
    );
  }
};

// ============================================================================
// Export
// ============================================================================

export default {
  searchRecipes,
  searchUsers,
  clearRecipeCache,
};
