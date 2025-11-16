/**
 * Recipe Helper Utilities
 *
 * Reusable functions for recipe data manipulation across all screens
 */

import pendingLikesManager from '../services/pendingLikesManager';

/**
 * Apply pending like operations to an array of recipes
 * This ensures all screens show consistent optimistic UI
 *
 * @param {Array} recipes - Array of recipe objects
 * @returns {Array} Recipes with optimistic like counts applied
 *
 * @example
 * const recipes = await feedService.getAllRecipesFeed();
 * const recipesWithOptimistic = applyPendingLikesToRecipes(recipes);
 */
export const applyPendingLikesToRecipes = (recipes) => {
  if (!Array.isArray(recipes) || recipes.length === 0) {
    return recipes;
  }

  return pendingLikesManager.applyToRecipes(recipes);
};

/**
 * Apply pending like operation to a single recipe
 *
 * @param {object} recipe - Recipe object
 * @returns {object} Recipe with optimistic like count applied
 *
 * @example
 * const recipe = await recipeService.getRecipe(recipeId);
 * const recipeWithOptimistic = applyPendingLikeToRecipe(recipe);
 */
export const applyPendingLikeToRecipe = (recipe) => {
  if (!recipe) return recipe;
  return pendingLikesManager.applyToRecipe(recipe);
};

/**
 * Format number with K/M notation
 * Used for displaying like counts, view counts, etc.
 *
 * @param {number} num - Number to format
 * @returns {string} Formatted string (e.g., "1.2K", "3.5M")
 *
 * @example
 * formatNumber(1234) // "1.2K"
 * formatNumber(1500000) // "1.5M"
 */
export const formatNumber = (num) => {
  if (typeof num !== 'number') return '0';

  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
};

/**
 * Format user stats object for display
 * Handles both database v3.0 schema and legacy formats
 *
 * @param {object} stats - User stats object from Firestore
 * @returns {object} Formatted stats for UI display
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

/**
 * Check if a recipe is optimistically updated
 * Useful for debugging and UI indicators
 *
 * @param {object} recipe - Recipe object
 * @returns {boolean} True if recipe has pending optimistic update
 */
export const isOptimistic = (recipe) => {
  return recipe && recipe.__optimistic === true;
};

/**
 * Get the optimistic operation type for a recipe
 *
 * @param {object} recipe - Recipe object
 * @returns {string|null} 'like', 'unlike', or null
 */
export const getOptimisticOperation = (recipe) => {
  return recipe && recipe.__optimisticOperation || null;
};
