/**
 * Pending Likes Manager
 *
 * Singleton service for tracking optimistic like/unlike operations
 * across navigation boundaries and app restarts.
 *
 * Design Pattern: In-memory cache with AsyncStorage backup
 * - Instant UI updates across all screens
 * - Persistence across app restarts
 * - Auto-cleanup after Cloud Function confirmation
 * - Timeout-based cleanup (5s) for orphaned operations
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@pending_likes_v1';
const CLEANUP_TIMEOUT_MS = 5000; // 5 seconds

/**
 * Pending operation structure:
 * {
 *   recipeId: string,
 *   operation: 'like' | 'unlike',
 *   delta: 1 | -1,
 *   timestamp: number,
 *   userId: string
 * }
 */

class PendingLikesManager {
  constructor() {
    // In-memory cache for fast access
    this.pendingOperations = new Map(); // recipeId -> operation object
    this.initialized = false;
    this.cleanupTimers = new Map(); // recipeId -> timeoutId
  }

  /**
   * Initialize manager by loading from AsyncStorage
   * Call this on app start
   */
  async initialize() {
    if (this.initialized) return;

    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const operations = JSON.parse(stored);

        // Restore to Map, filter out expired operations (>30s old)
        const now = Date.now();
        operations.forEach(op => {
          if (now - op.timestamp < 30000) { // 30 second max age
            this.pendingOperations.set(op.recipeId, op);
            this._scheduleCleanup(op.recipeId);
          }
        });

        console.log(`📦 [PendingLikesManager] Restored ${this.pendingOperations.size} pending operations`);
      }

      this.initialized = true;
    } catch (error) {
      console.error('❌ [PendingLikesManager] Failed to initialize:', error);
      this.initialized = true; // Continue anyway
    }
  }

  /**
   * Add a pending operation
   * @param {string} userId - User performing the operation
   * @param {string} recipeId - Recipe being liked/unliked
   * @param {string} operation - 'like' or 'unlike'
   */
  async addPending(userId, recipeId, operation) {
    const delta = operation === 'like' ? 1 : -1;

    const pendingOp = {
      recipeId,
      operation,
      delta,
      timestamp: Date.now(),
      userId,
    };

    // Update in-memory cache
    this.pendingOperations.set(recipeId, pendingOp);

    // Persist to AsyncStorage
    await this._persist();

    // Schedule auto-cleanup
    this._scheduleCleanup(recipeId);

    console.log(`➕ [PendingLikesManager] Added pending ${operation} for recipe ${recipeId}`);
  }

  /**
   * Remove a pending operation (after Cloud Function confirmation)
   * @param {string} recipeId - Recipe ID
   */
  async removePending(recipeId) {
    if (!this.pendingOperations.has(recipeId)) return;

    this.pendingOperations.delete(recipeId);

    // Cancel cleanup timer
    this._cancelCleanup(recipeId);

    // Persist to AsyncStorage
    await this._persist();

    console.log(`➖ [PendingLikesManager] Removed pending operation for recipe ${recipeId}`);
  }

  /**
   * Get pending operation for a recipe
   * @param {string} recipeId - Recipe ID
   * @returns {object|null} Pending operation or null
   */
  getPending(recipeId) {
    return this.pendingOperations.get(recipeId) || null;
  }

  /**
   * Check if recipe has pending operation
   * @param {string} recipeId - Recipe ID
   * @returns {boolean}
   */
  hasPending(recipeId) {
    return this.pendingOperations.has(recipeId);
  }

  /**
   * Get all pending operations
   * @returns {Map} All pending operations
   */
  getAllPending() {
    return this.pendingOperations;
  }

  /**
   * Apply pending operation to a recipe object
   * @param {object} recipe - Recipe object with likes count
   * @returns {object} Recipe with adjusted like count
   */
  applyToRecipe(recipe) {
    if (!recipe || !recipe.id) return recipe;

    const pending = this.getPending(recipe.id);
    if (!pending) return recipe;

    // Apply optimistic delta
    const currentLikes = recipe.likes || recipe.likeCount || 0;
    const newLikes = Math.max(0, currentLikes + pending.delta);

    return {
      ...recipe,
      likes: newLikes,
      likeCount: newLikes,
      // Mark as optimistic for debugging
      __optimistic: true,
      __optimisticOperation: pending.operation,
    };
  }

  /**
   * Apply pending operations to an array of recipes
   * @param {Array} recipes - Array of recipe objects
   * @returns {Array} Recipes with adjusted like counts
   */
  applyToRecipes(recipes) {
    if (!Array.isArray(recipes)) return recipes;
    return recipes.map(recipe => this.applyToRecipe(recipe));
  }

  /**
   * Clear all pending operations (use with caution)
   */
  async clearAll() {
    this.pendingOperations.clear();

    // Cancel all cleanup timers
    this.cleanupTimers.forEach(timerId => clearTimeout(timerId));
    this.cleanupTimers.clear();

    await AsyncStorage.removeItem(STORAGE_KEY);
    console.log('🧹 [PendingLikesManager] Cleared all pending operations');
  }

  /**
   * Get statistics for debugging
   */
  getStats() {
    return {
      pendingCount: this.pendingOperations.size,
      operations: Array.from(this.pendingOperations.values()),
    };
  }

  // ========== PRIVATE METHODS ==========

  /**
   * Persist in-memory cache to AsyncStorage
   * @private
   */
  async _persist() {
    try {
      const operations = Array.from(this.pendingOperations.values());
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(operations));
    } catch (error) {
      console.error('❌ [PendingLikesManager] Failed to persist:', error);
    }
  }

  /**
   * Schedule auto-cleanup for a pending operation
   * @private
   */
  _scheduleCleanup(recipeId) {
    // Cancel existing timer if any
    this._cancelCleanup(recipeId);

    // Schedule new cleanup
    const timerId = setTimeout(() => {
      console.log(`⏱️ [PendingLikesManager] Auto-cleanup timeout for recipe ${recipeId}`);
      this.removePending(recipeId);
    }, CLEANUP_TIMEOUT_MS);

    this.cleanupTimers.set(recipeId, timerId);
  }

  /**
   * Cancel cleanup timer for a recipe
   * @private
   */
  _cancelCleanup(recipeId) {
    const timerId = this.cleanupTimers.get(recipeId);
    if (timerId) {
      clearTimeout(timerId);
      this.cleanupTimers.delete(recipeId);
    }
  }
}

// Singleton instance
const pendingLikesManager = new PendingLikesManager();

export default pendingLikesManager;
