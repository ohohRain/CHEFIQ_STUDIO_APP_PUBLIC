/**
 * Comment Like Context
 *
 * Global state management for comment likes across the entire app.
 * Mirrors LikeContext architecture for consistency.
 *
 * Phase 12: Comment System
 * - Single source of truth for comment like state
 * - All screens subscribe to same state
 * - Optimistic UI updates with automatic rollback on error
 *
 * Usage:
 *   const { likedComments, commentLikeCounts, toggleCommentLike } = useCommentLikes();
 *   const isLiked = likedComments.has(commentId);
 *   const displayCount = commentLikeCounts[commentId] ?? comment.stats.likesCount;
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import commentLikeService from '../services/commentLikeService';
import { useAuth } from './AuthContext';

const CommentLikeContext = createContext(null);

export const CommentLikeProvider = ({ children }) => {
  const { user } = useAuth();

  // Global comment like state
  const [likedComments, setLikedComments] = useState(new Set());
  const [commentLikeCounts, setCommentLikeCounts] = useState({});
  const [loading, setLoading] = useState(false);

  // Load user's liked comments on mount or when user changes
  useEffect(() => {
    const loadLikedComments = async () => {
      if (!user?.uid) {
        // Clear state when user logs out
        setLikedComments(new Set());
        setCommentLikeCounts({});
        return;
      }

      try {
        setLoading(true);
        const result = await commentLikeService.getUserCommentLikes(user.uid, 100);

        if (result.success) {
          const likedSet = new Set(result.data.likes.map(like => like.commentId));
          setLikedComments(likedSet);
          console.log(`✅ [CommentLikeContext] Loaded ${likedSet.size} liked comments for user`);
        }
      } catch (error) {
        console.warn('[CommentLikeContext] Failed to load liked comments:', error);
      } finally {
        setLoading(false);
      }
    };

    loadLikedComments();
  }, [user?.uid]);

  /**
   * Toggle like/unlike for a comment with optimistic UI update
   * @param {string} commentId - Comment ID to toggle like
   * @param {number} currentCount - Current like count from Firestore
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  const toggleCommentLike = useCallback(async (commentId, currentCount) => {
    if (!user?.uid) {
      console.warn('[CommentLikeContext] Cannot toggle like - user not authenticated');
      return { success: false, error: 'User not authenticated' };
    }

    const wasLiked = likedComments.has(commentId);

    // Store previous state for rollback
    const prevLikedComments = new Set(likedComments);
    const prevLikeCount = commentLikeCounts[commentId] ?? currentCount;

    try {
      // Optimistic UI update - update immediately before backend call
      setLikedComments(prev => {
        const next = new Set(prev);
        if (wasLiked) {
          next.delete(commentId);
        } else {
          next.add(commentId);
        }
        return next;
      });

      setCommentLikeCounts(prev => ({
        ...prev,
        [commentId]: wasLiked ? prevLikeCount - 1 : prevLikeCount + 1,
      }));

      console.log(`🔄 [CommentLikeContext] Optimistic ${wasLiked ? 'unlike' : 'like'} for comment ${commentId}`);

      // Call backend service
      const result = wasLiked
        ? await commentLikeService.unlikeComment(user.uid, commentId)
        : await commentLikeService.likeComment(user.uid, commentId);

      if (!result.success) {
        throw new Error(result.error.message);
      }

      console.log(`✅ [CommentLikeContext] ${wasLiked ? 'Unlike' : 'Like'} successful for comment ${commentId}`);
      return { success: true };
    } catch (error) {
      console.error(`❌ [CommentLikeContext] Like operation failed for comment ${commentId}:`, error);

      // Rollback on error - restore previous state
      setLikedComments(prevLikedComments);
      setCommentLikeCounts(prev => ({
        ...prev,
        [commentId]: prevLikeCount,
      }));

      console.log(`↩️ [CommentLikeContext] Rolled back like state for comment ${commentId}`);
      return { success: false, error: error.message || 'Failed to update like status' };
    }
  }, [user?.uid, likedComments, commentLikeCounts]);

  /**
   * Get the display count for a comment, preferring global state over Firestore data
   * @param {string} commentId - Comment ID
   * @param {number} firestoreCount - Count from Firestore (fallback)
   * @returns {number} Display count
   */
  const getDisplayCount = useCallback((commentId, firestoreCount) => {
    return commentLikeCounts[commentId] ?? firestoreCount ?? 0;
  }, [commentLikeCounts]);

  /**
   * Check if a comment is liked by current user
   * @param {string} commentId - Comment ID
   * @returns {boolean} True if liked
   */
  const isCommentLiked = useCallback((commentId) => {
    return likedComments.has(commentId);
  }, [likedComments]);

  const value = {
    likedComments,          // Set<commentId> - for quick lookup
    commentLikeCounts,      // { commentId: count } - optimistic counts
    toggleCommentLike,      // (commentId, currentCount) => Promise<{success, error?}>
    getDisplayCount,        // (commentId, firestoreCount) => number
    isCommentLiked,         // (commentId) => boolean
    loading,                // boolean - initial load state
  };

  return <CommentLikeContext.Provider value={value}>{children}</CommentLikeContext.Provider>;
};

/**
 * Hook to access global comment like state
 * @throws {Error} If used outside CommentLikeProvider
 */
export const useCommentLikes = () => {
  const context = useContext(CommentLikeContext);

  if (!context) {
    throw new Error('useCommentLikes must be used within CommentLikeProvider');
  }

  return context;
};

export default CommentLikeContext;
