/**
 * Optimistic Like Context
 *
 * Provides global access to optimistic like tracking across the app.
 * Ensures all recipe-related screens show consistent like counts
 * during the Cloud Function processing window.
 *
 * Usage:
 *   const { applyOptimisticLikes, recordLikeOperation, clearLikeOperation } = useOptimisticLikes();
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import pendingLikesManager from '../services/pendingLikesManager';

const OptimisticLikeContext = createContext(null);

export const OptimisticLikeProvider = ({ children }) => {
  const [initialized, setInitialized] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // Initialize pending likes manager on mount
  useEffect(() => {
    const init = async () => {
      await pendingLikesManager.initialize();
      setInitialized(true);

      // Update pending count
      const stats = pendingLikesManager.getStats();
      setPendingCount(stats.pendingCount);

      console.log('✅ [OptimisticLikeContext] Initialized with', stats.pendingCount, 'pending operations');
    };

    init();
  }, []);

  /**
   * Record a like/unlike operation as pending
   * Call this BEFORE calling likeService.likeRecipe()
   */
  const recordLikeOperation = useCallback(async (userId, recipeId, operation) => {
    await pendingLikesManager.addPending(userId, recipeId, operation);

    // Update pending count
    const stats = pendingLikesManager.getStats();
    setPendingCount(stats.pendingCount);
  }, []);

  /**
   * Clear a pending operation after Cloud Function confirmation
   * Call this AFTER likeService.likeRecipe() succeeds
   */
  const clearLikeOperation = useCallback(async (recipeId) => {
    await pendingLikesManager.removePending(recipeId);

    // Update pending count
    const stats = pendingLikesManager.getStats();
    setPendingCount(stats.pendingCount);
  }, []);

  /**
   * Apply pending optimistic updates to an array of recipes
   * Call this after fetching recipes from Firestore
   */
  const applyOptimisticLikes = useCallback((recipes) => {
    if (!initialized) return recipes;
    return pendingLikesManager.applyToRecipes(recipes);
  }, [initialized]);

  /**
   * Apply pending optimistic update to a single recipe
   */
  const applyOptimisticLike = useCallback((recipe) => {
    if (!initialized) return recipe;
    return pendingLikesManager.applyToRecipe(recipe);
  }, [initialized]);

  /**
   * Check if a recipe has a pending operation
   */
  const hasPendingOperation = useCallback((recipeId) => {
    return pendingLikesManager.hasPending(recipeId);
  }, []);

  /**
   * Get pending operation for a recipe
   */
  const getPendingOperation = useCallback((recipeId) => {
    return pendingLikesManager.getPending(recipeId);
  }, []);

  /**
   * Get statistics (for debugging)
   */
  const getStats = useCallback(() => {
    return {
      ...pendingLikesManager.getStats(),
      initialized,
    };
  }, [initialized]);

  /**
   * Clear all pending operations (use with caution, for debugging)
   */
  const clearAll = useCallback(async () => {
    await pendingLikesManager.clearAll();
    setPendingCount(0);
  }, []);

  const value = {
    initialized,
    pendingCount,
    recordLikeOperation,
    clearLikeOperation,
    applyOptimisticLikes,
    applyOptimisticLike,
    hasPendingOperation,
    getPendingOperation,
    getStats,
    clearAll,
  };

  return (
    <OptimisticLikeContext.Provider value={value}>
      {children}
    </OptimisticLikeContext.Provider>
  );
};

/**
 * Hook to access optimistic like tracking
 */
export const useOptimisticLikes = () => {
  const context = useContext(OptimisticLikeContext);

  if (!context) {
    throw new Error('useOptimisticLikes must be used within OptimisticLikeProvider');
  }

  return context;
};

export default OptimisticLikeContext;
