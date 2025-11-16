/**
 * Follow Service
 * Handles user follow/unfollow operations with Firestore
 *
 * Collection: follows/{followerId}_{followingId}
 * Stats updates handled by Cloud Functions (onFollowCreate, onFollowDelete)
 *
 * Modeled after likeService.js for consistency
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
 * Generate composite follow ID: {followerId}_{followingId}
 * @private
 */
const _generateFollowId = (followerId, followingId) => {
  return `${followerId}_${followingId}`;
};

/**
 * Validate follow operation parameters
 * @private
 */
const _validateFollowParams = (followerId, followingId) => {
  if (!followerId || typeof followerId !== 'string' || followerId.trim() === '') {
    throw {
      code: 'follow/invalid-follower-id',
      message: 'Valid follower ID is required',
    };
  }

  if (!followingId || typeof followingId !== 'string' || followingId.trim() === '') {
    throw {
      code: 'follow/invalid-following-id',
      message: 'Valid following ID is required',
    };
  }

  if (followerId === followingId) {
    throw {
      code: 'follow/self-follow',
      message: 'Users cannot follow themselves',
    };
  }
};

// ============================================================================
// MAIN SERVICE METHODS
// ============================================================================

/**
 * Follow a user
 * Creates a follow document in Firestore
 * Cloud Function (onFollowCreate) will automatically update user stats:
 * - users/{followingId}/stats/followersCount +1
 * - users/{followerId}/stats/followingCount +1
 *
 * @param {string} followerId - Firebase Auth UID of user doing the following
 * @param {string} followingId - Firebase Auth UID of user being followed
 * @returns {Promise<{success: boolean, data: {followId: string} | null, error: object | null}>}
 */
const followUser = async (followerId, followingId) => {
  try {
    // Validate parameters
    _validateFollowParams(followerId, followingId);

    // Generate composite key
    const followId = _generateFollowId(followerId, followingId);

    // Check if already following
    const followRef = doc(db, 'follows', followId);
    const followSnap = await getDoc(followRef);

    if (followSnap.exists()) {
      console.log(`⏭️ Already following user: ${followingId}`);
      return _successResponse({ followId, alreadyFollowing: true });
    }

    // Create follow document
    const followData = {
      followId,
      followerId,
      followingId,
      createdAt: Timestamp.now(),
    };

    await setDoc(followRef, followData);

    console.log(`✅ Followed user: ${followerId} → ${followingId}`);

    return _successResponse({ followId, alreadyFollowing: false });
  } catch (error) {
    console.error('❌ Follow user error:', error);

    if (error.code && error.message) {
      // Validation error
      return _errorResponse(error.code, error.message);
    }

    // Firestore error
    if (error.code === 'permission-denied') {
      return _errorResponse(
        'follow/permission-denied',
        'You do not have permission to follow this user'
      );
    }

    return _errorResponse(
      'follow/operation-failed',
      `Failed to follow user: ${error.message}`
    );
  }
};

/**
 * Unfollow a user
 * Deletes the follow document from Firestore
 * Cloud Function (onFollowDelete) will automatically update user stats:
 * - users/{followingId}/stats/followersCount -1
 * - users/{followerId}/stats/followingCount -1
 *
 * @param {string} followerId - Firebase Auth UID of user doing the unfollowing
 * @param {string} followingId - Firebase Auth UID of user being unfollowed
 * @returns {Promise<{success: boolean, data: {deleted: boolean} | null, error: object | null}>}
 */
const unfollowUser = async (followerId, followingId) => {
  try {
    // Validate parameters
    _validateFollowParams(followerId, followingId);

    // Generate composite key
    const followId = _generateFollowId(followerId, followingId);

    // Check if follow exists
    const followRef = doc(db, 'follows', followId);
    const followSnap = await getDoc(followRef);

    if (!followSnap.exists()) {
      console.log(`⏭️ Not following user, nothing to unfollow: ${followingId}`);
      return _successResponse({ deleted: false, notFollowing: true });
    }

    // Delete follow document
    await deleteDoc(followRef);

    console.log(`✅ Unfollowed user: ${followerId} ✗ ${followingId}`);

    return _successResponse({ deleted: true, notFollowing: false });
  } catch (error) {
    console.error('❌ Unfollow user error:', error);

    if (error.code && error.message) {
      // Validation error
      return _errorResponse(error.code, error.message);
    }

    // Firestore error
    if (error.code === 'permission-denied') {
      return _errorResponse(
        'follow/permission-denied',
        'You do not have permission to unfollow this user'
      );
    }

    return _errorResponse(
      'follow/operation-failed',
      `Failed to unfollow user: ${error.message}`
    );
  }
};

/**
 * Check if a user is following another user
 *
 * @param {string} followerId - Firebase Auth UID of potential follower
 * @param {string} followingId - Firebase Auth UID of user to check
 * @returns {Promise<{success: boolean, data: {isFollowing: boolean} | null, error: object | null}>}
 */
const checkFollowStatus = async (followerId, followingId) => {
  try {
    // Validate parameters
    _validateFollowParams(followerId, followingId);

    // Generate composite key
    const followId = _generateFollowId(followerId, followingId);

    // Check if follow document exists
    const followRef = doc(db, 'follows', followId);
    const followSnap = await getDoc(followRef);

    const isFollowing = followSnap.exists();

    return _successResponse({ isFollowing });
  } catch (error) {
    console.error('❌ Check follow status error:', error);

    if (error.code && error.message) {
      // Validation error
      return _errorResponse(error.code, error.message);
    }

    return _errorResponse(
      'follow/check-failed',
      `Failed to check follow status: ${error.message}`
    );
  }
};

/**
 * Get users a user is following
 *
 * @param {string} followerId - Firebase Auth UID
 * @param {number} limit - Maximum number of follows to fetch (default: 100)
 * @returns {Promise<{success: boolean, data: {follows: Array, count: number} | null, error: object | null}>}
 */
const getUserFollowing = async (followerId, limit = 100) => {
  try {
    if (!followerId || typeof followerId !== 'string' || followerId.trim() === '') {
      throw {
        code: 'follow/invalid-follower-id',
        message: 'Valid follower ID is required',
      };
    }

    // Query follows by followerId, ordered by most recent
    const followsQuery = query(
      collection(db, 'follows'),
      where('followerId', '==', followerId),
      orderBy('createdAt', 'desc'),
      firestoreLimit(limit)
    );

    const followsSnapshot = await getDocs(followsQuery);

    const follows = followsSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        followId: data.followId,
        followerId: data.followerId,
        followingId: data.followingId,
        createdAt: data.createdAt,
      };
    });

    console.log(`✅ Fetched ${follows.length} following for user ${followerId}`);

    return _successResponse({ follows, count: follows.length });
  } catch (error) {
    console.error('❌ Get user following error:', error);

    if (error.code && error.message) {
      // Validation error
      return _errorResponse(error.code, error.message);
    }

    return _errorResponse(
      'follow/fetch-failed',
      `Failed to fetch user following: ${error.message}`
    );
  }
};

/**
 * Get followers of a user
 *
 * @param {string} followingId - Firebase Auth UID
 * @param {number} limit - Maximum number of followers to fetch (default: 100)
 * @returns {Promise<{success: boolean, data: {follows: Array, count: number} | null, error: object | null}>}
 */
const getUserFollowers = async (followingId, limit = 100) => {
  try {
    if (!followingId || typeof followingId !== 'string' || followingId.trim() === '') {
      throw {
        code: 'follow/invalid-following-id',
        message: 'Valid following ID is required',
      };
    }

    // Query follows by followingId, ordered by most recent
    const followsQuery = query(
      collection(db, 'follows'),
      where('followingId', '==', followingId),
      orderBy('createdAt', 'desc'),
      firestoreLimit(limit)
    );

    const followsSnapshot = await getDocs(followsQuery);

    const follows = followsSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        followId: data.followId,
        followerId: data.followerId,
        followingId: data.followingId,
        createdAt: data.createdAt,
      };
    });

    console.log(`✅ Fetched ${follows.length} followers for user ${followingId}`);

    return _successResponse({ follows, count: follows.length });
  } catch (error) {
    console.error('❌ Get user followers error:', error);

    if (error.code && error.message) {
      // Validation error
      return _errorResponse(error.code, error.message);
    }

    return _errorResponse(
      'follow/fetch-failed',
      `Failed to fetch user followers: ${error.message}`
    );
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  followUser,
  unfollowUser,
  checkFollowStatus,
  getUserFollowing,
  getUserFollowers,
};
