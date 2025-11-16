/**
 * Like Context
 *
 * Global state management for recipe likes across the entire app.
 * Solves the navigation bug where like counts become stale when navigating
 * between HomeScreen and RecipeDetailScreen.
 *
 * Implementation: Instagram/Xiaohongshu pattern
 * - Single source of truth for like state
 * - All screens subscribe to same state
 * - Optimistic UI updates with automatic rollback on error
 *
 * Usage:
 *   const { likedRecipes, likeCounts, toggleLike } = useLikes();
 *   const isLiked = likedRecipes.has(recipeId);
 *   const displayCount = likeCounts[recipeId] ?? recipe.stats.likesCount;
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import likeService from '../services/likeService';
import { useAuth } from './AuthContext';

const LikeContext = createContext(null);

export const LikeProvider = ({ children }) => {
  const { user } = useAuth();

  // Global like state
  const [likedRecipes, setLikedRecipes] = useState(new Set());
  const [likeCounts, setLikeCounts] = useState({});
  const [loading, setLoading] = useState(false);

  // Load user's liked recipes on mount or when user changes
  useEffect(() => {
    const loadLikedRecipes = async () => {
      if (!user?.uid) {
        // Clear state when user logs out
        setLikedRecipes(new Set());
        setLikeCounts({});
        return;
      }

      try {
        setLoading(true);
        const result = await likeService.getUserLikes(user.uid, 100);

        if (result.success) {
          const likedSet = new Set(result.data.likes.map(like => like.recipeId));
          setLikedRecipes(likedSet);
          console.log(`✅ [LikeContext] Loaded ${likedSet.size} liked recipes for user`);
        }
      } catch (error) {
        console.warn('[LikeContext] Failed to load liked recipes:', error);
      } finally {
        setLoading(false);
      }
    };

    loadLikedRecipes();
  }, [user?.uid]);

  /**
   * Toggle like/unlike for a recipe with optimistic UI update
   * @param {string} recipeId - Recipe ID to toggle like
   * @param {number} currentCount - Current like count from Firestore
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  const toggleLike = useCallback(async (recipeId, currentCount) => {
    if (!user?.uid) {
      console.warn('[LikeContext] Cannot toggle like - user not authenticated');
      return { success: false, error: 'User not authenticated' };
    }

    const wasLiked = likedRecipes.has(recipeId);

    // Store previous state for rollback
    const prevLikedRecipes = new Set(likedRecipes);
    const prevLikeCount = likeCounts[recipeId] ?? currentCount;

    try {
      // Optimistic UI update - update immediately before backend call
      setLikedRecipes(prev => {
        const next = new Set(prev);
        if (wasLiked) {
          next.delete(recipeId);
        } else {
          next.add(recipeId);
        }
        return next;
      });

      setLikeCounts(prev => ({
        ...prev,
        [recipeId]: wasLiked ? prevLikeCount - 1 : prevLikeCount + 1,
      }));

      console.log(`🔄 [LikeContext] Optimistic ${wasLiked ? 'unlike' : 'like'} for recipe ${recipeId}`);

      // Call backend service
      const result = wasLiked
        ? await likeService.unlikeRecipe(user.uid, recipeId)
        : await likeService.likeRecipe(user.uid, recipeId);

      if (!result.success) {
        throw new Error(result.error.message);
      }

      console.log(`✅ [LikeContext] ${wasLiked ? 'Unlike' : 'Like'} successful for recipe ${recipeId}`);
      return { success: true };
    } catch (error) {
      console.error(`❌ [LikeContext] Like operation failed for recipe ${recipeId}:`, error);

      // Rollback on error - restore previous state
      setLikedRecipes(prevLikedRecipes);
      setLikeCounts(prev => ({
        ...prev,
        [recipeId]: prevLikeCount,
      }));

      console.log(`↩️ [LikeContext] Rolled back like state for recipe ${recipeId}`);
      return { success: false, error: error.message || 'Failed to update like status' };
    }
  }, [user?.uid, likedRecipes, likeCounts]);

  /**
   * Get the display count for a recipe, preferring global state over Firestore data
   * @param {string} recipeId - Recipe ID
   * @param {number} firestoreCount - Count from Firestore (fallback)
   * @returns {number} Display count
   */
  const getDisplayCount = useCallback((recipeId, firestoreCount) => {
    return likeCounts[recipeId] ?? firestoreCount ?? 0;
  }, [likeCounts]);

  /**
   * Check if a recipe is liked by current user
   * @param {string} recipeId - Recipe ID
   * @returns {boolean} True if liked
   */
  const isLiked = useCallback((recipeId) => {
    return likedRecipes.has(recipeId);
  }, [likedRecipes]);

  const value = {
    likedRecipes,      // Set<recipeId> - for quick lookup
    likeCounts,        // { recipeId: count } - optimistic counts
    toggleLike,        // (recipeId, currentCount) => Promise<{success, error?}>
    getDisplayCount,   // (recipeId, firestoreCount) => number
    isLiked,           // (recipeId) => boolean
    loading,           // boolean - initial load state
  };

  return <LikeContext.Provider value={value}>{children}</LikeContext.Provider>;
};

/**
 * Hook to access global like state
 * @throws {Error} If used outside LikeProvider
 */
export const useLikes = () => {
  const context = useContext(LikeContext);

  if (!context) {
    throw new Error('useLikes must be used within LikeProvider');
  }

  return context;
};

export default LikeContext;
